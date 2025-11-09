import { Express } from 'express';
import { authenticateToken } from '../middleware/auth';

// This function dynamically imports and mounts all routes
// It's called after Redis and other services are initialized
export async function setupRoutes(app: Express, services: any) {
  const { dbService, auditService, functionRegistry } = services;

  // Dynamically import routes (this happens after redis is initialized)
  const agentRoutes = (await import('./agents')).default;
  const agentTestingRoutes = (await import('./agentTesting')).default;
  const unifiedAgentTestingRoutes = (await import('./unifiedAgentTesting')).default;
  const langchainAgentTestingRoutes = (await import('./langchainAgentTesting')).default;
  const conversationRoutes = (await import('./conversations')).default;
  const sttRoutes = (await import('./stt')).default;
  const ttsRoutes = (await import('./tts')).default;
  const { default: sipRoutes, initializeSipRoutes } = await import('./sip');
  const adminRoutes = (await import('./admin')).default;
  const privacyRoutes = (await import('./privacy')).default;
  const deploymentsRoutes = (await import('./deployments')).default;
  const knowledgeBaseRoutes = (await import('./knowledgeBase')).default;
  const functionRoutes = (await import('./api/v1/functions')).default;
  const apiKeysRoutes = (await import('./api/v1/apiKeys')).default;
  const webhooksRoutes = (await import('./api/v1/webhooks')).default;
  const v1AgentsRoutes = (await import('./api/v1/agents')).default;

  // Initialize SIP routes with services
  if (services.sipService && services.outboundCallService) {
    initializeSipRoutes(services.sipService, services.outboundCallService, dbService);
  }

  // Mount routes
  app.use('/api/agents', agentRoutes);
  app.use('/api/agent-testing', unifiedAgentTestingRoutes); // Now powered by LangChain!
  app.use('/api/agent-testing-legacy', agentTestingRoutes); // Legacy fallback
  app.use('/api/langchain-testing', langchainAgentTestingRoutes); // Direct LangChain access
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/stt', sttRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/sip', sipRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/privacy', privacyRoutes);
  app.use('/api/deployments', deploymentsRoutes);
  app.use('/api/knowledge-bases', knowledgeBaseRoutes);
  
  // API v1 routes
  app.use('/api/v1/agents', v1AgentsRoutes);
  app.use('/api/v1/functions', functionRoutes);
  app.use('/api/v1/api-keys', apiKeysRoutes);
  app.use('/api/v1/webhooks', webhooksRoutes);

  // Authentication routes
  app.post('/api/auth/profile', authenticateToken(auditService), async (req, res) => {
    try {
      const user = await dbService.getUserById(req.user!.id);
      if (!user) {
        const newUser = await dbService.createUser({
          id: req.user!.id,
          email: req.user!.email
        });
        return res.json(newUser);
      }
      res.json(user);
    } catch (error) {
      console.error('Failed to get user profile:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  });

  console.log('✓ All routes mounted successfully');
}
