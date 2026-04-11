# Requirements Document

## Introduction

This document describes a set of targeted backend improvements to the TriLink school management system (NestJS). The improvements span ten areas: notification enrichment, attendance querying, report generation, chat pagination, chat user discovery, feedback simplification, profile update restrictions, announcement targeting, response population, and API documentation. Each step is independently deliverable and builds on the existing entity model without breaking existing contracts.

---

## Glossary

- **System**: The TriLink NestJS backend application.
- **Notification_Service**: The module responsible for creating and delivering in-app notifications.
- **NotificationType**: An enumeration of valid notification categories: `attendance`, `grade_submitted`, `announcement`, `broadcast`, `system`.
- **Attendance_Service**: The module responsible for recording and querying attendance sessions and marks.
- **AttendanceSession**: A record of a single attendance-taking event for a ClassOffering on a specific date.
- **AttendanceMark**: A record of a single student's attendance status (`present`, `absent`, `excused`, `late`) within an AttendanceSession, optionally with a note.
- **ClassOffering**: A teaching assignment linking a Grade, Section, Subject, Teacher, and AcademicYear.
- **Enrollment**: A record linking a Student to a ClassOffering for an AcademicYear with a status (`active`, `transferred`, `completed`).
- **Report_Service**: The module responsible for generating student performance and attendance reports.
- **Chat_Service**: The module responsible for conversations and messages between users.
- **Conversation**: A chat thread between two or more users.
- **ChatMessage**: A single message within a Conversation.
- **Cursor**: An opaque string token representing a position in a paginated message list, derived from a ChatMessage ID or timestamp.
- **Feedback_Service**: The module responsible for collecting and managing user feedback submissions.
- **FeedbackType**: An enumeration of feedback categories, restricted to `teacher` and `general`.
- **Announcement_Service**: The module responsible for creating and distributing school announcements.
- **AnnouncementAudience**: The target group for an announcement: `all`, `students`, `parents`, `class`, `grade`, `grade_section`.
- **Profile_Service**: The portion of the Users module that handles profile self-updates.
- **ParentStudent**: A record linking a Parent user to a Student user with a relationship label.
- **ExamAttempt**: A record of a student's score on an Exam, including a `releasedAt` timestamp set when the teacher releases scores.
- **Grade**: A school year level entity (e.g., "Grade 9").
- **Section**: A class division within a Grade (e.g., "A", "B").
- **Subject**: An academic subject entity (e.g., "Mathematics").
- **Admin**: A User with role `admin`.
- **Teacher**: A User with role `teacher`.
- **Student**: A User with role `student`.
- **Parent**: A User with role `parent`.
- **Swagger**: The OpenAPI documentation framework integrated via `@nestjs/swagger`.

---

## Requirements

### Requirement 1: Notification Type Enum

**User Story:** As a developer, I want a strongly-typed NotificationType enum, so that notification categories are consistent and validated across the codebase.

#### Acceptance Criteria

1. THE System SHALL define a `NotificationType` enum with exactly the values: `attendance`, `grade_submitted`, `announcement`, `broadcast`, `system`.
2. THE Notification entity SHALL store the `type` column using the `NotificationType` enum instead of a plain varchar.
3. WHEN a notification is created with a type value not present in `NotificationType`, THE Notification_Service SHALL reject the request with a validation error.

---

### Requirement 2: Enriched Attendance Notifications

**User Story:** As a parent or student, I want attendance notifications to include human-readable class details, so that I can understand which class the absence refers to without looking up IDs.

#### Acceptance Criteria

1. WHEN the Notification_Service creates an attendance notification, THE Notification_Service SHALL include in `payloadJson` the fields: `className`, `gradeName`, `sectionName`, `subjectName`, and `teacherName` resolved from the associated ClassOffering.
2. WHEN the ClassOffering referenced in an attendance notification cannot be resolved, THE Notification_Service SHALL still create the notification and set the unresolvable fields to `null` in `payloadJson`.
3. THE Notification_Service SHALL NOT store raw foreign-key IDs as the sole representation of class context in attendance notification payloads.

---

### Requirement 3: Grade Submission Notification

**User Story:** As a student or parent, I want to receive a notification when a teacher releases exam scores, so that I know results are available to review.

#### Acceptance Criteria

