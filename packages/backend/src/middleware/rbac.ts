import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Define user roles and their permissions
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum Permission {
  // Agent permissions
  CREATE_AGENT = 'create_agent',
  READ_AGENT = 'read_agent',
  UPDATE_AGENT = 'update_agent',
  DELETE_AGENT = 'delete_agent',
  
  // Conversation permissions
  READ_CONVERSATIONS = 'read_conversations',
  CREATE_CONVERSATIONS = 'create_conversations',
  
  // Admin permissions
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_USERS = 'manage_users',
  SYSTEM_CONFIG = 'system_config',
  
  // SIP permissions
  CONFIGURE_SIP = 'configure_sip',
  MAKE_CALLS = 'make_calls',
  
  // Knowledge base permissions
  MANAGE_KNOWLEDGE_BASE = 'manage_knowledge_base'
}

// Role-permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.CREATE_AGENT,
    Permission.READ_AGENT,
    Permission.UPDATE_AGENT,
    Permission.DELETE_AGENT,
    Permission.READ_CONVERSATIONS,
    Permission.CREATE_CONVERSATIONS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_USERS,
    Permission.SYSTEM_CONFIG,
    Permission.CONFIGURE_SIP,
    Permission.MAKE_CALLS,
    Permission.MANAGE_KNOWLEDGE_BASE
  ],
  [UserRole.USER]: [
    Permission.CREATE_AGENT,
    Permission.READ_AGENT,
    Permission.UPDATE_AGENT,
    Permission.DELETE_AGENT,
    Permission.READ_CONVERSATIONS,
    Permission.CREATE_CONVERSATIONS,
    Permission.VIEW_ANALYTICS,
    Permission.CONFIGURE_SIP,
    Permission.MAKE_CALLS,
    Permission.MANAGE_KNOWLEDGE_BASE
  ],
  [UserRole.VIEWER]: [
    Permission.READ_AGENT,
    Permission.READ_CONVERSATIONS,
    Permission.VIEW_ANALYTICS
  ]
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes(permission);
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const userRole = user.role as UserRole || UserRole.USER;

    if (!hasPermission(userRole, permission)) {
      logger.warn('Permission denied', {
        userId: user.id,
        userRole,
        requiredPermission: permission,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permission: permission,
        user_role: userRole
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user has any of the required permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const userRole = user.role as UserRole || UserRole.USER;
    const hasAnyPermission = permissions.some(permission => 
      hasPermission(userRole, permission)
    );

    if (!hasAnyPermission) {
      logger.warn('Permission denied - no matching permissions', {
        userId: user.id,
        userRole,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permissions: permissions,
        user_role: userRole
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to ensure user can only access their own resources
 */
export function requireOwnership(resourceUserIdField: string = 'user_id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Admin can access all resources
    if (user.role === UserRole.ADMIN) {
      return next();
    }

    // Check if resource belongs to user
    const resourceUserId = req.body[resourceUserIdField] || 
                          req.params[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (resourceUserId && resourceUserId !== user.id) {
      logger.warn('Ownership violation', {
        userId: user.id,
        resourceUserId,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Access denied - resource not owned by user',
        code: 'RESOURCE_NOT_OWNED'
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check admin role specifically
 */
export function requireAdmin() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    if (user.role !== UserRole.ADMIN) {
      logger.warn('Admin access denied', {
        userId: user.id,
        userRole: user.role,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
      return;
    }

    next();
  };
}

/**
 * Get user permissions for client-side authorization
 */
export function getUserPermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

/**
 * Middleware to add user permissions to response
 */
export function addPermissionsToResponse() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    
    if (user) {
      const userRole = user.role as UserRole || UserRole.USER;
      (req as any).userPermissions = getUserPermissions(userRole);
    }

    next();
  };
}