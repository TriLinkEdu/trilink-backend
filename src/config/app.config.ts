export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  // Primary database: PostgreSQL. Set DB_TYPE=sqlite only for file-based / embedded-style local runs (e.g. mobile dev tooling).
  const dbType = (process.env.DB_TYPE || 'postgres') as 'postgres' | 'sqlite';

  return {
  nodeEnv,
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  database: {
    type: dbType,
    /** Set for Neon / managed Postgres; when set, DB_HOST/DB_PORT/… are ignored by TypeORM. */
    url: process.env.DATABASE_URL?.trim() || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'trilink',
    password: process.env.DB_PASSWORD || 'trilink_secret',
    database: process.env.DB_DATABASE || 'trilink',
    sqlitePath: process.env.DB_SQLITE_PATH || 'data/trilink.sqlite',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '1d',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@trilink.edu',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
  /** Comma-separated origins, or omit for reflect-all (dev). Production: set explicitly. */
  corsOrigin:
    process.env.CORS_ORIGIN === undefined || process.env.CORS_ORIGIN === ''
      ? null
      : process.env.CORS_ORIGIN.split(',')
          .map((s) => s.trim())
          .filter(Boolean),
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '150', 10),
  },
  digest: {
    enabled: process.env.WEEKLY_DIGEST_ENABLED !== 'false',
  },
  mail: {
    host: (process.env.SMTP_HOST || '').trim(),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: (process.env.SMTP_USER || '').trim(),
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'TriLink <noreply@trilink.local>',
    /**
     * Registration emails pick the URL for the new user’s role. Role-specific vars win; each falls back to APP_LOGIN_URL.
     */
    loginUrls: {
      student: (process.env.APP_LOGIN_URL_STUDENT || process.env.APP_LOGIN_URL || '').trim(),
      teacher: (process.env.APP_LOGIN_URL_TEACHER || process.env.APP_LOGIN_URL || '').trim(),
      parent: (process.env.APP_LOGIN_URL_PARENT || process.env.APP_LOGIN_URL || '').trim(),
    },
  },
};
};
