# Implementation Plan: Backend Improvements

## Overview

Twelve targeted improvements to the TriLink NestJS backend, implemented in sequential order. Each task builds on the previous ones. The `resolveClassContext` helper introduced in Task 2 is reused throughout Tasks 4, 5, 10, and 11. All changes are additive — no existing API contracts are broken.

## Tasks

- [ ] 1. NotificationType enum + Notification entity update
  - [ ] 1.1 Define `NotificationType` enum and update `Notification` entity
    - In `src/modules/notifications/entities/notification.entity.ts`, export `NotificationType` enum with values: `ATTENDANCE = 'attendance'`, `GRADE_SUBMITTED = 'grade_submitted'`, `ANNOUNCEMENT = 'announcement'`, `BROADCAST = 'broadcast'`, `SYSTEM = 'system'`
    - Change the `type` column from `varchar(60)` to `simple-enum` using `NotificationType`
    - Update `createForUser` signature in `NotificationsService` to accept `type: NotificationType` instead of `string`
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Update all callers of `createForUser` to use `NotificationType` enum values
    - `AttendanceService.putMarks()` → `NotificationType.ATTENDANCE`
    - `AnnouncementsService` broadcast path → `NotificationType.ANNOUNCEMENT`
    - `NotificationsService.broadcastFromStaff()` → `NotificationType.BROADCAST`
    - `ExamsService.notifyExamResultReleased()` → update `'exam_result'` and `'exam_submission'` to use the closest valid enum value or add them if needed; for now map `exam_result` → `NotificationType.GRADE_SUBMITTED` and `exam_submission` → `NotificationType.SYSTEM`
    - _Requirements: 1.2_

  - [ ]* 1.3 Write property test for invalid notification type rejection
    - **Property 1: Invalid notification type is rejected**
    - Generate arbitrary strings not in `['attendance','grade_submitted','announcement','broadcast','system']`, verify `createForUser` throws a validation error
    - **Validates: Requirements 1.3**

- [ ] 2. Enriched attendance notifications + `resolveClassContext` helper
  - [ ] 2.1 Add `resolveClassContext` helper to `NotificationsService`
    - Inject repositories for `Grade`, `Section`, `Subject`, and `User` into `NotificationsService`
    - Implement `async resolveClassContext(classOfferingId: string): Promise<{ className: string|null, gradeName: string|null, sectionName: string|null, subjectName: string|null, teacherName: string|null }>`
    - Look up the `ClassOffering`, then resolve each related entity; return all `null` if the offering is not found
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Update `AttendanceService.putMarks()` to use enriched payload
    - Before creating each attendance notification, call `notifications.resolveClassContext(session.classOfferingId)`
    - Replace the current minimal `payloadJson` with the full `AttendanceNotificationPayload` shape: `{ sessionId, studentId, status, date, className, gradeName, sectionName, subjectName, teacherName }`
    - Ensure the notification is still created even when `resolveClassContext` returns all-null fields
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.3 Write property test for attendance notification payload completeness
    - **Property 2: Attendance notification payload contains all resolved class context fields**
    - For a ClassOffering with associated Grade, Section, Subject, and Teacher, verify `payloadJson` contains non-null `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName`
    - **Validates: Requirements 2.1**

