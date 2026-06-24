/**
 * Minimal circuit breaker with a bulkhead (concurrency cap). No external
 * dependency — this app only needs three states and a failure counter.
 *
 * CLOSED -> (failureThreshold consecutive failures) -> OPEN
 * OPEN -> (cooldownMs elapsed) -> HALF_OPEN (lets exactly one trial through)
 * HALF_OPEN -> (halfOpenSuccesses consecutive successes) -> CLOSED
 * HALF_OPEN -> (any failure) -> OPEN, cooldown restarts
 *
 * The bulkhead is checked before the breaker state: a call rejected for being
 * over maxConcurrent never ran, so it isn't counted as a breaker failure.
 */

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class BulkheadRejectedError extends Error {
  constructor(message = 'Too many concurrent calls to this dependency') {
    super(message);
    this.name = 'BulkheadRejectedError';
  }
}

type BreakerOptions = {
  /** Consecutive failures while CLOSED before tripping to OPEN. */
  failureThreshold: number;
  /** How long OPEN lasts before a single HALF_OPEN trial is allowed. */
  cooldownMs: number;
  /** Consecutive HALF_OPEN successes required to fully CLOSE. */
  halfOpenSuccesses: number;
  /** In-flight calls beyond this are rejected immediately, not queued. */
  maxConcurrent: number;
};

type State = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: State = 'closed';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt = 0;
  private inFlight = 0;
  private halfOpenTrialInFlight = false;

  constructor(private readonly opts: BreakerOptions) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.opts.maxConcurrent) {
      throw new BulkheadRejectedError();
    }

    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.opts.cooldownMs) {
        throw new CircuitOpenError();
      }
      this.state = 'half-open';
      this.consecutiveSuccesses = 0;
    }

    if (this.state === 'half-open') {
      // Only one trial call at a time while probing recovery.
      if (this.halfOpenTrialInFlight) throw new CircuitOpenError();
      this.halfOpenTrialInFlight = true;
    }

    this.inFlight++;
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      this.inFlight--;
      if (this.state === 'half-open') this.halfOpenTrialInFlight = false;
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.opts.halfOpenSuccesses) {
        this.state = 'closed';
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
      }
      return;
    }
    this.consecutiveFailures = 0;
  }

  private onFailure() {
    if (this.state === 'half-open') {
      this.state = 'open';
      this.openedAt = Date.now();
      return;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.opts.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}
