# Academic Years API

Base path: `/academic-years`

All endpoints require JWT. Most are admin-only. `GET /active` and `GET /current` are available to all authenticated users.

---

## GET /academic-years/active
Get the currently active academic year.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "label": "2025-2026",
    "startDate": "2025-09-01",
    "endDate": "2026-06-30",
    "isActive": true,
    "isArchived": false,
    "terms": [],
    "createdAt": "2025-08-01T00:00:00.000Z",
    "updatedAt": "2025-08-01T00:00:00.000Z"
  }
}
```
Returns `{ "data": null }` if no active year exists.

---

## GET /academic-years/current
Alias for `GET /academic-years/active`. Same response.

---

## GET /academic-years
List all academic years. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** Array of academic year objects (with terms).

---

## GET /academic-years/:id
Get a single academic year with its terms. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:**
```json
{
  "id": "uuid",
  "label": "2025-2026",
  "startDate": "2025-09-01",
  "endDate": "2026-06-30",
  "isActive": true,
  "isArchived": false,
  "terms": [
    {
      "id": "uuid",
      "academicYearId": "uuid",
      "name": "Term 1",
      "startDate": "2025-09-01",
      "endDate": "2025-12-15",
      "createdAt": "2025-08-01T00:00:00.000Z",
      "updatedAt": "2025-08-01T00:00:00.000Z"
    }
  ],
  "createdAt": "2025-08-01T00:00:00.000Z",
  "updatedAt": "2025-08-01T00:00:00.000Z"
}
```

---

## POST /academic-years
Create a new academic year. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "label": "2025-2026",
  "startDate": "2025-09-01",
  "endDate": "2026-06-30"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| label | string | ✅ | e.g. `"2025-2026"` |
| startDate | string | ✅ | YYYY-MM-DD |
| endDate | string | ✅ | YYYY-MM-DD |

**Response 201:** Created academic year object.

---

## PATCH /academic-years/:id
Update an academic year. **Admin only.**

**Auth required:** Yes (admin)

**Request body (all optional):**
```json
{
  "label": "2025-2026 Updated",
  "startDate": "2025-09-01",
  "endDate": "2026-06-30"
}
```

**Response 200:** Updated academic year object.

---

## POST /academic-years/:id/activate
Set this year as the only active year (deactivates all others). **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** Updated academic year object with `isActive: true`.

---

## POST /academic-years/:id/close
Archive and deactivate a year. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** Updated academic year object with `isActive: false, isArchived: true`.

---

## POST /academic-years/:id/rollover
Create a new active academic year and copy all class offerings from the source year. **Admin only.**

**Auth required:** Yes (admin)

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| newLabel | string | ✅ | e.g. `"2026/2027"` |
| dryRun | boolean | ❌ | If `true`, returns what would be created without saving |

**Response 200:**
```json
{
  "newYear": { "id": "uuid", "label": "2026/2027", ... },
  "copiedOfferings": 45,
  "dryRun": false
}
```

---

## DELETE /academic-years/:id
Delete an academic year. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** `{ "ok": true }`

---

## GET /academic-years/:yearId/terms
List all terms for an academic year. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** Array of term objects.

---

## POST /academic-years/:yearId/terms
Add a term to an academic year. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "name": "Term 1",
  "startDate": "2025-09-01",
  "endDate": "2025-12-15"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✅ | e.g. `"Term 1"`, `"Semester 2"` |
| startDate | string | ✅ | YYYY-MM-DD |
| endDate | string | ✅ | YYYY-MM-DD |

**Response 201:** Created term object.

---

## DELETE /academic-years/terms/:termId
Delete a term. **Admin only.**

**Auth required:** Yes (admin)

**Response 200:** `{ "ok": true }`

---

## Term Object Shape
```json
{
  "id": "uuid",
  "academicYearId": "uuid",
  "name": "Term 1",
  "startDate": "2025-09-01",
  "endDate": "2025-12-15",
  "createdAt": "2025-08-01T00:00:00.000Z",
  "updatedAt": "2025-08-01T00:00:00.000Z"
}
```

> **Important for frontend:** Terms are the primary filter for report cards, grades, and attendance. Always fetch the active academic year first, then its terms, to populate term selectors.
