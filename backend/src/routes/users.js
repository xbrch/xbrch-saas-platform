const express = require('express');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('./auth');
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

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const plan = req.query.plan || '';
    
    let query = `
      SELECT u.id, u.email, u.role, u.plan, u.monthly_limit, u.created_at, u.last_login, u.is_active,
             bp.name as business_name, bp.city, bp.industry,
             COALESCE(ut.broadcasts_used, 0) as broadcasts_used,
             COALESCE(ut.ai_tokens_used, 0) as ai_tokens_used
      FROM users u
      LEFT JOIN business_profiles bp ON u.id = bp.user_id
      LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.month = TO_CHAR(NOW(), 'YYYY-MM')
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR bp.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    if (plan) {
      query += ` AND u.plan = $${paramIndex}`;
      params.push(plan);
      paramIndex++;
    }
    
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const usersResult = await pool.query(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM users u
      LEFT JOIN business_profiles bp ON u.id = bp.user_id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;
    
    if (search) {
      countQuery += ` AND (u.email ILIKE $${countParamIndex} OR bp.name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    if (role) {
      countQuery += ` AND u.role = $${countParamIndex}`;
      countParams.push(role);
      countParamIndex++;
    }
    
    if (plan) {
      countQuery += ` AND u.plan = $${countParamIndex}`;
      countParams.push(plan);
      countParamIndex++;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const userResult = await pool.query(`
      SELECT u.*, bp.name as business_name, bp.city, bp.industry, bp.tone, bp.default_cta,
             COALESCE(ut.broadcasts_used, 0) as broadcasts_used,
             COALESCE(ut.ai_tokens_used, 0) as ai_tokens_used
      FROM users u
      LEFT JOIN business_profiles bp ON u.id = bp.user_id
      LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.month = TO_CHAR(NOW(), 'YYYY-MM')
      WHERE u.id = $1
    `, [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(userResult.rows[0]);
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', [
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'user']),
  body('plan').optional().isIn(['free', 'pro', 'authority']),
  body('monthlyLimit').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean()
], authenticateToken, requireAdmin, validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, plan, monthlyLimit, isActive } = req.body;
    
    // Check if user exists
    const existingResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const existingUser = existingResult.rows[0];
    
    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (email !== undefined && email !== existingUser.email) {
      // Check if email is already used
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    
    if (plan !== undefined) {
      updates.push(`plan = $${paramIndex++}`);
      values.push(plan);
      
      // Update monthly limit based on plan if not specified
      if (monthlyLimit === undefined) {
        const planLimits = {
          free: parseInt(process.env.FREE_PLAN_LIMIT) || 10,
          pro: parseInt(process.env.PRO_PLAN_LIMIT) || 100,
          authority: parseInt(process.env.AUTHORITY_PLAN_LIMIT) || 1000
        };
        updates.push(`monthly_limit = $${paramIndex++}`);
        values.push(planLimits[plan]);
      }
    }
    
    if (monthlyLimit !== undefined) {
      updates.push(`monthly_limit = $${paramIndex++}`);
      values.push(monthlyLimit);
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [req.user.userId, 'UPDATE_USER', 'user', id, JSON.stringify({ email, role, plan, monthlyLimit, isActive }), req.ip, req.get('User-Agent')]);
    
    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hard delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const existingResult = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userEmail = existingResult.rows[0].email;
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Delete all related records
      await pool.query('DELETE FROM audit_log WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM ai_token_usage WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM usage_tracking WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM api_keys WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM content_templates WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM broadcast_wall_updates WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM website_posts WHERE user_id = $1', [id]);
      
      // Delete broadcast outputs and broadcasts
      await pool.query('DELETE FROM broadcast_outputs WHERE broadcast_id IN (SELECT id FROM broadcasts WHERE user_id = $1)', [id]);
      await pool.query('DELETE FROM broadcasts WHERE user_id = $1', [id]);
      
      // Delete business profile
      await pool.query('DELETE FROM business_profiles WHERE user_id = $1', [id]);
      
      // Delete sessions
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      
      // Finally delete user
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      
      await pool.query('COMMIT');
      
      // Log audit (before user deletion)
      await pool.query(`
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [req.user.userId, 'DELETE_USER', 'user', id, JSON.stringify({ email: userEmail }), req.ip, req.get('User-Agent')]);
      
      res.json({
        message: 'User and all related data deleted successfully',
        email: userEmail
      });
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (admin only)
router.post('/', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'user']),
  body('plan').isIn(['free', 'pro', 'authority']),
  body('monthlyLimit').optional().isInt({ min: 0 })
], authenticateToken, requireAdmin, validateRequest, async (req, res) => {
  try {
    const { email, password, role, plan, monthlyLimit } = req.body;
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
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
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, role, plan, monthly_limit, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW()) 
      RETURNING id, email, role, plan, monthly_limit, created_at
    `, [email, passwordHash, role, plan, monthlyLimit || planLimits[plan]]);
    
    const user = result.rows[0];
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [user.id, 'CREATE_USER', 'user', JSON.stringify({ email, role, plan }), req.ip, req.get('User-Agent')]);
    
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
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics (admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
        COUNT(CASE WHEN plan = 'free' THEN 1 END) as free_users,
        COUNT(CASE WHEN plan = 'pro' THEN 1 END) as pro_users,
        COUNT(CASE WHEN plan = 'authority' THEN 1 END) as authority_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d,
        COUNT(CASE WHEN last_login >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d
      FROM users
    `);
    
    const usageResult = await pool.query(`
      SELECT 
        SUM(broadcasts_used) as total_broadcasts,
        SUM(ai_tokens_used) as total_tokens,
        COUNT(DISTINCT user_id) as active_this_month
      FROM usage_tracking 
      WHERE month = TO_CHAR(NOW(), 'YYYY-MM')
    `);
    
    const planUsageResult = await pool.query(`
      SELECT 
        u.plan,
        COUNT(*) as user_count,
        COALESCE(AVG(ut.broadcasts_used), 0) as avg_broadcasts,
        COALESCE(SUM(ut.broadcasts_used), 0) as total_broadcasts
      FROM users u
      LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.month = TO_CHAR(NOW(), 'YYYY-MM')
      GROUP BY u.plan
    `);
    
    res.json({
      overview: statsResult.rows[0],
      currentMonthUsage: usageResult.rows[0],
      planUsage: planUsageResult.rows
    });
    
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update business profile
router.put('/:id/profile', [
  body('name').optional().notEmpty().trim(),
  body('city').optional().notEmpty().trim(),
  body('industry').optional().trim(),
  body('tone').optional().isIn(['professional', 'casual', 'friendly', 'formal']),
  body('defaultCta').optional().trim(),
  body('websiteUrl').optional().isURL(),
  body('phone').optional().trim(),
  body('description').optional().trim()
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Users can only update their own profile, admins can update any
    if (userId !== id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, city, industry, tone, defaultCta, websiteUrl, phone, description } = req.body;
    
    // Check if user exists
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(city);
    }
    
    if (industry !== undefined) {
      updates.push(`industry = $${paramIndex++}`);
      values.push(industry);
    }
    
    if (tone !== undefined) {
      updates.push(`tone = $${paramIndex++}`);
      values.push(tone);
    }
    
    if (defaultCta !== undefined) {
      updates.push(`default_cta = $${paramIndex++}`);
      values.push(defaultCta);
    }
    
    if (websiteUrl !== undefined) {
      updates.push(`website_url = $${paramIndex++}`);
      values.push(websiteUrl);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    
    updates.push(`updated_at = NOW()`);
    
    // Upsert business profile
    const upsertQuery = `
      INSERT INTO business_profiles (user_id, ${updates.join(', ')}, created_at)
      VALUES ($1, ${updates.map((_, i) => `$${i + 2}`).join(', ')}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET ${updates.map((update, i) => `${update} = EXCLUDED.${update}`).join(', ')}, updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pool.query(upsertQuery, [id, ...values]);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'UPDATE_BUSINESS_PROFILE', 'business_profile', id, JSON.stringify({ name, city, industry }), req.ip, req.get('User-Agent')]);
    
    res.json({
      message: 'Business profile updated successfully',
      profile: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update business profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
