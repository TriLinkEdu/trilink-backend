# Exams API

Base path: `/exams`

---

## POST /exams
Create an exam draft.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "title": "Biology Midterm",
  "academicYearId": "uuid",
  "classOfferingId": "uuid",
  "opensAt": "2026-05-10T09:00:00.000Z",
  "closesAt": "2026-05-10T11:00:00.000Z",
  "durationMinutes": 90,
  "minStayMinutes": 30,
  "maxPoints": 100
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✅ | |
| academicYearId | UUID | ✅ | |
| classOfferingId | UUID | ❌ | If null, exam is school-wide |
| opensAt | ISO string | ✅ | When students can start |
| closesAt | ISO string | ✅ | When exam closes |
| durationMinutes | number | ✅ | Time limit per student |
| minStayMinutes | number | ❌ | Default 0 — minimum time before submit allowed |
| maxPoints | number | ❌ | Default 100 — grading scale |

**Response 201:** Created exam object.

---

## GET /exams
List exams.

**Auth required:** Yes (admin, teacher, student)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| academicYearId | UUID | Optional filter |

**Behavior:**
- Admin: all exams (optionally filtered by year)
- Teacher: only exams they created
- Student: only published exams

**Response 200:** Array of enriched exam objects.

---

## GET /exams/:id/attempts
List all student attempts for an exam (grading queue).

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| skip | number | Default 0 |
| take | number | Default 20 |

**Response 200:**
```json
{
  "total": 25,
  "attempts": [
    {
      "id": "uuid",
      "examId": "uuid",
      "studentId": "uuid",
      "studentFirstName": "Ali",
      "studentLastName": "Hassan",
      "startedAt": "2026-05-10T09:05:00.000Z",
      "submittedAt": "2026-05-10T10:30:00.000Z",
      "score": null,
      "autoScore": 75.0,
      "needsManualGrading": true,
      "isLocked": false,
      "releasedAt": null,
      "violationCount": 2
    }
  ]
}
```

---

## GET /exams/:id/summary
Exam summary with questions and compact student results.

**Auth required:** Yes (admin, teacher)

**Response 200:**
```json
{
  "exam": { "id": "uuid", "title": "Biology Midterm", "maxPoints": 100 },
  "questions": [
    {
      "id": "uuid",
      "stem": "What is photosynthesis?",
      "type": "multiple_choice",
      "points": 5,
      "answerKey": "2",
      "orderIndex": 1
    }
  ],
  "results": [
    {
      "studentId": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "score": 85,
      "submitted": true,
      "released": false,
      "needsManualGrading": false
    }
  ]
}
```

---

## GET /exams/:id/results/export
Download exam results as CSV.

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| format | string | Must be `csv` |

**Response:** CSV file download with `Content-Disposition: attachment; filename="exam-{id}-results.csv"`

---

## PATCH /exams/:id
Update exam grading scale.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{ "maxPoints": 150 }
```

**Response 200:** Updated exam object.

---

## POST /exams/:id/questions
Add questions to an exam.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "items": [
    { "questionId": "uuid", "orderIndex": 1, "points": 5 },
    { "questionId": "uuid", "orderIndex": 2, "points": 10 }
  ]
}
```

**Response 201:** Array of created exam-question links.

---

## GET /exams/:id/questions
List questions for an exam.

**Auth required:** Yes (admin, teacher, student)

**Behavior:**
- Staff: sees answer keys
- Student: does not see answer keys (only during active attempt)

**Response 200:** Array of exam question objects.

---

## POST /exams/:id/publish
Publish an exam (makes it visible to students).

**Auth required:** Yes (admin, teacher)

**Response 201:** Updated exam object with `published: true`.

---

## GET /exams/:id/students
Get student roster for an exam with attempt status.

**Auth required:** Yes (admin, teacher)

**Response 200:**
```json
[
  {
    "studentId": "uuid",
    "firstName": "Ali",
    "lastName": "Hassan",
    "status": "not_started",
    "violationCount": 0,
    "attemptId": null
  }
]
```

**Status values:** `not_started`, `in_progress`, `submitted`

---

## POST /exams/:id/attempts
Start an exam attempt. **Student only.**

**Auth required:** Yes (student)

**Response 201:**
```json
{
  "attemptId": "uuid",
  "examId": "uuid",
  "startedAt": "2026-05-10T09:05:00.000Z",
  "questions": [...],
  "durationMinutes": 90,
  "closesAt": "2026-05-10T11:00:00.000Z"
}
```

**Errors:**
- `400` — Exam not open, already submitted, or locked

---

## Exam Object Shape
```json
{
  "id": "uuid",
  "title": "Biology Midterm",
  "academicYearId": "uuid",
  "classOfferingId": "uuid",
  "opensAt": "2026-05-10T09:00:00.000Z",
  "closesAt": "2026-05-10T11:00:00.000Z",
  "durationMinutes": 90,
  "minStayMinutes": 30,
  "maxPoints": 100,
  "published": true,
  "createdById": "uuid",
  "termId": null,
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z"
}
```
