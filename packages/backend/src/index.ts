// IMPORTANT: Load environment variables FIRST before any other imports
import './config/env';

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { DatabaseService } from './services/database';
import { ConversationService } from './services/conversation';
import { STTService } from './services/stt';
import { TTSService } from './services/tts';
import { SipService } from './services/sip';
import { SipManager } from './services/sipManager';
import { OutboundCallService } from './services/outboundCallService';
import { AuditService } from './services/auditService';
import { SessionService } from './services/sessionService';
import { FunctionRegistry } from './services/functionRegistry';
import { authenticateToken, optionalAuth } from './middleware/auth';
import { securityHeaders, sanitizeInput, securityLogger, corsOptions } from './middleware/security';
import { createAPIRateLimit, createAuthRateLimit } from './middleware/rateLimiting';
import { logger } from './utils/logger';
import { config } from './config/env';
// Redis temporarily disabled
// import { redis, connectRedis } from './config/redis';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(securityLogger);
app.use(sanitizeInput);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Initialize services
const dbService = new DatabaseService();
const auditService = new AuditService(dbService);
const sessionService = new SessionService(auditService);
const functionRegistry = new FunctionRegistry(auditService);
const conversationService = new ConversationService(dbService, null as any);
const sttService = new STTService();
const ttsService = new TTSService();
const sipService = new SipService(dbService, conversationService);
const outboundCallService = new OutboundCallService(sipService, conversationService, sttService, ttsService, dbService);
const sipManager = new SipManager(sipService, conversationService, sttService, ttsService, dbService);

// Initialize rate limiters
const apiRateLimit = createAPIRateLimit();
const authRateLimit = createAuthRateLimit();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ai-agent-platform-backend'
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AI Agent Creator Platform API',
    version: '1.0.0'
  });
});

// Apply rate limiting to API routes
app.use('/api', apiRateLimit.middleware());

// Make services available to routes
app.set('functionRegistry', functionRegistry);
app.set('dbService', dbService);

// Routes will be mounted after Redis connection in startServer()

// Authentication routes with rate limiting
app.use('/api/auth', authRateLimit.middleware());

app.post('/api/auth/profile', authenticateToken(auditService), async (req, res) => {
  try {
    const user = await dbService.getUserById(req.user!.id);
    if (!user) {
      // Create user profile if it doesn't exist
      const newUser = await dbService.createUser({
        id: req.user!.id,
        email: req.user!.email
      });
      
      // Log user creation
      await auditService.logEvent({
        user_id: req.user!.id,
        action: 'user_created' as any,
        resource_type: 'user',
        resource_id: req.user!.id,
        details: { email: req.user!.email },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json(newUser);
    } else {
      res.json(user);
    }
  } catch (error) {
    logger.error('Failed to get/create user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Session management endpoints
app.post('/api/auth/logout', authenticateToken(auditService), async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      await sessionService.destroySession(sessionId);
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.post('/api/auth/logout-all', authenticateToken(auditService), async (req, res) => {
  try {
    await sessionService.destroyAllUserSessions(req.user!.id);
    res.json({ message: 'All sessions terminated' });
  } catch (error) {
    logger.error('Logout all error:', error);
    res.status(500).json({ error: 'Failed to terminate all sessions' });
  }
});

app.get('/api/auth/sessions', authenticateToken(auditService), async (req, res) => {
  try {
    const sessions = await sessionService.getUserSessions(req.user!.id);
    res.json(sessions);
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Database health check
app.get('/api/health/database', async (req, res) => {
  try {
    const isHealthy = await dbService.healthCheck();
    res.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: 'Database health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Redis temporarily disabled
    // await connectRedis();
    logger.info('Starting server without Redis (sessions and rate limiting disabled)');

    // Test Supabase connection
    const { data, error } = await supabase.from('_health').select('*').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is expected
      logger.warn('Supabase connection test failed:', error.message);
    } else {
      logger.info('Supabase connection established');
    }

    // Initialize SIP services
    try {
      await sipManager.initialize();
      await outboundCallService.initialize();
      logger.info('SIP services initialized successfully');
    } catch (error) {
      logger.warn('SIP services initialization failed:', error);
      // Continue without SIP functionality
    }

    // Setup routes (dynamic import after Redis is connected)
    const { setupRoutes } = await import('./routes/index');
    await setupRoutes(app, {
      dbService,
      auditService,
      functionRegistry,
      sipService,
      outboundCallService
    });

    // Start cleanup tasks
    startCleanupTasks();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await sipManager.cleanup();
  await outboundCallService.cleanup();
  await sessionService.cleanup();
  await apiRateLimit.cleanup();
  await authRateLimit.cleanup();
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await sipManager.cleanup();
  await outboundCallService.cleanup();
  await sessionService.cleanup();
  await apiRateLimit.cleanup();
  await authRateLimit.cleanup();
  await redis.disconnect();
  process.exit(0);
});

// Cleanup tasks
function startCleanupTasks() {
  // Clean up expired sessions every hour
  setInterval(async () => {
    try {
      const cleanedSessions = await sessionService.cleanupExpiredSessions();
      if (cleanedSessions > 0) {
        logger.info(`Cleaned up ${cleanedSessions} expired sessions`);
      }
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Clean up old audit logs daily
  setInterval(async () => {
    try {
      const cleanedLogs = await auditService.cleanupOldLogs(365); // Keep 1 year
      if (cleanedLogs > 0) {
        logger.info(`Cleaned up ${cleanedLogs} old audit log entries`);
      }
    } catch (error) {
      logger.error('Audit log cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}

startServer();

export { app, supabase, dbService, auditService, sessionService, sipService, sipManager, outboundCallService };