- [ ] 3. Grade submission notifications on exam score release
  - [ ] 3.1 Add `notifyGradeReleased` method to `NotificationsService`
    - Inject `ExamAttempt`, `Exam`, `ClassOffering`, and `ParentStudent` repositories into `NotificationsService`
    - Implement `async notifyGradeReleased(attempts: ExamAttempt[]): Promise<void>`
    - For each attempt: resolve `Exam` (examTitle, maxPoints), resolve `ClassOffering` context via `resolveClassContext`, create a `grade_submitted` notification for the student with payload `{ examTitle, subjectName, score, maxPoints, classOfferingId, className, gradeName, sectionName }`
    - For each attempt: find `ParentStudent` links for the student, create a `grade_submitted` notification for each parent with the same payload plus `studentName`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 Wire `notifyGradeReleased` into `ExamsService.release()`
    - In `ExamsService.release()`, replace the existing `notifyExamResultReleased` call with `notifications.notifyGradeReleased([saved])`
    - Remove the old `notifyExamResultReleased` private method (or keep it only if used elsewhere)
    - _Requirements: 3.1_

  - [ ]* 3.3 Write property test for grade release notification count
    - **Property 3: Grade release creates one notification per student (and per linked parent)**
    - For N exam attempts released simultaneously, verify exactly N `grade_submitted` student notifications plus one per linked parent
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [ ]* 3.4 Write property test for grade submission notification payload shape
    - **Property 4: Grade submission notification payload contains all required fields**
    - For any released ExamAttempt, verify `payloadJson` contains all of: `examTitle`, `subjectName`, `score`, `maxPoints`, `classOfferingId`, `className`, `gradeName`, `sectionName`; parent copy also has `studentName`
    - **Validates: Requirements 3.2, 3.3**

