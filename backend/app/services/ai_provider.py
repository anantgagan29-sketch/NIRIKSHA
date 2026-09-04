"""
The boundary between NIRIKSHA and whatever vision model is answering today.

Everything that calls a model goes through here, for one reason: a model that
has run out of quota must be remembered. Before this module each part of the
pipeline kept its own list and its own retry loop, so an exhausted key was
rediscovered on every call — one inspection could spend six requests learning
the same thing three times.

Three ideas do the work:

  * **Classification.** A 429 is not a temporary error. Retrying it wastes a
    request and teaches us nothing. A 503 is temporary and worth one retry.
    A 400 is our own bad request and must never be retried at all.

  * **Memory.** A model that reports exhausted quota is set aside for a
    cooldown, so the next inspection skips straight to one that can answer.
    The memory lives in the process; a restart re-learns it at the cost of
    one request per model, which is the honest price of not persisting it.

  * **Order.** Models are tried fastest-first, and the list is configuration,
    not code.

This does not attempt to work around any provider limit. It spends fewer
requests, and it stops spending them on models that have already said no.
"""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from typing import Callable, Optional

from app.core.config import (
    AI_MODELS,
    PER_MODEL_TIMEOUT_SECONDS,
    QUOTA_COOLDOWN_SECONDS,
    RATE_LIMIT_COOLDOWN_SECONDS,
    UNAVAILABLE_COOLDOWN_SECONDS,
)

# ============================================================
# ERROR CLASSIFICATION
# ============================================================

QUOTA = "quota"              # daily/'-PerDay' allowance spent
RATE_LIMIT = "rate_limit"    # too fast, recoverable within the minute
UNAVAILABLE = "unavailable"  # 503/500 — the model, not us
TIMEOUT = "timeout"          # took longer than we can wait
BAD_REQUEST = "bad_request"  # our fault; retrying repeats the mistake
UNKNOWN = "unknown"


def classify_error(error: BaseException) -> str:
    """
    Works out what a failed call means, from the provider's error text.

    The distinction that matters most is quota versus rate limit. Both arrive
    as 429, but a spent daily allowance will still be spent in a minute, while
    a per-minute limit will not — so they earn very different cooldowns.
    """

    text = str(error)

    if isinstance(error, TimeoutError):
        return TIMEOUT

    if "429" in text or "RESOURCE_EXHAUSTED" in text:
        # The provider names the quota it refused on. A per-day metric is the
        # one worth standing down from for a long time.
        if "PerDay" in text or "per day" in text.lower():
            return QUOTA
        if "PerMinute" in text or "per minute" in text.lower():
            return RATE_LIMIT
        return QUOTA

    if "503" in text or "UNAVAILABLE" in text or "500" in text or "INTERNAL" in text:
        return UNAVAILABLE

    # A model name that no longer exists is a configuration problem, but it
    # is the *model* that is missing — moving to the next one is right, and
    # far better than failing the inspection over a retired name.
    if "404" in text or "NOT_FOUND" in text or "is not found" in text:
        return UNAVAILABLE

    if "400" in text or "INVALID_ARGUMENT" in text or "PERMISSION_DENIED" in text or "401" in text or "403" in text:
        return BAD_REQUEST

    if "timeout" in text.lower() or "deadline" in text.lower():
        return TIMEOUT

    return UNKNOWN


_COOLDOWNS = {
    QUOTA: QUOTA_COOLDOWN_SECONDS,
    RATE_LIMIT: RATE_LIMIT_COOLDOWN_SECONDS,
    UNAVAILABLE: UNAVAILABLE_COOLDOWN_SECONDS,
    TIMEOUT: UNAVAILABLE_COOLDOWN_SECONDS,
    UNKNOWN: UNAVAILABLE_COOLDOWN_SECONDS,
    # A bad request is not the model's fault, so it earns no cooldown at all.
    BAD_REQUEST: 0.0,
}


# ============================================================
# AVAILABILITY
# ============================================================


@dataclass
class _Standdown:
    until: float
    reason: str


