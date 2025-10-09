const { admin } = require('../config/firebase');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pixalu-secret-key-change-in-production';

async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      // Try JWT first
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtError) {
      // Fallback to Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.split('Bearer ')[1];
      
      if (token) {
        try {
          // Try JWT first
          const decoded = jwt.verify(token, JWT_SECRET);
          req.user = decoded;
        } catch (jwtError) {
          // Fallback to Firebase token
          const decodedToken = await admin.auth().verifyIdToken(token);
          req.user = decodedToken;
        }
      }
    }
    next();
  } catch (error) {
    // Continue without auth
    next();
  }
}

module.exports = { authenticateUser, optionalAuth };