# Groq Provider Integration

## Overview

Groq is integrated into the Multi-LLM Service, providing ultra-fast inference for open-source models including Llama 3, Mixtral, and Gemma.

## Features

### ✅ Supported Models

- **Llama 3 70B** (`llama3-70b-8192`) - High-performance, 8K context
- **Llama 3 8B** (`llama3-8b-8192`) - Fast, efficient, 8K context
- **Mixtral 8x7B** (`mixtral-8x7b-32768`) - Mixture of experts, 32K context
- **Gemma 7B** (`gemma-7b-it`) - Google's instruction-tuned model

### ✅ Capabilities

- **Completion Generation** - Standard text completion
- **Streaming Support** - Real-time token streaming
- **Configurable Parameters** - Temperature, max tokens, top-p
- **Error Handling** - Graceful error handling and retries
- **Rate Limiting** - Built-in rate limit management

## Configuration

### Environment Variables

Add your Groq API key to `.env`:

```bash
GROQ_API_KEY=your_groq_api_key_here
```

Get your API key from: https://console.groq.com/keys

### Default Configuration

```typescript
{
  provider: 'groq',
  model: 'llama3-70b-8192',
  temperature: 0.7,
  maxTokens: 8192
}
```

## Usage Examples

### Basic Completion

```typescript
import { MultiLLMService, LLMProvider } from './services/multiLLMService';

const llmService = new MultiLLMService();

const response = await llmService.generateCompletion(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing in simple terms.' }
  ],
  {
    provider: LLMProvider.GROQ,
    model: 'llama3-70b-8192',
    temperature: 0.7,
    maxTokens: 500
  }
);

console.log(response.content);
console.log('Tokens used:', response.usage?.totalTokens);
```

### Streaming Completion

```typescript
const stream = llmService.streamCompletion(
  [
    { role: 'user', content: 'Write a short story about AI.' }
  ],
  {
    provider: LLMProvider.GROQ,
    model: 'llama3-8b-8192'
  }
);

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### Using Different Models

```typescript
// Fast, efficient model for simple tasks
const quickResponse = await llmService.generateCompletion(messages, {
  provider: LLMProvider.GROQ,
  model: 'llama3-8b-8192'
});

// High-performance model for complex tasks
const detailedResponse = await llmService.generateCompletion(messages, {
  provider: LLMProvider.GROQ,
  model: 'llama3-70b-8192'
});

// Long context support
const longContextResponse = await llmService.generateCompletion(messages, {
  provider: LLMProvider.GROQ,
  model: 'mixtral-8x7b-32768'
});
```

### Custom Configuration

```typescript
// Update provider configuration
llmService.updateProviderConfig(LLMProvider.GROQ, {
  temperature: 0.5,
  maxTokens: 4096
});

// Set as default provider
llmService.setDefaultProvider(LLMProvider.GROQ);

