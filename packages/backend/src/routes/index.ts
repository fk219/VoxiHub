import { Express } from 'express';
import { authenticateToken } from '../middleware/auth';

// This function dynamically imports and mounts all routes
// It's called after Redis and other services are initialized
export async function setupRoutes(app: Express, services: any) {
  const { dbService, auditService, functionRegistry } = services;

  // Dynamically import routes (this happens after redis is initialized)
  const agentRoutes = (await import('./agents')).default;
  const conversationRoutes = (await import('./conversations')).default;
  const sttRoutes = (await import('./stt')).default;
  const ttsRoutes = (await import('./tts')).default;
  const { default: sipRoutes, initializeSipRoutes } = await import('./sip');
  const adminRoutes = (await import('./admin')).default;
  const privacyRoutes = (await import('./privacy')).default;
  const functionRoutes = (await import('./api/v1/functions')).default;
  
  // Try to import optional routes
  let knowledgeBaseRoutes, deploymentRoutes;
  try {
    knowledgeBaseRoutes = (await import('./knowledgeBase')).default;
  } catch (e) {
    console.log('Knowledge base routes not found, skipping');
  }
  
  try {
    deploymentRoutes = (await import('./deployments')).default;
  } catch (e) {
    console.log('Deployment routes not found, skipping');
  }

  // Initialize SIP routes with services
  if (services.sipService && services.outboundCallService) {
    initializeSipRoutes(services.sipService, services.outboundCallService, dbService);
  }

  // Mount routes
  app.use('/api/agents', agentRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/stt', sttRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/sip', sipRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/privacy', privacyRoutes);
  app.use('/api/v1/functions', functionRoutes);
  
  if (knowledgeBaseRoutes) {
    app.use('/api/knowledge-bases', knowledgeBaseRoutes);
  }
  
  if (deploymentRoutes) {
    app.use('/api/deployments', deploymentRoutes);
  }

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
