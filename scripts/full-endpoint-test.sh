#!/usr/bin/env bash
# Full endpoint test — hits every endpoint from the remediation work + key existing routes.
# Requires: API running at BASE, admin seeded.
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
PASS="${ADMIN_PASSWORD:-Admin@123}"
RUN_ID="$(date +%s)-$$"
STUDENT_EMAIL="full.student.$RUN_ID@test.trilink.local"
TEACHER_EMAIL="full.teacher.$RUN_ID@test.trilink.local"
_PH_SUFFIX="$(printf '%08d' $(($(date +%s) % 100000000)))"
STUDENT_PHONE="+2519${_PH_SUFFIX}"
TEACHER_PHONE="+2518${_PH_SUFFIX}"
STUDENT_PASS='FullStudent123!'
TEACHER_PASS='FullTeacher123!'
PASSED=0
FAILED=0
FAILURES=""

die() { echo "FAIL: $*" >&2; exit 1; }
ok()  { echo "  OK  $*"; PASSED=$((PASSED+1)); }
fail_soft() { echo "  FAIL $*" >&2; FAILED=$((FAILED+1)); FAILURES="${FAILURES}\n  - $*"; }

code() { curl -sS -o /tmp/ft_body.json -w "%{http_code}" "$@"; }
json_get() { node -p "JSON.parse(require('fs').readFileSync('/tmp/ft_body.json','utf8'))$1" 2>/dev/null; }

expect() {
  local label="$1" expected="$2" got="$3"
  if [[ "$got" == "$expected" ]]; then ok "$label"; else fail_soft "$label (expected $expected, got $got)"; fi
}
expect_one_of() {
  local label="$1"; shift; local got="${!#}"; local args=("${@:1:$#-1}")
  for e in "${args[@]}"; do [[ "$got" == "$e" ]] && { ok "$label"; return; }; done
  fail_soft "$label (expected one of [${args[*]}], got $got)"
}

echo "============================================="
echo " Full Endpoint Test — $(date)"
echo "============================================="

# ---- 1. HEALTH ----
echo ""
echo "=== Health ==="
c=$(code "$BASE/health"); expect "GET /health" "200" "$c"

# ---- 2. AUTH ----
echo ""
echo "=== Auth ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@trilink.edu\",\"password\":\"$PASS\",\"role\":\"admin\"}")
expect_one_of "POST /api/auth/login (admin)" "200" "201" "$c"
ADMIN_TOKEN=$(json_get ".accessToken")
ADMIN_ID=$(json_get ".user.id")
[[ -n "$ADMIN_TOKEN" ]] || die "no admin token"
auth=(-H "Authorization: Bearer $ADMIN_TOKEN")

# Register student
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/auth/register" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STUDENT_EMAIL\",\"firstName\":\"Full\",\"lastName\":\"Student\",\"phone\":\"$STUDENT_PHONE\",\"type\":\"student\",\"grade\":\"10\",\"section\":\"B\",\"tempPassword\":\"$STUDENT_PASS\"}")
expect "POST /api/auth/register (student)" "201" "$c"
STUDENT_ID=$(json_get ".id")

# Register teacher
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/auth/register" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEACHER_EMAIL\",\"firstName\":\"Full\",\"lastName\":\"Teacher\",\"phone\":\"$TEACHER_PHONE\",\"type\":\"teacher\",\"subject\":\"Math\",\"department\":\"Science\",\"tempPassword\":\"$TEACHER_PASS\"}")
expect "POST /api/auth/register (teacher)" "201" "$c"
TEACHER_ID=$(json_get ".id")

# Student login
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STUDENT_EMAIL\",\"password\":\"$STUDENT_PASS\",\"role\":\"student\"}")
expect_one_of "POST /api/auth/login (student)" "200" "201" "$c"
STUDENT_TOKEN=$(json_get ".accessToken")
REFRESH_TOKEN=$(json_get ".refreshToken")
sauth=(-H "Authorization: Bearer $STUDENT_TOKEN")

# Teacher login
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEACHER_EMAIL\",\"password\":\"$TEACHER_PASS\",\"role\":\"teacher\"}")
expect_one_of "POST /api/auth/login (teacher)" "200" "201" "$c"
TEACHER_TOKEN=$(json_get ".accessToken")
tauth=(-H "Authorization: Bearer $TEACHER_TOKEN")