- [ ] 4. Attendance by-day endpoint
  - [ ] 4.1 Add `getByDay` method to `AttendanceService`
    - Inject `ParentStudent` and `User` repositories if not already present
    - Implement `async getByDay(studentId: string, date: string, viewer: User): Promise<AttendanceByDayEntry[]>`
    - Call `assertStudentViewer(viewer, studentId)` for access control
    - Find all active `Enrollment` records for the student; for each, load the `ClassOffering` and call `resolveClassContext`
    - Find the `AttendanceSession` for that `classOfferingId` on the given `date`; if found, find the `AttendanceMark` for the student
    - Build each entry: `{ classOfferingId, className, gradeName, sectionName, subjectName, teacherName, attendanceStatus: mark?.status ?? 'no_session', note: mark?.note ?? null }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8_

  - [ ] 4.2 Add `GET /attendance/by-day` endpoint to `AttendanceController`
    - Add route `@Get('attendance/by-day')` accessible to all roles
    - Accept `@Query('studentId')` and `@Query('date')` query params; throw `BadRequestException` if either is missing
    - Call `svc.getByDay(studentId, date, user)`
    - Add `@ApiOperation`, `@ApiQuery` for `studentId` and `date`, and `@ApiResponse` decorators
    - _Requirements: 4.1, 4.5_

  - [ ]* 4.3 Write property test for attendance by-day entry count
    - **Property 5: Attendance by-day returns one entry per active enrollment**
    - For a student with N active enrollments, verify `getByDay` returns exactly N entries
    - **Validates: Requirements 4.2**

  - [ ]* 4.4 Write property test for attendance by-day entry fields
    - **Property 6: Attendance by-day entries contain all required fields**
    - For any entry returned, verify it contains all 8 required fields: `classOfferingId`, `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName`, `attendanceStatus`, `note`
    - **Validates: Requirements 4.3**

- [ ] 5. Reports: weekly/monthly type param + full population
  - [ ] 5.1 Refactor `ReportsService.studentReport()` to accept `type` param and return enriched response
    - Change method signature to `async studentReport(studentId, viewer, opts: { type?: 'weekly'|'monthly'; startDate?: string; endDate?: string })`
    - Implement `resolveDateRange(opts)`: if `startDate` + `endDate` provided, use them; if `type=weekly`, use today minus 6 days to today; if `type=monthly`, use first to last day of current month; otherwise throw `BadRequestException`
    - Enrich the `student` object: resolve `gradeName`, `sectionName`, `className` from the student's active enrollments (use first enrollment's ClassOffering for grade/section/class context)
    - Build a `courses` array: for each active enrollment, resolve ClassOffering context, compute `averageScore` (average of released `ExamAttempt` scores for that `classOfferingId` within the date range), and `examCount`
    - Build an `attendance` object with `present`, `absent`, `excused`, `late`, `total`, and `attendancePercentage = (present + late) / total * 100` rounded to 2 decimal places (null if total = 0)
    - Apply teacher access restriction: if viewer is `TEACHER`, verify the student is enrolled in at least one of the teacher's ClassOfferings
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_

  - [ ] 5.2 Update `ReportsController.studentReport()` to pass new params
    - Add `@Query('type')` parameter alongside existing `startDate`/`endDate`
    - Remove the existing `if (!startDate || !endDate)` guard (validation now lives in the service)
    - Pass `{ type, startDate, endDate }` to `reports.studentReport()`
    - Add `@ApiQuery` for `type` with enum `['weekly', 'monthly']` and `required: false`
    - _Requirements: 5.1_

  - [ ]* 5.3 Write property test for attendance percentage formula
    - **Property 7: Attendance percentage formula is always correct**
    - Generate random `(present, absent, excused, late)` tuples, verify `attendancePercentage = (present + late) / total * 100` rounded to 2dp, or null when total = 0
    - **Validates: Requirements 5.8, 5.9**

  - [ ]* 5.4 Write property test for report courses array fields
    - **Property 8: Student report courses array contains all required fields**
    - For a student with at least one active enrollment, verify each `courses` entry has: `classOfferingId`, `className`, `subjectName`, `teacherFirstName`, `teacherLastName`, `averageScore`, `examCount`
    - **Validates: Requirements 5.7**

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Chat message pagination (cursor-based)
  - [ ] 7.1 Update `ChatService.listMessages()` to support cursor-based pagination
    - Change signature to `async listMessages(conversationId, user, opts: { before?: string; limit?: number }): Promise<PaginatedMessages>`
    - Validate `limit ≤ 100`; throw `BadRequestException` if exceeded; default to 20
    - If `before` provided: find the cursor message by ID, query messages with `createdAt < cursor.createdAt` ordered `ASC`, take `limit + 1`
    - If `before` omitted: query most recent messages ordered `DESC`, take `limit + 1`, then reverse to `ASC`
    - Set `hasMore = results.length > limit`; `data = results.slice(0, limit)`; `nextCursor = hasMore ? data[data.length-1].id : null`
    - Return `{ data, nextCursor, hasMore }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8_

  - [ ] 7.2 Update `ChatController` messages endpoint to pass pagination params
    - Add `@Query('before')` and update `@Query('limit')` handling
    - Pass `{ before, limit: limit ? parseInt(limit, 10) : undefined }` to `chat.listMessages()`
    - Add `@ApiQuery` for `before` (optional cursor string) and `limit` (optional integer, default 20, max 100)
    - Add `@ApiResponse` for 400 (limit exceeded) and 403 (not a member)
    - _Requirements: 6.1, 6.6, 6.7_

  - [ ]* 7.3 Write property test for cursor pagination correctness
    - **Property 9: Chat pagination cursor correctness**
    - For any conversation and valid cursor, all returned messages SHALL have `createdAt` strictly less than the cursor message's `createdAt`, ordered ascending
    - **Validates: Requirements 6.2, 6.8**

  - [ ]* 7.4 Write property test for pagination hasMore invariant
    - **Property 10: Chat pagination response shape and hasMore invariant**
    - For limit L: if matching messages < L then `hasMore=false` and `nextCursor=null`; if ≥ L then `hasMore=true` and `nextCursor` is non-null
    - **Validates: Requirements 6.4, 6.5**

