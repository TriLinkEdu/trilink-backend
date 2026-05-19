import { Module, Global, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';

const logger = new Logger('CacheModule');

function buildCacheConfig() {
  const redisHost = process.env.REDIS_HOST;

  if (!redisHost) {
    logger.warn('REDIS_HOST not set — using in-memory cache');
    return { ttl: 300000 };
  }

  // Redis config — store is resolved at runtime via registerAsync
  return {
    // Will be overridden in useFactory below when Redis is available
    ttl: 300000,
  };
}

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      useFactory: async () => {
        const redisHost = process.env.REDIS_HOST;

        // Skip Redis if not configured, explicitly disabled, or using localhost
        const skipRedis = !redisHost ||
                          process.env.REDIS_ENABLED === 'false' ||
                          ['localhost', '127.0.0.1', '::1'].includes(redisHost);

        if (skipRedis) {
          if (!redisHost) {
            logger.warn('REDIS_HOST not set — using in-memory cache (not suitable for multi-instance)');
          } else if (process.env.REDIS_ENABLED === 'false') {
            logger.log('Redis disabled via REDIS_ENABLED=false — using in-memory cache');
          } else {
            logger.warn(`Redis host ${redisHost} is localhost — using in-memory cache`);
          }
          return { ttl: 300000 };
        }

        // Redis is configured with a non-localhost host
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { redisStore } = require('cache-manager-redis-yet');
          const store = await redisStore({
            socket: {
              host: redisHost,
              port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
            ttl: 300,
            // Use lazy connect to prevent startup crash if Redis unavailable
            lazyConnect: true,
            // Add retry strategy
            retryStrategy: (times: number) => {
              if (times > 3) {
                logger.warn(`Redis retry limit exceeded after ${times} attempts`);
                return null; // Stop retrying
              }
              return Math.min(times * 100, 3000); // Exponential backoff
            },
            // Add connection timeout
            connectTimeout: 5000,
            // Disable offline queue to fail fast
            enableOfflineQueue: false,
          });
          logger.log(`Redis cache configured at ${redisHost} (lazy connect)`);
          return { store };
        } catch (err) {
          logger.warn(`Redis unavailable (${(err as Error).message}) — falling back to in-memory cache`);
          return { ttl: 300000 };
        }
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
