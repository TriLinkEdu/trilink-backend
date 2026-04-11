# Design Document — Backend Improvements

## Overview

This document describes the technical design for twelve targeted improvements to the TriLink NestJS backend. The changes span notification enrichment, attendance querying, report generation, chat pagination, chat user discovery, feedback simplification, profile update restrictions, announcement targeting, response population, and API documentation.

All changes are additive or narrowing — no existing API contracts are broken. New columns are nullable where required for backward compatibility. Enum changes are handled via a data migration.

**Tech stack:** NestJS, TypeORM, SQLite (dev) / PostgreSQL (prod), `@nestjs/swagger`.

---

## Architecture

The system follows a standard NestJS layered architecture:

```
HTTP Request
    │
    ▼
Controller  (validation, auth guards, Swagger decorators)
    │
    ▼
Service     (business logic, cross-module calls)
    │
    ▼
Repository  (TypeORM, raw query builder where needed)
    │
    ▼
Database    (SQLite / PostgreSQL)
```

Cross-cutting concerns:
- **Auth**: `JwtAuthGuard` + `RolesGuard` on every controller.
- **Realtime**: `EventsGateway` (Socket.IO) for push notifications.
- **Validation**: `class-validator` + `ValidationPipe` (global).

No new modules are introduced. All changes live inside existing modules.

---

## Components and Interfaces

### Req 1 — NotificationType Enum

**File:** `src/modules/notifications/entities/notification.entity.ts`

```typescript
export enum NotificationType {
  ATTENDANCE      = 'attendance',
  GRADE_SUBMITTED = 'grade_submitted',
  ANNOUNCEMENT    = 'announcement',
  BROADCAST       = 'broadcast',
  SYSTEM          = 'system',
}
```

The `type` column changes from `varchar(60)` to `simple-enum` backed by `NotificationType`. All callers of `NotificationsService.createForUser()` must pass a `NotificationType` value instead of a raw string.

**Callers to update:**
- `AttendanceService.putMarks()` → `NotificationType.ATTENDANCE`
- `AnnouncementsService` (broadcast path) → `NotificationType.ANNOUNCEMENT`
- `NotificationsService.broadcastFromStaff()` → `NotificationType.BROADCAST`
- New exam release path → `NotificationType.GRADE_SUBMITTED`

---

### Req 2 — Enriched Attendance Notifications

**Modified method:** `AttendanceService.putMarks()`

Before creating each attendance notification, the service resolves the ClassOffering's related entities:

```
ClassOffering ──► Grade      (gradeId → grades.name)
              ──► Section    (sectionId → sections.name)
              ──► Subject    (subjectId → subjects.name)
              ──► Teacher    (teacherId → users.firstName + lastName)
```

The resolved payload shape:

```typescript
interface AttendanceNotificationPayload {
  sessionId:   string;
  studentId:   string;
  status:      string;
  date:        string;
  className:   string | null;   // ClassOffering.name
  gradeName:   string | null;
  sectionName: string | null;
  subjectName: string | null;
  teacherName: string | null;   // firstName + ' ' + lastName
}
```

If the ClassOffering cannot be found, all name fields are set to `null` and the notification is still created.

**New helper in `NotificationsService`:**

```typescript
async resolveClassContext(classOfferingId: string): Promise<ClassContext>
```

This helper is injected into `AttendanceService` via the existing `NotificationsService` dependency.

---

### Req 3 — Grade Submission Notification

**Trigger point:** `ExamsService` (or wherever `releasedAt` is set on `ExamAttempt` records).

**New method:** `NotificationsService.notifyGradeReleased(attempts: ExamAttempt[])`

Data flow:

```
Teacher releases scores
    │
    ▼
ExamsService sets releasedAt on ExamAttempt rows
    │
    ▼
NotificationsService.notifyGradeReleased(attempts)
    │
    ├── For each attempt:
    │       resolve Exam → examTitle, maxPoints
    │       resolve ClassOffering → className, gradeName, sectionName, subjectName
    │       create grade_submitted notification for student
    │
    └── For each attempt:
            find ParentStudent links for studentId
            create grade_submitted notification for each parent
                (payload includes studentName)
```

