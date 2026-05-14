# Assignments API

Base path: `/assignments`

---

## POST /assignments
Create an assignment (draft — not visible to students yet).

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Chapter 3 Worksheet",
  "description": "Complete all exercises on pages 45-50.",
  "submissionType": "file",
  "attachmentFileId": "uuid",
  "deadline": "2026-05-15T23:59:00.000Z",
  "maxScore": 100
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| classOfferingId | UUID | ✅ | Teacher must own this class |
| title | string | ✅ | |
| description | string | ❌ | |
| submissionType | string | ✅ | `file`, `text`, `none` |
| attachmentFileId | UUID | ❌ | Teacher's attached file (e.g. worksheet PDF) |
| deadline | ISO string | ✅ | |
| maxScore | number | ❌ | Default 100 |

**Response 201:** Created assignment object.

---

## PATCH /assignments/:id
Update an assignment. Only works on **draft** (unpublished) assignments.

**Auth required:** Yes (admin, teacher)

**Request body (all optional):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "submissionType": "text",
  "attachmentFileId": "uuid",
  "deadline": "2026-05-20T23:59:00.000Z",
  "maxScore": 50
}
```

**Response 200:** Updated assignment object.

**Errors:**
- `400` — Cannot edit a published assignment (unpublish first)

---

## POST /assignments/:id/publish
Publish an assignment (makes it visible to students and sends notifications).

**Auth required:** Yes (admin, teacher)

**Response 201:**
```json
{ "ok": true, "notified": 25 }
```

**Side effects:** Sends in-app notification to all enrolled students.

---

## POST /assignments/:id/unpublish
Hide an assignment from students.

**Auth required:** Yes (admin, teacher)

**Response 201:** Updated assignment object with `published: false`.

---

## DELETE /assignments/:id
Delete an assignment. Only works on **draft** assignments.

**Auth required:** Yes (admin, teacher)

**Response 200:** `{ "ok": true }`

---

## GET /assignments/teacher/mine
List assignments created by the authenticated teacher.

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| classOfferingId | UUID | Optional filter by class |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Chapter 3 Worksheet",
    "submissionType": "file",
    "deadline": "2026-05-15T23:59:00.000Z",
    "maxScore": 100,
    "published": true,
    "subject": { "name": "Biology" },
    "grade": { "name": "Grade 9" },
    "section": { "name": "A" },
    "isOverdue": false
  }
]
```

---

## GET /assignments/:id/submissions
List all student submissions for an assignment.

**Auth required:** Yes (admin, teacher)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "status": "submitted",
    "submittedAt": "2026-05-10T14:00:00.000Z",
    "score": null,
    "feedback": null,
    "releasedAt": null,
    "student": {
      "id": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "email": "ali@school.edu"
    },
    "file": {
      "id": "uuid",
      "filename": "homework.pdf",
      "mime": "application/pdf",
      "path": "https://res.cloudinary.com/..."
    }
  }
]
```

---

## POST /assignments/submissions/:submissionId/grade
Grade a student submission.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "score": 88,
  "feedback": "Good work, but check question 3."
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| score | number | ✅ | 0 to maxScore |
| feedback | string | ❌ | Shown to student after release |

**Response 201:** Updated submission object.

---

## POST /assignments/submissions/:submissionId/release
Release a grade to the student (sends notification and creates grade ledger entry).

**Auth required:** Yes (admin, teacher)

**Response 201:** Updated submission object with `releasedAt` set.

**Side effects:**
- Sends in-app notification to student and linked parents
- Auto-creates a `GradeEntry` record in the grades ledger

---

## POST /assignments/:id/release-all
Release all graded submissions for an assignment at once.

**Auth required:** Yes (admin, teacher)

**Response 201:**
```json
{ "released": 22 }
```

---

## GET /assignments/student/:studentId
List all published assignments for a student's enrolled classes, with submission status.

**Auth required:** Yes (admin, teacher, student, parent)

**Access rules:**
- Student: own data only
- Parent: linked child only

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Chapter 3 Worksheet",
    "submissionType": "file",
    "deadline": "2026-05-15T23:59:00.000Z",
    "maxScore": 100,
    "isOverdue": false,
    "subject": { "name": "Biology" },
    "grade": { "name": "Grade 9" },
    "submission": {
      "id": "uuid",
      "status": "submitted",
      "submittedAt": "2026-05-10T14:00:00.000Z",
      "score": null,
      "releasedAt": null
    }
  }
]
```

`submission` is `null` if the student hasn't submitted yet.

---

## GET /assignments/:id
Get assignment detail. Students also get their submission status.

**Auth required:** Yes (admin, teacher, student, parent)

**Response 200:** Single assignment object with submission (if student).

---

## POST /assignments/:id/submit
Submit an assignment. **Student only.**

**Auth required:** Yes (student)

**Request body:**
```json
{
  "fileId": "uuid",
  "textContent": null
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| fileId | UUID | For `file` type | Upload via `POST /files/upload` first |
| textContent | string | For `text` type | |

**Response 201:** Created submission object.

**Errors:**
- `400` — Deadline has passed
- `400` — Wrong submission type (e.g. sending fileId for a text assignment)

---

## Assignment Object Shape
```json
{
  "id": "uuid",
  "classOfferingId": "uuid",
  "teacherId": "uuid",
  "title": "Chapter 3 Worksheet",
  "description": "Complete all exercises on pages 45-50.",
  "submissionType": "file",
  "attachmentFileId": null,
  "deadline": "2026-05-15T23:59:00.000Z",
  "maxScore": 100,
  "published": true,
  "termId": null,
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z"
}
```

## Submission Status Values
| Status | Meaning |
|--------|---------|
| `pending` | Not yet submitted |
| `submitted` | Student submitted |
| `graded` | Teacher graded (not yet released) |
| `returned` | Grade released to student |
