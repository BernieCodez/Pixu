const express = require('express');
const router = express.Router();
const { db, bucket, admin } = require('../config/firebase');
const { authenticateUser, optionalAuth } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Get all gallery items (public)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0, sort = 'recent' } = req.query;
    
    let query = db.collection('gallery').where('approved', '==', true);
    
    if (sort === 'popular') {
      query = query.orderBy('likes', 'desc');
    } else {
      query = query.orderBy('createdAt', 'desc');
    }
    
    const snapshot = await query.limit(parseInt(limit)).offset(parseInt(offset)).get();
    
    const items = [];
    snapshot.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() });
    });
    
    // Return empty array if no items, don't error
    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Gallery fetch error:', error);
    // Return empty array on error so frontend can handle gracefully
    res.json({ items: [], total: 0, error: error.message });
  }
});

// Submit to gallery (authenticated)
router.post('/submit', authenticateUser, upload.single('image'), async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Upload to Firebase Storage
    const filename = `gallery/${req.user.uid}/${Date.now()}.png`;
    const fileUpload = bucket.file(filename);
    
    await fileUpload.save(file.buffer, {
      metadata: { contentType: 'image/png' }
    });
    
    const [url] = await fileUpload.getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });

    // Create gallery entry
    const galleryItem = {
      userId: req.user.uid,
      userEmail: req.user.email,
      title,
      description,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      imageUrl: url,
      likes: 0,
      views: 0,
      approved: false, // Requires admin approval
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('gallery').add(galleryItem);
    
    res.json({ success: true, id: docRef.id, item: galleryItem });
  } catch (error) {
    console.error('Gallery submission error:', error);
    res.status(500).json({ error: 'Failed to submit to gallery' });
  }
});

// Like/unlike gallery item
router.post('/:id/like', authenticateUser, async (req, res) => {
  try {
    const itemRef = db.collection('gallery').doc(req.params.id);
    const likeRef = db.collection('likes').doc(`${req.user.uid}_${req.params.id}`);
    
    const likeDoc = await likeRef.get();
    
    if (likeDoc.exists) {
      // Unlike
      await likeRef.delete();
      await itemRef.update({ likes: admin.firestore.FieldValue.increment(-1) });
      res.json({ liked: false });
    } else {
      // Like
      await likeRef.set({ 
        userId: req.user.uid, 
        itemId: req.params.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await itemRef.update({ likes: admin.firestore.FieldValue.increment(1) });
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like item' });
  }
});

module.exports = router;