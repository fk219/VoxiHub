import { createClient } from 'redis';
import { config } from './env';

// Initialize Redis client (don't connect yet)
export const redis = createClient({
  url: config.redis.url
});

// Setup event handlers
redis.on('error', (error) => {
  console.error('Redis error:', error);
});

redis.on('connect', () => {
  console.log('✓ Connected to Redis');
});

redis.on('disconnect', () => {
  console.log('✗ Disconnected from Redis');
});

// Export connection function to be called from index.ts
export async function connectRedis() {
  try {
    await redis.connect();
    console.log('Redis client connected successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
}
