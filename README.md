# ChatConnect

A real-time one-to-one chat application built with the MERN stack and Socket.IO. Users register, find each other, and chat instantly with presence, typing indicators, delivery/read receipts, and unread counts.

## Features

- Register / login with JWT authentication (bcrypt-hashed passwords)
- Search registered users by name or email and start one-to-one conversations (no duplicates, no self-chat)
- Real-time messaging over Socket.IO with messages persisted in MongoDB
- Message history with cursor-based pagination ("Load earlier messages")
- Online/offline presence and "last seen"
- Typing indicator ("Alice is typing...")
- Message status: sent ✓ → delivered ✓✓ → read ✓✓ (blue)
- Unread counts per conversation; conversations sorted by latest activity
- Responsive UI: desktop split view, tablet, and mobile chat-app navigation with a back button
- Loading, empty, and error states; automatic reconnect with resync
- Centralized backend error handling; authorization enforced on the server for every REST route and socket event

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, Tailwind CSS v4, React Router, Axios, Socket.IO Client, Context API (auth only) |
| Backend | Node.js, Express, Mongoose, Socket.IO, jsonwebtoken, bcryptjs, dotenv, cors |
| Database | MongoDB (Atlas compatible) |

## Architecture Overview

```text
React (Vite) ──REST (Axios, Bearer JWT)──► Express ──► Mongoose ──► MongoDB
      │                                       │
      └────── Socket.IO (JWT in handshake) ───┘
```

- **REST** handles auth, user search, conversations, and message history. `POST /api/messages` and `PATCH /api/messages/:id/read` are also available over REST and emit the same real-time events.
- **Socket.IO** handles live delivery. Each authenticated socket joins a private room `user:<id>`, so multiple tabs of one user stay in sync and events are only sent to participants.
- Message sending/reading logic lives in one shared module (`server/utils/chatService.js`) used by both REST and sockets, so authorization and validation cannot diverge.
- A conversation is unique per user pair (`pairKey` unique index), which prevents duplicates even under race conditions.
- Presence is derived from live socket rooms and written serially per user, so fast reconnects cannot leave a stale status.

## Folder Structure

```text
chatconnect/
├── client/
│   ├── src/
│   │   ├── components/   Sidebar, UserSearch, ConversationList, ChatHeader, ChatWindow,
│   │   │                 MessageList, MessageBubble, MessageInput, TypingIndicator, Avatar, AuthLayout
│   │   ├── pages/        Login, Register, Chat
│   │   ├── context/      AuthContext.jsx
│   │   ├── services/     api.js, socket.js
│   │   ├── routes/       ProtectedRoute.jsx
│   │   ├── utils/        format.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── vercel.json
├── server/
│   ├── config/db.js
│   ├── models/           User, Conversation, Message
│   ├── controllers/      auth, user, conversation, message
│   ├── routes/
│   ├── middleware/       authMiddleware, errorMiddleware
│   ├── socket/           socketHandler.js
│   ├── utils/            generateToken, httpError, chatService
│   ├── test/e2e.js       REST + Socket.IO test suite
│   ├── server.js
│   └── .env.example
└── README.md
```

## Environment Variables

**server/.env** (copy from `server/.env.example`)

```text
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:5173
```

**client/.env** (copy from `client/.env.example`)

```text
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

`CLIENT_URL` may hold several comma-separated origins. Use a long random `JWT_SECRET` (for example `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Never commit `.env` files (they are git-ignored).

## Installation

Requires Node.js 18+ and a MongoDB database (local or Atlas).

Windows (cmd):

```bat
cd chatconnect\server
npm install
copy .env.example .env

cd ..\client
npm install
copy .env.example .env
```

macOS/Linux: use `cp` instead of `copy`.

Edit `server\.env` and set `MONGODB_URI` and `JWT_SECRET`.

## Running

Backend (terminal 1):

```bat
cd server
npm run dev
```

Frontend (terminal 2):

```bat
cd client
npm run dev
```

Open http://localhost:5173. To try it out, open two different browsers (or one normal and one private window), register two accounts, search for the other user, and chat.

