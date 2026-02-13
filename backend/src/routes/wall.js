const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
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

// Create broadcast wall update
router.post('/update', [
  body('content').notEmpty().trim().isLength({ max: 300 }),
  body('imageUrl').optional().isURL(),
  body('linkUrl').optional().isURL(),
  body('linkTitle').optional().trim(),
  body('isPublic').optional().isBoolean()
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { content, imageUrl, linkUrl, linkTitle, isPublic = true } = req.body;
    const userId = req.user.userId;
    
    // Get business name for slug generation
    const businessResult = await pool.query(`
      SELECT name FROM business_profiles WHERE user_id = $1
    `, [userId]);
    
    const businessName = businessResult.rows[0]?.name || 'business';
    
    // Generate unique slug
    const baseSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const slug = `${baseSlug}-${Date.now()}`;
    
    // Create broadcast wall update
    const result = await pool.query(`
      INSERT INTO broadcast_wall_updates (user_id, content, image_url, link_url, link_title, slug, is_public, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [userId, content, imageUrl, linkUrl, linkTitle, slug, isPublic]);
    
    const update = result.rows[0];
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'CREATE_WALL_UPDATE', 'broadcast_wall_update', update.id, JSON.stringify({ content, isPublic }), req.ip, req.get('User-Agent')]);
    
    res.status(201).json({
      message: 'Broadcast wall update created successfully',
      update: {
        id: update.id,
        content: update.content,
        imageUrl: update.image_url,
        linkUrl: update.link_url,
        linkTitle: update.link_title,
        slug: update.slug,
        isPublic: update.is_public,
        viewCount: update.view_count,
        createdAt: update.created_at
      }
    });
    
  } catch (error) {
    console.error('Create wall update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get broadcast wall updates
router.get('/updates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const updatesResult = await pool.query(`
      SELECT bwu.*, bp.name as business_name, bp.city
      FROM broadcast_wall_updates bwu
      LEFT JOIN business_profiles bp ON bwu.user_id = bp.user_id
      WHERE bwu.user_id = $1
      ORDER BY bwu.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM broadcast_wall_updates WHERE user_id = $1',
      [userId]
    );
    
    res.json({
      updates: updatesResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get wall updates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single broadcast wall update
router.get('/updates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT bwu.*, bp.name as business_name, bp.city
      FROM broadcast_wall_updates bwu
      LEFT JOIN business_profiles bp ON bwu.user_id = bp.user_id
      WHERE bwu.id = $1 AND bwu.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Update not found' });
    }
    
    // Increment view count
    await pool.query(
      'UPDATE broadcast_wall_updates SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Get wall update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update broadcast wall update
router.put('/updates/:id', [
  body('content').optional().notEmpty().trim().isLength({ max: 300 }),
  body('imageUrl').optional().isURL(),
  body('linkUrl').optional().isURL(),
  body('linkTitle').optional().trim(),
  body('isPublic').optional().isBoolean()
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { content, imageUrl, linkUrl, linkTitle, isPublic } = req.body;
    
    // Check ownership
    const existingResult = await pool.query(
      'SELECT id FROM broadcast_wall_updates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Update not found' });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(content);
    }
    
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(imageUrl);
    }
    
    if (linkUrl !== undefined) {
      updates.push(`link_url = $${paramIndex++}`);
      values.push(linkUrl);
    }
    
    if (linkTitle !== undefined) {
      updates.push(`link_title = $${paramIndex++}`);
      values.push(linkTitle);
    }
    
    if (isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(isPublic);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, userId);
    
    const updateQuery = `
      UPDATE broadcast_wall_updates 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'UPDATE_WALL_UPDATE', 'broadcast_wall_update', id, JSON.stringify({ content, isPublic }), req.ip, req.get('User-Agent')]);
    
    res.json({
      message: 'Update modified successfully',
      update: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update wall update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete broadcast wall update
router.delete('/updates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Check ownership
    const existingResult = await pool.query(
      'SELECT id FROM broadcast_wall_updates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Update not found' });
    }
    
    // Delete update
    await pool.query('DELETE FROM broadcast_wall_updates WHERE id = $1 AND user_id = $2', [id, userId]);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, 'DELETE_WALL_UPDATE', 'broadcast_wall_update', id, req.ip, req.get('User-Agent')]);
    
    res.json({ message: 'Update deleted successfully' });
    
  } catch (error) {
    console.error('Delete wall update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get embed code for broadcast wall
router.get('/embed-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get business profile for wall URL
    const businessResult = await pool.query(
      'SELECT name FROM business_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business profile not found' });
    }
    
    const businessName = businessResult.rows[0].name;
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    const embedCodes = {
      iframe: `<iframe src="${baseUrl}/wall/${slug}" width="100%" height="600" frameborder="0" scrolling="auto"></iframe>`,
      script: `<script src="${baseUrl}/embed/wall/${slug}" async></script>`,
      wordpress: `[xbrch_wall business="${slug}" width="100%" height="600"]`
    };
    
    res.json({
      wallUrl: `${baseUrl}/wall/${slug}`,
      embedCodes
    });
    
  } catch (error) {
    console.error('Get embed code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get wall statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_updates,
        SUM(view_count) as total_views,
        COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as updates_with_images,
        COUNT(CASE WHEN link_url IS NOT NULL THEN 1 END) as updates_with_links,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_updates
      FROM broadcast_wall_updates 
      WHERE user_id = $1
    `, [userId]);
    
    const engagementResult = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as updates,
        SUM(view_count) as views
      FROM broadcast_wall_updates 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `, [userId]);
    
    res.json({
      overview: statsResult.rows[0],
      dailyEngagement: engagementResult.rows
    });
    
  } catch (error) {
    console.error('Wall stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for wall embedding (no auth required)
router.get('/public/:businessSlug', async (req, res) => {
  try {
    const { businessSlug } = req.params;
    
    // Get business info
    const businessResult = await pool.query(`
      SELECT bp.*, u.email 
      FROM business_profiles bp 
      JOIN users u ON bp.user_id = u.id 
      WHERE LOWER(bp.name) LIKE LOWER($1) || '%'
    `, [businessSlug.replace(/-/g, ' ')]);
    
    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const business = businessResult.rows[0];
    
    // Get public updates
    const updatesResult = await pool.query(`
      SELECT * FROM broadcast_wall_updates 
      WHERE user_id = $1 AND is_public = true 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [business.user_id]);
    
    // Generate embed HTML
    const embedHTML = generateEmbedHTML(business, updatesResult.rows, req);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(embedHTML);
    
  } catch (error) {
    console.error('Public wall error:', error);
    res.status(500).send('Internal server error');
  }
});

