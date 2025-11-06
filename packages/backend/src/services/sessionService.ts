import { createClient as createRedisClient } from 'redis';
import { logger } from '../utils/logger';
import { AuditService, AuditAction } from './auditService';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  fingerprint: string;
}

export interface SessionConfig {
  maxAge: number; // Session max age in milliseconds
  maxInactivity: number; // Max inactivity time in milliseconds
  maxConcurrentSessions: number; // Max concurrent sessions per user
}

export class SessionService {
  private redis: any;
  private auditService: AuditService;
  private config: SessionConfig;

  constructor(auditService: AuditService, config?: Partial<SessionConfig>) {
    this.auditService = auditService;
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxInactivity: 2 * 60 * 60 * 1000, // 2 hours
      maxConcurrentSessions: 5,
      ...config
    };

    // Initialize Redis client
    this.redis = createRedisClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.redis.connect().catch((error: Error) => {
      logger.error('Failed to connect to Redis for session management:', error);
    });
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    userId: string,
    email: string,
    role: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const fingerprint = this.generateFingerprint(userAgent, ipAddress);
      
      const sessionData: SessionData = {
        userId,
        email,
        role,
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress,
        userAgent,
        fingerprint
      };

      // Check for concurrent sessions limit
      await this.enforceConcurrentSessionsLimit(userId);

      // Store session data
      const sessionKey = `session:${sessionId}`;
      await this.redis.setex(
        sessionKey,
        Math.ceil(this.config.maxAge / 1000),
        JSON.stringify(sessionData)
      );

      // Add to user's active sessions
      const userSessionsKey = `user_sessions:${userId}`;
      await this.redis.sadd(userSessionsKey, sessionId);
      await this.redis.expire(userSessionsKey, Math.ceil(this.config.maxAge / 1000));

      logger.info('Session created', { sessionId, userId, ipAddress });

    } catch (error) {
      logger.error('Failed to create session:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionDataStr = await this.redis.get(sessionKey);

      if (!sessionDataStr) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);
      
      // Check if session has expired due to inactivity
      const now = new Date();
      const lastActivity = new Date(sessionData.lastActivity);
      const inactivityTime = now.getTime() - lastActivity.getTime();

      if (inactivityTime > this.config.maxInactivity) {
        await this.destroySession(sessionId);
        return null;
      }

      // Update last activity
      sessionData.lastActivity = now;
      await this.redis.setex(
        sessionKey,
        Math.ceil(this.config.maxAge / 1000),
        JSON.stringify(sessionData)
      );

      return sessionData;

    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }

      const updatedData = { ...sessionData, ...updates };
      const sessionKey = `session:${sessionId}`;
      
      await this.redis.setex(
        sessionKey,
        Math.ceil(this.config.maxAge / 1000),
        JSON.stringify(updatedData)
      );

    } catch (error) {
      logger.error('Failed to update session:', error);
      throw new Error('Failed to update session');
    }
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      
      if (sessionData) {
        // Remove from user's active sessions
        const userSessionsKey = `user_sessions:${sessionData.userId}`;
        await this.redis.srem(userSessionsKey, sessionId);

        // Log logout
        await this.auditService.logAuth(
          AuditAction.LOGOUT,
          sessionData.userId,
          sessionData.ipAddress,
          sessionData.userAgent,
          { session_id: sessionId }
        );
      }

      // Remove session data
      const sessionKey = `session:${sessionId}`;
      await this.redis.del(sessionKey);

      logger.info('Session destroyed', { sessionId });

    } catch (error) {
      logger.error('Failed to destroy session:', error);
      throw new Error('Failed to destroy session');
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await this.redis.smembers(userSessionsKey);

      // Destroy each session
      for (const sessionId of sessionIds) {
        await this.destroySession(sessionId);
      }

      // Clean up user sessions set
      await this.redis.del(userSessionsKey);

      logger.info('All user sessions destroyed', { userId, count: sessionIds.length });

    } catch (error) {
      logger.error('Failed to destroy all user sessions:', error);
      throw new Error('Failed to destroy all user sessions');
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await this.redis.smembers(userSessionsKey);

      const sessions: SessionData[] = [];
      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }

      return sessions;

    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Validate session security
   */
  async validateSessionSecurity(
    sessionId: string,
    currentIpAddress: string,
    currentUserAgent: string
  ): Promise<boolean> {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        return false;
      }

      const currentFingerprint = this.generateFingerprint(currentUserAgent, currentIpAddress);

      // Check for session hijacking indicators
      if (sessionData.fingerprint !== currentFingerprint) {
        logger.warn('Potential session hijacking detected', {
          sessionId,
          userId: sessionData.userId,
          originalIp: sessionData.ipAddress,
          currentIp: currentIpAddress,
          originalFingerprint: sessionData.fingerprint,
          currentFingerprint
        });

        // Log security event
        await this.auditService.logSecurityEvent(
          AuditAction.SUSPICIOUS_ACTIVITY,
          currentIpAddress,
          currentUserAgent,
          sessionData.userId,
          {
            reason: 'session_hijacking_suspected',
            session_id: sessionId,
            original_ip: sessionData.ipAddress,
            current_ip: currentIpAddress
          }
        );

        // Destroy the suspicious session
        await this.destroySession(sessionId);
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Failed to validate session security:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      let cleanedCount = 0;
      const pattern = 'session:*';
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const sessionDataStr = await this.redis.get(key);
        if (sessionDataStr) {
          const sessionData: SessionData = JSON.parse(sessionDataStr);
          const now = new Date();
          const createdAt = new Date(sessionData.createdAt);
          const lastActivity = new Date(sessionData.lastActivity);

          // Check if session is expired
          const sessionAge = now.getTime() - createdAt.getTime();
          const inactivityTime = now.getTime() - lastActivity.getTime();

          if (sessionAge > this.config.maxAge || inactivityTime > this.config.maxInactivity) {
            const sessionId = key.replace('session:', '');
            await this.destroySession(sessionId);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Generate fingerprint for session security
   */
  private generateFingerprint(userAgent: string, ipAddress: string): string {
    return Buffer.from(`${userAgent}:${ipAddress}`).toString('base64');
  }

  /**
   * Enforce concurrent sessions limit
   */
  private async enforceConcurrentSessionsLimit(userId: string): Promise<void> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await this.redis.smembers(userSessionsKey);

      if (sessionIds.length >= this.config.maxConcurrentSessions) {
        // Remove oldest sessions
        const sessionsToRemove = sessionIds.length - this.config.maxConcurrentSessions + 1;
        
        // Get session data to find oldest
        const sessionDataList = [];
        for (const sessionId of sessionIds) {
          const sessionData = await this.getSession(sessionId);
          if (sessionData) {
            sessionDataList.push({ sessionId, createdAt: sessionData.createdAt });
          }
        }

        // Sort by creation time and remove oldest
        sessionDataList.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        for (let i = 0; i < sessionsToRemove; i++) {
          await this.destroySession(sessionDataList[i].sessionId);
        }

        logger.info(`Enforced concurrent sessions limit for user ${userId}`, {
          removed: sessionsToRemove,
          limit: this.config.maxConcurrentSessions
        });
      }

    } catch (error) {
      logger.error('Failed to enforce concurrent sessions limit:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }
}