**Payload shape:**

```typescript
interface GradeSubmittedPayload {
  examTitle:       string;
  subjectName:     string | null;
  score:           number;
  maxPoints:       number;
  classOfferingId: string;
  className:       string | null;
  gradeName:       string | null;
  sectionName:     string | null;
  studentName?:    string;   // only in parent copy
}
```

---

### Req 4 — Attendance by-Day Endpoint

**New endpoint:** `GET /attendance/by-day`

**New service method:**

```typescript
async getByDay(
  studentId: string,
  date: string,        // YYYY-MM-DD
  viewer: User,
): Promise<AttendanceByDayEntry[]>
```

**Data flow:**

```
1. assertStudentViewer(viewer, studentId)
2. enrollments = find active Enrollments where studentId = studentId
3. For each enrollment:
   a. co = ClassOffering (with grade, section, subject, teacher)
   b. session = AttendanceSession where classOfferingId = co.id AND date = date
   c. mark = AttendanceMark where sessionId = session.id AND studentId = studentId
   d. Build entry:
      - attendanceStatus = mark.status ?? 'no_session'
      - note = mark.note ?? null
4. Return array of entries
```

**Response entry shape:**

```typescript
interface AttendanceByDayEntry {
  classOfferingId: string;
  className:       string | null;
  gradeName:       string;
  sectionName:     string;
  subjectName:     string;
  teacherName:     string;
  attendanceStatus: 'present' | 'absent' | 'excused' | 'late' | 'no_session';
  note:            string | null;
}
```

**Access control:**
- Student: `studentId` must equal `viewer.id`
- Parent: `studentId` must be a linked child via `ParentStudent`
- Teacher / Admin: any `studentId`

---

### Req 5 — Weekly and Monthly Student Reports

**Modified endpoint:** `GET /reports/students/:studentId/report`

**New query params:** `type` (`weekly` | `monthly`), alongside existing `startDate` / `endDate`.

**Date range resolution logic (server-side):**

```typescript
function resolveDateRange(type?: string, startDate?: string, endDate?: string): { from: string; to: string } {
  if (startDate && endDate) return { from: startDate, to: endDate };
  if (type === 'weekly') {
    const to = today();
    const from = daysAgo(6);   // 7-day window inclusive
    return { from, to };
  }
  if (type === 'monthly') {
    return { from: firstDayOfMonth(), to: lastDayOfMonth() };
  }
  throw new BadRequestException('Provide type=weekly|monthly or startDate+endDate');
}
```

**Modified service method:**

```typescript
async studentReport(
  studentId: string,
  viewer: User,
  opts: { type?: 'weekly' | 'monthly'; startDate?: string; endDate?: string },
): Promise<StudentReportResponse>
```

**Response shape:**

```typescript
interface StudentReportResponse {
  student: {
    firstName:   string;
    lastName:    string;
    gradeName:   string | null;
    sectionName: string | null;
    className:   string | null;
  };
  period: { startDate: string; endDate: string };
  courses: CourseReportEntry[];
  attendance: AttendanceSummary;
  generatedAt: string;
}

interface CourseReportEntry {
  classOfferingId:  string;
  className:        string | null;
  subjectName:      string;
  teacherFirstName: string;
  teacherLastName:  string;
  averageScore:     number | null;   // avg of released ExamAttempts in date range
  examCount:        number;
}

interface AttendanceSummary {
  present:              number;
  absent:               number;
  excused:              number;
  late:                 number;
  total:                number;
  attendancePercentage: number | null;  // (present + late) / total * 100, 2dp
}
```

**Per-subject average score:** For each `classOfferingId`, query `ExamAttempts` where `examId` is in exams with that `classOfferingId` and `releasedAt` is within the date range.

**Access control:** unchanged from existing `assertStudentViewer` + teacher-enrollment check.

---

