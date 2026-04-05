#!/usr/bin/env bash
# Smoke test for TriLink API (run with API at BASE, admin seeded).
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
PASS="${ADMIN_PASSWORD:-Admin@123}"
RUN_ID="$(date +%s)-$$"
STUDENT_EMAIL="smoke.student.$RUN_ID@test.trilink.local"
TEACHER_EMAIL="smoke.teacher.$RUN_ID@test.trilink.local"
# Unique phones: normalized value must match /^\+?[1-9]\d{8,14}$/ (9–15 digits total).
_PH_SUFFIX="$(printf '%08d' $(($(date +%s) % 100000000)))"
STUDENT_PHONE="+2519${_PH_SUFFIX}"
TEACHER_PHONE="+2518${_PH_SUFFIX}"
STUDENT_PASS='SmokeStudent123!'
TEACHER_PASS='SmokeTeacher123!'

die() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK  $*"; }

code() { curl -sS -o /tmp/smoke_body.json -w "%{http_code}" "$@"; }

json_get() { node -p "JSON.parse(require('fs').readFileSync('/tmp/smoke_body.json','utf8'))$1" 2>/dev/null; }

echo "=== Health ==="
h=$(code "$BASE/health") || true
[[ "$h" == "200" ]] || die "health expected 200 got $h"
ok "GET /health"

echo "=== Admin login ==="
code=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@trilink.edu\",\"password\":\"$PASS\",\"role\":\"admin\"}")
[[ "$code" == "200" || "$code" == "201" ]] || die "admin login $code: $(cat /tmp/smoke_body.json)"
ADMIN_TOKEN=$(json_get ".accessToken")
[[ -n "$ADMIN_TOKEN" ]] || die "no admin token"
ok "POST /api/auth/login (admin)"

auth_hdr=(-H "Authorization: Bearer $ADMIN_TOKEN")

echo "=== Admin endpoints (remediation plan) ==="
c=$(code "${auth_hdr[@]}" "$BASE/api/dashboard/admin")
[[ "$c" == "200" ]] || die "dashboard/admin $c"
grep -q "schoolAttendanceRateLast30Days" /tmp/smoke_body.json || die "dashboard/admin missing schoolAttendanceRateLast30Days"
grep -q "feedbackByStatus" /tmp/smoke_body.json || die "dashboard/admin missing feedbackByStatus"
ok "GET /api/dashboard/admin (enriched)"

c=$(code "${auth_hdr[@]}" "$BASE/api/feedback")
[[ "$c" == "200" ]] || die "feedback list $c"
ok "GET /api/feedback"

c=$(code "${auth_hdr[@]}" "$BASE/api/conversations/all")
[[ "$c" == "200" ]] || die "conversations/all $c"
ok "GET /api/conversations/all"

c=$(code "${auth_hdr[@]}" "$BASE/api/calendar-events")
[[ "$c" == "200" ]] || die "calendar-events $c"
ok "GET /api/calendar-events"

c=$(code "${auth_hdr[@]}" "$BASE/api/gamification/me/streak")
[[ "$c" == "200" ]] || die "gamification/me/streak $c"
ok "GET /api/gamification/me/streak"

c=$(code "${auth_hdr[@]}" "$BASE/api/gamification/leaderboard/streaks?limit=5")
[[ "$c" == "200" ]] || die "leaderboard/streaks $c"
ok "GET /api/gamification/leaderboard/streaks"

c=$(code "${auth_hdr[@]}" "$BASE/api/ai/health")
[[ "$c" == "200" ]] || die "ai/health $c"
ok "GET /api/ai/health"

echo "=== Register student + teacher ==="
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/auth/register" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STUDENT_EMAIL\",\"firstName\":\"Smoke\",\"lastName\":\"Student\",\"phone\":\"$STUDENT_PHONE\",\"type\":\"student\",\"grade\":\"9\",\"section\":\"A\",\"tempPassword\":\"$STUDENT_PASS\"}")
[[ "$c" == "201" ]] || die "register student $c $(cat /tmp/smoke_body.json)"
STUDENT_ID=$(json_get ".id")
[[ -n "$STUDENT_ID" ]] || die "no student id"
ok "POST /api/auth/register student"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/auth/register" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEACHER_EMAIL\",\"firstName\":\"Smoke\",\"lastName\":\"Teacher\",\"phone\":\"$TEACHER_PHONE\",\"type\":\"teacher\",\"subject\":\"Math\",\"department\":\"Science\",\"tempPassword\":\"$TEACHER_PASS\"}")
[[ "$c" == "201" ]] || die "register teacher $c $(cat /tmp/smoke_body.json)"
TEACHER_ID=$(json_get ".id")
[[ -n "$TEACHER_ID" ]] || die "no teacher id"
ok "POST /api/auth/register teacher"

