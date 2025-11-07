import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { logger } from '../utils/logger';

// Extend Express Request type to include apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        user_id: string;
        scopes: string[];
      };
    }
  }
}

/**
 * Middleware to authenticate requests using API keys
 */
export const authenticateApiKey = (apiKeyService: ApiKeyService) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract API key from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'API key required',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate API key
      const validatedKey = await apiKeyService.validateApiKey(apiKey);

      if (!validatedKey) {
        res.status(401).json({
          error: 'Invalid or expired API key',
          code: 'INVALID_API_KEY',
        });
        return;
      }

      // Add API key info to request
      req.apiKey = {
        id: validatedKey.id,
        user_id: validatedKey.user_id,
        scopes: validatedKey.scopes,
      };

      // Also set user for compatibility with existing auth middleware
      req.user = {
        id: validatedKey.user_id,
        email: '', // API keys don't have email
        role: 'user',
      };

      next();
    } catch (error) {
      logger.error('API key authentication error:', error);
      res.status(500).json({
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR',
      });
    }
  };
};

/**
 * Middleware to check if API key has required scope
 */
export const requireScope = (requiredScope: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.apiKey;

    if (!apiKey) {
      res.status(401).json({
        error: 'API key required',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    // Check if API key has wildcard scope or specific scope
    if (!apiKey.scopes.includes('*') && !apiKey.scopes.includes(requiredScope)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_SCOPE',
        required_scope: requiredScope,
        available_scopes: apiKey.scopes,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware for dual authentication (JWT or API key)
 */
export const authenticateJwtOrApiKey = (
  jwtAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  apiKeyService: ApiKeyService
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_AUTH',
      });
      return;
    }

    // Check if it's an API key (starts with vx_)
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    if (token.startsWith('vx_')) {
      // Use API key authentication
      return authenticateApiKey(apiKeyService)(req, res, next);
    } else {
      // Use JWT authentication
      return jwtAuth(req, res, next);
    }
  };
};
