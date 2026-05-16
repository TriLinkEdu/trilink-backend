# Class Offerings API

Base path: `/class-offerings`

A class offering = one subject taught by one teacher to one grade+section in one academic year.

---

## GET /class-offerings/mine
Get class offerings for the authenticated teacher (or any teacher if admin).

**Auth required:** Yes (teacher, admin)

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| academicYearId | UUID | ✅ | |
| teacherId | UUID | ❌ | Admin only — inspect another teacher's schedule |

**Response 200:** Array of enriched class offering objects (see shape below).

---

## GET /class-offerings
List all class offerings for an academic year.

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Required |
|-------|------|----------|
| academicYearId | UUID | ✅ |

**Behavior:**
- Admin: returns all offerings for the year
- Teacher: returns only their own offerings (same as `/mine`)

**Response 200:** Array of enriched class offering objects.

---

## GET /class-offerings/:id
Get a single class offering.

**Auth required:** Yes (admin, teacher)

**Behavior:**
- Admin: any offering
- Teacher: only if they are assigned as the teacher

**Response 200:** Single enriched class offering object.

**Errors:**
- `403` — Teacher does not teach this class
- `404` — Not found

---

## POST /class-offerings
Create a class offering. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "name": "Advanced Math 9A"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| academicYearId | UUID | ✅ | |
| gradeId | UUID | ✅ | |
| sectionId | UUID | ✅ | |
| subjectId | UUID | ✅ | |
| teacherId | UUID | ✅ | Must be a user with role `teacher` |
| name | string | ❌ | Custom display name; if omitted, auto-generated as "Grade 9 A \| Mathematics" |

**Response 201:** Created class offering object.

**Errors:**
- `400` — teacherId is not a teacher user
- `409` — A class offering already exists for this grade+section+subject+year combination

---

## POST /class-offerings/bulk
Bulk create class offerings for multiple sections and subjects. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionIds": ["uuid1", "uuid2"],
  "subjectIds": ["uuid3", "uuid4"],
  "teacherId": "uuid"
}
```

Creates one offering per section × subject combination (e.g. 2 sections × 4 subjects = 8 offerings).

**Response 201:**
```json
{
  "created": 8,
  "skipped": 0,
  "offerings": [...]
}
```

---

## PATCH /class-offerings/:id
Update a class offering. **Admin only.**

**Auth required:** Yes (admin)

**Request body (all optional):**
```json
{
  "teacherId": "uuid",
  "name": "New Name"
}
```

**Response 200:** Updated class offering object.

---

## DELETE /class-offerings/:id
Delete a class offering. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** `{ "ok": true }`

---

## Enriched Class Offering Object Shape
```json
{
  "id": "uuid",
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "name": null,
  "courseCode": null,
  "gradeName": "Grade 9",
  "sectionName": "A",
  "subjectName": "Mathematics",
  "teacherName": "Jane Doe",
  "displayName": "Grade 9 A | Mathematics",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

> **Note:** `displayName` is computed: uses `name` if set, otherwise `"Grade 9 A | Mathematics"`.
