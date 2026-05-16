#!/usr/bin/env bash
# Demo seed — creates a realistic school dataset so every feature is visible.
#   Academic year + term, grades 9/10/11, sections A/B, 5 subjects.
#   4 teachers, 10 students, 3 parents linked to children.
#   Class offerings + enrollments, 3 days of attendance.
#   Announcements (3), calendar events (3), feedback (2), goals (3).
#   Published exam with 3 questions + 5 student attempts graded and released.
#   Writes credentials to scripts/demo-credentials.txt
#
# Run: BASE=http://localhost:4000 bash scripts/seed-demo.sh
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@trilink.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
CREDS_FILE="$(dirname "$0")/demo-credentials.txt"
TS="$(date +%s)"
# Phone must match /^\+?[1-9]\d{8,14}$/ after stripping spaces/dashes. Use unique 9-digit suffix per run.
PH_BASE="9${TS: -8}"
DEMO_PASS="Demo@123"

# Curl wrappers
JQ() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }
req() {  # req METHOD PATH TOKEN BODY_JSON
  local method="$1" path="$2" token="$3" body="${4:-}"
  local tmp=$(mktemp)
  local code
  if [[ -n "$body" ]]; then
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "$body")
  else
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $token")
  fi
  echo "$code" >&2
  cat "$tmp"
  rm -f "$tmp"
}
get_field() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)"; }

echo "== Demo seed — target $BASE =="

# 1. Admin login
echo "→ Admin login"
ADMIN_RESP=$(curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"role\":\"admin\"}")
ADMIN_TOKEN=$(get_field "$ADMIN_RESP" '["accessToken"]')
[[ -n "$ADMIN_TOKEN" ]] || { echo "Admin login failed: $ADMIN_RESP" >&2; exit 1; }

# Start credentials file
cat > "$CREDS_FILE" <<EOF
# TriLink demo credentials — generated $(date)
# Login URLs:
#   Admin:   http://localhost:3000/admin/login
#   Teacher: http://localhost:3000/teacher/login
#   Student: http://localhost:3000/student/login
#   Parent:  http://localhost:3000/parent/login

[ADMIN]
$ADMIN_EMAIL | $ADMIN_PASSWORD

EOF

# 2. Academic year + term
echo "→ Academic year"
YEAR=$(curl -sS -X POST "$BASE/api/academic-years" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"label\":\"AY 2026-$TS\",\"startDate\":\"2025-09-01\",\"endDate\":\"2026-06-30\",\"isActive\":true}")
YEAR_ID=$(get_field "$YEAR" '["id"]')
echo "  year=$YEAR_ID"
curl -sS -X POST "$BASE/api/academic-years/$YEAR_ID/terms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Term 1","startDate":"2025-09-01","endDate":"2026-01-15"}' >/dev/null

