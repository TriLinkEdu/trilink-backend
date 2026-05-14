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

        if (!redisHost) {
          logger.warn('REDIS_HOST not set — using in-memory cache (not suitable for multi-instance)');
          return { ttl: 300000 };
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { redisStore } = require('cache-manager-redis-yet');
          const store = await redisStore({
            socket: {
              host: redisHost,
              port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
            ttl: 300,
          });
          logger.log(`Redis cache connected at ${redisHost}`);
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
