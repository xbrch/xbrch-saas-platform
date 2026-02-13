/**
 * XBRCH Admin Dashboard Security
 * 
 * This file contains security middleware for the admin dashboard
 * including role-based access control and session validation.
 */

// Admin Dashboard Security
class XBRCHAdminSecurity {
    constructor() {
        this.roles = {
            'business_owner': {
                permissions: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'view_analytics'],
                label: 'Business Owner'
            },
            'admin': {
                permissions: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'view_analytics', 'system_admin'],
                label: 'Administrator'
            },
            'viewer': {
                permissions: ['read'],
                label: 'Viewer'
            }
        };
    }
    
    // Check if user is authenticated
    isAuthenticated() {
        const session = xbrchSecurity.getCurrentSession();
        return session && session.id && session.userId;
    }
    
    // Get current user role
    getCurrentUserRole() {
        const session = xbrchSecurity.getCurrentSession();
        return session ? session.role : null;
    }
    
    // Check if user has specific permission
    hasPermission(permission) {
        const userRole = this.getCurrentUserRole();
        if (!userRole) return false;
        
        const roleConfig = this.roles[userRole];
        return roleConfig && roleConfig.permissions.includes(permission);
    }
    
    // Check if user can access specific page
    canAccessPage(page) {
        const requiredPermissions = {
            'admin-dashboard.html': ['read'],
            'admin-updates.html': ['read', 'write'],
            'admin-products.html': ['read', 'write'],
            'admin-orders.html': ['read', 'write'],
            'admin-settings.html': ['manage_settings'],
            'admin-analytics.html': ['view_analytics'],
            'admin-embed.html': ['read', 'write']
        };
        
        const required = requiredPermissions[page];
        if (!required) return true; // Public pages
        
        return required.every(permission => this.hasPermission(permission));
    }
    
    // Redirect unauthorized users
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'admin-login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }
        return true;
    }
    
    // Require specific permission
    requirePermission(permission) {
        if (!this.requireAuth()) return false;
        
        if (!this.hasPermission(permission)) {
            this.showAccessDenied();
            return false;
        }
        return true;
    }
    
    // Show access denied message
    showAccessDenied() {
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px;">
                    <h1 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Access Denied</h1>
                    <p style="color: #64748b; margin-bottom: 1.5rem;">You don't have permission to access this page.</p>
                    <button onclick="window.location.href='admin-dashboard.html'" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        `;
    }
    
    // Get user info for display
    getUserInfo() {
        const session = xbrchSecurity.getCurrentSession();
        return session ? {
            id: session.id,
            email: session.email,
            businessName: session.businessName,
            role: session.role,
            roleLabel: this.roles[session.role]?.label || 'Unknown'
        } : null;
    }
    
    // Logout user
    logout() {
        xbrchSecurity.logout();
        window.location.href = 'admin-login.html';
    }
    
    // Add security headers to admin pages
    addSecurityHeaders() {
        // Add CSP meta tag for admin pages
        const csp = document.createElement('meta');
        csp.httpEquiv = 'Content-Security-Policy';
        csp.content = "default-src 'self'; script-src 'self' 'unsafe-inline' https://pvmbxnflhcrdhcwvtdxc.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://pvmbxnflhcrdhcwvtdxc.supabase.co; frame-ancestors 'none';";
        document.head.appendChild(csp);
        
        // Add no-index meta tag
        const noIndex = document.createElement('meta');
        noIndex.name = 'robots';
        noIndex.content = 'noindex, nofollow';
        document.head.appendChild(noIndex);
    }
}

// Initialize admin security
let adminSecurity;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for xbrchSecurity to be initialized
    if (typeof xbrchSecurity !== 'undefined') {
        adminSecurity = new XBRCHAdminSecurity();
        adminSecurity.addSecurityHeaders();
        
        // Check authentication for all admin pages
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'admin-login.html' && currentPage !== 'admin-registration.html') {
            adminSecurity.requireAuth();
        }
    }
});

// Export for use in admin pages
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XBRCHAdminSecurity;
}
