export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  // Local dev: SQLite by default (no PostgreSQL setup). Production: PostgreSQL unless DB_TYPE is set.
  const defaultDbType =
    nodeEnv === 'production' ? 'postgres' : 'sqlite';
  const dbType = (process.env.DB_TYPE || defaultDbType) as 'postgres' | 'sqlite';

  return {
  nodeEnv,
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  database: {
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'trilink',
    password: process.env.DB_PASSWORD || 'trilink_secret',
    database: process.env.DB_DATABASE || 'trilink',
    sqlitePath: process.env.DB_SQLITE_PATH || 'data/trilink.sqlite',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@trilink.edu',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};
};
