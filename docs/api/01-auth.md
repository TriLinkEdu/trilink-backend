# Auth API

Base path: `/auth`

---

## POST /auth/login
Login and get tokens.

**Auth required:** No

**Request body:**
```json
{
  "email": "admin@trilink.edu",
  "password": "Admin@123",
  "role": "admin"
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | ✅ | Must be valid email |
| password | string | ✅ | |
| role | string | ✅ | Must match the user's actual role: `admin`, `teacher`, `student`, `parent` |

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

**Errors:**
- `401` — Wrong email, password, or role mismatch
- `400` — Validation error (e.g. invalid email format)

---

## POST /auth/refresh
Exchange a refresh token for new tokens.

**Auth required:** No

**Request body:**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Response 200:** Same shape as login response.

**Errors:**
- `401` — Invalid or expired refresh token

---

## GET /auth/me
Get the currently authenticated user's profile.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "id": "uuid",
  "email": "teacher@school.edu",
  "role": "teacher",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+251911234567",
  "grade": null,
  "section": null,
  "subject": "Mathematics",
  "department": "Science",
  "homeroomClass": "Grade 9A",
  "experience": "5 years",
  "country": "Ethiopia",
  "cityState": "Addis Ababa",
  "postalCode": null,
  "officeRoom": "101",
  "childName": null,
  "relationship": null,
  "mustChangePassword": false,
  "profileImageFileId": null,
  "profileImagePath": null,
  "isOnline": false,
  "lastSeenAt": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-01T00:00:00.000Z"
}
```

---

## POST /auth/change-password
Change the authenticated user's password.

**Auth required:** Yes (any role)

**Request body:**
```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@456"
}
```

**Response 200:**
```json
{ "ok": true }
```

**Errors:**
- `401` — Wrong current password
- `400` — New password same as current, or validation error

**Note:** After a successful change, `mustChangePassword` is set to `false`.

---

## POST /auth/register
Register a new user. **Admin only.**

**Auth required:** Yes (admin)

**Request body:**
```json
{
  "email": "student@school.edu",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+251911234567",
  "type": "student",
  "grade": "Grade 9",
  "section": "A",
  "tempPassword": "Temp@1234"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | ✅ | Must be unique |
| firstName | string | ✅ | |
| lastName | string | ✅ | |
| phone | string | ❌ | |
| type | string | ✅ | `student`, `teacher`, `parent` |
| tempPassword | string | ❌ | If omitted, server generates one |
| grade | string | student only | e.g. `"Grade 9"` |
| section | string | student only | e.g. `"A"` |
| subject | string | teacher only | e.g. `"Mathematics"` |
| department | string | teacher only | e.g. `"Science"` |
| linkedStudentId | UUID | parent only | Links parent to student on creation |
| relationship | string | parent only | `"Father"`, `"Mother"`, `"Guardian"` |
| isPrimaryLink | boolean | parent only | Default `false` |
| childName | string | ❌ | Display only |

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
  "registrationEmailSent": true
}
```

**Errors:**
- `409` — Email already registered
- `403` — Caller is not admin
- `503` — SMTP configured but welcome email failed (registration rolled back)
