"""Line-for-line port of backend/src/utils/circuit-breaker.ts.

CLOSED -> (failureThreshold consecutive failures) -> OPEN
OPEN -> (cooldown elapsed) -> HALF_OPEN (lets exactly one trial through)
HALF_OPEN -> (halfOpenSuccesses consecutive successes) -> CLOSED
HALF_OPEN -> (any failure) -> OPEN, cooldown restarts

The bulkhead (maxConcurrent) is checked before the breaker state: a call
rejected for being over the concurrency cap never ran, so it isn't counted
as a breaker failure. A lock guards the counters since Django may run
multiple threads per worker (Strapi's original only needed this for
single-threaded Node).
"""

import threading
import time


class CircuitOpenError(Exception):
    pass


class BulkheadRejectedError(Exception):
    pass


class CircuitBreaker:
    def __init__(self, failure_threshold: int, cooldown_seconds: float, half_open_successes: int, max_concurrent: int):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.half_open_successes = half_open_successes
        self.max_concurrent = max_concurrent

        self._lock = threading.Lock()
        self._state = "closed"
        self._consecutive_failures = 0
        self._consecutive_successes = 0
        self._opened_at = 0.0
        self._in_flight = 0
        self._half_open_trial_in_flight = False

    def exec(self, fn):
        with self._lock:
            if self._in_flight >= self.max_concurrent:
                raise BulkheadRejectedError()

            if self._state == "open":
                if time.monotonic() - self._opened_at < self.cooldown_seconds:
                    raise CircuitOpenError()
                self._state = "half-open"
                self._consecutive_successes = 0

            if self._state == "half-open":
                if self._half_open_trial_in_flight:
                    raise CircuitOpenError()
                self._half_open_trial_in_flight = True

            self._in_flight += 1

        try:
            result = fn()
            self._on_success()
            return result
        except Exception:
            self._on_failure()
            raise
        finally:
            with self._lock:
                self._in_flight -= 1
                if self._state == "half-open":
                    self._half_open_trial_in_flight = False

    def _on_success(self):
        with self._lock:
            if self._state == "half-open":
                self._consecutive_successes += 1
                if self._consecutive_successes >= self.half_open_successes:
                    self._state = "closed"
                    self._consecutive_failures = 0
                    self._consecutive_successes = 0
                return
            self._consecutive_failures = 0

    def _on_failure(self):
        with self._lock:
            if self._state == "half-open":
                self._state = "open"
                self._opened_at = time.monotonic()
                return
            self._consecutive_failures += 1
            if self._consecutive_failures >= self.failure_threshold:
                self._state = "open"
                self._opened_at = time.monotonic()
