# Settings API

No base path prefix — routes are at root level under `/api`.

Settings are stored as JSON blobs. Use them to persist UI preferences, theme, language, etc.

---

## GET /me/settings
Get the authenticated user's settings.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "settingsJson": "{\"theme\":\"dark\",\"language\":\"en\",\"notifications\":true}",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z"
}
```

Returns `{ settingsJson: "{}" }` if no settings exist yet.

---

## PATCH /me/settings
Update the authenticated user's settings.

**Auth required:** Yes (any role)

**Request body:**
```json
{ "settingsJson": "{\"theme\":\"dark\",\"language\":\"am\"}" }
```

**Response 200:** Updated settings object.

---

## GET /school/settings
Get school-wide settings.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "id": "uuid",
  "settingsJson": "{\"schoolName\":\"TriLink Academy\",\"logo\":\"uuid\",\"timezone\":\"Africa/Addis_Ababa\"}",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z"
}
```

---

## PATCH /school/settings
Update school-wide settings. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{ "settingsJson": "{\"schoolName\":\"TriLink Academy\",\"timezone\":\"Africa/Addis_Ababa\"}" }
```

**Response 200:** Updated school settings object.

---

## Suggested Settings Keys

### User settings
```json
{
  "theme": "dark",
  "language": "en",
  "notifications": true,
  "emailNotifications": false
}
```

### School settings
```json
{
  "schoolName": "TriLink Academy",
  "logoFileId": "uuid",
  "timezone": "Africa/Addis_Ababa",
  "gradingScale": "percentage",
  "attendanceStatuses": ["present", "absent", "late", "excused"]
}
```
