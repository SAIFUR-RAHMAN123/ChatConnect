# ChatConnect

A real-time chat application built with the MERN stack and Socket.IO: one-to-one and group chats, file sharing, reactions, dark mode, and password reset by email.

**Live demo:** https://chatconnect-rust.vercel.app
(The backend runs on Render's free plan and sleeps when idle, so the first request can take about 50 seconds.)

## Features

**Core**
- Register / login with JWT authentication (bcrypt-hashed passwords)
- Search users by name or email; one-to-one chats with no duplicates and no self-chat
- Real-time messaging over Socket.IO, persisted in MongoDB
- Cursor-based pagination ("Load earlier messages")
- Online/offline presence and last seen
- Typing indicator (works in groups: "Carol is typing...")
- Message status: sent → delivered → read (in groups, read once everyone has read)
- Unread counts; conversations sorted by latest activity
- Responsive UI (desktop, tablet, mobile) with loading, empty and error states and auto-reconnect

**Added later**
- Edit and delete messages (delete for everyone, "(edited)" label)
- Group chats: create, rename, add/remove members, leave
- Image and file sharing (max 5 MB, type allowlist, content check, participants-only download)
- Emoji picker and message reactions
- Dark mode (remembered, no flash on load)
- Forgot / reset password by email (link valid 15 minutes, single use, old sessions logged out after reset)

**Security**
- Authorization enforced on the server for every REST route and socket event
- Rate limiting on login, register and reset routes
- Reset tokens stored hashed (SHA-256); generic response so emails cannot be enumerated
- Uploaded files are never public; they are served only to conversation participants

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Axios, Socket.IO Client |
| Backend | Node.js, Express 5, Mongoose, Socket.IO, jsonwebtoken, bcryptjs, multer |
| Email | Gmail API over HTTPS (OAuth2 refresh token) |
| Database | MongoDB Atlas |
| Hosting | Vercel (client), Render (server) |

## Architecture

```text
React (Vite) ──REST (Axios, Bearer JWT)──► Express ──► Mongoose ──► MongoDB
      │                                       │
      └────── Socket.IO (JWT in handshake) ───┘
```

- REST handles auth, users, conversations, uploads and history. Socket.IO handles live delivery.
- Each socket joins a private room `user:<id>`, so multiple tabs stay in sync and events reach participants only.
- Send / edit / delete / react / read logic lives in `server/utils/chatService.js`, shared by REST and sockets, so validation and authorization cannot diverge.
- Presence is derived from live socket rooms and written serially per user.

## Folder Structure

```text
chatconnect/
├── client/
│   ├── src/
│   │   ├── components/   Sidebar, ConversationList, ChatWindow, ChatHeader, MessageList,
│   │   │                 MessageBubble, MessageInput, Attachment, EmojiPicker, Lightbox,
│   │   │                 NewGroupModal, GroupInfoModal, ThemeToggle, ...
│   │   ├── pages/        Login, Register, ForgotPassword, ResetPassword, Chat
│   │   ├── context/      AuthContext.jsx
│   │   ├── services/     api.js, socket.js, files.js
│   │   ├── hooks/        useUserSearch.js
│   │   ├── routes/       ProtectedRoute.jsx
│   │   └── utils/        format.js, emoji.js
│   ├── .env.example
│   └── vercel.json
├── server/
│   ├── config/db.js
│   ├── models/           User, Conversation, Message
│   ├── controllers/      auth, user, conversation, message
│   ├── routes/
│   ├── middleware/       authMiddleware, errorMiddleware, rateLimit
│   ├── socket/           socketHandler.js
│   ├── utils/            chatService, uploads, mailer, generateToken, httpError
│   ├── test/e2e.js
│   ├── server.js
│   └── .env.example
└── README.md
```

## Environment Variables

**server/.env** (copy from `server/.env.example`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Provided by the host in production (default 5000) |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Long random string |
| `CLIENT_URL` | yes | Frontend URL, no trailing slash. Comma-separate several origins; the first is used in reset links |
| `GMAIL_CLIENT_ID` | for email | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | for email | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | for email | OAuth refresh token (scope `gmail.send`) |
| `GMAIL_USER` | for email | The Gmail address that sends the emails |
| `UPLOAD_DIR` | no | Upload folder (default `server/uploads`) |
| `SHOW_RESET_LINK` | no | `true` shows the reset link on the page. Local testing only |

If the `GMAIL_*` variables are empty, the reset link is printed in the server console instead of emailed (handy in development).

**client/.env** (copy from `client/.env.example`)

```text
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Never commit `.env` files.

## Installation

Requires Node.js 18+ and a MongoDB database (local or Atlas).

```bat
cd server
npm install
copy .env.example .env

cd ..\client
npm install
copy .env.example .env
```

Set `MONGODB_URI` and `JWT_SECRET` in `server\.env`. (macOS/Linux: use `cp` instead of `copy`.)

## Running Locally

```bat
cd server
npm run dev
```
```bat
cd client
npm run dev
```

Open http://localhost:5173. Use two browsers (or a normal and a private window) with two accounts to chat.

## API Overview

All routes except register, login and the reset routes need `Authorization: Bearer <token>`. Responses are `{ success, ... }`; errors are `{ success: false, message }`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in, returns `{ user, token }` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/forgot-password` | Email a reset link `{ email }` |
| POST | `/api/auth/reset-password/:token` | Set a new password |
| GET | `/api/users`, `/api/users/search?q=`, `/api/users/:id` | List, search, profile |
| GET | `/api/conversations` | My conversations with last message and unread count |
| POST | `/api/conversations` | Start or reuse a one-to-one chat `{ participantId }` |
| POST | `/api/conversations/group` | Create a group |
| GET | `/api/conversations/:id` | One conversation (members only) |
| PATCH | `/api/conversations/:id` | Rename a group |
| POST | `/api/conversations/:id/members` | Add members |
| DELETE | `/api/conversations/:id/members/:userId` | Remove a member / leave |
| GET | `/api/messages/:conversationId?limit=&before=<messageId>` | History, chronological, with `hasMore` |
| POST | `/api/messages` | Send `{ conversationId, content }` |
| POST | `/api/messages/upload` | Send a file (multipart: `file`, `conversationId`, `caption?`) |
| GET | `/api/messages/:id/file` | Download an attachment (members only) |
| PATCH | `/api/messages/:id` | Edit own message |
| DELETE | `/api/messages/:id` | Delete own message for everyone |
| PUT | `/api/messages/:id/reactions` | Toggle a reaction `{ emoji }` |
| PATCH | `/api/messages/:id/read` | Mark a message as read |
| GET | `/health` | Health check |

Status codes: 200, 201, 400, 401, 403, 404, 409, 429 (rate limit), 500.

## Socket.IO Events

Connect with `io(SOCKET_URL, { auth: { token } })`. Invalid, expired, or pre-password-reset tokens are rejected.

| Direction | Event | Payload |
|---|---|---|
| client → server | `message:send` | `{ conversationId, content, tempId }`, ack `{ success, message, tempId }` |
| client → server | `message:read` | `{ conversationId }`, ack |
| client → server | `typing:start` / `typing:stop` | `{ conversationId }` |
| server → client | `message:receive`, `message:edited`, `message:deleted`, `message:reaction` | updated message data |
| server → client | `message:read`, `message:delivered` | receipt data |
| server → client | `typing:start` / `typing:stop` | `{ conversationId, userId, name }` |
| server → client | `user:online` / `user:offline` | `{ userId }` / `{ userId, lastSeen }` |
| server → client | `conversation:updated`, `conversation:removed` | group created/renamed/members changed; you were removed from a group |

## Testing

`server/test/e2e.js` runs 145 checks over REST and Socket.IO (auth, authorization, groups, uploads, edit/delete, reactions, receipts, presence, password reset, pagination).

It **drops the database at the end**, so it refuses to run unless the database name contains `test`:

```bat
cd server
set MONGODB_URI=mongodb://localhost:27017/chatconnect_test
set JWT_SECRET=test_secret
npm test
```

## Deployment

**1. MongoDB Atlas**: create a cluster and a database user, allow your backend host under Network Access (or `0.0.0.0/0`), and copy the connection string.

**2. Backend on Render**: Web Service from the `server` folder. Build `npm install`, start `npm start`. Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` and the four `GMAIL_*` variables.

**3. Frontend on Vercel**: root directory `client` (Vite preset). Set `VITE_API_URL=https://<backend-host>/api` and `VITE_SOCKET_URL=https://<backend-host>`. `client/vercel.json` rewrites all routes to `index.html`.

**4.** Set `CLIENT_URL` on the backend to the final Vercel URL.

### Gmail API setup (password-reset emails)

Render's free plan blocks outbound SMTP ports (25/465/587), so Gmail SMTP times out there. The app uses the Gmail API over HTTPS instead.

1. Google Cloud Console: create a project and enable the **Gmail API**.
2. OAuth consent screen: add scope `https://www.googleapis.com/auth/gmail.send` and set the app to **In production** (in "Testing" the refresh token expires after 7 days).
3. Create an OAuth client (Web application) with redirect URI `https://developers.google.com/oauthplayground`.
4. In the [OAuth Playground](https://developers.google.com/oauthplayground), use your own credentials, authorize the `gmail.send` scope, and exchange the code for a refresh token.
5. Put the client ID, client secret, refresh token and your Gmail address into the four `GMAIL_*` variables on Render.

Gmail's free limit is roughly 500 emails per day.

## Known Limitations

- Uploads are stored on the server disk. On Render's free plan they are deleted on redeploy or restart; use Cloudinary or S3 for permanent storage.
- Members added to a group later can see older messages.
- Free-tier cold start: the first request after idle takes about 50 seconds.

## Future Improvements

- Cloud storage for uploads (Cloudinary / S3)
- Refresh tokens / httpOnly cookie sessions
- Push notifications
- Redis adapter for horizontal Socket.IO scaling
- Profile avatar upload