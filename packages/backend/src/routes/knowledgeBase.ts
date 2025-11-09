import { Router, Request, Response } from 'express';
import { documentProcessor } from '../services/documentProcessor';
import { VectorStoreService } from '../services/vectorStore';
import { logger } from '../utils/logger';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { supabase } from '..';

// Initialize vector store service
const vectorStore = new VectorStoreService();

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/knowledge-bases');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|pdf|doc|docx)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, MD, DOC, DOCX are allowed.'));
    }
  }
});

/**
 * Get all knowledge bases
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get all knowledge bases from database
    const { data: kbs, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch knowledge bases:', error);
      return res.status(500).json({ error: 'Failed to fetch knowledge bases' });
    }

    // Get document counts for each KB
    const kbsWithCounts = await Promise.all((kbs || []).map(async (kb) => {
      const { count } = await supabase
        .from('kb_documents')
        .select('*', { count: 'exact', head: true })
        .eq('knowledge_base_id', kb.id);
      
      return {
        ...kb,
        document_count: count || 0
      };
    }));

    res.json(kbsWithCounts);
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

    // Get KB from database
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', id)
      .single();

    if (kbError || !kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Get documents for this KB
    const { data: docs, error: docsError } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('knowledge_base_id', id)
      .order('created_at', { ascending: false });

    if (docsError) {
      logger.error('Failed to fetch documents:', docsError);
    }

    res.json({
      ...kb,
      documents: docs || []
    });
  } catch (error) {
    logger.error('Failed to get knowledge base:', error);
    res.status(500).json({ error: 'Failed to get knowledge base' });
  }
});

/**
 * Create new knowledge base
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Create KB in database
    const { data: kb, error } = await supabase
      .from('knowledge_bases')
      .insert({
        name,
        description: description || '',
        type: type || 'general'
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create knowledge base:', error);
      return res.status(500).json({ error: 'Failed to create knowledge base' });
    }

    logger.info('Knowledge base created:', { id: kb.id, name: kb.name });
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
    const { name, description, type } = req.body;

    // Check if KB exists
    const { data: existing, error: checkError } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Update KB
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    updateData.updated_at = new Date().toISOString();

    const { data: kb, error } = await supabase
      .from('knowledge_bases')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update knowledge base:', error);
      return res.status(500).json({ error: 'Failed to update knowledge base' });
    }

    logger.info('Knowledge base updated:', { id });
    res.json(kb);
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

    // Check if KB exists
    const { data: existing, error: checkError } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Delete all documents first (cascade should handle this, but being explicit)
    await supabase
      .from('kb_documents')
      .delete()
      .eq('knowledge_base_id', id);

    // Delete KB
    const { error } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete knowledge base:', error);
      return res.status(500).json({ error: 'Failed to delete knowledge base' });
    }

    logger.info('Knowledge base deleted:', { id });
    res.json({ success: true, message: 'Knowledge base deleted' });
  } catch (error) {
    logger.error('Failed to delete knowledge base:', error);
    res.status(500).json({ error: 'Failed to delete knowledge base' });
  }
});

/**
 * Upload documents to knowledge base
 */
router.post('/:id/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check if KB exists
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', id)
      .single();

    if (kbError || !kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const uploadedDocs = [];
    const errors = [];

    for (const file of files) {
      try {
        logger.info('Processing file:', { filename: file.originalname, mimetype: file.mimetype });

        // Process document based on type
        let content = '';
        const fileExt = path.extname(file.originalname).toLowerCase();

        // Extract text based on file type
        content = await documentProcessor.extractText(file.path, fileExt.substring(1));

        if (!content || content.trim().length === 0) {
          throw new Error('No content extracted from file');
        }

        // Save to database
        const { data: doc, error: docError } = await supabase
          .from('kb_documents')
          .insert({
            knowledge_base_id: id,
            filename: file.originalname,
            original_filename: file.originalname,
            file_path: file.path,
            file_type: file.mimetype,
            file_size: file.size,
            content: content,
            chunk_count: Math.ceil(content.length / 1000)
          })
          .select()
          .single();

        if (docError) {
          logger.error('Failed to save document to database:', docError);
          errors.push({ filename: file.originalname, error: 'Failed to save to database' });
          continue;
        }

        uploadedDocs.push(doc);

        // Try to add to vector store (optional, don't fail if it doesn't work)
        try {
          await vectorStore.addDocuments(id, [{
            content: content,
            metadata: {
              id: doc.id,
              filename: file.originalname,
              type: file.mimetype
            }
          }]);
        } catch (vectorError) {
          logger.warn('Failed to add to vector store (continuing anyway):', vectorError);
        }

        logger.info('Document uploaded successfully:', { 
          kbId: id, 
          docId: doc.id,
          filename: file.originalname 
        });

      } catch (error) {
        logger.error('Failed to process file:', { filename: file.originalname, error });
        errors.push({ 
          filename: file.originalname, 
          error: error instanceof Error ? error.message : 'Processing failed' 
        });
      }
    }

    res.json({
      success: true,
      uploaded: uploadedDocs.length,
      failed: errors.length,
      documents: uploadedDocs,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    logger.error('Failed to upload documents:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

/**
 * Get documents in knowledge base
 */
router.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if KB exists
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', id)
      .single();

    if (kbError || !kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Get documents
    const { data: docs, error } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('knowledge_base_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch documents:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json(docs || []);
  } catch (error) {
    logger.error('Failed to get documents:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

/**
 * Delete document from knowledge base
 */
router.delete('/:id/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;

    // Check if document exists
    const { data: doc, error: checkError } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('id', docId)
      .eq('knowledge_base_id', id)
      .single();

    if (checkError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Note: Vector store doesn't support individual document deletion
    // The entire KB would need to be rebuilt if needed

    // Delete file from disk if it exists
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      try {
        fs.unlinkSync(doc.file_path);
      } catch (fsError) {
        logger.warn('Failed to delete file from disk:', fsError);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('kb_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      logger.error('Failed to delete document:', error);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    logger.info('Document deleted:', { kbId: id, docId });
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    logger.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * Search knowledge base
 */
router.post('/:id/search', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check if KB exists in database
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', id)
      .single();

    if (kbError || !kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Search documents in database
    const { data: docs, error: docsError } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('knowledge_base_id', id);

    if (docsError) {
      logger.error('Failed to fetch documents:', docsError);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    // Improved text search (case-insensitive, multi-word matching)
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2); // Split into words, ignore short words
    
    const results = (docs || [])
      .filter(doc => {
        if (!doc.content) return false;
        const contentLower = doc.content.toLowerCase();
        
        // Match if ANY significant word from query is in content
        return queryWords.some(word => contentLower.includes(word)) || 
               contentLower.includes(queryLower);
      })
      .map(doc => ({
        document_id: doc.id,
        filename: doc.filename || doc.original_filename || 'Unknown',
        excerpt: getExcerpt(doc.content, query),
        relevance: 0.8 // Mock relevance score
      }))
      .slice(0, 5); // Top 5 results

    logger.info('Knowledge base search:', { 
      kbId: id, 
      query, 
      totalDocs: docs?.length || 0,
      resultsFound: results.length 
    });

    res.json({ results });
  } catch (error) {
    logger.error('Failed to search knowledge base:', error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

/**
 * Helper function to get excerpt around search query
 */
function getExcerpt(content: string, query: string, contextLength: number = 100): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) return content.substring(0, contextLength) + '...';

  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + query.length + contextLength);

  let excerpt = content.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < content.length) excerpt = excerpt + '...';

  return excerpt;
}

export default router;
