# Announcements API

Base path: `/announcements`

---

## GET /announcements/for-me
Get announcements visible to the current user.

**Auth required:** Yes (any role)

**Behavior:**
- Admin/Teacher: sees all announcements
- Student: sees announcements targeted to `all`, their grade, their section, or their class offerings
- Parent: sees announcements with `parentVisible: true` for their linked child's classes

**Response 200:** Array of announcement objects.

---

## GET /announcements
List all announcements. **Admin, teacher only.**

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| academicYearId | UUID | Optional filter |

**Response 200:** Array of announcement objects.

---

## POST /announcements
Create an announcement.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "academicYearId": "uuid",
  "title": "School Holiday Notice",
  "body": "School will be closed on May 15th for the national holiday.",
  "audience": "all",
  "classOfferingId": null,
  "targetGrade": null,
  "targetSection": null,
  "publishAt": "2026-05-10T08:00:00.000Z"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| academicYearId | UUID | ✅ | |
| title | string | ✅ | |
| body | string | ✅ | |
| audience | string | ✅ | See audience values below |
| classOfferingId | UUID | ❌ | Required when audience is `class` |
| targetGrade | string | ❌ | e.g. `"Grade 9"` — for grade-specific announcements |
| targetSection | string | ❌ | e.g. `"A"` — for section-specific announcements |
| publishAt | ISO string | ❌ | If set, hidden from students/parents until this time |

**Audience values:**
| Value | Who sees it |
|-------|-------------|
| `all` | Everyone |
| `students` | All students |
| `teachers` | All teachers |
| `parents` | All parents |
| `class` | Students/parents of a specific class offering |
| `grade` | Students/parents of a specific grade |

**Response 201:** Created announcement object.

---

## PATCH /announcements/:id
Update an announcement.

**Auth required:** Yes (admin, teacher)

**Access rules:**
- Admin: any announcement
- Teacher: own announcements only

**Request body (all optional):**
```json
{
  "title": "Updated Title",
  "body": "Updated body text.",
  "audience": "students",
  "classOfferingId": null,
  "targetGrade": "Grade 9",
  "targetSection": null,
  "publishAt": null
}
```

**Response 200:** Updated announcement object.

---

## DELETE /announcements/:id
Delete an announcement.

**Auth required:** Yes (admin, teacher)

**Access rules:**
- Admin: any announcement
- Teacher: own announcements only

**Response 200:** `{ "ok": true }`

---

## Announcement Object Shape
```json
{
  "id": "uuid",
  "academicYearId": "uuid",
  "authorId": "uuid",
  "title": "School Holiday Notice",
  "body": "School will be closed on May 15th for the national holiday.",
  "audience": "all",
  "classOfferingId": null,
  "targetGrade": null,
  "targetSection": null,
  "publishAt": null,
  "createdAt": "2026-05-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z"
}
```