echo "=== Student login & student APIs ==="
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STUDENT_EMAIL\",\"password\":\"$STUDENT_PASS\",\"role\":\"student\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "student login $c"
STUDENT_TOKEN=$(json_get ".accessToken")
sauth=(-H "Authorization: Bearer $STUDENT_TOKEN")

c=$(code "${sauth[@]}" "$BASE/api/dashboard/student")
[[ "$c" == "200" ]] || die "dashboard/student $c $(cat /tmp/smoke_body.json)"
grep -q "attendanceSummaryLast30Days\|upcomingExams\|recentNotifications\|testsTaken" /tmp/smoke_body.json || die "student dashboard not enriched"
ok "GET /api/dashboard/student (enriched)"

c=$(code "${sauth[@]}" "$BASE/api/enrollments/mine")
[[ "$c" == "200" ]] || die "enrollments/mine $c"
ok "GET /api/enrollments/mine"

c=$(code "${sauth[@]}" "$BASE/api/reports/my-grades")
[[ "$c" == "200" ]] || die "reports/my-grades $c"
ok "GET /api/reports/my-grades"

c=$(code "${sauth[@]}" "$BASE/api/calendar-events")
[[ "$c" == "200" ]] || die "student calendar-events $c"
ok "GET /api/calendar-events (student)"

c=$(code "${sauth[@]}" "$BASE/api/ai/students/$STUDENT_ID/evaluate")
[[ "$c" == "200" ]] || die "ai/evaluate $c"
ok "GET /api/ai/students/:id/evaluate"

echo "=== Feedback anonymous (student -> teacher) ==="
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/feedback" \
  "${sauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"category\":\"teaching\",\"message\":\"Great class\",\"teacherId\":\"$TEACHER_ID\",\"isAnonymous\":true}")
[[ "$c" == "200" || "$c" == "201" ]] || die "feedback create $c $(cat /tmp/smoke_body.json)"
ok "POST /api/feedback (anonymous)"

echo "=== Teacher feedback inbox ==="
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEACHER_EMAIL\",\"password\":\"$TEACHER_PASS\",\"role\":\"teacher\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "teacher login $c"
TEACHER_TOKEN=$(json_get ".accessToken")
tauth=(-H "Authorization: Bearer $TEACHER_TOKEN")

c=$(code "${tauth[@]}" "$BASE/api/feedback/for-teacher")
[[ "$c" == "200" ]] || die "feedback/for-teacher $c"
grep -q "teacherId\|message\|isAnonymous" /tmp/smoke_body.json || die "for-teacher response shape"
ok "GET /api/feedback/for-teacher"

echo "=== Happy path: year → structure → class → enroll → attendance → exam ==="
EPOCH="$(date +%s)"
SMOKE_SESSION_DATE="2099-06-15"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/academic-years" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"label\":\"Smoke-$EPOCH\",\"startDate\":\"2025-09-01\",\"endDate\":\"2028-06-30\",\"isActive\":true}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create academic year $c $(cat /tmp/smoke_body.json)"
YEAR_ID=$(json_get ".id")
[[ -n "$YEAR_ID" ]] || die "no academic year id"
ok "POST /api/academic-years"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/grades" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"SmokeG-$EPOCH\",\"orderIndex\":99}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create grade $c $(cat /tmp/smoke_body.json)"
GRADE_ID=$(json_get ".id")
ok "POST /api/grades"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/sections" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"SmokeS-$EPOCH\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create section $c $(cat /tmp/smoke_body.json)"
SECTION_ID=$(json_get ".id")
ok "POST /api/sections"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/subjects" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"SmokeMath-$EPOCH\",\"code\":\"SM$EPOCH\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create subject $c $(cat /tmp/smoke_body.json)"
SUBJECT_ID=$(json_get ".id")
ok "POST /api/subjects"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/class-offerings" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"academicYearId\":\"$YEAR_ID\",\"gradeId\":\"$GRADE_ID\",\"sectionId\":\"$SECTION_ID\",\"subjectId\":\"$SUBJECT_ID\",\"teacherId\":\"$TEACHER_ID\",\"name\":\"Smoke class $EPOCH\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create class-offering $c $(cat /tmp/smoke_body.json)"
CLASS_ID=$(json_get ".id")
[[ -n "$CLASS_ID" ]] || die "no class offering id"
ok "POST /api/class-offerings"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/enrollments" \
  "${auth_hdr[@]}" -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"$STUDENT_ID\",\"classOfferingId\":\"$CLASS_ID\",\"academicYearId\":\"$YEAR_ID\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create enrollment $c $(cat /tmp/smoke_body.json)"
