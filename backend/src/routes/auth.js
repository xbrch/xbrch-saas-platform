const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register user (admin only)
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'user']),
  body('plan').isIn(['free', 'pro', 'authority']),
  body('monthlyLimit').isInt({ min: 0 })
], validateRequest, async (req, res) => {
  try {
    const { email, password, role, plan, monthlyLimit } = req.body;
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Get plan limits
    const planLimits = {
      free: parseInt(process.env.FREE_PLAN_LIMIT) || 10,
      pro: parseInt(process.env.PRO_PLAN_LIMIT) || 100,
      authority: parseInt(process.env.AUTHORITY_PLAN_LIMIT) || 1000
    };
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, plan, monthly_limit, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id, email, role, plan, monthly_limit, created_at`,
      [email, passwordHash, role, plan, monthlyLimit || planLimits[plan]]
    );
    
    const user = result.rows[0];
    
    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, new_values, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [user.id, 'CREATE_USER', 'user', JSON.stringify(user), req.ip, req.get('User-Agent')]
    );
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        monthlyLimit: user.monthly_limit,
        createdAt: user.created_at
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get user
    const result = await pool.query(
      'SELECT id, email, password_hash, role, plan, monthly_limit, is_active FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        plan: user.plan
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Create session
    const sessionToken = jwt.sign(
      { sessionId: require('uuid').v4() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const sessionTokenHash = await bcrypt.hash(sessionToken, 12);
    
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent, created_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4, NOW())`,
      [user.id, sessionTokenHash, req.ip, req.get('User-Agent')]
    );
    
    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [user.id, 'LOGIN', 'session', req.ip, req.get('User-Agent')]
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        monthlyLimit: user.monthly_limit
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Remove session
    await pool.query(
      'DELETE FROM sessions WHERE user_id = $1',
      [decoded.userId]
    );
    
    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [decoded.userId, 'LOGOUT', 'session', req.ip, req.get('User-Agent')]
    );
    
    res.json({ message: 'Logout successful' });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists
    const sessionResult = await pool.query(
      'SELECT id FROM sessions WHERE user_id = $1 AND expires_at > NOW()',
      [decoded.userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, role, plan, monthly_limit, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    
    const user = userResult.rows[0];
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        monthlyLimit: user.monthly_limit
      }
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Change password
router.post('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], validateRequest, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, decoded.userId]
    );
    
    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [decoded.userId, 'CHANGE_PASSWORD', 'user', req.ip, req.get('User-Agent')]
    );
    
    res.json({ message: 'Password changed successfully' });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