# GET /api/auth/me
c=$(code "${sauth[@]}" "$BASE/api/auth/me")
expect "GET /api/auth/me (student)" "200" "$c"

# POST /api/auth/refresh
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/auth/refresh" \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
expect_one_of "POST /api/auth/refresh" "200" "201" "$c"

# ---- 3. DASHBOARDS ----
echo ""
echo "=== Dashboards ==="
c=$(code "${auth[@]}" "$BASE/api/dashboard/admin"); expect "GET /api/dashboard/admin" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/dashboard/teacher"); expect "GET /api/dashboard/teacher" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/dashboard/student"); expect "GET /api/dashboard/student" "200" "$c"

# ---- 4. SCHOOL STRUCTURE ----
echo ""
echo "=== School Structure ==="
EPOCH="$(date +%s)"
c=$(code "${auth[@]}" "$BASE/api/grades"); expect "GET /api/grades" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/sections"); expect "GET /api/sections" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/subjects"); expect "GET /api/subjects" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/grades" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"FTGrade-$EPOCH\",\"orderIndex\":99}")
expect_one_of "POST /api/grades" "200" "201" "$c"
GRADE_ID=$(json_get ".id")

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/sections" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"FTSec-$EPOCH\"}")
expect_one_of "POST /api/sections" "200" "201" "$c"
SECTION_ID=$(json_get ".id")

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/subjects" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"FTMath-$EPOCH\",\"code\":\"FT$EPOCH\"}")
expect_one_of "POST /api/subjects" "200" "201" "$c"
SUBJECT_ID=$(json_get ".id")

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/grades/$GRADE_ID" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"FTGrade-$EPOCH-v2\"}")
expect "PATCH /api/grades/:id" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/sections/$SECTION_ID" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"FTSec-$EPOCH-v2\"}")
expect "PATCH /api/sections/:id" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/subjects/$SUBJECT_ID" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"FTMath-$EPOCH-v2\"}")
expect "PATCH /api/subjects/:id" "200" "$c"

# ---- 5. ACADEMIC YEARS ----
echo ""
echo "=== Academic Years ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/academic-years" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"label\":\"FT-$EPOCH\",\"startDate\":\"2025-09-01\",\"endDate\":\"2028-06-30\",\"isActive\":true}")
expect_one_of "POST /api/academic-years" "200" "201" "$c"
YEAR_ID=$(json_get ".id")

c=$(code "${auth[@]}" "$BASE/api/academic-years"); expect "GET /api/academic-years" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/academic-years/$YEAR_ID"); expect "GET /api/academic-years/:id" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/academic-years/active"); expect "GET /api/academic-years/active" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/academic-years/$YEAR_ID/terms" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Term1-$EPOCH\",\"startDate\":\"2025-09-01\",\"endDate\":\"2026-01-15\"}")
expect_one_of "POST /api/academic-years/:id/terms" "200" "201" "$c"
TERM_ID=$(json_get ".id")

c=$(code "${auth[@]}" "$BASE/api/academic-years/$YEAR_ID/terms"); expect "GET /api/academic-years/:id/terms" "200" "$c"

# ---- 6. CLASS OFFERINGS ----
echo ""
echo "=== Class Offerings ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/class-offerings" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"academicYearId\":\"$YEAR_ID\",\"gradeId\":\"$GRADE_ID\",\"sectionId\":\"$SECTION_ID\",\"subjectId\":\"$SUBJECT_ID\",\"teacherId\":\"$TEACHER_ID\",\"name\":\"FT class $EPOCH\"}")
expect_one_of "POST /api/class-offerings" "200" "201" "$c"
CLASS_ID=$(json_get ".id")

c=$(code "${auth[@]}" "$BASE/api/class-offerings?academicYearId=$YEAR_ID"); expect "GET /api/class-offerings" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/class-offerings/$CLASS_ID"); expect "GET /api/class-offerings/:id" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/class-offerings/mine?academicYearId=$YEAR_ID"); expect "GET /api/class-offerings/mine" "200" "$c"