ok "POST /api/enrollments"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/attendance-sessions" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"classOfferingId\":\"$CLASS_ID\",\"date\":\"$SMOKE_SESSION_DATE\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create attendance session $c $(cat /tmp/smoke_body.json)"
SESSION_ID=$(json_get ".id")
[[ -n "$SESSION_ID" ]] || die "no session id"
ok "POST /api/attendance-sessions (teacher owns class)"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X PUT "$BASE/api/attendance-sessions/$SESSION_ID/marks" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"marks\":[{\"studentId\":\"$STUDENT_ID\",\"status\":\"present\"}]}")
[[ "$c" == "200" || "$c" == "201" ]] || die "put attendance marks $c $(cat /tmp/smoke_body.json)"
ok "PUT /api/attendance-sessions/:id/marks"

c=$(code "${sauth[@]}" "$BASE/api/reports/attendance/student/$STUDENT_ID")
[[ "$c" == "200" ]] || die "student own attendance report $c"
node -e "
const j=require('/tmp/smoke_body.json');
const n=(j.marks||[]).length;
if(n<1){console.error('expected marks on attendance report'); process.exit(1);}
const hit=(j.marks||[]).some(m=>m.sessionDate==='$SMOKE_SESSION_DATE'&&m.status==='present');
if(!hit){console.error('expected present mark for smoke session'); process.exit(1);}
" || die "attendance report payload"
ok "GET /api/reports/attendance/student/:self (has present mark)"

c=$(code "${sauth[@]}" "$BASE/api/enrollments/mine")
[[ "$c" == "200" ]] || die "enrollments/mine after enroll $c"
node -e "
const j=require('/tmp/smoke_body.json');
if(!Array.isArray(j)||j.length<1) process.exit(1);
const ok=j.some(r=>r.classOfferingId==='$CLASS_ID');
if(!ok) process.exit(1);
" || die "enrollments/mine should list smoke class"
ok "GET /api/enrollments/mine (includes smoke class)"

QB=$(node -p "JSON.stringify({type:'mcq',stem:'Smoke: 2+2?',subjectId:'$SUBJECT_ID',answerKey:'4',optionsJson:JSON.stringify(['4','5'])})")
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/questions" \
  "${tauth[@]}" -H 'Content-Type: application/json' -d "$QB")
[[ "$c" == "200" || "$c" == "201" ]] || die "create question $c $(cat /tmp/smoke_body.json)"
QUESTION_ID=$(json_get ".id")
[[ -n "$QUESTION_ID" ]] || die "no question id"
ok "POST /api/questions (MCQ)"

OPENS="$(node -p "new Date(Date.now()-3600e3).toISOString()")"
CLOSES="$(node -p "new Date(Date.now()+7200e3).toISOString()")"
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/exams" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Smoke exam $EPOCH\",\"academicYearId\":\"$YEAR_ID\",\"classOfferingId\":\"$CLASS_ID\",\"opensAt\":\"$OPENS\",\"closesAt\":\"$CLOSES\",\"durationMinutes\":60,\"maxPoints\":100}")
[[ "$c" == "200" || "$c" == "201" ]] || die "create exam $c $(cat /tmp/smoke_body.json)"
EXAM_ID=$(json_get ".id")
ok "POST /api/exams"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/exams/$EXAM_ID/questions" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"items\":[{\"questionId\":\"$QUESTION_ID\",\"orderIndex\":0,\"points\":100}]}")
[[ "$c" == "200" || "$c" == "201" ]] || die "attach exam questions $c $(cat /tmp/smoke_body.json)"
ok "POST /api/exams/:id/questions"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/exams/$EXAM_ID/publish" "${tauth[@]}")
[[ "$c" == "200" || "$c" == "201" ]] || die "publish exam $c $(cat /tmp/smoke_body.json)"
ok "POST /api/exams/:id/publish"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/exams/$EXAM_ID/attempts" "${sauth[@]}")
[[ "$c" == "200" || "$c" == "201" ]] || die "start attempt $c $(cat /tmp/smoke_body.json)"
ATTEMPT_ID=$(json_get ".id")
ok "POST /api/exams/:id/attempts (student)"

