#!/usr/bin/env node
/**
 * Build a Postgres URI for pgloader's INTO line. Pgloader's parser rejects `%` in URIs
 * (breaks on %26, %3D, etc.). Neon + old libpq needs the endpoint id; use the password-field
 * trick so the query string stays `?sslmode=require` only (no & / %).
 * @see https://neon.tech/docs/connect/connection-errors#the-endpoint-id-is-not-specified
 */
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

let u;
try {
  u = new URL(raw);
} catch {
  console.error('Invalid DATABASE_URL');
  process.exit(1);
}

const host = u.hostname || '';
const port = u.port || '5432';
const db = (u.pathname || '/').replace(/^\//, '') || 'postgres';
const sslmode = u.searchParams.get('sslmode') || 'require';

const user = decodeURIComponent(u.username || '');
let password = decodeURIComponent(u.password || '');

if (!user) {
  console.error('DATABASE_URL must include a username');
  process.exit(1);
}

if (host.includes('neon.tech')) {
  let ep = host.split('.')[0];
  if (ep.endsWith('-pooler')) ep = ep.slice(0, -7);
  const sep = password.includes('$') ? ';' : '$';
  password = `endpoint=${ep}${sep}${password}`;
}

if (/[@:/]/.test(user) || /[@:/]/.test(password)) {
  console.error(
    'Username or password contains @ or : which breaks the pgloader URI line; use credentials without those characters for this path, or use pg_dump|psql.',
  );
  process.exit(1);
}

// Manual URI — do not use URL.href (it percent-encodes = and ; in password).
const out = `postgresql://${user}:${password}@${host}:${port}/${db}?sslmode=${sslmode}`;

if (out.includes('%')) {
  console.error(
    'Built connection string contains %; pgloader may fail. Use a Neon password without special URL characters, or migrate with pg_dump/psql instead.',
  );
  process.exit(1);
}

console.log(out);