1. WHEN a Teacher releases exam scores (sets `releasedAt` on one or more ExamAttempts), THE Notification_Service SHALL create a notification of type `grade_submitted` for each affected Student.
2. THE grade_submitted notification SHALL include in `payloadJson`: `examTitle`, `subjectName`, `score`, `maxPoints`, `classOfferingId`, `className`, `gradeName`, `sectionName`.
3. WHEN the Student has a linked Parent via ParentStudent, THE Notification_Service SHALL also create a `grade_submitted` notification for that Parent with the same payload plus `studentName`.
4. WHEN score release affects multiple students simultaneously, THE Notification_Service SHALL create individual notifications per student (and per linked parent) rather than a single bulk notification.

---

### Requirement 4: Attendance by Day and Student

**User Story:** As a student or parent, I want to query attendance for a specific student on a specific date, so that I can see which classes were attended or missed that day.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /attendance/by-day` endpoint accepting query parameters `studentId` (UUID) and `date` (YYYY-MM-DD).
2. WHEN `GET /attendance/by-day` is called, THE Attendance_Service SHALL return one entry per ClassOffering in which the Student has an active Enrollment.
3. EACH entry in the response SHALL include: `classOfferingId`, `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName`, `attendanceStatus` (`present` | `absent` | `excused` | `late` | `no_session`), and `note`.
4. WHEN no AttendanceSession exists for a ClassOffering on the requested date, THE Attendance_Service SHALL set `attendanceStatus` to `no_session` and `note` to `null` for that entry.
5. WHEN `studentId` or `date` is missing from the request, THE Attendance_Service SHALL return a 400 Bad Request error.
6. WHEN the requesting user is a Student, THE Attendance_Service SHALL only permit queries where `studentId` equals the requesting user's ID.
7. WHEN the requesting user is a Parent, THE Attendance_Service SHALL only permit queries where `studentId` belongs to a linked child via ParentStudent.
8. WHEN the requesting user is a Teacher or Admin, THE Attendance_Service SHALL permit queries for any `studentId`.

---

### Requirement 5: Weekly and Monthly Student Reports

**User Story:** As a student, parent, teacher, or admin, I want to generate a structured weekly or monthly report for a student, so that I can review academic performance and attendance in a standardised format.

#### Acceptance Criteria

1. THE System SHALL update `GET /reports/students/:studentId/report` to accept a `type` query parameter with values `weekly` or `monthly`, in addition to the existing `startDate`/`endDate` parameters.
2. WHEN `type=weekly` is provided, THE Report_Service SHALL set the date range to the 7-day period ending on the current date (inclusive).
3. WHEN `type=monthly` is provided, THE Report_Service SHALL set the date range to the calendar month of the current date (first day to last day, inclusive).
4. WHEN both `type` and `startDate`/`endDate` are provided, THE Report_Service SHALL use `startDate`/`endDate` and ignore `type`.
5. WHEN neither `type` nor both of `startDate`/`endDate` are provided, THE Report_Service SHALL return a 400 Bad Request error.
6. THE report response SHALL include a `student` object with: `firstName`, `lastName`, `gradeName`, `sectionName`, `className`.
7. THE report response SHALL include a `courses` array where each entry contains: `classOfferingId`, `className`, `subjectName`, `teacherFirstName`, `teacherLastName`, `averageScore` (average of all released ExamAttempt scores for that ClassOffering within the date range, or `null` if none), `examCount`.
8. THE report response SHALL include an `attendance` object with: `present` (count), `absent` (count), `excused` (count), `late` (count), `total` (count), `attendancePercentage` (calculated as `(present + late) / total * 100`, rounded to two decimal places, or `null` if total is 0).
9. FOR ALL valid report requests, excused absences SHALL be counted as absent in the `attendancePercentage` calculation (i.e., `attendancePercentage = (present + late) / total * 100`), while still being reported separately in the `excused` count field.
10. WHEN the requesting user is a Student, THE Report_Service SHALL only permit report generation for that student's own ID.
11. WHEN the requesting user is a Parent, THE Report_Service SHALL only permit report generation for a studentId linked via ParentStudent.
12. WHEN the requesting user is a Teacher, THE Report_Service SHALL only permit report generation for students enrolled in at least one of that teacher's ClassOfferings.
13. WHEN the requesting user is an Admin, THE Report_Service SHALL permit report generation for any studentId.

---

### Requirement 6: Chat Message Pagination

**User Story:** As a user, I want to load conversation messages in pages, so that the app remains performant in long conversations.

#### Acceptance Criteria

1. THE System SHALL update `GET /conversations/:id/messages` to accept optional query parameters `before` (cursor string) and `limit` (positive integer, default 20, maximum 100).
2. WHEN `before` is provided, THE Chat_Service SHALL return only messages with a `createdAt` timestamp strictly before the message identified by the cursor.
3. WHEN `before` is omitted, THE Chat_Service SHALL return the most recent `limit` messages in the conversation.
4. THE response SHALL have the shape `{ data: ChatMessage[], nextCursor: string | null, hasMore: boolean }`.
5. WHEN fewer messages than `limit` remain before the cursor, THE Chat_Service SHALL set `hasMore` to `false` and `nextCursor` to `null`.
6. WHEN `limit` exceeds 100, THE Chat_Service SHALL return a 400 Bad Request error.
7. WHEN the requesting user is not a member of the conversation, THE Chat_Service SHALL return a 403 Forbidden error.
8. THE messages in `data` SHALL be ordered from oldest to newest within the returned page.

---

### Requirement 7: Smart User Search for Chat

**User Story:** As a user, I want to search for people I can start a chat with, so that I only see relevant contacts rather than the entire user directory.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /chat/searchable-users` endpoint accepting optional query parameters `q` (name search string) and `type` (UserRole filter).
2. WHEN the requesting user is a Parent, THE Chat_Service SHALL return only: Teachers of ClassOfferings in which the Parent's linked children are enrolled, and Admin users.
3. WHEN the requesting user is a Teacher, THE Chat_Service SHALL return only: Students enrolled in that Teacher's ClassOfferings, Parents of those Students, and Admin users.
4. WHEN the requesting user is a Student, THE Chat_Service SHALL return only: Teachers of ClassOfferings in which the Student is enrolled, and Admin users.
5. WHEN the requesting user is an Admin, THE Chat_Service SHALL return all users.
6. WHEN `q` is provided, THE Chat_Service SHALL filter results to users whose `firstName` or `lastName` contains the search string (case-insensitive).
7. WHEN `type` is provided, THE Chat_Service SHALL filter results to users matching the specified role.
8. EACH result entry SHALL include: `id`, `firstName`, `lastName`, `role`, `subjects` (array of subject names for Teachers, empty array for other roles), `profileImageFileId`.
9. WHEN a Teacher is included in results, THE Chat_Service SHALL populate `subjects` with only the subject names relevant to the requesting user's context (e.g., subjects taught to the requester's children or enrolled classes).
10. THE Chat_Service SHALL NOT include the requesting user in the search results.

