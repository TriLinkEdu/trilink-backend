# TriLink Backend — Complete Mobile API Documentation

> **Base URL:** `https://trilink-backend-ms68.onrender.com/api`
>
> **All timestamps** are ISO 8601 (UTC). All IDs are UUIDs unless stated otherwise.
>
> **Authentication:** Every protected endpoint requires `Authorization: Bearer <accessToken>` in the HTTP header.
>
> **Roles:** `admin` | `teacher` | `student` | `parent`

---

## Table of Contents

1. [Health](#1-health)
2. [Authentication](#2-authentication)
3. [Users](#3-users)
4. [School Structure](#4-school-structure)
5. [Academic Years & Terms](#5-academic-years--terms)
6. [Class Offerings](#6-class-offerings)
7. [Enrollments](#7-enrollments)
8. [Announcements](#8-announcements)
9. [Assignments](#9-assignments)
10. [Attendance](#10-attendance)
11. [Exams](#11-exams)
12. [Questions (Question Bank)](#12-questions-question-bank)
13. [Exam Attempts](#13-exam-attempts)
14. [Grades](#14-grades)
15. [Feedback](#15-feedback)
16. [Notifications](#16-notifications)
17. [Files](#17-files)
18. [Chat](#18-chat)
19. [Calendar Events](#19-calendar-events)
20. [Dashboard](#20-dashboard)
21. [Gamification](#21-gamification)
22. [Student Goals](#22-student-goals)
23. [AI (Adaptive Learning)](#23-ai-adaptive-learning)
24. [Analytics](#24-analytics)
25. [Reports](#25-reports)
26. [Report Cards](#26-report-cards)
27. [Homeroom](#27-homeroom)
28. [Parent–Student Links](#28-parentstudent-links)
29. [Student Profiles](#29-student-profiles)
30. [Textbooks](#30-textbooks)
31. [Learning Materials](#31-learning-materials)
32. [Resources (Course Resources)](#32-resources-course-resources)
33. [Curriculum](#33-curriculum)
34. [Topics](#34-topics)
35. [Search](#35-search)
36. [Settings](#36-settings)
37. [Audit Logs](#37-audit-logs)
38. [Integrations & Sync](#38-integrations--sync)

---

## Common Response Patterns

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Missing / expired / invalid JWT |
| 403 | Role not allowed or ownership check failed |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 503 | External service failure |

---

## 1. Health

### `GET /health`
**Auth:** None  
**Roles:** Public

**Response 200:**
```json
{
  "ok": true,
  "service": "trilink-api",
  "time": "2026-05-15T18:00:00.000Z"
}
```

---

## 2. Authentication

### `POST /auth/login`
**Auth:** None

**Request Body:**
```json
{
  "email": "admin@trilink.edu",
  "password": "YourPassword123",
  "role": "admin"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | ✅ | Valid email |
| password | string | ✅ | |
| role | string | ✅ | `admin` \| `teacher` \| `student` \| `parent` |

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@trilink.edu",
    "role": "admin",
    "firstName": "System",
    "lastName": "Admin",
    "mustChangePassword": false,
    "profileImageFileId": null,
    "profileImagePath": null
  }
}
```

**Response 401:**
```json
{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid email or password" }
```

---

### `POST /auth/refresh`
**Auth:** None

**Request Body:**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Response 200:** Same shape as `/auth/login` response.

**Response 401:**
```json
{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid or expired refresh token" }
```

---

### `GET /auth/me`
**Auth:** Bearer token  
**Roles:** All

Returns the currently authenticated user's public profile.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@trilink.edu",
  "role": "student",
  "firstName": "Ali",
  "lastName": "Hassan",
  "phone": "+251911234567",
  "grade": "Grade 9",
  "section": "A",
  "mustChangePassword": false,
  "profileImageFileId": "uuid",
  "profileImagePath": "https://cdn.example.com/path/to/image.jpg"
}
```

---

### `POST /auth/change-password`
**Auth:** Bearer token  
**Roles:** All

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

**Response 200:**
```json
{ "ok": true }
```

**Response 401:** Wrong current password.

---

### `POST /auth/register`
**Auth:** Bearer token  
**Roles:** `admin` only

Register a new user (student, teacher, or parent).

**Request Body — Student:**
```json
{
  "email": "student@school.edu",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+251911234567",
  "type": "student",
  "grade": "Grade 9",
  "section": "A",
  "tempPassword": "Ab12Cd34"
}
```

**Request Body — Teacher:**
```json
{
  "email": "teacher@school.edu",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+251922345678",
  "type": "teacher",
  "subject": "Mathematics",
  "department": "Science"
}
```

**Request Body — Parent:**
```json
{
  "email": "parent@example.com",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "phone": "+251933456789",
  "type": "parent",
  "linkedStudentId": "550e8400-e29b-41d4-a716-446655440002",
  "relationship": "Father",
  "isPrimaryLink": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | ✅ | |
| firstName | string | ✅ | |
| lastName | string | ✅ | |
| phone | string | ❌ | |
| type | string | ✅ | `student` \| `teacher` \| `parent` |
| grade | string | student only | e.g. `"Grade 9"` |
| section | string | student only | e.g. `"A"` |
| subject | string | teacher only | |
| department | string | teacher only | |
| linkedStudentId | UUID | parent only | Link to a student |
| relationship | string | parent only | e.g. `"Father"` |
| isPrimaryLink | boolean | ❌ | |
| tempPassword | string | ❌ | Auto-generated if omitted |

**Response 201:**
```json
{
  "id": "uuid",
  "email": "student@school.edu",
  "role": "student",
  "firstName": "John",
  "lastName": "Doe",
  "mustChangePassword": true,
  "tempPassword": "Ab12Cd34",
  "registrationEmailSent": false
}
```

**Response 409:** Email already registered.

---

## 3. Users

### `GET /users`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Query Parameters:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| role | string | ❌ | `admin` \| `teacher` \| `student` \| `parent` |
| q | string | ❌ | Name / email search |

**Response 200:** Array of public user objects.

---

### `GET /users/search`
**Auth:** Bearer token  
**Roles:** All

Same as `GET /users` — available to all roles for chat user lookup.

---

### `GET /users/students`
**Auth:** Bearer token  
**Roles:** `admin`

Query Parameters:

| Param | Type | Notes |
|-------|------|-------|
| grade | string | e.g. `"Grade 9"` |
| section | string | e.g. `"A"` |
| academicYearId | UUID | |
| q | string | Name/email search |

**Response 200:** Array of student user objects.

---

### `GET /users/teachers`
**Auth:** Bearer token  
**Roles:** `admin`

| Param | Type | Notes |
|-------|------|-------|
| subject | string | |
| department | string | |
| q | string | |

**Response 200:** Array of teacher user objects.

---

### `GET /users/parents`
**Auth:** Bearer token  
**Roles:** `admin`

| Param | Type | Notes |
|-------|------|-------|
| studentGrade | string | |
| studentSection | string | |
| q | string | |

**Response 200:** Array of parent user objects.

---

### `GET /users/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Response 200:** Public user object.

---

### `GET /users/:userId/profile`
**Auth:** Bearer token  
**Roles:** All

Returns minimal profile for chat modals.

**Response 200:**
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@school.edu",
  "role": "teacher",
  "grade": null,
  "section": null,
  "subject": "Mathematics",
  "department": "Science",
  "profileImageFileId": "uuid"
}
```

---

### `PATCH /users/me`
**Auth:** Bearer token  
**Roles:** All

Update own profile.

**Request Body (all fields optional):**
```json
{
  "firstName": "Ali",
  "lastName": "Hassan",
  "phone": "+251911234567",
  "grade": "Grade 9",
  "section": "A",
  "subject": "Mathematics",
  "department": "Science",
  "homeroomClass": "9A",
  "experience": "5 years",
  "country": "Ethiopia",
  "cityState": "Addis Ababa",
  "postalCode": "1000",
  "officeRoom": "101",
  "childName": "Ali",
  "relationship": "Father",
  "profileImageFileId": "uuid"
}
```

**Response 200:** Updated public user object with image path.

---

### `PATCH /users/:id`
**Auth:** Bearer token  
**Roles:** `admin`

Same body as `PATCH /users/me`. Admin can update any user.

---

## 4. School Structure

> All school structure endpoints require `admin` role.

### `GET /grades`
**Roles:** `admin`  
**Response 200:** Array of grade objects `{ id, name, orderIndex }`.

### `POST /grades`
**Roles:** `admin`  
**Request Body:**
```json
{
  "name": "Grade 9",
  "orderIndex": 9,
  "sectionIds": ["uuid1", "uuid2"],
  "subjectIds": ["uuid3", "uuid4"]
}
```

### `PATCH /grades/:id`
**Roles:** `admin`  
Same body fields, all optional.

### `DELETE /grades/:id`
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

### `GET /sections`
**Roles:** `admin`  
**Response 200:** Array of `{ id, name }`.

### `POST /sections`
**Request Body:** `{ "name": "A" }`

### `PATCH /sections/:id`
**Request Body:** `{ "name": "B" }`

### `DELETE /sections/:id`
**Response 200:** `{ "ok": true }`

---

### `GET /subjects`
**Roles:** `admin`  
**Response 200:** Array of `{ id, name, code }`.

### `POST /subjects`
**Request Body:** `{ "name": "Mathematics", "code": "MATH101" }`

### `PATCH /subjects/:id`
**Request Body (all optional):** `{ "name": "Math", "code": "MATH" }`

### `DELETE /subjects/:id`
**Response 200:** `{ "ok": true }`

---

### Grade–Section Associations

#### `POST /school-structure/grades/:gradeId/sections`
**Roles:** `admin`  
**Request Body:** `{ "sectionId": "uuid" }`

#### `GET /school-structure/grades/:gradeId/sections`
**Roles:** `admin`  
**Response 200:** Array of section objects for the grade.

#### `GET /school-structure/grades/:gradeId/available-sections`
**Roles:** `admin`  
**Query Params:** `subjectId` (UUID, required), `academicYearId` (UUID, required)  
Returns sections not yet used in a class offering for this grade+subject+year.

#### `DELETE /school-structure/grades/:gradeId/sections/:sectionId`
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

### Grade–Subject Associations

#### `POST /school-structure/grades/:gradeId/subjects`
**Roles:** `admin`  
**Request Body:** `{ "subjectId": "uuid" }`

#### `GET /school-structure/grades/:gradeId/subjects`
**Roles:** `admin`  
**Response 200:** Array of subject objects for the grade.

#### `DELETE /school-structure/grades/:gradeId/subjects/:subjectId`
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

## 5. Academic Years & Terms

### `GET /academic-years/active`
**Auth:** Bearer token  
**Roles:** All

Returns the currently active (non-archived) academic year.

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "label": "2025/2026",
    "isActive": true,
    "isArchived": false,
    "startDate": "2025-09-01",
    "endDate": "2026-07-31"
  }
}
```

### `GET /academic-years/current`
**Auth:** Bearer token  
**Roles:** All  
Alias for `/academic-years/active`.

---

### `GET /academic-years`
**Auth:** Bearer token  
**Roles:** `admin`  
**Response 200:** Array of all academic years.

### `GET /academic-years/:id`
**Auth:** Bearer token  
**Roles:** `admin`  
Returns academic year with its terms.

### `POST /academic-years`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{
  "label": "2025/2026",
  "startDate": "2025-09-01",
  "endDate": "2026-07-31"
}
```

### `PATCH /academic-years/:id`
**Auth:** Bearer token  
**Roles:** `admin`  
Same body, all optional.

### `POST /academic-years/:id/activate`
**Auth:** Bearer token  
**Roles:** `admin`  
Sets this year as the only active year (deactivates others).  
**Response 200:** Updated academic year.

### `POST /academic-years/:id/close`
**Auth:** Bearer token  
**Roles:** `admin`  
Archives and deactivates the year.

### `POST /academic-years/:id/rollover`
**Auth:** Bearer token  
**Roles:** `admin`  
**Query Params:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| newLabel | string | ✅ | e.g. `"2026/2027"` |
| dryRun | boolean | ❌ | Preview only (default: false) |

Creates a new active year and copies class offerings from the source year.

### `DELETE /academic-years/:id`
**Auth:** Bearer token  
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

### Terms

#### `GET /academic-years/:yearId/terms`
**Auth:** Bearer token  
**Roles:** All

**Response 200:** Array of terms:
```json
[
  { "id": "uuid", "name": "Term 1", "startDate": "2025-09-01", "endDate": "2025-12-15", "academicYearId": "uuid" }
]
```

#### `POST /academic-years/:yearId/terms`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{
  "name": "Term 1",
  "startDate": "2025-09-01",
  "endDate": "2025-12-15"
}
```

#### `DELETE /academic-years/terms/:termId`
**Auth:** Bearer token  
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

## 6. Class Offerings

A class offering = one subject taught in one section by one teacher for one academic year.

### `GET /class-offerings/mine`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Query Params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| academicYearId | UUID | ✅ | |
| teacherId | UUID | ❌ | Admin only — inspect another teacher |

**Response 200:** Array of class offerings for the teacher.

---

### `GET /class-offerings`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

| Param | Type | Required |
|-------|------|----------|
| academicYearId | UUID | ✅ |

Admin: all offerings. Teacher: only their own.

---

### `GET /class-offerings/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns a single class offering. Teacher must be assigned to it.

---

### `POST /class-offerings`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "name": "Math 9A"
}
```

---

### `POST /class-offerings/bulk`
**Auth:** Bearer token  
**Roles:** `admin`

Create multiple offerings for multiple sections and subjects at once.

**Request Body:**
```json
{
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionIds": ["uuid1", "uuid2"],
  "subjectIds": ["uuid3", "uuid4"],
  "teacherId": "uuid"
}
```

---

### `PATCH /class-offerings/:id`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body (optional fields):**
```json
{ "teacherId": "uuid", "name": "Bio 9A" }
```

---

### `DELETE /class-offerings/:id`
**Auth:** Bearer token  
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

## 7. Enrollments

### `GET /enrollments`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Query Params:

| Param | Type |
|-------|------|
| studentId | UUID |
| classOfferingId | UUID |
| academicYearId | UUID |

**Response 200:** Array of enrollment records.

---

### `GET /enrollments/class/:classOfferingId/students`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns the student roster for a class.

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
    { "studentId": "uuid", "firstName": "Ali", "lastName": "Hassan", "email": "ali@school.edu", "enrollmentId": "uuid" }
  ]
}
```

---

### `GET /enrollments/mine`
**Auth:** Bearer token  
**Roles:** `student`

Returns the authenticated student's active enrollments with class, subject, and teacher details.

---

### `GET /enrollments/children/:studentId`
**Auth:** Bearer token  
**Roles:** `parent`

Returns linked child's enrollments.

---

### `GET /enrollments/children/:studentId/subjects`
**Auth:** Bearer token  
**Roles:** `parent`

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

### `GET /enrollments/mine/subjects`
**Auth:** Bearer token  
**Roles:** `student`

Same structure as above — subjects for the authenticated student.

---

### `POST /enrollments`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{
  "studentId": "uuid",
  "classOfferingId": "uuid",
  "academicYearId": "uuid"
}
```

---

### `POST /enrollments/assign-section`
**Auth:** Bearer token  
**Roles:** `admin`

Assigns students to a grade/section AND enrolls them in all class offerings for that section.

**Request Body:**
```json
{
  "academicYearId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid",
  "studentIds": ["uuid1", "uuid2", "uuid3"]
}
```

---

### `POST /enrollments/clear-section`
**Auth:** Bearer token  
**Roles:** `admin`

Removes students from their current section and deletes related enrollments.

**Request Body:**
```json
{ "studentIds": ["uuid1", "uuid2"] }
```

---

### `DELETE /enrollments/:id`
**Auth:** Bearer token  
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

## 8. Announcements

### `GET /announcements/for-me`
**Auth:** Bearer token  
**Roles:** All

Returns announcements visible to the authenticated user based on their role and class memberships.

| Query Param | Type | Notes |
|-------------|------|-------|
| termId | UUID | Optional filter |

**Response 200:** Array of announcement objects:
```json
[
  {
    "id": "uuid",
    "title": "School Holiday Notice",
    "body": "School will be closed on...",
    "audience": "all",
    "academicYearId": "uuid",
    "classOfferingId": null,
    "targetGrade": null,
    "targetSection": null,
    "publishAt": null,
    "authorId": "uuid",
    "createdAt": "2026-05-01T08:00:00.000Z"
  }
]
```

---

### `GET /announcements`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

| Query Param | Type |
|-------------|------|
| academicYearId | UUID |
| termId | UUID |

---

### `POST /announcements`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "academicYearId": "uuid",
  "title": "Field Trip",
  "body": "We will be visiting the science museum...",
  "audience": "all",
  "classOfferingId": "uuid",
  "targetGrade": "Grade 9",
  "targetSection": "A",
  "termId": "uuid",
  "publishAt": "2026-05-20T08:00:00.000Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| academicYearId | ✅ | |
| title | ✅ | |
| body | ✅ | |
| audience | ✅ | `"all"` \| `"class"` \| `"grade"` etc. |
| classOfferingId | ❌ | |
| targetGrade | ❌ | |
| targetSection | ❌ | |
| termId | ❌ | |
| publishAt | ❌ | ISO 8601; hidden until this time |

---

### `PATCH /announcements/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher` (author or admin)

All fields optional, same as POST body.

---

### `DELETE /announcements/:id`
**Auth:** Bearer token  
**Roles:** `admin` (any), `teacher` (own only)  
**Response 200:** `{ "ok": true }`

---

## 9. Assignments

### `POST /assignments`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Creates a **draft** assignment (not visible to students until published).

**Request Body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Chapter 3 Worksheet",
  "description": "Complete all exercises on pages 45–52.",
  "submissionType": "file",
  "attachmentFileId": "uuid",
  "deadline": "2026-05-20T23:59:00.000Z",
  "maxScore": 100,
  "termId": "uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| classOfferingId | UUID | ✅ | |
| title | string | ✅ | |
| description | string | ❌ | |
| submissionType | string | ✅ | `file` \| `text` \| `none` |
| attachmentFileId | UUID | ❌ | Pre-uploaded file to attach |
| deadline | ISO 8601 | ✅ | |
| maxScore | number | ❌ | Default 100 |
| termId | UUID | ❌ | |

**Response 201:** Assignment object.

---

### `PATCH /assignments/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Update a **draft** assignment. Cannot edit a published assignment — unpublish first.  
All fields optional, same as POST body (except `classOfferingId`).

---

### `POST /assignments/:id/publish`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Makes the assignment visible to students and sends notifications.

**Response 201:**
```json
{ "ok": true, "notified": 25 }
```

---

### `POST /assignments/:id/unpublish`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Hides the assignment from students again.

---

### `DELETE /assignments/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher` (draft only)

---

### `GET /assignments/teacher/mine`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns all assignments created by the teacher.

| Query Param | Type | Notes |
|-------------|------|-------|
| classOfferingId | UUID | Optional |
| termId | UUID | Optional |

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

### `GET /assignments/:id/submissions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns all student submissions for an assignment.

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
    "student": { "id": "uuid", "firstName": "Ali", "lastName": "Hassan", "email": "ali@school.edu" },
    "file": { "id": "uuid", "filename": "homework.pdf", "mime": "application/pdf", "path": "https://..." }
  }
]
```

---

### `POST /assignments/submissions/:submissionId/grade`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "score": 88,
  "feedback": "Great work! Watch your units on question 3."
}
```

---

### `POST /assignments/submissions/:submissionId/release`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Releases the grade to the student (sends notification + creates grade ledger entry).

---

### `POST /assignments/:id/release-all`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Releases all graded submissions for an assignment at once.

**Response 201:** `{ "released": 22 }`

---

### `GET /assignments/student/:studentId`
**Auth:** Bearer token  
**Roles:** All

Returns all published assignments for a student's enrolled classes with submission status.

| Query Param | Type |
|-------------|------|
| termId | UUID (optional) |

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

---

### `GET /assignments/:id`
**Auth:** Bearer token  
**Roles:** All

Returns assignment detail. Students also get their submission status.

---

### `POST /assignments/:id/submit`
**Auth:** Bearer token  
**Roles:** `student`

**Request Body:**
```json
{
  "fileId": "uuid",
  "textContent": null
}
```

- For `submissionType = file`: Upload via `POST /files/upload` first, then pass the `fileId`.
- For `submissionType = text`: Pass `textContent`.
- For `submissionType = none`: Empty body.

**Response 201:** Submission object.  
**Response 400:** Deadline has passed or wrong submission type.

---

## 10. Attendance

### `POST /attendance-sessions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "classOfferingId": "uuid",
  "date": "2026-04-22",
  "termId": "uuid"
}
```

**Response 201:** Session object.  
**Response 409:** Session already exists for this date/class.

---

### `GET /attendance-sessions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

| Query Param | Type | Required |
|-------------|------|----------|
| classOfferingId | UUID | ✅ |
| termId | UUID | ❌ |

**Response 200:** Array of session objects ordered by date desc.

---

### `GET /attendance-sessions/my`
**Auth:** Bearer token  
**Roles:** `teacher`

Returns all sessions across every class the authenticated teacher owns.

**Response 200:**
```json
[
  {
    "sessionId": "uuid",
    "date": "2026-04-22",
    "createdAt": "2026-04-22T08:00:00.000Z",
    "classOfferingId": "uuid",
    "className": "Math 9A",
    "subject": { "id": "uuid", "name": "Mathematics", "code": "MATH" },
    "grade": { "id": "uuid", "name": "Grade 9" },
    "section": { "id": "uuid", "name": "A" },
    "teacher": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@school.edu", "department": "Science", "officeRoom": "101" }
  }
]
```

---

### `PUT /attendance-sessions/:id/marks`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Bulk upsert attendance marks for a session (creates or updates).

**Request Body:**
```json
{
  "marks": [
    { "studentId": "uuid", "status": "present", "note": null },
    { "studentId": "uuid", "status": "absent", "note": "Sick" }
  ]
}
```

| Status values | Meaning |
|--------------|---------|
| `present` | Student attended |
| `absent` | Student absent |
| `excused` | Excused absence |
| `late` | Student was late |

**Response 200:** Array of saved mark objects.

---

### `GET /attendance-sessions/:id/marks`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns all marks for a session.

---

### `PATCH /attendance-marks/:markId`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Edit a single mark.

**Request Body:**
```json
{ "status": "excused", "note": "Doctor visit" }
```

---

### `GET /reports/attendance/student/:studentId/by-day`
**Auth:** Bearer token  
**Roles:** All (students/parents restricted to own data)

| Query Param | Type | Required |
|-------------|------|----------|
| date | string | ✅ | `YYYY-MM-DD` |

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "email": "ali@school.edu",
  "grade": "Grade 9",
  "section": "A",
  "date": "2026-04-22",
  "records": [
    {
      "markId": "uuid",
      "status": "present",
      "note": null,
      "sessionId": "uuid",
      "classOfferingId": "uuid",
      "className": "Math 9A",
      "subject": { "id": "uuid", "name": "Mathematics", "code": "MATH" },
      "grade": { "id": "uuid", "name": "Grade 9" },
      "section": { "id": "uuid", "name": "A" },
      "teacher": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "email": "jane@school.edu", "department": "Science", "officeRoom": "101" }
    }
  ]
}
```

---

### `GET /reports/attendance/student/:studentId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Full attendance history for a student across all sessions, sorted by date desc.

---

### `GET /reports/attendance/student/:studentId/by-subject/:subjectId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "subjectId": "uuid",
  "subjectName": "Biology",
  "summary": { "total": 20, "present": 17, "absent": 2, "excused": 1, "attendanceRate": 90.0 },
  "sessions": [
    {
      "sessionId": "uuid",
      "date": "2026-04-22",
      "status": "present",
      "note": null,
      "classOfferingId": "uuid",
      "className": "Biology 9A",
      "subject": { "id": "uuid", "name": "Biology", "code": "Bio" },
      "grade": { "id": "uuid", "name": "Grade 9" },
      "section": { "id": "uuid", "name": "A" },
      "teacher": { "id": "uuid", "firstName": "Abdu", "lastName": "Isa", "email": "abdu@school.edu", "department": "Science", "officeRoom": null }
    }
  ]
}
```

---

### `GET /reports/attendance/class/:classOfferingId`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Full attendance report for a class with all sessions and marks.

**Response 200:**
```json
{
  "classOfferingId": "uuid",
  "className": "Biology 9A",
  "subject": { "id": "uuid", "name": "Biology", "code": "Bio" },
  "grade": { "id": "uuid", "name": "Grade 9" },
  "section": { "id": "uuid", "name": "A" },
  "teacher": { "id": "uuid", "firstName": "Abdu", "lastName": "Isa", "email": "abdu@school.edu", "department": "Science", "officeRoom": null },
  "sessions": [
    {
      "sessionId": "uuid",
      "date": "2026-04-04",
      "marks": [
        {
          "id": "uuid",
          "sessionId": "uuid",
          "studentId": "uuid",
          "studentFirstName": "Ali",
          "studentLastName": "Hassan",
          "studentEmail": "ali@school.edu",
          "status": "present",
          "note": null,
          "createdAt": "2026-04-04T09:04:21.246Z"
        }
      ]
    }
  ]
}
```

---

### `GET /reports/attendance/student/:studentId/term/:termId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

**Response 200:**
```json
{
  "studentId": "uuid",
  "firstName": "Ali",
  "lastName": "Hassan",
  "termId": "uuid",
  "termName": "Term 1",
  "present": 45,
  "absent": 2,
  "late": 1,
  "excused": 0,
  "total": 48,
  "attendancePercent": 95.8,
  "sessions": [
    { "sessionId": "uuid", "date": "2025-11-01", "classOfferingId": "uuid", "status": "present", "note": null }
  ]
}
```

---

## 11. Exams

### `POST /exams`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Creates an exam draft (not visible to students until published).

**Request Body:**
```json
{
  "title": "Biology Midterm",
  "academicYearId": "uuid",
  "classOfferingId": "uuid",
  "opensAt": "2026-05-10T09:00:00.000Z",
  "closesAt": "2026-05-10T11:00:00.000Z",
  "durationMinutes": 90,
  "minStayMinutes": 30,
  "maxPoints": 100,
  "termId": "uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✅ | |
| academicYearId | UUID | ✅ | |
| classOfferingId | UUID | ❌ | Scope to one class |
| opensAt | ISO 8601 | ✅ | |
| closesAt | ISO 8601 | ✅ | |
| durationMinutes | number | ✅ | |
| minStayMinutes | number | ❌ | Default 0 |
| maxPoints | number | ❌ | Default 100 |
| termId | UUID | ❌ | |

---

### `GET /exams`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`, `student`

| Query Param | Type | Notes |
|-------------|------|-------|
| academicYearId | UUID | Optional |
| termId | UUID | Optional |

- Admin: all exams.
- Teacher: only exams they created.
- Student: only published exams.

---

### `GET /exams/:id/attempts`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns all student attempts for an exam (grading queue) with scores and `needsManualGrading` flag.

---

### `GET /exams/:id/results/export`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Download released results as CSV.

| Query Param | Notes |
|-------------|-------|
| format | Must be `csv` |

**Response 200:** CSV file download (`Content-Type: text/csv`).

---

### `PATCH /exams/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Update the exam's grading scale.

**Request Body:**
```json
{ "maxPoints": 50 }
```

---

### `POST /exams/:id/questions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Add questions to an exam from the question bank.

**Request Body:**
```json
{
  "items": [
    { "questionId": "uuid", "orderIndex": 1, "points": 10 },
    { "questionId": "uuid", "orderIndex": 2, "points": 15 }
  ]
}
```

---

### `GET /exams/:id/questions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`, `student`

Returns questions attached to an exam. Students only get them during an active attempt window.

---

### `POST /exams/:id/publish`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Makes the exam visible to students.

---

### `GET /exams/:id/students`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Student roster for this exam with attempt status.

**Response 200:** Array of students with `status: not_started | in_progress | submitted` and violation count.

---

### `POST /exams/:id/attempts`
**Auth:** Bearer token  
**Roles:** `student`

Starts a new exam attempt. Can only be called within the exam window.

**Response 201:** Attempt object with `id` (attemptId for subsequent calls).

---

## 12. Questions (Question Bank)

### `POST /questions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "type": "mcq",
  "stem": "What is the powerhouse of the cell?",
  "optionsJson": "[\"Nucleus\",\"Mitochondria\",\"Ribosome\",\"Golgi Apparatus\"]",
  "answerKey": "1",
  "attachmentsJson": null,
  "subjectId": "uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | ✅ | `mcq` \| `true_false` \| `short_answer` \| `essay` |
| stem | string | ✅ | Question text |
| optionsJson | string | ❌ | JSON array for MCQ options |
| answerKey | string | ❌ | For auto-grading MCQ/true_false |
| attachmentsJson | string | ❌ | JSON array of file/url attachments |
| subjectId | UUID | ✅ | |

**Response 201:** Created question.

---

### `GET /questions`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

| Query Param | Type | Notes |
|-------------|------|-------|
| subjectId | UUID | Filter by subject |
| classOfferingId | UUID | Resolves to subject automatically |
| skip | number | Default 0 |
| take | number | Default 30, max 100 |

**Response 200:**
```json
{
  "items": [
    { "id": "uuid", "type": "mcq", "stem": "What is...", "subject": { "id": "uuid", "name": "Biology" } }
  ],
  "total": 42,
  "skip": 0,
  "take": 30
}
```

---

### `DELETE /questions/:id`
**Auth:** Bearer token  
**Roles:** `admin`  
**Response 200:** `{ "ok": true }`

---

## 13. Exam Attempts

### `POST /attempts/:id/answers`
**Auth:** Bearer token  
**Roles:** `student`

Autosave answers during an active exam.

**Request Body:**
```json
{ "answersJson": "{\"q-uuid-1\": 2, \"q-uuid-2\": 0}" }
```

The `answersJson` is a JSON-encoded string mapping questionId → selected option index (for MCQ) or answer string (for essay/short_answer).

---

### `POST /attempts/:id/submit`
**Auth:** Bearer token  
**Roles:** `student`

Submits the attempt. Server validates the time window and minimum stay.

---

### `POST /attempts/:id/grade`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Manually grade an attempt (used for essay/short_answer or override).

**Request Body:**
```json
{ "score": 85 }
```

Score must be between 0 and the exam's `maxPoints`.

---

### `POST /attempts/:id/release`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Releases the result to the student and their linked parents. May auto-award badges.

---

### `POST /attempts/:id/violations`
**Auth:** Bearer token  
**Roles:** `student`

Record a tab-switch / focus-loss violation.

**Request Body:**
```json
{ "reason": "Tab switch detected", "timestamp": "2026-05-10T09:23:00.000Z" }
```

---

### `GET /attempts/:id/violations`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns all recorded violations for an attempt.

---

### `GET /attempts/:id/for-grader`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Full attempt detail for grading: parsed answers JSON, per-question breakdown, and violations.

---

### `GET /attempts/:id/result`
**Auth:** Bearer token  
**Roles:** All

Returns the released result with breakdown.
- Student: own attempt only.
- Parent: only if linked to that student.
- Teacher/Admin: any.

**Response 200:**
```json
{
  "attemptId": "uuid",
  "studentId": "uuid",
  "examTitle": "Biology Midterm",
  "score": 85,
  "maxPoints": 100,
  "percent": 85.0,
  "letterGrade": "B",
  "releasedAt": "2026-05-11T10:00:00.000Z",
  "breakdown": [
    { "questionId": "uuid", "stem": "What is...", "yourAnswer": 1, "correctAnswer": 1, "correct": true, "points": 10 }
  ]
}
```

---

### `GET /attempts/:id/export`
**Auth:** Bearer token  
**Roles:** All (same access as result endpoint)

Download single attempt result as CSV.

| Query Param | Notes |
|-------------|-------|
| format | Must be `csv` |

---

### `POST /attempts/:id/control`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Teacher intervention during a live exam.

**Request Body:**
```json
{ "action": "force_submit", "message": "Time is up" }
```

| Action | Meaning |
|--------|---------|
| `force_submit` | Force-submit student's attempt |
| `warn` | Send warning to student |
| `allow_rejoin` | Allow student to rejoin after disconnection |

---

## 14. Grades

### `POST /grades/bulk`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Submit scores for all students in a class at once.

**Request Body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Assignment 1",
  "type": "assignment",
  "maxScore": 100,
  "note": "Optional note",
  "termId": "uuid",
  "entries": [
    { "studentId": "uuid", "score": 88 },
    { "studentId": "uuid", "score": 75 },
    { "studentId": "uuid", "score": null }
  ]
}
```

| `type` values | Meaning |
|--------------|---------|
| `assignment` | Assignment grade |
| `quiz` | Quiz grade |
| `exam` | Exam grade |
| `midterm` | Midterm |
| `final` | Final exam |
| `project` | Project grade |
| `participation` | Class participation |

---

### `POST /grades`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Create a single grade entry for one student.

**Request Body:**
```json
{
  "classOfferingId": "uuid",
  "studentId": "uuid",
  "title": "Quiz 1",
  "type": "quiz",
  "score": 90,
  "maxScore": 100,
  "note": null,
  "termId": "uuid"
}
```

---

### `PATCH /grades/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Update a grade entry.

**Request Body (all optional):**
```json
{
  "title": "Quiz 1 (revised)",
  "type": "quiz",
  "score": 92,
  "maxScore": 100,
  "note": "Rechecked question 5"
}
```

---

### `POST /grades/release`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Releases all entries for a given classOfferingId + title. Students and parents get notifications.

**Request Body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Assignment 1"
}
```

---

### `DELETE /grades/group`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Delete an entire assessment (all entries with the given classOfferingId + title).

**Request Body:**
```json
{
  "classOfferingId": "uuid",
  "title": "Assignment 1"
}
```

---

### `DELETE /grades/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Delete a single grade entry.

---

### `GET /grades/class/:classOfferingId`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

All grade entries for a class, grouped by title.

**Response 200:**
```json
{
  "classOfferingId": "uuid",
  "groups": [
    {
      "title": "Assignment 1",
      "type": "assignment",
      "maxScore": 100,
      "releasedAt": null,
      "studentCount": 25,
      "entries": [
        { "id": "uuid", "studentId": "uuid", "firstName": "Ali", "lastName": "Hassan", "score": 88, "maxScore": 100, "note": null, "releasedAt": null }
      ]
    }
  ]
}
```

---

### `GET /grades/student/:studentId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

All released grades for a student.

| Query Param | Type |
|-------------|------|
| classOfferingId | UUID (optional) |

---

### `GET /grades/student/:studentId/by-subject/:subjectId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

**Response 200:**
```json
{
  "studentId": "uuid",
  "studentName": "Ali Hassan",
  "subjectId": "uuid",
  "subjectName": "Biology",
  "summary": { "total": 5, "withScore": 5, "averagePercent": 82.4 },
  "entries": [
    { "id": "uuid", "title": "Assignment 1", "type": "assignment", "score": 88, "maxScore": 100, "releasedAt": "2026-04-20T10:00:00.000Z", "note": null }
  ]
}
```

---

### `GET /grades/student/:studentId/term/:termId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Released grade entries for a student in a specific term, grouped by subject.

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
        { "id": "uuid", "title": "Quiz 1", "type": "quiz", "score": 88, "maxScore": 100, "percent": 88.0, "note": null, "releasedAt": "2026-04-20T10:00:00.000Z" }
      ]
    }
  ]
}
```

---

## 15. Feedback

### `POST /feedback`
**Auth:** Bearer token  
**Roles:** `student`, `parent`, `teacher`

**Request Body:**
```json
{
  "category": "teacher",
  "message": "The teacher explains things very clearly.",
  "subjectId": "uuid",
  "teacherId": "uuid",
  "isAnonymous": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| category | string | ✅ | `teacher` \| `school` \| `general` |
| message | string | ✅ | |
| subjectId | UUID | ❌ | |
| teacherId | UUID | ❌ | Required when `category = teacher` |
| isAnonymous | boolean | ❌ | Default `true` |

---

### `GET /feedback/mine`
**Auth:** Bearer token  
**Roles:** `student`, `parent`, `teacher`

Returns non-anonymous feedback submitted by the current user.

**Response 200:** Array of feedback objects.

---

### `GET /feedback/for-teacher`
**Auth:** Bearer token  
**Roles:** `teacher`

Returns all feedback directed at the authenticated teacher. Author is hidden when anonymous.

---

### `GET /feedback/me`
**Auth:** Bearer token  
**Roles:** `student`, `parent`, `teacher`

Alias for `GET /feedback/mine`.

---

### `GET /feedback`
**Auth:** Bearer token  
**Roles:** `admin`

List all feedback with optional filters.

| Query Param | Type | Notes |
|-------------|------|-------|
| subjectId | UUID | |
| teacherId | UUID | |
| senderRole | string | `student` \| `parent` \| `teacher` |
| category | string | `teacher` \| `school` \| `general` |
| grade | string | |
| section | string | |
| dateFrom | ISO 8601 | |
| dateTo | ISO 8601 | |

---

### `PATCH /feedback/:id`
**Auth:** Bearer token  
**Roles:** `admin`

Update feedback status or assignee.

**Request Body:**
```json
{
  "status": "resolved",
  "assigneeId": "uuid"
}
```

---

## 16. Notifications

### `GET /notifications`
**Auth:** Bearer token  
**Roles:** All

Returns notifications for the current user.

| Query Param | Notes |
|-------------|-------|
| unreadOnly | `"true"` to get only unread |

**Response 200:** Array of notification objects:
```json
[
  {
    "id": "uuid",
    "title": "Grade Released",
    "body": "Your score for Assignment 1 is 88/100",
    "type": "grade_released",
    "readAt": null,
    "createdAt": "2026-05-01T10:00:00.000Z"
  }
]
```

---

### `POST /notifications/broadcast`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "title": "Study reminder",
  "body": "Exam is tomorrow at 9AM",
  "audience": "class",
  "classOfferingId": "uuid"
}
```

| `audience` | Notes |
|-----------|-------|
| `class` | Requires `classOfferingId`; teacher must own the class |
| `all_students` | Admin only |

---

### `PATCH /notifications/:id/read`
**Auth:** Bearer token  
**Roles:** All

Marks a notification as read.

---

### `PATCH /notifications/:id/unread`
**Auth:** Bearer token  
**Roles:** All

Marks a notification as unread.

---

### `POST /notifications/read-all`
**Auth:** Bearer token  
**Roles:** All

Marks all of the user's notifications as read.

---

## 17. Files

### `POST /files/upload`
**Auth:** Bearer token  
**Roles:** All

Multipart form upload. Field name must be `file`. Max size: **10 MB**.

If an image is uploaded, it is **automatically set as the user's profile picture**.

```
Content-Type: multipart/form-data
field: file (binary)
```

**Response 200:**
```json
{
  "id": "uuid",
  "filename": "profile.jpg",
  "mime": "image/jpeg",
  "size": 102400,
  "path": "https://cdn.example.com/uploads/profile.jpg"
}
```

---

### `GET /files/:id`
**Auth:** Bearer token  
**Roles:** All

Returns file metadata only (no content).

---

### `GET /files/:id/download`
**Auth:** None (public)

Redirects to the file's CDN URL for download/viewing.

---

## 18. Chat

### `GET /chat/ws-info`
**Auth:** Bearer token  
**Roles:** All

Returns WebSocket connection hints.

**Response 200:**
```json
{
  "protocol": "socket.io",
  "path": "/socket.io",
  "note": "Connect with JWT in auth handshake when enabled on client."
}
```

---

### `POST /conversations`
**Auth:** Bearer token  
**Roles:** All

Create a conversation with members.

**Request Body:**
```json
{
  "type": "group",
  "title": "Grade 9A Biology Group",
  "classOfferingId": "uuid",
  "parentVisible": false,
  "memberIds": ["uuid1", "uuid2", "uuid3"]
}
```

| `type` values | Notes |
|--------------|-------|
| `direct` | 1-on-1 conversation |
| `group` | Group conversation |
| `class` | Class-scoped group |

---

### `GET /conversations`
**Auth:** Bearer token  
**Roles:** All

Returns conversations the user belongs to. Parents also see class threads where `parentVisible = true` and a linked child is a member.

---

### `GET /conversations/all`
**Auth:** Bearer token  
**Roles:** `admin`

Admin moderation view of all conversations.

| Query Param | Notes |
|-------------|-------|
| take | Default 50, max 200 |
| skip | Offset |

---

### `GET /conversations/:id`
**Auth:** Bearer token  
**Roles:** All

Returns a single conversation.

---

### `GET /conversations/:id/messages`
**Auth:** Bearer token  
**Roles:** All

| Query Param | Default |
|-------------|---------|
| limit | 50 |
| skip | 0 |

**Response 200:** Array of message objects:
```json
[
  {
    "id": "uuid",
    "text": "Hello everyone",
    "senderId": "uuid",
    "senderName": "Ali Hassan",
    "mediaFileId": null,
    "replyToId": null,
    "reactions": [],
    "deletedAt": null,
    "createdAt": "2026-05-01T10:00:00.000Z"
  }
]
```

---

### `POST /conversations/:id/messages`
**Auth:** Bearer token  
**Roles:** All

Post a message to a conversation.

**Request Body:**
```json
{
  "text": "Hello everyone",
  "mediaFileId": "uuid",
  "replyToId": "uuid"
}
```

All fields are optional; at least one of `text` or `mediaFileId` must be provided.

---

### `PATCH /messages/:id`
**Auth:** Bearer token  
**Roles:** All

Edit own message text.

**Request Body:**
```json
{ "text": "Corrected message text" }
```

---

### `DELETE /messages/:id`
**Auth:** Bearer token  
**Roles:** All

Soft-delete own message.

---

### `POST /messages/:id/reactions`
**Auth:** Bearer token  
**Roles:** All

Toggle a reaction (add if not present, remove if already present).

**Request Body:**
```json
{ "emoji": "👍" }
```

---

### `POST /conversations/:id/block`
**Auth:** Bearer token  
**Roles:** All

Block the other person in a direct conversation.

---

### `DELETE /conversations/:id/block`
**Auth:** Bearer token  
**Roles:** All

Unblock the other person.

---

### `POST /chat/files/upload`
**Auth:** Bearer token  
**Roles:** All

Upload a chat attachment. Max size: **50 MB**. Field name: `file`.

**Response 200:** File metadata object (same as `/files/upload`).

---

### `GET /children/:childId/conversations`
**Auth:** Bearer token  
**Roles:** `parent`

List all conversations of a linked child.

---

### `GET /children/:childId/conversations/:conversationId/messages`
**Auth:** Bearer token  
**Roles:** `parent`

| Query Param | Default |
|-------------|---------|
| limit | 50 |
| skip | 0 |

---

### `GET /users/search`
**Auth:** Bearer token  
**Roles:** All

Search users to start a chat with.

| Query Param | Notes |
|-------------|-------|
| q | Search by name |

---

### `POST /conversations/initiate`
**Auth:** Bearer token  
**Roles:** All

Start or retrieve an existing direct conversation with another user.

**Request Body:**
```json
{ "targetUserId": "uuid" }
```

**Response 200/201:** Conversation object.

---

## 19. Calendar Events

### `GET /calendar-events`
**Auth:** Bearer token  
**Roles:** All

| Query Param | Notes |
|-------------|-------|
| from | ISO date string |
| to | ISO date string |
| academicYearId | UUID |
| classOfferingId | UUID |
| termId | UUID |

- Staff: all events.
- Students/parents: school-wide + their class events.

**Response 200:** Array of event objects:
```json
[
  {
    "id": "uuid",
    "title": "Biology Class",
    "date": "2026-03-20",
    "time": "09:00",
    "type": "class",
    "description": null,
    "classOfferingId": "uuid",
    "academicYearId": "uuid",
    "termId": "uuid",
    "createdById": "uuid",
    "createdAt": "2026-02-01T00:00:00.000Z"
  }
]
```

---

### `GET /calendar-events/:id`
**Auth:** Bearer token  
**Roles:** All

Returns a single event (scoped to viewer).

---

### `POST /calendar-events`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "academicYearId": "uuid",
  "title": "Science Fair",
  "date": "2026-04-15",
  "time": "10:00",
  "type": "event",
  "description": "Annual science fair",
  "classOfferingId": "uuid",
  "termId": "uuid"
}
```

| `type` examples | |
|----------------|--|
| `class` | Regular class session |
| `exam` | Exam day |
| `event` | School event |
| `holiday` | Holiday |

---

### `PATCH /calendar-events/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

All fields optional, same as POST body.

---

### `DELETE /calendar-events/:id`
**Auth:** Bearer token  
**Roles:** Admin (any), others (own events only)  
**Response 200:** `{ "ok": true }`

---

## 20. Dashboard

### `GET /dashboard/admin`
**Auth:** Bearer token  
**Roles:** `admin`

School-wide summary counts (users, enrollments, classes, etc.).

---

### `GET /dashboard/teacher`
**Auth:** Bearer token  
**Roles:** `teacher`

| Query Param | Notes |
|-------------|-------|
| termId | UUID (optional) |

Returns teacher's class counts, upcoming assignments/exams, and attendance stats.

---

### `GET /dashboard/student`
**Auth:** Bearer token  
**Roles:** `student`

Returns the authenticated student's summary dashboard.

---

### `GET /dashboard/parent`
**Auth:** Bearer token  
**Roles:** `parent`

Returns parent dashboard overview (links to children).

---

### `GET /dashboard/children/:studentId/summary`
**Auth:** Bearer token  
**Roles:** `parent`, `admin`

High-level summary for a linked child (link verification happens server-side).

---

### `GET /dashboard/children/:studentId`
**Auth:** Bearer token  
**Roles:** `parent`, `admin`

Full child dashboard including grades, attendance, and upcoming events.

**Response 200:**
```json
{
  "student": { "id": "uuid", "firstName": "Ali", "lastName": "Hassan", "email": "ali@school.edu" },
  "grades": {
    "overallAveragePercent": 81.4,
    "bySubject": [
      { "subjectId": "uuid", "subjectName": "Biology", "gradedEntries": 5, "averagePercent": 84.2 }
    ]
  },
  "attendance": {
    "overall": { "total": 60, "present": 52, "absent": 4, "excused": 4, "attendancePercent": 86.7 },
    "bySubject": [
      { "subjectId": "uuid", "subjectName": "Biology", "total": 20, "present": 18, "absent": 1, "excused": 1, "attendancePercent": 90.0 }
    ]
  },
  "upcoming": {
    "exams": [
      { "id": "uuid", "title": "Biology Midterm", "opensAt": "2026-05-10T09:00:00Z", "closesAt": "2026-05-10T11:00:00Z", "maxPoints": 100, "status": "upcoming", "score": null, "classOfferingId": "uuid" }
    ],
    "assignments": [
      { "id": "uuid", "title": "Chapter 3 Worksheet", "deadline": "2026-05-15T23:59:00Z", "maxScore": 100, "status": "pending", "score": null, "classOfferingId": "uuid" }
    ],
    "summary": { "examsTotal": 2, "examsAvailable": 0, "assignmentsTotal": 3, "assignmentsPending": 2 }
  }
}
```

---

## 21. Gamification

### `GET /gamification/badges`
**Auth:** Bearer token  
**Roles:** All

Returns all badge definitions.

**Response 200:**
```json
[
  { "id": "uuid", "key": "math_wizard", "name": "Math Wizard", "description": "...", "iconKey": "star", "pointsValue": 50 }
]
```

---

### `POST /gamification/badges`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{
  "key": "math_wizard",
  "name": "Math Wizard",
  "description": "Achieved 90%+ in 5 consecutive math quizzes",
  "iconKey": "star",
  "pointsValue": 50
}
```

---

### `POST /gamification/users/:userId/badges/:badgeId`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Award a badge to a user.

---

### `GET /gamification/me/badges`
**Auth:** Bearer token  
**Roles:** All

My awarded badges.

---

### `GET /gamification/me/badge-points`
**Auth:** Bearer token  
**Roles:** All

Sum of points from my badges.

**Response 200:** `{ "totalPoints": 150 }`

---

### `GET /gamification/leaderboard/exam-average`
**Auth:** Bearer token  
**Roles:** All

| Query Param | Required | Notes |
|-------------|----------|-------|
| academicYearId | ✅ | |
| limit | ❌ | Default 20 |

**Response 200:** Array of `{ rank, studentId, name, averageScore }`.

---

### `GET /gamification/students/:studentId/badges`
**Auth:** Bearer token  
**Roles:** All

Badges for a specific student (access restricted by role).

---

### `GET /gamification/students/:studentId/badge-points`
**Auth:** Bearer token  
**Roles:** All

---

### `GET /gamification/me/streak`
**Auth:** Bearer token  
**Roles:** All

Returns login streak info.

**Response 200:**
```json
{ "currentStreak": 7, "longestStreak": 14, "lastLoginDate": "2026-05-15" }
```

---

### `GET /gamification/me/progress`
**Auth:** Bearer token  
**Roles:** All

Combined gamification progress (badges, streak, points, missions).

---

### `GET /gamification/leaderboard/streaks`
**Auth:** Bearer token  
**Roles:** All

| Query Param | Default |
|-------------|---------|
| limit | 20 |

---

### `GET /gamification/me/missions`
**Auth:** Bearer token  
**Roles:** `student`

List daily missions for the current student.

**Response 200:** Array of mission objects with completion status.

---

### `POST /gamification/me/missions/:missionId/complete`
**Auth:** Bearer token  
**Roles:** `student`

Mark a mission as completed.

---

### `GET /gamification/me/team-challenge`
**Auth:** Bearer token  
**Roles:** `student`

Returns current team challenge for the student.

---

### `GET /gamification/quizzes`
**Auth:** Bearer token  
**Roles:** `student`

List available gamification quizzes.

---

### `GET /gamification/quizzes/:id`
**Auth:** Bearer token  
**Roles:** `student`

Get quiz detail.

---

### `POST /gamification/quizzes/:id/submit`
**Auth:** Bearer token  
**Roles:** `student`

Submit quiz answers and apply gamification outcome.

**Request Body:**
```json
{ "answers": { "q-1": 2, "q-2": 1 } }
```

Where key = questionId and value = selected option index.

---

### `GET /gamification/achievements`
**Auth:** Bearer token  
**Roles:** All

List all achievement definitions.

---

### `GET /gamification/my-achievements`
**Auth:** Bearer token  
**Roles:** `student`

List current user's unlocked achievements.

---

### `POST /gamification/check-achievements`
**Auth:** Bearer token  
**Roles:** `student`

Trigger achievement check and unlock any newly earned achievements.

---

## 22. Student Goals

### `GET /goals/me`
**Auth:** Bearer token  
**Roles:** `student`

Returns the authenticated student's goals.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Improve Math grade to A",
    "description": "Study 1 hour daily",
    "targetDate": "2026-06-01",
    "status": "in_progress",
    "progressPercent": 40,
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
]
```

---

### `POST /goals/me`
**Auth:** Bearer token  
**Roles:** `student`

**Request Body:**
```json
{
  "title": "Improve Math grade to A",
  "description": "Study 1 hour daily",
  "targetDate": "2026-06-01"
}
```

---

### `GET /goals/students/:studentId`
**Auth:** Bearer token  
**Roles:** All (access restricted by role)

---

### `PATCH /goals/:goalId`
**Auth:** Bearer token  
**Roles:** `student` (own goals only)

**Request Body (all optional):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "targetDate": "2026-07-01",
  "status": "completed",
  "progressPercent": 100
}
```

---

### `DELETE /goals/:goalId`
**Auth:** Bearer token  
**Roles:** `student` (own goals only)

---

## 23. AI (Adaptive Learning)

> All AI endpoints require authentication. Role-specific restrictions are noted per endpoint.

### `GET /ai/health`
**Auth:** Bearer token  
**Roles:** All

Returns whether the AI service is configured.

**Response 200:**
```json
{ "configured": true, "reachable": true, "provider": "gemini" }
```

---

### `POST /ai/mastery/update`
**Auth:** Bearer token  
**Roles:** All

Update student topic mastery using Bayesian Knowledge Tracing (BKT).

**Request Body:**
```json
{
  "student_id": "uuid",
  "topic_id": "uuid",
  "is_correct": true
}
```

**Response 201:**
```json
{
  "topic_id": "uuid",
  "old_mastery": 0.4,
  "new_mastery": 0.62,
  "assessment_count": 5,
  "mastered": false
}
```

---

### `GET /ai/mastery/:studentId/:topicId`
**Auth:** Bearer token  
**Roles:** All

**Response 200:**
```json
{ "topic_id": "uuid", "mastery_level": 0.72, "assessment_count": 8, "mastered": true }
```

---

### `GET /ai/mastery/:studentId/weak/:subjectId`
**Auth:** Bearer token  
**Roles:** All

Returns topics where mastery is below threshold.

**Response 200:**
```json
{
  "student_id": "uuid",
  "subject_id": "uuid",
  "weak_topics": [
    { "topic_id": "uuid", "mastery_level": 0.3 }
  ]
}
```

---

### `POST /ai/recommendations`
**Auth:** Bearer token  
**Roles:** All

Get personalized resource recommendations.

**Request Body:**
```json
{
  "student_id": "uuid",
  "weak_topic_ids": ["uuid1", "uuid2"],
  "difficulty": "medium",
  "limit": 5
}
```

**Response 201:**
```json
{
  "student_id": "uuid",
  "resources": [
    { "type": "video", "title": "Algebra basics", "url": "https://...", "difficulty": "medium" }
  ]
}
```

---

### `GET /ai/students/:studentId/recommendations`
**Auth:** Bearer token  
**Roles:** All

Convenience GET — resolves weak topics automatically.

| Query Param | Notes |
|-------------|-------|
| subjectId | UUID (optional) |
| difficulty | `easy` \| `medium` \| `hard` |
| limit | 1–20 |

---

### `POST /ai/learning-path`
**Auth:** Bearer token  
**Roles:** All

Generate an adaptive learning path.

**Request Body:**
```json
{
  "student_id": "uuid",
  "subject_id": "uuid"
}
```

**Response 201:**
```json
{
  "student_id": "uuid",
  "subject_id": "uuid",
  "overall_progress": 0.45,
  "topics": [
    {
      "topic_id": "uuid",
      "topic_name": "Fractions",
      "current_mastery": 0.3,
      "target_mastery": 0.8,
      "sequence_order": 1,
      "is_completed": false,
      "explanation": "Start here"
    }
  ]
}
```

---

### `GET /ai/students/:studentId/learning-path`
**Auth:** Bearer token  
**Roles:** All

Convenience GET version.

| Query Param | Notes |
|-------------|-------|
| subjectId | UUID (optional) |

---

### `POST /ai/content/generate-lesson`
**Auth:** Bearer token  
**Roles:** All

Generate a lesson for a topic using the configured LLM.

**Request Body:**
```json
{ "topic_id": "uuid" }
```

**Response 201:**
```json
{
  "resource_id": "uuid",
  "title": "Introduction to Fractions",
  "topic_id": "uuid",
  "content": "...",
  "needs_review": false,
  "source": "gemini"
}
```

---

### `POST /ai/content/generate-questions`
**Auth:** Bearer token  
**Roles:** All

Generate quiz questions for a topic and save them to the question bank.

**Request Body:**
```json
{ "topic_id": "uuid", "count": 5 }
```

**Response 201:**
```json
{ "topic_id": "uuid", "topic_name": "Fractions", "questions": [], "saved": 5 }
```

---

### `GET /ai/content/questions/:topicId`
**Auth:** Bearer token  
**Roles:** All

Get persisted AI-generated questions for a topic.

| Query Param | Notes |
|-------------|-------|
| difficulty | `easy` \| `medium` \| `hard` |
| limit | Default 10 |

---

### `GET /ai/content/next-question/:studentId/:topicId`
**Auth:** Bearer token  
**Roles:** All

Returns the next adaptive question based on the student's current mastery level.

---

### `POST /ai/chat`
**Auth:** Bearer token  
**Roles:** All

AI tutoring chat.

**Request Body:**
```json
{
  "student_id": "uuid",
  "message": "What is a fraction?",
  "grade_level": 9
}
```

**Response 201:**
```json
{
  "student_id": "uuid",
  "message": "What is a fraction?",
  "answer": "A fraction represents a part of a whole...",
  "sources": []
}
```

---

### `GET /ai/chat/history/:studentId`
**Auth:** Bearer token  
**Roles:** All (students see own only)

| Query Param | Default |
|-------------|---------|
| limit | 20 |

---

### `GET /ai/analytics/student/:studentId/weekly-summary`
**Auth:** Bearer token  
**Roles:** All

AI-generated weekly progress summary (attendance, exam scores, engagement).

**Response 200:**
```json
{
  "student_id": "uuid",
  "week": "2026-W17",
  "summary": "Ali attended 4/5 classes this week and scored above average in Biology.",
  "metrics": {}
}
```

---

### `GET /ai/analytics/subject/:subjectId/at-risk`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns students below mastery/attendance threshold, sorted by risk score.

| Query Param | Default |
|-------------|---------|
| limit | 50 |
| offset | 0 |

---

### `GET /ai/analytics/subject/:subjectId/class-performance`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Shows which topics the class is struggling with.

| Query Param | Default |
|-------------|---------|
| limit | 50 |
| offset | 0 |

---

### `GET /ai/students/:studentId/evaluate`
**Auth:** Bearer token  
**Roles:** All

Rules-engine evaluation summary from attendance, exam scores, and login streak. **Does not require AI_SERVICE_URL.**

---

### `POST /ai/feedback-assistant`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

AI tone/draft assist for teacher communications.

**Request Body:**
```json
{
  "context": "Email draft to parents about the upcoming field trip...",
  "audience": "parent"
}
```

---

## 24. Analytics

### `GET /analytics/admin/summary`
**Auth:** Bearer token  
**Roles:** `admin`

School-wide analytics snapshot: feedback counts, exam stats, attendance marks (last 30 days), user counts.

---

### `GET /analytics/student/weekly-snapshot`
**Auth:** Bearer token  
**Roles:** `student`

Student's own weekly snapshot.

---

### `GET /analytics/student/performance-trends`
**Auth:** Bearer token  
**Roles:** `student`

Performance trend data over time.

---

### `GET /analytics/student/attendance-insights`
**Auth:** Bearer token  
**Roles:** `student`

Attendance pattern insights for the student.

---

### `GET /analytics/student/action-plan`
**Auth:** Bearer token  
**Roles:** `student`

Recommended action plan based on current performance.

---

## 25. Reports

### `GET /reports/students/:studentId/performance`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Overall performance combining attendance and released exam scores.

---

### `GET /reports/students/:studentId/compare`
**Auth:** Bearer token  
**Roles:** All

Compare two date ranges (attendance + exam averages).

| Query Param | Example |
|-------------|---------|
| period1Start | `2026-01-01` |
| period1End | `2026-03-01` |
| period2Start | `2026-03-02` |
| period2End | `2026-06-01` |

---

### `GET /reports/parent/weekly-summary`
**Auth:** Bearer token  
**Roles:** `parent`, `admin`

Weekly summary for linked children.

| Query Param | Notes |
|-------------|-------|
| childStudentId | UUID — specific child (admin requires this) |

---

### `GET /reports/my-grades`
**Auth:** Bearer token  
**Roles:** `student`

Grades by subject from released exam attempts.

---

### `GET /reports/students/:studentId/report`
**Auth:** Bearer token  
**Roles:** All

Comprehensive student report.

| Query Param | Notes |
|-------------|-------|
| periodType | `weekly` \| `monthly` \| `custom` (default: `custom`) |
| startDate | Required when `periodType = custom` (YYYY-MM-DD) |
| endDate | Required when `periodType = custom` (YYYY-MM-DD) |

---

### `GET /reports/students/:studentId/mastery`
**Auth:** Bearer token  
**Roles:** All

Student mastery snapshot derived from released exam performance per enrolled class.

---

### `GET /reports/students/:studentId/teachers`
**Auth:** Bearer token  
**Roles:** All

Returns the list of teachers for a student (from their enrollments). Useful for parent-teacher communication lookup.

---

## 26. Report Cards

### `POST /report-cards/remarks`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Add or update a homeroom teacher's remark for a student in a term.

**Request Body** (see `CreateRemarkDto`):
```json
{
  "studentId": "uuid",
  "termId": "uuid",
  "remark": "Excellent student, keep it up!",
  "conductGrade": "A"
}
```

Only the homeroom teacher for that student's class can add remarks (admins bypass this).

---

### `GET /report-cards/student/:studentId/term/:termId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Full report card for a student in a term.

**Response 200:**
```json
{
  "student": { "id": "uuid", "firstName": "Ali", "lastName": "Hassan", "grade": "Grade 9", "section": "A", "profileImageFileId": null },
  "academicYear": { "id": "uuid", "label": "2025-2026" },
  "term": { "id": "uuid", "name": "Term 1", "startDate": "2025-09-01", "endDate": "2025-12-15" },
  "subjects": [
    {
      "subjectId": "uuid",
      "subjectName": "Mathematics",
      "classOfferingId": "uuid",
      "teacherName": "Jane Doe",
      "entries": [
        { "title": "Quiz 1", "type": "quiz", "score": 88, "maxScore": 100, "percent": 88.0, "releasedAt": "2025-10-01T00:00:00.000Z" }
      ],
      "summary": { "totalEntries": 1, "averagePercent": 88.0, "letterGrade": "B+" }
    }
  ],
  "attendance": { "present": 45, "absent": 2, "late": 1, "excused": 0, "total": 48, "attendancePercent": 95.8 },
  "overallGpa": 3.3,
  "overallPercent": 88.0,
  "overallLetterGrade": "B+",
  "homeroomRemark": { "remark": "Excellent student, keep it up!", "conductGrade": "A" },
  "generatedAt": "2026-05-07T12:00:00.000Z"
}
```

---

### `GET /report-cards/class/:gradeId/:sectionId/term/:termId`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher` (homeroom only)

Ranked list of all students in a class for a term.

**Response 200:**
```json
{
  "gradeId": "uuid",
  "sectionId": "uuid",
  "termId": "uuid",
  "students": [
    { "studentId": "uuid", "firstName": "Ali", "lastName": "Hassan", "overallPercent": 92.5, "overallLetterGrade": "A+", "attendancePercent": 97.0, "rank": 1 }
  ]
}
```

---

### `GET /report-cards/student/:studentId/academic-year/:academicYearId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Full-year transcript with per-term summaries.

---

## 27. Homeroom

### `POST /homeroom/assign`
**Auth:** Bearer token  
**Roles:** `admin`

Assign a homeroom teacher to a grade+section for an academic year.

**Request Body:**
```json
{
  "teacherId": "uuid",
  "gradeId": "uuid",
  "sectionId": "uuid",
  "academicYearId": "uuid"
}
```

**Response 201:** Assignment object.

---

### `GET /homeroom/my-class`
**Auth:** Bearer token  
**Roles:** `teacher`

Returns the homeroom assignment and student list for the active academic year.

**Response 200:**
```json
{
  "assignment": {
    "id": "uuid",
    "teacherId": "uuid",
    "academicYearId": "uuid",
    "gradeId": "uuid",
    "sectionId": "uuid",
    "createdAt": "2026-05-07T00:00:00.000Z"
  },
  "students": [
    { "id": "uuid", "firstName": "Ali", "lastName": "Hassan", "grade": "Grade 9", "section": "A", "profileImageFileId": null }
  ]
}
```

---

### `GET /homeroom/assignments`
**Auth:** Bearer token  
**Roles:** `admin`

List all homeroom assignments.

| Query Param | Notes |
|-------------|-------|
| academicYearId | UUID (optional) |

---

### `DELETE /homeroom/assign/:id`
**Auth:** Bearer token  
**Roles:** `admin`

Remove a homeroom assignment.

---

## 28. Parent–Student Links

### `GET /parent-students`
**Auth:** Bearer token  
**Roles:** `admin`

| Query Param | Notes |
|-------------|-------|
| parentId | UUID (optional) |
| studentId | UUID (optional) |

**Response 200:** Array of link records.

---

### `POST /parent-students`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{
  "parentId": "uuid",
  "studentId": "uuid",
  "relationship": "Father",
  "isPrimary": true
}
```

---

### `GET /parent-students/mychildren`
**Auth:** Bearer token  
**Roles:** `parent`

Returns linked children for the authenticated parent.

**Response 200:** Array of student objects with profile details.

---

### `GET /parent-students/children/:studentId/upcoming`
**Auth:** Bearer token  
**Roles:** `parent`

Upcoming exams and assignments for a linked child.

**Response 200:**
```json
{
  "student": { "id": "uuid", "firstName": "Ali", "lastName": "Hassan", "email": "ali@school.edu" },
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
      "opensAt": "2026-05-10T09:00:00Z",
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
      "deadline": "2026-05-15T23:59:00Z",
      "maxScore": 100,
      "score": null,
      "subjectName": "Biology"
    }
  ]
}
```

| Exam status values | |
|-------------------|--|
| `upcoming` | Not yet open |
| `available` | Open and student hasn't started |
| `submitted` | Student submitted |
| `graded` | Grade released |
| `missed` | Window closed without attempt |

| Assignment status values | |
|--------------------------|--|
| `pending` | Not yet submitted |
| `submitted` | Submitted, not graded |
| `graded` | Grade released |
| `overdue` | Deadline passed without submission |

---

### `DELETE /parent-students/:id`
**Auth:** Bearer token  
**Roles:** `admin`

Remove a parent-student link.

---

## 29. Student Profiles

### `GET /student-profiles/me`
**Auth:** Bearer token  
**Roles:** `student`

Returns the extended profile for the authenticated student (bio, avatar, extras).

**Response 200:**
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "bio": "I love mathematics and science.",
  "avatarFileId": "uuid",
  "extraJson": "{\"interests\": [\"coding\", \"math\"]}",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

### `PATCH /student-profiles/me`
**Auth:** Bearer token  
**Roles:** `student`

**Request Body (all optional):**
```json
{
  "bio": "Updated bio",
  "avatarFileId": "uuid",
  "extraJson": "{\"interests\":[\"coding\"]}"
}
```

---

### `GET /student-profiles/:studentUserId`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Student profile for a specific user ID. Access: self, linked parent, or staff.

---

### `GET /student-profiles/:studentUserId/detail`
**Auth:** Bearer token  
**Roles:** All (restricted by role)

Student detail with profile, enrolled classes, subjects, and teachers.

---

## 30. Textbooks

### `POST /textbooks/upload`
**Auth:** Bearer token  
**Roles:** `admin`

Upload a textbook PDF with optional cover image. Max PDF size: **25 MB**.

```
Content-Type: multipart/form-data
Fields:
  file     (binary, required) — PDF file
  cover    (binary, optional) — Cover image
  title    (string, required) — e.g. "Grade 9 Mathematics"
  subject  (string, required) — e.g. "Mathematics"
  grade    (integer, required) — e.g. 9
  description (string, optional)
```

**Response 201:** Textbook object with CDN URL.

---

### `GET /textbooks`
**Auth:** Bearer token  
**Roles:** All

| Query Param | Type | Example |
|-------------|------|---------|
| subject | string | `"Mathematics"` |
| grade | number | `9` |

**Response 200:** Array of textbook objects.

---

### `GET /textbooks/:id`
**Auth:** Bearer token  
**Roles:** All

Returns textbook detail with CDN download URL.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "Grade 9 Mathematics — New Curriculum",
  "subject": "Mathematics",
  "grade": 9,
  "description": "Official Ethiopian Grade 9 textbook",
  "accessUrl": "https://cdn.example.com/textbooks/math-g9.pdf",
  "coverUrl": "https://cdn.example.com/covers/math-g9.jpg",
  "sizeBytes": 5242880,
  "cacheKey": "textbook-uuid",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

### `DELETE /textbooks/:id`
**Auth:** Bearer token  
**Roles:** `admin`

Soft-delete a textbook.  
**Response 204:** No content.

---

## 31. Learning Materials

### `POST /learning-materials`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Upload a learning material (PDF, text file, or external link).

```
Content-Type: multipart/form-data
```

**Form fields:**
```json
{
  "title": "Chapter 3 Notes",
  "type": "pdf",
  "classOfferingId": "uuid",
  "description": "Supplementary notes"
}
```

| `type` values | Notes |
|--------------|-------|
| `pdf` | PDF file upload required |
| `txt` | Text file upload required |
| `link` | No file required; pass URL in DTO |

**Response 201:** Learning material object.

---

### `GET /learning-materials/student/me`
**Auth:** Bearer token  
**Roles:** `student`

Returns all learning materials for the authenticated student's enrolled classes.

**Response 200:** Array of material objects with file/link info.

---

### `GET /learning-materials/:id`
**Auth:** Bearer token  
**Roles:** `student`, `teacher`, `admin`

Get a learning material by ID.

---

## 32. Resources (Course Resources)

These endpoints map textbooks to a `CourseResource` format optimized for mobile consumption.

### `GET /resources/me`
**Auth:** Bearer token  
**Roles:** `student`

Returns all course resources (textbooks) mapped for the student.

| Query Param | Notes |
|-------------|-------|
| subjectId | UUID — filter by subject |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Grade 9 Mathematics",
    "subjectId": "uuid",
    "subjectName": "Mathematics",
    "topicId": null,
    "type": "pdf",
    "difficulty": "medium",
    "description": "Official textbook resource",
    "url": "https://cdn.example.com/math-g9.pdf",
    "fileSize": "5.0 MB",
    "textbookId": "uuid",
    "textbookFileRecordId": "uuid",
    "textbookCacheKey": "textbook-uuid",
    "uploadedAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### `GET /resources/:id`
**Auth:** Bearer token  
**Roles:** `student`

Get a single course resource by ID.

---

## 33. Curriculum

### `GET /curriculum/me/subjects`
**Auth:** Bearer token  
**Roles:** `student`

Returns subjects from the student's enrolled classes with curriculum version.

**Response 200:**
```json
[
  { "id": "uuid", "name": "Mathematics", "code": "MATH101", "curriculumVersion": "2013EC" }
]
```

---

### `GET /curriculum/me/subjects/:subjectId/topics`
**Auth:** Bearer token  
**Roles:** `student`

Returns the topic hierarchy for a subject.

---

## 34. Topics

### `POST /topics`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Request Body:**
```json
{
  "subjectId": "uuid",
  "name": "Linear Equations",
  "description": "Solving linear equations",
  "parentTopicId": null,
  "orderIndex": 1
}
```

---

### `GET /topics`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`, `student`

| Query Param | Required |
|-------------|----------|
| subjectId | ✅ (UUID) |

Returns topics for a subject.

---

### `GET /topics/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`, `student`

Get a topic by ID.

---

### `PUT /topics/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Update a topic (replaces all fields).

---

### `DELETE /topics/:id`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

**Response 204:** No content.

---

## 35. Search

### `GET /search`
**Auth:** Bearer token  
**Roles:** All

Global search across users, class offerings, and subjects.

| Query Param | Required | Notes |
|-------------|----------|-------|
| q | ✅ | Min 2 characters |

**Response 200:**
```json
{
  "users": [
    {
      "entityType": "user",
      "id": "uuid",
      "title": "John Doe",
      "subtitle": "teacher - john.doe@example.com",
      "metadata": { "role": "teacher", "email": "john.doe@example.com", "grade": null, "section": null }
    }
  ],
  "classOfferings": [
    {
      "entityType": "classOffering",
      "id": "uuid",
      "title": "Mathematics",
      "subtitle": "Grade 9 - Section A",
      "metadata": { "subjectName": "Mathematics", "gradeName": "Grade 9", "sectionName": "Section A" }
    }
  ],
  "subjects": [
    {
      "entityType": "subject",
      "id": "uuid",
      "title": "Mathematics",
      "subtitle": "Code: MATH101",
      "metadata": { "code": "MATH101" }
    }
  ],
  "totalResults": 3
}
```

---

## 36. Settings

### `GET /me/settings`
**Auth:** Bearer token  
**Roles:** All

Returns the user's settings JSON blob.

**Response 200:**
```json
{ "settingsJson": "{\"theme\":\"dark\",\"language\":\"en\"}" }
```

---

### `PATCH /me/settings`
**Auth:** Bearer token  
**Roles:** All

**Request Body:**
```json
{ "settingsJson": "{\"theme\":\"dark\",\"language\":\"am\"}" }
```

---

### `GET /school/settings`
**Auth:** Bearer token  
**Roles:** All

Returns school-wide settings.

---

### `PATCH /school/settings`
**Auth:** Bearer token  
**Roles:** `admin`

**Request Body:**
```json
{ "settingsJson": "{\"schoolName\":\"TriLink Academy\",\"timezone\":\"Africa/Addis_Ababa\"}" }
```

---

## 37. Audit Logs

### `GET /audit-logs`
**Auth:** Bearer token  
**Roles:** `admin`

Returns recent audit log entries.

| Query Param | Default |
|-------------|---------|
| limit | 100 |

**Response 200:** Array of audit log entries:
```json
[
  {
    "id": "uuid",
    "actorId": "uuid",
    "action": "user.register",
    "entityType": "user",
    "entityId": "uuid",
    "meta": "{\"email\":\"student@school.edu\",\"role\":\"student\"}",
    "createdAt": "2026-05-01T10:00:00.000Z"
  }
]
```

---

## 38. Integrations & Sync

### `GET /integrations/status`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns external service configuration status (no secrets exposed).

**Response 200:**
```json
{
  "mongoDb": { "configured": false, "hint": "Set MONGO_URI or MONGODB_URI to enable." },
  "vectorSearch": { "configured": false, "hint": "Set VECTOR_SERVICE_URL for embeddings." },
  "aiWorker": { "configured": true, "hint": "Set AI_SERVICE_URL; Nest AI routes can proxy to Python/ML." },
  "apiPrefix": "api",
  "serverTime": "2026-05-15T18:00:00.000Z"
}
```

---

### `GET /integrations/sync-hints`
**Auth:** Bearer token  
**Roles:** `admin`, `teacher`

Returns API version and server time for offline/sync clients.

**Response 200:**
```json
{
  "apiVersion": "1.0.0",
  "serverTime": "2026-05-15T18:00:00.000Z",
  "note": "Use If-None-Match / updatedAt per resource when you add ETag support."
}
```

---

### `GET /sync/student/status`
**Auth:** Bearer token  
**Roles:** All

Lightweight sync status dashboard for mobile.

**Response 200:**
```json
{
  "generatedAt": "2026-05-15T18:00:00.000Z",
  "userId": "uuid",
  "role": "student",
  "studentIds": ["uuid"],
  "items": [
    {
      "id": "sync-api",
      "category": "API Link",
      "description": "Authentication and transport status",
      "status": "synced",
      "lastSyncedAt": "2026-05-15T18:00:00.000Z",
      "pendingCount": 0,
      "totalCount": 1
    },
    {
      "id": "sync-notifications",
      "category": "Notifications",
      "description": "Unread and historical notifications",
      "status": "pending",
      "lastSyncedAt": "2026-05-15T17:00:00.000Z",
      "pendingCount": 3,
      "totalCount": 47
    },
    {
      "id": "sync-grades",
      "category": "Grades",
      "description": "Released grade entries",
      "status": "synced",
      "lastSyncedAt": "2026-05-14T10:00:00.000Z",
      "pendingCount": 0,
      "totalCount": 12
    },
    {
      "id": "sync-attendance",
      "category": "Attendance",
      "description": "Attendance marks",
      "status": "synced",
      "lastSyncedAt": "2026-05-15T09:00:00.000Z",
      "pendingCount": 0,
      "totalCount": 89
    },
    {
      "id": "sync-exams",
      "category": "Exams",
      "description": "Exam attempts and result release state",
      "status": "pending",
      "lastSyncedAt": "2026-05-10T12:00:00.000Z",
      "pendingCount": 1,
      "totalCount": 5
    }
  ]
}
```

| Sync `status` values | |
|---------------------|--|
| `synced` | Everything is up-to-date |
| `pending` | There are unread/unreleased items |
| `error` | A sync error occurred |

---

### `POST /sync/student/trigger`
**Auth:** Bearer token  
**Roles:** All

Trigger a sync action. Returns refreshed status.

**Response 200:** Same as `GET /sync/student/status` with additional fields:
```json
{
  "...same as status...",
  "triggeredAt": "2026-05-15T18:00:05.000Z",
  "accepted": true
}
```

---

## Appendix: Role Summary

| Resource | admin | teacher | student | parent |
|----------|-------|---------|---------|--------|
| Login/Register | ✅ | ✅ | ✅ | ✅ |
| User management | ✅ | read only | — | — |
| School structure | ✅ | — | — | — |
| Academic years | ✅ | read | read | read |
| Class offerings | ✅ | own | — | — |
| Enrollments | ✅ | read | own | children |
| Announcements | ✅ | ✅ | read | read |
| Assignments | ✅ | create/grade | submit | read |
| Attendance | ✅ | mark | read own | read child |
| Exams | ✅ | create/grade | take | read child |
| Grades | ✅ | enter | read own | read child |
| Report Cards | ✅ | view class | own | child |
| Homeroom | ✅ | own class | — | — |
| Feedback | ✅ | send/receive | send | send |
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Files | ✅ | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ | ✅ |
| AI features | ✅ | ✅ | ✅ | read |
| Gamification | ✅ | award | full | read |
| Dashboard | ✅ | own | own | children |
| Audit logs | ✅ | — | — | — |

---

## Appendix: Common Error Shapes

```json
{ "statusCode": 400, "error": "Bad Request", "message": "Validation failed" }
{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid or expired token" }
{ "statusCode": 403, "error": "Forbidden", "message": "Forbidden resource" }
{ "statusCode": 404, "error": "Not Found", "message": "Resource not found" }
{ "statusCode": 409, "error": "Conflict", "message": "Resource already exists" }
```

---

*Generated: May 15, 2026 — TriLink Backend v1.0.0*
