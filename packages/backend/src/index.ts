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
import { logger } from './utils/logger';
import { config } from './config/env';

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
const functionRegistry = new FunctionRegistry(auditService);
const conversationService = new ConversationService(dbService, null as any);
import { createSTTService } from './services/stt';
import { createTTSService } from './services/tts';
const sttService = createSTTService();
const ttsService = createTTSService();
const sipService = new SipService(dbService, conversationService);
const outboundCallService = new OutboundCallService(sipService, conversationService, sttService, ttsService, dbService);
const sipManager = new SipManager(sipService, conversationService, sttService, ttsService, dbService);

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

// Database health check (before rate limiting)
app.get('/api/health/database', async (req, res) => {
  logger.info('Database health check endpoint called');
  
  // Set a timeout for the entire request
  const timeout = setTimeout(() => {
    logger.warn('Database health check timed out after 8 seconds');
    if (!res.headersSent) {
      res.status(504).json({ 
        status: 'timeout',
        error: 'Database health check timed out',
        timestamp: new Date().toISOString()
      });
    }
  }, 8000); // 8 second timeout

  try {
    logger.info('Calling dbService.healthCheck()...');
    const isHealthy = await dbService.healthCheck();
    logger.info(`Health check result: ${isHealthy}`);
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.json({ 
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Health check exception:', error);
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).json({ 
        status: 'error',
        error: 'Database health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Make services available to routes
app.set('functionRegistry', functionRegistry);
app.set('dbService', dbService);
app.set('auditService', auditService);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

// Routes will be mounted in startServer()

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



// Start server
async function startServer() {
  try {
    logger.info('Starting server...');

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

    // In development mode, we'll handle user creation differently
    // The user will be created on first agent creation if needed
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      logger.info('Development mode: Users will be created automatically on first use');
    }

    // Setup routes
    try {
      const { setupRoutes } = await import('./routes/index');
      await setupRoutes(app, {
        dbService,
        auditService,
        functionRegistry,
        sipService,
        outboundCallService
      });
      logger.info('Routes setup completed');
    } catch (error) {
      logger.error('Failed to setup routes:', error);
      throw error;
    }

    // Error handling middleware (must be after routes)
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // 404 handler (must be last)
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

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
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await sipManager.cleanup();
  await outboundCallService.cleanup();
  process.exit(0);
});

startServer();

export { app, supabase, dbService, auditService, sipService, sipManager, outboundCallService };