class ModelAvailability:
    """
    Remembers which models have said no, and until when.

    Shared by every caller in the process, so what one inspection learns the
    next one already knows.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._standdown: dict[str, _Standdown] = {}

    def mark_failed(self, model: str, reason: str) -> float:
        """Sets a model aside. Returns the cooldown applied, in seconds."""

        cooldown = _COOLDOWNS.get(reason, UNAVAILABLE_COOLDOWN_SECONDS)

        if cooldown <= 0:
            return 0.0

        with self._lock:
            self._standdown[model] = _Standdown(time.time() + cooldown, reason)

        return cooldown

    def mark_succeeded(self, model: str) -> None:
        """Clears any standdown — the model is answering again."""

        with self._lock:
            self._standdown.pop(model, None)

    def is_available(self, model: str) -> bool:
        with self._lock:
            entry = self._standdown.get(model)

            if entry is None:
                return True

            if time.time() >= entry.until:
                del self._standdown[model]
                return True

            return False

    def available_models(self, models: list[str]) -> list[str]:
        return [model for model in models if self.is_available(model)]

    def snapshot(self) -> dict:
        """What the tracker currently believes, for /health and for tests."""

        now = time.time()

        with self._lock:
            resting = {
                model: {
                    "reason": entry.reason,
                    "seconds_remaining": max(0, round(entry.until - now)),
                }
                for model, entry in self._standdown.items()
                if entry.until > now
            }

        return {
            "configured": list(AI_MODELS),
            "resting": resting,
            "available": [m for m in AI_MODELS if m not in resting],
        }

    def reset(self) -> None:
        with self._lock:
            self._standdown.clear()


#  One tracker for the process. Both the parser and the readability pass
#  consult it, so quota learned in one is not rediscovered in the other.
availability = ModelAvailability()


# ============================================================
# CALLING A MODEL
# ============================================================


class AllModelsUnavailable(RuntimeError):
    """
    Every configured model declined, and the reasons are recorded.

    Raised instead of a provider error so callers can decide to fall back to
    non-generative processing rather than parsing error strings themselves.
    """

    def __init__(self, reasons: dict[str, str]):
        self.reasons = reasons
        self.quota_exhausted = any(r in (QUOTA, RATE_LIMIT) for r in reasons.values())
        super().__init__(
            "No vision model was available. "
            + ", ".join(f"{model}: {reason}" for model, reason in reasons.items())
        )


def _run_with_deadline(run: Callable[[str], object], model: str, seconds: float):
    """
    Runs one model call, giving up on it after `seconds`.

    The worker is abandoned rather than waited for — shutting the pool down
    with wait=True would block until the slow call finished, which is exactly
    the delay the deadline exists to avoid. The orphaned thread completes into
    a result nobody reads.
    """

    pool = ThreadPoolExecutor(max_workers=1)

    try:
        future = pool.submit(run, model)

        try:
            return future.result(timeout=seconds)

        except FutureTimeout:
            future.cancel()
            raise TimeoutError(
                f"{model} did not answer within {seconds:.0f}s"
            )

    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def call_with_fallback(
    run: Callable[[str], object],
    *,
    models: Optional[list[str]] = None,
    transient_retries: int = 1,
    retry_delay: float = 0.8,
    label: str = "vision",
    per_model_timeout: Optional[float] = None,
    overall_deadline: Optional[float] = None,
):
    """
    Runs `run(model)` against the first model that will answer.

    `run` is given a model name and returns whatever the caller wants; this
    function only decides which model to hand it and what a failure means.

    Retries are spent only on genuinely transient failures. Quota and rate
    limits move straight to the next model, because waiting on the same one
    cannot help and costs another request.

    Each model gets its own slice of time. Without that, one model having a
    slow afternoon consumes the entire budget and the six behind it are never
    asked — which is how a request fails while a model that would have
    answered in five seconds sits untried.
    """

    slice_seconds = per_model_timeout or PER_MODEL_TIMEOUT_SECONDS

    candidates = models or list(AI_MODELS)

    reasons: dict[str, str] = {}

    # Models known to be resting are skipped without spending a request, but
    # they are still reported if nothing else works, so the caller can tell
    # "quota exhausted" from "everything is broken".
    ready = [model for model in candidates if availability.is_available(model)]

    for model in candidates:
        if model not in ready:
            reasons[model] = "resting"

    if not ready:
        raise AllModelsUnavailable(
            {model: _resting_reason(model) for model in candidates}
        )

    return_early = False

    for model in ready:

        if return_early:
            break

        for attempt in range(1, transient_retries + 2):

            if overall_deadline and time.monotonic() >= overall_deadline:
                print(f"{label}: out of time before reaching {model}")
                reasons.setdefault(model, "not reached")
                return_early = True
                break

            # Never let one model's slice outlast the whole request.
            remaining = (
                max(1.0, overall_deadline - time.monotonic())
                if overall_deadline
                else slice_seconds
            )

            try:
                result = _run_with_deadline(run, model, min(slice_seconds, remaining))
                availability.mark_succeeded(model)
                print(f"{label}: answered by {model}")
                return result, model

            except Exception as error:

                reason = classify_error(error)

                # Our own malformed request. Another model would refuse it in
                # exactly the same way, so this is reported immediately.
                if reason == BAD_REQUEST:
                    raise

                cooldown = availability.mark_failed(model, reason)
                reasons[model] = reason

                print(
                    f"{label}: {model} -> {reason}"
                    + (f", resting {cooldown:.0f}s" if cooldown else "")
                )

                # Quota and rate limits are not waited out on the same model.
                if reason in (QUOTA, RATE_LIMIT):
                    break

                if attempt <= transient_retries:
                    time.sleep(retry_delay)
                    continue

                break

    raise AllModelsUnavailable(reasons)


def _resting_reason(model: str) -> str:
    snapshot = availability.snapshot()["resting"].get(model)
    return snapshot["reason"] if snapshot else "resting"