---

### Requirement 8: Feedback Category Restriction

**User Story:** As a developer, I want the feedback category enum to only contain Teacher and General types, so that the feedback system is focused and avoids unused categories.

#### Acceptance Criteria

1. THE System SHALL redefine the `FeedbackType` enum to contain exactly two values: `TEACHER = 'teacher'` and `GENERAL = 'general'`.
2. WHEN a feedback submission is received with a `category` value not in the updated `FeedbackType` enum, THE Feedback_Service SHALL reject the request with a 400 Bad Request error.
3. THE System SHALL migrate or update any existing feedback records with legacy category values (`teaching`, `facility`, `safety`, `curriculum`, `behavior`, `other`) to `general` as a default fallback.

---

### Requirement 9: Profile Update Restriction

**User Story:** As a user, I want to update only my phone number and profile picture via the profile endpoint, so that sensitive fields like name and role cannot be accidentally changed through self-service.

#### Acceptance Criteria

1. THE Profile_Service SHALL restrict `PATCH /users/me` to accept only the fields `phone` and `profileImageFileId`.
2. WHEN a request to `PATCH /users/me` includes any field other than `phone` or `profileImageFileId`, THE Profile_Service SHALL ignore those additional fields silently (strip them before processing).
3. THE System SHALL keep password changes exclusively on the `POST /auth/change-password` endpoint and SHALL NOT accept password fields on `PATCH /users/me`.
4. WHEN `phone` is provided in the update, THE Profile_Service SHALL validate it using the existing phone validation utility before persisting.
5. WHEN `profileImageFileId` is provided, THE Profile_Service SHALL verify the referenced file exists before persisting the update.

