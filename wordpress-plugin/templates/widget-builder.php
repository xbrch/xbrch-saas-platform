<?php
/**
 * XBRCH Widget Builder Page Template
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$settings = get_option('xbrch_widgets_settings');
?>

<div class="wrap xbrch-admin-wrapper">
    <h1>🔧 Widget Builder</h1>
    <p>Create custom embed codes for your XBRCH widgets</p>
    
    <div class="xbrch-tabs">
        <button class="xbrch-tab active" data-target="broadcast-wall-tab">📺 Broadcast Wall</button>
        <button class="xbrch-tab" data-target="updates-feed-tab">📝 Updates Feed</button>
        <button class="xbrch-tab" data-target="products-showcase-tab">🛍️ Products Showcase</button>
        <button class="xbrch-tab" data-target="mini-dashboard-tab">📊 Mini Dashboard</button>
    </div>
    
    <!-- Broadcast Wall Tab -->
    <div id="broadcast-wall-tab" class="xbrch-tab-content active">
        <div class="xbrch-form">
            <h3>Broadcast Wall Widget</h3>
            <p>Display your latest updates and products in a beautiful wall layout.</p>
            
            <div class="xbrch-form-group">
                <label for="xbrch-user-id">User ID</label>
                <input type="text" id="xbrch-user-id" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['user_id']); ?>" 
                       placeholder="Your XBRCH User ID">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-width">Widget Width</label>
                <select id="xbrch-widget-width" class="xbrch-customize-input">
                    <option value="100%">Full Width</option>
                    <option value="800px">800px</option>
                    <option value="600px">600px</option>
                    <option value="400px">400px</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-theme">Theme Color</label>
                <input type="color" id="xbrch-widget-theme" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['default_theme']); ?>">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-header">Show Header</label>
                <select id="xbrch-widget-header" class="xbrch-customize-input">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-items">Items per Page</label>
                <select id="xbrch-widget-items" class="xbrch-customize-input">
                    <option value="6">6 items</option>
                    <option value="12">12 items</option>
                    <option value="24">24 items</option>
                    <option value="all">Show All</option>
                </select>
            </div>
        </div>
        
        <div class="xbrch-code-preview">
            <button class="xbrch-copy-button xbrch-copy-code">📋 Copy Code</button>
            <code id="xbrch-embed-code"></code>
        </div>
        
        <div class="xbrch-widget-preview">
            <h4>Live Preview</h4>
            <iframe id="xbrch-preview-frame" width="100%" height="400" frameborder="0"></iframe>
        </div>
    </div>
    
    <!-- Updates Feed Tab -->
    <div id="updates-feed-tab" class="xbrch-tab-content">
        <div class="xbrch-form">
            <h3>Updates Feed Widget</h3>
            <p>Show only your latest updates in a clean feed format.</p>
            
            <div class="xbrch-form-group">
                <label for="xbrch-user-id">User ID</label>
                <input type="text" id="xbrch-user-id" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['user_id']); ?>" 
                       placeholder="Your XBRCH User ID">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-width">Widget Width</label>
                <select id="xbrch-widget-width" class="xbrch-customize-input">
                    <option value="100%">Full Width</option>
                    <option value="800px">800px</option>
                    <option value="600px">600px</option>
                    <option value="400px">400px</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-theme">Theme Color</label>
                <input type="color" id="xbrch-widget-theme" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['default_theme']); ?>">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-header">Show Header</label>
                <select id="xbrch-widget-header" class="xbrch-customize-input">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-items">Items per Page</label>
                <select id="xbrch-widget-items" class="xbrch-customize-input">
                    <option value="5">5 items</option>
                    <option value="10">10 items</option>
                    <option value="15">15 items</option>
                    <option value="all">Show All</option>
                </select>
            </div>
        </div>
        
        <div class="xbrch-code-preview">
            <button class="xbrch-copy-button xbrch-copy-code">📋 Copy Code</button>
            <code id="xbrch-embed-code"></code>
        </div>
        
        <div class="xbrch-widget-preview">
            <h4>Live Preview</h4>
            <iframe id="xbrch-preview-frame" width="100%" height="400" frameborder="0"></iframe>
        </div>
    </div>
    
    <!-- Products Showcase Tab -->
    <div id="products-showcase-tab" class="xbrch-tab-content">
        <div class="xbrch-form">
            <h3>Products Showcase Widget</h3>
            <p>Display your products in an attractive grid layout.</p>
            
            <div class="xbrch-form-group">
                <label for="xbrch-user-id">User ID</label>
                <input type="text" id="xbrch-user-id" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['user_id']); ?>" 
                       placeholder="Your XBRCH User ID">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-width">Widget Width</label>
                <select id="xbrch-widget-width" class="xbrch-customize-input">
                    <option value="100%">Full Width</option>
                    <option value="800px">800px</option>
                    <option value="600px">600px</option>
                    <option value="400px">400px</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-theme">Theme Color</label>
                <input type="color" id="xbrch-widget-theme" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['default_theme']); ?>">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-header">Show Header</label>
                <select id="xbrch-widget-header" class="xbrch-customize-input">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-items">Items per Page</label>
                <select id="xbrch-widget-items" class="xbrch-customize-input">
                    <option value="6">6 items</option>
                    <option value="12">12 items</option>
                    <option value="18">18 items</option>
                    <option value="all">Show All</option>
                </select>
            </div>
        </div>
        
        <div class="xbrch-code-preview">
            <button class="xbrch-copy-button xbrch-copy-code">📋 Copy Code</button>
            <code id="xbrch-embed-code"></code>
        </div>
        
        <div class="xbrch-widget-preview">
            <h4>Live Preview</h4>
            <iframe id="xbrch-preview-frame" width="100%" height="400" frameborder="0"></iframe>
        </div>
    </div>
    
    <!-- Mini Dashboard Tab -->
    <div id="mini-dashboard-tab" class="xbrch-tab-content">
        <div class="xbrch-form">
            <h3>Mini Dashboard Widget</h3>
            <p>Show a compact dashboard with key metrics.</p>
            
            <div class="xbrch-form-group">
                <label for="xbrch-user-id">User ID</label>
                <input type="text" id="xbrch-user-id" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['user_id']); ?>" 
                       placeholder="Your XBRCH User ID">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-width">Widget Width</label>
                <select id="xbrch-widget-width" class="xbrch-customize-input">
                    <option value="100%">Full Width</option>
                    <option value="800px">800px</option>
                    <option value="600px">600px</option>
                    <option value="400px">400px</option>
                </select>
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-theme">Theme Color</label>
                <input type="color" id="xbrch-widget-theme" class="xbrch-customize-input" 
                       value="<?php echo esc_attr($settings['default_theme']); ?>">
            </div>
            
            <div class="xbrch-form-group">
                <label for="xbrch-widget-header">Show Header</label>
                <select id="xbrch-widget-header" class="xbrch-customize-input">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            </div>
        </div>
        
        <div class="xbrch-code-preview">
            <button class="xbrch-copy-button xbrch-copy-code">📋 Copy Code</button>
            <code id="xbrch-embed-code"></code>
        </div>
        
        <div class="xbrch-widget-preview">
            <h4>Live Preview</h4>
            <iframe id="xbrch-preview-frame" width="100%" height="400" frameborder="0"></iframe>
        </div>
    </div>
    
    <div class="xbrch-form">
        <h3>📋 Usage Instructions</h3>
        <div class="xbrch-form-group">
            <h4>Method 1: WordPress Widgets</h4>
            <ol>
                <li>Go to <strong>Appearance → Widgets</strong> in your WordPress admin</li>
                <li>Drag any XBRCH widget to your desired widget area</li>
                <li>Configure the widget settings and save</li>
            </ol>
        </div>
        
        <div class="xbrch-form-group">
            <h4>Method 2: Shortcodes</h4>
            <ol>
                <li>Copy the embed code from above</li>
                <li>Paste it into any post, page, or text widget</li>
                <li>The widget will automatically appear</li>
            </ol>
            
            <p><strong>Example Shortcode:</strong></p>
            <code>[xbrch_widget type="broadcast-wall" width="100%" theme="#3b82f6"]</code>
        </div>
        
        <div class="xbrch-form-group">
            <h4>Method 3: PHP Template</h4>
            <p>Add directly to your theme files:</p>
            <code>&lt;?php echo do_shortcode('[xbrch_widget type="broadcast-wall"]'); ?&gt;</code>
        </div>
    </div>
</div>
