const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const OpenAI = require('openai');
const { marked } = require('marked');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create DOMPurify instance
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Generate website announcement
const generateAnnouncement = async (message, businessProfile) => {
  const prompt = `
    Generate a professional website announcement based on this message.
    
    Business: ${businessProfile.name} in ${businessProfile.city}
    Industry: ${businessProfile.industry || 'general'}
    Tone: ${businessProfile.tone || 'professional'}
    
    Original message: "${message}"
    
    Requirements:
    - Title: Maximum 60 characters, compelling and SEO-friendly
    - Content: 2-3 paragraphs, professional tone
    - Include local SEO elements naturally
    - No emojis or casual language
    - Include a clear call-to-action
    - Meta description: 150-160 characters
    - Meta keywords: 5-7 relevant keywords
    
    Respond with JSON:
    {
      "title": "Professional Title Here",
      "content": "Professional announcement content with 2-3 paragraphs...",
      "metaDescription": "SEO-friendly meta description...",
      "metaKeywords": "keyword1, keyword2, keyword3",
      "cta": "Learn More"
    }
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Announcement generation error:', error);
    // Fallback
    return {
      title: 'Important Announcement',
      content: `<p>${message}</p>`,
      metaDescription: `Latest update from ${businessProfile.name}`,
      metaKeywords: 'announcement, update, news',
      cta: 'Learn More'
    };
  }
};

// Generate blog post
const generateBlogPost = async (topic, businessProfile) => {
  const prompt = `
    Generate a comprehensive blog post for a local business.
    
    Business: ${businessProfile.name} in ${businessProfile.city}
    Industry: ${businessProfile.industry || 'general'}
    Tone: ${businessProfile.tone || 'professional'}
    
    Topic: "${topic}"
    
    Requirements:
    - Length: 800-1200 words
    - Structure: H1 title, H2 sections, H3 subsections
    - Educational tone, not promotional
    - Include local context naturally
    - Add internal link placeholders: [Link: service-name]
    - Include long-tail keywords
    - SEO-optimized headings
    - No AI clichés or generic phrases
    - Natural, conversational style
    
    Respond with valid HTML:
    <h1>Main Title</h1>
    <h2>Section 1</h2>
    <p>Content...</p>
    <h3>Subsection</h3>
    <p>Content...</p>
    <h2>Section 2</h2>
    <p>Content...</p>
    
    Include meta description and keywords at the end in this format:
    <!-- META:Description:Your meta description here-->
    <!-- META:Keywords:keyword1, keyword2, keyword3-->
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 2000,
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Blog generation error:', error);
    // Fallback
    return `
      <h1>${topic}</h1>
      <h2>Introduction</h2>
      <p>Learn more about ${topic} from ${businessProfile.name} in ${businessProfile.city}.</p>
      <h2>Key Points</h2>
      <p>This topic is important for many reasons...</p>
      <!-- META:Description:Learn about ${topic} from ${businessProfile.name}-->
      <!-- META:Keywords:${topic}, ${businessProfile.city}, ${businessProfile.industry}-->
    `;
  }
};

