const { admin } = require('../config/firebase');

async function authenticateUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (token) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
    }
    next();
  } catch (error) {
    // Continue without auth
    next();
  }
}

module.exports = { authenticateUser, optionalAuth };