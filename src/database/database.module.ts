import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { TYPEORM_ENTITIES } from './typeorm-entities';
import { getPostgresConnectionFromEnv } from './postgres-env';
import { User } from '../modules/users/entities/user.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('database.type') || 'postgres';
        const loggingEnv = process.env.DB_LOGGING || process.env.TYPEORM_LOGGING;
        const logging = loggingEnv == null
          ? process.env.NODE_ENV === 'development'
          : ['true', '1', 'yes'].includes(loggingEnv.toLowerCase());
        const synchronizeEnv = process.env.TYPEORM_SYNCHRONIZE;
        const synchronize = synchronizeEnv == null
          ? process.env.NODE_ENV !== 'production'
          : ['true', '1', 'yes'].includes(synchronizeEnv.toLowerCase());
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
  providers: [SeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
