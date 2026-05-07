# Notifications API

Base path: `/notifications`

In-app notifications. Sent automatically by the system for grade releases, attendance, badges, etc.

---

## GET /notifications
Get the authenticated user's notifications.

**Auth required:** Yes (any role)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| unreadOnly | boolean | Pass `true` to get only unread notifications |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "type": "grade_released",
    "title": "Grade published",
    "body": "Your result for \"Assignment 1\" is available (88 / 100).",
    "payloadJson": "{\"gradeEntryId\":\"uuid\",\"title\":\"Assignment 1\",\"score\":88,\"maxScore\":100}",
    "isRead": false,
    "createdAt": "2026-04-20T10:00:00.000Z"
  }
]
```

---

## POST /notifications/broadcast
Broadcast a notification to a class or all students.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "title": "Exam Reminder",
  "body": "Biology midterm is tomorrow at 9 AM.",
  "audience": "class",
  "classOfferingId": "uuid"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✅ | |
| body | string | ✅ | |
| audience | string | ✅ | `class` or `all_students` |
| classOfferingId | UUID | When `audience = class` | Teacher must own this class |

**Behavior:**
- `class`: Teacher must own the class. Sends to all enrolled students.
- `all_students`: Admin only. Sends to all students in the system.

**Response 201:** `{ "sent": 25 }`

---

## PATCH /notifications/:id/read
Mark a notification as read.

**Auth required:** Yes (any role)

**Response 200:** Updated notification object.

---

## PATCH /notifications/:id/unread
Mark a notification as unread.

**Auth required:** Yes (any role)

**Response 200:** Updated notification object.

---

## POST /notifications/read-all
Mark all of the authenticated user's notifications as read.

**Auth required:** Yes (any role)

**Response 201:** `{ "updated": 12 }`

---

## Notification Object Shape
```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "grade_released",
  "title": "Grade published",
  "body": "Your result for \"Assignment 1\" is available (88 / 100).",
  "payloadJson": "{\"gradeEntryId\":\"uuid\"}",
  "isRead": false,
  "createdAt": "2026-04-20T10:00:00.000Z"
}
```

## Notification Type Values
| Type | Trigger |
|------|---------|
| `grade_released` | Teacher releases a grade entry |
| `assignment_published` | Teacher publishes an assignment |
| `assignment_graded` | Teacher grades a submission |
| `attendance` | Attendance mark recorded (sent to parents) |
| `badge` | Student earns a gamification badge |
| `announcement` | New announcement posted |
| `exam_result` | Exam result released |
