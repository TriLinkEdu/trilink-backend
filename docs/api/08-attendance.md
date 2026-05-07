# Attendance API

No base path prefix — routes are at root level under `/api`.

---

## SESSIONS

### POST /attendance-sessions
Create an attendance session for a class on a date.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "classOfferingId": "uuid",
  "date": "2026-04-22",
  "termId": "uuid"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| classOfferingId | UUID | ✅ | Teacher must own this class |
| date | string | ✅ | YYYY-MM-DD format |
| termId | UUID | ❌ | Tag session to a term for report card filtering |

**Response 201:** Created session object.

**Errors:**
- `409` — Session already exists for this class+date
- `403` — Teacher does not own this class

---

### GET /attendance-sessions
List sessions for a class.

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Required |
|-------|------|----------|
| classOfferingId | UUID | ✅ |

**Response 200:** Array of session objects, ordered by date descending.

---

### GET /attendance-sessions/my
Get all sessions across all classes the authenticated teacher owns.

**Auth required:** Yes (teacher)

**Response 200:**
```json
[
  {
    "sessionId": "uuid",
    "date": "2026-04-22",
    "createdAt": "2026-04-22T08:00:00.000Z",
    "classOfferingId": "uuid",
    "className": "Math 9A",
    "subject": { "id": "uuid", "name": "Mathematics", "code": "MATH" },
    "grade": { "id": "uuid", "name": "Grade 9" },
    "section": { "id": "uuid", "name": "A" },
    "teacher": {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@school.edu",
      "department": "Science",
      "officeRoom": "101"
    }
  }
]
```

---

## MARKS

### PUT /attendance-sessions/:id/marks
Bulk create or update attendance marks for a session.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "marks": [
    { "studentId": "uuid", "status": "present", "note": null },
    { "studentId": "uuid", "status": "absent", "note": "Sick" },
    { "studentId": "uuid", "status": "excused", "note": "Doctor appointment" }
  ]
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| studentId | UUID | ✅ | Must be enrolled in the session's class |
| status | string | ✅ | `present`, `absent`, `excused` |
| note | string | ❌ | Optional note |

**Response 200:** Array of saved mark objects.

**Errors:**
- `400` — Student not enrolled in this class
- `403` — Teacher does not own this class
- `404` — Session not found

**Side effects:**
- Sends in-app notification to linked parents for each mark
- Triggers gamification badge check (perfect attendance week)

---

### GET /attendance-sessions/:id/marks
Get all marks for a session.

**Auth required:** Yes (admin, teacher)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "sessionId": "uuid",
    "studentId": "uuid",
    "status": "present",
    "note": null,
    "createdAt": "2026-04-22T08:05:00.000Z"
  }
]
```

---

### PATCH /attendance-marks/:markId
Edit a single attendance mark.

**Auth required:** Yes (admin, teacher)

**Request body (all optional):**
```json
{
  "status": "excused",
  "note": "Doctor appointment"
}
```

**Response 200:** Updated mark object.

**Errors:**
- `403` — Teacher does not own the class this mark belongs to
- `404` — Mark not found

---

## REPORTS

### GET /reports/attendance/student/:studentId
Full attendance history for a student across all sessions.

**Auth required:** Yes (admin, teacher, student, parent)

**Access rules:**
- Student: own data only
- Parent: linked child only
- Teacher/Admin: any student

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "email": "ali@school.edu",
  "grade": "Grade 9",
  "section": "A",
  "marks": [
    {
      "markId": "uuid",
      "status": "present",
      "note": null,
      "date": "2026-04-22",
      "sessionId": "uuid",
      "classOfferingId": "uuid",
      "className": "Math 9A",
      "subject": { "id": "uuid", "name": "Mathematics", "code": "MATH" },
      "grade": { "id": "uuid", "name": "Grade 9" },
      "section": { "id": "uuid", "name": "A" },
      "teacher": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@school.edu", "department": "Science", "officeRoom": "101" }
    }
  ]
}
```

---

### GET /reports/attendance/student/:studentId/by-day
Student attendance on a specific date.

