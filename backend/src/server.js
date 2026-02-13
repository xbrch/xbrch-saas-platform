const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const broadcastRoutes = require('./routes/broadcasts');
const websiteRoutes = require('./routes/website');
const wallRoutes = require('./routes/wall');
const analyticsRoutes = require('./routes/analytics');
const wordpressRoutes = require('./routes/wordpress');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/wall', wallRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/wordpress', wordpressRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Public broadcast wall (SEO-friendly, server-rendered)
app.get('/wall/:businessSlug', async (req, res) => {
  try {
    const { businessSlug } = req.params;
    
    // Get business info and updates
    const businessQuery = `
      SELECT bp.*, u.email 
      FROM business_profiles bp 
      JOIN users u ON bp.user_id = u.id 
      WHERE bp.name ILIKE $1 || '%'
    `;
    const businessResult = await pool.query(businessQuery, [businessSlug]);
    
    if (businessResult.rows.length === 0) {
      return res.status(404).send('Business not found');
    }
    
    const business = businessResult.rows[0];
    
    // Get updates
    const updatesQuery = `
      SELECT * FROM broadcast_wall_updates 
      WHERE user_id = $1 AND is_public = true 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    const updatesResult = await pool.query(updatesQuery, [business.user_id]);
    
    // Generate HTML (server-rendered for SEO)
    const html = generateWallHTML(business, updatesResult.rows);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Wall error:', error);
    res.status(500).send('Internal server error');
  }
});

// Generate SEO-friendly HTML for broadcast wall
function generateWallHTML(business, updates) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${business.name} - Updates | ${business.city}</title>
    <meta name="description" content="Latest updates from ${business.name} in ${business.city}">
    <meta property="og:title" content="${business.name} - Updates">
    <meta property="og:description" content="Latest updates from ${business.name} in ${business.city}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${req.protocol}://${req.get('host')}/wall/${businessSlug}">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "${business.name}",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "${business.city}"
      }
    }
    </script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .business-name { font-size: 2.5rem; color: #1e293b; margin-bottom: 10px; }
        .business-city { color: #64748b; font-size: 1.2rem; }
        .updates { margin-top: 40px; }
        .update { background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .update-content { font-size: 1.1rem; line-height: 1.6; margin-bottom: 15px; }
        .update-meta { color: #64748b; font-size: 0.9rem; }
        .update-image { max-width: 100%; border-radius: 8px; margin: 15px 0; }
        .update-link { color: #3b82f6; text-decoration: none; }
        .share-buttons { margin-top: 15px; }
        .share-btn { background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; margin-right: 10px; font-size: 0.9rem; }
        .embed-code { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 40px; font-family: monospace; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="business-name">${business.name}</h1>
            <p class="business-city">${business.city}</p>
        </div>
        
        <div class="updates">
            <h2>Latest Updates</h2>
            ${updates.map(update => `
                <div class="update">
                    <div class="update-content">${update.content}</div>
                    ${update.image_url ? `<img src="${update.image_url}" alt="Update image" class="update-image">` : ''}
                    ${update.link_url ? `<a href="${update.link_url}" class="update-link">${update.link_title || 'Learn more'}</a>` : ''}
                    <div class="update-meta">
                        Posted on ${new Date(update.created_at).toLocaleDateString()} • ${update.view_count} views
                    </div>
                    <div class="share-buttons">
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${req.protocol}://${req.get('host')}/wall/${businessSlug}#${update.id}`)}" class="share-btn">Share on Facebook</a>
                        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(update.content)}&url=${encodeURIComponent(`${req.protocol}://${req.get('host')}/wall/${businessSlug}#${update.id}`)}" class="share-btn">Share on X</a>
                        <a href="https://wa.me/?text=${encodeURIComponent(`${update.content} ${req.protocol}://${req.get('host')}/wall/${businessSlug}#${update.id}`)}" class="share-btn">Share on WhatsApp</a>
                        <button onclick="navigator.clipboard.writeText('${req.protocol}://${req.get('host')}/wall/${businessSlug}#${update.id}')" class="share-btn">Copy Link</button>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="embed-code">
            <h3>Embed This Wall</h3>
            <p>Copy this code to embed the broadcast wall on your website:</p>
            <code>&lt;iframe src="${req.protocol}://${req.get('host')}/wall/${businessSlug}" width="100%" height="600" frameborder="0"&gt;&lt;/iframe&gt;</code>
        </div>
    </div>
</body>
</html>`;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 XBRCH Broadcast Engine running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;
