import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      useFactory: async () => {
        const disableRedis = ['true', '1', 'yes'].includes(
          (process.env.REDIS_DISABLED || '').toLowerCase(),
        );
        if (disableRedis) {
          return { ttl: 300 };
        }
        return {
          store: await redisStore({
            socket: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
            },
            ttl: 300,
          }),
        };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
