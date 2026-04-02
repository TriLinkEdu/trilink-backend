/**
 * Seeds the initial admin user. Run after DB is up:
 *   npm run seed
 * Requires: .env with SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD; DB_* for PostgreSQL (default) or DB_TYPE=sqlite for file DB
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { User, UserRole } from '../modules/users/entities/user.entity';

/**
 * Schema sync for this run:
 * - Dev (NODE_ENV !== production): on (same as Nest DatabaseModule).
 * - Production: off unless SEED_SYNC_SCHEMA=true (use once on empty Neon / hosted DB).
 * - SEED_SYNC_SCHEMA=false: never sync (overrides dev).
 */
function seedSynchronize(): boolean {
  const explicit = process.env.SEED_SYNC_SCHEMA?.toLowerCase();
  if (explicit === 'false' || explicit === '0') return false;
  if (explicit === 'true' || explicit === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

async function seed() {
  const dbType = process.env.DB_TYPE || 'postgres';
  const config =
    dbType === 'sqlite'
      ? (() => {
          const sqlitePath = process.env.DB_SQLITE_PATH || 'data/trilink.sqlite';
          const dir = path.dirname(sqlitePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          return {
            type: 'better-sqlite3' as const,
            database: sqlitePath,
            entities: TYPEORM_ENTITIES,
            synchronize: seedSynchronize(),
          };
        })()
      : {
          type: 'postgres' as const,
          ...getPostgresConnectionFromEnv(),
          entities: TYPEORM_ENTITIES,
          synchronize: seedSynchronize(),
        };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@trilink.edu').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const firstName = 'System';
  const lastName = 'Admin';

  const repo = dataSource.getRepository(User);
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    console.log('Admin user already exists:', email);
    await dataSource.destroy();
    process.exit(0);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await repo.save(
    repo.create({
      email,
      passwordHash,
      role: UserRole.ADMIN,
      firstName,
      lastName,
      mustChangePassword: false,
    }),
  );

  console.log('Admin user created:', email);
  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error(err);
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : '';
  if (msg.includes('does not exist') || msg.includes('42P01')) {
    console.error(
      '\nHint: empty database with no tables. Either start the API once with NODE_ENV=development (synchronize), or run seed with SEED_SYNC_SCHEMA=true once, then remove it.\n',
    );
  }
  process.exit(1);
});