# 3. Grades, sections, subjects
echo "→ School structure"
declare -A GRADES SUBS
for g in "Grade 9" "Grade 10" "Grade 11"; do
  resp=$(curl -sS -X POST "$BASE/api/grades" -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' -d "{\"name\":\"${g}-${TS}\",\"orderIndex\":${g##* }}")
  GRADES[$g]=$(get_field "$resp" '["id"]')
done
SEC_A=$(curl -sS -X POST "$BASE/api/sections" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"name\":\"Section A-$TS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
SEC_B=$(curl -sS -X POST "$BASE/api/sections" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"name\":\"Section B-$TS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
for s in Mathematics Physics English Biology History; do
  resp=$(curl -sS -X POST "$BASE/api/subjects" -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' -d "{\"name\":\"$s\",\"code\":\"${s:0:3}-$TS\"}")
  SUBS[$s]=$(get_field "$resp" '["id"]')
done

# 4. Teachers — 4 with distinct subjects
echo "→ Teachers"
echo "[TEACHERS]" >> "$CREDS_FILE"
declare -A TEACHERS
register_teacher() {
  local i=$1 fn="$2" ln="$3" subj="$4" dept="$5"
  local email="${fn,,}.${ln,,}+t${TS}@demo.trilink.local"
  local phone="+2518${PH_BASE:0:7}${i}"
  local resp=$(curl -sS -X POST "$BASE/api/auth/register" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"firstName\":\"$fn\",\"lastName\":\"$ln\",\"phone\":\"$phone\",\"type\":\"teacher\",\"subject\":\"$subj\",\"department\":\"$dept\",\"tempPassword\":\"$DEMO_PASS\"}")
  local id=$(get_field "$resp" '["id"]')
  TEACHERS["$fn $ln"]="$id:$email"
  echo "$email | $DEMO_PASS | $fn $ln | teaches $subj" >> "$CREDS_FILE"
}
register_teacher 1 "Abebe"   "Bekele"  Mathematics Science
register_teacher 2 "Tigist"  "Alemu"   Physics     Science
register_teacher 3 "Dawit"   "Haile"   English     Languages
register_teacher 4 "Sara"    "Mekonen" Biology     Science
echo "" >> "$CREDS_FILE"

# 5. Students — 10 distributed across grades/sections
echo "→ Students"
echo "[STUDENTS]" >> "$CREDS_FILE"
declare -A STUDENTS
register_student() {
  local i=$1 fn="$2" ln="$3" grade="$4" section="$5"
  local email="${fn,,}.${ln,,}+s${TS}@demo.trilink.local"
  local phone="+2519${PH_BASE:0:7}${i}"
  local resp=$(curl -sS -X POST "$BASE/api/auth/register" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"firstName\":\"$fn\",\"lastName\":\"$ln\",\"phone\":\"$phone\",\"type\":\"student\",\"grade\":\"$grade\",\"section\":\"$section\",\"tempPassword\":\"$DEMO_PASS\"}")
  local id=$(get_field "$resp" '["id"]')
  STUDENTS["$fn $ln"]="$id:$email:$grade:$section"
  echo "$email | $DEMO_PASS | $fn $ln | $grade / $section" >> "$CREDS_FILE"
}
register_student 0 "Hanna"    "Tesfaye"  "Grade 9"  "A"
register_student 1 "Yonas"    "Girma"    "Grade 9"  "A"
register_student 2 "Meron"    "Abebe"    "Grade 9"  "B"
register_student 3 "Kaleb"    "Solomon"  "Grade 10" "A"
register_student 4 "Rahel"    "Tadesse"  "Grade 10" "A"
register_student 5 "Biniam"   "Getachew" "Grade 10" "B"
register_student 6 "Selam"    "Negash"   "Grade 10" "B"
register_student 7 "Nahom"    "Worku"    "Grade 11" "A"
register_student 8 "Eyerus"   "Demeke"   "Grade 11" "A"
register_student 9 "Samuel"   "Teklu"    "Grade 11" "B"
echo "" >> "$CREDS_FILE"

# 6. Parents — 3 parents linked to their children
echo "→ Parents"
echo "[PARENTS]" >> "$CREDS_FILE"
register_parent() {
  local i=$1 fn="$2" ln="$3" child_key="$4" rel="$5"
  local child_id=$(echo "${STUDENTS[$child_key]}" | cut -d: -f1)
  local email="${fn,,}.${ln,,}+p${TS}@demo.trilink.local"
  local phone="+2517${PH_BASE:0:7}${i}"
  local resp=$(curl -sS -X POST "$BASE/api/auth/register" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"firstName\":\"$fn\",\"lastName\":\"$ln\",\"phone\":\"$phone\",\"type\":\"parent\",\"linkedStudentId\":\"$child_id\",\"relationship\":\"$rel\",\"isPrimaryLink\":true,\"tempPassword\":\"$DEMO_PASS\"}")
  echo "$email | $DEMO_PASS | $fn $ln | $rel of $child_key" >> "$CREDS_FILE"
}
register_parent 0 "Tesfaye"  "Kebede"   "Hanna Tesfaye"  "Father"
register_parent 1 "Almaz"    "Gebru"    "Kaleb Solomon"  "Mother"
register_parent 2 "Getachew" "Wondimu"  "Nahom Worku"    "Father"
echo "" >> "$CREDS_FILE"

# 7. Class offerings — every teacher teaches one class
echo "→ Class offerings"
declare -A CLASSES
new_class() { # label grade section subject teacher_key
  local label="$1" g="$2" s="$3" subj="$4" tkey="$5"
  local tid=$(echo "${TEACHERS[$tkey]}" | cut -d: -f1)
  local resp=$(curl -sS -X POST "$BASE/api/class-offerings" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"academicYearId\":\"$YEAR_ID\",\"gradeId\":\"${GRADES[$g]}\",\"sectionId\":\"$s\",\"subjectId\":\"${SUBS[$subj]}\",\"teacherId\":\"$tid\",\"name\":\"$label\"}")
  CLASSES[$label]=$(get_field "$resp" '["id"]')
}
new_class "G9A Mathematics"  "Grade 9"  "$SEC_A" "Mathematics" "Abebe Bekele"
new_class "G10A Physics"     "Grade 10" "$SEC_A" "Physics"     "Tigist Alemu"
new_class "G10B English"     "Grade 10" "$SEC_B" "English"     "Dawit Haile"
new_class "G11A Biology"     "Grade 11" "$SEC_A" "Biology"     "Sara Mekonen"

# 8. Enrollments — enroll each student in one class based on their grade/section
echo "→ Enrollments"
enroll() { # student_key class_label
  local sid=$(echo "${STUDENTS[$1]}" | cut -d: -f1)
  local cid="${CLASSES[$2]}"
  curl -sS -X POST "$BASE/api/enrollments" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"studentId\":\"$sid\",\"classOfferingId\":\"$cid\",\"academicYearId\":\"$YEAR_ID\"}" >/dev/null
}
enroll "Hanna Tesfaye"    "G9A Mathematics"
enroll "Yonas Girma"      "G9A Mathematics"
enroll "Kaleb Solomon"    "G10A Physics"
enroll "Rahel Tadesse"    "G10A Physics"
enroll "Biniam Getachew"  "G10B English"
enroll "Selam Negash"     "G10B English"
enroll "Nahom Worku"      "G11A Biology"
enroll "Eyerus Demeke"    "G11A Biology"

# 9. Teacher login helper (needed for attendance + exams)
teacher_token() {
  local email=$(echo "${TEACHERS[$1]}" | cut -d: -f2)
  curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$DEMO_PASS\",\"role\":\"teacher\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])"
}
student_token() {
  local email=$(echo "${STUDENTS[$1]}" | cut -d: -f2)
  curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$DEMO_PASS\",\"role\":\"student\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])"
}

# 10. Attendance — last 3 school days for G10A Physics (Tigist's class)
echo "→ Attendance (3 days)"
TIGIST_TOK=$(teacher_token "Tigist Alemu")
CLASS_P=${CLASSES["G10A Physics"]}
KALEB_ID=$(echo "${STUDENTS["Kaleb Solomon"]}" | cut -d: -f1)
RAHEL_ID=$(echo "${STUDENTS["Rahel Tadesse"]}" | cut -d: -f1)
for days_ago in 3 2 1; do
  d=$(date -d "$days_ago days ago" +%Y-%m-%d)
  sid=$(curl -sS -X POST "$BASE/api/attendance-sessions" \
    -H "Authorization: Bearer $TIGIST_TOK" -H 'Content-Type: application/json' \
    -d "{\"classOfferingId\":\"$CLASS_P\",\"date\":\"$d\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
  # Vary pattern per day
  case $days_ago in
    3) st1="present"; st2="present" ;;
    2) st1="present"; st2="late"    ;;
    1) st1="absent";  st2="present" ;;
  esac
  curl -sS -X PUT "$BASE/api/attendance-sessions/$sid/marks" \
    -H "Authorization: Bearer $TIGIST_TOK" -H 'Content-Type: application/json' \
    -d "{\"marks\":[{\"studentId\":\"$KALEB_ID\",\"status\":\"$st1\"},{\"studentId\":\"$RAHEL_ID\",\"status\":\"$st2\"}]}" >/dev/null
done

# 11. Announcements — 3 different audiences
echo "→ Announcements"
for payload in \
  "{\"academicYearId\":\"$YEAR_ID\",\"title\":\"Welcome back to school!\",\"body\":\"We hope you had a restful break. Classes resume Monday.\",\"audience\":\"all\"}" \
  "{\"academicYearId\":\"$YEAR_ID\",\"title\":\"Mid-term exams schedule\",\"body\":\"Mid-term exams begin in two weeks. Check your timetables.\",\"audience\":\"students\"}" \
  "{\"academicYearId\":\"$YEAR_ID\",\"title\":\"Parent-teacher meeting\",\"body\":\"Saturday 10 AM in the main hall.\",\"audience\":\"parents\"}"; do
  curl -sS -X POST "$BASE/api/announcements" -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' -d "$payload" >/dev/null
done

# 12. Calendar events
echo "→ Calendar events"
for payload in \
  "{\"title\":\"Labour Day (holiday)\",\"date\":\"2026-05-01\",\"type\":\"holiday\",\"academicYearId\":\"$YEAR_ID\"}" \
  "{\"title\":\"Mid-term exams start\",\"date\":\"2026-05-12\",\"type\":\"exam\",\"academicYearId\":\"$YEAR_ID\"}" \
  "{\"title\":\"Parent-teacher day\",\"date\":\"2026-05-17\",\"type\":\"meeting\",\"academicYearId\":\"$YEAR_ID\"}"; do
  curl -sS -X POST "$BASE/api/calendar-events" -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' -d "$payload" >/dev/null
done

# 13. Exam — published G9A Mathematics exam with 3 MCQs + 2 student attempts graded
echo "→ Exam (published, with attempts)"
ABEBE_TOK=$(teacher_token "Abebe Bekele")
SUBJ_MATH=${SUBS["Mathematics"]}
CLASS_M=${CLASSES["G9A Mathematics"]}

q1=$(curl -sS -X POST "$BASE/api/questions" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"mcq\",\"stem\":\"What is 12 + 7?\",\"subjectId\":\"$SUBJ_MATH\",\"answerKey\":\"19\",\"optionsJson\":\"[\\\"17\\\",\\\"18\\\",\\\"19\\\",\\\"20\\\"]\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
q2=$(curl -sS -X POST "$BASE/api/questions" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"mcq\",\"stem\":\"Solve: 9 x 6\",\"subjectId\":\"$SUBJ_MATH\",\"answerKey\":\"54\",\"optionsJson\":\"[\\\"48\\\",\\\"54\\\",\\\"56\\\",\\\"63\\\"]\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
q3=$(curl -sS -X POST "$BASE/api/questions" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"mcq\",\"stem\":\"What is the square root of 81?\",\"subjectId\":\"$SUBJ_MATH\",\"answerKey\":\"9\",\"optionsJson\":\"[\\\"7\\\",\\\"8\\\",\\\"9\\\",\\\"10\\\"]\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

OPENS=$(python3 -c "import datetime;print((datetime.datetime.utcnow()-datetime.timedelta(hours=1)).isoformat()+'Z')")
CLOSES=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(days=7)).isoformat()+'Z')")
EXAM_ID=$(curl -sS -X POST "$BASE/api/exams" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"Math Quiz 1\",\"academicYearId\":\"$YEAR_ID\",\"classOfferingId\":\"$CLASS_M\",\"opensAt\":\"$OPENS\",\"closesAt\":\"$CLOSES\",\"durationMinutes\":30,\"maxPoints\":30}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

curl -sS -X POST "$BASE/api/exams/$EXAM_ID/questions" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"items\":[{\"questionId\":\"$q1\",\"orderIndex\":0,\"points\":10},{\"questionId\":\"$q2\",\"orderIndex\":1,\"points\":10},{\"questionId\":\"$q3\",\"orderIndex\":2,\"points\":10}]}" >/dev/null
curl -sS -X POST "$BASE/api/exams/$EXAM_ID/publish" -H "Authorization: Bearer $ABEBE_TOK" >/dev/null

# Hanna answers all 3 correctly, Yonas gets 2 right + 1 wrong
do_attempt() {  # student_key "ans1:ans2:ans3"
  local stok=$(student_token "$1")
  local a1 a2 a3; IFS=: read -r a1 a2 a3 <<< "$2"
  local att_id=$(curl -sS -X POST "$BASE/api/exams/$EXAM_ID/attempts" -H "Authorization: Bearer $stok" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
  local ans="{\"answersJson\":\"{\\\"$q1\\\":\\\"$a1\\\",\\\"$q2\\\":\\\"$a2\\\",\\\"$q3\\\":\\\"$a3\\\"}\"}"
  curl -sS -X POST "$BASE/api/attempts/$att_id/answers" -H "Authorization: Bearer $stok" \
    -H 'Content-Type: application/json' -d "$ans" >/dev/null
  curl -sS -X POST "$BASE/api/attempts/$att_id/submit" -H "Authorization: Bearer $stok" >/dev/null
  curl -sS -X POST "$BASE/api/attempts/$att_id/release" -H "Authorization: Bearer $ABEBE_TOK" >/dev/null
}
do_attempt "Hanna Tesfaye"  "19:54:9"
do_attempt "Yonas Girma"    "19:54:8"

# 14. Student-side content — goals, feedback
echo "→ Goals & feedback"
HANNA_TOK=$(student_token "Hanna Tesfaye")
KALEB_TOK=$(student_token "Kaleb Solomon")
curl -sS -X POST "$BASE/api/goals/me" -H "Authorization: Bearer $HANNA_TOK" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Average above 90 in Math","description":"Maintain a 90% average for this term"}' >/dev/null
curl -sS -X POST "$BASE/api/goals/me" -H "Authorization: Bearer $KALEB_TOK" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Read one book per week","description":"Improve English vocabulary"}' >/dev/null

ABEBE_ID=$(echo "${TEACHERS["Abebe Bekele"]}" | cut -d: -f1)
curl -sS -X POST "$BASE/api/feedback" -H "Authorization: Bearer $HANNA_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"category\":\"teaching\",\"message\":\"The visual examples in class really help me understand the topic.\",\"teacherId\":\"$ABEBE_ID\",\"isAnonymous\":false}" >/dev/null
curl -sS -X POST "$BASE/api/feedback" -H "Authorization: Bearer $KALEB_TOK" \
  -H 'Content-Type: application/json' \
  -d '{"category":"facility","message":"The library could use more reference books.","isAnonymous":true}' >/dev/null

# 15. Chat — teacher creates a group with their class students and sends a message
echo "→ Chat conversation"
HANNA_ID=$(echo "${STUDENTS["Hanna Tesfaye"]}" | cut -d: -f1)
YONAS_ID=$(echo "${STUDENTS["Yonas Girma"]}" | cut -d: -f1)
CONV_ID=$(curl -sS -X POST "$BASE/api/conversations" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"group\",\"title\":\"Grade 9 Math — announcements\",\"parentVisible\":false,\"memberIds\":[\"$HANNA_ID\",\"$YONAS_ID\"]}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -sS -X POST "$BASE/api/conversations/$CONV_ID/messages" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' -d '{"text":"Welcome to Grade 9 Math. Quiz 1 is now open."}' >/dev/null

# 16. Notifications — teacher broadcasts to the class
echo "→ Notifications broadcast"
curl -sS -X POST "$BASE/api/notifications/broadcast" -H "Authorization: Bearer $ABEBE_TOK" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"Homework reminder\",\"body\":\"Chapter 3 exercises due Friday.\",\"audience\":\"class\",\"classOfferingId\":\"$CLASS_M\"}" >/dev/null

echo
echo "== Seed complete =="
echo "Credentials saved to: $CREDS_FILE"
