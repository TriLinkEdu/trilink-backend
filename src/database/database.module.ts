import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { TYPEORM_ENTITIES } from './typeorm-entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('database.type') || 'sqlite';
        const common = {
          entities: TYPEORM_ENTITIES,
          synchronize: process.env.NODE_ENV !== 'production',
          logging: process.env.NODE_ENV === 'development',
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
        return {
          type: 'postgres',
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.database'),
          ...common,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
