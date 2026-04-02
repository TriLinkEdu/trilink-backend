#!/usr/bin/env bash
# Copy a local PostgreSQL database into Neon (or any remote Postgres URL).
#
# Prerequisites:
#   - PostgreSQL client tools: pg_dump and psql (e.g. apt install postgresql-client)
#   - Local DB reachable (Docker Postgres on host port 5433 by default)
#   - .env: DATABASE_URL = Neon; local source = DB_* (default localhost:5433) or LOCAL_DATABASE_URL
#
# Usage (from repo root):
#   chmod +x scripts/push-local-pg-to-neon.sh
#   ./scripts/push-local-pg-to-neon.sh           # schema + data (Neon must be empty, or you get "already exists")
#   ./scripts/push-local-pg-to-neon.sh clean     # DROP + recreate + data (overwrites Neon objects; destructive)
#   ./scripts/push-local-pg-to-neon.sh data-only # rows only (schema already on Neon and matches local)
#   ./scripts/push-local-pg-to-neon.sh schema-only
#
# Loads vars from .env without `source` so passwords with $ ! ` # do not break bash.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=dotenv-read.sh
source "$SCRIPT_DIR/dotenv-read.sh"

ENV_FILE="$ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  load_env_from_file "$ENV_FILE" \
    DATABASE_URL LOCAL_DATABASE_URL \
    DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE
fi

MODE="${1:-full}"
case "$MODE" in
  full) DUMP_EXTRA=() ;;
  clean) DUMP_EXTRA=(--clean --if-exists) ;;
  data-only) DUMP_EXTRA=(--data-only) ;;
  schema-only) DUMP_EXTRA=(--schema-only) ;;
  *)
    echo "Usage: $0 [full|clean|data-only|schema-only]" >&2
    echo "  full        — empty Neon only (or ERROR: relation already exists)" >&2
    echo "  clean       — drop objects on Neon first, then load full dump (replaces)" >&2
    echo "  data-only   — copy rows only (same schema as local)" >&2
    exit 1
    ;;
esac

require_database_url "$ENV_FILE"
apply_neon_libpq_endpoint_workaround
# If psql fails with channel_binding, remove that query param from the Neon URL.

export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-30}"

echo "Dumping local ($MODE) → Neon"
if [[ "$MODE" == clean ]]; then
  echo "WARNING: clean mode drops matching objects on Neon before restore." >&2
fi
echo "Neon: DATABASE_URL from .env (host hidden). This step is usually silent until it finishes."

# libpq uses PGHOST/PGPORT/… when set — even with psql "$DATABASE_URL". Unset for Neon so DB_PORT=5433 (local Docker) never hits Neon.
psql_neon() {
  env -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE \
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
}

echo "Streaming pg_dump → psql… (no progress lines; large DBs can take several minutes. Ctrl+C to abort.)"

if [[ -n "${LOCAL_DATABASE_URL:-}" ]]; then
  pg_dump \
    --no-owner \
    --no-acl \
    "${DUMP_EXTRA[@]}" \
    "$LOCAL_DATABASE_URL" \
    | psql_neon
else
  L_HOST="${DB_HOST:-localhost}"
  L_PORT="${DB_PORT:-5433}"
  L_USER="${DB_USERNAME:-trilink}"
  L_PASS="${DB_PASSWORD:-trilink_secret}"
  L_DB="${DB_DATABASE:-trilink}"
  echo "Source: ${L_USER}@${L_HOST}:${L_PORT}/${L_DB} (override with LOCAL_DATABASE_URL=... in .env)"
  if command -v pg_isready >/dev/null 2>&1; then
    if ! pg_isready -h "$L_HOST" -p "$L_PORT" -U "$L_USER" -d "$L_DB" -t 5 >/dev/null 2>&1; then
      echo "Local Postgres is not accepting connections at ${L_HOST}:${L_PORT}." >&2
      echo "Start it, e.g.: docker compose up -d db" >&2
      exit 1
    fi
  fi
  (
    export PGHOST="$L_HOST" PGPORT="$L_PORT" PGUSER="$L_USER" PGPASSWORD="$L_PASS" PGDATABASE="$L_DB"
    pg_dump \
      --no-owner \
      --no-acl \
      "${DUMP_EXTRA[@]}"
  ) | psql_neon
fi

echo "Done."