// Generate embed HTML for wall
function generateEmbedHTML(business, updates, req) {
  const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${business.name} Updates</title>
    <meta property="og:title" content="${business.name} Updates">
    <meta property="og:description" content="Latest updates from ${business.name} in ${business.city}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${baseUrl}/wall/${businessSlug}">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 15px; 
            background: #f8fafc; 
            font-size: 14px;
        }
        .xbrch-wall { 
            max-width: 100%; 
            margin: 0 auto; 
        }
        .xbrch-header { 
            text-align: center; 
            margin-bottom: 20px; 
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
        }
        .xbrch-business-name { 
            font-size: 1.5rem; 
            color: #1e293b; 
            margin-bottom: 5px;
            font-weight: 600;
        }
        .xbrch-business-city { 
            color: #64748b; 
            font-size: 1rem;
        }
        .xbrch-updates { }
        .xbrch-update { 
            background: white; 
            padding: 15px; 
            border-radius: 8px; 
            margin-bottom: 15px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
        }
        .xbrch-update-content { 
            font-size: 14px;
            line-height: 1.5; 
            margin-bottom: 10px;
            color: #334155;
        }
        .xbrch-update-meta { 
            color: #64748b; 
            font-size: 12px;
            margin-top: 10px;
        }
        .xbrch-update-image { 
            max-width: 100%; 
            border-radius: 6px; 
            margin: 10px 0;
        }
        .xbrch-update-link { 
            color: #3b82f6; 
            text-decoration: none; 
            font-weight: 500;
        }
        .xbrch-update-link:hover {
            text-decoration: underline;
        }
        .xbrch-share { 
            margin-top: 10px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .xbrch-share-btn { 
            background: #3b82f6; 
            color: white; 
            padding: 6px 12px; 
            border-radius: 4px; 
            text-decoration: none; 
            font-size: 12px;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .xbrch-share-btn:hover {
            background: #2563eb;
        }
        .xbrch-footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #64748b;
        }
        .xbrch-footer a {
            color: #3b82f6;
            text-decoration: none;
        }
        @media (max-width: 640px) {
            body { padding: 10px; }
            .xbrch-update { padding: 12px; }
        }
    </style>
</head>
<body>
    <div class="xbrch-wall">
        <div class="xbrch-header">
            <div class="xbrch-business-name">${business.name}</div>
            <div class="xbrch-business-city">${business.city}</div>
        </div>
        
        <div class="xbrch-updates">
            ${updates.map(update => `
                <div class="xbrch-update" id="update-${update.id}">
                    <div class="xbrch-update-content">${update.content}</div>
                    ${update.image_url ? `<img src="${update.image_url}" alt="Update image" class="xbrch-update-image" loading="lazy">` : ''}
                    ${update.link_url ? `<a href="${update.link_url}" class="xbrch-update-link" target="_blank">${update.link_title || 'Learn more'}</a>` : ''}
                    <div class="xbrch-update-meta">
                        Posted ${new Date(update.created_at).toLocaleDateString()} • ${update.view_count} views
                    </div>
                    <div class="xbrch-share">
                        <button class="xbrch-share-btn" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${baseUrl}/wall/${businessSlug}#update-${update.id}`)}', '_blank')">Share</button>
                        <button class="xbrch-share-btn" onclick="window.open('https://twitter.com/intent/tweet?text=${encodeURIComponent(update.content)}&url=${encodeURIComponent(`${baseUrl}/wall/${businessSlug}#update-${update.id}`)}', '_blank')">Tweet</button>
                        <button class="xbrch-share-btn" onclick="window.open('https://wa.me/?text=${encodeURIComponent(`${update.content} ${baseUrl}/wall/${businessSlug}#update-${update.id}`)}', '_blank')">WhatsApp</button>
                        <button class="xbrch-share-btn" onclick="navigator.clipboard.writeText('${baseUrl}/wall/${businessSlug}#update-${update.id}'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 2000)">Copy</button>
                    </div>
                </div>
            `).join('')}
            
            ${updates.length === 0 ? '<div style="text-align: center; color: #64748b; padding: 40px;">No updates yet. Check back soon!</div>' : ''}
        </div>
        
        <div class="xbrch-footer">
            Powered by <a href="https://xbrch.com" target="_blank">XBRCH</a> • Professional Broadcast Engine
        </div>
    </div>
</body>
</html>`;
}

module.exports = router;
