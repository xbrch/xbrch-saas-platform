<?php
/**
 * XBRCH Widgets Settings Page Template
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$settings = get_option('xbrch_widgets_settings');
?>

<div class="wrap xbrch-admin-wrapper">
    <h1>⚙️ XBRCH Settings</h1>
    
    <form id="xbrch-settings-form">
        <div class="xbrch-form">
            <h3>Account Settings</h3>
            
            <div class="xbrch-form-group">
                <label for="xbrch-user-id">User ID</label>
                <input type="text" id="xbrch-user-id" name="user_id" 
                       value="<?php echo esc_attr($settings['user_id']); ?>" 
                       class="regular-text">
                <p class="description">Your unique XBRCH user ID. Find this in your XBRCH dashboard.</p>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-api-key">API Key</label>
                <input type="text" id="xbrch-api-key" name="api_key" 
                       value="<?php echo esc_attr($settings['api_key']); ?>" 
                       class="regular-text">
                <p class="description">Your XBRCH API key for secure communication.</p>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-business-name">Business Name</label>
                <input type="text" id="xbrch-business-name" name="business_name" 
                       value="<?php echo esc_attr($settings['business_name']); ?>" 
                       class="regular-text">
                <p class="description">Your business name for display purposes.</p>
            </div>
        </div>
        
        <div class="xbrch-form">
            <h3>Default Widget Settings</h3>
            
            <div class="xbrch-form-group">
                <label for="xbrch-default-widget">Default Widget Type</label>
                <select id="xbrch-default-widget" name="default_widget">
                    <option value="broadcast-wall" <?php selected($settings['default_widget'], 'broadcast-wall'); ?>>
                        Broadcast Wall
                    </option>
                    <option value="updates-feed" <?php selected($settings['default_widget'], 'updates-feed'); ?>>
                        Updates Feed
                    </option>
                    <option value="products-showcase" <?php selected($settings['default_widget'], 'products-showcase'); ?>>
                        Products Showcase
                    </option>
                    <option value="mini-dashboard" <?php selected($settings['default_widget'], 'mini-dashboard'); ?>>
                        Mini Dashboard
                    </option>
                </select>
                <p class="description">Default widget type for new installations.</p>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-default-theme">Default Theme Color</label>
                <input type="color" id="xbrch-default-theme" name="default_theme" 
                       value="<?php echo esc_attr($settings['default_theme']); ?>" 
                       class="small-text">
                <p class="description">Default color scheme for widgets.</p>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-default-width">Default Width</label>
                <select id="xbrch-default-width" name="default_width">
                    <option value="100%" <?php selected($settings['default_width'], '100%'); ?>>
                        Full Width
                    </option>
                    <option value="800px" <?php selected($settings['default_width'], '800px'); ?>>
                        800px
                    </option>
                    <option value="600px" <?php selected($settings['default_width'], '600px'); ?>>
                        600px
                    </option>
                    <option value="400px" <?php selected($settings['default_width'], '400px'); ?>>
                        400px
                    </option>
                </select>
                <p class="description">Default width for widgets.</p>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-show-header">Show Header by Default</label>
                <select id="xbrch-show-header" name="show_header">
                    <option value="true" <?php selected($settings['show_header'], 'true'); ?>>
                        Yes
                    </option>
                    <option value="false" <?php selected($settings['show_header'], 'false'); ?>>
                        No
                    </option>
                </select>
                <p class="description">Whether to show widget headers by default.</p>
            </div>
        </div>
        
        <div class="xbrch-form-group">
            <button type="submit" class="xbrch-button">Save Settings</button>
        </div>
    </form>
</div>
