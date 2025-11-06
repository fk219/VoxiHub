import { Request, Response, NextFunction } from 'express';
import { createClient as createRedisClient } from 'redis';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private redis: any;
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      message: options.message || 'Too many requests, please try again later',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator
    };

    // Initialize Redis client for distributed rate limiting
    this.redis = createRedisClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.redis.connect().catch((error: Error) => {
      logger.error('Failed to connect to Redis for rate limiting:', error);
    });
  }

  private defaultKeyGenerator(req: Request): string {
    return `rate_limit:${req.ip}:${req.route?.path || req.path}`;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.options.keyGenerator(req);
        const now = Date.now();
        const windowStart = now - this.options.windowMs;

        // Get current count from Redis
        const current = await this.redis.get(key);
        let rateLimitInfo: RateLimitInfo;

        if (current) {
          rateLimitInfo = JSON.parse(current);
          
          // Check if window has expired
          if (now > rateLimitInfo.resetTime) {
            rateLimitInfo = {
              count: 1,
              resetTime: now + this.options.windowMs
            };
          } else {
            rateLimitInfo.count++;
          }
        } else {
          rateLimitInfo = {
            count: 1,
            resetTime: now + this.options.windowMs
          };
        }

        // Store updated count
        await this.redis.setex(
          key, 
          Math.ceil(this.options.windowMs / 1000), 
          JSON.stringify(rateLimitInfo)
        );

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.options.maxRequests - rateLimitInfo.count).toString(),
          'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString()
        });

        // Check if limit exceeded
        if (rateLimitInfo.count > this.options.maxRequests) {
          logger.warn(`Rate limit exceeded for ${key}`, {
            ip: req.ip,
            path: req.path,
            count: rateLimitInfo.count,
            limit: this.options.maxRequests
          });

          res.status(429).json({
            error: this.options.message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((rateLimitInfo.resetTime - now) / 1000)
          });
          return;
        }

        // Add rate limit info to request for logging
        (req as any).rateLimit = {
          limit: this.options.maxRequests,
          current: rateLimitInfo.count,
          remaining: this.options.maxRequests - rateLimitInfo.count,
          resetTime: rateLimitInfo.resetTime
        };

        next();
      } catch (error) {
        logger.error('Rate limiting error:', error);
        // Continue without rate limiting on error
        next();
      }
    };
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }
}

// Pre-configured rate limiters for common use cases
export const createAuthRateLimit = () => new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req: Request) => `auth_limit:${req.ip}`
});

export const createAPIRateLimit = () => new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'API rate limit exceeded, please slow down',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || 'anonymous';
    return `api_limit:${userId}:${req.ip}`;
  }
});

export const createConversationRateLimit = () => new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 conversations per minute
  message: 'Too many conversation requests, please wait',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || req.ip;
    return `conversation_limit:${userId}`;
  }
});

export const createSipRateLimit = () => new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 SIP operations per minute
  message: 'SIP operation rate limit exceeded',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || req.ip;
    return `sip_limit:${userId}`;
  }
});