import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Apply authentication
router.use(authenticateToken);

interface KnowledgeBase {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: 'document' | 'website' | 'manual';
  status: 'processing' | 'ready' | 'error';
  document_count?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get all knowledge bases
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Get user's organization
    const user = await dbService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const knowledgeBases = await dbService.getKnowledgeBasesByOrganization(user.organization_id);

    res.json(knowledgeBases);
  } catch (error) {
    logger.error('Failed to get knowledge bases:', error);
    res.status(500).json({ error: 'Failed to get knowledge bases' });
  }
});

/**
 * Get knowledge base by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const kb = await dbService.getKnowledgeBaseById(id);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(kb);
  } catch (error) {
    logger.error('Failed to get knowledge base:', error);
    res.status(500).json({ error: 'Failed to get knowledge base' });
  }
});

/**
 * Create knowledge base
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, type = 'manual' } = req.body;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = await dbService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const kb = await dbService.createKnowledgeBase({
      organization_id: user.organization_id,
      name,
      description,
      type,
      status: 'ready',
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('Knowledge base created:', { kbId: kb.id, name });

    res.status(201).json(kb);
  } catch (error) {
    logger.error('Failed to create knowledge base:', error);
    res.status(500).json({ error: 'Failed to create knowledge base' });
  }
});

/**
 * Update knowledge base
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await dbService.updateKnowledgeBase(id, {
      name,
      description,
      updated_at: new Date()
    });

    logger.info('Knowledge base updated:', { kbId: id });

    res.json(updated);
  } catch (error) {
    logger.error('Failed to update knowledge base:', error);
    res.status(500).json({ error: 'Failed to update knowledge base' });
  }
});

/**
 * Delete knowledge base
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbService.deleteKnowledgeBase(id);

    logger.info('Knowledge base deleted:', { kbId: id });

    res.json({ success: true, message: 'Knowledge base deleted' });
  } catch (error) {
    logger.error('Failed to delete knowledge base:', error);
    res.status(500).json({ error: 'Failed to delete knowledge base' });
  }
});

/**
 * Upload document to knowledge base
 */
router.post('/:id/documents', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Process document (extract text, create embeddings, etc.)
    // This would be handled by a background job
    const document = await dbService.createKBDocument({
      kb_id: id,
      title: file.originalname,
      file_path: file.path,
      status: 'processing',
      created_at: new Date()
    });

    // Update KB status
    await dbService.updateKnowledgeBase(id, {
      status: 'processing',
      updated_at: new Date()
    });

    logger.info('Document uploaded:', { kbId: id, documentId: document.id });

    res.status(201).json(document);
  } catch (error) {
    logger.error('Failed to upload document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * Scrape website and add to knowledge base
 */
router.post('/:id/scrape', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { url, maxPages = 10 } = req.body;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Start scraping job (background process)
    // This would be handled by a job queue
    await dbService.updateKnowledgeBase(id, {
      status: 'processing',
      updated_at: new Date()
    });

    logger.info('Website scraping started:', { kbId: id, url });

    res.json({ success: true, message: 'Scraping started', url, maxPages });
  } catch (error) {
    logger.error('Failed to start scraping:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
  }
});

/**
 * Search knowledge base
 */
router.get('/:id/search', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { query, limit = 5 } = req.query;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Perform semantic search
    const results = await dbService.searchKnowledgeBase(id, query as string, Number(limit));

    res.json(results);
  } catch (error) {
    logger.error('Failed to search knowledge base:', error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

/**
 * Get documents in knowledge base
 */
router.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const documents = await dbService.getKBDocuments(id);

    res.json(documents);
  } catch (error) {
    logger.error('Failed to get documents:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

/**
 * Link knowledge base to agent
 */
router.post('/:id/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { id, agentId } = req.params;
    const { priority = 0 } = req.body;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id || agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbService.linkKnowledgeBaseToAgent(agentId, id, priority);

    logger.info('Knowledge base linked to agent:', { kbId: id, agentId });

    res.json({ success: true, message: 'Knowledge base linked to agent' });
  } catch (error) {
    logger.error('Failed to link knowledge base:', error);
    res.status(500).json({ error: 'Failed to link knowledge base' });
  }
});

/**
 * Unlink knowledge base from agent
 */
router.delete('/:id/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { id, agentId } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const kb = await dbService.getKnowledgeBaseById(id);
    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    const user = await dbService.getUserById(userId);
    if (kb.organization_id !== user.organization_id || agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbService.unlinkKnowledgeBaseFromAgent(agentId, id);

    logger.info('Knowledge base unlinked from agent:', { kbId: id, agentId });

    res.json({ success: true, message: 'Knowledge base unlinked from agent' });
  } catch (error) {
    logger.error('Failed to unlink knowledge base:', error);
    res.status(500).json({ error: 'Failed to unlink knowledge base' });
  }
});

export default router;
