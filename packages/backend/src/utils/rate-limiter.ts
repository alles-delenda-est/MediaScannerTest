export interface RateLimiterOptions {
  tokensPerInterval: number;
  interval: number; // in milliseconds
}

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private interval: number;
  private lastRefill: number;

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.tokensPerInterval;
    this.tokens = options.tokensPerInterval;
    this.interval = options.interval;
    this.lastRefill = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.interval) * this.maxTokens);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async waitForToken(): Promise<void> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Calculate wait time until next token
    const tokensNeeded = 1;
    const timePerToken = this.interval / this.maxTokens;
    const waitTime = timePerToken * tokensNeeded;

    await this.sleep(waitTime);
    this.refillTokens();
    this.tokens--;
  }

  tryConsume(): boolean {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    return false;
  }

  getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }

  getWaitTime(): number {
    this.refillTokens();

    if (this.tokens > 0) {
      return 0;
    }

    const timePerToken = this.interval / this.maxTokens;
    return timePerToken;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Sliding window rate limiter for more accurate rate limiting
export class SlidingWindowRateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    this.cleanOldRequests();

    while (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - Date.now() + 100; // +100ms buffer

      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      this.cleanOldRequests();
    }

    this.requests.push(Date.now());
  }

  private cleanOldRequests(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter((t) => t > cutoff);
  }

  getRequestCount(): number {
    this.cleanOldRequests();
    return this.requests.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