### Req 6 — Chat Message Pagination

**Modified endpoint:** `GET /conversations/:id/messages`

**New query params:** `before` (cursor string = message UUID), `limit` (default 20, max 100).

**Modified service method:**

```typescript
async listMessages(
  conversationId: string,
  user: User,
  opts: { before?: string; limit?: number },
): Promise<PaginatedMessages>
```

**Cursor strategy:** The cursor is the UUID of a `ChatMessage`. When `before` is provided, the service fetches the `createdAt` of that message and returns messages with `createdAt < cursor.createdAt`, ordered ascending, limited to `limit`.

**Data flow:**

```
1. assertReadAccess(conversationId, user)
2. Validate limit ≤ 100 (throw 400 if not)
3. If before provided:
   a. cursorMsg = find ChatMessage by id=before
   b. query: WHERE conversationId=id AND createdAt < cursorMsg.createdAt
             ORDER BY createdAt ASC LIMIT limit+1
4. Else:
   a. query: WHERE conversationId=id
             ORDER BY createdAt DESC LIMIT limit+1
             (then reverse for ASC output)
5. hasMore = results.length > limit
6. data = results.slice(0, limit)
7. nextCursor = hasMore ? data[data.length-1].id : null
8. Return { data, nextCursor, hasMore }
```

**Response shape:**

```typescript
interface PaginatedMessages {
  data:       ChatMessage[];
  nextCursor: string | null;
  hasMore:    boolean;
}
```

---

### Req 7 — Searchable Users for Chat

**New endpoint:** `GET /chat/searchable-users`

**New service method:**

```typescript
async searchableUsers(
  viewer: User,
  opts: { q?: string; type?: UserRole },
): Promise<SearchableUserEntry[]>
```

**Role-based filtering logic:**

```
PARENT  → Teachers of ClassOfferings where viewer's children are enrolled
          + Admin users

TEACHER → Students enrolled in viewer's ClassOfferings
          + Parents of those students (via ParentStudent)
          + Admin users

STUDENT → Teachers of ClassOfferings where viewer is enrolled
          + Admin users

ADMIN   → All users
```

**Data flow for PARENT:**

```
1. childIds = ParentStudent.find({ parentId: viewer.id }).map(studentId)
2. enrollments = Enrollment.find({ studentId: In(childIds), status: 'active' })
3. coIds = enrollments.map(classOfferingId)
4. offerings = ClassOffering.find({ id: In(coIds) })
5. teacherIds = offerings.map(teacherId)
6. adminIds = User.find({ role: ADMIN }).map(id)
7. candidates = User.find({ id: In([...teacherIds, ...adminIds]) })
8. For each teacher: subjects = subjects taught to viewer's children only
```

**Response entry shape:**

```typescript
interface SearchableUserEntry {
  id:                 string;
  firstName:          string;
  lastName:           string;
  role:               UserRole;
  subjects:           string[];   // teacher: relevant subjects; others: []
  profileImageFileId: string | null;
}
```

Filtering: `q` applies case-insensitive `LIKE %q%` on `firstName` or `lastName`. `type` filters by role. Viewer is always excluded from results.

---

### Req 8 — Feedback Category Restriction

**Modified enum** in `src/modules/feedback/entities/feedback.entity.ts`:

```typescript
export enum FeedbackType {
  TEACHER = 'teacher',
  GENERAL = 'general',
}
```

**Data migration:** A TypeORM migration updates all existing rows where `category NOT IN ('teacher', 'general')` to `'general'`.

No controller or service logic changes beyond the enum narrowing — `@IsEnum(FeedbackType)` validation already rejects unknown values.

---

### Req 9 — Profile Update Restriction

**New DTO** in `src/modules/users/dto/patch-me.dto.ts`:

```typescript
export class PatchMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  profileImageFileId?: string;
}
```

**Modified controller:** `PATCH /users/me` uses `PatchMeDto` instead of `PatchUserDto`.

**Modified service method:**

