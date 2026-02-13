# XBRCH Broadcast Engine

Professional Social & Website Broadcast Engine for Local Businesses

## 🚀 Overview

XBRCH is a production-ready SaaS platform that enables local businesses to write one marketing message and generate optimized content for multiple social platforms, website announcements, SEO blog posts, and maintain a public broadcast wall.

## ✨ Key Features

### 📱 Social Broadcasting
- **Multi-Platform Support**: X, Facebook, Instagram, LinkedIn, WhatsApp, SMS
- **AI-Powered Optimization**: Platform-specific content generation
- **Content Scoring**: 0-100 quality scoring system
- **Originality Engine**: Separate risk assessment for content uniqueness
- **Usage Tracking**: Monthly limits and analytics

### 🌐 Website Content
- **Announcements**: Professional website updates with SEO optimization
- **Blog Posts**: 800-1200 word SEO-friendly articles
- **Server-Rendered**: SEO-safe HTML output
- **Meta Tags**: Complete Open Graph and schema.org support

### 📢 Broadcast Wall
- **Public Feed**: Embeddable content wall for websites
- **SEO Optimized**: Server-rendered HTML with proper meta tags
- **Multiple Embed Options**: iframe, script, WordPress shortcode
- **Engagement Tracking**: Views and interaction analytics

### 📊 Analytics & Management
- **Comprehensive Dashboard**: Usage, performance, and engagement metrics
- **Admin Controls**: User management, plan assignment, usage monitoring
- **WordPress Plugin**: Native WordPress integration
- **API-First**: RESTful API for all operations

## 🏗️ Architecture

### Backend (Node.js/Express)
- **REST API**: Secure, rate-limited endpoints
- **PostgreSQL**: Production-grade database
- **OpenAI Integration**: AI-powered content generation
- **JWT Authentication**: Secure user sessions
- **Role-Based Access**: Admin/User permissions

### Frontend (React/HTML)
- **Professional UI**: Clean, business-friendly interface
- **Responsive Design**: Mobile-optimized experience
- **Real-time Updates**: Live status and notifications
- **No AI Jargon**: User-friendly terminology

### Database Schema
- **Users & Authentication**: Secure user management
- **Content Management**: Broadcasts, posts, wall updates
- **Analytics & Usage**: Comprehensive tracking
- **Audit Logging**: Complete activity history

## 📦 Installation

### Backend Setup

1. **Clone Repository**
```bash
git clone https://github.com/xbrch/xbrch-saas-platform.git
cd xbrch-saas-platform/backend
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database Setup**
```bash
npm run migrate
```

5. **Start Server**
```bash
npm run dev  # Development
npm start    # Production
```

### WordPress Plugin

1. **Copy Plugin Files**
```bash
cp -r wordpress-plugin /path/to/wordpress/wp-content/plugins/xbrch-broadcast-engine
```

2. **Activate Plugin**
- Navigate to WordPress Admin → Plugins
- Activate "XBRCH Broadcast Engine"

3. **Configure Settings**
- Go to XBRCH → Settings
- Enter your API credentials

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/xbrch_db

# JWT
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# Server
PORT=3000
NODE_ENV=production

# Usage Limits
FREE_PLAN_LIMIT=10
PRO_PLAN_LIMIT=100
AUTHORITY_PLAN_LIMIT=1000
```

### Database Setup

The system uses PostgreSQL with the following main tables:
- `users` - User accounts and authentication
- `business_profiles` - Business information
- `broadcasts` - Social media broadcasts
- `broadcast_outputs` - Platform-specific content
- `website_posts` - Website content (announcements, blogs)
- `broadcast_wall_updates` - Public wall updates
- `usage_tracking` - Monthly usage monitoring
- `audit_log` - Activity logging

## 📚 API Documentation

### Authentication

All API endpoints require JWT authentication:

```http
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Create Broadcast
```http
POST /api/broadcasts/create
Content-Type: application/json

{
  "message": "Your marketing message",
  "platforms": ["x", "facebook", "instagram"]
}
```

#### Create Website Announcement
```http
POST /api/website/announcement
Content-Type: application/json

{
  "message": "Announcement content",
  "publishImmediately": true
}
```

#### Create Blog Post
```http
POST /api/website/blog
Content-Type: application/json

{
  "topic": "Your blog topic",
  "publishImmediately": false
}
```

#### Create Wall Update
```http
POST /api/wall/update
Content-Type: application/json

{
  "content": "Update content (max 300 chars)",
  "imageUrl": "https://example.com/image.jpg",
  "linkUrl": "https://example.com"
}
```

## 🎯 Usage Plans

### Free Plan
- 10 broadcasts per month
- Basic analytics
- Public broadcast wall
- WordPress integration

### Pro Plan
- 100 broadcasts per month
- Advanced analytics
- Priority support
- Custom branding options

### Authority Plan
- 1000 broadcasts per month
- White-label options
- API access
- Dedicated support

## 🔒 Security Features

- **Secure Password Hashing**: bcrypt with 12 rounds
- **JWT Authentication**: Secure session management
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Comprehensive sanitization
- **CSRF Protection**: Cross-site request forgery prevention
- **SQL Injection Prevention**: Parameterized queries
- **Audit Logging**: Complete activity tracking

## 📈 Analytics & Reporting

### User Analytics
- Broadcast usage and performance
- Content scoring trends
- Platform engagement metrics
- AI token usage tracking

### Admin Analytics
- System-wide usage statistics
- User activity monitoring
- Revenue and plan distribution
- Content performance insights

## 🌍 WordPress Integration

### Features
- **Native wp-admin UI**: Seamless WordPress experience
- **Content Creation**: Direct broadcast and blog creation
- **Wall Management**: Embed and manage broadcast walls
- **Settings Management**: API configuration and authentication

### Shortcode Usage
```php
// Basic usage
echo do_shortcode('[xbrch_wall business="Your Business Name"]');

// With custom dimensions
echo do_shortcode('[xbrch_wall business="Your Business" width="100%" height="800"]');
```

## 🚀 Deployment

### Production Deployment

1. **Backend (Vercel/Railway/Fly)**
```bash
# Deploy to Vercel
vercel --prod

# Deploy to Railway
railway up

# Deploy to Fly
fly deploy
```

2. **Database (PostgreSQL)**
- Use managed PostgreSQL service
- Configure connection string
- Run migrations

3. **Environment Variables**
- Set all required environment variables
- Configure CORS origins
- Set up monitoring

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/auth.test.js
```

## 📝 Development

### Project Structure
```
backend/
├── src/
│   ├── routes/          # API endpoints
│   ├── database/        # Database schemas and migrations
│   └── server.js       # Main server file
├── tests/              # Test files
└── package.json

wordpress-plugin/
├── templates/          # Admin templates
├── assets/            # CSS and JS files
└── xbrch-broadcast-engine.php

admin-dashboard/       # Frontend admin interface
public/              # Public-facing pages
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Make your changes
4. Add tests
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Support

- **Documentation**: https://docs.xbrch.com
- **Support Email**: support@xbrch.com
- **GitHub Issues**: https://github.com/xbrch/xbrch-saas-platform/issues

## 🎉 Success Metrics

XBRCH helps local businesses:
- **Save Time**: Write once, publish everywhere
- **Improve Quality**: AI-powered content optimization
- **Increase Reach**: Multi-platform social media presence
- **Boost SEO**: Professional website content
- **Track Performance**: Comprehensive analytics
- **Scale Growth**: Usage-based pricing plans

---

**XBRCH Broadcast Engine** - Professional Social & Website Content Management for Local Businesses
