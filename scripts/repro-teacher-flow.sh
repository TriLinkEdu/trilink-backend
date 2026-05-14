#!/usr/bin/env bash
set -euo pipefail
BASE="http://localhost:4000"
EMAIL="abebe.bekele+t1777047185@demo.trilink.local"
PASS="Demo@123"

LOGIN=$(curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"role\":\"teacher\"}")
TOKEN=$(printf '%s' "$LOGIN" | jq -r '.token // .accessToken // empty')
if [[ -z "$TOKEN" ]]; then
  echo "LOGIN_FAILED"
  echo "$LOGIN"
  exit 1
fi

echo "LOGIN_OK"
AY_CODE=$(curl -sS -o /tmp/ay.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/academic-years/active")
echo "ACTIVE_YEAR:$AY_CODE"
cat /tmp/ay.json | jq -c '.'
YEAR_ID=$(jq -r '.id // .data.id // empty' /tmp/ay.json)

if [[ -n "$YEAR_ID" ]]; then
  TERMS_CODE=$(curl -sS -o /tmp/terms.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/academic-years/$YEAR_ID/terms")
  echo "TERMS:$TERMS_CODE"
  cat /tmp/terms.json | jq -c '.'

  MINE_CODE=$(curl -sS -o /tmp/mine.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/class-offerings/mine?academicYearId=$YEAR_ID")
  echo "MINE_CLASSES:$MINE_CODE"
  cat /tmp/mine.json | jq -c '.'

  COID=$(jq -r '.[0].id // .data[0].id // empty' /tmp/mine.json)
  if [[ -n "$COID" ]]; then
    ATT_CODE=$(curl -sS -o /tmp/att.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/attendance-sessions?classOfferingId=$COID")
    echo "ATTENDANCE:$ATT_CODE"
    cat /tmp/att.json | jq -c '.'
  else
    echo "NO_CLASS_OFFERINGS"
  fi
fi