```typescript
async patchMe(
  id: string,
  body: { phone?: string; profileImageFileId?: string },
): Promise<Omit<User, 'passwordHash'>>
```

Logic:
1. If `phone` provided → validate via `normalizePhone()` utility; throw `BadRequestException` on invalid format.
2. If `profileImageFileId` provided → `FileRecord.findOne({ id })` → throw `NotFoundException` if not found.
3. Apply only these two fields; all other fields on the User entity are untouched.

The existing `PATCH /users/:id` (admin) retains the full `PatchUserDto`.

---

### Req 10 — Announcement Grade-Wide and Section-Specific Targeting

**Entity change** — `Announcement`:

```typescript
@Column({ name: 'grade_id', type: 'uuid', nullable: true })
gradeId: string | null;
```

**Updated audience values:** `all` | `students` | `parents` | `class` | `grade` | `grade_section`

**Updated DTO** (`AnnDto`):

```typescript
@ApiPropertyOptional() @IsOptional() @IsUUID() gradeId?: string;
```

**Delivery logic for new audience types:**

```
audience = 'grade':
  1. enrollments = Enrollment.find({ status: 'active' })
     JOIN ClassOffering WHERE gradeId = announcement.gradeId
     AND academicYearId = announcement.academicYearId
  2. studentIds = unique enrollments.studentId
  3. parentIds = ParentStudent.find({ studentId: In(studentIds) }).map(parentId)
  4. Notify all studentIds + parentIds

audience = 'grade_section':
  1. enrollments = Enrollment.find({ status: 'active' })
     JOIN ClassOffering WHERE gradeId = announcement.gradeId
     AND sectionId = (ClassOffering.find({ id: announcement.classOfferingId }).sectionId)
     AND academicYearId = announcement.academicYearId
  2. studentIds = unique enrollments.studentId
  3. parentIds = ParentStudent.find({ studentId: In(studentIds) }).map(parentId)
  4. Notify all studentIds + parentIds
```

**Validation:**
- `grade` audience → `gradeId` required (400 if missing)
- `grade_section` audience → `gradeId` + `classOfferingId` required (400 if either missing)
- `class` audience → `classOfferingId` required (400 if missing)

**Enriched response** (list and detail):

```typescript
interface AnnouncementResponse extends Announcement {
  gradeName:   string | null;
  sectionName: string | null;
  subjectName: string | null;
  authorName:  string;          // author.firstName + ' ' + author.lastName
}
```

---

### Req 11 — Full Population of GET Responses

A shared helper `resolveClassContext(classOfferingId)` (introduced in Req 2) is reused across all enrichment points.

**Attendance sessions** (`GET /attendance-sessions`, `GET /attendance-sessions/:id`):

```typescript
interface EnrichedAttendanceSession extends AttendanceSession {
  className:   string | null;
  gradeName:   string | null;
  sectionName: string | null;
  subjectName: string | null;
  teacherName: string | null;
}
```

**Attendance marks** (`GET /attendance-sessions/:id/marks`):

```typescript
interface EnrichedAttendanceMark extends AttendanceMark {
  studentFirstName: string;
  studentLastName:  string;
}
```

**Class offerings** (`GET /class-offerings`, `GET /class-offerings/:id`):

```typescript
interface EnrichedClassOffering extends ClassOffering {
  gradeName:        string;
  sectionName:      string;
  subjectName:      string;
  teacherFirstName: string;
  teacherLastName:  string;
}
```

**Notifications** (`GET /notifications`): payloadJson already enriched by Req 2/3; no additional changes needed at the controller layer.

---

### Req 12 — Swagger Documentation

**Swagger setup** (already in `main.ts`): ensure `DocumentBuilder` includes all tags and the UI is served at `/api/docs`.

Every controller endpoint gets:
- `@ApiOperation({ summary, description })`
- `@ApiResponse({ status, description, type })` for 200, 400, 401, 403, 404
- `@ApiQuery` for every query parameter
- `@ApiParam` for every path parameter
- `@ApiBody` where applicable

