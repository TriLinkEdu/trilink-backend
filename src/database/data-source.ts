import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { TYPEORM_ENTITIES } from './typeorm-entities';
import { getPostgresConnectionFromEnv } from './postgres-env';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  ...getPostgresConnectionFromEnv({ direct: true }),
  entities: TYPEORM_ENTITIES,
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
