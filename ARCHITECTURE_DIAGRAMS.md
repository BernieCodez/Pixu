# System Architecture Diagram

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER AUTHENTICATION FLOW                  │
└─────────────────────────────────────────────────────────────────┘

Step 1: User Login
┌──────────┐
│  Browser │  Email + Password
│          ├──────────────────────┐
│ (Client) │                      │
└──────────┘                      ▼
                        ┌─────────────────┐
                        │  Firebase Auth  │
                        │   (Existing)    │
                        └────────┬────────┘
                                 │
                                 │ Firebase Token
                                 ▼
                        ┌─────────────────┐
                        │   POST /login   │
                        │  Backend API    │
                        └────────┬────────┘
                                 │
                     ┌───────────┴───────────┐
                     │                       │
                     ▼                       ▼
            ┌────────────────┐    ┌──────────────────┐
            │  Generate UUID │    │  Create JWT      │
            │  Session Token │    │  with User Info  │
            └────────┬───────┘    └─────────┬────────┘
                     │                      │
                     └──────────┬───────────┘
                                ▼
                    ┌────────────────────────┐
                    │  Store UUID → User     │
                    │  in Token Store (Map)  │
                    └────────────────────────┘
                                │
                                │ Return JWT + UUID
                                ▼
                        ┌──────────────┐
                        │ localStorage │
                        │  - auth_token│
                        │  - session   │
                        └──────────────┘


Step 2: Auto-Login on Page Refresh
┌──────────┐
│  Browser │
│          │
│ (Reload) │
└────┬─────┘
     │
     │ Check localStorage
     ▼
┌─────────────────┐
│  Token Found?   │
└────┬────────────┘
     │ Yes
     │
     ▼
┌──────────────────┐
│ POST /api/auth/  │
│     verify       │
└────┬─────────────┘
     │
     │ Verify JWT + Check UUID in Store
     ▼
┌─────────────────┐       ┌──────────────┐
│  Valid Token?   ├──Yes─▶│ User Logged  │
│                 │       │      In      │
└────┬────────────┘       └──────────────┘
     │ No
     ▼
┌─────────────────┐
│ Clear Tokens &  │
│  Redirect Login │
└─────────────────┘
```

## User Profile System

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER PROFILE ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────┘

Profile Access:
┌──────────────┐
│   Browser    │
│              │
│ /user?email= │
│ user@ex.com  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ GET /api/auth/user/  │
│     :email           │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│   Firestore Query    │
│ users where email == │
└──────┬───────────────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌──────────────┐      ┌───────────────────┐
│ User Profile │      │ Gallery Query     │
│    Data      │      │ (Published Sprites)│
└──────┬───────┘      └─────────┬─────────┘
       │                        │
       └────────┬───────────────┘
                ▼
       ┌─────────────────┐
       │  Combined Data  │
       │  Returned as    │
       │     JSON        │
       └────────┬────────┘
                │
                ▼
       ┌─────────────────┐
       │  Render Profile │
       │      Page       │
       └─────────────────┘
```

## Gallery Search Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      GALLERY SEARCH SYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

User Types in Search:
┌──────────┐
│  Browser │ User types "john"
│          │
│ Gallery  │
└────┬─────┘
     │
     │ Debounce 300ms
     ▼
┌─────────────────────┐
│ GET /api/auth/      │
│   search?q=john     │
└─────┬───────────────┘
      │
      │ Query Firestore
      ▼
┌─────────────────────────────────────┐
│  Search in users collection:        │
│  - email contains "john"            │
│  - displayName contains "john"      │
│  Limit 10 results                   │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Return matching users:             │
│  [                                  │
│    {uid, email, displayName},       │
│    {uid, email, displayName}        │
│  ]                                  │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Display dropdown with results      │
│  ┌───────────────────────────────┐  │
│  │ 🧑 John Doe                   │  │
│  │    john@example.com           │  │
│  ├───────────────────────────────┤  │
│  │ 🧑 Johnny Smith               │  │
│  │    johnny@example.com         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
      │
      │ User clicks result
      ▼
┌─────────────────────────────────────┐
│ Navigate to:                        │
│ /user?email=john@example.com        │
└─────────────────────────────────────┘
```

## Data Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          DATA MODELS                             │
└─────────────────────────────────────────────────────────────────┘

User Document (Firestore: users/{uid})
┌─────────────────────────────────────┐
│ {                                   │
│   uid: "abc123",                    │
│   email: "user@example.com",        │
│   displayName: "Cool Artist",       │
│   bio: "I love pixel art!",         │
│   projects: [                       │
│     "Game Assets",                  │
│     "Logo Design"                   │
│   ],                                │
│   customization: {                  │
│     bgColor: "#667eea",             │
│     textColor: "#ffffff"            │
│   },                                │
│   plan: "free",                     │
│   createdAt: "2025-10-08T...",      │
│   sprites: [],                      │
│   gallerySubmissions: []            │
│ }                                   │
└─────────────────────────────────────┘

JWT Token (localStorage)
┌─────────────────────────────────────┐
│ Header:                             │
│ {                                   │
│   "alg": "HS256",                   │
│   "typ": "JWT"                      │
│ }                                   │
│                                     │
│ Payload:                            │
│ {                                   │
│   "uid": "abc123",                  │
│   "email": "user@example.com",      │
│   "sessionToken": "uuid-v4",        │
│   "iat": 1234567890,                │
│   "exp": 1237246290                 │
│ }                                   │
│                                     │
│ Signature:                          │
│ HMACSHA256(base64Url(header) +     │
│   "." + base64Url(payload),         │
│   JWT_SECRET)                       │
└─────────────────────────────────────┘

Token Store (Server Memory: Map)
┌─────────────────────────────────────┐
│ sessionToken → userInfo             │
│                                     │
│ "uuid-1" → {                        │
│   uid: "abc123",                    │
│   email: "user@example.com",        │
│   createdAt: 1234567890             │
│ }                                   │
│                                     │
│ "uuid-2" → {                        │
│   uid: "def456",                    │
│   email: "other@example.com",       │
│   createdAt: 1234567900             │
│ }                                   │
└─────────────────────────────────────┘
```

## Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY VERIFICATION                       │
└─────────────────────────────────────────────────────────────────┘

Protected Endpoint Request:
┌──────────────┐
│   Browser    │
│              │
│ PUT /profile │
└──────┬───────┘
       │
       │ Authorization: Bearer <JWT>
       ▼
┌─────────────────────────────────────┐
│  Middleware: authenticateUser()     │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  1. Extract JWT from header         │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  2. Verify JWT signature            │
│     jwt.verify(token, JWT_SECRET)   │
└─────┬───────────────────────────────┘
      │
      │ Valid?
      ▼
┌─────────────────────────────────────┐
│  3. Decode payload                  │
│     Extract: uid, email, sessionUUID│
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  4. Check UUID in token store       │
│     tokenStore.has(sessionUUID)     │
└─────┬───────────────────────────────┘
      │
      │ Exists?
      ▼
┌─────────────────────────────────────┐
│  5. Verify UID matches store        │
│     O(1) lookup                     │
└─────┬───────────────────────────────┘
      │
      │ Match?
      ▼
┌─────────────────────────────────────┐
│  ✅ Request Authorized              │
│  req.user = decodedToken            │
│  Continue to endpoint               │
└─────────────────────────────────────┘

If any step fails:
┌─────────────────────────────────────┐
│  ❌ 401 Unauthorized                │
│  Return error response              │
└─────────────────────────────────────┘
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYSTEM COMPONENTS                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   auth.html  │  │ gallery.html │  │   user.html     │  │
│  │              │  │              │  │                 │  │
│  │ - Login      │  │ - Search     │  │ - Display       │  │
│  │ - Signup     │  │ - Browse     │  │ - Edit          │  │
│  │ - Get JWT    │  │ - Profile    │  │ - Customize     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                    │           │
│         └─────────────────┴────────────────────┘           │
│                           │                                │
│                           ▼                                │
│              ┌────────────────────────┐                    │
│              │   localStorage         │                    │
│              │  - auth_token          │                    │
│              │  - session_token       │                    │
│              └────────────────────────┘                    │
└──────────────────────────┬──────────────────────────────────┘
                          │
                          │ HTTPS
                          │
┌─────────────────────────▼──────────────────────────────────┐
│                       BACKEND                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Express Server                         │  │
│  │                                                     │  │
│  │  ┌──────────────────┐    ┌────────────────────┐   │  │
│  │  │  Routes          │    │  Middleware        │   │  │
│  │  │                  │    │                    │   │  │
│  │  │ /api/auth/*      │───▶│ authenticateUser() │   │  │
│  │  │ /api/gallery/*   │    │ optionalAuth()     │   │  │
│  │  │ /api/sprites/*   │    └────────────────────┘   │  │
│  │  └──────────────────┘                             │  │
│  │                                                     │  │
│  │  ┌──────────────────┐                              │  │
│  │  │  Token Store     │                              │  │
│  │  │  (Map in Memory) │                              │  │
│  │  │                  │                              │  │
│  │  │  UUID → User     │                              │  │
│  │  └──────────────────┘                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                          │                                │
│                          ▼                                │
│              ┌────────────────────────┐                   │
│              │   Firebase Admin SDK   │                   │
│              └──────────┬─────────────┘                   │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      FIREBASE / FIRESTORE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │    users     │  │   gallery    │  │     likes       │  │
│  │  collection  │  │  collection  │  │   collection    │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE METRICS                           │
└─────────────────────────────────────────────────────────────────┘

Operation                    Time Complexity    Typical Response Time
─────────────────────────────────────────────────────────────────────
JWT Generation               O(1)               < 10ms
JWT Verification             O(1)               < 5ms
UUID Lookup in Token Store   O(1)               < 1ms
User Profile Fetch           O(1)               50-100ms (DB query)
User Search                  O(n)               100-200ms (indexed)
Gallery Items Fetch          O(n)               100-300ms (with images)
Profile Update               O(1)               50-150ms (DB write)
Auto-Login Check             O(1) + O(1)        50-100ms (verify + fetch)

Memory Usage:
- Token Store: ~100 bytes per active session
- JWT Token: ~200-300 bytes
- User Profile: ~1-5 KB (depending on data)
```

---

**Legend:**
- `┌─┐ └─┘` Box drawing
- `─ │ ├ ┤ ┬ ┴ ┼` Connectors
- `▼ ▶ ◀ ▲` Direction indicators
- `✅` Success
- `❌` Error/Failure
