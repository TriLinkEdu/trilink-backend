import { Provider } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/** DI token for the raw Redis client used by XpService for sorted sets. */
export const REDIS_CLIENT = 'REDIS_CLIENT';

export type RedisClient = RedisClientType;

export const RedisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: async (): Promise<RedisClient> => {
    const disableRedis = ['true', '1', 'yes'].includes(
      (process.env.REDIS_DISABLED || '').toLowerCase(),
    );
    if (disableRedis) {
      // Return a no-op stub in environments without Redis (e.g., CI)
      return createNoopRedisClient() as unknown as RedisClient;
    }

    const client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }) as RedisClient;

    client.on('error', (err) => {
      // Don't crash the process on Redis errors — leaderboard reads degrade gracefully
      console.warn('[Redis] connection error:', err?.message || err);
    });

    await client.connect();
    return client;
  },
};

/** Minimal no-op stub for environments without Redis. */
function createNoopRedisClient() {
  const noop = async () => null;
  const noopPipeline = () => ({ exec: async () => [] });
  return {
    zAdd: noop,
    zRangeByScoreWithScores: async () => [],
    zRevRank: async () => null,
    keys: async () => [],
    del: noop,
    pipeline: noopPipeline,
    on: () => {},
  };
}
