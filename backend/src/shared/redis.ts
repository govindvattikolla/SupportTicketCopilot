import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from '../config/env';

let redisClient: Redis | null = null;
let isUsingMock = false;

/**
 * Creates and returns a Redis client.
 * If running in test mode or if Redis connection fails/unavailable,
 * gracefully falls back to in-memory ioredis-mock.
 */
export const createRedisConnection = (): Redis => {
  if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_REDIS === 'true') {
    isUsingMock = true;
    return new RedisMock() as unknown as Redis;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) {
          // If Redis is not available after 3 retries, don't spam errors
          return null;
        }
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
    });

    client.on('error', (err) => {
      // In development, handle connection failures gracefully
      if (process.env.NODE_ENV !== 'production' && !isUsingMock) {
        console.warn(`[Redis] Connection notice: ${err.message}. Background queues will use in-memory mock.`);
      }
    });

    return client;
  } catch (err: any) {
    console.warn(`[Redis] Fallback to in-memory mock: ${err.message}`);
    isUsingMock = true;
    return new RedisMock() as unknown as Redis;
  }
};

/**
 * Shared singleton Redis connection for general caching / pubsub
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = createRedisConnection();
  }
  return redisClient;
};

/**
 * Close Redis connection during shutdown
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore disconnect error
    }
    redisClient = null;
  }
};

export const isMockRedis = (): boolean => isUsingMock;