node -e "const fs=require('fs'); const q=process.argv[1]; fs.writeFileSync('/tmp/smoke_answers.json', JSON.stringify({answersJson: JSON.stringify({[q]:'4'})}));" "$QUESTION_ID"
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/attempts/$ATTEMPT_ID/answers" \
  "${sauth[@]}" -H 'Content-Type: application/json' -d @/tmp/smoke_answers.json)
[[ "$c" == "200" || "$c" == "201" ]] || die "save answers $c $(cat /tmp/smoke_body.json)"
ok "POST /api/attempts/:id/answers"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/attempts/$ATTEMPT_ID/submit" "${sauth[@]}")
[[ "$c" == "200" || "$c" == "201" ]] || die "submit attempt $c $(cat /tmp/smoke_body.json)"
ok "POST /api/attempts/:id/submit"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/attempts/$ATTEMPT_ID/release" "${tauth[@]}")
[[ "$c" == "200" || "$c" == "201" ]] || die "release attempt $c $(cat /tmp/smoke_body.json)"
ok "POST /api/attempts/:id/release"

c=$(code "${sauth[@]}" "$BASE/api/attempts/$ATTEMPT_ID/result")
[[ "$c" == "200" ]] || die "student result $c $(cat /tmp/smoke_body.json)"
node -e "
const j=require('/tmp/smoke_body.json');
if(j.score==null) process.exit(1);
" || die "released result should include score"
ok "GET /api/attempts/:id/result (released)"

c=$(code "${sauth[@]}" "$BASE/api/reports/my-grades")
[[ "$c" == "200" ]] || die "my-grades after release $c"
node -e "
const j=require('/tmp/smoke_body.json');
const subs=j.subjects||[];
const sub=subs.find(s=>s.subjectId==='$SUBJECT_ID');
if(!sub||!Array.isArray(sub.exams)||sub.exams.length<1) process.exit(1);
const ex=sub.exams.find(e=>e.examId==='$EXAM_ID');
if(!ex||ex.score==null) process.exit(1);
" || die "my-grades should list released exam under subject"
ok "GET /api/reports/my-grades (includes released smoke exam)"

c=$(code "${sauth[@]}" "$BASE/api/exams?academicYearId=$YEAR_ID")
[[ "$c" == "200" ]] || die "student list exams $c"
node -e "
const j=require('/tmp/smoke_body.json');
if(!Array.isArray(j)||!j.some(e=>e.id==='$EXAM_ID')) process.exit(1);
" || die "student should see published class exam"
ok "GET /api/exams?academicYearId=… (student sees published exam)"

echo "=== Notification broadcast validation ==="
c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/notifications/broadcast" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Test","body":"Hello","audience":"class"}')
[[ "$c" == "400" ]] || die "broadcast without classOfferingId should be 400, got $c"
ok "POST /api/notifications/broadcast rejects missing classOfferingId"

c=$(curl -sS -o /tmp/smoke_body.json -w "%{http_code}" -X POST "$BASE/api/notifications/broadcast" \
  "${tauth[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Class hi\",\"body\":\"From smoke test\",\"audience\":\"class\",\"classOfferingId\":\"$CLASS_ID\"}")
[[ "$c" == "200" || "$c" == "201" ]] || die "broadcast to class $c $(cat /tmp/smoke_body.json)"
node -e "
const j=require('/tmp/smoke_body.json');
if((j.sent|0)<1) process.exit(1);
" || die "broadcast should send to at least one student"
ok "POST /api/notifications/broadcast (class, sent>=1)"

echo "=== Authorization: student cannot read other student attendance ==="
OTHER="00000000-0000-4000-8000-000000000001"
c=$(code "${sauth[@]}" "$BASE/api/reports/attendance/student/$OTHER")
[[ "$c" == "403" ]] || die "expected 403 for wrong student attendance, got $c"
ok "GET attendance/student/:other -> 403"

echo "=== All smoke checks passed ==="
