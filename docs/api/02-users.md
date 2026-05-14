# Users API

Base path: `/users`

---

## GET /users
List all users (directory).

**Auth required:** Yes (admin, teacher)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| role | string | Filter by role: `admin`, `teacher`, `student`, `parent` |
| q | string | Search by name or email |

**Response 200:** Array of public user objects.

---

## GET /users/search
Search users (available to all roles, used for chat user search).

**Auth required:** Yes (any role)

**Query params:** Same as `GET /users` (role, q)

**Response 200:** Array of public user objects.

---

## GET /users/students
Filter students with advanced options. **Admin only.**

**Auth required:** Yes (admin)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| grade | string | e.g. `"Grade 9"` |
| section | string | e.g. `"A"` |
| academicYearId | UUID | Filter by enrollment in academic year |
| q | string | Search by name/email |

**Response 200:** Array of public student objects.

---

## GET /users/teachers
Filter teachers. **Admin only.**

**Auth required:** Yes (admin)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| subject | string | e.g. `"Mathematics"` |
| department | string | e.g. `"Science"` |
| q | string | Search by name/email |

**Response 200:** Array of public teacher objects.

---

## GET /users/parents
Filter parents. **Admin only.**

**Auth required:** Yes (admin)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| studentGrade | string | Filter by linked student's grade |
| studentSection | string | Filter by linked student's section |
| q | string | Search by name/email |

**Response 200:** Array of public parent objects.

---

## GET /users/:id
Get a single user by UUID.

**Auth required:** Yes (admin, teacher)

**Response 200:** Public user object.

**Errors:**
- `404` — User not found

---

## GET /users/:userId/profile
Get a user's profile for chat modal display (available to all roles).

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@school.edu",
  "role": "teacher",
  "grade": null,
  "section": null,
  "subject": "Mathematics",
  "department": "Science",
  "profileImageFileId": null
}
```

---

## PATCH /users/me
Update the authenticated user's own profile.

**Auth required:** Yes (any role)

**Request body (all fields optional):**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+251911234567",
  "grade": "Grade 9",
  "section": "A",
  "subject": "Mathematics",
  "department": "Science",
  "homeroomClass": "Grade 9A",
  "experience": "5 years",
  "country": "Ethiopia",
  "cityState": "Addis Ababa",
  "postalCode": "1000",
  "officeRoom": "101",
  "childName": "Ali Hassan",
  "relationship": "Father",
  "profileImageFileId": "uuid"
}
```

**Response 200:** Updated public user object with `profileImagePath` resolved.

---

## PATCH /users/:id
Update any user. **Admin only.**

**Auth required:** Yes (admin)

**Request body:** Same as `PATCH /users/me`

**Response 200:** Updated user object.

---

## Public User Object Shape
```json
{
  "id": "uuid",
  "email": "user@school.edu",
  "role": "student",
  "firstName": "Ali",
  "lastName": "Hassan",
  "phone": null,
  "grade": "Grade 9",
  "section": "A",
  "subject": null,
  "department": null,
  "homeroomClass": null,
  "experience": null,
  "country": null,
  "cityState": null,
  "postalCode": null,
  "officeRoom": null,
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

**Role-specific fields:**
- `student`: `grade`, `section` are populated
- `teacher`: `subject`, `department`, `homeroomClass`, `experience`, `country`, `cityState`, `postalCode`, `officeRoom` are populated
- `parent`: `childName`, `relationship` are populated
