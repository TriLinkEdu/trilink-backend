# Homeroom API

Base path: `/homeroom`

A homeroom teacher is assigned to one grade+section per academic year. They can see all students in their class and write report card remarks.

---

## POST /homeroom/assign
Assign a homeroom teacher to a grade+section for an academic year. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "teacherId": "uuid",
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| teacherId | UUID | ✅ | Must be a user with role `teacher` |
| academicYearId | UUID | ✅ | |
| gradeId | UUID | ✅ | |
| sectionId | UUID | ✅ | |

**Behavior:** If an assignment already exists for this year+grade+section, the teacher is updated. Only one homeroom teacher per class per year is allowed.

**Response 201:**
```json
{
  "id": "uuid",
  "teacherId": "uuid",
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid",
  "createdAt": "2026-05-07T00:00:00.000Z",
  "updatedAt": "2026-05-07T00:00:00.000Z"
}
```

---

## GET /homeroom/my-class
Get the authenticated teacher's homeroom class for the active academic year.

**Auth required:** Yes (teacher)

**Response 200:**
```json
{
  "assignment": {
    "id": "uuid",
    "teacherId": "uuid",
    "academicYearId": "uuid",
    "gradeId": "uuid",
    "sectionId": "uuid",
    "createdAt": "2026-05-07T00:00:00.000Z",
    "updatedAt": "2026-05-07T00:00:00.000Z"
  },
  "students": [
    {
      "id": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "grade": "Grade 9",
      "section": "A",
      "profileImageFileId": null
    }
  ]
}
```

**Errors:**
- `404` — No active academic year, or no homeroom assignment for this teacher

---

## GET /homeroom/assignments
List all homeroom assignments. **Admin only.**

**Auth required:** Yes (admin)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| academicYearId | UUID | Optional filter |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "academicYearId": "uuid",
    "gradeId": "uuid",
    "gradeName": "Grade 9",
    "sectionId": "uuid",
    "sectionName": "A",
    "teacherId": "uuid",
    "teacherFirstName": "Jane",
    "teacherLastName": "Doe",
    "createdAt": "2026-05-07T00:00:00.000Z"
  }
]
```

---

## DELETE /homeroom/assign/:id
Remove a homeroom assignment. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:**
```json
{ "deleted": true }
```

**Errors:**
- `404` — Assignment not found

---

## How Homeroom Connects to Report Cards

1. Admin assigns homeroom teacher: `POST /homeroom/assign`
2. Homeroom teacher views their class: `GET /homeroom/my-class`
3. Homeroom teacher writes remarks for each student: `POST /report-cards/remarks`
4. Anyone with access views the full report card: `GET /report-cards/student/:studentId/term/:termId`

The homeroom teacher's remark appears in the `homeroomRemark` field of the report card.
