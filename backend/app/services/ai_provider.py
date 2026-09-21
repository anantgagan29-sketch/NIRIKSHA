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
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from typing import Callable, Optional

from app.core.config import (
    AI_HEDGE_AFTER_SECONDS,
    AI_HEDGE_MAX_INFLIGHT,
    AI_MODELS,
    PER_MODEL_TIMEOUT_SECONDS,
    QUOTA_COOLDOWN_SECONDS,
    RATE_LIMIT_COOLDOWN_SECONDS,
    TIMEOUT_COOLDOWN_SECONDS,
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
    TIMEOUT: TIMEOUT_COOLDOWN_SECONDS,
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
        # How long each model took the last few times it answered, as a
        # moving average. Models that answer quickly are asked first.
        self._latency: dict[str, float] = {}

    def mark_failed(self, model: str, reason: str) -> float:
        """Sets a model aside. Returns the cooldown applied, in seconds."""

        cooldown = _COOLDOWNS.get(reason, UNAVAILABLE_COOLDOWN_SECONDS)

        if cooldown <= 0:
            return 0.0

        with self._lock:
            self._standdown[model] = _Standdown(time.time() + cooldown, reason)

        return cooldown

    def mark_succeeded(self, model: str, seconds: Optional[float] = None) -> None:
        """Clears any standdown — the model is answering again."""

        with self._lock:
            self._standdown.pop(model, None)
            if seconds is not None:
                previous = self._latency.get(model)
                self._latency[model] = (
                    seconds if previous is None else previous * 0.6 + seconds * 0.4
                )

    def order(self, models: list[str]) -> list[str]:
        """
        The models in the order worth asking them.

        A model that has answered recently, and quickly, goes first; the
        rest keep their configured order behind it. The configured order is
        a guess made before the day started, and the provider's speed
        changes hour by hour — the model that answered the last scan in
        three seconds is the best bet for this one.
        """

        with self._lock:
            known = dict(self._latency)

        position = {model: index for index, model in enumerate(models)}

        return sorted(
            models,
            key=lambda m: (0, known[m]) if m in known else (1, position[m]),
        )

    def is_available(self, model: str) -> bool:
        with self._lock:
            entry = self._standdown.get(model)

            if entry is None:
                return True

            if time.time() >= entry.until:
                del self._standdown[model]
                return True

            return False

    def rest_remaining(self, model: str) -> float:
        """Seconds until the model may be asked again; zero when it may now."""

        with self._lock:
            entry = self._standdown.get(model)
            return max(0.0, entry.until - time.time()) if entry else 0.0

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
            self._latency.clear()


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


def call_with_fallback(
    run: Callable[[str], object],
    *,
    models: Optional[list[str]] = None,
    transient_retries: int = 1,
    retry_delay: float = 0.8,
    label: str = "vision",
    per_model_timeout: Optional[float] = None,
    overall_deadline: Optional[float] = None,
    hedge_after: Optional[float] = None,
    max_inflight: Optional[int] = None,
):
    """
    Runs `run(model)` against the first model that answers.

    `run` is given a model name and returns whatever the caller wants; this
    function only decides which models to hand it, when, and what a failure
    means.

    Models are asked in order, but not strictly one at a time. The first is
    asked alone; if it has not answered after `hedge_after` seconds the next
    is asked as well, and so on up to `max_inflight` in flight together. The
    first answer is returned and the others are abandoned. A model that fails
    outright frees its place immediately, so a 503 costs the time it took to
    arrive and nothing more.

    Retries are spent only on genuinely transient failures, and only when
    there is no other model left to move to. Quota and rate limits move
    straight on, because waiting on the same model cannot help and costs
    another request.

    Each model still gets its own slice of time (`per_model_timeout`). A
    model past its slice is treated as having timed out and its worker is
    left to finish into a result nobody reads — waiting for it is exactly
    the delay the slice exists to avoid.
    """

    slice_seconds = per_model_timeout or PER_MODEL_TIMEOUT_SECONDS
    hedge_seconds = AI_HEDGE_AFTER_SECONDS if hedge_after is None else hedge_after
    inflight_limit = max(1, max_inflight or AI_HEDGE_MAX_INFLIGHT)

    candidates = models or list(AI_MODELS)

    reasons: dict[str, str] = {}

    # Models known to be resting are skipped without spending a request, but
    # they are still reported if nothing else works, so the caller can tell
    # "quota exhausted" from "everything is broken".
    ready = availability.order(
        [model for model in candidates if availability.is_available(model)]
    )

    for model in candidates:
        if model not in ready:
            reasons[model] = "resting"

    # Nothing is ready, but something will be within the budget: a model
    # resting after a 503 or a slow answer is back in seconds, and failing
    # the request now — with forty seconds of budget unspent — would turn a
    # brief refusal into no result at all.
    if not ready:
        budget = (overall_deadline - time.monotonic()) if overall_deadline else slice_seconds
        soon = sorted(
            (availability.rest_remaining(model), model)
            for model in candidates
            if _resting_reason(model) in (UNAVAILABLE, TIMEOUT, UNKNOWN)
        )
        if soon and soon[0][0] < budget:
            wait_for, model = soon[0]
            print(f"{label}: waiting {wait_for:.0f}s for {model} to rest")
            time.sleep(wait_for)
            ready = [model]
            reasons.pop(model, None)

    if not ready:
        raise AllModelsUnavailable(
            {model: _resting_reason(model) for model in candidates}
        )

    queue = list(ready)
    inflight: dict[Future, tuple[str, float]] = {}
    started_at: dict[Future, float] = {}
    attempts: dict[str, int] = {}
    last_start = -1e9

    # Not a context manager: leaving a `with` block waits for running calls,
    # and an abandoned call may run for as long as the model takes. Sized for
    # the abandoned as well as the live: a worker still busy with a model
    # that overran its slice must not hold up the model asked next.
    pool = ThreadPoolExecutor(
        max_workers=inflight_limit + len(ready) * (transient_retries + 1)
    )

    def out_of_time() -> bool:
        return bool(overall_deadline and time.monotonic() >= overall_deadline)

    try:
        while queue or inflight:

            now = time.monotonic()

            if out_of_time():
                for model in queue:
                    reasons.setdefault(model, "not reached")
                for model, _ in inflight.values():
                    reasons[model] = TIMEOUT
                    availability.mark_failed(model, TIMEOUT)
                print(f"{label}: out of time")
                break

            # With the list exhausted and room to spare, a model whose
            # refusal has aged past its rest may be asked again alongside
            # whatever is still in flight — the provider's 503s come and go
            # in seconds, and waiting for every live call to finish before
            # trying again is time the answer could have been arriving in.
            if not queue and len(inflight) < inflight_limit:
                live = {model for model, _ in inflight.values()}
                queue = availability.order([
                    model for model in ready
                    if model not in live
                    and attempts.get(model, 0) <= transient_retries
                    and reasons.get(model) not in (None, QUOTA, RATE_LIMIT, "not reached")
                    and availability.is_available(model)
                ])
                if queue:
                    last_start = -1e9

            # Start another model when nothing is in flight, or when the
            # newest one has been quiet for the hedge interval.
            if queue and len(inflight) < inflight_limit and (
                not inflight or now - last_start >= hedge_seconds
            ):
                model = queue.pop(0)
                attempts[model] = attempts.get(model, 0) + 1
                if inflight:
                    print(f"{label}: hedging with {model}")
                future = pool.submit(run, model)
                inflight[future] = (model, now)
                started_at[future] = now
                last_start = now
                continue

            # Wake at the earliest of: an answer, the next hedge, a slice
            # expiring, or the overall deadline.
            wake = [start + slice_seconds for _, start in inflight.values()]
            if queue and len(inflight) < inflight_limit:
                wake.append(last_start + hedge_seconds)
            if not queue and len(inflight) < inflight_limit:
                # A rested model is worth waking for.
                live = {model for model, _ in inflight.values()}
                rests = [
                    availability.rest_remaining(model)
                    for model in ready
                    if model not in live
                    and attempts.get(model, 0) <= transient_retries
                    and reasons.get(model) not in (None, QUOTA, RATE_LIMIT, "not reached")
                ]
                if rests:
                    wake.append(now + min(rests))
            if overall_deadline:
                wake.append(overall_deadline)
            timeout = max(0.05, min(wake) - now) if wake else None

            done, _ = wait(list(inflight), timeout=timeout, return_when=FIRST_COMPLETED)

            # Slices are checked before answers on purpose: a model whose
            # slice has just expired but which has also just answered still
            # counts as an answer below, because `done` is handled afterwards.
            for future in list(inflight):
                if future in done:
                    continue
                model, started = inflight[future]
                if time.monotonic() - started >= slice_seconds:
                    del inflight[future]
                    future.cancel()
                    cooldown = availability.mark_failed(model, TIMEOUT)
                    reasons[model] = TIMEOUT
                    print(
                        f"{label}: {model} -> {TIMEOUT}"
                        + (f", resting {cooldown:.0f}s" if cooldown else "")
                    )

            for future in done:
                model, _ = inflight.pop(future)

                try:
                    result = future.result()
                except Exception as error:
                    reason = classify_error(error)

                    # Our own malformed request. Another model would refuse
                    # it in exactly the same way, so this is reported now.
                    if reason == BAD_REQUEST:
                        raise

                    cooldown = availability.mark_failed(model, reason)
                    reasons[model] = reason
                    print(
                        f"{label}: {model} -> {reason}"
                        + (f", resting {cooldown:.0f}s" if cooldown else "")
                    )

                    continue

                took = time.monotonic() - started_at[future]
                availability.mark_succeeded(model, took)
                print(f"{label}: answered by {model} in {took:.1f}s")
                return result, model

            # A failure freed a place: the next model may start immediately
            # rather than waiting out the hedge interval behind a model that
            # has already said no.
            if done and queue:
                last_start = -1e9

            # Every model has been asked once and none is still being
            # waited on. A second round goes to those that failed only
            # transiently — a 503 is the provider's moment, not its
            # verdict, and the model that refused four seconds ago is the
            # likeliest to answer now. Quota and rate limits are not asked
            # again: they cannot have changed.
            if not queue and not inflight and time.monotonic() < (overall_deadline or float("inf")):
                again = [
                    model for model in ready
                    if attempts.get(model, 0) <= transient_retries
                    and reasons.get(model) not in (QUOTA, RATE_LIMIT, "not reached")
                ]
                if again:
                    time.sleep(retry_delay)
                    queue = availability.order(again)
                    last_start = -1e9
                    print(f"{label}: second round — {', '.join(queue)}")

    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    raise AllModelsUnavailable(reasons)


def _resting_reason(model: str) -> str:
    snapshot = availability.snapshot()["resting"].get(model)
    return snapshot["reason"] if snapshot else "resting"