// Now requests use Groq by default
const response = await llmService.generateCompletion(messages);
```

## Model Selection Guide

### Llama 3 70B (`llama3-70b-8192`)
- **Best for**: Complex reasoning, detailed analysis, creative writing
- **Context**: 8,192 tokens
- **Speed**: Fast (Groq optimized)
- **Use cases**: Customer support, content generation, code assistance

### Llama 3 8B (`llama3-8b-8192`)
- **Best for**: Quick responses, simple tasks, high throughput
- **Context**: 8,192 tokens
- **Speed**: Ultra-fast
- **Use cases**: Chatbots, classification, simple Q&A

### Mixtral 8x7B (`mixtral-8x7b-32768`)
- **Best for**: Long documents, extensive context
- **Context**: 32,768 tokens
- **Speed**: Fast
- **Use cases**: Document analysis, long conversations, research

### Gemma 7B (`gemma-7b-it`)
- **Best for**: Instruction following, task completion
- **Context**: Standard
- **Speed**: Fast
- **Use cases**: Task automation, structured outputs

## Performance Characteristics

### Speed
Groq provides industry-leading inference speed:
- **Llama 3 8B**: ~500-800 tokens/second
- **Llama 3 70B**: ~200-400 tokens/second
- **Mixtral 8x7B**: ~300-500 tokens/second

### Latency
- **First token**: 50-200ms
- **Streaming**: Real-time with minimal buffering

### Rate Limits
- Check current limits at: https://console.groq.com/docs/rate-limits
- Implement exponential backoff for rate limit errors
- Consider request batching for high-volume applications

## Error Handling

```typescript
try {
  const response = await llmService.generateCompletion(messages, {
    provider: LLMProvider.GROQ,
    model: 'llama3-70b-8192'
  });
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Handle rate limiting
    console.log('Rate limited, retrying after delay...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Retry request
  } else if (error.message.includes('invalid model')) {
    // Handle invalid model
    console.error('Model not supported');
  } else {
    // Handle other errors
    console.error('Groq API error:', error);
  }
}
```

## Best Practices

### 1. Model Selection
- Use **Llama 3 8B** for high-volume, simple tasks
- Use **Llama 3 70B** for complex reasoning
- Use **Mixtral** when you need long context

### 2. Token Management
- Set appropriate `maxTokens` to control costs
- Monitor token usage via `response.usage`
- Implement token counting for input validation

### 3. Temperature Settings
- **0.0-0.3**: Deterministic, factual responses
- **0.4-0.7**: Balanced creativity and consistency
- **0.8-1.0**: Creative, varied responses

### 4. Streaming
- Use streaming for real-time user experiences
- Implement proper error handling in streams
- Buffer chunks appropriately for display

### 5. Error Handling
- Implement exponential backoff for retries
- Log errors for monitoring
- Provide fallback to other providers if needed

## Integration with Voice Agents

### Real-time Conversation

```typescript
// In your voice agent handler
async function handleVoiceInput(transcript: string, sessionId: string) {
  const messages = getConversationHistory(sessionId);
  messages.push({ role: 'user', content: transcript });

  // Use Groq for fast response
  const stream = llmService.streamCompletion(messages, {
    provider: LLMProvider.GROQ,
    model: 'llama3-8b-8192', // Fast model for real-time
    maxTokens: 150
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    fullResponse += chunk;
    // Send to TTS as chunks arrive
    await sendToTTS(chunk);
  }

  return fullResponse;
}
```

### Latency Optimization

```typescript
// Use Groq for minimal latency
const config = {
  provider: LLMProvider.GROQ,
  model: 'llama3-8b-8192', // Fastest model
  temperature: 0.7,
  maxTokens: 100, // Limit for faster response
  topP: 0.9
};

const response = await llmService.generateCompletion(messages, config);
```

## Testing

Run the Groq integration tests:

```bash
cd packages/backend
npm test -- groq.test.ts
```

Test with your API key:

```bash
GROQ_API_KEY=your_key npm test -- groq.test.ts
```

## Monitoring

### Usage Tracking

```typescript
const response = await llmService.generateCompletion(messages, {
  provider: LLMProvider.GROQ
});

// Log usage metrics
console.log({
  provider: response.provider,
  model: response.model,
  promptTokens: response.usage?.promptTokens,
  completionTokens: response.usage?.completionTokens,
  totalTokens: response.usage?.totalTokens
});
```

### Performance Monitoring

```typescript
const startTime = Date.now();
const response = await llmService.generateCompletion(messages, {
  provider: LLMProvider.GROQ
});
const duration = Date.now() - startTime;

console.log(`Groq response time: ${duration}ms`);
```

## Troubleshooting

### Issue: "Groq not initialized"
**Solution**: Ensure `GROQ_API_KEY` is set in your `.env` file

### Issue: Rate limit errors
**Solution**: Implement exponential backoff and request throttling

### Issue: Model not found
**Solution**: Verify model name matches supported models list

### Issue: Slow responses
**Solution**: 
- Switch to faster model (llama3-8b-8192)
- Reduce maxTokens
- Check network connectivity

## Resources

- **Groq Console**: https://console.groq.com
- **API Documentation**: https://console.groq.com/docs
- **Model Benchmarks**: https://wow.groq.com/
- **Rate Limits**: https://console.groq.com/docs/rate-limits

## Support

For issues specific to Groq integration:
1. Check the Groq console for API status
2. Review error logs in the application
3. Verify API key permissions
4. Contact Groq support for API-specific issues

## Changelog

### v1.0.0 (Current)
- ✅ Initial Groq integration
- ✅ Support for Llama 3, Mixtral, and Gemma models
- ✅ Streaming support
- ✅ Error handling and rate limiting
- ✅ Configuration management
- ✅ Comprehensive testing