**Auth required:** Yes (admin, teacher, student, parent)

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| date | string | ✅ | YYYY-MM-DD |

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "email": "ali@school.edu",
  "grade": "Grade 9",
  "section": "A",
  "date": "2026-04-22",
  "records": [
    {
      "markId": "uuid",
      "status": "present",
      "note": null,
      "sessionId": "uuid",
      "classOfferingId": "uuid",
      "className": "Math 9A",
      "subject": { "id": "uuid", "name": "Mathematics", "code": "MATH" },
      "grade": { "id": "uuid", "name": "Grade 9" },
      "section": { "id": "uuid", "name": "A" },
      "teacher": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@school.edu", "department": "Science", "officeRoom": null }
    }
  ]
}
```

---

### GET /reports/attendance/student/:studentId/by-subject/:subjectId
Attendance for a student filtered by subject.

**Auth required:** Yes (admin, teacher, student, parent)

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "subjectId": "uuid",
  "subjectName": "Biology",
  "summary": {
    "total": 20,
    "present": 17,
    "absent": 2,
    "excused": 1,
    "attendanceRate": 90.0
  },
  "sessions": [
    {
      "sessionId": "uuid",
      "date": "2026-04-22",
      "status": "present",
      "note": null,
      "classOfferingId": "uuid",
      "className": "Biology 9A",
      "subject": { "id": "uuid", "name": "Biology", "code": "Bio" },
      "grade": { "id": "uuid", "name": "Grade 9" },
      "section": { "id": "uuid", "name": "A" },
      "teacher": { "id": "uuid", "firstName": "Abdu", "lastName": "Isa", "email": "abdu@school.edu", "department": "Science", "officeRoom": null }
    }
  ]
}
```

> **Tip:** Use `GET /enrollments/mine/subjects` or `GET /enrollments/children/:studentId/subjects` to get subject IDs.

---

### GET /reports/attendance/class/:classOfferingId
Full attendance report for a class offering.

**Auth required:** Yes (admin, teacher)

**Response 200:**
```json
{
  "classOfferingId": "uuid",
  "className": "Biology 9A",
  "subject": { "id": "uuid", "name": "Biology", "code": "Bio" },
  "grade": { "id": "uuid", "name": "Grade 9" },
  "section": { "id": "uuid", "name": "A" },
  "teacher": { "id": "uuid", "firstName": "Abdu", "lastName": "Isa", "email": "abdu@school.edu", "department": "Science", "officeRoom": null },
  "sessions": [
    {
      "sessionId": "uuid",
      "date": "2026-04-04",
      "marks": [
        {
          "id": "uuid",
          "sessionId": "uuid",
          "studentId": "uuid",
          "studentFirstName": "Ali",
          "studentLastName": "Hassan",
          "studentEmail": "ali@school.edu",
          "status": "present",
          "note": null,
          "createdAt": "2026-04-04T09:04:21.246Z"
        }
      ]
    }
  ]
}
```

---

### GET /reports/attendance/student/:studentId/term/:termId
Attendance summary for a student in a specific term.

**Auth required:** Yes (admin, teacher, student, parent)

**Matching logic:** Matches sessions tagged with `termId` OR sessions without `termId` but with `date` within the term's `startDate`–`endDate` range.

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "termId": "uuid",
  "termName": "Term 1",
  "present": 45,
  "absent": 2,
  "late": 1,
  "excused": 0,
  "total": 48,
  "attendancePercent": 95.8,
  "sessions": [
    {
      "sessionId": "uuid",
      "date": "2025-11-01",
      "classOfferingId": "uuid",
      "status": "present",
      "note": null
    }
  ]
}
```

**Errors:**
- `403` — Not allowed to view this student
- `404` — Term not found

---

## Session Object Shape
```json
{
  "id": "uuid",
  "classOfferingId": "uuid",
  "date": "2026-04-22",
  "takenById": "uuid",
  "termId": null,
  "createdAt": "2026-04-22T08:00:00.000Z"
}
```

## Mark Status Values
| Status | Meaning |
|--------|---------|
| `present` | Student was present |
| `absent` | Student was absent |
| `late` | Student was late (counts as present for attendance %) |
| `excused` | Excused absence |