- [ ] 8. Chat searchable users endpoint
  - [ ] 8.1 Add `searchableUsers` method to `ChatService`
    - Inject `Enrollment`, `ClassOffering`, `Subject`, and `User` repositories into `ChatService`
    - Implement `async searchableUsers(viewer: User, opts: { q?: string; type?: UserRole }): Promise<SearchableUserEntry[]>`
    - PARENT: find linked children via `ParentStudent`, get their active enrollments, collect teacher IDs from those ClassOfferings + all admin IDs
    - TEACHER: find students enrolled in viewer's ClassOfferings + their parents via `ParentStudent` + all admin IDs
    - STUDENT: find teachers of ClassOfferings where viewer is enrolled + all admin IDs
    - ADMIN: all users
    - For each teacher in results, populate `subjects` with only the subject names relevant to the requester's context
    - Apply `q` filter (case-insensitive `firstName` or `lastName` contains query) and `type` filter (role match)
    - Exclude the requesting user from results
    - Return `{ id, firstName, lastName, role, subjects, profileImageFileId }` per entry
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ] 8.2 Add `GET /chat/searchable-users` endpoint to `ChatController`
    - Add route `@Get('chat/searchable-users')` accessible to all roles
    - Accept `@Query('q')` and `@Query('type')` params
    - Call `chat.searchableUsers(user, { q, type: type as UserRole })`
    - Add `@ApiOperation`, `@ApiQuery` for `q` and `type`, and `@ApiResponse` decorators
    - _Requirements: 7.1_

  - [ ]* 8.3 Write property test for searchable users self-exclusion
    - **Property 11: Searchable users excludes the requesting user**
    - For any user, verify their own ID never appears in results
    - **Validates: Requirements 7.10**

  - [ ]* 8.4 Write property test for role-based visibility
    - **Property 12: Searchable users respects role-based visibility**
    - For PARENT: results only contain teachers of children's classes or admins; for STUDENT: only teachers of enrolled classes or admins; for TEACHER: only enrolled students, their parents, or admins
    - **Validates: Requirements 7.2, 7.3, 7.4**

  - [ ]* 8.5 Write property test for name filter universality
    - **Property 13: Searchable users name filter is case-insensitive and universal**
    - For any search string `q`, every result entry's `firstName` or `lastName` contains `q` (case-insensitive); no non-matching entry appears
    - **Validates: Requirements 7.6**

- [ ] 9. Feedback category restriction
  - [ ] 9.1 Redefine `FeedbackType` enum and add data migration
    - In `src/modules/feedback/entities/feedback.entity.ts`, redefine `FeedbackType` to `{ TEACHER = 'teacher', GENERAL = 'general' }`
    - Update the `@Column` default from `FeedbackType.OTHER` to `FeedbackType.GENERAL`
    - Write a TypeORM migration file in `src/database/migrations/` that runs: `UPDATE feedbacks SET category = 'general' WHERE category NOT IN ('teacher', 'general')`
    - _Requirements: 8.1, 8.3_

  - [ ] 9.2 Verify feedback controller and service reject invalid categories
    - The existing `@IsEnum(FeedbackType)` in `FCreate` DTO will automatically reject unknown values after the enum is narrowed — confirm no additional changes are needed in `FeedbackController` or `FeedbackService`
    - Update the `@ApiProperty` enum annotation on `FCreate.category` to reflect the new two-value enum
    - _Requirements: 8.2_

  - [ ]* 9.3 Write property test for invalid feedback category rejection
    - **Property 14: Invalid feedback category is rejected**
    - Generate strings not in `['teacher', 'general']`, verify the DTO validation rejects them with a 400 error
    - **Validates: Requirements 8.2**

