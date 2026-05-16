# Report Cards API

Base path: `/report-cards`

Report cards aggregate grades, attendance, and homeroom remarks for a student per term.

---

## POST /report-cards/remarks
Add or update a homeroom teacher's remark for a student for a term.

**Auth required:** Yes (admin, teacher)

**Access rules:**
- Admin: can add remarks for any student
- Teacher: must be the homeroom teacher for that student's class in the term's academic year

**Request body:**
```json
{
  "studentId": "uuid",
  "termId": "uuid",
  "remark": "Ali is an excellent student who consistently demonstrates strong academic performance and positive attitude.",
  "conductGrade": "A"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| studentId | UUID | ✅ | |
| termId | UUID | ✅ | |
| remark | string | ✅ | Homeroom teacher's overall comment |
| conductGrade | string | ❌ | e.g. `"A"`, `"B+"`, `"Excellent"` |

**Behavior:** If a remark already exists for this student+term, it is updated.

**Response 201:** Created/updated remark object.

**Errors:**
- `403` — Teacher is not the homeroom teacher for this student in this term's year

---

## GET /report-cards/student/:studentId/term/:termId
Get the full report card for a student for a term.

**Auth required:** Yes (admin, teacher, student, parent)

**Access rules:**
- Student: own report card only
- Parent: linked child's report card only
- Teacher: any student (subject teacher or homeroom teacher)
- Admin: any student

**Response 200:**
```json
{
  "student": {
    "id": "uuid",
    "firstName": "Ali",
    "lastName": "Hassan",
    "grade": "Grade 9",
    "section": "A",
    "profileImageFileId": null
  },
  "academicYear": {
    "id": "uuid",
    "label": "2025-2026"
  },
  "term": {
    "id": "uuid",
    "name": "Term 1",
    "startDate": "2025-09-01",
    "endDate": "2025-12-15"
  },
  "subjects": [
    {
      "subjectId": "uuid",
      "subjectName": "Mathematics",
      "classOfferingId": "uuid",
      "teacherName": "Jane Doe",
      "entries": [
        {
          "title": "Quiz 1",
          "type": "quiz",
          "score": 88,
          "maxScore": 100,
          "percent": 88.0,
          "releasedAt": "2025-10-01T00:00:00.000Z"
        },
        {
          "title": "Assignment 1",
          "type": "assignment",
          "score": 92,
          "maxScore": 100,
          "percent": 92.0,
          "releasedAt": "2025-10-15T00:00:00.000Z"
        }
      ],
      "summary": {
        "totalEntries": 2,
        "averagePercent": 90.0,
        "letterGrade": "A+"
      }
    },
    {
      "subjectId": "uuid",
      "subjectName": "Biology",
      "classOfferingId": "uuid",
      "teacherName": "Abdu Isa",
      "entries": [...],
      "summary": {
        "totalEntries": 3,
        "averagePercent": 78.5,
        "letterGrade": "B+"
      }
    }
  ],
  "attendance": {
    "present": 45,
    "absent": 2,
    "late": 1,
    "excused": 0,
    "total": 48,
    "attendancePercent": 95.8
  },
  "overallGpa": 3.3,
  "overallPercent": 84.3,
  "overallLetterGrade": "A-",
  "homeroomRemark": {
    "remark": "Excellent student, keep it up!",
    "conductGrade": "A"
  },
  "generatedAt": "2026-05-07T12:00:00.000Z"
}
```

**`homeroomRemark` is `null` if no remark has been added yet.**

**Errors:**
- `403` — Not allowed to view this student
- `404` — Student or term not found

---

## GET /report-cards/class/:gradeId/:sectionId/term/:termId
Get a ranked summary of all students in a class for a term.

**Auth required:** Yes (admin, teacher)

**Access rules:**
- Admin: any class
- Teacher: must be the homeroom teacher for this grade+section

**Response 200:**
```json
{
  "gradeId": "uuid",
  "sectionId": "uuid",
  "termId": "uuid",
  "students": [
    {
      "studentId": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "overallPercent": 92.5,
      "overallLetterGrade": "A+",
      "attendancePercent": 97.0,
      "rank": 1
    },
    {
      "studentId": "uuid",
      "firstName": "Sara",
      "lastName": "Ahmed",
      "overallPercent": 88.0,
      "overallLetterGrade": "B+",
      "attendancePercent": 95.0,
      "rank": 2
    }
  ]
}
```

Students are ranked by `overallPercent` descending.

**Errors:**
- `403` — Teacher is not the homeroom teacher for this class

---

## GET /report-cards/student/:studentId/academic-year/:academicYearId
Get report cards for all terms in an academic year (full-year transcript).

**Auth required:** Yes (admin, teacher, student, parent)

**Access rules:** Same as single term report card.

**Response 200:**
```json
{
  "student": {
    "id": "uuid",
    "firstName": "Ali",
    "lastName": "Hassan",
    "grade": "Grade 9",
    "section": "A"
  },
  "academicYear": {
    "id": "uuid",
    "label": "2025-2026"
  },
  "terms": [
    {
      "term": {
        "id": "uuid",
        "name": "Term 1",
        "startDate": "2025-09-01",
        "endDate": "2025-12-15"
      },
      "subjects": [
        {
          "classOfferingId": "uuid",
          "subjectId": "uuid",
          "subjectName": "Mathematics",
          "averagePercent": 90.0,
          "letterGrade": "A+"
        }
      ],
      "overallPercent": 87.5,
      "overallLetterGrade": "B+",
      "attendance": {
        "present": 45,
        "absent": 2,
        "late": 1,
        "excused": 0,
        "total": 48,
        "attendancePercent": 95.8
      },
      "homeroomRemark": {
        "remark": "Great term!",
        "conductGrade": "A"
      }
    },
    {
      "term": { "id": "uuid", "name": "Term 2", ... },
      ...
    }
  ],
  "generatedAt": "2026-05-07T12:00:00.000Z"
}
```

---

## Letter Grade Scale
| Percent | Letter Grade | GPA (4.0) |
|---------|-------------|-----------|
| ≥ 90 | A+ | 4.0 |
| ≥ 85 | A | 4.0 |
| ≥ 80 | A- | 3.7 |
| ≥ 75 | B+ | 3.3 |
| ≥ 70 | B | 3.0 |
| ≥ 65 | B- | 2.7 |
| ≥ 60 | C+ | 2.3 |
| ≥ 55 | C | 2.0 |
| ≥ 50 | C- | 1.7 |
| ≥ 45 | D | 1.0 |
| < 45 | F | 0.0 |

## Grade Matching Logic
The report card collects grade entries for a term using two strategies:
1. **Direct match:** Entries with `termId` matching the requested term
2. **Date range fallback:** Entries without `termId` but with `createdAt` between `term.startDate` and `term.endDate`

This ensures backward compatibility with grades entered before `termId` was added.