# ---- 7. ENROLLMENTS ----
echo ""
echo "=== Enrollments ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/enrollments" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"classOfferingId\":\"$CLASS_ID\",\"academicYearId\":\"$YEAR_ID\"}")
expect_one_of "POST /api/enrollments" "200" "201" "$c"
ENROLLMENT_ID=$(json_get ".id")

c=$(code "${auth[@]}" "$BASE/api/enrollments"); expect "GET /api/enrollments (admin)" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/enrollments?studentId=$STUDENT_ID"); expect "GET /api/enrollments?studentId" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/enrollments/mine"); expect "GET /api/enrollments/mine" "200" "$c"

# ---- 8. ATTENDANCE ----
echo ""
echo "=== Attendance ==="
SESSION_DATE="2099-07-01"
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/attendance-sessions" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"classOfferingId\":\"$CLASS_ID\",\"date\":\"$SESSION_DATE\"}")
expect_one_of "POST /api/attendance-sessions" "200" "201" "$c"
SESSION_ID=$(json_get ".id")

c=$(code "${tauth[@]}" "$BASE/api/attendance-sessions?classOfferingId=$CLASS_ID")
expect "GET /api/attendance-sessions" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PUT "$BASE/api/attendance-sessions/$SESSION_ID/marks" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"marks\":[{\"studentId\":\"$STUDENT_ID\",\"status\":\"present\"}]}")
expect_one_of "PUT /api/attendance-sessions/:id/marks" "200" "201" "$c"

c=$(code "${tauth[@]}" "$BASE/api/attendance-sessions/$SESSION_ID/marks")
expect "GET /api/attendance-sessions/:id/marks" "200" "$c"

c=$(code "${sauth[@]}" "$BASE/api/reports/attendance/student/$STUDENT_ID")
expect "GET /api/reports/attendance/student/:self" "200" "$c"

c=$(code "${tauth[@]}" "$BASE/api/reports/attendance/class/$CLASS_ID")
expect "GET /api/reports/attendance/class/:id" "200" "$c"

# Student cannot access another student
c=$(code "${sauth[@]}" "$BASE/api/reports/attendance/student/00000000-0000-4000-8000-000000000001")
expect "GET attendance/student/:other -> 403" "403" "$c"

# ---- 9. CALENDAR ----
echo ""
echo "=== Calendar ==="
c=$(code "${auth[@]}" "$BASE/api/calendar-events"); expect "GET /api/calendar-events (admin)" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/calendar-events" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"FT event $EPOCH\",\"date\":\"2026-05-01\",\"type\":\"holiday\",\"academicYearId\":\"$YEAR_ID\"}")
expect_one_of "POST /api/calendar-events" "200" "201" "$c"
EVENT_ID=$(json_get ".id")

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/calendar-events/$EVENT_ID" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"title\":\"FT event $EPOCH updated\"}")
expect "PATCH /api/calendar-events/:id" "200" "$c"

c=$(code "${sauth[@]}" "$BASE/api/calendar-events"); expect "GET /api/calendar-events (student)" "200" "$c"

# ---- 10. FEEDBACK ----
echo ""
echo "=== Feedback ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/feedback" \
  "${sauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"category\":\"teaching\",\"message\":\"FT feedback $EPOCH\",\"teacherId\":\"$TEACHER_ID\",\"isAnonymous\":true}")
expect_one_of "POST /api/feedback (anon)" "200" "201" "$c"
FB_ID=$(json_get ".id")

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/feedback" \
  "${sauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"category\":\"facility\",\"message\":\"FT non-anon $EPOCH\",\"isAnonymous\":false}")
expect_one_of "POST /api/feedback (non-anon)" "200" "201" "$c"

c=$(code "${auth[@]}" "$BASE/api/feedback"); expect "GET /api/feedback (admin)" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/feedback/for-teacher"); expect "GET /api/feedback/for-teacher" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/feedback/$FB_ID" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"status\":\"in_progress\"}")
expect "PATCH /api/feedback/:id" "200" "$c"

# ---- 11. ANNOUNCEMENTS ----
echo ""
echo "=== Announcements ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/announcements" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"academicYearId\":\"$YEAR_ID\",\"title\":\"FT announce $EPOCH\",\"body\":\"Hello\",\"audience\":\"all\"}")
expect_one_of "POST /api/announcements (immediate)" "200" "201" "$c"
ANN_ID=$(json_get ".id")

