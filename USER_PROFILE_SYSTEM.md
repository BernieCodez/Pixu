# User Profile & JWT Authentication System

## Overview
This update implements a comprehensive user profile system with JWT-based authentication and persistent login functionality.

## New Features

### 1. **User Profile Pages** (`/user?email=example@gmail.com`)

Each user gets a customizable public profile page with:

- **Public Bio**: Share information about yourself
- **Projects Section**: List your projects with descriptions
- **Published Sprites**: Automatic display of all your published gallery sprites
- **Custom Styling**: Personalize with custom background and text colors
- **Edit Capabilities**: Only the profile owner can edit their page

#### Profile URL Format
```
/user?email=example@gmail.com
```

### 2. **Enhanced Gallery Search**

The gallery now supports searching for both:
- **Sprites by tags** (existing functionality)
- **Users by email or display name** (new feature)

Features:
- Real-time search suggestions dropdown
- Click on any user to visit their profile
- View artist link on each gallery sprite
- Smooth search UX with debouncing

### 3. **JWT Token Authentication with localStorage**

Implements persistent login using JWT tokens stored in localStorage.

#### How It Works

**Login Flow:**
1. User signs in with email/password via Firebase
2. Frontend exchanges Firebase token for JWT token from backend
3. Backend generates:
   - UUID session token
   - JWT containing user info + session token
   - Maps UUID → user data in memory
4. JWT token stored in localStorage
5. User stays logged in across page reloads

**Auto-Login:**
1. On page load, check for JWT token in localStorage
2. If found, verify with backend (`/api/auth/verify`)
3. Backend validates JWT and checks UUID mapping
4. User automatically logged in (O(1) lookup)

**Logout:**
1. Call logout endpoint with JWT token
2. Backend removes UUID from token store
3. Clear localStorage
4. Sign out from Firebase

#### Security Features
- JWT tokens expire after 30 days
- Session tokens stored server-side
- Double validation: JWT signature + UUID mapping
- Tokens cleared on logout or verification failure

## API Endpoints

### Authentication Routes (`/api/auth`)

#### `POST /api/auth/login`
Exchange Firebase token for JWT token
```json
{
  "email": "user@example.com",
  "firebaseToken": "firebase_id_token"
}
```

Response:
```json
{
  "success": true,
  "token": "jwt_token",
  "sessionToken": "uuid",
  "user": { /* user data */ }
}
```

#### `POST /api/auth/verify`
Verify JWT token and get user data
```json
{
  "token": "jwt_token"
}
```

#### `POST /api/auth/logout`
Invalidate session token
```json
{
  "token": "jwt_token"
}
```

#### `GET /api/auth/user/:email`
Get user profile by email (public)

Response includes:
- User profile data
- Published sprites
- Projects
- Customization

#### `PUT /api/auth/profile`
Update user profile (authenticated)
```json
{
  "displayName": "New Name",
  "bio": "My bio",
  "projects": ["Project 1", "Project 2"],
  "customization": {
    "bgColor": "#667eea",
    "textColor": "#ffffff"
  }
}
```

#### `GET /api/auth/search?q=query`
Search for users by email or display name

### User Data Structure

```javascript
{
  uid: "firebase_uid",
  email: "user@example.com",
  displayName: "Username",
  bio: "User bio text",
  projects: ["Project 1 - Description", "Project 2 - Description"],
  customization: {
    bgColor: "#667eea",
    textColor: "#ffffff"
  },
  plan: "free",
  createdAt: "ISO timestamp",
  sprites: [],
  gallerySubmissions: [],
  publishedSprites: [ /* sprite objects */ ]
}
```

## Client-Side Implementation

### Auto-Login Helper (`/js/auth-helper.js`)

Utility functions for authentication:

```javascript
// Check for stored token and auto-login
await checkAutoLogin();

// Logout user and clear tokens
await logoutUser();
```

### Integration Example

