import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/conversation';
import { DatabaseService } from '../services/database';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { redis, logger } from '../index';

const router = Router();
const dbService = new DatabaseService();
const conversationService = new ConversationService(dbService, redis);

/**
 * POST /api/conversations
 * Start a new conversation (public endpoint for widget/SIP)
 */
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversation = await conversationService.startConversation(req.body, userId);
    
    logger.info(`Conversation started: ${conversation.id}`);
    res.status(201).json(conversation);
  } catch (error) {
    logger.error('Failed to start conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to start conversation';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with messages
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user?.id;
    
    const conversation = await conversationService.getConversation(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    logger.error('Failed to get conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversation';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Add a message to a conversation (public endpoint for widget/SIP)
 */
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const messageData = {
      ...req.body,
      conversation_id: conversationId
    };
    
    const message = await conversationService.addMessage(messageData);
    
    logger.info(`Message added to conversation: ${conversationId}`);
    res.status(201).json(message);
  } catch (error) {
    logger.error('Failed to add message:', error);
    const message = error instanceof Error ? error.message : 'Failed to add message';
    
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else if (message.includes('inactive')) {
      res.status(400).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/:id/messages', optionalAuth, async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const messages = await conversationService.getMessages(conversationId, userId, limit, offset);
    res.json(messages);
  } catch (error) {
    logger.error('Failed to get messages:', error);
    const message = error instanceof Error ? error.message : 'Failed to get messages';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * PUT /api/conversations/:id/end
 * End a conversation
 */
router.put('/:id/end', optionalAuth, async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user?.id;
    
    const conversation = await conversationService.endConversation(conversationId, userId);
    
    logger.info(`Conversation ended: ${conversationId}`);
    res.json(conversation);
  } catch (error) {
    logger.error('Failed to end conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to end conversation';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * PUT /api/conversations/:id/transfer
 * Transfer conversation to human agent
 */
router.put('/:id/transfer', optionalAuth, async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user?.id;
    const { reason } = req.body;
    
    const conversation = await conversationService.transferConversation(conversationId, reason, userId);
    
    logger.info(`Conversation transferred: ${conversationId}`);
    res.json(conversation);
  } catch (error) {
    logger.error('Failed to transfer conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to transfer conversation';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * GET /api/conversations/:id/context
 * Get conversation context from Redis
 */
router.get('/:id/context', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    
    const context = await conversationService.getConversationContext(conversationId);
    
    if (!context) {
      return res.status(404).json({ error: 'Conversation context not found' });
    }
    
    res.json(context);
  } catch (error) {
    logger.error('Failed to get conversation context:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversation context';
    res.status(500).json({ error: message });
  }
});

// Protected routes (require authentication)
router.use(authenticateToken);

/**
 * GET /api/conversations/agent/:agentId
 * Get conversations for a specific agent (authenticated)
 */
router.get('/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.agentId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const conversations = await conversationService.getConversationsByAgent(agentId, userId, limit, offset);
    res.json(conversations);
  } catch (error) {
    logger.error('Failed to get conversations for agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversations';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * GET /api/conversations/search
 * Search conversations (authenticated)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      query,
      agent_id: agentId,
      channel,
      status,
      limit = '50',
      offset = '0'
    } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const conversations = await conversationService.searchConversations(
      userId,
      query,
      agentId as string,
      channel as any,
      status as any,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json(conversations);
  } catch (error) {
    logger.error('Failed to search conversations:', error);
    const message = error instanceof Error ? error.message : 'Failed to search conversations';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/conversations/agent/:agentId/analytics
 * Get conversation analytics for an agent (authenticated)
 */
router.get('/agent/:agentId/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.agentId;
    const { start_date, end_date } = req.query;
    
    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;
    
    const analytics = await conversationService.getConversationAnalytics(agentId, userId, startDate, endDate);
    res.json(analytics);
  } catch (error) {
    logger.error('Failed to get conversation analytics:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversation analytics';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;