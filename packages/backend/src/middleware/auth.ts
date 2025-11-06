import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from '../services/auditService';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Middleware to authenticate requests using Supabase JWT tokens
 */
export const authenticateToken = (auditService?: AuditService) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        // Log unauthorized access attempt
        if (auditService) {
          await auditService.logSecurityEvent(
            AuditAction.UNAUTHORIZED_ACCESS,
            req.ip,
            req.get('User-Agent'),
            undefined,
            { reason: 'missing_token', path: req.path }
          );
        }

        res.status(401).json({ 
          error: 'Access token required',
          code: 'MISSING_TOKEN'
        });
        return;
      }

      // Initialize Supabase client with service role key for token verification
      const supabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || ''
      );

      // Verify the JWT token
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        logger.warn('Token verification failed:', error?.message);
        
        // Log failed authentication
        if (auditService) {
          await auditService.logAuth(
            AuditAction.LOGIN_FAILED,
            undefined,
            req.ip,
            req.get('User-Agent'),
            { reason: 'invalid_token', error: error?.message }
          );
        }

        res.status(401).json({ 
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
        return;
      }

      // Add user information to request
      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'user'
      };

      // Log successful authentication
      if (auditService) {
        await auditService.logAuth(
          AuditAction.LOGIN,
          user.id,
          req.ip,
          req.get('User-Agent'),
          { method: 'jwt_token' }
        );
      }

      next();
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      
      // Log authentication service error
      if (auditService) {
        await auditService.logSecurityEvent(
          AuditAction.SUSPICIOUS_ACTIVITY,
          req.ip,
          req.get('User-Agent'),
          undefined,
          { reason: 'auth_service_error', error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }

      res.status(500).json({ 
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  };
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    if (user.role !== requiredRole && user.role !== 'admin') {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_role: requiredRole,
        user_role: user.role
      });
      return;
    }

    next();
  };
};

/**
 * Middleware for optional authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without user
      next();
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'user'
      };
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    // Continue without authentication on error
    next();
  }
};

/**
 * Utility function to create Supabase client with user context
 */
export const createUserSupabaseClient = (token: string) => {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );
};

/**
 * Utility function to extract token from request
 */
export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.split(' ')[1] || null;
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientAttempts = attempts.get(clientId);
    
    if (clientAttempts && now < clientAttempts.resetTime) {
      if (clientAttempts.count >= maxAttempts) {
        res.status(429).json({
          error: 'Too many authentication attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retry_after: Math.ceil((clientAttempts.resetTime - now) / 1000)
        });
        return;
      }
      clientAttempts.count++;
    } else {
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
    }

    next();
  };
};