# Chat API

No base path prefix — routes are at root level under `/api`.

All chat endpoints require JWT. All roles (admin, teacher, student, parent) can access chat.

---

## CONVERSATIONS

### POST /conversations
Create a new conversation.

**Request body:**
```json
{
  "type": "group",
  "title": "Grade 9A Biology Group",
  "description": "Discussion for Biology class",
  "classOfferingId": "uuid",
  "parentVisible": true,
  "memberIds": ["uuid1", "uuid2", "uuid3"]
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | ✅ | `direct` or `group` |
| title | string | ✅ | |
| description | string | ❌ | |
| classOfferingId | UUID | ❌ | Link to a class |
| parentVisible | boolean | ❌ | Default `true` — parents can see this conversation |
| memberIds | UUID[] | ✅ | Creator is automatically added as admin |

**Response 201:** Enriched conversation object.

---

### POST /conversations/initiate
Initiate or retrieve a direct (1-on-1) conversation.

**Request body:**
```json
{ "targetUserId": "uuid" }
```

**Behavior:** If a direct conversation already exists between the two users, returns it. Otherwise creates a new one.

**Response 201:**
```json
{
  "conversation": { ...enriched conversation object... },
  "isNew": true
}
```

---

### GET /conversations
List all conversations for the authenticated user.

**Behavior:**
- Returns conversations the user is a member of
- Parents also see conversations their linked children are in (if `parentVisible: true`)
- Ordered by `lastMessageAt` descending

**Response 200:** Array of enriched conversation objects.

---

### GET /conversations/all
List all conversations in the system. **Admin only.**

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| take | number | Default 50, max 200 |
| skip | number | Default 0 |

**Response 200:** Array of conversation objects.

---

### GET /conversations/:id
Get a single conversation.

**Response 200:** Enriched conversation object.

---

### PATCH /conversations/:id
Update a conversation's title, description, or avatar.

**Request body (all optional):**
```json
{
  "title": "New Title",
  "description": "Updated description",
  "avatarFileId": "uuid"
}
```

**Response 200:** Updated enriched conversation object.

---

## MESSAGES

### GET /conversations/:id/messages
List messages in a conversation (cursor-paginated, newest first).

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| before | UUID | Cursor — get messages before this message UUID |
| limit | number | Default 50, max 100 |

**Response 200:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "senderId": "uuid",
      "senderName": "Ali Hassan",
      "senderAvatarFileId": null,
      "text": "Hello everyone!",
      "replyToId": null,
      "replyTo": null,
      "mediaFileId": null,
      "mediaType": null,
      "mediaName": null,
      "mediaMimeType": null,
      "mediaSize": null,
      "reactions": { "👍": ["uuid1", "uuid2"] },
      "editedAt": null,
      "deletedAt": null,
      "createdAt": "2026-05-07T10:00:00.000Z"
    }
  ],
  "hasMore": true
}
```

**Pagination:** To load older messages, pass the `id` of the oldest message as `before`.

---

### POST /conversations/:id/messages
Send a message.

