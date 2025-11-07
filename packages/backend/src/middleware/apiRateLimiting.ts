import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * In-memory rate limit store
 * In production, use Redis for distributed rate limiting
 */
class RateLimitMemoryStore {
  private store: RateLimitStore = {};

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const record = this.store[key];

    if (!record || now > record.resetTime) {
      // Create new window
      this.store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return this.store[key];
    }

    // Increment existing window
    record.count++;
    return record;
  }

  async reset(key: string): Promise<void> {
    delete this.store[key];
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }
}

const rateLimitStore = new RateLimitMemoryStore();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  rateLimitStore.cleanup();
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware for API keys
 */
export const apiKeyRateLimit = (options?: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}) => {
  const windowMs = options?.windowMs || 60 * 1000; // 1 minute default
  const maxRequests = options?.maxRequests || 100; // 100 requests per minute default
  const message = options?.message || 'Too many requests, please try again later';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get API key from request
      const apiKey = req.apiKey;

      if (!apiKey) {
        // No API key, skip rate limiting
        return next();
      }

      // Use API key's custom rate limit if set
      const limit = (apiKey as any).rate_limit || maxRequests;

      // Create rate limit key
      const key = `ratelimit:apikey:${apiKey.id}`;

      // Increment counter
      const { count, resetTime } = await rateLimitStore.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      // Check if limit exceeded
      if (count > limit) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('API key rate limit exceeded', {
          apiKeyId: apiKey.id,
          count,
          limit,
        });

        res.status(429).json({
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          limit,
          remaining: 0,
          reset: new Date(resetTime).toISOString(),
          retry_after: retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Don't block request on rate limiting errors
      next();
    }
  };
};

/**
 * Rate limiting middleware for IP addresses
 */
export const ipRateLimit = (options?: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}) => {
  const windowMs = options?.windowMs || 60 * 1000; // 1 minute default
  const maxRequests = options?.maxRequests || 60; // 60 requests per minute default
  const message = options?.message || 'Too many requests, please try again later';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get client IP
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      // Create rate limit key
      const key = `ratelimit:ip:${clientIp}`;

      // Increment counter
      const { count, resetTime } = await rateLimitStore.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      // Check if limit exceeded
      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('IP rate limit exceeded', {
          ip: clientIp,
          count,
          limit: maxRequests,
        });

        res.status(429).json({
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          limit: maxRequests,
          remaining: 0,
          reset: new Date(resetTime).toISOString(),
          retry_after: retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Don't block request on rate limiting errors
      next();
    }
  };
};

/**
 * Rate limiting middleware for user accounts
 */
export const userRateLimit = (options?: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}) => {
  const windowMs = options?.windowMs || 60 * 1000; // 1 minute default
  const maxRequests = options?.maxRequests || 120; // 120 requests per minute default
  const message = options?.message || 'Too many requests, please try again later';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get user from request
      const user = req.user;

      if (!user) {
        // No user, skip rate limiting
        return next();
      }

      // Create rate limit key
      const key = `ratelimit:user:${user.id}`;

      // Increment counter
      const { count, resetTime } = await rateLimitStore.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      // Check if limit exceeded
      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('User rate limit exceeded', {
          userId: user.id,
          count,
          limit: maxRequests,
        });

        res.status(429).json({
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          limit: maxRequests,
          remaining: 0,
          reset: new Date(resetTime).toISOString(),
          retry_after: retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Don't block request on rate limiting errors
      next();
    }
  };
};

/**
 * Endpoint-specific rate limiting
 */
export const endpointRateLimit = (
  endpoint: string,
  options?: {
    windowMs?: number;
    maxRequests?: number;
    message?: string;
  }
) => {
  const windowMs = options?.windowMs || 60 * 1000;
  const maxRequests = options?.maxRequests || 30;
  const message = options?.message || `Too many requests to ${endpoint}`;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get identifier (API key, user, or IP)
      const identifier =
        req.apiKey?.id ||
        req.user?.id ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';

      // Create rate limit key
      const key = `ratelimit:endpoint:${endpoint}:${identifier}`;

      // Increment counter
      const { count, resetTime } = await rateLimitStore.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      // Check if limit exceeded
      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('Endpoint rate limit exceeded', {
          endpoint,
          identifier,
          count,
          limit: maxRequests,
        });

        res.status(429).json({
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          endpoint,
          limit: maxRequests,
          remaining: 0,
          reset: new Date(resetTime).toISOString(),
          retry_after: retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Don't block request on rate limiting errors
      next();
    }
  };
};

export { rateLimitStore };