```javascript
// On page load
const token = localStorage.getItem('pixalu_auth_token');
if (token) {
  const user = await checkAutoLogin();
  if (user) {
    // User is authenticated
    updateUI(user);
  }
}
```

## Database Schema

### Users Collection (`users`)
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  bio: string,
  projects: string[],
  customization: {
    bgColor: string,
    textColor: string
  },
  plan: string,
  createdAt: timestamp,
  sprites: string[],
  gallerySubmissions: string[]
}
```

### Gallery Collection (`gallery`)
```javascript
{
  userId: string,
  userEmail: string,  // Used for user search
  title: string,
  description: string,
  imageUrl: string,
  likes: number,
  views: number,
  approved: boolean,
  createdAt: timestamp
}
```

## Pages Updated

1. **`/public/user.html`** (NEW) - User profile page
2. **`/public/gallery.html`** - Added user search, profile links
3. **`/public/index.html`** - Auto-login support
4. **`/public/auth.html`** - JWT token generation on login/signup

## Server Updates

1. **`/server/routes/auth.js`**
   - JWT login/logout endpoints
   - User profile management
   - User search functionality

2. **`/server/middleware/auth.js`**
   - JWT token verification
   - Backward compatible with Firebase tokens

3. **`/server/server.js`**
   - Added `/user` route

## Dependencies Added

```json
{
  "jsonwebtoken": "^9.0.0",
  "uuid": "^9.0.0"
}
```

## Environment Variables

Add to your `.env` file:

```env
JWT_SECRET=your-secret-key-change-in-production
```

## Usage Examples

### Accessing User Profiles

```html
<!-- Link to user profile -->
<a href="/user?email=artist@example.com">View Artist</a>

<!-- Link to own profile -->
<a href="/user?email=${currentUser.email}">My Profile</a>
```

### Authenticated API Requests

```javascript
const token = localStorage.getItem('pixalu_auth_token');

const response = await fetch('/api/auth/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ bio: 'New bio' })
});
```

### Searching Users

```javascript
const response = await fetch(`/api/auth/search?q=${query}`);
const { users } = await response.json();

users.forEach(user => {
  console.log(user.displayName, user.email);
});
```

## Security Considerations

1. **Token Storage**: JWT tokens stored in localStorage (XSS risk if site compromised)
2. **Token Expiration**: 30-day expiration with automatic cleanup
3. **Session Management**: In-memory token store (use Redis for production)
4. **HTTPS Required**: Always use HTTPS in production
5. **CORS**: Configure properly for your domain

## Future Enhancements

1. Refresh token mechanism
2. Redis/database for token storage
3. Email verification
4. Social media links on profiles
5. Profile avatars/images
6. Follow/follower system
7. Private messaging
8. Profile views counter
9. Achievement badges
10. Custom profile themes

## Testing

1. **Create Account**: Sign up with new email
2. **Auto-Login**: Refresh page, should stay logged in
3. **View Profile**: Click "My Profile" in navbar
4. **Edit Profile**: Update bio, projects, colors
5. **Search Users**: Search in gallery for users
6. **Visit Other Profiles**: Click on artist links
7. **Logout**: Click logout, verify token cleared

## Troubleshooting

### Token Issues
- Check browser console for JWT verification errors
- Clear localStorage: `localStorage.clear()`
- Check server logs for authentication failures

### Profile Not Loading
- Verify email parameter in URL
- Check Firestore for user document
- Verify published sprites query

### Auto-Login Not Working
- Check JWT_SECRET environment variable
- Verify token in localStorage
- Check token expiration

## Notes

- User emails are used as unique identifiers for profile URLs
- Profile customization persists across sessions
- Only approved gallery items appear on user profiles
- Search is case-insensitive and supports partial matches
- Token store is in-memory (restart clears all sessions in development)

---

**Implementation Date**: October 8, 2025  
**Version**: 1.0.0  
**Status**: ✅ Complete and Ready for Testing
