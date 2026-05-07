import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { TYPEORM_ENTITIES } from './typeorm-entities';
import { getPostgresConnectionFromEnv } from './postgres-env';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('database.type') || 'postgres';
        const synchronize = process.env.TYPEORM_SYNCHRONIZE === 'true';
        const logging =
          process.env.TYPEORM_LOGGING === 'true' || process.env.NODE_ENV === 'development';
        const common = {
          entities: TYPEORM_ENTITIES,
          synchronize,
          logging,
        };
        if (dbType === 'sqlite') {
          const sqlitePath = config.get<string>('database.sqlitePath') || 'data/trilink.sqlite';
          const dir = path.dirname(sqlitePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          return {
            type: 'better-sqlite3',
            database: sqlitePath,
            ...common,
          };
        }
        const pg = getPostgresConnectionFromEnv();
        return {
          type: 'postgres',
          ...pg,
          ...common,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
