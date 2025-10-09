# Quick Testing Guide - User Profile & JWT Auth System

## 🚀 Quick Start Testing

### Step 1: Create an Account
1. Go to http://localhost:3000/auth
2. Click "Sign Up" tab
3. Fill in:
   - Username: testuser
   - Email: test@example.com
   - Password: test123
   - Confirm password
   - Accept terms
4. Click "Sign Up"
5. ✅ You should be redirected and see "Welcome, testuser" in navbar

### Step 2: Verify Auto-Login
1. Refresh the page (F5)
2. ✅ You should STILL be logged in (no redirect to login page)
3. Check browser console: `localStorage.getItem('pixalu_auth_token')`
4. ✅ Should see a JWT token string

### Step 3: View Your Profile
1. Click "My Profile" button in navbar
2. ✅ Should see your profile page with:
   - Your email as avatar initial
   - Display name
   - Email address
   - Default bio: "No bio yet."
   - "Edit Profile" button (visible only on your own profile)

### Step 4: Edit Your Profile
1. Click "Edit Profile" button
2. Update:
   - Display Name: "Test Artist"
   - Bio: "I love creating pixel art!"
   - Projects (one per line):
     ```
     Game Character Sprites - Main character animations
     Logo Design - Pixel art logo for indie game
     ```
   - Background Color: Pick a color (e.g., purple)
   - Text Color: Keep white or pick another
3. Click "Save Changes"
4. ✅ Profile should update immediately with your new colors and info

### Step 5: Test Gallery Search
1. Go to http://localhost:3000/gallery
2. In the search box, type: "test"
3. ✅ Should see dropdown with your user (test@example.com)
4. Click on your user in dropdown
5. ✅ Should navigate to your profile page

### Step 6: Create a Second User
1. Open an incognito/private window
2. Go to http://localhost:3000/auth
3. Sign up as: artist@example.com
4. Go to gallery and search "test"
5. ✅ Should see the first user in search results
6. Click to view their profile
7. ✅ Should NOT see "Edit Profile" button (not your profile)

### Step 7: Test Logout
1. Click "Logout" button
2. ✅ Should be logged out
3. Refresh page
4. ✅ Should still be logged out (token cleared)
5. Check localStorage: `localStorage.getItem('pixalu_auth_token')`
6. ✅ Should be null

## 🧪 Advanced Testing

### Test Token Verification API
```javascript
// In browser console while logged in
const token = localStorage.getItem('pixalu_auth_token');

fetch('/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
})
.then(r => r.json())
.then(data => console.log('User data:', data));
```

### Test User Search API
```javascript
// Search for users
fetch('/api/auth/search?q=test')
  .then(r => r.json())
  .then(data => console.log('Search results:', data.users));
```

### Test Profile Update API
```javascript
const token = localStorage.getItem('pixalu_auth_token');

fetch('/api/auth/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bio: 'Updated via API!',
    projects: ['API Test Project']
  })
})
.then(r => r.json())
.then(data => console.log('Updated profile:', data));
```

## ✅ Checklist

- [ ] Sign up creates account
- [ ] JWT token stored in localStorage
- [ ] Auto-login works after page refresh
- [ ] Profile page loads correctly
- [ ] Edit profile works (only for owner)
- [ ] Profile customization (colors) works
- [ ] Gallery search shows users
- [ ] Clicking user in search goes to profile
- [ ] "View Artist" link on gallery items works
- [ ] Can't edit other users' profiles
- [ ] Logout clears token
- [ ] After logout, auto-login doesn't work
- [ ] User profile includes published sprites
- [ ] Projects list displays correctly
- [ ] Bio updates save properly

## 🐛 Common Issues

### "User not found" on profile page
- **Cause**: User document not created in Firestore
- **Fix**: Check Firestore console, manually create if needed

### Auto-login not working
- **Cause**: Token expired or invalid
- **Fix**: Clear localStorage and log in again
- **Check**: JWT_SECRET in .env file

### Search not finding users
- **Cause**: Firestore query permissions
- **Fix**: Check firestore.rules allows user collection reads

### Profile colors not applying
- **Cause**: CSS specificity or customization not saved
- **Fix**: Check browser inspector, verify customization object in Firestore

### Can't edit own profile
- **Cause**: Token not being sent or verified
- **Fix**: Check Authorization header in Network tab

## 📊 Test Data Examples

### Sample User Profile
```json
{
  "displayName": "Pixel Master",
  "email": "master@example.com",
  "bio": "Professional pixel artist with 10 years of experience. I specialize in game sprites and UI elements.",
  "projects": [
    "RPG Character Pack - 50+ animated sprites",
    "Platformer Tileset - Complete game assets",
    "Logo Collection - Pixel art branding"
  ],
  "customization": {
    "bgColor": "#764ba2",
    "textColor": "#ffffff"
  }
}
```

## 🌐 Test URLs

- Main Page: http://localhost:3000/
- Auth Page: http://localhost:3000/auth
- Gallery: http://localhost:3000/gallery
- Editor: http://localhost:3000/editor
- User Profile: http://localhost:3000/user?email=test@example.com

## 📝 Notes

- All JWT tokens expire after 30 days
- Session tokens are stored in memory (cleared on server restart)
- User search is case-insensitive
- Profile URLs use email as identifier
- Only approved gallery items show on profiles

---

**Happy Testing! 🎨**

If you encounter any issues, check the browser console and server logs for error messages.