FUTURE="$(node -p "new Date(Date.now()+86400e3*30).toISOString()")"
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/announcements" \
  "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"academicYearId\":\"$YEAR_ID\",\"title\":\"FT scheduled $EPOCH\",\"body\":\"Future\",\"audience\":\"students\",\"publishAt\":\"$FUTURE\"}")
expect_one_of "POST /api/announcements (scheduled)" "200" "201" "$c"
ANN_SCHED_ID=$(json_get ".id")

c=$(code "${auth[@]}" "$BASE/api/announcements"); expect "GET /api/announcements (admin)" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/announcements/for-me"); expect "GET /api/announcements/for-me (student)" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/announcements/$ANN_ID" \
  "${auth[@]}" -H 'Content-Type: application/json' -d "{\"title\":\"FT announce $EPOCH patched\"}")
expect "PATCH /api/announcements/:id" "200" "$c"

# Verify PATCH doesn't overwrite body with undefined
node -e "
const j=require('/tmp/ft_body.json');
if(!j.body || j.body==='undefined') { console.error('PATCH wiped body field'); process.exit(1); }
" || fail_soft "PATCH /api/announcements/:id should not wipe unset fields"
ok "PATCH /api/announcements/:id preserves unset fields"

# ---- 12. NOTIFICATIONS ----
echo ""
echo "=== Notifications ==="
c=$(code "${sauth[@]}" "$BASE/api/notifications"); expect "GET /api/notifications (student)" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/notifications/broadcast" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Test","body":"Hello","audience":"class"}')
expect "POST broadcast without classOfferingId -> 400" "400" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/notifications/broadcast" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Class msg\",\"body\":\"Hi\",\"audience\":\"class\",\"classOfferingId\":\"$CLASS_ID\"}")
expect_one_of "POST /api/notifications/broadcast (class)" "200" "201" "$c"
node -e "const j=require('/tmp/ft_body.json'); if((j.sent|0)<1) process.exit(1);" \
  || fail_soft "broadcast should send to enrolled student"
ok "broadcast sent>=1"

c=$(code "${sauth[@]}" "$BASE/api/notifications"); expect "GET /api/notifications (has broadcast)" "200" "$c"
NOTIF_ID=$(json_get "[0].id")

if [[ -n "$NOTIF_ID" ]]; then
  c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/notifications/$NOTIF_ID/read" "${sauth[@]}")
  expect "PATCH /api/notifications/:id/read" "200" "$c"
fi

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/notifications/read-all" "${sauth[@]}")
expect_one_of "POST /api/notifications/read-all" "200" "201" "$c"

# ---- 13. GAMIFICATION ----
echo ""
echo "=== Gamification ==="
c=$(code "${auth[@]}" "$BASE/api/gamification/badges"); expect "GET /api/gamification/badges" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/gamification/me/badges"); expect "GET /api/gamification/me/badges" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/gamification/me/badge-points"); expect "GET /api/gamification/me/badge-points" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/gamification/me/streak"); expect "GET /api/gamification/me/streak" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/gamification/leaderboard/streaks?limit=5"); expect "GET /api/gamification/leaderboard/streaks" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/gamification/leaderboard/exam-average?academicYearId=$YEAR_ID&limit=5")
expect "GET /api/gamification/leaderboard/exam-average" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/gamification/students/$STUDENT_ID/badges")
expect "GET /api/gamification/students/:id/badges" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/gamification/students/$STUDENT_ID/badge-points")
expect "GET /api/gamification/students/:id/badge-points" "200" "$c"

# NaN limit guard
c=$(code "${auth[@]}" "$BASE/api/gamification/leaderboard/streaks?limit=abc")
expect "GET leaderboard/streaks?limit=abc (NaN guard)" "200" "$c"

# ---- 14. AI ----
echo ""
echo "=== AI ==="
c=$(code "${auth[@]}" "$BASE/api/ai/health"); expect "GET /api/ai/health" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/ai/students/$STUDENT_ID/evaluate"); expect "GET /api/ai/students/:id/evaluate" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/ai/students/$STUDENT_ID/recommendations"); expect "GET /api/ai/students/:id/recommendations" "200" "$c"
c=$(code "${sauth[@]}" "$BASE/api/ai/students/$STUDENT_ID/learning-path"); expect "GET /api/ai/students/:id/learning-path" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/ai/feedback-assistant" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d '{"context":"Draft email about field trip","audience":"teacher"}')
expect_one_of "POST /api/ai/feedback-assistant" "200" "201" "$c"

