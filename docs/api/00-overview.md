# TriLink Backend API — Frontend Reference

## Base URL
```
Production: https://trilink-backend-ms68.onrender.com/api
Local:      http://localhost:4000/api
```

## Authentication
All endpoints require a JWT Bearer token **except**:
- `GET /files/:id/download` — public redirect
- `GET /files/:id/url` — public URL getter
- `GET /health` — liveness probe

### How to authenticate
1. Call `POST /auth/login` → get `accessToken` and `refreshToken`
2. Send `Authorization: Bearer <accessToken>` header on every request
3. When `accessToken` expires, call `POST /auth/refresh` with the `refreshToken`

### Token shape
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@school.edu",
    "role": "student",
    "firstName": "Ali",
    "lastName": "Hassan",
    "mustChangePassword": false,
    "profileImageFileId": null,
    "profileImagePath": null
  }
}
```

## Roles
| Role | Description |
|------|-------------|
| `admin` | Full access to everything |
| `teacher` | Manages their own classes, grades, attendance, assignments |
| `student` | Views own data only |
| `parent` | Views linked child's data only |

## Common Response Patterns

### Success
HTTP 200/201 with JSON body.

### Errors
```json
{ "statusCode": 400, "error": "Bad Request", "message": "Validation failed" }
{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid email or password" }
{ "statusCode": 403, "error": "Forbidden", "message": "Forbidden resource" }
{ "statusCode": 404, "error": "Not Found", "message": "User not found" }
{ "statusCode": 409, "error": "Conflict", "message": "Email already registered" }
```

## All API Files
- [01-auth.md](./01-auth.md) — Login, register, change password
- [02-users.md](./02-users.md) — User directory, profiles, filtering
- [03-academic-years.md](./03-academic-years.md) — Academic years, terms
- [04-school-structure.md](./04-school-structure.md) — Grades, sections, subjects
- [05-class-offerings.md](./05-class-offerings.md) — Class offerings, bulk creation
- [06-enrollments.md](./06-enrollments.md) — Student enrollment
- [07-parent-students.md](./07-parent-students.md) — Parent-child links
- [08-attendance.md](./08-attendance.md) — Sessions, marks, reports
- [09-exams.md](./09-exams.md) — Exams, attempts, grading
- [10-assignments.md](./10-assignments.md) — Assignments, submissions
- [11-grades.md](./11-grades.md) — Grade entries, release
- [12-homeroom.md](./12-homeroom.md) — Homeroom teacher assignments
- [13-report-cards.md](./13-report-cards.md) — Report cards, transcripts
- [14-announcements.md](./14-announcements.md) — School announcements
- [15-notifications.md](./15-notifications.md) — In-app notifications
- [16-chat.md](./16-chat.md) — Conversations, messages, WebSocket
- [17-files.md](./17-files.md) — File upload and access
- [18-calendar.md](./18-calendar.md) — Calendar events
- [19-dashboard.md](./19-dashboard.md) — Role dashboards
- [20-settings.md](./20-settings.md) — User and school settings
- [21-gamification.md](./21-gamification.md) — Badges, leaderboards, missions

## Swagger UI
Live interactive docs: `https://trilink-backend-ms68.onrender.com/api-docs`