// Create announcement
router.post('/announcement', [
  body('message').notEmpty().trim(),
  body('publishImmediately').optional().isBoolean()
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { message, publishImmediately } = req.body;
    const userId = req.user.userId;
    
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
    
    // Sanitize HTML content
    const cleanContent = purify.sanitize(`<p>${announcement.content}</p>`);
    
    // Create website post
    const result = await pool.query(`
      INSERT INTO website_posts (user_id, type, title, content, slug, meta_description, meta_keywords, status, word_count, created_at)
      VALUES ($1, 'announcement', $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `, [
      userId,
      announcement.title,
      cleanContent,
      slug,
      announcement.metaDescription,
      announcement.metaKeywords,
      publishImmediately ? 'published' : 'draft',
      announcement.content.split(' ').length
    ]);
    
    const post = result.rows[0];
    
    // Log AI token usage
    await pool.query(`
      INSERT INTO ai_token_usage (user_id, model, prompt_tokens, completion_tokens, total_tokens, operation_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, process.env.OPENAI_MODEL, 200, 300, 500, 'announcement']);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'CREATE_ANNOUNCEMENT', 'website_post', post.id, JSON.stringify({ title: announcement.title }), req.ip, req.get('User-Agent')]);
    
    res.status(201).json({
      message: 'Announcement created successfully',
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
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create blog post
router.post('/blog', [
  body('topic').notEmpty().trim(),
  body('publishImmediately').optional().isBoolean()
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { topic, publishImmediately } = req.body;
    const userId = req.user.userId;
    
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
    
    // Extract title (first H1)
    const titleMatch = blogContent.match(/<h1>(.*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1] : topic;
    
    // Clean content (remove meta tags)
    const cleanContent = purify.sanitize(
      blogContent.replace(/<!-- META:.*?-->/g, '')
    );
    
    // Create slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
    
    // Count words (strip HTML tags first)
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
    
    // Log AI token usage
    await pool.query(`
      INSERT INTO ai_token_usage (user_id, model, prompt_tokens, completion_tokens, total_tokens, operation_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, process.env.OPENAI_MODEL, 300, 1500, 1800, 'blog']);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'CREATE_BLOG', 'website_post', post.id, JSON.stringify({ title, wordCount }), req.ip, req.get('User-Agent')]);
    
    res.status(201).json({
      message: 'Blog post created successfully',
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        slug: post.slug,
        status: post.status,
        wordCount: post.wordCount,
        metaDescription: post.meta_description,
        metaKeywords: post.meta_keywords,
        createdAt: post.created_at
      }
    });
    
  } catch (error) {
    console.error('Create blog post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website posts
router.get('/posts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const type = req.query.type; // 'announcement', 'blog', or undefined for all
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT * FROM website_posts 
      WHERE user_id = $1
    `;
    let params = [userId];
    
    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const postsResult = await pool.query(query, params);
    
    // Get count
    let countQuery = 'SELECT COUNT(*) FROM website_posts WHERE user_id = $1';
    let countParams = [userId];
    
    if (type) {
      countQuery += ' AND type = $2';
      countParams.push(type);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      posts: postsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get website posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single website post
router.get('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT * FROM website_posts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Get website post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update website post
router.put('/posts/:id', [
  body('title').optional().notEmpty().trim(),
  body('content').optional().notEmpty().trim(),
  body('status').optional().isIn(['draft', 'published', 'archived'])
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { title, content, status } = req.body;
    
    // Check ownership
    const existingResult = await pool.query(
      'SELECT * FROM website_posts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    
    if (content !== undefined) {
      const cleanContent = purify.sanitize(content);
      updates.push(`content = $${paramIndex++}`);
      values.push(cleanContent);
      
      // Update word count
      const textContent = content.replace(/<[^>]*>/g, '');
      const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
      updates.push(`word_count = $${paramIndex++}`);
      values.push(wordCount);
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      
      if (status === 'published' && !existingResult.rows[0].published_at) {
        updates.push(`published_at = NOW()`);
      }
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, userId);
    
    const updateQuery = `
      UPDATE website_posts 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'UPDATE_WEBSITE_POST', 'website_post', id, JSON.stringify({ title, status }), req.ip, req.get('User-Agent')]);
    
    res.json({
      message: 'Post updated successfully',
      post: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update website post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete website post
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Check ownership
    const existingResult = await pool.query(
      'SELECT id FROM website_posts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Delete post
    await pool.query('DELETE FROM website_posts WHERE id = $1 AND user_id = $2', [id, userId]);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, 'DELETE_WEBSITE_POST', 'website_post', id, req.ip, req.get('User-Agent')]);
    
    res.json({ message: 'Post deleted successfully' });
    
  } catch (error) {
    console.error('Delete website post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website content statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const statsResult = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(word_count) as total_words,
        AVG(word_count) as avg_words
      FROM website_posts 
      WHERE user_id = $1
      GROUP BY type
    `, [userId]);
    
    const recentResult = await pool.query(`
      SELECT COUNT(*) as recent_posts
      FROM website_posts 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `, [userId]);
    
    res.json({
      byType: statsResult.rows,
      recentPosts: parseInt(recentResult.rows[0].recent_posts)
    });
    
  } catch (error) {
    console.error('Website stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