- [ ] 10. Profile update restriction (phone + profileImageFileId only)
  - [ ] 10.1 Create `PatchMeDto` and `patchMe` service method
    - Create `src/modules/users/dto/patch-me.dto.ts` with only `phone?: string` (with `@IsOptional() @IsString()`) and `profileImageFileId?: string` (with `@IsOptional() @IsUUID()`) fields, both decorated with `@ApiPropertyOptional()`
    - Add `async patchMe(id: string, body: { phone?: string; profileImageFileId?: string })` to `UsersService`
    - If `phone` provided, validate via `normalizePhone()` from `src/common/utils/phone.util.ts`; throw `BadRequestException` on invalid format
    - If `profileImageFileId` provided, inject `FileRecord` repository and verify the file exists; throw `NotFoundException` if not found
    - Apply only `phone` and `profileImageFileId` to the user record; save and return `toPublic(saved)`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 10.2 Update `UsersController.patchMe()` to use `PatchMeDto`
    - Change `@Body() body: PatchUserDto` to `@Body() body: PatchMeDto` on the `PATCH /users/me` route
    - Call `users.patchMe(user.id, body)` instead of `users.patchUser(user.id, body)`
    - Add `@ApiOperation` and `@ApiResponse` decorators
    - _Requirements: 9.1, 9.2_

  - [ ]* 10.3 Write property test for profile patch field restriction
    - **Property 15: PATCH /users/me only persists phone and profileImageFileId**
    - Generate arbitrary patch bodies with extra fields (firstName, lastName, role, etc.), verify only `phone` and `profileImageFileId` are persisted; all other User fields remain unchanged
    - **Validates: Requirements 9.1, 9.2**

- [ ] 11. Announcement grade/section targeting + parent delivery
  - [ ] 11.1 Add `gradeId` column to `Announcement` entity and update DTO
    - In `src/modules/announcements/entities/announcement.entity.ts`, add `@Column({ name: 'grade_id', type: 'uuid', nullable: true }) gradeId: string | null`
    - Write a TypeORM migration: `ALTER TABLE announcements ADD COLUMN grade_id uuid NULL`
    - In `AnnouncementsController`, add `@ApiPropertyOptional() @IsOptional() @IsUUID() gradeId?: string` to `AnnDto` and `AnnPatchDto`
    - _Requirements: 10.1, 10.2_

  - [ ] 11.2 Implement grade and grade_section delivery logic in `AnnouncementsService`
    - Inject `ClassOffering`, `ParentStudent`, and `User` repositories into `AnnouncementsService`
    - Add a private `deliverAnnouncement(announcement: Announcement): Promise<void>` method that handles all audience types
    - For `audience = 'grade'`: find active enrollments joined with ClassOfferings where `gradeId` matches and `academicYearId` matches; collect unique `studentId`s; find their parents via `ParentStudent`; emit notifications to all
    - For `audience = 'grade_section'`: additionally filter ClassOfferings by `sectionId` (resolved from `classOfferingId`); same delivery pattern
    - For `audience = 'class'`: existing logic (students enrolled in `classOfferingId` + their parents)
    - Validate: `grade`/`grade_section` audience requires `gradeId` (400 if missing); `class`/`grade_section` requires `classOfferingId` (400 if missing)
    - Call `deliverAnnouncement` from `create()` and `update()` after saving
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.8, 10.9_

  - [ ] 11.3 Enrich announcement list/detail responses with resolved names
    - Add a private `enrichAnnouncement(a: Announcement)` helper that resolves `gradeName` (from `Grade`), `sectionName` (from `Section` via ClassOffering), `subjectName` (from `Subject` via ClassOffering), and `authorName` (firstName + lastName from `User`)
    - Apply enrichment in `list()`, `forUser()`, `create()`, and `update()` return values
    - Update `forUser()` to also filter for `grade` and `grade_section` audiences: a student sees announcements where they are enrolled in a matching ClassOffering; a parent sees announcements targeting their linked children's grade/section
    - _Requirements: 10.7_

  - [ ]* 11.4 Write property test for grade announcement delivery scope
    - **Property 16: Grade announcement delivers to all students in the grade**
    - For an announcement with `audience='grade'` and a given `gradeId`, verify every student enrolled in a matching ClassOffering receives a notification, and no student outside the grade does
    - **Validates: Requirements 10.4**

