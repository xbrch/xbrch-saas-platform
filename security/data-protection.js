/**
 * XBRCH Data Protection & Privacy Compliance
 * 
 * This file implements GDPR compliance features including data deletion,
 * data export, privacy settings, and consent management.
 */

// Data Protection Configuration
const XBRCH_PRIVACY = {
    // Data retention policies
    RETENTION: {
        INACTIVE_ACCOUNT: 365, // days
        DELETED_ACCOUNT: 30, // days before permanent deletion
        DATA_EXPORT_RETENTION: 7, // days for export links
        CONSENT_RETENTION: 2555 // days (maximum)
    },
    
    // Data categories
    DATA_CATEGORIES: {
        PERSONAL: ['email', 'name', 'phone', 'address'],
        BUSINESS: ['business_name', 'business_type', 'website', 'description'],
        CONTENT: ['updates', 'products', 'orders'],
        ACTIVITY: ['login_history', 'activity_log', 'session_data'],
        ANALYTICS: ['usage_stats', 'performance_metrics', 'engagement_data']
    },
    
    // GDPR compliance
    GDPR: {
        LEGAL_BASES: ['legitimate_interest', 'contractual_necessity', 'consent', 'legal_obligation'],
        RIGHTS: ['access', 'rectification', 'erasure', 'portability', 'objection', 'restriction'],
        CONSENT_TYPES: ['marketing', 'analytics', 'functional', 'third_party_sharing']
    }
};

// Data Protection Manager
class XBRCHDataProtection {
    constructor() {
        this.supabaseConfig = xbrchSecurity.getSupabaseConfig();
        this.supabase = window.supabase.createClient(this.supabaseConfig.url, this.supabaseConfig.anonKey);
    }
    
    // Get user's data for export
    async getUserData(userId) {
        try {
            const [profile, updates, products, orders] = await Promise.all([
                this.supabase
                    .from('business_profiles')
                    .select('*')
                    .eq('id', userId)
                    .single(),
                this.supabase
                    .from('web_updates')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', 'desc'),
                this.supabase
                    .from('shop_products')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', 'desc'),
                this.supabase
                    .from('shop_orders')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', 'desc')
            ]);
            
            return {
                profile: profile.data,
                updates: updates.data,
                products: products.data,
                orders: orders.data,
                exportDate: new Date().toISOString(),
                categories: this.categorizeData(profile.data, updates.data, products.data, orders.data)
            };
        } catch (error) {
            console.error('Error fetching user data:', error);
            throw new Error('Failed to retrieve user data');
        }
    }
    
    // Categorize data for GDPR compliance
    categorizeData(profile, updates, products, orders) {
        return {
            [XBRCH_PRIVACY.DATA_CATEGORIES.PERSONAL]: {
                email: profile.email,
                contact_name: profile.contact_name,
                phone: profile.phone
            },
            [XBRCH_PRIVACY.DATA_CATEGORIES.BUSINESS]: {
                business_name: profile.business_name,
                business_type: profile.business_type,
                website: profile.website,
                description: profile.description
            },
            [XBRCH_PRIVACY.DATA_CATEGORIES.CONTENT]: {
                updates_count: updates.length,
                products_count: products.length,
                orders_count: orders.length
            }
        };
    }
    
    // Export user data to JSON
    async exportUserData(userId) {
        try {
            const userData = await this.getUserData(userId);
            const exportData = {
                user_id: userId,
                export_date: userData.exportDate,
                data: userData,
                format: 'JSON',
                version: '1.0'
            };
            
            // Create downloadable file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `xbrch-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    }
    
    // Delete user account with confirmation
    async deleteAccount(userId, password, confirmation) {
        try {
            // Verify confirmation
            if (confirmation !== 'DELETE_MY_ACCOUNT') {
                throw new Error('Invalid confirmation phrase');
            }
            
            // Verify password
            const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
                email: (await this.supabase.from('business_profiles').select('email').eq('id', userId).single()).data.email,
                password: password
            });
            
            if (authError) {
                throw new Error('Invalid password for account deletion');
            }
            
            // Delete user data in stages
            await this.performAccountDeletion(userId);
            
            return true;
        } catch (error) {
            console.error('Account deletion error:', error);
            throw error;
        }
    }
    
    // Perform staged account deletion
    async performAccountDeletion(userId) {
        try {
            // Stage 1: Mark account for deletion
            await this.supabase
                .from('business_profiles')
                .update({ 
                    status: 'pending_deletion',
                    deletion_requested_at: new Date().toISOString(),
                    deletion_reason: 'user_request'
                })
                .eq('id', userId);
            
            // Stage 2: Anonymize personal data
            await this.anonymizeUserData(userId);
            
            // Stage 3: Delete content data
            await this.deleteUserContent(userId);
            
            // Stage 4: Delete profile (soft delete for recovery period)
            await this.supabase
                .from('business_profiles')
                .update({ 
                    status: 'deleted',
                    deleted_at: new Date().toISOString()
                })
                .eq('id', userId);
            
            // Schedule permanent deletion
            this.schedulePermanentDeletion(userId);
            
        } catch (error) {
            console.error('Deletion staging error:', error);
            throw error;
        }
    }
    