# ---- 15. CHAT ----
echo ""
echo "=== Chat ==="
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/conversations" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"type\":\"group\",\"title\":\"FT chat $EPOCH\",\"parentVisible\":false,\"memberIds\":[\"$STUDENT_ID\"]}")
expect_one_of "POST /api/conversations" "200" "201" "$c"
CONV_ID=$(json_get ".id")

c=$(code "${tauth[@]}" "$BASE/api/conversations"); expect "GET /api/conversations (teacher)" "200" "$c"

if [[ -n "$CONV_ID" ]]; then
  c=$(code "${tauth[@]}" "$BASE/api/conversations/$CONV_ID"); expect "GET /api/conversations/:id" "200" "$c"

  c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/conversations/$CONV_ID/messages" \
    "${tauth[@]}" -H 'Content-Type: application/json' -d '{"text":"Hello from test"}')
  expect_one_of "POST /api/conversations/:id/messages" "200" "201" "$c"

  c=$(code "${tauth[@]}" "$BASE/api/conversations/$CONV_ID/messages"); expect "GET /api/conversations/:id/messages" "200" "$c"
fi

c=$(code "${auth[@]}" "$BASE/api/conversations/all"); expect "GET /api/conversations/all (admin)" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/conversations/all?take=5&skip=0"); expect "GET /api/conversations/all?take&skip" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/chat/ws-info"); expect "GET /api/chat/ws-info" "200" "$c"

# ---- 16. EXAMS (full lifecycle) ----
echo ""
echo "=== Exams (full lifecycle) ==="
QB=$(node -p "JSON.stringify({type:'mcq',stem:'FT: 3+3?',subjectId:'$SUBJECT_ID',answerKey:'6',optionsJson:JSON.stringify(['5','6'])})")
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/questions" \
  "${tauth[@]}" -H 'Content-Type: application/json' -d "$QB")
expect_one_of "POST /api/questions" "200" "201" "$c"
Q_ID=$(json_get ".id")

c=$(code "${tauth[@]}" "$BASE/api/questions?subjectId=$SUBJECT_ID"); expect "GET /api/questions" "200" "$c"

OPENS="$(node -p "new Date(Date.now()-3600e3).toISOString()")"
CLOSES="$(node -p "new Date(Date.now()+7200e3).toISOString()")"
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/exams" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"FT exam $EPOCH\",\"academicYearId\":\"$YEAR_ID\",\"classOfferingId\":\"$CLASS_ID\",\"opensAt\":\"$OPENS\",\"closesAt\":\"$CLOSES\",\"durationMinutes\":60,\"maxPoints\":100}")
expect_one_of "POST /api/exams" "200" "201" "$c"
EXAM_ID=$(json_get ".id")

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/exams/$EXAM_ID/questions" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"items\":[{\"questionId\":\"$Q_ID\",\"orderIndex\":0,\"points\":100}]}")
expect_one_of "POST /api/exams/:id/questions" "200" "201" "$c"

c=$(code "${tauth[@]}" "$BASE/api/exams/$EXAM_ID/questions"); expect "GET /api/exams/:id/questions" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/exams"); expect "GET /api/exams (teacher)" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/exams/$EXAM_ID/publish" "${tauth[@]}")
expect_one_of "POST /api/exams/:id/publish" "200" "201" "$c"

c=$(code "${sauth[@]}" "$BASE/api/exams?academicYearId=$YEAR_ID"); expect "GET /api/exams (student)" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/exams/$EXAM_ID/attempts" "${sauth[@]}")
expect_one_of "POST /api/exams/:id/attempts" "200" "201" "$c"
ATT_ID=$(json_get ".id")

node -e "const fs=require('fs'); fs.writeFileSync('/tmp/ft_ans.json', JSON.stringify({answersJson: JSON.stringify({['$Q_ID']:'6'})}));" 
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/attempts/$ATT_ID/answers" \
  "${sauth[@]}" -H 'Content-Type: application/json' -d @/tmp/ft_ans.json)
