# 🔧 Firestore Permission Error - Troubleshooting

## Error: "Missing or insufficient permissions"

This error occurs when Firestore security rules are blocking your request. Here's how to fix it:

## ✅ Solution Steps

### Step 1: Enable Firestore Database

1. **Open Firebase Console**: https://console.firebase.google.com/project/pixaluapp/firestore

2. **Check if database exists**:
   - If you see "Create database" button → Click it
   - If you see data/collections → Database is already enabled ✓

3. **If creating new database**:
   - Select **"Start in production mode"** (security rules are already deployed)
   - Choose location: **us-central1** (or closest to you)
   - Click **"Enable"**
   - Wait 1-2 minutes for provisioning

### Step 2: Verify Rules are Deployed

1. In Firebase Console → Firestore → **Rules** tab

2. You should see these rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/sprites/{spriteId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         
         match /frames/{frameId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
   }
   ```

3. If rules are missing or different:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Step 3: Verify User Authentication

1. **Open your editor in browser**

2. **Open browser console** (F12)

3. **Check if user is logged in**:
   ```javascript
   console.log('Current user:', window.currentUser);
   ```

4. **If null**:
   - Sign in through your app
   - Check auth.html is working
   - Verify Firebase Auth is configured

5. **If user exists, check UID**:
   ```javascript
   console.log('User ID:', window.currentUser.uid);
   ```

### Step 4: Test Cloud Storage

Once user is logged in, test:

```javascript
// Test cloud storage
const testSprite = new Sprite(64, 64, 'Test Sprite');
await window.cloudStorage.saveSprite(testSprite, window.currentUser.uid);
```

If successful, you should see:
```
Sprite Test Sprite saved to cloud
```

## 🔍 Common Issues

### Issue 1: "PERMISSION_DENIED"

**Cause**: User not authenticated or rules not deployed

**Solution**:
1. Sign in to your app
2. Run: `firebase deploy --only firestore:rules`
3. Wait 30 seconds for rules to propagate

### Issue 2: "User is null"

**Cause**: Firebase Auth not initialized or user not signed in

**Solution**:
1. Check Firebase config in editor.html
2. Verify API key and project ID
3. Sign in through auth.html

### Issue 3: "Firestore not enabled"

**Cause**: Firestore database not created in Firebase Console

**Solution**:
1. Go to: https://console.firebase.google.com/project/pixaluapp/firestore
2. Click "Create database"
3. Select production mode
4. Choose location

### Issue 4: "Wrong project"

**Cause**: Firebase CLI using wrong project

**Solution**:
```bash
firebase use pixaluapp
firebase deploy --only firestore:rules
```

## 🧪 Testing

### Quick Test
```javascript
// In browser console
testStorageSystem()
```

### Manual Test
```javascript
// 1. Check auth
console.log('Auth:', window.firebaseAuth);
console.log('User:', window.currentUser);

// 2. Check storage managers
console.log('Canvas Storage:', window.canvasStorageManager);
console.log('Cloud Storage:', window.cloudStorage);
console.log('Hybrid Storage:', window.hybridStorage);

// 3. Test cloud init
console.log('Cloud initialized:', window.cloudStorage?.initialized);

// 4. Try saving
const sprite = new Sprite(32, 32, 'Test');
await window.cloudStorage.saveSprite(sprite, window.currentUser.uid);
```

## 📋 Checklist

- [ ] Firestore database enabled in Firebase Console
- [ ] Security rules deployed (`firebase deploy --only firestore:rules`)
- [ ] User authenticated (`window.currentUser !== null`)
- [ ] Cloud storage initialized (`window.cloudStorage.initialized === true`)
- [ ] No console errors in browser
- [ ] Test passes: `testStorageSystem()`

## 🔗 Quick Links

- **Firebase Console**: https://console.firebase.google.com/project/pixaluapp
- **Firestore Database**: https://console.firebase.google.com/project/pixaluapp/firestore
- **Firestore Rules**: https://console.firebase.google.com/project/pixaluapp/firestore/rules
- **Authentication**: https://console.firebase.google.com/project/pixaluapp/authentication

## 🆘 Still Not Working?

### Option 1: Use Local Storage Only (No Cloud)

Disable cloud sync temporarily:

```javascript
window.hybridStorage.setAutoSync(false);
```

Your sprites will still save locally and work perfectly offline.

### Option 2: Temporary Open Rules (Testing Only)

⚠️ **INSECURE - Development Only**

Edit `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ OPEN TO ALL
    }
  }
}
```

Deploy:
```bash
firebase deploy --only firestore:rules
```

**Remember to restore secure rules after testing!**

### Option 3: Check Firebase Logs

1. Go to: https://console.firebase.google.com/project/pixaluapp/firestore/usage
2. Check "Request" tab for denied requests
3. Look at the reason field

## 📞 Support

If still having issues:

1. **Check browser console** for exact error message
2. **Check Firebase Console** → Firestore → Usage tab
3. **Verify user authentication** is working
4. **Check network tab** for API calls

---

## ✅ Success Criteria

Once fixed, you should see:

```javascript
testStorageSystem()
// Output:
// ✅ Cloud Storage: PASSED
// ✅ Hybrid Storage: PASSED
// All tests passed!
```

And in Firebase Console → Firestore, you should see:
- Collection: `users`
- Document: `{your-user-id}`
- Subcollection: `sprites`
