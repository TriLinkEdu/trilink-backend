# Enrollments API

Base path: `/enrollments`

An enrollment links a student to a class offering for an academic year.

---

## GET /enrollments
List enrollments with optional filters. **Admin, teacher only.**

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| studentId | UUID | Filter by student |
| classOfferingId | UUID | Filter by class |
| academicYearId | UUID | Filter by year |

**Response 200:** Array of enrollment objects.

---

## GET /enrollments/class/:classOfferingId/students
Get the student roster for a class offering.

**Auth required:** Yes (admin, teacher)

**Behavior:**
- Teacher: only if they teach this class
- Admin: any class

**Response 200:**
```json
{
  "classOfferingId": "uuid",
  "className": "Biology 9A",
  "subject": { "id": "uuid", "name": "Biology", "code": "Bio" },
  "grade": { "id": "uuid", "name": "Grade 9" },
  "section": { "id": "uuid", "name": "A" },
  "studentCount": 25,
  "students": [
    {
      "studentId": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "email": "ali@school.edu",
      "enrollmentId": "uuid"
    }
  ]
}
```

**Errors:**
- `403` — Teacher does not teach this class

---

## GET /enrollments/mine
Get the authenticated student's active enrollments with class, subject, and teacher details.

**Auth required:** Yes (student)

**Response 200:**
```json
[
  {
    "enrollmentId": "uuid",
    "classOfferingId": "uuid",
    "academicYearId": "uuid",
    "status": "active",
    "subject": { "id": "uuid", "name": "Mathematics", "code": "MATH" },
    "grade": { "id": "uuid", "name": "Grade 9" },
    "section": { "id": "uuid", "name": "A" },
    "teacher": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@school.edu" }
  }
]
```

---

## GET /enrollments/mine/subjects
Get the authenticated student's subject list.

**Auth required:** Yes (student)

**Response 200:**
```json
[
  {
    "subjectId": "uuid",
    "subjectName": "Biology",
    "subjectCode": "Bio",
    "classOfferingId": "uuid",
    "gradeName": "Grade 9",
    "sectionName": "A",
    "teacher": { "id": "uuid", "firstName": "Abdu", "lastName": "Isa", "email": "abdu@school.edu" }
  }
]
```

---

## GET /enrollments/children/:studentId
Get a linked child's enrollments. **Parent only.**

**Auth required:** Yes (parent)

**Errors:**
- `403` — Not linked to this student

**Response 200:** Same shape as `GET /enrollments/mine`.

---

## GET /enrollments/children/:studentId/subjects
Get a linked child's subject list. **Parent only.**

**Auth required:** Yes (parent)

**Response 200:** Same shape as `GET /enrollments/mine/subjects`.

**Errors:**
- `403` — Not linked to this student

---

## POST /enrollments
Enroll a student in a class offering. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "studentId": "uuid",
  "classOfferingId": "uuid",
  "academicYearId": "uuid"
}
```

**Response 201:** Created enrollment object.

---

## DELETE /enrollments/:id
Remove an enrollment. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** `{ "ok": true }`

---

## Enrollment Object Shape
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "classOfferingId": "uuid",
  "academicYearId": "uuid",
  "status": "active",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

**Status values:** `active`, `transferred`, `completed`
