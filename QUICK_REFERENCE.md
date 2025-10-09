# 🚀 Quick Reference - User Profiles & JWT Auth

## 🔗 Important URLs

```
Main Site:     http://localhost:3000/
Auth:          http://localhost:3000/auth
Gallery:       http://localhost:3000/gallery
User Profile:  http://localhost:3000/user?email=example@gmail.com
Editor:        http://localhost:3000/editor
```

## 🎯 Key Features at a Glance

### 1. Auto-Login
- ✅ Stay logged in after page refresh
- ✅ No more repetitive sign-ins
- ✅ Works across all pages

### 2. User Profiles
- ✅ Access via `/user?email=your@email.com`
- ✅ Edit your own profile (bio, projects, colors)
- ✅ View others' profiles (read-only)
- ✅ See all published sprites

### 3. User Search
- ✅ Search in gallery for users
- ✅ Type email or name
- ✅ Click result to visit profile

## 💻 Quick Code Snippets

### Check if User is Logged In
```javascript
const token = localStorage.getItem('pixalu_auth_token');
if (token) {
  // User is logged in
}
```

### Get Current User Info
```javascript
const token = localStorage.getItem('pixalu_auth_token');
const response = await fetch('/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});
const { user } = await response.json();
console.log(user);
```

### Update Profile
```javascript
const token = localStorage.getItem('pixalu_auth_token');
await fetch('/api/auth/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bio: 'My new bio',
    projects: ['Project 1', 'Project 2']
  })
});
```

### Search Users
```javascript
const response = await fetch('/api/auth/search?q=username');
const { users } = await response.json();
```

### Logout
```javascript
const token = localStorage.getItem('pixalu_auth_token');
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});
localStorage.removeItem('pixalu_auth_token');
localStorage.removeItem('pixalu_session_token');
```

## 📋 Testing Checklist

Quick things to test:

```
✅ Sign up new account
✅ Refresh page - still logged in?
✅ Click "My Profile" in navbar
✅ Edit profile (bio, projects, colors)
✅ Go to gallery
✅ Search for a user by typing email
✅ Click user in dropdown
✅ Click "View Artist" on a sprite
✅ Try to edit someone else's profile (should not see button)
✅ Logout
✅ Refresh - should be logged out
```

## 🔑 API Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/login` | Get JWT token | No |
| POST | `/api/auth/verify` | Verify token | No |
| POST | `/api/auth/logout` | Logout | No |
| GET | `/api/auth/user/:email` | Get user profile | No |
| GET | `/api/auth/profile/:uid` | Get profile by UID | No |
| PUT | `/api/auth/profile` | Update profile | Yes |
| GET | `/api/auth/search?q=` | Search users | No |

## 🎨 Profile Customization Options

```javascript
{
  displayName: "Your Name",
  bio: "Your bio text (any length)",
  projects: [
    "Project 1 - Description",
    "Project 2 - Description"
  ],
  customization: {
    bgColor: "#667eea",    // Any hex color
    textColor: "#ffffff"    // Any hex color
  }
}
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Not staying logged in | Check localStorage for `pixalu_auth_token` |
| Can't edit profile | Make sure you're on YOUR profile page |
| Search not working | Check browser console for errors |
| Profile not loading | Verify email in URL is correct |
| Token expired | Clear localStorage and login again |

## 📱 Browser Console Commands

```javascript
// View stored token
localStorage.getItem('pixalu_auth_token')

// Clear all tokens
localStorage.removeItem('pixalu_auth_token')
localStorage.removeItem('pixalu_session_token')

// Clear everything
localStorage.clear()

// Check if logged in
!!localStorage.getItem('pixalu_auth_token')
```

## 🎯 User Flow Diagram

```
New User:
Sign Up → Token Generated → Stored in localStorage → Profile Created

Returning User:
Page Load → Check localStorage → Token Found → Auto Verify → Logged In

Profile Visit:
Gallery → Search User → Click Result → View Profile → (Edit if Own)

Profile Edit:
My Profile → Edit Button → Modal Opens → Make Changes → Save → Updated
```

## 📊 What's Stored Where

### localStorage
- `pixalu_auth_token` - JWT token (30-day expiration)
- `pixalu_session_token` - UUID session identifier

### Firestore Collections
- `users` - User profiles, bios, projects, customization
- `gallery` - Sprite submissions with user emails
- `likes` - User likes on gallery items

### Server Memory
- Token Store: Map of UUID → user data (cleared on restart)

## 🔐 Security Notes

- JWT tokens expire after 30 days
- Session tokens can be invalidated server-side
- Tokens cleared on logout
- Profile edits require valid token
- Only profile owner can edit
- Search is public (no auth needed)

## 🎉 That's It!

Everything you need to know in one place. Enjoy your new user profile system!

---

**Need more details?** Check these docs:
- 📘 **Full Documentation**: `USER_PROFILE_SYSTEM.md`
- 🧪 **Testing Guide**: `TESTING_GUIDE.md`
- 📝 **Summary**: `IMPLEMENTATION_SUMMARY_PROFILES.md`