**Request body:**
```json
{
  "text": "Hello everyone!",
  "replyToId": null,
  "mediaFileId": null
}
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| text | string | ❌ | Required if no `mediaFileId` |
| replyToId | UUID | ❌ | Reply to a specific message |
| mediaFileId | UUID | ❌ | Upload via `POST /chat/upload` first |

**Response 201:** Enriched message object.

**Side effects:** Emits `message:new` WebSocket event to all conversation members.

---

### PATCH /conversations/:id/messages/:msgId
Edit a message. **Sender only.**

**Request body:**
```json
{ "text": "Updated message text" }
```

**Response 200:** Updated enriched message object.

---

### DELETE /conversations/:id/messages/:msgId
Soft-delete a message. Sender or conversation admin.

**Response 200:** Updated message object with `deletedAt` set. Text and media are hidden.

---

### POST /conversations/:id/messages/:msgId/reactions
Toggle an emoji reaction on a message.

**Request body:**
```json
{ "emoji": "👍" }
```

**Behavior:** If the user already reacted with this emoji, removes the reaction. Otherwise adds it.

**Response 201:** Updated message object with new reactions.

---

### POST /conversations/:id/messages/:msgId/read
Mark a message as read.

**Response 201:** `{ "ok": true }`

**Side effects:** Emits `read:update` WebSocket event.

---

## MEMBERS

### GET /conversations/:id/members
List conversation members.

**Response 200:**
```json
[
  {
    "userId": "uuid",
    "role": "admin",
    "user": {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "teacher",
      "profileImageFileId": null
    }
  }
]
```

---

### POST /conversations/:id/members
Add members to a conversation. Conversation admin only.

**Request body:**
```json
{ "userIds": ["uuid1", "uuid2"] }
```

**Response 201:** `{ "ok": true }`

---

### DELETE /conversations/:id/members/:userId
Remove a member. Conversation admin can remove anyone; members can only remove themselves.

**Response 200:** `{ "ok": true }`

---

## MEDIA

### GET /conversations/:id/media
Get media gallery for a conversation, grouped by type.

**Response 200:**
```json
{
  "images": [...enriched messages with mediaType = "image"],
  "videos": [...enriched messages with mediaType = "video"],
  "audio": [...enriched messages with mediaType = "audio"],
  "files": [...enriched messages with mediaType = "file"]
}
```

---

### POST /chat/upload
Upload a media file for chat (max 50 MB).

**Content-Type:** `multipart/form-data`
**Field name:** `file`

**Response 201:**
```json
{
  "fileId": "uuid",
  "url": "https://res.cloudinary.com/...",
  "mimeType": "image/jpeg",
  "size": 204800,
  "name": "photo.jpg",
  "mediaType": "image"
}
```

**Media type detection:**
| MIME prefix | mediaType |
|-------------|-----------|
| `image/` | `image` |
| `video/` | `video` |
| `audio/` | `audio` |
| anything else | `file` |

---

## PRESENCE

### GET /users/presence
Get online presence for a list of users.

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| userIds | string | ✅ | Comma-separated UUIDs, max 100 |

**Response 200:**
```json
{
  "uuid1": { "isOnline": true, "lastSeenAt": "2026-05-07T10:00:00.000Z" },
  "uuid2": { "isOnline": false, "lastSeenAt": "2026-05-06T18:30:00.000Z" }
}
```

---

## BLOCKING

### GET /users/blocked
List users blocked by the authenticated user.

**Response 200:** Array of public user objects.

### POST /users/:userId/block
Block a user.

**Response 201:** `{ "ok": true }`

### DELETE /users/:userId/block
Unblock a user.

**Response 200:** `{ "ok": true }`

---

## CONNECTIONS

### POST /connections/request
Send a connection request to another user.

**Request body:** `{ "recipientId": "uuid" }` (passed as body param)

### PUT /connections/:id/accept
Accept a connection request.

### PUT /connections/:id/reject
Reject a connection request.

### GET /connections
Get my connections and pending requests.

---

## PARENT ACCESS

### GET /chat/children/:studentId/conversations
Parent: list a linked child's conversations.

**Auth required:** Yes (parent)

### GET /chat/children/:studentId/conversations/:convId/messages
Parent: read messages in a child's conversation.

**Query params:** `limit` (default 50), `skip` (default 0)

---

## READ RECEIPTS

### GET /messages/:id/read-receipts
Get read receipts for a message.

**Response 200:** Array of `{ messageId, userId, readAt }` objects.

---

## USER SEARCH

### GET /users/search
Search users to initiate a chat.

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| q | string | Search by name, email, subject, grade, section |

**Response 200:** Array of user objects (max 20).

---

## WebSocket (Socket.IO)

**Connection URL:** `wss://trilink-backend-ms68.onrender.com`

**Authentication:** Pass JWT in handshake:
```js
const socket = io('wss://trilink-backend-ms68.onrender.com', {
  auth: { token: accessToken }
});
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `auth:hello` | `{}` | Confirm connection, get conversation IDs |
| `typing:update` | `{ conversationId, isTyping }` | Broadcast typing status |
| `read:update` | `{ conversationId, messageId }` | Mark message as read |
| `conversation:join` | `{ conversationId }` | Join a conversation room |
| `conversation:leave` | `{ conversationId }` | Leave a conversation room |
| `presence:set` | `{ status: "online"\|"offline" }` | Set presence status |
| `ping` | `{ ts: number }` | Keepalive |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | Enriched message object | New message or edit/delete |
| `conversation:update` | Enriched conversation object | Conversation metadata changed |
| `typing:update` | `{ conversationId, userId, isTyping }` | Someone is typing |
| `read:update` | `{ userId, conversationId, lastReadMessageId }` | Message read |
| `presence:update` | `{ userId, isOnline, lastSeenAt }` | User online status changed |
| `auth:hello` | `{ userId, conversationIds[] }` | Connection confirmed |
| `pong` | `{ ts, clientTs }` | Ping response |

### Enriched Conversation Object Shape
```json
{
  "id": "uuid",
  "type": "group",
  "title": "Grade 9A Biology",
  "description": null,
  "avatarFileId": null,
  "lastMessageText": "Hello everyone!",
  "lastMessageAt": "2026-05-07T10:00:00.000Z",
  "lastMessageSenderId": "uuid",
  "lastMessageSenderName": "Ali Hassan",
  "unreadCount": 3,
  "memberCount": 25,
  "members": [
    {
      "userId": "uuid",
      "role": "admin",
      "user": { "id": "uuid", "firstName": "Jane", "lastName": "Doe", "role": "teacher", "profileImageFileId": null }
    }
  ],
  "participants": [],
  "createdById": "uuid",
  "classOfferingId": "uuid",
  "parentVisible": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-07T10:00:00.000Z"
}
```

> **Note:** `participants` is only populated for `direct` conversations (contains both users). `members` contains the first 5 members for group conversations.
