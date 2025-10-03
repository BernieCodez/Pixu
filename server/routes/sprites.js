const express = require('express');
const router = express.Router();
const { db, bucket } = require('../config/firebase');
const { authenticateUser } = require('../middleware/auth');

// Save sprite (authenticated)
router.post('/save', authenticateUser, async (req, res) => {
  try {
    const { spriteData, name, width, height } = req.body;
    
    const sprite = {
      userId: req.user.uid,
      name,
      width,
      height,
      data: spriteData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection('sprites').add(sprite);
    
    res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Sprite save error:', error);
    res.status(500).json({ error: 'Failed to save sprite' });
  }
});

// Get user's sprites
router.get('/my-sprites', authenticateUser, async (req, res) => {
  try {
    const snapshot = await db.collection('sprites')
      .where('userId', '==', req.user.uid)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const sprites = [];
    snapshot.forEach(doc => {
      sprites.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ sprites });
  } catch (error) {
    console.error('Sprites fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch sprites' });
  }
});

// Delete sprite
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const docRef = db.collection('sprites').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Sprite not found' });
    }
    
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await docRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Sprite delete error:', error);
    res.status(500).json({ error: 'Failed to delete sprite' });
  }
});

module.exports = router;