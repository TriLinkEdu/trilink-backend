/**
 * Shared PostgreSQL connection fields for TypeORM (Nest + seed script).
 * Prefer DATABASE_URL from Neon / managed Postgres; otherwise DB_* discrete vars.
 */
export type PostgresConnectionFields = {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  connectTimeoutMS?: number;
  extra?: {
    connectionTimeoutMillis?: number;
    query_timeout?: number;
  };
};

/** Neon often appends channel_binding=require; node-pg can fail to connect with it. */
export function normalizePostgresUrl(url: string): string {
  let trimmed = url.trim();
  if (trimmed.startsWith('ppostgresql://')) {
    trimmed = `postgresql://${trimmed.slice('ppostgresql://'.length)}`;
  }
  try {
    const u = new URL(trimmed);
    u.searchParams.delete('channel_binding');
    let s = u.toString();
    if (s.endsWith('?') || s.endsWith('&')) s = s.slice(0, -1);
    return s;
  } catch {
    return trimmed.replace(/([?&])channel_binding=[^&]*/gi, '$1').replace(/\?&/, '?').replace(/[?&]$/, '');
  }
}

export function getPostgresConnectionFromEnv(): PostgresConnectionFields {
  const useDatabaseUrl = (process.env.DB_USE_DATABASE_URL || 'true').toLowerCase() !== 'false';
  const rawUrl = process.env.DATABASE_URL?.trim();
  const databaseUrl = useDatabaseUrl && rawUrl ? normalizePostgresUrl(rawUrl) : undefined;
  if (databaseUrl) {
    return { 
      url: databaseUrl,
      // Increase timeout for cloud databases
      connectTimeoutMS: 30000,
      extra: {
        connectionTimeoutMillis: 30000,
        query_timeout: 30000,
      }
    };
  }

  const host = process.env.DB_HOST || 'localhost';
  const sslFlag = (process.env.DB_SSL || '').toLowerCase();
  const wantSsl =
    sslFlag === 'true' ||
    sslFlag === '1' ||
    sslFlag === 'require' ||
    host.includes('.neon.tech');

  const ssl = wantSsl
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined;

  return {
    host,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'trilink',
    password: process.env.DB_PASSWORD || 'trilink_secret',
    database: process.env.DB_DATABASE || 'trilink',
    ...(ssl ? { ssl } : {}),
  };
}
