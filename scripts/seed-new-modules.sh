#!/usr/bin/env bash
# Seed data for new modules: topics, learning-materials, assignments, grades.
# Reuses users/classes from scripts/demo-credentials.txt.
#
# Run: BASE=http://localhost:4000 bash scripts/seed-new-modules.sh
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@trilink.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
DEMO_PASS="Demo@123"
CREDS="$(dirname "$0")/demo-credentials.txt"

PJ() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }

login() {  # email password role -> token
  curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"role\":\"$3\"}" | PJ '["accessToken"]'
}

api() {  # METHOD PATH TOKEN BODY
  local method=$1 path=$2 token=$3 body=${4:-}
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$BASE$path" -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -sS -X "$method" "$BASE$path" -H "Authorization: Bearer $token"
  fi
}

echo "→ Admin login"
ADMIN_TOK=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" admin)
[[ -n "$ADMIN_TOK" ]] || { echo "admin login failed"; exit 1; }

echo "→ Active academic year"
YEAR_ID=$(api GET /api/academic-years/active "$ADMIN_TOK" | PJ '["data"]["id"]')
echo "  year=$YEAR_ID"

echo "→ List class offerings"
CO_JSON=$(api GET "/api/class-offerings?academicYearId=$YEAR_ID" "$ADMIN_TOK")
# Each offering: { id, subjectId, gradeId, sectionId, teacherId, name, ... }
mapfile -t OFFERINGS < <(echo "$CO_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for o in d:
  print(f\"{o['id']}|{o['subjectId']}|{o['teacherId']}|{o.get('name','')}\")")
echo "  ${#OFFERINGS[@]} offerings"

# Build email lookup from creds file: name -> email
declare -A TEACHER_EMAIL STUDENT_EMAIL
while IFS='|' read -r email pass name rest; do
  email=$(echo "$email" | xargs); name=$(echo "$name" | xargs)
  case "$rest" in
    *teaches*) TEACHER_EMAIL["$name"]="$email" ;;
    *Grade*)   STUDENT_EMAIL["$name"]="$email" ;;
  esac
done < <(grep -E '\| Demo@123' "$CREDS")

# Get teacher email by their user id (via /api/users/:id)
get_teacher_token_by_id() {
  local tid=$1
  local email=$(api GET "/api/users/$tid" "$ADMIN_TOK" | PJ '["email"]')
  login "$email" "$DEMO_PASS" teacher
}

# Topics: one or two per subject (idempotent: skip if already exists)
echo "→ Topics"
declare -A SUBJECT_TOPIC
for row in "${OFFERINGS[@]}"; do
  IFS='|' read -r co_id sub_id t_id name <<< "$row"
  [[ -n "${SUBJECT_TOPIC[$sub_id]:-}" ]] && continue
  resp=$(api POST /api/topics "$ADMIN_TOK" \
    "{\"name\":\"Foundations\",\"description\":\"Core concepts and review\",\"subjectId\":\"$sub_id\",\"orderIndex\":0}")
  topic_id=$(echo "$resp" | PJ '["id"]' 2>/dev/null || echo "")
  if [[ -n "$topic_id" ]]; then
    SUBJECT_TOPIC[$sub_id]="$topic_id"
    api POST /api/topics "$ADMIN_TOK" \
      "{\"name\":\"Advanced topics\",\"description\":\"Deeper material\",\"subjectId\":\"$sub_id\",\"orderIndex\":1}" >/dev/null
    echo "  + topics for subject $sub_id"
  else
    echo "  ! topic create failed for $sub_id: $resp"
  fi
done

# Learning materials: one LINK per offering (no file upload needed)
echo "→ Learning materials"
for row in "${OFFERINGS[@]}"; do
  IFS='|' read -r co_id sub_id t_id name <<< "$row"
  topic_id=${SUBJECT_TOPIC[$sub_id]:-}
  body="{\"title\":\"Khan Academy intro for $name\",\"type\":\"link\",\"subject\":\"$name\",\"grade\":9,\"description\":\"External video lesson\",\"classOfferingId\":\"$co_id\",\"link\":\"https://www.khanacademy.org/\""
  [[ -n "$topic_id" ]] && body="$body,\"topicId\":\"$topic_id\""
  body="$body}"
  ttok=$(get_teacher_token_by_id "$t_id")
  resp=$(api POST /api/learning-materials "$ttok" "$body")
  echo "  + material: $(echo "$resp" | PJ '["id"]' 2>/dev/null || echo "FAILED $resp")"
