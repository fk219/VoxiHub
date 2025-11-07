import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import OpenAI from 'openai';

export interface ProcessedDocument {
  title: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    pageCount?: number;
    wordCount: number;
    fileSize: number;
    fileType: string;
  };
}

export interface DocumentChunk {
  content: string;
  embedding?: number[];
  metadata: {
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export class DocumentProcessor {
  private openai: OpenAI;
  private chunkSize: number = 1000; // characters per chunk
  private chunkOverlap: number = 200; // overlap between chunks

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Process uploaded document
   */
  async processDocument(filePath: string, fileName: string): Promise<ProcessedDocument> {
    try {
      const fileExtension = path.extname(fileName).toLowerCase();
      let content: string;
      let metadata: any = {
        fileSize: fs.statSync(filePath).size,
        fileType: fileExtension
      };

      // Extract text based on file type
      switch (fileExtension) {
        case '.pdf':
          const pdfData = await this.extractPDFText(filePath);
          content = pdfData.text;
          metadata.pageCount = pdfData.numpages;
          break;
        
        case '.txt':
          content = fs.readFileSync(filePath, 'utf-8');
          break;
        
        case '.doc':
        case '.docx':
          content = await this.extractWordText(filePath);
          break;
        
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Clean and normalize text
      content = this.cleanText(content);
      metadata.wordCount = content.split(/\s+/).length;

      // Split into chunks
      const chunks = this.createChunks(content);

      // Generate embeddings for each chunk
      const chunksWithEmbeddings = await this.generateEmbeddings(chunks);

      logger.info('Document processed successfully', {
        fileName,
        chunks: chunksWithEmbeddings.length,
        wordCount: metadata.wordCount
      });

      return {
        title: fileName,
        content,
        chunks: chunksWithEmbeddings,
        metadata
      };

    } catch (error) {
      logger.error('Failed to process document:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractPDFText(filePath: string): Promise<any> {
    const dataBuffer = fs.readFileSync(filePath);
    return await pdf(dataBuffer);
  }

  /**
   * Extract text from Word document
   */
  private async extractWordText(filePath: string): Promise<string> {
    // This would use a library like mammoth or docx
    // For now, return placeholder
    logger.warn('Word document processing not fully implemented');
    return 'Word document content extraction pending';
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();
  }

  /**
   * Split text into chunks with overlap
   */
  private createChunks(text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let startChar = 0;
    let chunkIndex = 0;

    while (startChar < text.length) {
      const endChar = Math.min(startChar + this.chunkSize, text.length);
      const content = text.substring(startChar, endChar);

      chunks.push({
        content,
        metadata: {
          chunkIndex,
          startChar,
          endChar
        }
      });

      startChar += this.chunkSize - this.chunkOverlap;
      chunkIndex++;
    }

    logger.info(`Created ${chunks.length} chunks from document`);
    return chunks;
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    try {
      const chunksWithEmbeddings: DocumentChunk[] = [];

      // Process in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        const embeddings = await Promise.all(
          batch.map(chunk => this.generateEmbedding(chunk.content))
        );

        batch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: embeddings[index]
          });
        });

        logger.info(`Processed embeddings for chunks ${i} to ${i + batch.length}`);
      }

      return chunksWithEmbeddings;

    } catch (error) {
      logger.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for single text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;

    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Search similar chunks using embeddings
   */
  async searchSimilar(query: string, chunks: DocumentChunk[], limit: number = 5): Promise<DocumentChunk[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Calculate cosine similarity for each chunk
      const similarities = chunks.map(chunk => ({
        chunk,
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding || [])
      }));

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => item.chunk);

    } catch (error) {
      logger.error('Failed to search similar chunks:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Extract key information from document
   */
  async extractKeyInfo(content: string): Promise<{
    summary: string;
    keywords: string[];
    topics: string[];
  }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract key information from the document. Provide a summary, keywords, and main topics.'
          },
          {
            role: 'user',
            content: `Document content:\n\n${content.substring(0, 4000)}\n\nProvide:\n1. A brief summary (2-3 sentences)\n2. 5-10 keywords\n3. 3-5 main topics`
          }
        ],
        temperature: 0.3
      });

      const result = response.choices[0].message.content || '';
      
      // Parse the response (this is simplified - you'd want more robust parsing)
      return {
        summary: result.split('\n')[0] || '',
        keywords: [],
        topics: []
      };

    } catch (error) {
      logger.error('Failed to extract key info:', error);
      return {
        summary: '',
        keywords: [],
        topics: []
      };
    }
  }
}
