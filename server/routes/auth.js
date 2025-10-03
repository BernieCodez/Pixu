const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');

// Register/Login is handled by Firebase client-side
// This is for server-side user management

router.post('/create-profile', async (req, res) => {
  try {
    const { uid, email, displayName } = req.body;
    
    const userProfile = {
      uid,
      email,
      displayName,
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

module.exports = router;