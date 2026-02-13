const express = require('express');
const { Pool } = require('pg');
const { authenticateToken } = require('./auth');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get user analytics dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Get usage statistics
    const usageResult = await pool.query(`
      SELECT 
        broadcasts_used,
        website_posts_used,
        ai_tokens_used
      FROM usage_tracking 
      WHERE user_id = $1 AND month = $2
    `, [userId, currentMonth]);
    
    const usage = usageResult.rows[0] || { broadcasts_used: 0, website_posts_used: 0, ai_tokens_used: 0 };
    
    // Get user plan limits
    const userResult = await pool.query(
      'SELECT monthly_limit, plan FROM users WHERE id = $1',
      [userId]
    );
    
    const user = userResult.rows[0];
    
    // Get broadcast statistics
    const broadcastStats = await pool.query(`
      SELECT 
        COUNT(*) as total_broadcasts,
        AVG(score) as avg_score,
        COUNT(CASE WHEN score >= 80 THEN 1 END) as high_score_count,
        COUNT(CASE WHEN confidence_badge = 'Low' THEN 1 END) as low_risk_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
      FROM broadcasts 
      WHERE user_id = $1
    `, [userId]);
    
    // Get platform usage
    const platformStats = await pool.query(`
      SELECT 
        bo.platform,
        COUNT(*) as usage_count,
        AVG(bo.character_count) as avg_length
      FROM broadcast_outputs bo
      JOIN broadcasts b ON bo.broadcast_id = b.id
      WHERE b.user_id = $1
      GROUP BY bo.platform
      ORDER BY usage_count DESC
    `, [userId]);
    
    // Get website content stats
    const websiteStats = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(word_count) as total_words,
        AVG(word_count) as avg_words,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
      FROM website_posts 
      WHERE user_id = $1
      GROUP BY type
    `, [userId]);
    
    // Get wall update stats
    const wallStats = await pool.query(`
      SELECT 
        COUNT(*) as total_updates,
        SUM(view_count) as total_views,
        COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_images,
        COUNT(CASE WHEN link_url IS NOT NULL THEN 1 END) as with_links
      FROM broadcast_wall_updates 
      WHERE user_id = $1
    `, [userId]);
    
    // Get recent activity
    const recentActivity = await pool.query(`
      SELECT 
        'broadcast' as type,
        original_message as title,
        score,
        created_at
      FROM broadcasts 
      WHERE user_id = $1
      UNION ALL
      SELECT 
        'website_post' as type,
        title,
        word_count as score,
        created_at
      FROM website_posts 
      WHERE user_id = $1
      UNION ALL
      SELECT 
        'wall_update' as type,
        content as title,
        view_count as score,
        created_at
      FROM broadcast_wall_updates 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);
    
    res.json({
      usage: {
        broadcastsUsed: usage.broadcasts_used,
        websitePostsUsed: usage.website_posts_used,
        aiTokensUsed: usage.ai_tokens_used,
        monthlyLimit: user.monthly_limit,
        plan: user.plan,
        remaining: user.monthly_limit - usage.broadcasts_used
      },
      broadcastStats: broadcastStats.rows[0],
      platformStats: platformStats.rows,
      websiteStats: websiteStats.rows,
      wallStats: wallStats.rows[0],
      recentActivity: recentActivity.rows
    });
    
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get broadcast analytics
router.get('/broadcasts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || '30'; // days
    
    const broadcastAnalytics = await pool.query(`
      SELECT 
        DATE_TRUNC('day', b.created_at) as date,
        COUNT(*) as broadcast_count,
        AVG(b.score) as avg_score,
        COUNT(CASE WHEN b.confidence_badge = 'Low' THEN 1 END) as low_risk_count,
        COUNT(CASE WHEN b.confidence_badge = 'High Risk' THEN 1 END) as high_risk_count
      FROM broadcasts b
      WHERE b.user_id = $1 
        AND b.created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('day', b.created_at)
      ORDER BY date DESC
    `, [userId]);
    
    const platformPerformance = await pool.query(`
      SELECT 
        bo.platform,
        COUNT(*) as usage_count,
        AVG(bo.character_count) as avg_length,
        COUNT(CASE WHEN bo.published_at IS NOT NULL THEN 1 END) as published_count
      FROM broadcast_outputs bo
      JOIN broadcasts b ON bo.broadcast_id = b.id
      WHERE b.user_id = $1 
        AND b.created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY bo.platform
      ORDER BY usage_count DESC
    `, [userId]);
    
    const scoreDistribution = await pool.query(`
      SELECT 
        CASE 
          WHEN score >= 90 THEN '90-100'
          WHEN score >= 80 THEN '80-89'
          WHEN score >= 70 THEN '70-79'
          WHEN score >= 60 THEN '60-69'
          ELSE '0-59'
        END as score_range,
        COUNT(*) as count
      FROM broadcasts 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY score_range
      ORDER BY score_range DESC
    `, [userId]);
    
    res.json({
      dailyAnalytics: broadcastAnalytics.rows,
      platformPerformance: platformPerformance.rows,
      scoreDistribution: scoreDistribution.rows
    });
    
  } catch (error) {
    console.error('Broadcast analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website content analytics
router.get('/website', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || '30'; // days
    
    const contentAnalytics = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        type,
        COUNT(*) as content_count,
        SUM(word_count) as total_words,
        AVG(word_count) as avg_words,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
      FROM website_posts 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('day', created_at), type
      ORDER BY date DESC, type
    `, [userId]);
    
    const contentTypeStats = await pool.query(`
      SELECT 
        type,
        COUNT(*) as total_count,
        SUM(word_count) as total_words,
        AVG(word_count) as avg_words,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN published_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recently_published
      FROM website_posts 
      WHERE user_id = $1
      GROUP BY type
    `, [userId]);
    
    const topPerforming = await pool.query(`
      SELECT 
        title,
        type,
        word_count,
        published_at,
        CASE 
          WHEN published_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - published_at)) / 86400
          ELSE NULL
        END as days_since_publish
      FROM website_posts 
      WHERE user_id = $1 AND status = 'published'
      ORDER BY published_at DESC
      LIMIT 10
    `, [userId]);
    
    res.json({
      dailyAnalytics: contentAnalytics.rows,
      contentTypeStats: contentTypeStats.rows,
      topPerforming: topPerforming.rows
    });
    
  } catch (error) {
    console.error('Website analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get broadcast wall analytics
router.get('/wall', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || '30'; // days
    
    const wallAnalytics = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as update_count,
        SUM(view_count) as daily_views,
        COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_images,
        COUNT(CASE WHEN link_url IS NOT NULL THEN 1 END) as with_links
      FROM broadcast_wall_updates 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `, [userId]);
    
    const engagementStats = await pool.query(`
      SELECT 
        COUNT(*) as total_updates,
        SUM(view_count) as total_views,
        AVG(view_count) as avg_views_per_update,
        COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_images,
        COUNT(CASE WHEN link_url IS NOT NULL THEN 1 END) as with_links,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_updates
      FROM broadcast_wall_updates 
      WHERE user_id = $1
    `, [userId]);
    
    const topUpdates = await pool.query(`
      SELECT 
        content,
        view_count,
        image_url,
        link_url,
        created_at
      FROM broadcast_wall_updates 
      WHERE user_id = $1 
      ORDER BY view_count DESC
      LIMIT 10
    `, [userId]);
    
    res.json({
      dailyAnalytics: wallAnalytics.rows,
      engagementStats: engagementStats.rows[0],
      topUpdates: topUpdates.rows
    });
    
  } catch (error) {
    console.error('Wall analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI token usage analytics
router.get('/tokens', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || '30'; // days
    
    const tokenUsage = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        operation_type,
        SUM(total_tokens) as daily_tokens,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        COUNT(*) as request_count
      FROM ai_token_usage 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('day', created_at), operation_type
      ORDER BY date DESC, operation_type
    `, [userId]);
    
    const operationStats = await pool.query(`
      SELECT 
        operation_type,
        COUNT(*) as request_count,
        SUM(total_tokens) as total_tokens,
        AVG(total_tokens) as avg_tokens_per_request,
        SUM(cost) as total_cost
      FROM ai_token_usage 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY operation_type
      ORDER BY total_tokens DESC
    `, [userId]);
    
    const costAnalysis = await pool.query(`
      SELECT 
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        AVG(total_tokens) as avg_tokens_per_request,
        COUNT(*) as total_requests
      FROM ai_token_usage 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
    `, [userId]);
    
    res.json({
      dailyUsage: tokenUsage.rows,
      operationStats: operationStats.rows,
      costAnalysis: costAnalysis.rows[0]
    });
    
  } catch (error) {
    console.error('Token analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin analytics (admin only)
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const period = req.query.period || '30'; // days
    
    // System overview
    const systemStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.created_at >= NOW() - INTERVAL '${period} days' THEN u.id END) as new_users,
        COUNT(DISTINCT CASE WHEN u.last_login >= NOW() - INTERVAL '7 days' THEN u.id END) as active_users,
        COUNT(b.id) as total_broadcasts,
        COUNT(wp.id) as total_website_posts,
        COUNT(bwu.id) as total_wall_updates,
        SUM(ut.broadcasts_used) as total_monthly_broadcasts,
        SUM(ut.ai_tokens_used) as total_monthly_tokens
      FROM users u
      LEFT JOIN broadcasts b ON u.id = b.user_id
      LEFT JOIN website_posts wp ON u.id = wp.user_id
      LEFT JOIN broadcast_wall_updates bwu ON u.id = bwu.user_id
      LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.month = TO_CHAR(NOW(), 'YYYY-MM')
    `);
    
    // Platform usage
    const platformUsage = await pool.query(`
      SELECT 
        bo.platform,
        COUNT(*) as usage_count,
        COUNT(DISTINCT b.user_id) as unique_users,
        AVG(bo.character_count) as avg_length
      FROM broadcast_outputs bo
      JOIN broadcasts b ON bo.broadcast_id = b.id
      WHERE b.created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY bo.platform
      ORDER BY usage_count DESC
    `);
    
    // Plan distribution
    const planDistribution = await pool.query(`
      SELECT 
        plan,
        COUNT(*) as user_count,
        COUNT(CASE WHEN last_login >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users,
        COALESCE(AVG(ut.broadcasts_used), 0) as avg_monthly_usage
      FROM users u
      LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.month = TO_CHAR(NOW(), 'YYYY-MM')
      GROUP BY plan
      ORDER BY user_count DESC
    `);
    
    // Content trends
    const contentTrends = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(CASE WHEN type = 'broadcast' THEN 1 END) as broadcasts,
        COUNT(CASE WHEN type = 'announcement' THEN 1 END) as announcements,
        COUNT(CASE WHEN type = 'blog' THEN 1 END) as blog_posts,
        COUNT(CASE WHEN type = 'wall_update' THEN 1 END) as wall_updates
      FROM (
        SELECT created_at, 'broadcast' as type FROM broadcasts
        UNION ALL
        SELECT created_at, 'announcement' as type FROM website_posts WHERE type = 'announcement'
        UNION ALL
        SELECT created_at, 'blog' as type FROM website_posts WHERE type = 'blog'
        UNION ALL
        SELECT created_at, 'wall_update' as type FROM broadcast_wall_updates
      ) content
      WHERE created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `);
    
    // Top users by usage
    const topUsers = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.plan,
        COALESCE(ut.broadcasts_used, 0) as monthly_broadcasts,
        COALESCE(ut.ai_tokens_used, 0) as monthly_tokens,
        COUNT(b.id) as total_broadcasts,
        AVG(b.score) as avg_score
      FROM users u
      LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.month = TO_CHAR(NOW(), 'YYYY-MM')
      LEFT JOIN broadcasts b ON u.id = b.user_id
      GROUP BY u.id, u.email, u.plan, ut.broadcasts_used, ut.ai_tokens_used
      ORDER BY monthly_broadcasts DESC
      LIMIT 20
    `);
    
    res.json({
      systemStats: systemStats.rows[0],
      platformUsage: platformUsage.rows,
      planDistribution: planDistribution.rows,
      contentTrends: contentTrends.rows,
      topUsers: topUsers.rows
    });
    
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export analytics data
router.get('/export/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.userId;
    const period = req.query.period || '30'; // days
    
    let data = [];
    let filename = '';
    
    switch (type) {
      case 'broadcasts':
        const broadcasts = await pool.query(`
          SELECT 
            b.id,
            b.original_message,
            b.score,
            b.confidence_badge,
            b.originality_score,
            b.status,
            b.created_at,
            bo.platform,
            bo.content,
            bo.character_count
          FROM broadcasts b
          LEFT JOIN broadcast_outputs bo ON b.id = bo.broadcast_id
          WHERE b.user_id = $1 
            AND b.created_at >= NOW() - INTERVAL '${period} days'
          ORDER BY b.created_at DESC
        `, [userId]);
        data = broadcasts.rows;
        filename = `broadcasts_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'website':
        const website = await pool.query(`
          SELECT 
            id,
            type,
            title,
            slug,
            status,
            word_count,
            published_at,
            created_at
          FROM website_posts 
          WHERE user_id = $1 
            AND created_at >= NOW() - INTERVAL '${period} days'
          ORDER BY created_at DESC
        `, [userId]);
        data = website.rows;
        filename = `website_content_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'wall':
        const wall = await pool.query(`
          SELECT 
            id,
            content,
            image_url,
            link_url,
            link_title,
            view_count,
            is_public,
            created_at
          FROM broadcast_wall_updates 
          WHERE user_id = $1 
            AND created_at >= NOW() - INTERVAL '${period} days'
          ORDER BY created_at DESC
        `, [userId]);
        data = wall.rows;
        filename = `wall_updates_${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }
    
    // Convert to CSV
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } else {
      res.status(404).json({ error: 'No data found for export' });
    }
    
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
