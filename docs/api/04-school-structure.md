# School Structure API

Two controller prefixes:
- No prefix: `/grades`, `/sections`, `/subjects` — basic CRUD
- `/school-structure`: grade-section and grade-subject assignments

All endpoints are **admin only**.

---

## GRADES

### GET /grades
List all grades.

**Response 200:**
```json
[
  { "id": "uuid", "name": "Grade 9", "orderIndex": 9, "createdAt": "...", "updatedAt": "..." },
  { "id": "uuid", "name": "Grade 10", "orderIndex": 10, "createdAt": "...", "updatedAt": "..." }
]
```

### POST /grades
Create a grade.

**Request body:**
```json
{
  "name": "Grade 9",
  "orderIndex": 9,
  "sectionIds": ["uuid1", "uuid2"],
  "subjectIds": ["uuid3", "uuid4"]
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✅ | e.g. `"Grade 9"` |
| orderIndex | number | ❌ | For sorting |
| sectionIds | UUID[] | ❌ | Assign sections on creation |
| subjectIds | UUID[] | ❌ | Assign subjects on creation |

**Response 201:** Created grade object.

### PATCH /grades/:id
Update a grade. Same body as POST (all optional).

### DELETE /grades/:id
Delete a grade. Returns `{ "ok": true }`.

---

## SECTIONS

### GET /sections
List all sections.

**Response 200:**
```json
[
  { "id": "uuid", "name": "A", "createdAt": "...", "updatedAt": "..." },
  { "id": "uuid", "name": "B", "createdAt": "...", "updatedAt": "..." }
]
```

### POST /sections
Create a section.

**Request body:**
```json
{ "name": "A" }
```

### PATCH /sections/:id
Update a section.

### DELETE /sections/:id
Delete a section. Returns `{ "ok": true }`.

---

## SUBJECTS

### GET /subjects
List all subjects.

**Response 200:**
```json
[
  { "id": "uuid", "name": "Mathematics", "code": "MATH101", "createdAt": "...", "updatedAt": "..." }
]
```

### POST /subjects
Create a subject.

**Request body:**
```json
{ "name": "Mathematics", "code": "MATH101" }
```
| Field | Type | Required |
|-------|------|----------|
| name | string | ✅ |
| code | string | ❌ |

### PATCH /subjects/:id
Update a subject.

### DELETE /subjects/:id
Delete a subject. Returns `{ "ok": true }`.

---

## GRADE-SECTION ASSIGNMENTS

### POST /school-structure/grades/:gradeId/sections
Assign a section to a grade.

**Request body:**
```json
{ "sectionId": "uuid" }
```

**Response 201:** The created assignment record.

### GET /school-structure/grades/:gradeId/sections
Get all sections assigned to a grade.

**Response 200:** Array of section objects.

### GET /school-structure/grades/:gradeId/available-sections
Get sections available for class offering creation (not yet used for a given subject+year).

**Query params:**
| Param | Type | Required |
|-------|------|----------|
| subjectId | UUID | ✅ |
| academicYearId | UUID | ✅ |

**Response 200:** Array of available section objects.

### DELETE /school-structure/grades/:gradeId/sections/:sectionId
Remove a section from a grade. Returns `{ "ok": true }`.

---

## GRADE-SUBJECT ASSIGNMENTS

### POST /school-structure/grades/:gradeId/subjects
Assign a subject to a grade.

**Request body:**
```json
{ "subjectId": "uuid" }
```

### GET /school-structure/grades/:gradeId/subjects
Get all subjects assigned to a grade.

**Response 200:** Array of subject objects.

### DELETE /school-structure/grades/:gradeId/subjects/:subjectId
Remove a subject from a grade. Returns `{ "ok": true }`.

---

## Typical Setup Flow (Admin)
1. Create grades: `POST /grades`
2. Create sections: `POST /sections`
3. Create subjects: `POST /subjects`
4. Assign sections to grades: `POST /school-structure/grades/:id/sections`
5. Assign subjects to grades: `POST /school-structure/grades/:id/subjects`
6. Create class offerings: `POST /class-offerings`