---

### Requirement 10: Announcement Grade-Wide and Section-Specific Targeting

**User Story:** As an admin or teacher, I want to send announcements to an entire grade or a specific grade-section combination, so that I can target communications without manually selecting individual classes.

#### Acceptance Criteria

1. THE Announcement entity SHALL include a `gradeId` column (nullable UUID) to support grade-level targeting.
2. THE System SHALL support the following `AnnouncementAudience` values: `all`, `students`, `parents`, `class`, `grade`, `grade_section`.
3. WHEN audience is `class`, THE Announcement_Service SHALL deliver the announcement to all Students enrolled in the specified `classOfferingId` and to all Parents linked to those Students via ParentStudent.
4. WHEN audience is `grade`, THE Announcement_Service SHALL deliver the announcement to all Students enrolled in any ClassOffering where `gradeId` matches the announcement's `gradeId` (within the current AcademicYear), and to all Parents linked to those Students.
5. WHEN audience is `grade_section`, THE Announcement_Service SHALL deliver the announcement to all Students enrolled in ClassOfferings matching both the announcement's `gradeId` and `classOfferingId`'s `sectionId`, and to all Parents linked to those Students.
6. WHEN audience is `all`, `students`, or `parents`, THE Announcement_Service SHALL behave as currently implemented (no change to existing logic).
7. THE announcement list/detail response SHALL include populated fields: `gradeName` (from Grade entity), `sectionName` (from Section entity via ClassOffering), `subjectName` (from Subject entity via ClassOffering), `authorName` (firstName + lastName of the author User).
8. WHEN `gradeId` is required for the selected audience (`grade` or `grade_section`) but is not provided, THE Announcement_Service SHALL return a 400 Bad Request error.
9. WHEN `classOfferingId` is required for the selected audience (`class` or `grade_section`) but is not provided, THE Announcement_Service SHALL return a 400 Bad Request error.

---

### Requirement 11: Full Population of GET Responses

**User Story:** As a frontend developer, I want all GET responses to return human-readable names instead of raw UUIDs, so that the UI can display data without making additional lookup requests.

#### Acceptance Criteria

1. WHEN `GET /notifications` or `GET /notifications/:id` is called, THE Notification_Service SHALL include in each notification's `payloadJson` (where applicable): `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName`.
2. WHEN `GET /attendance/sessions` or `GET /attendance/sessions/:id` is called, THE Attendance_Service SHALL include in each session: `className`, `gradeName`, `sectionName`, `subjectName`, `teacherName` resolved from the ClassOffering.
3. WHEN `GET /attendance/sessions/:id/marks` is called, THE Attendance_Service SHALL include in each mark: `studentFirstName`, `studentLastName`.
4. WHEN `GET /class-offerings` or `GET /class-offerings/:id` is called, THE System SHALL include in each ClassOffering response: `gradeName`, `sectionName`, `subjectName`, `teacherFirstName`, `teacherLastName`.
5. THE System SHALL NOT return raw foreign-key UUID fields as the sole representation of related entities in any of the above GET responses (the UUID MAY still be included alongside the resolved name).

---

### Requirement 12: Swagger Documentation and API Reference

**User Story:** As a developer integrating with the TriLink backend, I want complete Swagger decorators and a generated API reference document, so that I can understand every endpoint's inputs, outputs, and error cases without reading source code.

#### Acceptance Criteria

1. THE System SHALL add `@ApiOperation`, `@ApiResponse`, `@ApiQuery`, `@ApiParam`, and `@ApiBody` Swagger decorators to every controller endpoint that does not already have complete coverage.
2. WHEN the application starts, THE System SHALL serve a Swagger UI at `/api/docs` reflecting all decorated endpoints.
3. THE System SHALL generate a `docs/API_REFERENCE.md` file containing, for every endpoint: HTTP method, path, description, request parameters/body schema, and at least one realistic example request and response.
4. THE `docs/API_REFERENCE.md` SHALL include example responses for both success cases and common error cases (400, 401, 403, 404) for each endpoint.
5. THE System SHALL define Swagger DTO schemas (using `@ApiProperty`) for all request and response DTOs used by the improved or new endpoints introduced in Requirements 1–11.
