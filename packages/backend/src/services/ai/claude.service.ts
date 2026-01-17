import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { RateLimiter } from '../../utils/rate-limiter.js';
import { withRetry } from '../../utils/retry.js';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  model?: 'claude-3-haiku-20240307' | 'claude-3-5-sonnet-20241022';
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

const DEFAULT_OPTIONS: ClaudeOptions = {
  model: 'claude-3-haiku-20240307',
  maxTokens: 1024,
  temperature: 0.7,
};

class ClaudeService {
  private client: Anthropic;
  private rateLimiter: RateLimiter;
  private requestCount = 0;

  constructor() {
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 0, // We handle retries ourselves
    });

    // Claude API rate limits: ~60 requests/minute for Haiku
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 50,
      interval: 60 * 1000, // 1 minute
    });
  }

  async chat(
    messages: ClaudeMessage[],
    options: ClaudeOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Wait for rate limit
    await this.rateLimiter.waitForToken();

    const startTime = Date.now();
    this.requestCount++;

    try {
      const response = await withRetry(
        async () => {
          return this.client.messages.create({
            model: opts.model!,
            max_tokens: opts.maxTokens!,
            temperature: opts.temperature,
            system: opts.systemPrompt,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          });
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          retryableErrors: ['rate_limit', 'overloaded', 'timeout', 'ECONNRESET'],
        }
      );

      const duration = Date.now() - startTime;
      const content = response.content[0];

      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      logger.debug({
        model: opts.model,
        duration,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        requestNumber: this.requestCount,
      }, 'Claude API request completed');

      return content.text;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        model: opts.model,
        duration,
        requestNumber: this.requestCount,
      }, 'Claude API request failed');

      throw error;
    }
  }

  async chatJson<T>(
    messages: ClaudeMessage[],
    options: ClaudeOptions = {}
  ): Promise<T> {
    const response = await this.chat(messages, options);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;

    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object or array
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);

    if (objectMatch) {
      jsonStr = objectMatch[0];
    } else if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (parseError) {
      logger.error({
        error: parseError instanceof Error ? parseError.message : 'Parse error',
        response: response.slice(0, 500),
      }, 'Failed to parse Claude JSON response');

      throw new Error(`Failed to parse Claude response as JSON: ${response.slice(0, 200)}`);
    }
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      rateLimiterTokens: this.rateLimiter.getAvailableTokens(),
    };
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();
