# TriLink Chat — Complete Frontend Reference

> This document covers every REST endpoint, every WebSocket event, every payload shape, every error, and every business rule for the chat system. Read this before writing any chat code.

---

## Table of Contents

1. [Connection & Authentication](#1-connection--authentication)
2. [REST — Conversations](#2-rest--conversations)
3. [REST — Messages](#3-rest--messages)
4. [REST — Members](#4-rest--members)
5. [REST — Blocking](#5-rest--blocking)
6. [REST — Presence](#6-rest--presence)
7. [REST — Media Upload](#7-rest--media-upload)
8. [REST — User Search](#8-rest--user-search)
9. [REST — Connections](#9-rest--connections)
10. [REST — Parent Access](#10-rest--parent-access)
11. [REST — Read Receipts](#11-rest--read-receipts)
12. [WebSocket — All Events](#12-websocket--all-events)
13. [Data Shapes](#13-data-shapes)
14. [Access Control Rules](#14-access-control-rules)
15. [Error Reference](#15-error-reference)
16. [Integration Cookbook](#16-integration-cookbook)

---

## 1. Connection & Authentication

### Socket.IO Connection

**URL:** `wss://trilink-backend-ms68.onrender.com`  
**Namespace:** `/` (root)  
**Transport:** WebSocket with polling fallback

```js
import { io } from 'socket.io-client';

const socket = io('https://trilink-backend-ms68.onrender.com', {
  auth: {
    token: accessToken,   // JWT access token from POST /auth/login
    userId: currentUserId // optional hint, server uses JWT sub
  },
  query: {
    token: accessToken    // fallback if auth.token not supported by client
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

### What happens on connect

1. Server verifies the JWT (`auth.token` or `query.token`)
2. If invalid or missing → socket is immediately disconnected
3. If valid:
   - `client.data.userId` is set from JWT `sub` claim
   - Socket joins personal room `user:{userId}`
   - Socket auto-joins all conversation rooms the user is a member of: `conversation:{conversationId}`
   - User's `isOnline` is set to `true` in the database
   - `presence:update` is emitted to all conversation rooms the user is in

### What happens on disconnect

1. User's `isOnline` is set to `false`, `lastSeenAt` is updated
2. `presence:update` is emitted to all conversation rooms

### Token requirements

- Must be an **access token** (not refresh token) — JWT payload must have `type: "access"`
- Must have a valid `sub` (user UUID)
- Expired tokens are rejected

---

## 2. REST — Conversations

Base path: `/api`  
All endpoints require `Authorization: Bearer <accessToken>` header.

---

### POST /api/conversations
Create a new conversation (group or direct).

**Roles:** admin, teacher, student, parent

**Request body:**
```json
{
  "type": "group",
  "title": "Grade 9A Biology Group",
  "description": "Discussion for Biology class",
  "classOfferingId": "uuid-or-null",
  "parentVisible": true,
  "memberIds": ["uuid1", "uuid2", "uuid3"]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | ✅ | `"direct"` or `"group"` |
| title | string | ✅ | Min 1 char |
| description | string | ❌ | |
| classOfferingId | UUID | ❌ | Link to a class offering |
| parentVisible | boolean | ❌ | Default `true` — parents can see this conversation |
| memberIds | UUID[] | ✅ | Creator is automatically added as `admin` role; others as `member` |

**Response 201:** `EnrichedConversation` object (see [Data Shapes](#13-data-shapes))

**Notes:**
- Creator is always added as conversation admin regardless of `memberIds`
- For direct chats, prefer `POST /api/conversations/initiate` instead

---

### POST /api/conversations/initiate
Get or create a direct (1-on-1) conversation with another user.

**Roles:** admin, teacher, student, parent

**Request body:**
```json
{ "targetUserId": "uuid" }
```

**Response 201:**
```json
{
  "conversation": { ...EnrichedConversation },
  "isNew": true
}
```

| Field | Type | Notes |
|-------|------|-------|
| conversation | EnrichedConversation | The conversation object |
| isNew | boolean | `true` if just created, `false` if existing was returned |

**Access control:** Checks `canUserMessageUser` rules (see [Access Control Rules](#14-access-control-rules))

**Errors:**
- `403` — Not allowed to message this user (e.g. student trying to message a teacher who doesn't teach them)

---

### GET /api/conversations
List all conversations the authenticated user is a member of.

**Roles:** admin, teacher, student, parent

**Response 200:** Array of `EnrichedConversation` objects, ordered by `lastMessageAt DESC`, then `updatedAt DESC`

**Special behavior for parents:**
- Also includes conversations their linked children are members of (if `parentVisible: true`)

**Direct chat title:** For `type: "direct"`, the `title` is set to `"Alice & Bob"` (both first names). The frontend should display the **other person's name** by looking at `participants` array and finding the user that is not the current user.

---

### GET /api/conversations/all
List all conversations in the system. **Admin only.**

**Query params:**
| Param | Type | Default | Max |
|-------|------|---------|-----|
| take | number | 50 | 200 |
| skip | number | 0 | — |

**Response 200:** Array of raw `Conversation` objects (not enriched).

---

### GET /api/conversations/:id
Get a single conversation.

**Roles:** admin, teacher, student, parent

**Response 200:** `EnrichedConversation` object

**Errors:**
- `403` — Not a member (and not a parent of a member)
- `404` — Conversation not found

---

### PATCH /api/conversations/:id
Update conversation metadata.

**Roles:** admin, teacher, student, parent (must be conversation admin)

**Request body (all optional):**
```json
{
  "title": "New Title",
  "description": "Updated description",
  "avatarFileId": "uuid"
}
```

**Response 200:** Updated `EnrichedConversation`

**Side effects:** Emits `conversation:update` to all members via WebSocket (per-user payload)

**Errors:**
- `403` — Not a conversation admin

---

## 3. REST — Messages

---

### POST /api/conversations/:id/messages
Send a message to a conversation.

**Roles:** admin, teacher, student, parent (must be a member)

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
| text | string | ❌ | Required if no `mediaFileId`. Min 1 char. |
| replyToId | UUID | ❌ | UUID of message being replied to. Must be in same conversation. |
| mediaFileId | UUID | ❌ | UUID from `POST /api/chat/upload`. Required if no `text`. |

**Response 201:** `EnrichedMessage` object (see [Data Shapes](#13-data-shapes))

**Side effects:**
1. Updates `conversation.lastMessageText`, `lastMessageAt`, `lastMessageSenderId`
2. Emits `message:new` to all members of the conversation room via WebSocket
3. Emits `conversation:update` per-user to all members via WebSocket

**WebSocket event emitted:**
```json
{
  "conversationId": "uuid",
  "message": {
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
    "reactions": {},
    "editedAt": null,
    "deletedAt": null,
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
}
```

**Block check for DMs:** If the recipient has blocked the sender, returns `403`.

**Errors:**
- `400` — Message must have text or media
- `400` — Invalid replyToId (not in this conversation)
- `400` — Invalid mediaFileId (not uploaded by sender)
- `403` — Not a member
- `403` — You have been blocked by this user (DM only)
- `404` — Conversation not found

---

### GET /api/conversations/:id/messages
List messages in a conversation.

**Roles:** admin, teacher, student, parent (must have read access)

**Query params:**
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| limit | number | 50 | Max 100 |
| before | UUID | — | Cursor for pagination — get messages before this message UUID |

**Response 200:**
```json
{
  "messages": [ ...EnrichedMessage[] ],
  "hasMore": true
}
```

**Sort order:** Oldest first (ascending by `createdAt`). The DB query fetches newest-first then reverses.

**Pagination:** To load older messages, pass the `id` of the **oldest message currently displayed** as `before`. This returns the next page of older messages, also sorted oldest-first.

**Auto-read:** When messages are fetched, the server automatically marks the latest message (not sent by the viewer) as read via `upsertReadRecord`.

**Parent access:** Parents can read conversations their linked children are in (if `parentVisible: true`).

**Errors:**
- `400` — Invalid before cursor
- `403` — Not a member / not a parent of a member

---

### PATCH /api/conversations/:id/messages/:msgId
Edit a message.

**Roles:** admin, teacher, student, parent (sender only)

**Request body:**
```json
{ "text": "Updated message text" }
```

**Response 200:** Updated `EnrichedMessage`

**Side effects:** Emits `message:update` to conversation room via WebSocket

**Errors:**
- `403` — Not the sender
- `400` — Cannot edit a deleted message
- `404` — Message not found

---

### DELETE /api/conversations/:id/messages/:msgId
Soft-delete a message.

**Roles:** admin, teacher, student, parent

**Who can delete:**
- The message sender
- A conversation admin (member with `role: "admin"`)
- A system admin (user with `role: "admin"`)

**Response 200:** Updated `EnrichedMessage` with `deletedAt` set

**What happens to deleted messages:**
- `text` → `null`
- `mediaFileId`, `mediaType`, `mediaName`, `mediaMimeType`, `mediaSize` → all `null`
- `deletedAt` → timestamp
- Message still exists in DB (soft delete)

**Side effects:** Emits `message:update` to conversation room via WebSocket

**Errors:**
- `403` — Not authorized to delete
- `404` — Message not found

---

### POST /api/conversations/:id/messages/:msgId/reactions
Toggle an emoji reaction on a message.

**Roles:** admin, teacher, student, parent (must be a member)

**Request body:**
```json
{ "emoji": "👍" }
```

**Behavior:**
- If the user already reacted with this emoji → removes the reaction
- If not → adds the reaction
- If removing leaves the emoji with 0 users → removes the emoji key entirely

**Response 201:** Updated `EnrichedMessage` with new `reactions` map

**Side effects:** Emits `message:update` to conversation room via WebSocket

**Errors:**
- `400` — Cannot react to a deleted message
- `403` — Not a member
- `404` — Message not found

---

### POST /api/conversations/:id/messages/:msgId/read
Mark a message as read (REST version).

**Roles:** admin, teacher, student, parent

**Response 201:** `{ "ok": true }`

**Side effects:**
- Updates `ConversationRead` record for this user
- Emits `read:update` to all **other** members via `emitToUser` (not back to the reader)

**Note:** The WebSocket `read:update` event is the preferred way to mark messages as read. This REST endpoint is a fallback.

---

## 4. REST — Members

---

### GET /api/conversations/:id/members
List all members of a conversation.

**Roles:** admin, teacher, student, parent (must be a member)

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
  },
  {
    "userId": "uuid",
    "role": "member",
    "user": {
      "id": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "role": "student",
      "profileImageFileId": null
    }
  }
]
```

**Member roles:** `"admin"` or `"member"`

---

### POST /api/conversations/:id/members
Add members to a conversation.

**Roles:** admin, teacher, student, parent (must be conversation admin)

**Request body:**
```json
{ "userIds": ["uuid1", "uuid2"] }
```

**Response 201:** `{ "ok": true }`

**Behavior:** Silently skips users already in the conversation.

**Errors:**
- `403` — Not a conversation admin

---

### DELETE /api/conversations/:id/members/:userId
Remove a member from a conversation.

**Roles:** admin, teacher, student, parent

**Who can remove:**
- Conversation admin can remove anyone
- Members can only remove themselves (leave)

**Response 200:** `{ "ok": true }`

**Side effects:** Emits `conversation:update` to all remaining members via WebSocket

**Errors:**
- `403` — Not a member / not authorized to remove others

---

## 5. REST — Blocking

---

### GET /api/users/blocked
List users blocked by the authenticated user.

**Response 200:** Array of `PublicUser` objects

---

### POST /api/users/:userId/block
Block a user.

**Response 201:** `{ "ok": true }`

**Errors:**
- `400` — Cannot block yourself

---

### DELETE /api/users/:userId/block
Unblock a user.

**Response 200:** `{ "ok": true }`

---

### GET /api/blocked-users
Legacy alias for `GET /api/users/blocked`.

### POST /api/blocked-users
Legacy block. Body: `{ "blockedId": "uuid" }`

### DELETE /api/blocked-users/:id
Legacy unblock by block record ID.

---

## 6. REST — Presence

---

### GET /api/users/presence
Get online status for a list of users.

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| userIds | string | ✅ | Comma-separated UUIDs, max 100 |

**Example:** `GET /api/users/presence?userIds=uuid1,uuid2,uuid3`

**Response 200:**
```json
{
  "uuid1": {
    "isOnline": true,
    "lastSeenAt": "2026-05-07T10:00:00.000Z"
  },
  "uuid2": {
    "isOnline": false,
    "lastSeenAt": "2026-05-06T18:30:00.000Z"
  }
}
```

**Note:** `isOnline` is updated in real-time via WebSocket connect/disconnect. For live presence, use the `presence:update` WebSocket event instead of polling this endpoint.

---

## 7. REST — Media Upload

---

### POST /api/chat/upload
Upload a file for use in chat messages. Max 50 MB.

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

| Field | Type | Notes |
|-------|------|-------|
| fileId | UUID | Pass this as `mediaFileId` in `POST /api/conversations/:id/messages` |
| url | string | Direct Cloudinary URL |
| mimeType | string | e.g. `"image/jpeg"` |
| size | number | Bytes |
| name | string | Original filename |
| mediaType | string | `"image"`, `"video"`, `"audio"`, or `"file"` |

**Media type detection:**
| MIME prefix | mediaType |
|-------------|-----------|
| `image/` | `image` |
| `video/` | `video` |
| `audio/` | `audio` |
| anything else | `file` |

**Errors:**
- `413` — File exceeds 50 MB

**Workflow:**
```
1. POST /api/chat/upload → get fileId
2. POST /api/conversations/:id/messages with { mediaFileId: fileId }
```

---

## 8. REST — User Search

---

### GET /api/users/search
Search users to initiate a chat with.

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| q | string | Search by firstName, lastName, subject |

**Response 200:** Array of user objects (max 20), ordered by role then firstName

**Role-based filtering:**
| Viewer role | Can see |
|-------------|---------|
| student | Teachers + students in same grade |
| parent | Teachers + admins only |
| teacher | Everyone |
| admin | Everyone |

**Response shape:**
```json
[
  {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "teacher",
    "subject": "Mathematics",
    "grade": null,
    "section": null,
    "profileImageFileId": null,
    "childName": null
  }
]
```

---

## 9. REST — Connections

Connections allow students to message each other. Students must be connected before they can DM each other.

---

### POST /api/connections/request
Send a connection request.

**Body:** `{ "recipientId": "uuid" }` (passed as body field, not JSON body)

**Response 201:** Connection record `{ id, requesterId, recipientId, status: "pending" }`

**Errors:**
- `403` — Connection already exists

---

### PUT /api/connections/:id/accept
Accept a connection request.

**Response 200:** Updated connection record with `status: "accepted"`

**Errors:**
- `403` — Not the recipient of this request

---

### PUT /api/connections/:id/reject
Reject a connection request.

**Response 200:** Updated connection record with `status: "rejected"`

---

### GET /api/connections
Get my connections and pending requests.

**Response 200:**
```json
{
  "sent": [
    { "id": "uuid", "requesterId": "uuid", "recipientId": "uuid", "status": "pending" }
  ],
  "received": [
    { "id": "uuid", "requesterId": "uuid", "recipientId": "uuid", "status": "accepted" }
  ]
}
```

---

## 10. REST — Parent Access

---

### GET /api/chat/children/:studentId/conversations
List a linked child's conversations. **Parent only.**

**Response 200:** Array of raw `Conversation` objects (not enriched)

**Errors:**
- `403` — Not linked to this student

---

### GET /api/chat/children/:studentId/conversations/:convId/messages
Read messages in a child's conversation. **Parent only.**

**Query params:**
| Param | Type | Default |
|-------|------|---------|
| limit | number | 50 |
| skip | number | 0 |

**Response 200:**
```json
{
  "conversationId": "uuid",
  "messages": [ ...raw ChatMessage[] ]
}
```

**Note:** Returns raw messages (not enriched), ordered newest-first.

**Errors:**
- `403` — Not linked to this student
- `403` — Child is not a member of this conversation

---

## 11. REST — Read Receipts

---

### GET /api/messages/:id/read-receipts
Get read receipts for a specific message.

**Response 200:**
```json
[
  {
    "messageId": "uuid",
    "userId": "uuid",
    "readAt": "2026-05-07T10:05:00.000Z",
    "lastReadMessageId": "uuid",
    "isSender": true,
    "user": {
      "id": "uuid",
      "firstName": "Ali",
      "lastName": "Hassan",
      "role": "student",
      "profileImageFileId": null
    }
  }
]
```

| Field | Type | Notes |
|-------|------|-------|
| isSender | boolean | `true` if this is the message sender (always "read") |
| readAt | ISO string | When the user read up to this message |
| lastReadMessageId | UUID | The last message this user has read |

**Logic:**
- Sender always appears with `isSender: true` and `readAt = message.createdAt`
- Other members appear only if their `lastReadAt >= message.createdAt`

---

## 12. WebSocket — All Events

### Connection URL
```
wss://trilink-backend-ms68.onrender.com
```

### Room naming
- Personal room: `user:{userId}` — joined automatically on connect
- Conversation room: `conversation:{conversationId}` — joined automatically for all conversations the user is in, and manually via `conversation:join`

---

## CLIENT → SERVER EVENTS

### `auth:hello`
Confirm connection and get conversation IDs.

**Emit:**
```json
{
  "token": "optional-jwt",
  "userId": "optional-uuid",
  "name": "optional-display-name"
}
```

**Server responds with `auth:hello` back to sender:**
```json
{
  "userId": "uuid",
  "conversationIds": ["uuid1", "uuid2", "uuid3"]
}
```

**When to use:** After connecting, emit this to confirm the connection is authenticated and get the list of conversation IDs the user is in.

---

### `conversation:join`
Join a conversation room to receive real-time messages.

**Emit:**
```json
{
  "conversationId": "uuid",
  "userId": "uuid"
}
```

**Server behavior:**
1. Verifies the authenticated user is a member of the conversation
2. Adds the socket to room `conversation:{conversationId}`
3. No response event

**When to use:** When the user opens a conversation. Also call this for any conversation not already joined (e.g. a new conversation created after the socket connected).

**Note:** On connect, the server auto-joins all existing conversations. Use this for new conversations created after connection.

---

### `conversation:leave`
Leave a conversation room.

**Emit:**
```json
{
  "conversationId": "uuid",
  "userId": "uuid"
}
```

**Server behavior:** Removes socket from room `conversation:{conversationId}`

**When to use:** When the user closes a conversation or is removed from it.

---

### `typing:update`
Broadcast typing status to other members.

**Emit:**
```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "isTyping": true
}
```

**Server behavior:**
1. Verifies the user is a member
2. Broadcasts to room **excluding sender** (`client.to()`)

**Server emits `typing:update` to room (excluding sender):**
```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "isTyping": true
}
```

**When to use:**
- Emit `isTyping: true` when user starts typing
- Emit `isTyping: false` when user stops typing (debounce ~2 seconds after last keystroke)
- Emit `isTyping: false` when message is sent

---

### `read:update`
Mark a message as read and notify others.

**Emit:**
```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "messageId": "uuid"
}
```

**Server behavior:**
1. Calls `upsertReadRecord(userId, conversationId, messageId)` — saves to DB
2. Broadcasts to room **excluding sender** (`client.to()`)

**Server emits `read:update` to room (excluding sender):**
```json
{
  "userId": "uuid",
  "conversationId": "uuid",
  "lastReadMessageId": "uuid"
}
```

**When to use:** When the user views a message (conversation is open and message is visible). Emit with the ID of the latest visible message.

---

### `presence:set`
Manually set online/offline status.

**Emit:**
```json
{
  "userId": "uuid",
  "status": "online",
  "name": "optional"
}
```

**Server behavior:**
1. Sets `isOnline` in DB based on `status !== "offline"`
2. Broadcasts `presence:update` to all conversation rooms

**Server emits `presence:update` to all conversation rooms:**
```json
{
  "userId": "uuid",
  "isOnline": true,
  "lastSeenAt": "2026-05-07T10:00:00.000Z"
}
```

**When to use:** When the app goes to background/foreground, or user explicitly sets status.

---

### `ping`
Keepalive ping.

**Emit:**
```json
{ "ts": 1715079600000 }
```

**Server responds with `pong` to sender:**
```json
{
  "ts": 1715079600001,
  "clientTs": 1715079600000
}
```

---

## SERVER → CLIENT EVENTS

### `message:new`
A new message was sent to a conversation.

**Emitted to:** All members of `conversation:{conversationId}` (including sender)

**Payload:**
```json
{
  "conversationId": "uuid",
  "message": {
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
    "reactions": {},
    "editedAt": null,
    "deletedAt": null,
    "createdAt": "2026-05-07T10:00:00.000Z"
  }
}
```

**Triggered by:** `POST /api/conversations/:id/messages`

---

### `message:update`
A message was edited, deleted, or had a reaction toggled.

**Emitted to:** All members of `conversation:{conversationId}`

**Payload:** Same shape as `message:new.message` (full `EnrichedMessage`)

**Triggered by:**
- `PATCH /api/conversations/:id/messages/:msgId` (edit)
- `DELETE /api/conversations/:id/messages/:msgId` (soft delete)
- `POST /api/conversations/:id/messages/:msgId/reactions` (reaction toggle)

**Note:** For deleted messages, `text` and all media fields will be `null`, and `deletedAt` will be set.

---

### `conversation:update`
Conversation metadata changed, or a new message was sent (to refresh the conversation list).

**Emitted to:** Each member's personal room `user:{userId}` (per-user payload with correct unread count)

**Payload:** Full `EnrichedConversation` object (see [Data Shapes](#13-data-shapes))

**Triggered by:**
- `POST /api/conversations/:id/messages` (new message)
- `PATCH /api/conversations/:id` (metadata update)
- `DELETE /api/conversations/:id/members/:userId` (member removed)

**Why per-user:** Each user gets their own `unreadCount` in the payload.

---

### `typing:update`
Someone in the conversation is typing (or stopped).

**Emitted to:** All members of `conversation:{conversationId}` **except the sender**

**Payload:**
```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "isTyping": true
}
```

---

### `read:update`
A member read up to a specific message.

**Emitted to:** All members of `conversation:{conversationId}` **except the reader**

**Payload:**
```json
{
  "userId": "uuid",
  "conversationId": "uuid",
  "lastReadMessageId": "uuid"
}
```

**Use this to:** Show double-tick "seen" indicators on messages. If `lastReadMessageId` is the ID of a message you sent, that user has seen it.

---

### `presence:update`
A user's online status changed.

**Emitted to:** All conversation rooms the user is in

**Payload:**
```json
{
  "userId": "uuid",
  "isOnline": true,
  "lastSeenAt": "2026-05-07T10:00:00.000Z"
}
```

**Triggered by:**
- User connects to WebSocket
- User disconnects from WebSocket
- User emits `presence:set`

---

### `auth:hello` (server → client)
Response to client's `auth:hello` event.

**Emitted to:** Sender only

**Payload:**
```json
{
  "userId": "uuid",
  "conversationIds": ["uuid1", "uuid2"]
}
```

---

### `pong`
Response to client's `ping` event.

**Emitted to:** Sender only

**Payload:**
```json
{
  "ts": 1715079600001,
  "clientTs": 1715079600000
}
```

---

## 13. Data Shapes

### EnrichedMessage
Returned by all message endpoints and emitted in `message:new` and `message:update`.

```typescript
{
  id: string;                    // UUID
  conversationId: string;        // UUID
  senderId: string;              // UUID — use this to identify who sent the message
  senderName: string;            // "Ali Hassan" — full name
  senderAvatarFileId: string | null; // UUID of profile image file, or null
  text: string | null;           // null if deleted or media-only
  replyToId: string | null;      // UUID of replied-to message, or null
  replyTo: ReplyPreview | null;  // Preview of replied-to message, or null
  mediaFileId: string | null;    // UUID of uploaded file, or null
  mediaType: string | null;      // "image" | "video" | "audio" | "file" | null
  mediaName: string | null;      // Original filename, or null
  mediaMimeType: string | null;  // e.g. "image/jpeg", or null
  mediaSize: number | null;      // Bytes, or null
  reactions: Record<string, string[]>; // { "👍": ["userId1", "userId2"] }
  editedAt: string | null;       // ISO timestamp if edited, else null
  deletedAt: string | null;      // ISO timestamp if deleted, else null
  createdAt: string;             // ISO timestamp
}
```

### ReplyPreview
Nested inside `EnrichedMessage.replyTo`.

```typescript
{
  id: string;          // UUID of the replied-to message
  senderId: string;    // UUID of the replied-to message's sender
  senderName: string;  // Full name of the sender
  text: string | null; // Text of the replied-to message (null if deleted)
}
```

### EnrichedConversation
Returned by conversation endpoints and emitted in `conversation:update`.

```typescript
{
  id: string;
  type: "direct" | "group";
  title: string;                        // For direct: "Alice & Bob". Use participants to get other person's name.
  description: string | null;
  avatarFileId: string | null;
  lastMessageText: string | null;       // Preview of last message (max 500 chars)
  lastMessageAt: string | null;         // ISO timestamp
  lastMessageSenderId: string | null;   // UUID
  lastMessageSenderName: string | null; // Full name
  unreadCount: number;                  // Messages not sent by viewer since last read
  memberCount: number;                  // Total members
  members: MemberWithUser[];            // First 5 members with user info
  participants: PublicUser[];           // Only for "direct" type — both users
  createdById: string;                  // UUID of creator
  classOfferingId: string | null;       // UUID if linked to a class
  parentVisible: boolean;               // Whether parents can see this conversation
  createdAt: string;                    // ISO timestamp
  updatedAt: string;                    // ISO timestamp
}
```

**For direct chats:** Use `participants` to find the other user:
```js
const otherUser = conversation.participants.find(p => p.id !== currentUserId);
const displayName = `${otherUser.firstName} ${otherUser.lastName}`;
```

### MemberWithUser
```typescript
{
  userId: string;
  role: "admin" | "member";
  user: PublicUser;
}
```

### PublicUser
```typescript
{
  id: string;
  firstName: string;
  lastName: string;
  role: "admin" | "teacher" | "student" | "parent";
  profileImageFileId: string | null;
}
```

### Conversation (raw, not enriched)
Returned by admin-only endpoints.

```typescript
{
  id: string;
  type: "direct" | "group";
  title: string;
  description: string | null;
  avatarFileId: string | null;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  lastMessageSenderId: string | null;
  createdById: string;
  classOfferingId: string | null;
  parentVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### MediaGallery
Returned by `GET /api/conversations/:id/media`.

```typescript
{
  images: EnrichedMessage[];  // Messages with mediaType = "image"
  videos: EnrichedMessage[];  // Messages with mediaType = "video"
  audio: EnrichedMessage[];   // Messages with mediaType = "audio"
  files: EnrichedMessage[];   // Messages with mediaType = "file"
}
```

### MessageReadReceipt
Returned by `GET /api/messages/:id/read-receipts`.

```typescript
{
  messageId: string;
  userId: string;
  readAt: string;                // ISO timestamp
  lastReadMessageId: string | null;
  isSender: boolean;
  user: PublicUser;
}
```

---

## 14. Access Control Rules

### Who can message whom (`POST /api/conversations/initiate`)

| From | To | Allowed? | Condition |
|------|----|----------|-----------|
| admin | anyone | ✅ | Always |
| teacher | anyone | ✅ | Always |
| student | teacher | ✅ | Teacher must teach at least one of student's classes |
| student | student | ✅ | Must have an accepted connection |
| student | admin | ❌ | Not allowed |
| student | parent | ❌ | Not allowed |
| parent | teacher | ✅ | Always |
| parent | admin | ✅ | Always |
| parent | student | ❌ | Not allowed |
| parent | parent | ❌ | Not allowed |

**Block check:** If either user has blocked the other, messaging is denied regardless of role.

### Who can read a conversation

- Any member of the conversation
- Parents can read conversations their linked children are in (if `parentVisible: true`)
- Admins can read any conversation

### Who can send messages

- Must be a member of the conversation
- For DMs: recipient must not have blocked the sender

### Who can delete messages

- The message sender
- Conversation admins (members with `role: "admin"`)
- System admins (users with `role: "admin"`)

### Who can edit messages

- The message sender only

### Who can add/remove members

- Conversation admins can add anyone and remove anyone
- Regular members can only remove themselves (leave)

---

## 15. Error Reference

| HTTP Status | When |
|-------------|------|
| 400 | Message has no text and no mediaFileId |
| 400 | Invalid replyToId (not in this conversation) |
| 400 | Invalid mediaFileId (not uploaded by sender, or not found) |
| 400 | Invalid before cursor (message not found or wrong conversation) |
| 400 | Cannot block yourself |
| 400 | Cannot edit a deleted message |
| 400 | Cannot react to a deleted message |
| 403 | Not a member of the conversation |
| 403 | Not a conversation admin (for admin-only actions) |
| 403 | You have been blocked by this user (DM send) |
| 403 | Not authorized to delete this message |
| 403 | Only the sender can edit this message |
| 403 | Not linked to this student (parent endpoints) |
| 403 | Child is not a member of this conversation |
| 403 | Cannot message this user (access control) |
| 404 | Conversation not found |
| 404 | Message not found |
| 413 | File exceeds 50 MB (chat upload) |

---

## 16. Integration Cookbook

### Setting up the socket connection

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function connectChat(accessToken: string, userId: string) {
  socket = io('https://trilink-backend-ms68.onrender.com', {
    auth: { token: accessToken, userId },
    query: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected:', socket.id);
    socket.emit('auth:hello', {});
  });

  socket.on('connect_error', (err) => {
    console.error('Connection failed:', err.message);
    // If 'invalid token' — refresh token and reconnect
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  return socket;
}
```

### Listening for new messages

```typescript
socket.on('message:new', (data: { conversationId: string; message: EnrichedMessage }) => {
  const { conversationId, message } = data;
  // Add message to your local state for this conversation
  addMessageToConversation(conversationId, message);
});
```

### Listening for message edits and deletes

```typescript
socket.on('message:update', (message: EnrichedMessage) => {
  if (message.deletedAt) {
    // Message was deleted — update UI to show "This message was deleted"
    markMessageDeleted(message.conversationId, message.id);
  } else if (message.editedAt) {
    // Message was edited — update text
    updateMessageText(message.conversationId, message.id, message.text);
  } else {
    // Reaction changed
    updateMessageReactions(message.conversationId, message.id, message.reactions);
  }
});
```

### Joining a conversation room

```typescript
function openConversation(conversationId: string) {
  socket.emit('conversation:join', { conversationId, userId: currentUserId });
}

function closeConversation(conversationId: string) {
  socket.emit('conversation:leave', { conversationId, userId: currentUserId });
}
```

### Typing indicators

```typescript
let typingTimeout: NodeJS.Timeout | null = null;

function onUserTyping(conversationId: string) {
  socket.emit('typing:update', { conversationId, userId: currentUserId, isTyping: true });

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing:update', { conversationId, userId: currentUserId, isTyping: false });
  }, 2000);
}

function onMessageSent(conversationId: string) {
  if (typingTimeout) clearTimeout(typingTimeout);
  socket.emit('typing:update', { conversationId, userId: currentUserId, isTyping: false });
}

socket.on('typing:update', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
  if (data.userId === currentUserId) return; // shouldn't happen, but guard anyway
  showTypingIndicator(data.conversationId, data.userId, data.isTyping);
});
```

### Read receipts (seen ticks)

```typescript
// When user views messages in a conversation
function onMessagesViewed(conversationId: string, latestMessageId: string) {
  socket.emit('read:update', {
    conversationId,
    userId: currentUserId,
    messageId: latestMessageId,
  });
}

// Listen for others reading your messages
socket.on('read:update', (data: { userId: string; conversationId: string; lastReadMessageId: string }) => {
  // data.userId has read up to data.lastReadMessageId
  // If data.lastReadMessageId is a message you sent → show "seen" tick
  markMessageSeen(data.conversationId, data.lastReadMessageId, data.userId);
});
```

### Presence indicators

```typescript
// Track online status
const onlineUsers = new Map<string, boolean>();

socket.on('presence:update', (data: { userId: string; isOnline: boolean; lastSeenAt: string }) => {
  onlineUsers.set(data.userId, data.isOnline);
  updatePresenceUI(data.userId, data.isOnline, data.lastSeenAt);
});

// Get initial presence for a list of users
async function getPresence(userIds: string[]) {
  const res = await fetch(`/api/users/presence?userIds=${userIds.join(',')}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.json();
}
```

### Sending a text message

```typescript
async function sendTextMessage(conversationId: string, text: string, replyToId?: string) {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text, replyToId: replyToId ?? null }),
  });
  return res.json(); // EnrichedMessage
  // Note: message:new WebSocket event will also fire for all members
}
```

### Sending a media message

```typescript
async function sendMediaMessage(conversationId: string, file: File) {
  // Step 1: Upload the file
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch('/api/chat/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const { fileId } = await uploadRes.json();

  // Step 2: Send the message with the fileId
  const msgRes = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ mediaFileId: fileId }),
  });
  return msgRes.json(); // EnrichedMessage
}
```

### Loading message history with pagination

```typescript
async function loadMessages(conversationId: string, before?: string) {
  const url = `/api/conversations/${conversationId}/messages?limit=50${before ? `&before=${before}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const { messages, hasMore } = await res.json();
  // messages are sorted oldest-first
  // To load more: pass messages[0].id as `before` (oldest message in current view)
  return { messages, hasMore };
}
```

### Starting a direct chat

```typescript
async function startDirectChat(targetUserId: string) {
  const res = await fetch('/api/conversations/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ targetUserId }),
  });

  if (res.status === 403) {
    const err = await res.json();
    alert(err.message); // e.g. "Connection required to message other students"
    return null;
  }

  const { conversation, isNew } = await res.json();

  // Join the conversation room if new
  if (isNew) {
    socket.emit('conversation:join', { conversationId: conversation.id, userId: currentUserId });
  }

  return conversation;
}
```

### Refreshing conversation list

```typescript
socket.on('conversation:update', (conversation: EnrichedConversation) => {
  // Update the conversation in your list
  // This fires when: new message sent, metadata updated, member removed
  updateConversationInList(conversation);
});
```

---

## Quick Reference Table

### REST Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/conversations | all | Create conversation |
| POST | /api/conversations/initiate | all | Get or create DM |
| GET | /api/conversations | all | List my conversations |
| GET | /api/conversations/all | admin | List all conversations |
| GET | /api/conversations/:id | all | Get one conversation |
| PATCH | /api/conversations/:id | conv admin | Update conversation |
| POST | /api/conversations/:id/messages | member | Send message |
| GET | /api/conversations/:id/messages | member | List messages (oldest-first) |
| PATCH | /api/conversations/:id/messages/:msgId | sender | Edit message |
| DELETE | /api/conversations/:id/messages/:msgId | sender/admin | Delete message |
| POST | /api/conversations/:id/messages/:msgId/reactions | member | Toggle reaction |
| POST | /api/conversations/:id/messages/:msgId/read | member | Mark as read |
| GET | /api/conversations/:id/members | member | List members |
| POST | /api/conversations/:id/members | conv admin | Add members |
| DELETE | /api/conversations/:id/members/:userId | conv admin/self | Remove member |
| GET | /api/conversations/:id/media | member | Media gallery |
| GET | /api/users/blocked | all | List blocked users |
| POST | /api/users/:userId/block | all | Block user |
| DELETE | /api/users/:userId/block | all | Unblock user |
| GET | /api/users/presence | all | Get presence |
| GET | /api/users/search | all | Search users |
| POST | /api/chat/upload | all | Upload media (50MB) |
| POST | /api/connections/request | all | Request connection |
| PUT | /api/connections/:id/accept | all | Accept connection |
| PUT | /api/connections/:id/reject | all | Reject connection |
| GET | /api/connections | all | My connections |
| GET | /api/messages/:id/read-receipts | member | Read receipts |
| GET | /api/chat/children/:studentId/conversations | parent | Child conversations |
| GET | /api/chat/children/:studentId/conversations/:convId/messages | parent | Child messages |

### WebSocket Events

| Direction | Event | Payload |
|-----------|-------|---------|
| C→S | `auth:hello` | `{ token?, userId?, name? }` |
| C→S | `conversation:join` | `{ conversationId, userId }` |
| C→S | `conversation:leave` | `{ conversationId, userId }` |
| C→S | `typing:update` | `{ conversationId, userId, isTyping }` |
| C→S | `read:update` | `{ conversationId, userId, messageId }` |
| C→S | `presence:set` | `{ userId, status, name? }` |
| C→S | `ping` | `{ ts }` |
| S→C | `auth:hello` | `{ userId, conversationIds[] }` |
| S→C | `message:new` | `{ conversationId, message: EnrichedMessage }` |
| S→C | `message:update` | `EnrichedMessage` |
| S→C | `conversation:update` | `EnrichedConversation` |
| S→C | `typing:update` | `{ conversationId, userId, isTyping }` |
| S→C | `read:update` | `{ userId, conversationId, lastReadMessageId }` |
| S→C | `presence:update` | `{ userId, isOnline, lastSeenAt }` |
| S→C | `pong` | `{ ts, clientTs }` |