All new and modified DTOs get `@ApiProperty` / `@ApiPropertyOptional` on every field.

A `docs/API_REFERENCE.md` is generated (or hand-authored) covering every endpoint with example request/response pairs.

---

## Data Models

### Entity Changes Summary

| Entity | Change |
|--------|--------|
| `Notification` | `type` column: `varchar(60)` → `simple-enum` using `NotificationType` |
| `Announcement` | Add `grade_id uuid nullable` column |
| `Feedback` | `FeedbackType` enum narrowed to `teacher` \| `general`; migration for legacy rows |

### New Enum

```typescript
// notification.entity.ts
export enum NotificationType {
  ATTENDANCE      = 'attendance',
  GRADE_SUBMITTED = 'grade_submitted',
  ANNOUNCEMENT    = 'announcement',
  BROADCAST       = 'broadcast',
  SYSTEM          = 'system',
}
```

### New DTO

```typescript
// patch-me.dto.ts
export class PatchMeDto {
  phone?:              string;
  profileImageFileId?: string;
}
```

### Migration Plan

1. **Notification type column**: `ALTER TABLE notifications ALTER COLUMN type ...` (or TypeORM migration with `simple-enum`).
2. **Announcement gradeId**: `ALTER TABLE announcements ADD COLUMN grade_id uuid NULL`.
3. **Feedback legacy categories**: `UPDATE feedbacks SET category = 'general' WHERE category NOT IN ('teacher', 'general')`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Invalid notification type is rejected

*For any* string value that is not a member of `NotificationType`, attempting to create a notification with that type SHALL be rejected with a validation error.

**Validates: Requirements 1.3**

---

### Property 2: Attendance notification payload contains all resolved class context fields

*For any* ClassOffering with associated Grade, Section, Subject, and Teacher, creating an attendance notification for a student in that class SHALL produce a `payloadJson` containing non-null values for `className`, `gradeName`, `sectionName`, `subjectName`, and `teacherName`.

**Validates: Requirements 2.1**

---

### Property 3: Grade release creates one notification per student (and per linked parent)

*For any* set of N ExamAttempts being released simultaneously, the system SHALL create exactly N `grade_submitted` notifications for the affected students, plus one additional notification for each parent linked to each student via `ParentStudent`.

**Validates: Requirements 3.1, 3.3, 3.4**

---

### Property 4: Grade submission notification payload contains all required fields

*For any* released ExamAttempt, the resulting `grade_submitted` notification's `payloadJson` SHALL contain all of: `examTitle`, `subjectName`, `score`, `maxPoints`, `classOfferingId`, `className`, `gradeName`, `sectionName`. The parent copy SHALL additionally contain `studentName`.

**Validates: Requirements 3.2, 3.3**

---

### Property 5: Attendance by-day returns one entry per active enrollment

*For any* student with N active Enrollments, `GET /attendance/by-day` for any date SHALL return exactly N entries, one per enrolled ClassOffering.

**Validates: Requirements 4.2**

---

### Property 6: Attendance by-day entries contain all required fields

*For any* entry returned by `GET /attendance/by-day`, it SHALL contain all of: `classOfferingId`, `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName`, `attendanceStatus`, and `note`.

**Validates: Requirements 4.3**

---

### Property 7: Attendance percentage formula is always correct

*For any* attendance summary with `present` P, `absent` A, `excused` E, `late` L counts (total T = P+A+E+L), the `attendancePercentage` SHALL equal `(P + L) / T * 100` rounded to two decimal places, or `null` when T = 0.

**Validates: Requirements 5.8, 5.9**

---

### Property 8: Student report courses array contains all required fields

*For any* student with at least one active Enrollment, each entry in the `courses` array of the student report SHALL contain: `classOfferingId`, `className`, `subjectName`, `teacherFirstName`, `teacherLastName`, `averageScore`, and `examCount`.

**Validates: Requirements 5.7**

---

### Property 9: Chat pagination cursor correctness

