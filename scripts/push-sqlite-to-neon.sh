#!/usr/bin/env bash
# Load a local SQLite file (TypeORM file DB) into Neon / Postgres using pgloader.
#
# Prerequisites:
#   sudo apt install -y pgloader
#   .env: DATABASE_URL = Neon; DB_SQLITE_PATH = path to .sqlite (default data/trilink.sqlite under repo root)
#
# Usage (from repo root):
#   ./scripts/push-sqlite-to-neon.sh                    # with-drop: drops conflicting Neon objects, then load
#   ./scripts/push-sqlite-to-neon.sh data-only          # rows only (Postgres schema must already match SQLite)
#   ./scripts/push-sqlite-to-neon.sh with-drop /path/db.sqlite
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=dotenv-read.sh
source "$SCRIPT_DIR/dotenv-read.sh"

ENV_FILE="$ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  load_env_from_file "$ENV_FILE" DATABASE_URL DB_SQLITE_PATH
fi

MODE="with-drop"
SQLITE_PATH=""
for a in "$@"; do
  if [[ "$a" == with-drop ]] || [[ "$a" == data-only ]]; then
    MODE="$a"
  elif [[ -f "$a" ]]; then
    SQLITE_PATH="$(readlink -f "$a" 2>/dev/null || realpath "$a" 2>/dev/null || echo "$ROOT/$a")"
  fi
done

if [[ -z "$SQLITE_PATH" ]]; then
  REL="${DB_SQLITE_PATH:-data/trilink.sqlite}"
  if [[ "$REL" == /* ]]; then
    SQLITE_PATH="$REL"
  else
    SQLITE_PATH="$ROOT/$REL"
  fi
fi

if [[ ! -f "$SQLITE_PATH" ]]; then
  echo "SQLite file not found: $SQLITE_PATH" >&2
  echo "Create one with DB_TYPE=sqlite and DB_SQLITE_PATH in .env, run the API once, or pass the file path." >&2
  exit 1
fi

require_database_url "$ENV_FILE"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to build a pgloader-safe Postgres URL (no %% in the INTO line)." >&2
  exit 1
fi

if ! command -v pgloader >/dev/null 2>&1; then
  echo "pgloader is not installed. On Debian/Ubuntu:" >&2
  echo "  sudo apt install -y pgloader" >&2
  exit 1
fi

case "$MODE" in
  with-drop)
    WITH_CLAUSE="include drop, create tables, create indexes, reset sequences"
    echo "Mode: with-drop (Neon objects from this load will be dropped first — destructive)." >&2
    ;;
  data-only)
    WITH_CLAUSE="data only"
    echo "Mode: data-only (Postgres must already have matching tables)." >&2
    ;;
  *)
    echo "Usage: $0 [with-drop|data-only] [path/to/file.sqlite]" >&2
    exit 1
    ;;
esac

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# sqlite:///absolute/path — path must be absolute for pgloader
SQLITE_URI="sqlite:///${SQLITE_PATH#/}"

# Pgloader rejects %% in URIs; Neon options=endpoint%%3D… adds %%. Use endpoint in password (Neon-supported).
PGLOADER_INTO_URL="$(DATABASE_URL="$DATABASE_URL" node "$SCRIPT_DIR/build-pgloader-postgres-into-url.cjs")"
{
  printf '%s\n' "LOAD DATABASE"
  printf '%s\n' "     FROM ${SQLITE_URI}"
  printf '     INTO %s\n' "$PGLOADER_INTO_URL"
  printf '%s\n' ""
  printf '%s\n' " WITH ${WITH_CLAUSE};"
} > "$TMP"

echo "SQLite: $SQLITE_PATH"
echo "Running pgloader (see its log output)…"

pgloader "$TMP"

echo "Done."
