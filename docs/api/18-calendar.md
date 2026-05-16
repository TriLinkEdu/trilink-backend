# Calendar API

Base path: `/calendar-events`

---

## GET /calendar-events
List calendar events.

**Auth required:** Yes (any role)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| from | string | YYYY-MM-DD — filter events from this date |
| to | string | YYYY-MM-DD — filter events to this date |
| academicYearId | UUID | Filter by academic year |
| classOfferingId | UUID | Filter by class offering |

**Behavior:**
- Admin/Teacher: sees all events
- Student/Parent: sees school-wide events + events for their enrolled class offerings

**Response 200:** Array of calendar event objects.

---

## GET /calendar-events/:id
Get a single calendar event.

**Auth required:** Yes (any role)

**Response 200:** Single calendar event object.

---

## POST /calendar-events
Create a calendar event.

**Auth required:** Yes (admin, teacher)

**Request body:**
```json
{
  "academicYearId": "uuid",
  "title": "Biology Lab Session",
  "date": "2026-05-15",
  "time": "09:00",
  "type": "class",
  "description": "Practical lab session for Chapter 5",
  "classOfferingId": "uuid"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| academicYearId | UUID | ✅ | |
| title | string | ✅ | |
| date | string | ✅ | YYYY-MM-DD |
| time | string | ❌ | HH:MM |
| type | string | ✅ | See event types below |
| description | string | ❌ | |
| classOfferingId | UUID | ❌ | Link to a specific class |

**Event type values:**
| Type | Description |
|------|-------------|
| `class` | Regular class session |
| `exam` | Exam event |
| `holiday` | School holiday |
| `meeting` | Staff/parent meeting |
| `event` | General school event |
| `deadline` | Assignment/project deadline |

**Response 201:** Created event object.

---

## PATCH /calendar-events/:id
Update a calendar event.

**Auth required:** Yes (admin, teacher)

**Request body:** Same fields as POST, all optional.

**Response 200:** Updated event object.

---

## DELETE /calendar-events/:id
Delete a calendar event.

**Auth required:** Yes (any role)

**Access rules:**
- Admin: any event
- Teacher: own events only
- Student/Parent: own events only

**Response 200:** `{ "ok": true }`

---

## Calendar Event Object Shape
```json
{
  "id": "uuid",
  "academicYearId": "uuid",
  "createdById": "uuid",
  "title": "Biology Lab Session",
  "date": "2026-05-15",
  "time": "09:00",
  "type": "class",
  "description": "Practical lab session for Chapter 5",
  "classOfferingId": "uuid",
  "createdAt": "2026-05-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z"
}
```