done

# Assignments: one per offering, published, with student submissions + grading
echo "→ Assignments + submissions + grading"
DEADLINE=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(days=14)).isoformat()+'Z')")
for row in "${OFFERINGS[@]}"; do
  IFS='|' read -r co_id sub_id t_id name <<< "$row"
  ttok=$(get_teacher_token_by_id "$t_id")

  body="{\"classOfferingId\":\"$co_id\",\"title\":\"Homework: $name basics\",\"description\":\"Write a 100-word reflection on what you learned this week.\",\"submissionType\":\"text\",\"deadline\":\"$DEADLINE\",\"maxScore\":100}"
  a_id=$(api POST /api/assignments "$ttok" "$body" | PJ '["id"]')
  api POST "/api/assignments/$a_id/publish" "$ttok" >/dev/null
  echo "  + assignment $a_id ($name)"

  # Find enrolled students of this class
  enrolled=$(api GET "/api/enrollments/class/$co_id/students" "$ADMIN_TOK")
  mapfile -t STUDENTS_OF_CLASS < <(echo "$enrolled" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('items',d.get('data',[]))
for s in items:
  sid=s.get('studentId') or s.get('id') or s.get('user',{}).get('id')
  email=s.get('email') or s.get('user',{}).get('email')
  if sid and email: print(f'{sid}|{email}')
")

  i=0
  for s in "${STUDENTS_OF_CLASS[@]}"; do
    IFS='|' read -r sid semail <<< "$s"
    stok=$(login "$semail" "$DEMO_PASS" student)
    [[ -z "$stok" ]] && continue
    # Submit text response
    api POST "/api/assignments/$a_id/submit" "$stok" \
      "{\"textContent\":\"This is my reflection submission for $name. I learned about the foundations of the subject.\"}" >/dev/null
    # Grade the submission (find submission id)
    subs=$(api GET "/api/assignments/$a_id/submissions" "$ttok")
    sub_id=$(echo "$subs" | python3 -c "
import sys,json
d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('items',d.get('data',[]))
for x in items:
  if x.get('studentId')=='$sid':
    print(x.get('id')); break
")
    if [[ -n "$sub_id" ]]; then
      score=$((85 + RANDOM % 15))   # 85..99
      api POST "/api/assignments/submissions/$sub_id/grade" "$ttok" \
        "{\"score\":$score,\"feedback\":\"Good work — clear writing.\"}" >/dev/null
    fi
    i=$((i+1))
    [[ $i -ge 2 ]] && break  # 2 submissions per class is enough to demo
  done
  api POST "/api/assignments/$a_id/release-all" "$ttok" >/dev/null || true
done

# Bulk manual grades (Quiz 1 entries) per class
echo "→ Bulk manual grade entries"
for row in "${OFFERINGS[@]}"; do
  IFS='|' read -r co_id sub_id t_id name <<< "$row"
  ttok=$(get_teacher_token_by_id "$t_id")
  enrolled=$(api GET "/api/enrollments/class/$co_id/students" "$ADMIN_TOK")
  entries=$(echo "$enrolled" | python3 -c "
import sys,json,random
d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('items',d.get('data',[]))
out=[]
for s in items:
  sid=s.get('studentId') or s.get('id') or s.get('user',{}).get('id')
  if sid: out.append({'studentId':sid,'score':random.randint(60,100)})
import json as J; print(J.dumps(out))
")
  body="{\"classOfferingId\":\"$co_id\",\"title\":\"Quiz 1\",\"type\":\"quiz\",\"maxScore\":100,\"note\":\"Term opener quiz\",\"entries\":$entries}"
  api POST /api/grades/bulk "$ttok" "$body" >/dev/null && echo "  + Quiz 1 grades for $name"
  api POST /api/grades/release "$ttok" \
    "{\"classOfferingId\":\"$co_id\",\"title\":\"Quiz 1\"}" >/dev/null || true
done

echo
echo "== Done =="
echo "New module data is now in the DB:"
echo "  - Topics (per subject)"
echo "  - Learning materials (1 link per class)"
echo "  - Assignments (1 per class, published, with 2 graded submissions)"
echo "  - Bulk grade entries (Quiz 1, released)"
