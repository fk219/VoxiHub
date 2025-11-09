import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Document Processor Service
 * Handles text extraction from various file formats
 */
export class DocumentProcessorService {
  private supportedFormats = ['pdf', 'txt', 'md', 'doc', 'docx'];

  /**
   * Extract text from uploaded file
   */
  async extractText(filePath: string, fileType: string): Promise<string> {
    try {
      logger.info('Extracting text from file:', { filePath, fileType });

      switch (fileType.toLowerCase()) {
        case 'txt':
        case 'md':
          return await this.extractFromText(filePath);
        
        case 'pdf':
          return await this.extractFromPDF(filePath);
        
        case 'doc':
        case 'docx':
          return await this.extractFromWord(filePath);
        
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      logger.error('Text extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract text from plain text files
   */
  private async extractFromText(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.trim();
    } catch (error) {
      throw new Error(`Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from PDF files
   * Note: Requires pdf-parse package
   */
  private async extractFromPDF(filePath: string): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from Word documents
   * Note: Requires mammoth package
   */
  private async extractFromWord(filePath: string): Promise<string> {
    try {
      // For now, return a placeholder
      // TODO: Install mammoth package and implement
      // const mammoth = require('mammoth');
      // const result = await mammoth.extractRawText({ path: filePath });
      // return result.value;
      
      return '[Word document extraction coming soon - install mammoth package]';
    } catch (error) {
      throw new Error(`Failed to extract Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file type is supported
   */
  isSupportedFormat(fileType: string): boolean {
    return this.supportedFormats.includes(fileType.toLowerCase());
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  /**
   * Clean and normalize extracted text
   */
  cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Split text into chunks for processing
   */
  chunkText(text: string, maxChunkSize: number = 1000): string[] {
    const sentences = text.split(/[.!?]+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if ((currentChunk + trimmed).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmed;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

export const documentProcessor = new DocumentProcessorService();