- [ ] 12. Populate GET responses (attendance sessions, marks, class offerings)
  - [ ] 12.1 Enrich attendance session responses
    - In `AttendanceService.listSessions()` and a new `getSession(id)` method, call `resolveClassContext(session.classOfferingId)` and merge the result into each session object
    - Add `GET /attendance-sessions/:id` route to `AttendanceController` calling `svc.getSession(id)`
    - Return `EnrichedAttendanceSession` shape: `{ ...session, className, gradeName, sectionName, subjectName, teacherName }`
    - _Requirements: 11.2_

  - [ ] 12.2 Enrich attendance mark responses with student names
    - In `AttendanceService.getMarks(sessionId)`, for each mark, look up the student `User` and append `studentFirstName` and `studentLastName`
    - Return `EnrichedAttendanceMark` shape: `{ ...mark, studentFirstName, studentLastName }`
    - _Requirements: 11.3_

  - [ ] 12.3 Enrich class offering responses with teacher names
    - In `ClassOfferingsService.attachStructureLabels()`, also resolve `teacherFirstName` and `teacherLastName` from the `User` repository for each offering's `teacherId`
    - Update `ClassOfferingWithLabels` type to include `teacherFirstName: string | null` and `teacherLastName: string | null`
    - _Requirements: 11.4_

  - [ ]* 12.4 Write property test for session response name fields
    - **Property 17: Attendance session GET responses contain all resolved name fields**
    - For any AttendanceSession, verify the response includes `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName`
    - **Validates: Requirements 11.2**

  - [ ]* 12.5 Write property test for class offering response name fields
    - **Property 18: Class offering GET responses contain all resolved name fields**
    - For any ClassOffering, verify the response includes `gradeName`, `sectionName`, `subjectName`, `teacherFirstName`, `teacherLastName`
    - **Validates: Requirements 11.4**

- [ ] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Swagger decorators + API_REFERENCE.md documentation
  - [ ] 14.1 Add Swagger decorators to all new and modified endpoints
    - Add `@ApiOperation`, `@ApiResponse` (200, 400, 401, 403, 404), `@ApiQuery`, `@ApiParam`, and `@ApiBody` to:
      - `GET /attendance/by-day` (new)
      - `GET /attendance-sessions/:id` (new)
      - `GET /attendance-sessions` and `GET /attendance-sessions/:id/marks` (updated responses)
      - `GET /reports/students/:studentId/report` (updated with `type` param)
      - `GET /conversations/:id/messages` (updated with `before`/`limit` params)
      - `GET /chat/searchable-users` (new)
      - `PATCH /users/me` (updated DTO)
      - `POST /announcements` and `PATCH /announcements/:id` (updated with `gradeId`)
      - `GET /class-offerings` and `GET /class-offerings/:id` (updated responses)
    - Add `@ApiProperty` / `@ApiPropertyOptional` to all new and modified DTOs: `PatchMeDto`, updated `AnnDto`/`AnnPatchDto`, `BulkMarksDto`, `FCreate`
    - _Requirements: 12.1, 12.5_

  - [ ] 14.2 Verify Swagger UI is served at `/api/docs`
    - Check `src/main.ts` `DocumentBuilder` setup; ensure all new `@ApiTags` are included and the UI path is `/api/docs`
    - _Requirements: 12.2_

  - [ ] 14.3 Generate `docs/API_REFERENCE.md`
    - Create `docs/API_REFERENCE.md` covering every endpoint introduced or modified in Requirements 1–11
    - For each endpoint include: HTTP method, path, description, request parameters/body schema, at least one realistic example request, and example responses for success (200/201) and common errors (400, 401, 403, 404)
    - _Requirements: 12.3, 12.4_

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- `resolveClassContext` (introduced in Task 2) is the shared enrichment helper reused in Tasks 4, 5, 11, and 12
- The TypeORM migrations for `Announcement.gradeId`, `Notification.type` enum change, and `Feedback` legacy category cleanup must be run before deploying
- Property tests use **fast-check** with a minimum of 100 iterations per property
- Each property test file should include the tag comment: `// Feature: backend-improvements, Property N: <property_text>`
- The existing `assertStudentViewer` pattern in `AttendanceService` and `ReportsService` is reused as-is for access control in Tasks 4 and 5
