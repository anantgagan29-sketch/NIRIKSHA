"""
How the service behaves when models refuse.

The demonstration case these guard: a daily allowance is spent, and the
inspection must not turn into a burst of retries against models that have
already said no.
"""

import time

from app.services import ai_provider as ap
from app.services.ai_provider import (
    AllModelsUnavailable,
    BAD_REQUEST,
    QUOTA,
    RATE_LIMIT,
    TIMEOUT,
    UNAVAILABLE,
    availability,
    call_with_fallback,
    classify_error,
)

results = []


def check(name, condition, detail=""):
    print(f"{'PASS' if condition else 'FAIL'}  {name}")
    if not condition and detail:
        print(f"        {detail}")
    results.append(bool(condition))


QUOTA_ERROR = Exception(
    "429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your "
    "current quota', 'details': [{'quotaId': "
    "'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}}"
)

print("=== error classification ===")
check("daily quota -> quota", classify_error(QUOTA_ERROR) == QUOTA, classify_error(QUOTA_ERROR))
check("per-minute 429 -> rate limit",
      classify_error(Exception("429 RESOURCE_EXHAUSTED GenerateRequestsPerMinute")) == RATE_LIMIT)
check("503 -> unavailable", classify_error(Exception("503 UNAVAILABLE")) == UNAVAILABLE)
check("400 -> bad request", classify_error(Exception("400 INVALID_ARGUMENT")) == BAD_REQUEST)
check("timeout -> timeout", classify_error(TimeoutError("too slow")) == TIMEOUT)

print("\n=== an exhausted model is not asked again ===")
availability.reset()
calls = []

def always_quota(model):
    calls.append(model)
    raise QUOTA_ERROR

try:
    call_with_fallback(always_quota, models=["m1", "m2"], transient_retries=3, label="test")
    check("all-exhausted raises", False, "no exception")
except AllModelsUnavailable as e:
    check("all-exhausted raises AllModelsUnavailable", True)
    check("it knows the cause was quota", e.quota_exhausted, str(e.reasons))

check("quota is not retried on the same model — one call each",
      calls == ["m1", "m2"], str(calls))

calls.clear()
try:
    call_with_fallback(always_quota, models=["m1", "m2"], label="test")
except AllModelsUnavailable:
    pass
check("a second inspection spends no requests at all — models are resting",
      calls == [], str(calls))

print("\n=== a transient failure is retried, then moves on ===")
availability.reset()
attempts = []

def flaky(model):
    attempts.append(model)
    if model == "m1":
        raise Exception("503 UNAVAILABLE")
    return {"ok": True}

# Keep the retry pause out of the test's runtime. `ap.time` is the shared
# time module, so the original is put back straight afterwards rather than
# left patched for everything that follows.
_real_sleep = time.sleep
time.sleep = lambda _s: None
try:
    value, used = call_with_fallback(flaky, models=["m1", "m2"], transient_retries=1, retry_delay=0, label="test")
finally:
    time.sleep = _real_sleep
check("m1 retried once then abandoned, m2 answered",
      attempts == ["m1", "m1", "m2"] and used == "m2", str(attempts))
check("the answer is returned", value == {"ok": True})

print("\n=== a bad request is never retried ===")
availability.reset()
tries = []

def bad(model):
    tries.append(model)
    raise Exception("400 INVALID_ARGUMENT")

try:
    call_with_fallback(bad, models=["m1", "m2"], transient_retries=3, label="test")
    check("bad request propagates", False, "no exception")
except AllModelsUnavailable:
    check("bad request propagates as itself, not AllModelsUnavailable", False)
except Exception:
    check("bad request propagates as itself", True)

check("a bad request is tried once and not moved to another model",
      tries == ["m1"], str(tries))
check("a bad request does not rest a healthy model", availability.is_available("m1"))

print("\n=== recovery ===")
availability.reset()
availability.mark_failed("m1", UNAVAILABLE)
check("a failed model is set aside", not availability.is_available("m1"))
availability.mark_succeeded("m1")
check("a model that answers is available again", availability.is_available("m1"))

availability.reset()
ap._COOLDOWNS[RATE_LIMIT] = 0.4
availability.mark_failed("m1", RATE_LIMIT)
check("a rate-limited model rests", not availability.is_available("m1"))
time.sleep(0.5)
check("and returns on its own when the cooldown passes", availability.is_available("m1"))

print("\n=== quota rests longer than a blip ===")
check("quota cooldown is much longer than a 503 cooldown",
      ap._COOLDOWNS[QUOTA] > ap._COOLDOWNS[UNAVAILABLE] * 10,
      f"{ap._COOLDOWNS[QUOTA]} vs {ap._COOLDOWNS[UNAVAILABLE]}")

print(f"\n{sum(results)}/{len(results)} passed")
raise SystemExit(0 if all(results) else 1)
