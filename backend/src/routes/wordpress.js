const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware to validate WordPress API secret
const validateWordPressSecret = (req, res, next) => {
  const secret = req.headers['x-wp-secret'];
  if (!secret || secret !== process.env.WP_API_SECRET) {
    return res.status(401).json({ error: 'Invalid WordPress API secret' });
  }
  next();
};

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// WordPress authentication endpoint
router.post('/auth', [
  body('siteUrl').isURL(),
  body('apiKey').notEmpty()
], validateWordPressSecret, validateRequest, async (req, res) => {
  try {
    const { siteUrl, apiKey } = req.body;
    
    // Verify WordPress site (in production, this would make an actual API call)
    // For now, we'll simulate verification
    const isValidSite = siteUrl.includes('wordpress') || siteUrl.includes('wp');
    
    if (!isValidSite) {
      return res.status(400).json({ error: 'Invalid WordPress site URL' });
    }
    
    // Generate WordPress integration token
    const jwt = require('jsonwebtoken');
    const wpToken = jwt.sign(
      { 
        siteUrl, 
        apiKey: apiKey.substring(0, 8) + '***', // Partial key for security
        type: 'wordpress'
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      message: 'WordPress site authenticated successfully',
      wpToken,
      siteUrl
    });
    
  } catch (error) {
    console.error('WordPress auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create broadcast via WordPress
router.post('/broadcast', [
  body('message').notEmpty().trim(),
  body('platforms').isArray({ min: 1 }),
  body('platforms.*').isIn(['x', 'facebook', 'instagram', 'linkedin', 'whatsapp', 'sms']),
  body('wpToken').notEmpty()
], validateWordPressSecret, validateRequest, async (req, res) => {
  try {
    const { message, platforms, wpToken } = req.body;
    
    // Verify WordPress token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(wpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid WordPress token' });
    }
    
    if (decoded.type !== 'wordpress') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Get user associated with this WordPress site
    // In production, this would be stored in a wordpress_integrations table
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [decoded.siteUrl] // This is a simplified lookup
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found for this WordPress site' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Import broadcast creation logic
    const { checkUsageLimit, updateUsage, scoreContent, checkOriginality, generatePlatformContent } = require('./broadcasts');
    
    // Check usage limit
    const usage = await checkUsageLimit(userId);
    if (usage.remaining <= 0) {
      return res.status(429).json({ 
        error: 'Monthly limit reached',
        used: usage.used,
        limit: usage.limit
      });
    }
    
    // Get business profile
    const businessResult = await pool.query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [userId]
    );
    
    const businessProfile = businessResult.rows[0] || {
      name: 'Business',
      city: 'Unknown',
      industry: 'general',
      tone: 'professional'
    };
    
    // Score original content
    const scoring = await scoreContent(message, platforms[0], businessProfile);
    
    // Check originality
    const originality = await checkOriginality(message, userId);
    
    // Create broadcast record
    const broadcastResult = await pool.query(`
      INSERT INTO broadcasts (user_id, original_message, score, confidence_badge, originality_score, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'generated', NOW())
      RETURNING *
    `, [userId, message, scoring.score, originality.riskTier, originality.originalityScore]);
    
    const broadcast = broadcastResult.rows[0];
    
    // Generate platform-specific content
    const outputs = [];
    let totalTokens = 0;
    
    for (const platform of platforms) {
      const platformContent = await generatePlatformContent(message, platform, businessProfile);
      
      const outputResult = await pool.query(`
        INSERT INTO broadcast_outputs (broadcast_id, platform, content, character_count, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [broadcast.id, platform, platformContent, platformContent.length]);
      
      outputs.push(outputResult.rows[0]);
      totalTokens += 100; // Estimate tokens used
    }
    
    // Update usage tracking
    await updateUsage(userId, totalTokens);
    
    res.status(201).json({
      message: 'Broadcast created successfully via WordPress',
      broadcast: {
        id: broadcast.id,
        originalMessage: broadcast.original_message,
        score: broadcast.score,
        confidenceBadge: broadcast.confidence_badge,
        originalityScore: broadcast.originality_score,
        createdAt: broadcast.created_at
      },
      outputs: outputs.map(output => ({
        id: output.id,
        platform: output.platform,
        content: output.content,
        characterCount: output.character_count
      })),
      scoring,
      originality,
      usage: {
        used: usage.used + 1,
        limit: usage.limit,
        remaining: usage.remaining - 1
      }
    });
    
  } catch (error) {
    console.error('WordPress broadcast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create announcement via WordPress
router.post('/announcement', [
  body('message').notEmpty().trim(),
  body('publishImmediately').optional().isBoolean(),
  body('wpToken').notEmpty()
], validateWordPressSecret, validateRequest, async (req, res) => {
  try {
    const { message, publishImmediately, wpToken } = req.body;
    
    // Verify WordPress token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(wpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid WordPress token' });
    }
    
    // Get user
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [decoded.siteUrl]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found for this WordPress site' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Import website routes logic
    const { generateAnnouncement } = require('./website');
    
    // Get business profile
    const businessResult = await pool.query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [userId]
    );
    
    const businessProfile = businessResult.rows[0] || {
      name: 'Business',
      city: 'Unknown',
      industry: 'general',
      tone: 'professional'
    };
    
    // Generate announcement
    const announcement = await generateAnnouncement(message, businessProfile);
    
    // Create slug
    const slug = announcement.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
    
    // Create website post
    const result = await pool.query(`
      INSERT INTO website_posts (user_id, type, title, content, slug, meta_description, meta_keywords, status, word_count, created_at)
      VALUES ($1, 'announcement', $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `, [
      userId,
      announcement.title,
      `<p>${announcement.content}</p>`,
      slug,
      announcement.metaDescription,
      announcement.metaKeywords,
      publishImmediately ? 'published' : 'draft',
      announcement.content.split(' ').length
    ]);
    
    const post = result.rows[0];
    
    res.status(201).json({
      message: 'Announcement created successfully via WordPress',
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        slug: post.slug,
        status: post.status,
        wordCount: post.word_count,
        createdAt: post.created_at
      }
    });
    
  } catch (error) {
    console.error('WordPress announcement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create blog post via WordPress
router.post('/blog', [
  body('topic').notEmpty().trim(),
  body('publishImmediately').optional().isBoolean(),
  body('wpToken').notEmpty()
], validateWordPressSecret, validateRequest, async (req, res) => {
  try {
    const { topic, publishImmediately, wpToken } = req.body;
    
    // Verify WordPress token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(wpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid WordPress token' });
    }
    
    // Get user
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [decoded.siteUrl]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found for this WordPress site' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Import website routes logic
    const { generateBlogPost } = require('./website');
    
    // Get business profile
    const businessResult = await pool.query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [userId]
    );
    
    const businessProfile = businessResult.rows[0] || {
      name: 'Business',
      city: 'Unknown',
      industry: 'general',
      tone: 'professional'
    };
    
    // Generate blog post
    const blogContent = await generateBlogPost(topic, businessProfile);
    
    // Extract meta information
    const metaMatch = blogContent.match(/<!-- META:Description:(.*?)-->/);
    const keywordsMatch = blogContent.match(/<!-- META:Keywords:(.*?)-->/);
    
    const metaDescription = metaMatch ? metaMatch[1] : `Learn about ${topic} from ${businessProfile.name}`;
    const metaKeywords = keywordsMatch ? keywordsMatch[1] : `${topic}, ${businessProfile.city}, ${businessProfile.industry}`;
    
    // Extract title
    const titleMatch = blogContent.match(/<h1>(.*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1] : topic;
    
    // Clean content
    const { marked } = require('marked');
    const DOMPurify = require('dompurify');
    const { JSDOM } = require('jsdom');
    const window = new JSDOM('').window;
    const purify = DOMPurify(window);
    
    const cleanContent = purify.sanitize(
      blogContent.replace(/<!-- META:.*?-->/g, '')
    );
    
    // Create slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
    
    // Count words
    const textContent = cleanContent.replace(/<[^>]*>/g, '');
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    
    // Create website post
    const result = await pool.query(`
      INSERT INTO website_posts (user_id, type, title, content, slug, meta_description, meta_keywords, status, word_count, created_at)
      VALUES ($1, 'blog', $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `, [
      userId,
      title,
      cleanContent,
      slug,
      metaDescription,
      metaKeywords,
      publishImmediately ? 'published' : 'draft',
      wordCount
    ]);
    
    const post = result.rows[0];
    
    res.status(201).json({
      message: 'Blog post created successfully via WordPress',
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        slug: post.slug,
        status: post.status,
        wordCount: post.word_count,
        metaDescription: post.meta_description,
        metaKeywords: post.meta_keywords,
        createdAt: post.created_at
      }
    });
    
  } catch (error) {
    console.error('WordPress blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create wall update via WordPress
router.post('/wall-update', [
  body('content').notEmpty().trim().isLength({ max: 300 }),
  body('imageUrl').optional().isURL(),
  body('linkUrl').optional().isURL(),
  body('linkTitle').optional().trim(),
  body('wpToken').notEmpty()
], validateWordPressSecret, validateRequest, async (req, res) => {
  try {
    const { content, imageUrl, linkUrl, linkTitle, wpToken } = req.body;
    
    // Verify WordPress token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(wpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid WordPress token' });
    }
    
    // Get user
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [decoded.siteUrl]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found for this WordPress site' });
    }
    
    const userId = userResult.rows[0].id;
    
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
    `, [userId, content, imageUrl, linkUrl, linkTitle, slug, true]);
    
    const update = result.rows[0];
    
    res.status(201).json({
      message: 'Wall update created successfully via WordPress',
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
    console.error('WordPress wall update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get WordPress integration status
router.get('/status', validateWordPressSecret, async (req, res) => {
  try {
    const wpToken = req.headers['x-wp-token'];
    
    if (!wpToken) {
      return res.status(400).json({ error: 'WordPress token required' });
    }
    
    // Verify WordPress token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(wpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid WordPress token' });
    }
    
    // Get user stats
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [decoded.siteUrl]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found for this WordPress site' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get usage stats
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageResult = await pool.query(
      'SELECT broadcasts_used, website_posts_used FROM usage_tracking WHERE user_id = $1 AND month = $2',
      [userId, currentMonth]
    );
    
    const usage = usageResult.rows[0] || { broadcasts_used: 0, website_posts_used: 0 };
    
    res.json({
      status: 'connected',
      siteUrl: decoded.siteUrl,
      usage: {
        broadcastsUsed: usage.broadcasts_used,
        websitePostsUsed: usage.website_posts_used
      }
    });
    
  } catch (error) {
    console.error('WordPress status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get WordPress plugin configuration
router.get('/config', validateWordPressSecret, async (req, res) => {
  try {
    res.json({
      plugin: {
        name: 'XBRCH Broadcast Engine',
        version: '1.0.0',
        description: 'Professional social media and website content management',
        features: [
          'Social media broadcasting',
          'Website announcements',
          'Blog post generation',
          'Broadcast wall management',
          'AI-powered content optimization'
        ],
        supportedPlatforms: ['x', 'facebook', 'instagram', 'linkedin', 'whatsapp', 'sms'],
        apiEndpoint: process.env.BASE_URL || 'http://localhost:3000/api/wordpress',
        documentation: 'https://docs.xbrch.com/wordpress'
      }
    });
    
  } catch (error) {
    console.error('WordPress config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
