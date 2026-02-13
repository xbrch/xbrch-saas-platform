const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const OpenAI = require('openai');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Check user's monthly usage limit
const checkUsageLimit = async (userId) => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const result = await pool.query(
    'SELECT broadcasts_used FROM usage_tracking WHERE user_id = $1 AND month = $2',
    [userId, currentMonth]
  );
  
  const usage = result.rows[0]?.broadcasts_used || 0;
  
  // Get user's plan limit
  const userResult = await pool.query(
    'SELECT monthly_limit FROM users WHERE id = $1',
    [userId]
  );
  
  const limit = userResult.rows[0]?.monthly_limit || 10;
  
  return { used: usage, limit, remaining: limit - usage };
};

// Update usage tracking
const updateUsage = async (userId, tokensUsed = 0) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  await pool.query(`
    INSERT INTO usage_tracking (user_id, month, broadcasts_used, ai_tokens_used, created_at, updated_at)
    VALUES ($1, $2, 1, $3, NOW(), NOW())
    ON CONFLICT (user_id, month)
    DO UPDATE SET 
      broadcasts_used = usage_tracking.broadcasts_used + 1,
      ai_tokens_used = usage_tracking.ai_tokens_used + $3,
      updated_at = NOW()
  `, [userId, currentMonth, tokensUsed]);
};

// Content scoring engine
const scoreContent = async (content, platform, businessProfile) => {
  const scoringPrompt = `
    Score the following social media content on a scale of 0-100 for ${platform} platform.
    
    Business: ${businessProfile.name} in ${businessProfile.city}
    Industry: ${businessProfile.industry || 'general'}
    Tone: ${businessProfile.tone || 'professional'}
    
    Content: "${content}"
    
    Score based on:
    - Clarity (30%): How clear and understandable is the message?
    - Platform fit (25%): How well does it fit ${platform} best practices?
    - Specificity (20%): How specific and detailed is the content?
    - CTA strength (15%): How strong is the call to action?
    - Brand alignment (10%): How well does it align with the business?
    
    Respond with JSON:
    {
      "score": 85,
      "clarity": 25,
      "platformFit": 22,
      "specificity": 18,
      "ctaStrength": 14,
      "brandAlignment": 9,
      "feedback": "Strong message with clear CTA"
    }
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: scoringPrompt }],
      temperature: 0.3,
      max_tokens: 200,
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Scoring error:', error);
    // Fallback scoring
    return {
      score: 75,
      clarity: 22,
      platformFit: 19,
      specificity: 15,
      ctaStrength: 11,
      brandAlignment: 8,
      feedback: 'Auto-scored due to AI error'
    };
  }
};

// Originality check engine
const checkOriginality = async (content, userId) => {
  // Get user's previous content for comparison
  const previousContent = await pool.query(
    'SELECT original_message FROM broadcasts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
    [userId]
  );
  
  const previousTexts = previousContent.rows.map(row => row.original_message).join('\n');
  
  const originalityPrompt = `
    Analyze the originality of this content compared to previous content.
    
    New content: "${content}"
    
    Previous content samples:
    ${previousTexts}
    
    Check for:
    - Repetitive phrases and clichés
    - Generic marketing language
    - Similarity to previous content
    - Unique value proposition
    
    Respond with JSON:
    {
      "originalityScore": 85,
      "riskTier": "Low",
      "issues": [],
      "suggestions": ["Add specific examples", "Include unique business details"]
    }
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: originalityPrompt }],
      temperature: 0.2,
      max_tokens: 200,
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Originality check error:', error);
    // Fallback originality
    return {
      originalityScore: 70,
      riskTier: 'Minor',
      issues: ['Unable to perform full originality check'],
      suggestions: ['Review for uniqueness']
    };
  }
};

