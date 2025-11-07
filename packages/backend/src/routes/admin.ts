import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/conversation';
import { DatabaseService } from '../services/database';
import { authenticateToken } from '../middleware/auth';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

const router = Router();
const dbService = new DatabaseService();
const conversationService = new ConversationService(dbService, redis);

// All admin routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/conversations
 * Get all conversations for the authenticated user with filtering and pagination
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      agent_id: agentId,
      channel,
      status,
      search,
      start_date: startDate,
      end_date: endDate,
      limit = '50',
      offset = '0'
    } = req.query;

    const conversations = await dbService.getConversationsForUser(userId, {
      agentId: agentId as string,
      channel: channel as any,
      status: status as any,
      search: search as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json(conversations);
  } catch (error) {
    logger.error('Failed to get conversations for admin:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversations';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/conversations/stats
 * Get conversation statistics for the authenticated user
 */
router.get('/conversations/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      agent_id: agentId,
      start_date: startDate,
      end_date: endDate
    } = req.query;

    const stats = await dbService.getConversationStats(userId, {
      agentId: agentId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get conversation stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversation stats';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/conversations/:id/transcript
 * Get conversation transcript with export options
 */
router.get('/conversations/:id/transcript', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const format = req.query.format as string || 'json';

    // Verify access to conversation
    const conversation = await conversationService.getConversation(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await conversationService.getMessages(conversationId, userId);

    if (format === 'txt') {
      // Generate plain text transcript
      const transcript = messages.map(msg => 
        `[${new Date(msg.created_at).toLocaleString()}] ${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.txt"`);
      res.send(transcript);
    } else if (format === 'csv') {
      // Generate CSV transcript
      const csvHeader = 'Timestamp,Role,Content,Type,Audio URL\n';
      const csvRows = messages.map(msg => 
        `"${msg.created_at}","${msg.role}","${msg.content.replace(/"/g, '""')}","${msg.type}","${msg.audio_url || ''}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      // Return JSON format
      res.json({
        conversation,
        messages,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Failed to get conversation transcript:', error);
    const message = error instanceof Error ? error.message : 'Failed to get conversation transcript';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/analytics/overview
 * Get overview analytics for all agents
 */
router.get('/analytics/overview', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      start_date: startDate,
      end_date: endDate
    } = req.query;

    const analytics = await dbService.getOverviewAnalytics(userId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json(analytics);
  } catch (error) {
    logger.error('Failed to get overview analytics:', error);
    const message = error instanceof Error ? error.message : 'Failed to get overview analytics';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/analytics/performance
 * Get performance analytics for agents
 */
router.get('/analytics/performance', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      agent_id: agentId,
      start_date: startDate,
      end_date: endDate
    } = req.query;

    const performance = await dbService.getPerformanceAnalytics(userId, {
      agentId: agentId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json(performance);
  } catch (error) {
    logger.error('Failed to get performance analytics:', error);
    const message = error instanceof Error ? error.message : 'Failed to get performance analytics';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/conversations/live
 * Get currently active conversations for real-time monitoring
 */
router.get('/conversations/live', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const activeConversations = await dbService.getActiveConversations(userId);
    
    // Enhance with real-time context from Redis
    const conversationsWithContext = await Promise.all(
      activeConversations.map(async (conv) => {
        const context = await conversationService.getConversationContext(conv.id);
        return {
          ...conv,
          context: context || null
        };
      })
    );

    res.json(conversationsWithContext);
  } catch (error) {
    logger.error('Failed to get live conversations:', error);
    const message = error instanceof Error ? error.message : 'Failed to get live conversations';
    res.status(500).json({ error: message });
  }
});

export default router;