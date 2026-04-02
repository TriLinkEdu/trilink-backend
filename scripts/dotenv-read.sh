#!/usr/bin/env bash
# Parse KEY=value lines from a file without `source` (safe when values contain $ ! ` #).
# shellcheck shell=bash

read_env_value() {
  local key="$1" file="$2" line val
  [[ -f "$file" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^[[:space:]]*${key}=(.*)$ ]]; then
      val="${BASH_REMATCH[1]}"
      val="${val%$'\r'}"
      if [[ "$val" =~ ^\".*\"$ ]]; then val="${val#\"}"; val="${val%\"}"; fi
      if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val#\'}"; val="${val%\'}"; fi
      printf '%s' "$val"
      return 0
    fi
  done < "$file"
  return 1
}

load_env_from_file() {
  local f="$1" k v
  shift
  for k in "$@"; do
    if [[ -z "${!k:-}" ]]; then
      v=$(read_env_value "$k" "$f" 2>/dev/null) || continue
      [[ -z "$v" ]] && continue
      export "$k=$v"
    fi
  done
}

fix_database_url_typo() {
  if [[ "${DATABASE_URL:-}" == ppostgresql://* ]]; then
    DATABASE_URL="postgresql://${DATABASE_URL#ppostgresql://}"
    export DATABASE_URL
    echo "Note: fixed typo ppostgresql → postgresql in DATABASE_URL." >&2
  fi
}

require_database_url() {
  local env_file="$1"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is empty. Set it in ${env_file} (Neon connection string)." >&2
    exit 1
  fi
  fix_database_url_typo
  if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
    echo "DATABASE_URL must start with postgresql:// or postgres://" >&2
    exit 1
  fi
}

# Neon pooler + clients without TLS SNI (pgloader's libpq, old psql): require ?options=endpoint%3D<ep-id>
# See https://neon.tech/docs/connect/connection-errors#the-endpoint-id-is-not-specified
neon_append_endpoint_for_old_libpq() {
  local u="$1"
  [[ "$u" == *neon.tech* ]] || { printf '%s' "$u"; return 0; }
  if [[ "$u" == *options=endpoint* ]] || [[ "$u" == *endpoint%3D* ]]; then
    printf '%s' "$u"
    return 0
  fi
  local hostport host ep
  hostport="$(printf '%s' "$u" | sed -E 's|^[a-zA-Z][a-zA-Z0-9+.-]*://[^@]*@([^/?#]+).*|\1|')"
  [[ -n "$hostport" ]] || { printf '%s' "$u"; return 0; }
  host="${hostport%%:*}"
  ep="${host%%.*}"
  [[ "$ep" == *-pooler ]] && ep="${ep%-pooler}"
  [[ -n "$ep" ]] || { printf '%s' "$u"; return 0; }
  local q="options=endpoint%3D${ep}"
  if [[ "$u" == *\?* ]]; then
    printf '%s&%s' "$u" "$q"
  else
    printf '%s?%s' "$u" "$q"
  fi
}

# Call after require_database_url when using psql / pgloader against Neon.
apply_neon_libpq_endpoint_workaround() {
  local next
  next="$(neon_append_endpoint_for_old_libpq "$DATABASE_URL")"
  if [[ "$next" != "$DATABASE_URL" ]]; then
    DATABASE_URL="$next"
    export DATABASE_URL
    echo "Note: appended Neon's options=endpoint for tools using older libpq (pgloader/psql). https://neon.tech/sni" >&2
  fi
}