// Generate platform-specific content
const generatePlatformContent = async (baseMessage, platform, businessProfile) => {
  const platformPrompts = {
    x: `Generate a Twitter/X post (max 280 characters) that is concise, engaging, and includes relevant hashtags. Business: ${businessProfile.name} in ${businessProfile.city}.`,
    facebook: `Generate a Facebook post that is conversational, includes a clear call-to-action, and encourages engagement. Business: ${businessProfile.name} in ${businessProfile.city}.`,
    instagram: `Generate an Instagram caption that is visual-focused, includes emojis naturally, and encourages sharing. Business: ${businessProfile.name} in ${businessProfile.city}.`,
    linkedin: `Generate a LinkedIn post that is professional, includes industry insights, and positions the business as an expert. Business: ${businessProfile.name} in ${businessProfile.city}.`,
    whatsapp: `Generate a WhatsApp message that is personal, direct, and includes contact information. Business: ${businessProfile.name} in ${businessProfile.city}.`,
    sms: `Generate an SMS message that is concise, includes essential info, and has a clear call-to-action. Business: ${businessProfile.name} in ${businessProfile.city}.`
  };
  
  const prompt = `${platformPrompts[platform]}
  
  Original message: "${baseMessage}"
  
  Requirements:
  - Include the business location (${businessProfile.city}) naturally
  - Match the platform's tone and style
  - Include relevant hashtags where appropriate
  - Add a call-to-action that fits the platform
  - Keep within character limits
  
  Respond with only the optimized content, no explanations.`;
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Content generation error:', error);
    return baseMessage; // Fallback to original message
  }
};

// Create broadcast
router.post('/create', [
  body('message').notEmpty().trim(),
  body('platforms').isArray({ min: 1 }),
  body('platforms.*').isIn(['x', 'facebook', 'instagram', 'linkedin', 'whatsapp', 'sms'])
], authenticateToken, validateRequest, async (req, res) => {
  try {
    const { message, platforms } = req.body;
    const userId = req.user.userId;
    
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
    
    // Log AI token usage
    await pool.query(`
      INSERT INTO ai_token_usage (user_id, model, prompt_tokens, completion_tokens, total_tokens, operation_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, process.env.OPENAI_MODEL, totalTokens * 0.7, totalTokens * 0.3, totalTokens, 'broadcast']);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [userId, 'CREATE_BROADCAST', 'broadcast', broadcast.id, JSON.stringify({ platforms, score: scoring.score }), req.ip, req.get('User-Agent')]);
    
    res.status(201).json({
      message: 'Broadcast created successfully',
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
    console.error('Create broadcast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's broadcasts
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const broadcastsResult = await pool.query(`
      SELECT b.*, 
             json_agg(
               json_build_object(
                 'platform', bo.platform,
                 'content', bo.content,
                 'characterCount', bo.character_count,
                 'publishedAt', bo.published_at
               )
             ) as outputs
      FROM broadcasts b
      LEFT JOIN broadcast_outputs bo ON b.id = bo.broadcast_id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM broadcasts WHERE user_id = $1',
      [userId]
    );
    
    res.json({
      broadcasts: broadcastsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get broadcasts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single broadcast
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const broadcastResult = await pool.query(`
      SELECT b.*, 
             json_agg(
               json_build_object(
                 'platform', bo.platform,
                 'content', bo.content,
                 'characterCount', bo.character_count,
                 'publishedAt', bo.published_at,
                 'platformPostId', bo.platform_post_id,
                 'engagementStats', bo.engagement_stats
               )
             ) as outputs
      FROM broadcasts b
      LEFT JOIN broadcast_outputs bo ON b.id = bo.broadcast_id
      WHERE b.id = $1 AND b.user_id = $2
      GROUP BY b.id
    `, [id, userId]);
    
    if (broadcastResult.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }
    
    res.json(broadcastResult.rows[0]);
    
  } catch (error) {
    console.error('Get broadcast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete broadcast
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Check ownership
    const broadcastResult = await pool.query(
      'SELECT id FROM broadcasts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (broadcastResult.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }
    
    // Delete broadcast (cascade will delete outputs)
    await pool.query('DELETE FROM broadcasts WHERE id = $1 AND user_id = $2', [id, userId]);
    
    // Log audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [userId, 'DELETE_BROADCAST', 'broadcast', id, req.ip, req.get('User-Agent')]);
    
    res.json({ message: 'Broadcast deleted successfully' });
    
  } catch (error) {
    console.error('Delete broadcast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get usage statistics
router.get('/usage/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const usageResult = await pool.query(
      'SELECT * FROM usage_tracking WHERE user_id = $1 AND month = $2',
      [userId, currentMonth]
    );
    
    const userResult = await pool.query(
      'SELECT monthly_limit, plan FROM users WHERE id = $1',
      [userId]
    );
    
    const usage = usageResult.rows[0] || { broadcasts_used: 0, ai_tokens_used: 0 };
    const user = userResult.rows[0];
    
    res.json({
      currentMonth,
      broadcastsUsed: usage.broadcasts_used,
      aiTokensUsed: usage.ai_tokens_used,
      monthlyLimit: user.monthly_limit,
      plan: user.plan,
      remaining: user.monthly_limit - usage.broadcasts_used
    });
    
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
