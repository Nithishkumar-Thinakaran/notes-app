# Note-Taking App

A secure note-sharing application that allows users to create notes and share them using secure expiring share links.

Users can create notes with:

- Title
- Content
- Expiry date/time
- Share type
- Access type

Share links support:

- One-time access
- Time-based access
- Public access
- Password-protected access


# Setup Instructions

## Prerequisites

Make sure you have installed:

- Node.js
- MongoDB
- npm


## Clone Repository

```bash
git clone <https://github.com/Nithishkumar-Thinakaran/notes-app>

cd note-taking-app
```


## Backend Setup

Go to backend folder:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```


Create `.env` file:

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

FRONTEND_URL=http://localhost:3000
```


Start backend:

```bash
npm run dev
```


Backend runs on:

```
http://localhost:5000
```



## Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```


Start frontend:

```bash
npm run dev
```


Frontend runs on:

```
http://localhost:3000
```



# Tech Stack Used


## Frontend

- React.js
- Tailwind CSS
- Axios
- React Router


## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose


## Authentication

- JWT Authentication
- bcrypt password hashing


## Security

- Secure random share tokens
- Password hashing
- Expiry validation
- Atomic database updates



# Database Schema


## User Collection

```json
{
  "_id": ObjectId,
  "username": String,
  "email": String,
  "password": String,
  "createdAt": Date,
  "updatedAt": Date
}
```


Example:

```json
{
  "_id": "6a40b385fdc72758162bf424",
  "username": "kumar",
  "email": "user@gmail.com",
  "password": "hashed_password",
  "createdAt": "2026-06-28T05:39:17.114Z"
}
```



## Note Collection

```json
{
  "_id": ObjectId,

  "title": String,

  "content": String,

  "owner": ObjectId,

  "totalViews": Number,

  "shareTokens": [
    {
      "token": String,

      "shareType":
      "one-time | time-based",

      "accessType":
      "public | password-protected",

      "passwordHash": String,

      "expiresAt": Date,

      "isRevoked": Boolean,

      "isUsed": Boolean,

      "viewCount": Number,

      "createdAt": Date
    }
  ],

  "createdAt": Date,
  "updatedAt": Date
}
```


Example:

```json
{
"title":"message",

"content":"hiii hello",

"owner":"user_id",

"totalViews":11,

"shareTokens":[

{
"token":"secure_random_token",

"shareType":"time-based",

"accessType":"public",

"expiresAt":"2026-06-29T08:00:00Z",

"isRevoked":false,

"isUsed":false,

"viewCount":7
}

]
}
```



# Share Link Flow


1. User creates a note.


2. User selects:

- Expiry time
- Share type
- Access type


3. Backend creates a secure random token.


Example:

```
/share/1a7b9e6bdfecd5fac9c0465a92a74e09
```


4. Token is stored inside the note document.


5. When someone opens the share URL:

Backend validates:

- Token exists
- Token is not revoked
- Token is not expired
- One-time link is not already used


6. Access handling:

Public link:

```
Open directly
```


Password protected link:

```
Ask for access key
```


7. Successful access updates view count.



# Password / Key Generation Logic


For password protected links:


1. Backend generates a random access key.


Example:

```
ABCD-1234-XYZ
```


2. Password is encrypted using bcrypt.


3. Only hashed password is stored.


Example:

```
$2a$12$xxxxxxxxxxxx
```


4. During access:

User enters password.

Backend verifies:

```
Entered password
        |
        v
bcrypt compare()
        |
        v
Stored hash
```


Correct password:

```
Access granted
```


Wrong password:

```
Access denied
```

View count does not increase.



# Expiry Logic


## Time Based Link


Each share link stores:

```json
{
"expiresAt":"date"
}
```


During access:

Backend checks:

```
current time < expiry time
```


If valid:

```
Allow access
```


If expired:

```
Reject request
```


Expired links do not increase views.



## One Time Link


One-time links contain:

```json
{
"isUsed":false
}
```


First successful access:

```
isUsed = true
```


Further attempts:

```
Link already used
```


No additional views are counted.



# Invalidate / Revoke Logic


Owner can revoke a generated share link.


Database update:

```json
{
"isRevoked":true
}
```


During access:

Backend checks:

```
isRevoked === false
```


If revoked:

```
Access denied
```


The share link immediately stops working.



# View Count Logic


View count increases only after successful access.


## Public Link

Successful opening:

```
viewCount + 1
totalViews + 1
```



## Password Protected Link

Correct password:

```
viewCount + 1
totalViews + 1
```


Wrong password:

```
No update
```



## Expired Link

```
No update
```


## Revoked Link

```
No update
```


## One Time Link

First successful access:

```
viewCount + 1

isUsed = true
```


Second attempt:

```
Rejected
```



# Race Condition Handling


Problem:

Two users open the same one-time link at the same time.


Solution:

Atomic MongoDB update.


Example:

```javascript
findOneAndUpdate(
{
 token,
 isUsed:false
},
{
 $set:{
  isUsed:true
 },

 $inc:{
  viewCount:1,
  totalViews:1
 }
}
)
```


Only one request can change:

```
isUsed:false
```

to:

```
isUsed:true
```


The second request fails.

This prevents multiple users from consuming a one-time link.



# Features Completed


✅ User authentication  
✅ Create notes  
✅ Secure share links  
✅ Public sharing  
✅ Password protected sharing  
✅ One-time access links  
✅ Time based expiry  
✅ Revoke share links  
✅ View tracking  
✅ Password hashing  
✅ Race-condition handling  


# Demo Flow


The demo shows:


1. User registration/login

2. Create note

3. Generate share link

4. Public share access

5. Password protected access

6. Wrong password handling

7. One-time link expiry

8. Time expiry

9. Revoke link

10. View count update
