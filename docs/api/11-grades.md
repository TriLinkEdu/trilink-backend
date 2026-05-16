# Grades API

Base path: `/grades`

The grades ledger stores individual grade entries per student per class. Entries can be created manually by teachers or auto-created when exam/assignment grades are released.

---

## POST /grades/bulk
Bulk submit grades for all students in a class for a given title.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Assignment 1",
  "type": "assignment",
  "maxScore": 100,
  "note": "Optional note for all",
  "termId": "uuid",
  "entries": [
    { "studentId": "uuid", "score": 88 },
    { "studentId": "uuid", "score": 75 },
    { "studentId": "uuid", "score": null }
  ]
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| classOfferingId | UUID | ✅ | Teacher must own this class |
| title | string | ✅ | e.g. `"Assignment 1"`, `"Quiz 3"`, `"Midterm Exam"` |
| type | string | ✅ | `exam`, `assignment`, `quiz`, `project`, `other` |
| maxScore | number | ✅ | Min 1 |
| note | string | ❌ | Applied to all entries |
| termId | UUID | ❌ | Tag entries to a term for report card filtering |
| entries | array | ✅ | One row per student |
| entries[].studentId | UUID | ✅ | |
| entries[].score | number\|null | ❌ | null = not yet graded |

**Behavior:** If an entry already exists for a student+title, it is updated. Otherwise created.

**Response 201:**
```json
{ "saved": 25, "entries": [...] }
```

**After submitting:** Call `POST /grades/release` to notify students.

---

## POST /grades
Create a single grade entry for one student.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "classOfferingId": "uuid",
  "studentId": "uuid",
  "title": "Quiz 1",
  "type": "quiz",
  "score": 88,
  "maxScore": 100,
  "note": "Well done",
  "termId": "uuid"
}
```

**Response 201:** Created grade entry object.

---

## PATCH /grades/:id
Update a grade entry.

**Auth required:** Yes (admin, teacher)

**Request body (all optional):**
```json
{
  "title": "Quiz 1 Updated",
  "type": "quiz",
  "score": 90,
  "maxScore": 100,
  "note": "Revised score"
}
```

**Response 200:** Updated grade entry object.

**Errors:**
- `404` — Entry not found
- `403` — Teacher does not own this class

---

## POST /grades/release
Release grades to students (sends notifications).

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Assignment 1"
}
```

Releases all entries for the given class+title combination.

**Response 201:**
```json
{ "released": 25 }
```

**Side effects:**
- Sets `releasedAt` timestamp on each entry
- Sends in-app notification to each student: `"Your result for 'Assignment 1' is available (88 / 100)."`
- Sends in-app notification to linked parents

---

## GET /grades/class/:classOfferingId
All grade entries for a class, grouped by title.

**Auth required:** Yes (admin, teacher)

**Response 200:**
```json
{
  "classOfferingId": "uuid",
  "groups": [
    {
      "title": "Assignment 1",
      "type": "assignment",
      "maxScore": 100,
      "releasedAt": "2026-04-20T10:00:00.000Z",
      "studentCount": 25,
      "entries": [
        {
          "id": "uuid",
          "studentId": "uuid",
          "firstName": "Ali",
          "lastName": "Hassan",
          "studentEmail": "ali@school.edu",
          "score": 88,
          "maxScore": 100,
          "note": null,
          "releasedAt": "2026-04-20T10:00:00.000Z",
          "examAttemptId": null
        }
      ]
    }
  ]
}
```

---

## GET /grades/student/:studentId
All released grade entries for a student.

**Auth required:** Yes (admin, teacher, student, parent)

**Access rules:**
- Student: own released grades only
- Parent: linked child's released grades only
- Teacher/Admin: all entries (including unreleased)

**Response 200:** Array of enriched grade entry objects.

---

## GET /grades/student/:studentId/by-subject/:subjectId
Grades for a student filtered by subject, with summary.

**Auth required:** Yes (admin, teacher, student, parent)

**Response 200:**
```json
{
  "studentId": "uuid",
  "studentName": "Ali Hassan",
  "subjectId": "uuid",
  "subjectName": "Biology",
  "summary": {
    "total": 5,
    "withScore": 5,
    "averagePercent": 82.4
  },
  "entries": [
    {
      "id": "uuid",
      "title": "Assignment 1",
      "type": "assignment",
      "score": 88,
      "maxScore": 100,
      "releasedAt": "2026-04-20T10:00:00.000Z",
      "note": null,
      "gradeName": "Grade 9",
      "sectionName": "A",
      "subjectName": "Biology"
    }
  ]
}
```

> **Tip:** Use `GET /enrollments/mine/subjects` to get subject IDs for the student.

---

## GET /grades/student/:studentId/term/:termId
All released grade entries for a student in a specific term, grouped by subject.

**Auth required:** Yes (admin, teacher, student, parent)

**Matching logic:** Returns entries tagged with `termId` directly.

**Response 200:**
```json
{
  "studentId": "uuid",
  "studentName": "Ali Hassan",
  "termId": "uuid",
  "subjects": [
    {
      "subjectId": "uuid",
      "subjectName": "Mathematics",
      "entries": [
        {
          "id": "uuid",
          "title": "Quiz 1",
          "type": "quiz",
          "score": 88,
          "maxScore": 100,
          "percent": 88.0,
          "note": null,
          "releasedAt": "2026-04-20T10:00:00.000Z",
          "createdAt": "2026-04-15T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

## Grade Entry Object Shape
```json
{
  "id": "uuid",
  "classOfferingId": "uuid",
  "studentId": "uuid",
  "teacherId": "uuid",
  "title": "Assignment 1",
  "type": "assignment",
  "score": 88,
  "maxScore": 100,
  "note": null,
  "examAttemptId": null,
  "termId": null,
  "releasedAt": "2026-04-20T10:00:00.000Z",
  "createdAt": "2026-04-15T00:00:00.000Z",
  "updatedAt": "2026-04-20T10:00:00.000Z"
}
```

## Grade Entry Type Values
| Type | When used |
|------|-----------|
| `exam` | Auto-created when exam attempt is released |
| `assignment` | Auto-created when assignment grade is released, or manual |
| `quiz` | Manual |
| `project` | Manual |
| `other` | Manual |
