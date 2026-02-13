<?php
/**
 * XBRCH Widgets Admin Page Template
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$settings = get_option('xbrch_widgets_settings');
$is_connected = !empty($settings['user_id']);
?>

<div class="wrap xbrch-admin-wrapper">
    <div class="xbrch-header">
        <h1>🚀 XBRCH Widgets</h1>
        <p>Embed beautiful business widgets on your WordPress site with ease</p>
    </div>
    
    <?php if ($is_connected): ?>
        <div class="xbrch-status connected">
            <strong>✅ Connected to XBRCH</strong><br>
            Business: <?php echo esc_html($settings['business_name']); ?>
        </div>
    <?php else: ?>
        <div class="xbrch-status not-connected">
            <strong>⚠️ Not Connected</strong><br>
            Please connect your XBRCH account to start using widgets.
        </div>
    <?php endif; ?>
    
    <div class="xbrch-cards">
        <div class="xbrch-card">
            <h3>📺 Broadcast Wall</h3>
            <p>Display your latest updates and products in a beautiful wall layout that engages your visitors.</p>
            <a href="<?php echo admin_url('admin.php?page=xbrch-widgets-builder'); ?>" class="xbrch-button">Use Widget</a>
        </div>
        
        <div class="xbrch-card">
            <h3>📝 Updates Feed</h3>
            <p>Show only your latest updates in a clean, professional feed format.</p>
            <a href="<?php echo admin_url('admin.php?page=xbrch-widgets-builder'); ?>" class="xbrch-button">Use Widget</a>
        </div>
        
        <div class="xbrch-card">
            <h3>🛍️ Products Showcase</h3>
            <p>Display your products in an attractive grid with pricing and purchase options.</p>
            <a href="<?php echo admin_url('admin.php?page=xbrch-widgets-builder'); ?>" class="xbrch-button">Use Widget</a>
        </div>
        
        <div class="xbrch-card">
            <h3>📊 Mini Dashboard</h3>
            <p>Show a compact dashboard with key metrics and recent activity.</p>
            <a href="<?php echo admin_url('admin.php?page=xbrch-widgets-builder'); ?>" class="xbrch-button">Use Widget</a>
        </div>
    </div>
    
    <?php if (!$is_connected): ?>
        <div class="xbrch-form">
            <h3>Connect Your XBRCH Account</h3>
            <form id="xbrch-connect-form">
                <div class="xbrch-form-group">
                    <label for="xbrch-email">Email Address</label>
                    <input type="email" id="xbrch-email" name="email" required>
                </div>
                
                <div class="xbrch-form-group">
                    <label for="xbrch-password">Password</label>
                    <input type="password" id="xbrch-password" name="password" required>
                </div>
                
                <div class="xbrch-form-group">
                    <button type="submit" class="xbrch-button">Connect Account</button>
                </div>
            </form>
        </div>
    <?php endif; ?>
    
    <div class="xbrch-form">
        <h3>Quick Start Guide</h3>
        <div class="xbrch-form-group">
            <ol>
                <li><strong>Connect your XBRCH account</strong> using the form above</li>
                <li><strong>Go to Appearance → Widgets</strong> in your WordPress admin</li>
                <li><strong>Add XBRCH widgets</strong> to any widget area</li>
                <li><strong>Customize appearance</strong> using the widget settings</li>
                <li><strong>Use shortcodes</strong> to embed widgets in posts/pages</li>
            </ol>
        </div>
    </div>
</div>