*For any* conversation and any valid cursor (message ID), all messages returned in the `data` array SHALL have a `createdAt` timestamp strictly less than the `createdAt` of the cursor message, and SHALL be ordered ascending by `createdAt`.

**Validates: Requirements 6.2, 6.8**

---

### Property 10: Chat pagination response shape and hasMore invariant

*For any* paginated messages request with limit L, if the number of matching messages is less than L then `hasMore` SHALL be `false` and `nextCursor` SHALL be `null`; if the number equals or exceeds L then `hasMore` SHALL be `true` and `nextCursor` SHALL be a non-null string.

**Validates: Requirements 6.4, 6.5**

---

### Property 11: Searchable users excludes the requesting user

*For any* user performing `GET /chat/searchable-users`, the response SHALL never contain an entry whose `id` equals the requesting user's `id`.

**Validates: Requirements 7.10**

---

### Property 12: Searchable users respects role-based visibility

*For any* Parent user, every entry in the searchable-users response SHALL be either a Teacher of a ClassOffering in which one of the parent's linked children is enrolled, or an Admin. No other user types SHALL appear.

*For any* Student user, every entry SHALL be either a Teacher of a ClassOffering in which the student is enrolled, or an Admin.

*For any* Teacher user, every entry SHALL be either a Student enrolled in one of the teacher's ClassOfferings, a Parent of such a student, or an Admin.

**Validates: Requirements 7.2, 7.3, 7.4**

---

### Property 13: Searchable users name filter is case-insensitive and universal

*For any* search string `q`, every entry returned by `GET /chat/searchable-users?q=q` SHALL have a `firstName` or `lastName` that contains `q` (case-insensitive). No entry whose name does not contain `q` SHALL appear.

**Validates: Requirements 7.6**

---

### Property 14: Invalid feedback category is rejected

*For any* string value not in `{ 'teacher', 'general' }`, submitting a feedback record with that `category` SHALL be rejected with a 400 Bad Request error.

**Validates: Requirements 8.2**

---

### Property 15: PATCH /users/me only persists phone and profileImageFileId

*For any* PATCH /users/me request body containing fields beyond `phone` and `profileImageFileId`, only `phone` and `profileImageFileId` SHALL be persisted; all other fields on the User record SHALL remain unchanged.

**Validates: Requirements 9.1, 9.2**

---

### Property 16: Grade announcement delivers to all students in the grade

*For any* announcement with `audience = 'grade'` and a given `gradeId`, every Student with an active Enrollment in any ClassOffering matching that `gradeId` (within the same AcademicYear) SHALL receive a notification. No student outside that grade SHALL receive the notification.

**Validates: Requirements 10.4**

---

### Property 17: Attendance session GET responses contain all resolved name fields

*For any* AttendanceSession returned by `GET /attendance-sessions` or `GET /attendance-sessions/:id`, the response SHALL include `className`, `gradeName`, `sectionName`, `subjectName`, and `teacherName` resolved from the associated ClassOffering.

**Validates: Requirements 11.2**

---

### Property 18: Class offering GET responses contain all resolved name fields

*For any* ClassOffering returned by `GET /class-offerings` or `GET /class-offerings/:id`, the response SHALL include `gradeName`, `sectionName`, `subjectName`, `teacherFirstName`, and `teacherLastName`.

**Validates: Requirements 11.4**

---

## Error Handling

| Scenario | HTTP Status | Notes |
|----------|-------------|-------|
| Missing `studentId` or `date` on `/attendance/by-day` | 400 | Validated in controller |
| Missing `type` and `startDate`/`endDate` on report | 400 | Validated in service |
| `limit > 100` on messages | 400 | Validated in service |
| `gradeId` missing for `grade`/`grade_section` audience | 400 | Validated in service |
| `classOfferingId` missing for `class`/`grade_section` audience | 400 | Validated in service |
| Invalid `NotificationType` value | 400 | `class-validator` `@IsEnum` |
| Invalid `FeedbackType` value | 400 | `class-validator` `@IsEnum` |
| `profileImageFileId` references non-existent file | 404 | Checked in `patchMe` |
| Non-member accessing conversation messages | 403 | `assertReadAccess` |
| Student accessing another student's attendance | 403 | `assertStudentViewer` |
| Parent accessing unlinked student's data | 403 | `assertStudentViewer` |
| Entity not found (session, exam, user, etc.) | 404 | `NotFoundException` |