    // Anonymize user data
    async anonymizeUserData(userId) {
        try {
            const anonymizedData = {
                email: `deleted-${userId}@deleted.xbrch.local`,
                business_name: 'Deleted Account',
                contact_name: 'Deleted User',
                phone: null,
                website: null,
                description: 'Account deleted by user request'
            };
            
            await this.supabase
                .from('business_profiles')
                .update(anonymizedData)
                .eq('id', userId);
                
        } catch (error) {
            console.error('Anonymization error:', error);
            throw error;
        }
    }
    
    // Delete user content
    async deleteUserContent(userId) {
        try {
            // Delete updates
            await this.supabase
                .from('web_updates')
                .delete()
                .eq('user_id', userId);
            
            // Delete products
            await this.supabase
                .from('shop_products')
                .delete()
                .eq('user_id', userId);
            
            // Delete orders
            await this.supabase
                .from('shop_orders')
                .delete()
                .eq('user_id', userId);
            
        } catch (error) {
            console.error('Content deletion error:', error);
            throw error;
        }
    }
    
    // Schedule permanent deletion
    schedulePermanentDeletion(userId) {
        // This would typically be handled by a background job
        // For now, we'll store the deletion schedule
        const deletionDate = new Date(Date.now() + (XBRCH_PRIVACY.RETENTION.DELETED_ACCOUNT * 24 * 60 * 60 * 1000));
        
        localStorage.setItem(`deletion_schedule_${userId}`, deletionDate.toISOString());
    }
    
    // Get privacy settings
    async getPrivacySettings(userId) {
        try {
            const { data, error } = await this.supabase
                .from('privacy_settings')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code === 'PGRST116') {
                // No privacy settings found, return defaults
                return this.getDefaultPrivacySettings();
            }
            
            return data || this.getDefaultPrivacySettings();
        } catch (error) {
            console.error('Error fetching privacy settings:', error);
            return this.getDefaultPrivacySettings();
        }
    }
    
    // Get default privacy settings
    getDefaultPrivacySettings() {
        return {
            data_processing: true,
            marketing_emails: true,
            analytics_tracking: true,
            third_party_sharing: false,
            data_retention: XBRCH_PRIVACY.RETENTION.INACTIVE_ACCOUNT,
            cookie_consent: false,
            last_updated: new Date().toISOString()
        };
    }
    
    // Update privacy settings
    async updatePrivacySettings(userId, settings) {
        try {
            const validatedSettings = {
                user_id: userId,
                ...settings,
                last_updated: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('privacy_settings')
                .upsert(validatedSettings)
                .select();
            
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error updating privacy settings:', error);
            throw error;
        }
    }
    
    // Check for scheduled deletions
    async checkScheduledDeletions() {
        try {
            const now = new Date();
            
            // This would typically be a background job
            // For demo purposes, we'll check localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('deletion_schedule_')) {
                    const userId = key.replace('deletion_schedule_', '');
                    const deletionDate = new Date(localStorage.getItem(key));
                    
                    if (now >= deletionDate) {
                        await this.performPermanentDeletion(userId);
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking scheduled deletions:', error);
        }
    }
    
    // Perform permanent deletion
    async performPermanentDeletion(userId) {
        try {
            // Delete from Supabase Auth
            const { error } = await this.supabase.auth.admin.deleteUser(userId);
            
            if (error) {
                console.error('Permanent deletion error:', error);
                return false;
            }
            
            // Log deletion
            await this.logDataDeletion(userId, 'permanent');
            
            return true;
        } catch (error) {
            console.error('Permanent deletion error:', error);
            return false;
        }
    }
    
    // Log data deletion for audit
    async logDataDeletion(userId, deletionType) {
        try {
            await this.supabase
                .from('data_deletion_log')
                .insert({
                    user_id: userId,
                    deletion_type: deletionType,
                    deleted_at: new Date().toISOString(),
                    ip_address: await this.getUserIP(),
                    user_agent: navigator.userAgent
                });
        } catch (error) {
            console.error('Error logging deletion:', error);
        }
    }
    
    // Get user IP for logging
    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }
    
    // Generate privacy report
    async generatePrivacyReport(userId) {
        try {
            const [settings, data] = await Promise.all([
                this.getPrivacySettings(userId),
                this.getUserData(userId)
            ]);
            
            return {
                user_id: userId,
                report_date: new Date().toISOString(),
                privacy_settings: settings,
                data_summary: {
                    personal_data_count: Object.keys(data.categories[XBRCH_PRIVACY.DATA_CATEGORIES.PERSONAL]).length,
                    business_data_count: Object.keys(data.categories[XBRCH_PRIVACY.DATA_CATEGORIES.BUSINESS]).length,
                    content_items_count: data.categories[XBRCH_PRIVACY.DATA_CATEGORIES.CONTENT].updates_count + 
                                       data.categories[XBRCH_PRIVACY.DATA_CATEGORIES.CONTENT].products_count + 
                                       data.categories[XBRCH_PRIVACY.DATA_CATEGORIES.CONTENT].orders_count
                },
                data_retention: settings.data_retention,
                gdpr_rights: XBRCH_PRIVACY.GDPR.RIGHTS,
                legal_bases: XBRCH_PRIVACY.GDPR.LEGAL_BASES
            };
        } catch (error) {
            console.error('Error generating privacy report:', error);
            throw error;
        }
    }
}

// Initialize data protection
let dataProtection;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof xbrchSecurity !== 'undefined') {
        dataProtection = new XBRCHDataProtection();
        
        // Check for scheduled deletions
        dataProtection.checkScheduledDeletions();
    }
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        XBRCHDataProtection,
        XBRCH_PRIVACY
    };
}
