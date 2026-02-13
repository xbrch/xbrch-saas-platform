/**
 * XBRCH Security Configuration
 * 
 * This file contains all security utilities and configuration
 * for the XBRCH multi-tenant platform.
 */

// Security Configuration
const XBRCH_SECURITY = {
    // Rate limiting configuration
    RATE_LIMIT: {
        MAX_ATTEMPTS: 5,
        LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
        ATTEMPT_CLEANUP: 60 * 60 * 1000 // 1 hour
    },
    
    // Password requirements
    PASSWORD: {
        MIN_LENGTH: 8,
        REQUIRE_UPPERCASE: true,
        REQUIRE_LOWERCASE: true,
        REQUIRE_NUMBERS: true,
        REQUIRE_SPECIAL: true,
        FORBIDDEN_PATTERNS: ['password', '123456', 'qwerty', 'admin']
    },
    
    // Session configuration
    SESSION: {
        TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
        RENEWAL_TIME: 30 * 60 * 1000, // 30 minutes
        COOKIE_NAME: 'xbrch_session',
        SECURE_COOKIES: true,
        HTTP_ONLY: true
    },
    
    // CSRF protection
    CSRF: {
        TOKEN_LENGTH: 32,
        TOKEN_EXPIRY: 2 * 60 * 60 * 1000 // 2 hours
    },
    
    // Input validation
    VALIDATION: {
        EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        BUSINESS_NAME_MIN: 2,
        BUSINESS_NAME_MAX: 100,
        DESCRIPTION_MAX: 1000,
        PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
        URL_REGEX: /^https?:\/\/.+\..+/,
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
        ALLOWED_FILE_TYPES: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
};

// Environment Configuration
class XBRCHConfig {
    constructor() {
        this.supabaseUrl = this.getEnvVar('SUPABASE_URL', 'https://pvmbxnflhcrdhcwvtdxc.supabase.co');
        this.supabaseAnonKey = this.getEnvVar('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bWJ4bmZsaGNyZGhjd3Z0ZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTY5NzQsImV4cCI6MjA4NTk5Mjk3NH0.GN4p_s8Cqod-K3S1lt_48oDZIhAroCLDrKDNs7DLjYg');
        this.environment = this.getEnvVar('NODE_ENV', 'development');
        this.isProduction = this.environment === 'production';
    }
    
    getEnvVar(name, defaultValue = '') {
        // Check for environment variable first
        if (typeof process !== 'undefined' && process.env && process.env[name]) {
            return process.env[name];
        }
        
        // Check for window environment (for client-side)
        if (typeof window !== 'undefined' && window.XBRCH_ENV && window.XBRCH_ENV[name]) {
            return window.XBRCH_ENV[name];
        }
        
        // Check for meta tag (for HTML files)
        if (typeof document !== 'undefined') {
            const meta = document.querySelector(`meta[name="xbrch-${name.toLowerCase()}"]`);
            if (meta) {
                return meta.getAttribute('content');
            }
        }
        
        return defaultValue;
    }
    
    getSupabaseConfig() {
        return {
            url: this.supabaseUrl,
            anonKey: this.supabaseAnonKey
        };
    }
}

// Input Validation and Sanitization
class XBRCHValidator {
    static sanitizeInput(input, type = 'text') {
        if (typeof input !== 'string') {
            return '';
        }
        
        // Basic XSS prevention
        let sanitized = input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        
        // Type-specific sanitization
        switch (type) {
            case 'email':
                return sanitized.toLowerCase();
            case 'text':
            case 'textarea':
                return sanitized.replace(/[<>]/g, '');
            case 'number':
                return sanitized.replace(/[^\d.-]/g, '');
            case 'url':
                return sanitized.replace(/[^\w\-._~:/?#[\]@!$&'()*+,;=%]/g, '');
            default:
                return sanitized;
        }
    }
    
    static validateEmail(email) {
        const sanitized = this.sanitizeInput(email, 'email');
        return XBRCH_SECURITY.VALIDATION.EMAIL_REGEX.test(sanitized) ? sanitized : null;
    }
    
    static validatePassword(password) {
        const sanitized = this.sanitizeInput(password);
        const errors = [];
        
        if (sanitized.length < XBRCH_SECURITY.PASSWORD.MIN_LENGTH) {
            errors.push(`Password must be at least ${XBRCH_SECURITY.PASSWORD.MIN_LENGTH} characters long`);
        }
        
        if (XBRCH_SECURITY.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(sanitized)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        
        if (XBRCH_SECURITY.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(sanitized)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        
        if (XBRCH_SECURITY.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(sanitized)) {
            errors.push('Password must contain at least one number');
        }
        
        if (XBRCH_SECURITY.PASSWORD.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(sanitized)) {
            errors.push('Password must contain at least one special character');
        }
        
        // Check for forbidden patterns
        const lowerPassword = sanitized.toLowerCase();
        for (const pattern of XBRCH_SECURITY.PASSWORD.FORBIDDEN_PATTERNS) {
            if (lowerPassword.includes(pattern)) {
                errors.push('Password cannot contain common or easily guessable patterns');
                break;
            }
        }
        
        return errors.length === 0 ? sanitized : { errors, password: sanitized };
    }
    
    static validateBusinessName(name) {
        const sanitized = this.sanitizeInput(name, 'text');
        const errors = [];
        
        if (sanitized.length < XBRCH_SECURITY.VALIDATION.BUSINESS_NAME_MIN) {
            errors.push('Business name is required');
        }
        
        if (sanitized.length > XBRCH_SECURITY.VALIDATION.BUSINESS_NAME_MAX) {
            errors.push(`Business name cannot exceed ${XBRCH_SECURITY.VALIDATION.BUSINESS_NAME_MAX} characters`);
        }
        
        return errors.length === 0 ? sanitized : { errors, name: sanitized };
    }
    
    static validatePhone(phone) {
        const sanitized = this.sanitizeInput(phone, 'text');
        return XBRCH_SECURITY.VALIDATION.PHONE_REGEX.test(sanitized) ? sanitized : null;
    }
    
    static validateUrl(url) {
        const sanitized = this.sanitizeInput(url, 'url');
        return XBRCH_SECURITY.VALIDATION.URL_REGEX.test(sanitized) ? sanitized : null;
    }
    
    static validateDescription(description) {
        const sanitized = this.sanitizeInput(description, 'textarea');
        if (sanitized.length > XBRCH_SECURITY.VALIDATION.DESCRIPTION_MAX) {
            return { 
                errors: [`Description cannot exceed ${XBRCH_SECURITY.VALIDATION.DESCRIPTION_MAX} characters`],
                description: sanitized.substring(0, XBRCH_SECURITY.VALIDATION.DESCRIPTION_MAX)
            };
        }
        return sanitized;
    }
}

// Rate Limiting
class XBRCHRateLimiter {
    constructor() {
        this.attempts = {};
        this.cleanup();
    }
    
    isAllowed(identifier) {
        const now = Date.now();
        const attempts = this.attempts[identifier] || [];
        
        // Remove old attempts
        const recentAttempts = attempts.filter(time => 
            now - time < XBRCH_SECURITY.RATE_LIMIT.ATTEMPT_CLEANUP
        );
        
        // Check if rate limited
        const lockoutAttempts = recentAttempts.filter(time => 
            now - time < XBRCH_SECURITY.RATE_LIMIT.LOCKOUT_TIME
        );
        
        if (lockoutAttempts.length >= XBRCH_SECURITY.RATE_LIMIT.MAX_ATTEMPTS) {
            const oldestAttempt = Math.min(...lockoutAttempts);
            const lockoutRemaining = XBRCH_SECURITY.RATE_LIMIT.LOCKOUT_TIME - (now - oldestAttempt);
            return {
                allowed: false,
                lockoutRemaining: Math.ceil(lockoutRemaining / 1000 / 60) // minutes
            };
        }
        
        // Record this attempt
        recentAttempts.push(now);
        this.attempts[identifier] = recentAttempts;
        
        return { allowed: true };
    }
    
    cleanup() {
        const now = Date.now();
        for (const identifier in this.attempts) {
            this.attempts[identifier] = this.attempts[identifier].filter(time => 
                now - time < XBRCH_SECURITY.RATE_LIMIT.ATTEMPT_CLEANUP
            );
            
            if (this.attempts[identifier].length === 0) {
                delete this.attempts[identifier];
            }
        }
    }
    
    reset(identifier) {
        delete this.attempts[identifier];
    }
}

// CSRF Protection
class XBRCHCSRFProtection {
    static generateToken() {
        const array = new Uint8Array(XBRCH_SECURITY.CSRF.TOKEN_LENGTH);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array));
    }
    
    static storeToken(token, formId) {
        const tokenData = {
            token: token,
            timestamp: Date.now(),
            formId: formId
        };
        localStorage.setItem(`xbrch_csrf_${formId}`, JSON.stringify(tokenData));
    }
    
    static validateToken(token, formId) {
        const storedData = localStorage.getItem(`xbrch_csrf_${formId}`);
        if (!storedData) return false;
        
        try {
            const tokenData = JSON.parse(storedData);
            const now = Date.now();
            
            // Check expiry
            if (now - tokenData.timestamp > XBRCH_SECURITY.CSRF.TOKEN_EXPIRY) {
                localStorage.removeItem(`xbrch_csrf_${formId}`);
                return false;
            }
            
            // Validate token
            return tokenData.token === token && tokenData.formId === formId;
        } catch (e) {
            return false;
        }
    }
    
    static cleanup() {
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('xbrch_csrf_')) {
                try {
                    const tokenData = JSON.parse(localStorage.getItem(key));
                    if (now - tokenData.timestamp > XBRCH_SECURITY.CSRF.TOKEN_EXPIRY) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    }
}

// Secure Session Management
class XBRCHSession {
    constructor() {
        this.config = XBRCH_SECURITY.SESSION;
        this.cleanup();
    }
    
    createSession(userData) {
        const sessionData = {
            id: this.generateSessionId(),
            userId: userData.id,
            email: userData.email,
            businessName: userData.businessName,
            role: userData.role || 'user',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + this.config.TIMEOUT
        };
        
        // Store in secure cookie if available, otherwise localStorage
        if (typeof document !== 'undefined') {
            document.cookie = `${this.config.COOKIE_NAME}=${JSON.stringify(sessionData)}; expires=${new Date(sessionData.expiresAt).toUTCString()}; path=/; ${this.config.SECURE_COOKIES ? 'secure;' : ''} ${this.config.HTTP_ONLY ? 'httpOnly;' : ''}`;
        } else {
            localStorage.setItem(this.config.COOKIE_NAME, JSON.stringify(sessionData));
        }
        
        return sessionData;
    }
    
    getSession() {
        let sessionData = null;
        
        // Try to get from cookie first
        if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === this.config.COOKIE_NAME) {
                    try {
                        sessionData = JSON.parse(decodeURIComponent(value));
                    } catch (e) {
                        sessionData = null;
                    }
                    break;
                }
            }
        }
        
        // Fallback to localStorage
        if (!sessionData && typeof localStorage !== 'undefined') {
            try {
                sessionData = JSON.parse(localStorage.getItem(this.config.COOKIE_NAME));
            } catch (e) {
                sessionData = null;
            }
        }
        
        // Validate session
        if (!sessionData || !this.isValidSession(sessionData)) {
            this.destroySession();
            return null;
        }
        
        // Update last activity
        sessionData.lastActivity = Date.now();
        this.updateSession(sessionData);
        
        return sessionData;
    }
    
    isValidSession(sessionData) {
        const now = Date.now();
        return sessionData && 
               sessionData.id && 
               sessionData.userId && 
               now < sessionData.expiresAt;
    }
    
    updateSession(sessionData) {
        // Extend session if within renewal time
        const now = Date.now();
        if (now - sessionData.lastActivity < this.config.RENEWAL_TIME) {
            sessionData.expiresAt = now + this.config.TIMEOUT;
            sessionData.lastActivity = now;
            
            if (typeof document !== 'undefined') {
                document.cookie = `${this.config.COOKIE_NAME}=${JSON.stringify(sessionData)}; expires=${new Date(sessionData.expiresAt).toUTCString()}; path=/; ${this.config.SECURE_COOKIES ? 'secure;' : ''} ${this.config.HTTP_ONLY ? 'httpOnly;' : ''}`;
            } else {
                localStorage.setItem(this.config.COOKIE_NAME, JSON.stringify(sessionData));
            }
        }
    }
    
    destroySession() {
        if (typeof document !== 'undefined') {
            document.cookie = `${this.config.COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.config.COOKIE_NAME);
        }
    }
    
    generateSessionId() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array));
    }
    
    cleanup() {
        // Clean up expired sessions
        this.getSession(); // This will clean up invalid sessions
        XBRCHCSRFProtection.cleanup();
    }
}

// Security Utilities
class XBRCHSecurity {
    constructor() {
        this.config = new XBRCHConfig();
        this.rateLimiter = new XBRCHRateLimiter();
        this.session = new XBRCHSession();
        this.validator = XBRCHValidator;
    }
    
    // Initialize security
    init() {
        this.session.cleanup();
        this.addSecurityHeaders();
        this.setupEventListeners();
    }
    
    // Add security headers
    addSecurityHeaders() {
        if (typeof document !== 'undefined') {
            // Add CSP meta tag
            const csp = document.createElement('meta');
            csp.httpEquiv = 'Content-Security-Policy';
            csp.content = "default-src 'self'; script-src 'self' 'unsafe-inline' https://pvmbxnflhcrdhcwvtdxc.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://pvmbxnflhcrdhcwvtdxc.supabase.co; frame-ancestors 'none';";
            document.head.appendChild(csp);
            
            // Add HSTS meta tag
            const hsts = document.createElement('meta');
            hsts.httpEquiv = 'Strict-Transport-Security';
            hsts.content = 'max-age=31536000; includeSubDomains; preload';
            document.head.appendChild(hsts);
        }
    }
    
    // Setup security event listeners
    setupEventListeners() {
        // Prevent right-click on sensitive elements
        if (typeof document !== 'undefined') {
            document.addEventListener('contextmenu', (e) => {
                if (e.target.closest('.sensitive-data')) {
                    e.preventDefault();
                }
            });
            
            // Prevent copy on sensitive elements
            document.addEventListener('copy', (e) => {
                if (e.target.closest('.sensitive-data')) {
                    e.preventDefault();
                }
            });
        }
    }
    
    // Validate form data
    validateForm(formData, formType) {
        const errors = {};
        const validated = {};
        
        for (const [key, value] of formData.entries()) {
            switch (key) {
                case 'email':
                    const email = this.validator.validateEmail(value);
                    if (email) {
                        validated[key] = email;
                    } else {
                        errors[key] = 'Please enter a valid email address';
                    }
                    break;
                    
                case 'password':
                    const password = this.validator.validatePassword(value);
                    if (typeof password === 'string') {
                        validated[key] = password;
                    } else {
                        errors[key] = password.errors.join(', ');
                    }
                    break;
                    
                case 'confirmPassword':
                    if (validated.password && value === validated.password) {
                        validated[key] = value;
                    } else {
                        errors[key] = 'Passwords do not match';
                    }
                    break;
                    
                case 'businessName':
                    const businessName = this.validator.validateBusinessName(value);
                    if (typeof businessName === 'string') {
                        validated[key] = businessName;
                    } else {
                        errors[key] = businessName.errors.join(', ');
                    }
                    break;
                    
                case 'phone':
                    const phone = this.validator.validatePhone(value);
                    if (phone || value === '') {
                        validated[key] = phone || '';
                    } else {
                        errors[key] = 'Please enter a valid phone number';
                    }
                    break;
                    
                case 'website':
                    const url = this.validator.validateUrl(value);
                    if (url || value === '') {
                        validated[key] = url || '';
                    } else {
                        errors[key] = 'Please enter a valid URL';
                    }
                    break;
                    
                case 'description':
                    const description = this.validator.validateDescription(value);
                    if (typeof description === 'string') {
                        validated[key] = description;
                    } else {
                        errors[key] = description.errors.join(', ');
                    }
                    break;
                    
                default:
                    validated[key] = this.validator.sanitizeInput(value);
            }
        }
        
        return { errors, validated };
    }
    
    // Check rate limit
    checkRateLimit(identifier) {
        return this.rateLimiter.isAllowed(identifier);
    }
    
    // Get current session
    getCurrentSession() {
        return this.session.getSession();
    }
    
    // Create session
    createSession(userData) {
        return this.session.createSession(userData);
    }
    
    // Destroy session
    logout() {
        this.session.destroySession();
        this.rateLimiter.reset('all');
    }
    
    // Get Supabase config
    getSupabaseConfig() {
        return this.config.getSupabaseConfig();
    }
}

// Global security instance
let xbrchSecurity;

// Initialize security when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        xbrchSecurity = new XBRCHSecurity();
        xbrchSecurity.init();
    });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        XBRCHSecurity,
        XBRCHValidator,
        XBRCHRateLimiter,
        XBRCHCSRFProtection,
        XBRCHSession,
        XBRCHConfig,
        XBRCH_SECURITY
    };
}
