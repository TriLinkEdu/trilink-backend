# Dashboard API

Base path: `/dashboard`

Role-specific dashboards that aggregate key data for each user type.

---

## GET /dashboard/admin
Admin summary counts.

**Auth required:** Yes (admin)

**Response 200:**
```json
{
  "totalStudents": 450,
  "totalTeachers": 32,
  "totalParents": 380,
  "totalClasses": 48,
  "activeAcademicYear": { "id": "uuid", "label": "2025-2026" }
}
```

---

## GET /dashboard/teacher
Teacher dashboard.

**Auth required:** Yes (teacher)

**Response 200:**
```json
{
  "classCount": 4,
  "studentCount": 120,
  "pendingGrading": {
    "assignments": 8,
    "exams": 3
  },
  "upcomingExams": [...],
  "recentAttendance": [...]
}
```

---

## GET /dashboard/student
Student dashboard.

**Auth required:** Yes (student)

**Response 200:**
```json
{
  "enrolledClasses": 6,
  "upcomingExams": [
    {
      "id": "uuid",
      "title": "Biology Midterm",
      "opensAt": "2026-05-10T09:00:00.000Z",
      "closesAt": "2026-05-10T11:00:00.000Z",
      "maxPoints": 100,
      "status": "upcoming",
      "score": null,
      "classOfferingId": "uuid"
    }
  ],
  "pendingAssignments": [
    {
      "id": "uuid",
      "title": "Chapter 3 Worksheet",
      "deadline": "2026-05-15T23:59:00.000Z",
      "maxScore": 100,
      "status": "pending",
      "score": null,
      "classOfferingId": "uuid"
    }
  ],
  "recentGrades": [...],
  "attendanceSummary": {
    "total": 60,
    "present": 55,
    "absent": 3,
    "excused": 2,
    "attendancePercent": 91.7
  }
}
```

---

## GET /dashboard/parent
Parent dashboard.

**Auth required:** Yes (parent)

**Response 200:**
```json
{
  "children": [
    {
      "id": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "grade": "Grade 9",
      "section": "A"
    }
  ],
  "unreadNotifications": 3
}
```

---

## GET /dashboard/children/:studentId/summary
High-level child summary. **Parent, admin.**

**Auth required:** Yes (parent, admin)

**Behavior:** Same as `GET /dashboard/student` but for a linked child.

**Errors:**
- `403` — Not linked to this student (parent only)

---

## GET /dashboard/children/:studentId
Full child dashboard with grades, attendance, and upcoming activities.

**Auth required:** Yes (parent, admin)

**Response 200:**
```json
{
  "student": {
    "id": "uuid",
    "firstName": "Ali",
    "lastName": "Hassan",
    "email": "ali@school.edu"
  },
  "grades": {
    "overallAveragePercent": 81.4,
    "bySubject": [
      {
        "subjectId": "uuid",
        "subjectName": "Biology",
        "gradedEntries": 5,
        "averagePercent": 84.2
      }
    ]
  },
  "attendance": {
    "overall": {
      "total": 60,
      "present": 52,
      "absent": 4,
      "excused": 4,
      "attendancePercent": 86.7
    },
    "bySubject": [
      {
        "subjectId": "uuid",
        "subjectName": "Biology",
        "total": 20,
        "present": 18,
        "absent": 1,
        "excused": 1,
        "attendancePercent": 90.0
      }
    ]
  },
  "upcoming": {
    "exams": [
      {
        "id": "uuid",
        "title": "Biology Midterm",
        "opensAt": "2026-05-10T09:00:00.000Z",
        "closesAt": "2026-05-10T11:00:00.000Z",
        "maxPoints": 100,
        "status": "upcoming",
        "score": null,
        "classOfferingId": "uuid"
      }
    ],
    "assignments": [
      {
        "id": "uuid",
        "title": "Chapter 3 Worksheet",
        "deadline": "2026-05-15T23:59:00.000Z",
        "maxScore": 100,
        "status": "pending",
        "score": null,
        "classOfferingId": "uuid"
      }
    ],
    "summary": {
      "examsTotal": 2,
      "examsAvailable": 0,
      "assignmentsTotal": 3,
      "assignmentsPending": 2
    }
  }
}
```

**Errors:**
- `403` — Not linked to this student (parent only)
- `404` — Student not found
