const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { auth, db } = require('../config/firebase');
const { authenticateUser } = require('../middleware/auth');

// In-memory token store (in production, use Redis or database)
const tokenStore = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'pixalu-secret-key-change-in-production';

// Login endpoint - generates JWT token
router.post('/login', async (req, res) => {
  try {
    const { email, firebaseToken } = req.body;
    
    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(firebaseToken);
    const uid = decodedToken.uid;
    
    // Generate UUID token
    const sessionToken = uuidv4();
    
    // Create JWT
    const jwtToken = jwt.sign(
      { uid, email, sessionToken },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Store mapping
    tokenStore.set(sessionToken, { uid, email, createdAt: Date.now() });
    
    // Get or create user profile
    let userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      const userProfile = {
        uid,
        email,
        displayName: decodedToken.name || email.split('@')[0],
        bio: '',
        projects: [],
        customization: {},
        plan: 'free',
        createdAt: new Date().toISOString(),
        sprites: [],
        gallerySubmissions: []
      };
      await db.collection('users').doc(uid).set(userProfile);
      userDoc = await db.collection('users').doc(uid).get();
    }
    
    res.json({ 
      success: true, 
      token: jwtToken,
      sessionToken,
      user: userDoc.data()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Verify token endpoint
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session token exists in store
    if (!tokenStore.has(decoded.sessionToken)) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Get user profile
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      user: userDoc.data()
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      tokenStore.delete(decoded.sessionToken);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true }); // Logout anyway
  }
});

// Register/Login is handled by Firebase client-side
// This is for server-side user management

router.post('/create-profile', async (req, res) => {
  try {
    const { uid, email, displayName } = req.body;
    
    const userProfile = {
      uid,
      email,
      displayName,
      bio: '',
      projects: [],
      customization: {},
      plan: 'free',
      createdAt: new Date().toISOString(),
      sprites: [],
      gallerySubmissions: []
    };

    await db.collection('users').doc(uid).set(userProfile);
    
    res.json({ success: true, profile: userProfile });
  } catch (error) {
    console.error('Profile creation error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Get user profile by UID
router.get('/profile/:uid', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.uid).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(doc.data());
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user profile by email (for user pages)
router.get('/user/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    // Get user's published sprites
    const spritesSnapshot = await db.collection('gallery')
      .where('userEmail', '==', email)
      .where('approved', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const sprites = [];
    spritesSnapshot.forEach(doc => {
      sprites.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ 
      ...userData,
      publishedSprites: sprites
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile (authenticated)
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { displayName, bio, projects, customization } = req.body;
    
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (projects !== undefined) updates.projects = projects;
    if (customization !== undefined) updates.customization = customization;
    
    await db.collection('users').doc(req.user.uid).update(updates);
    
    const updatedDoc = await db.collection('users').doc(req.user.uid).get();
    
    res.json({ success: true, profile: updatedDoc.data() });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Search users
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json({ users: [] });
    }
    
    // Search by email or display name
    const emailSnapshot = await db.collection('users')
      .where('email', '>=', q)
      .where('email', '<=', q + '\uf8ff')
      .limit(10)
      .get();
    
    const nameSnapshot = await db.collection('users')
      .where('displayName', '>=', q)
      .where('displayName', '<=', q + '\uf8ff')
      .limit(10)
      .get();
    
    const users = [];
    const seen = new Set();
    
    emailSnapshot.forEach(doc => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        const data = doc.data();
        users.push({
          uid: data.uid,
          email: data.email,
          displayName: data.displayName
        });
      }
    });
    
    nameSnapshot.forEach(doc => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        const data = doc.data();
        users.push({
          uid: data.uid,
          email: data.email,
          displayName: data.displayName
        });
      }
    });
    
    res.json({ users });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;