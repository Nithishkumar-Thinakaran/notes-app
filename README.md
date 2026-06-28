# NoteShare — Secure Expiring Notes

A full-stack MERN application for creating notes with secure, expiring share links. Supports one-time and time-based access, public and password-protected links, view counting, and atomic race-condition handling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, React Router v6, Tailwind CSS |
| Backend | Express.js, Node.js |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Security | express-rate-limit, bcrypt hashing, crypto.randomBytes |

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (free tier works)
- npm or yarn

### 1. Clone the repository

```bash
git clone <repo-url>
cd note-app
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/noteapp
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

Start backend:
```bash
npm run dev        # development (nodemon)
npm start          # production
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm start          # starts on http://localhost:3000
```

The frontend proxies `/api` requests to `http://localhost:5000` (configured in `package.json`).

### 4. Production build

```bash
cd frontend && npm run build
```

Serve the `build/` folder via Express or a static host.

---

## Database Schema

### User Collection

```js
{
  _id: ObjectId,
  username: String,       // unique, 3-30 chars
  email: String,          // unique, lowercase
  password: String,       // bcrypt hash, not returned by default
  createdAt: Date,
  updatedAt: Date
}
```

### Note Collection

Notes embed share tokens as a subdocument array. This collocates all share metadata with the note, enabling atomic updates.

```js
{
  _id: ObjectId,
  title: String,          // max 200 chars
  content: String,        // max 50,000 chars
  owner: ObjectId,        // ref: User

  shareTokens: [
    {
      token: String,          // 64-char hex (32 random bytes), indexed
      shareType: "one-time" | "time-based",
      accessType: "public" | "password-protected",
      passwordHash: String,   // bcrypt hash, null for public
      generatedPassword: String, // cleared from DB after first API response
      expiresAt: Date,
      isRevoked: Boolean,     // default false
      isUsed: Boolean,        // default false, only relevant for one-time
      viewCount: Number,      // default 0
      createdAt: Date
    }
  ],

  createdAt: Date,
  updatedAt: Date
}
```

**Index:** `shareTokens.token` is indexed for O(1) token lookups.

---

## Share Link Flow

```
User fills note form
        │
        ▼
POST /api/notes
  ├── Generates 64-char hex token (crypto.randomBytes(32))
  ├── If password-protected: generates XXXX-XXXX-XXXX access key
  ├── Hashes access key with bcrypt (cost 12)
  ├── Stores token + hash + settings in shareTokens[]
  └── Returns token + plain-text key (once only) to user

User shares URL: /share/<token>
        │
        ▼
GET /api/share/:token/meta
  └── Returns { accessType, shareType, expiresAt }
      (does not access note content, no view count change)

        │
        ▼
If public  ──────────────────────────────────▶ POST /api/share/:token/access
If password-protected → show password prompt → POST /api/share/:token/access
                                                  with { password }
```

---

## Password / Access Key Generation Logic

```
generateAccessKey():
  charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  (Excluded: O, 0, I, 1 — visually ambiguous characters)

  segment() = 4 random chars from charset
  key = segment() + "-" + segment() + "-" + segment()
  → e.g. "K7MN-3PQR-9XZT"

  Entropy: 34^12 ≈ 2.25 × 10^18 combinations
```

The plain-text key is returned **once** in the API response and then cleared from the database (`generatedPassword` set to `null`). Only the bcrypt hash is retained.

---

## Expiry Logic

Expiry is enforced at every access point:

```js
validateShareToken(shareToken):
  if (shareToken.isRevoked)            → { valid: false, reason: "revoked" }
  if (new Date() > shareToken.expiresAt) → { valid: false, reason: "expired" }
  if (one-time && shareToken.isUsed)   → { valid: false, reason: "already_used" }
  else                                 → { valid: true }
```

This check runs before any content is returned and before any view count increment.

- **Time-based:** The link is accessible from creation until `expiresAt`. After that, all access attempts return HTTP 410.
- **One-time:** The link is accessible only once within its `expiresAt` window. After the first successful access, `isUsed` is set to `true`.

---

## Invalidate / Revoke Logic

Owners can revoke any share link via:

```
DELETE /api/notes/:noteId/share/:token
```

This sets `shareTokens.$.isRevoked = true` using Mongoose. The token remains in the database for audit purposes but is rejected at the `validateShareToken` step. The note and other share links are unaffected.

---

## View Count Logic

| Event | Count changes? |
|---|---|
| Public link accessed successfully | ✅ +1 |
| Password-protected link, correct key | ✅ +1 |
| Password-protected link, wrong key | ❌ No change |
| Expired link access attempt | ❌ No change |
| Revoked link access attempt | ❌ No change |
| One-time link already used | ❌ No change |
| `/meta` endpoint (pre-check) | ❌ No change |

View count is incremented **after** all validation and authentication checks pass, using MongoDB's `$inc` operator for atomicity.

---

## Race Condition Handling

The critical race condition occurs when two requests arrive simultaneously for a one-time link. Both pass the initial `isUsed: false` check before either can write.

**Solution: Atomic conditional `findOneAndUpdate`**

```js
const result = await Note.findOneAndUpdate(
  {
    _id: note._id,
    'shareTokens.token': token,
    'shareTokens.isUsed': false,     // ← Only matches if NOT already used
    'shareTokens.isRevoked': false,
  },
  {
    $set: { 'shareTokens.$.isUsed': true },
    $inc: { 'shareTokens.$.viewCount': 1 }
  },
  { new: true }
);

if (!result) {
  // The query filter didn't match — another request already set isUsed = true
  return res.status(409).json({ error: 'already_used' });
}
```

MongoDB's document-level locking guarantees that only one write wins. The `isUsed: false` filter in the query acts as an optimistic lock — if another request has already changed `isUsed` to `true`, this query will find no matching document and `result` will be `null`, triggering a 409 response to the second request.

This is equivalent to a compare-and-swap (CAS) operation and avoids the need for application-level mutexes or Redis locks for this use case.

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, get JWT |
| GET | `/api/auth/me` | JWT | Get current user |

### Notes
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/notes` | JWT | List all user notes |
| POST | `/api/notes` | JWT | Create note + share link |
| GET | `/api/notes/:id` | JWT | Get note with share info |
| POST | `/api/notes/:id/share` | JWT | Add new share link to note |
| DELETE | `/api/notes/:id/share/:token` | JWT | Revoke a share link |
| DELETE | `/api/notes/:id` | JWT | Delete a note |

### Share (public)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/share/:token/meta` | — | Get link metadata (type, expiry) |
| POST | `/api/share/:token/access` | — | Access note content |

---

## Pages

| Route | Description |
|---|---|
| `/login` | Sign in page |
| `/register` | Create account page |
| `/notes/new` | Create a note and generate share link |
| `/notes/:id` | View note, manage share links, revoke |
| `/share/:token` | Public share view (password prompt if protected) |

---

## Security Notes

- Passwords and access keys are hashed with bcrypt (cost factor 12)
- Share tokens use `crypto.randomBytes(32)` — 256-bit entropy
- Generated access key plain text is cleared from DB immediately after creation
- Rate limiting: 100 req/15min globally, 20 req/5min on share endpoints
- JWT expiry: 7 days (configurable via `JWT_EXPIRE`)
- CORS restricted to `FRONTEND_URL` in production