expect_one_of "POST /api/attempts/:id/answers" "200" "201" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/attempts/$ATT_ID/submit" "${sauth[@]}")
expect_one_of "POST /api/attempts/:id/submit" "200" "201" "$c"

c=$(code "${tauth[@]}" "$BASE/api/exams/$EXAM_ID/attempts"); expect "GET /api/exams/:id/attempts (grading queue)" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/attempts/$ATT_ID/for-grader"); expect "GET /api/attempts/:id/for-grader" "200" "$c"
c=$(code "${tauth[@]}" "$BASE/api/exams/$EXAM_ID/students"); expect "GET /api/exams/:id/students" "200" "$c"

c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/attempts/$ATT_ID/release" "${tauth[@]}")
expect_one_of "POST /api/attempts/:id/release" "200" "201" "$c"

c=$(code "${sauth[@]}" "$BASE/api/attempts/$ATT_ID/result"); expect "GET /api/attempts/:id/result" "200" "$c"

# ---- 17. REPORTS ----
echo ""
echo "=== Reports ==="
c=$(code "${sauth[@]}" "$BASE/api/reports/my-grades"); expect "GET /api/reports/my-grades" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/reports/students/$STUDENT_ID/performance")
expect "GET /api/reports/students/:id/performance" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/reports/students/$STUDENT_ID/compare?period1Start=2025-01-01&period1End=2026-06-01&period2Start=2026-06-02&period2End=2027-01-01")
expect "GET /api/reports/students/:id/compare" "200" "$c"

# ---- 18. USERS ----
echo ""
echo "=== Users ==="
c=$(code "${auth[@]}" "$BASE/api/users"); expect "GET /api/users (admin)" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/users/$STUDENT_ID"); expect "GET /api/users/:id" "200" "$c"

# ---- 19. SETTINGS ----
echo ""
echo "=== Settings ==="
c=$(code "${sauth[@]}" "$BASE/api/me/settings"); expect "GET /api/me/settings" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/school/settings"); expect "GET /api/school/settings" "200" "$c"

# ---- 20. INTEGRATIONS & ANALYTICS ----
echo ""
echo "=== Integrations & Analytics ==="
c=$(code "${auth[@]}" "$BASE/api/integrations/status"); expect "GET /api/integrations/status" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/integrations/sync-hints"); expect "GET /api/integrations/sync-hints" "200" "$c"
c=$(code "${auth[@]}" "$BASE/api/analytics/admin/summary"); expect "GET /api/analytics/admin/summary" "200" "$c"

# ---- 21. AUDIT LOGS ----
echo ""
echo "=== Audit ==="
c=$(code "${auth[@]}" "$BASE/api/audit-logs"); expect "GET /api/audit-logs" "200" "$c"

# ---- 22. GOALS ----
echo ""
echo "=== Goals ==="
c=$(code "${sauth[@]}" "$BASE/api/goals/me"); expect "GET /api/goals/me" "200" "$c"
c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X POST "$BASE/api/goals/me" \
  "${sauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"FT goal $EPOCH\",\"description\":\"Test goal\"}")
expect_one_of "POST /api/goals/me" "200" "201" "$c"
GOAL_ID=$(json_get ".id" 2>/dev/null || echo "")

if [[ -n "$GOAL_ID" ]]; then
  c=$(curl -sS -o /tmp/ft_body.json -w "%{http_code}" -X PATCH "$BASE/api/goals/$GOAL_ID" \
    "${sauth[@]}" -H 'Content-Type: application/json' -d "{\"title\":\"FT goal $EPOCH updated\"}")
  expect "PATCH /api/goals/:id" "200" "$c"
fi

# ---- 23. STUDENT PROFILES ----
echo ""
echo "=== Student Profiles ==="
c=$(code "${sauth[@]}" "$BASE/api/student-profiles/me"); expect "GET /api/student-profiles/me" "200" "$c"

# ---- SUMMARY ----
echo ""
echo "============================================="
echo " RESULTS: $PASSED passed, $FAILED failed"
echo "============================================="
if [[ $FAILED -gt 0 ]]; then
  echo -e "Failures:$FAILURES"
  exit 1
fi
echo "All endpoints passed!"
