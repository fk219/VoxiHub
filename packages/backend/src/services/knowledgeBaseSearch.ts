import { DatabaseService } from './database';
import { DocumentProcessor } from './documentProcessor';
import { logger } from '../utils/logger';

export interface SearchResult {
  content: string;
  source: string;
  relevance: number;
  metadata?: any;
}

export class KnowledgeBaseSearchService {
  private dbService: DatabaseService;
  private documentProcessor: DocumentProcessor;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    this.documentProcessor = new DocumentProcessor();
  }

  /**
   * Search across multiple knowledge bases for relevant context
   */
  async searchKnowledgeBases(
    knowledgeBaseIds: string[],
    query: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
        return [];
      }

      logger.info('Searching knowledge bases', {
        kbCount: knowledgeBaseIds.length,
        query: query.substring(0, 50)
      });

      // Generate embedding for the query
      const queryEmbedding = await this.documentProcessor['generateEmbedding'](query);

      // Search each knowledge base
      const allResults: SearchResult[] = [];

      for (const kbId of knowledgeBaseIds) {
        const results = await this.searchSingleKB(kbId, queryEmbedding, limit);
        allResults.push(...results);
      }

      // Sort by relevance and return top results
      const sortedResults = allResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      logger.info('Knowledge base search complete', {
        totalResults: allResults.length,
        returnedResults: sortedResults.length
      });

      return sortedResults;

    } catch (error) {
      logger.error('Knowledge base search failed:', error);
      return [];
    }
  }

  /**
   * Search a single knowledge base
   */
  private async searchSingleKB(
    kbId: string,
    queryEmbedding: number[],
    limit: number
  ): Promise<SearchResult[]> {
    try {
      // Get all document chunks for this knowledge base
      const chunks = await this.dbService.getKBChunks(kbId);

      if (!chunks || chunks.length === 0) {
        return [];
      }

      // Calculate similarity for each chunk
      const results = chunks.map(chunk => ({
        content: chunk.content,
        source: chunk.document_title || 'Unknown',
        relevance: this.cosineSimilarity(queryEmbedding, chunk.embedding || []),
        metadata: chunk.metadata
      }));

      // Filter by minimum relevance threshold (0.7)
      return results
        .filter(r => r.relevance >= 0.7)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

    } catch (error) {
      logger.error(`Failed to search KB ${kbId}:`, error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length || a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Format search results for LLM context
   */
  formatResultsForContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const formattedResults = results.map((result, index) => {
      return `[Source ${index + 1}: ${result.source}]\n${result.content}`;
    }).join('\n\n---\n\n');

    return `Relevant information from knowledge base:\n\n${formattedResults}`;
  }

  /**
   * Get knowledge base statistics
   */
  async getKBStats(kbId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    averageChunkSize: number;
  }> {
    try {
      const documents = await this.dbService.getKBDocuments(kbId);
      const chunks = await this.dbService.getKBChunks(kbId);

      const averageChunkSize = chunks.length > 0
        ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length
        : 0;

      return {
        totalDocuments: documents.length,
        totalChunks: chunks.length,
        averageChunkSize: Math.round(averageChunkSize)
      };

    } catch (error) {
      logger.error('Failed to get KB stats:', error);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        averageChunkSize: 0
      };
    }
  }
}