All errors follow the existing `ErrorResponseDto` shape: `{ statusCode, message, error }`.

---

## Testing Strategy

### Unit Tests

Focus on pure business logic:
- `resolveDateRange()` — weekly/monthly/explicit/missing combinations
- `AttendanceSummary` calculation — various present/absent/excused/late combinations
- `resolveClassContext()` — found and not-found ClassOffering cases
- `PatchMeDto` validation — extra fields stripped, phone validation, file existence check
- Announcement audience validation — missing gradeId/classOfferingId cases

### Property-Based Tests

Use **fast-check** (TypeScript PBT library). Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: backend-improvements, Property N: <property_text>`

**Property 1** — Invalid notification type rejected:
Generate arbitrary strings not in `['attendance','grade_submitted','announcement','broadcast','system']`, verify `createForUser` throws.

**Property 2** — Attendance notification payload completeness:
Generate random ClassOffering + related entity data, call `putMarks`, verify payloadJson fields.

**Property 3** — Grade release notification count:
Generate N students with exam attempts, call `notifyGradeReleased`, verify notification count = N + sum(parent links).

**Property 4** — Grade notification payload shape:
Generate random exam/class data, verify all 8 required fields present in payloadJson.

**Property 5** — Attendance by-day entry count:
Generate student with N active enrollments, call `getByDay`, verify N entries returned.

**Property 6** — Attendance by-day entry fields:
Generate random enrollment data, verify each entry has all 8 required fields.

**Property 7** — Attendance percentage formula:
Generate random (present, absent, excused, late) tuples, verify formula holds exactly.

**Property 8** — Report courses array fields:
Generate student with enrollments, call `studentReport`, verify each course entry has all 7 fields.

**Property 9** — Cursor pagination correctness:
Generate conversation with random messages, pick random cursor, verify all returned messages are older.

**Property 10** — Pagination hasMore invariant:
Generate message sets of varying sizes relative to limit, verify hasMore/nextCursor invariant.

**Property 11** — Searchable users self-exclusion:
For any user, verify their own ID never appears in results.

**Property 12** — Role-based visibility:
Generate users of each role with random enrollment/link data, verify result set only contains allowed user types.

**Property 13** — Name filter universality:
Generate random search strings and user sets, verify all results contain the query string (case-insensitive).

**Property 14** — Invalid feedback category rejected:
Generate strings not in `['teacher','general']`, verify 400 rejection.

**Property 15** — Profile patch field restriction:
Generate arbitrary patch bodies with extra fields, verify only phone/profileImageFileId are persisted.

**Property 16** — Grade announcement delivery scope:
Generate grade with N enrolled students, create grade announcement, verify exactly N student notifications (plus parent notifications).

**Property 17** — Session response name fields:
Generate sessions with ClassOffering data, verify all 5 name fields present in response.

**Property 18** — Class offering response name fields:
Generate class offerings with related data, verify all 5 name fields present in response.

### Integration Tests

- `GET /attendance/by-day` — end-to-end with seeded DB
- `GET /reports/students/:id/report?type=weekly` — verify date range computation
- `GET /conversations/:id/messages?before=&limit=` — verify pagination against real message rows
- `GET /chat/searchable-users` — verify role filtering with seeded users
- `PATCH /users/me` — verify extra fields are stripped
- Announcement delivery for `grade` and `grade_section` audiences

### Smoke Tests

- Swagger UI accessible at `/api/docs`
- `docs/API_REFERENCE.md` exists and is non-empty
- `NotificationType` enum has exactly 5 values
- `FeedbackType` enum has exactly 2 values
- `Announcement` entity has `gradeId` column
- No feedback records with legacy category values after migration
