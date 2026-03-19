/**
 * Seeds the initial admin user. Run after DB is up:
 *   npm run seed
 * Requires: .env with SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD; DB_* for postgres or DB_TYPE=sqlite
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../modules/users/entities/user.entity';

async function seed() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const defaultDbType = nodeEnv === 'production' ? 'postgres' : 'sqlite';
  const dbType = process.env.DB_TYPE || defaultDbType;
  const config =
    dbType === 'sqlite'
      ? (() => {
          const sqlitePath = process.env.DB_SQLITE_PATH || 'data/trilink.sqlite';
          const dir = path.dirname(sqlitePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          return {
            type: 'better-sqlite3' as const,
            database: sqlitePath,
            entities: [User],
            synchronize: false,
          };
        })()
      : {
          type: 'postgres' as const,
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'trilink',
          password: process.env.DB_PASSWORD || 'trilink_secret',
          database: process.env.DB_DATABASE || 'trilink',
          entities: [User],
          synchronize: false,
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

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
