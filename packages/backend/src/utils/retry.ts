import { logger } from './logger.js';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error = new Error('No attempts made');
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = isRetryableError(lastError, opts.retryableErrors);

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Log retry attempt
      logger.warn({
        attempt,
        maxAttempts: opts.maxAttempts,
        error: lastError.message,
        nextDelayMs: delay,
      }, 'Retrying operation');

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

function isRetryableError(error: Error, retryablePatterns?: string[]): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Default retryable patterns
  const defaultPatterns = [
    'timeout',
    'econnreset',
    'econnrefused',
    'etimedout',
    'socket hang up',
    'network',
    'rate_limit',
    'rate limit',
    '429',
    '503',
    '502',
    'overloaded',
    'temporarily unavailable',
  ];

  const patterns = retryablePatterns || defaultPatterns;

  return patterns.some(
    (pattern) =>
      message.includes(pattern.toLowerCase()) ||
      name.includes(pattern.toLowerCase())
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry decorator for class methods
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// Circuit breaker for handling persistent failures
export class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeoutMs: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure || 0) > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'half-open') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn({ failures: this.failures }, 'Circuit breaker opened');
    }
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'closed';
    logger.info('Circuit breaker reset');
  }

  getState(): string {
    return this.state;
  }
}
