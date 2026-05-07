# Files API

Base path: `/files`

---

## POST /files/upload
Upload a file (max 10 MB for general uploads; 50 MB for chat media via `/chat/upload`).

**Auth required:** Yes (any role)

**Content-Type:** `multipart/form-data`
**Field name:** `file`

**Response 201:**
```json
{
  "id": "uuid",
  "filename": "document.pdf",
  "mime": "application/pdf",
  "sizeBytes": 204800,
  "path": "https://res.cloudinary.com/...",
  "uploadedById": "uuid",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

**Use cases:**
- Upload profile images → pass `id` to `PATCH /users/me` as `profileImageFileId`
- Upload assignment attachments → pass `id` to `POST /assignments` as `attachmentFileId`
- Upload assignment submissions → pass `id` to `POST /assignments/:id/submit` as `fileId`
- Upload chat media → use `POST /chat/upload` instead (50 MB limit)

---

## GET /files/:id
Get file metadata.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "id": "uuid",
  "filename": "document.pdf",
  "mime": "application/pdf",
  "sizeBytes": 204800,
  "path": "https://res.cloudinary.com/...",
  "uploadedById": "uuid",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

---

## GET /files/:id/access
Get file access metadata and a signed URL for app viewer/cache.

**Auth required:** Yes (any role)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| expiresInSeconds | number | Optional — signed URL expiry |

**Response 200:**
```json
{
  "fileId": "uuid",
  "filename": "document.pdf",
  "mime": "application/pdf",
  "url": "https://res.cloudinary.com/...",
  "expiresAt": null
}
```

---

## GET /files/:id/download
Download or view a file — redirects to the Cloudinary URL.

**Auth required:** No (public)

**Response:** HTTP 302 redirect to the file URL.

---

## GET /files/:id/url
Get the direct file URL.

**Auth required:** No (public)

**Response 200:**
```json
{
  "url": "https://res.cloudinary.com/...",
  "filename": "document.pdf",
  "mime": "application/pdf"
}
```

---

## File Object Shape
```json
{
  "id": "uuid",
  "filename": "document.pdf",
  "mime": "application/pdf",
  "sizeBytes": 204800,
  "path": "https://res.cloudinary.com/trilink/...",
  "uploadedById": "uuid",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

## Common MIME Types
| Type | MIME |
|------|------|
| PDF | `application/pdf` |
| JPEG | `image/jpeg` |
| PNG | `image/png` |
| MP4 | `video/mp4` |
| MP3 | `audio/mpeg` |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

## Displaying Images
Use `path` directly as the `src` for `<img>` tags — it's a Cloudinary URL.

```jsx
<img src={file.path} alt={file.filename} />
```

For profile images, use `profileImagePath` from the user object (resolved by the server).
