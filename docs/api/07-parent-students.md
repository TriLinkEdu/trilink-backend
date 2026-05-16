# Parent-Students API

Base path: `/parent-students`

Links parent users to student users.

---

## GET /parent-students
List parent-student links. **Admin only.**

**Auth required:** Yes (admin)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| parentId | UUID | Filter by parent |
| studentId | UUID | Filter by student |

**Response 200:** Array of link objects.

---

## POST /parent-students
Create a parent-student link. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "parentId": "uuid",
  "studentId": "uuid",
  "relationship": "Father",
  "isPrimary": true
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| parentId | UUID | ✅ | Must be a user with role `parent` |
| studentId | UUID | ✅ | Must be a user with role `student` |
| relationship | string | ✅ | e.g. `"Father"`, `"Mother"`, `"Guardian"` |
| isPrimary | boolean | ❌ | Default `false` |

**Response 201:** Created link object.

---

## GET /parent-students/mychildren
Get the authenticated parent's linked children.

**Auth required:** Yes (parent)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "parentId": "uuid",
    "studentId": "uuid",
    "relationship": "Father",
    "isPrimary": true,
    "student": {
      "id": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "email": "ali@school.edu",
      "grade": "Grade 9",
      "section": "A",
      "profileImageFileId": null
    }
  }
]
```

---

## GET /parent-students/children/:studentId/upcoming
Get upcoming exams and assignments for a linked child. **Parent only.**

**Auth required:** Yes (parent)

**Response 200:**
```json
{
  "student": {
    "id": "uuid",
    "firstName": "Ali",
    "lastName": "Hassan",
    "email": "ali@school.edu"
  },
  "summary": {
    "examsTotal": 3,
    "examsUpcoming": 1,
    "examsMissed": 0,
    "assignmentsTotal": 4,
    "assignmentsPending": 2,
    "assignmentsOverdue": 0
  },
  "exams": [
    {
      "id": "uuid",
      "title": "Biology Midterm",
      "status": "upcoming",
      "opensAt": "2026-05-10T09:00:00.000Z",
      "closesAt": "2026-05-10T11:00:00.000Z",
      "maxPoints": 100,
      "score": null,
      "subjectName": "Biology",
      "gradeName": "Grade 9",
      "sectionName": "A"
    }
  ],
  "assignments": [
    {
      "id": "uuid",
      "title": "Chapter 3 Worksheet",
      "status": "pending",
      "deadline": "2026-05-15T23:59:00.000Z",
      "maxScore": 100,
      "score": null,
      "subjectName": "Biology"
    }
  ]
}
```

**Exam status values:** `upcoming`, `available`, `submitted`, `graded`, `missed`
**Assignment status values:** `pending`, `submitted`, `graded`, `overdue`

**Errors:**
- `403` — Not linked to this student

---

## DELETE /parent-students/:id
Remove a parent-student link. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** `{ "ok": true }`

---

## Link Object Shape
```json
{
  "id": "uuid",
  "parentId": "uuid",
  "studentId": "uuid",
  "relationship": "Father",
  "isPrimary": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```
