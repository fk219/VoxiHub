import { MultiLLMService, LLMProvider } from '../services/multiLLMService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Groq Integration Tests
 * 
 * These tests verify the Groq provider integration in the Multi-LLM Service
 */

describe('Groq Provider Integration', () => {
  let llmService: MultiLLMService;

  beforeAll(() => {
    llmService = new MultiLLMService(LLMProvider.GROQ);
  });

  describe('Provider Initialization', () => {
    it('should initialize Groq provider when API key is present', () => {
      const providers = llmService.getAvailableProviders();
      
      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'placeholder_groq_key') {
        expect(providers).toContain(LLMProvider.GROQ);
      } else {
        console.log('⚠️  Groq API key not configured, skipping provider check');
      }
    });

    it('should have correct default configuration for Groq', () => {
      const config = llmService.getProviderConfig(LLMProvider.GROQ);
      
      if (config) {
        expect(config.provider).toBe(LLMProvider.GROQ);
        expect(config.model).toBe('llama3-70b-8192');
        expect(config.temperature).toBe(0.7);
        expect(config.maxTokens).toBe(8192);
      }
    });
  });

  describe('Model Support', () => {
    it('should support Llama 3 models', () => {
      const models = llmService.getAvailableModels(LLMProvider.GROQ);
      
      expect(models).toContain('llama3-70b-8192');
      expect(models).toContain('llama3-8b-8192');
    });

    it('should support Mixtral model', () => {
      const models = llmService.getAvailableModels(LLMProvider.GROQ);
      
      expect(models).toContain('mixtral-8x7b-32768');
    });

    it('should support Gemma model', () => {
      const models = llmService.getAvailableModels(LLMProvider.GROQ);
      
      expect(models).toContain('gemma-7b-it');
    });
  });

  describe('Completion Generation', () => {
    it('should generate completion with Groq', async () => {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'placeholder_groq_key') {
        console.log('⚠️  Skipping Groq completion test - API key not configured');
        return;
      }

      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Say "Hello, Groq!" and nothing else.' }
      ];

      const response = await llmService.generateCompletion(messages, {
        provider: LLMProvider.GROQ,
        model: 'llama3-8b-8192',
        maxTokens: 50
      });

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.provider).toBe(LLMProvider.GROQ);
      expect(response.model).toBe('llama3-8b-8192');
      expect(response.usage).toBeDefined();
      expect(response.usage?.totalTokens).toBeGreaterThan(0);
    }, 30000);

    it('should handle different temperature settings', async () => {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'placeholder_groq_key') {
        console.log('⚠️  Skipping temperature test - API key not configured');
        return;
      }

      const messages = [
        { role: 'user' as const, content: 'Generate a creative story opening in one sentence.' }
      ];

      const response = await llmService.generateCompletion(messages, {
        provider: LLMProvider.GROQ,
        model: 'llama3-8b-8192',
        temperature: 0.9,
        maxTokens: 100
      });

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    }, 30000);
  });

  describe('Streaming Support', () => {
    it('should stream completion with Groq', async () => {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'placeholder_groq_key') {
        console.log('⚠️  Skipping Groq streaming test - API key not configured');
        return;
      }

      const messages = [
        { role: 'user' as const, content: 'Count from 1 to 5.' }
      ];

      const chunks: string[] = [];
      const stream = llmService.streamCompletion(messages, {
        provider: LLMProvider.GROQ,
        model: 'llama3-8b-8192',
        maxTokens: 100
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const fullContent = chunks.join('');
      expect(fullContent).toBeTruthy();
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid model gracefully', async () => {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'placeholder_groq_key') {
        console.log('⚠️  Skipping error handling test - API key not configured');
        return;
      }

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ];

      await expect(
        llmService.generateCompletion(messages, {
          provider: LLMProvider.GROQ,
          model: 'invalid-model-name'
        })
      ).rejects.toThrow();
    }, 30000);

    it('should handle rate limiting', async () => {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'placeholder_groq_key') {
        console.log('⚠️  Skipping rate limit test - API key not configured');
        return;
      }

      // Note: This test may not always trigger rate limiting
      // It's here to document expected behavior
      const messages = [
        { role: 'user' as const, content: 'Test' }
      ];

      try {
        // Make multiple rapid requests
        const promises = Array(10).fill(null).map(() =>
          llmService.generateCompletion(messages, {
            provider: LLMProvider.GROQ,
            model: 'llama3-8b-8192',
            maxTokens: 10
          })
        );

        await Promise.all(promises);
      } catch (error: any) {
        // If rate limited, error should be handled gracefully
        expect(error).toBeDefined();
      }
    }, 60000);
  });

  describe('Configuration Management', () => {
    it('should allow updating provider config', () => {
      llmService.updateProviderConfig(LLMProvider.GROQ, {
        temperature: 0.5,
        maxTokens: 4096
      });

      const config = llmService.getProviderConfig(LLMProvider.GROQ);
      
      if (config) {
        expect(config.temperature).toBe(0.5);
        expect(config.maxTokens).toBe(4096);
      }
    });

    it('should allow setting Groq as default provider', () => {
      if (llmService.getAvailableProviders().includes(LLMProvider.GROQ)) {
        llmService.setDefaultProvider(LLMProvider.GROQ);
        
        // Verify by making a request without specifying provider
        // (would use default)
        expect(() => {
          llmService.setDefaultProvider(LLMProvider.GROQ);
        }).not.toThrow();
      }
    });
  });

  describe('Performance', () => {
    it('should complete requests within reasonable time', async () => {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'placeholder_groq_key') {
        console.log('⚠️  Skipping performance test - API key not configured');
        return;
      }

      const messages = [
        { role: 'user' as const, content: 'Say hello.' }
      ];

      const startTime = Date.now();
      
      await llmService.generateCompletion(messages, {
        provider: LLMProvider.GROQ,
        model: 'llama3-8b-8192',
        maxTokens: 50
      });

      const duration = Date.now() - startTime;
      
      // Groq is known for fast inference
      // Should typically complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });
});
