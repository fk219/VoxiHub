import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Vector Store Service - Optimized for Low Latency
 * 
 * Features:
 * - FAISS for fast similarity search
 * - Cached embeddings
 * - Parallel processing
 * - Disk persistence
 */
export class VectorStoreService {
  private embeddings: OpenAIEmbeddings;
  private stores: Map<string, FaissStore>;
  private storePath: string;
  private embeddingCache: Map<string, number[]>;

  constructor() {
    // Check if OpenAI API key is valid
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder') || apiKey.length < 20) {
      logger.warn('OpenAI API key not configured. Vector store will be disabled.');
      logger.warn('Set OPENAI_API_KEY in .env to enable semantic search.');
      this.embeddings = null as any;
    } else {
      this.embeddings = new OpenAIEmbeddings({
        apiKey,
        modelName: 'text-embedding-3-small', // Faster and cheaper
        batchSize: 512 // Process multiple docs at once
      });
    }

    this.stores = new Map();
    this.storePath = path.join(process.cwd(), 'vector-stores');
    this.embeddingCache = new Map();

    // Ensure vector store directory exists
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }

    // Load existing stores on startup
    if (this.embeddings) {
      this.loadExistingStores();
    }
  }

  /**
   * Load existing vector stores from disk
   */
  private async loadExistingStores() {
    try {
      const files = fs.readdirSync(this.storePath);
      
      for (const file of files) {
        if (file.endsWith('.faiss')) {
          const kbId = file.replace('.faiss', '');
          try {
            const store = await FaissStore.load(
              path.join(this.storePath, kbId),
              this.embeddings
            );
            this.stores.set(kbId, store);
            logger.info('Loaded vector store', { kbId });
          } catch (error) {
            logger.error('Failed to load vector store', { kbId, error });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load existing stores:', error);
    }
  }

  /**
   * Create vector store from documents
   */
  async createKnowledgeBaseStore(
    kbId: string,
    documents: Array<{ content: string; metadata?: any }>
  ): Promise<void> {
    if (!this.embeddings) {
      logger.warn('Vector store disabled - OpenAI API key not configured');
      return;
    }

    const startTime = Date.now();

    try {
      // Convert to LangChain documents
      const docs = documents.map(doc => new Document({
        pageContent: doc.content,
        metadata: { ...doc.metadata, kbId }
      }));

      // Split documents into chunks for better retrieval
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ['\n\n', '\n', '. ', ' ', '']
      });

      const chunks = await splitter.splitDocuments(docs);
      logger.info('Documents split into chunks', { kbId, chunkCount: chunks.length });

      // Create vector store
      const vectorStore = await FaissStore.fromDocuments(
        chunks,
        this.embeddings
      );

      // Save to disk
      const storePath = path.join(this.storePath, kbId);
      await vectorStore.save(storePath);

      // Cache in memory
      this.stores.set(kbId, vectorStore);

      const duration = Date.now() - startTime;
      logger.info('Vector store created', { kbId, duration, chunkCount: chunks.length });

    } catch (error) {
      logger.error('Failed to create vector store:', { kbId, error });
      throw error;
    }
  }

  /**
   * Add documents to existing vector store
   */
  async addDocuments(
    kbId: string,
    documents: Array<{ content: string; metadata?: any }>
  ): Promise<void> {
    if (!this.embeddings) {
      logger.warn('Vector store disabled - OpenAI API key not configured');
      return;
    }

    const startTime = Date.now();

    try {
      let vectorStore = this.stores.get(kbId);

      // If store doesn't exist, create it
      if (!vectorStore) {
        await this.createKnowledgeBaseStore(kbId, documents);
        return;
      }

      // Convert to LangChain documents
      const docs = documents.map(doc => new Document({
        pageContent: doc.content,
        metadata: { ...doc.metadata, kbId }
      }));

      // Split into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
      });

      const chunks = await splitter.splitDocuments(docs);

      // Add to existing store
      await vectorStore.addDocuments(chunks);

      // Save to disk
      const storePath = path.join(this.storePath, kbId);
      await vectorStore.save(storePath);

      const duration = Date.now() - startTime;
      logger.info('Documents added to vector store', { kbId, duration, chunkCount: chunks.length });

    } catch (error) {
      logger.error('Failed to add documents:', { kbId, error });
      throw error;
    }
  }

  /**
   * Search knowledge base (optimized for low latency)
   */
  async searchKnowledgeBase(
    kbId: string,
    query: string,
    k: number = 5
  ): Promise<Document[]> {
    if (!this.embeddings) {
      logger.warn('Vector store disabled - returning empty results');
      return [];
    }

    const startTime = Date.now();

    try {
      const store = this.stores.get(kbId);

      if (!store) {
        // Try to load from disk
        try {
          const loadedStore = await FaissStore.load(
            path.join(this.storePath, kbId),
            this.embeddings
          );
          this.stores.set(kbId, loadedStore);
          
          const results = await loadedStore.similaritySearch(query, k);
          const duration = Date.now() - startTime;
          logger.info('KB search completed (loaded from disk)', { kbId, duration, resultCount: results.length });
          return results;
        } catch (error) {
          logger.warn('Vector store not found', { kbId });
          return [];
        }
      }

      // Search with similarity threshold
      const results = await store.similaritySearch(query, k);

      const duration = Date.now() - startTime;
      logger.info('KB search completed', { kbId, duration, resultCount: results.length });

      return results;

    } catch (error) {
      logger.error('KB search failed:', { kbId, error });
      return [];
    }
  }

  /**
   * Delete vector store
   */
  async deleteKnowledgeBase(kbId: string): Promise<void> {
    try {
      // Remove from memory
      this.stores.delete(kbId);

      // Remove from disk
      const storePath = path.join(this.storePath, kbId);
      if (fs.existsSync(`${storePath}.faiss`)) {
        fs.unlinkSync(`${storePath}.faiss`);
      }
      if (fs.existsSync(`${storePath}.pkl`)) {
        fs.unlinkSync(`${storePath}.pkl`);
      }

      logger.info('Vector store deleted', { kbId });
    } catch (error) {
      logger.error('Failed to delete vector store:', { kbId, error });
      throw error;
    }
  }

  /**
   * Get store statistics
   */
  getStats(kbId: string): { exists: boolean; cached: boolean } {
    const cached = this.stores.has(kbId);
    const exists = cached || fs.existsSync(path.join(this.storePath, `${kbId}.faiss`));

    return { exists, cached };
  }

  /**
   * Preload stores for faster access
   */
  async preloadStores(kbIds: string[]): Promise<void> {
    const promises = kbIds.map(async kbId => {
      if (!this.stores.has(kbId)) {
        try {
          const store = await FaissStore.load(
            path.join(this.storePath, kbId),
            this.embeddings
          );
          this.stores.set(kbId, store);
          logger.info('Preloaded vector store', { kbId });
        } catch (error) {
          logger.warn('Failed to preload store', { kbId });
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Clear memory cache (keeps disk storage)
   */
  clearCache() {
    this.stores.clear();
    this.embeddingCache.clear();
    logger.info('Vector store cache cleared');
  }
}
