const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { User } = require('./models');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mySecretJwtKey_ChangeThisForProduction_2026';

// Email validation regular expression (RFC 5322 compatible)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Middleware: Checks MongoDB connection readiness before running queries
 */
const checkDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    const { getDBStatus } = require('./db');
    const dbInfo = typeof getDBStatus === 'function' ? getDBStatus() : { category: 'IP_NOT_WHITELISTED', message: 'MongoDB Atlas is pending connection.' };
    return res.status(503).json({
      error: dbInfo.message || 'Database is currently unavailable. Please verify Atlas Network Access IP whitelist.',
      category: dbInfo.category || 'DATABASE_UNAVAILABLE',
      status: 'offline'
    });
  }
  next();
};

/**
 * Reusable JWT Authentication Middleware
 * Protects private endpoints by verifying the Bearer token in the Authorization header.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains { id: user._id, email: user.email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================================================
// Authentication Routes (POST /register, POST /login, GET /me)
// ============================================================================

// POST /api/auth/register - Register a new user
router.post('/register', checkDB, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long.' });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check for existing user (duplicate rejection)
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash password with bcryptjs (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash
    });

    await user.save();

    // Sign JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login - Authenticate existing user
router.post('/login', checkDB, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ 
        error: 'No account found with this email. Please sign up first.',
        code: 'USER_NOT_FOUND',
        accountExists: false 
      });
    }

    // Compare passwords using bcryptjs
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Incorrect password. Please try again.',
        code: 'INVALID_PASSWORD',
        accountExists: true 
      });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - Retrieve current authenticated user profile
router.get('/me', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  authRouter: router,
  authMiddleware,
  checkDB
};