## API Overview

All routes except register/login require `Authorization: Bearer <token>`. Responses are `{ success, ... }`; errors are `{ success: false, message }`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (name, email, password, confirmPassword) |
| POST | `/api/auth/login` | Log in, returns `{ user, token }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/users` | Other users |
| GET | `/api/users/search?q=` | Search by name/email |
| GET | `/api/users/:id` | User profile |
| GET | `/api/conversations` | My conversations (latest first, with last message and unread count) |
| POST | `/api/conversations` | Start or reuse a conversation `{ participantId }` (201 new / 200 existing) |
| GET | `/api/conversations/:id` | One conversation (participants only) |
| GET | `/api/messages/:conversationId?limit=&before=<messageId>` | History in chronological order; `hasMore` flag |
| POST | `/api/messages` | Send `{ conversationId, content }` |
| PATCH | `/api/messages/:id/read` | Mark a received message as read |
| GET | `/health` | Health check |

Status codes: 200, 201, 400 (validation / invalid ID), 401 (missing/invalid/expired token, bad credentials), 403 (not a participant / not allowed), 404, 409 (duplicate email), 500.

## Socket.IO Events

Connect with `io(SOCKET_URL, { auth: { token } })`. Invalid or expired tokens are rejected.

| Direction | Event | Payload |
|---|---|---|
| client → server | `message:send` | `{ conversationId, content, tempId }` with ack `{ success, message, tempId }` |
| server → client | `message:receive` | message object |
| client → server | `message:read` | `{ conversationId }` with ack |
| server → client | `message:read` | `{ conversationId, readerId, messageIds, readAt }` |
| server → client | `message:delivered` | `{ conversationId, recipientId }` (recipient connected after receiving offline) |
| client → server | `typing:start` / `typing:stop` | `{ conversationId }` |
| server → client | `typing:start` / `typing:stop` | `{ conversationId, userId, name }` |
| server → client | `user:online` | `{ userId }` |
| server → client | `user:offline` | `{ userId, lastSeen }` |

Status flow: a message is `sent` when stored, `delivered` immediately if the recipient has a connected socket (or when they next connect), and `read` when the recipient opens the conversation.

## Testing

`server/test/e2e.js` boots the real app and runs 66 checks over REST and Socket.IO: auth, validation, duplicate email, authorization (outsiders get 403 on REST and sockets), search, duplicate-conversation prevention, persistence, pagination, presence, typing, delivery and read receipts, unread counts.

It **drops the database when finished**, so it refuses to run unless the database name contains `test`. Point it at a throwaway database:

```bat
cd server
set MONGODB_URI=mongodb://localhost:27017/chatconnect_test
set JWT_SECRET=test_secret
npm test
```

(PowerShell: `$env:MONGODB_URI="..."; $env:JWT_SECRET="..."; npm test`.)

## Screenshots

_Add screenshots here (login, chat desktop, chat mobile)._

## Deployment

**MongoDB Atlas**
1. Create a cluster and a database user.
2. Under Network Access, allow your backend host (or `0.0.0.0/0` for testing).
3. Copy the connection string into `MONGODB_URI`.

**Backend (Render / Railway)**
1. Create a Web Service from the `server` directory. Build: `npm install`. Start: `npm start`.
2. Set `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL` (your frontend URL, no trailing slash). `PORT` is provided by the platform.
3. Socket.IO needs a long-running server, which both platforms provide.

**Frontend (Vercel)**
1. Import the repo and set the root directory to `client` (framework preset: Vite).
2. Set `VITE_API_URL` (`https://<backend-host>/api`) and `VITE_SOCKET_URL` (`https://<backend-host>`).
3. `client/vercel.json` already rewrites all routes to `index.html` for React Router.

After the frontend is deployed, update `CLIENT_URL` on the backend to match it.

## Future Improvements

- Group chats and file/image sharing
- Message edit/delete and reactions
- Refresh tokens / httpOnly cookie sessions and rate limiting on auth routes
- Push notifications
- Redis adapter for horizontal Socket.IO scaling
- Profile avatars upload
