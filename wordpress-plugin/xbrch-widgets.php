<?php
/**
 * Plugin Name: XBRCH Business Widgets
 * Plugin URI: https://xbrch.com
 * Description: Embed XBRCH business widgets (updates, products, dashboard) in WordPress with ease
 * Version: 1.0.0
 * Author: XBRCH Team
 * Author URI: https://xbrch.com
 * License: GPL v2 or later
 * Text Domain: xbrch-widgets
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('XBRCH_VERSION', '1.0.0');
define('XBRCH_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('XBRCH_PLUGIN_URL', plugin_dir_url(__FILE__));
define('XBRCH_BASE_URL', 'https://pvmbxnflhcrdhcwvtdxc.supabase.co');

/**
 * Main XBRCH Widgets Plugin Class
 */
class XBRCH_Widgets_Plugin {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'admin_scripts'));
        add_action('wp_enqueue_scripts', array($this, 'frontend_scripts'));
        add_action('widgets_init', array($this, 'register_widgets'));
        add_shortcode('xbrch_widget', array($this, 'widget_shortcode'));
        add_action('wp_ajax_xbrch_save_settings', array($this, 'save_settings'));
        add_action('wp_ajax_nopriv_xbrch_save_settings', array($this, 'save_settings'));
        add_action('wp_ajax_xbrch_connect_account', array($this, 'connect_account'));
        add_action('wp_ajax_nopriv_xbrch_connect_account', array($this, 'connect_account'));
        
        // Load text domain
        add_action('plugins_loaded', array($this, 'load_textdomain'));
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Register activation hook
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Load text domain
     */
    public function load_textdomain() {
        load_plugin_textdomain(
            'xbrch-widgets',
            false,
            dirname(plugin_basename(__FILE__)) . '/languages'
        );
    }
    
    /**
     * Activate plugin
     */
    public function activate() {
        // Create default options
        $default_options = array(
            'user_id' => '',
            'api_key' => '',
            'business_name' => '',
            'default_widget' => 'broadcast-wall',
            'default_theme' => '#3b82f6',
            'default_width' => '100%',
            'show_header' => 'true'
        );
        
        add_option('xbrch_widgets_settings', $default_options);
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Deactivate plugin
     */
    public function deactivate() {
        // Clean up if needed
        flush_rewrite_rules();
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            __('XBRCH Widgets', 'xbrch-widgets'),
            __('XBRCH Widgets', 'xbrch-widgets'),
            'manage_options',
            'xbrch-widgets',
            array($this, 'admin_page'),
            'dashicons-businessman',
            30
        );
        
        add_submenu_page(
            'xbrch-widgets',
            __('Settings', 'xbrch-widgets'),
            __('Settings', 'xbrch-widgets'),
            'manage_options',
            'xbrch-widgets-settings',
            array($this, 'settings_page')
        );
        
        add_submenu_page(
            'xbrch-widgets',
            __('Widget Builder', 'xbrch-widgets'),
            __('Widget Builder', 'xbrch-widgets'),
            'manage_options',
            'xbrch-widgets-builder',
            array($this, 'widget_builder_page')
        );
    }
    
    /**
     * Enqueue admin scripts
     */
    public function admin_scripts($hook) {
        if (strpos($hook, 'xbrch-widgets') !== false) {
            wp_enqueue_style('xbrch-admin-css', XBRCH_PLUGIN_URL . 'assets/css/admin.css', array(), XBRCH_VERSION);
            wp_enqueue_script('xbrch-admin-js', XBRCH_PLUGIN_URL . 'assets/js/admin.js', array('jquery'), XBRCH_VERSION, true);
            
            wp_localize_script('xbrch-admin-js', 'xbrch_ajax', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('xbrch_nonce'),
                'plugin_url' => XBRCH_PLUGIN_URL,
                'strings' => array(
                    'connect_success' => __('Successfully connected to XBRCH!', 'xbrch-widgets'),
                    'connect_error' => __('Connection failed. Please check your credentials.', 'xbrch-widgets'),
                    'save_success' => __('Settings saved successfully!', 'xbrch-widgets'),
                    'copy_code' => __('Embed code copied to clipboard!', 'xbrch-widgets')
                )
            ));
        }
    }
    
    /**
     * Enqueue frontend scripts
     */
    public function frontend_scripts() {
        wp_enqueue_style('xbrch-frontend-css', XBRCH_PLUGIN_URL . 'assets/css/frontend.css', array(), XBRCH_VERSION);
        wp_enqueue_script('xbrch-frontend-js', XBRCH_PLUGIN_URL . 'assets/js/frontend.js', array('jquery'), XBRCH_VERSION, true);
    }
    
    /**
     * Register widgets
     */
    public function register_widgets() {
        register_widget('XBRCH_Broadcast_Widget');
        register_widget('XBRCH_Updates_Widget');
        register_widget('XBRCH_Products_Widget');
        register_widget('XBRCH_Dashboard_Widget');
    }
    
    /**
     * Widget shortcode
     */
    public function widget_shortcode($atts) {
        $atts = shortcode_atts(array(
            'type' => 'broadcast-wall',
            'user_id' => '',
            'width' => '100%',
            'theme' => '#3b82f6',
            'header' => 'true',
            'items' => '12'
        ), $atts);
        
        // Get user ID from settings if not provided
        if (empty($atts['user_id'])) {
            $settings = get_option('xbrch_widgets_settings');
            $atts['user_id'] = $settings['user_id'];
        }
        
        if (empty($atts['user_id'])) {
            return '<div class="xbrch-error">' . __('Please configure XBRCH Widgets settings first.', 'xbrch-widgets') . '</div>';
        }
        
        $widget_url = XBRCH_PLUGIN_URL . 'widget-' . $atts['type'] . '.html';
        $params = http_build_query($atts);
        
        return '<iframe src="' . esc_url($widget_url . '?' . $params) . '" 
                width="' . esc_attr($atts['width']) . '" 
                height="600" 
                frameborder="0" 
                style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: ' . esc_attr($atts['width']) . ';" 
                title="XBRCH ' . esc_attr($atts['type']) . ' Widget">
            </iframe>';
    }
    
    /**
     * Admin page
     */
    public function admin_page() {
        include_once XBRCH_PLUGIN_DIR . 'templates/admin-page.php';
    }
    
    /**
     * Settings page
     */
    public function settings_page() {
        include_once XBRCH_PLUGIN_DIR . 'templates/settings-page.php';
    }
    
    /**
     * Widget builder page
     */
    public function widget_builder_page() {
        include_once XBRCH_PLUGIN_DIR . 'templates/widget-builder.php';
    }
    
    /**
     * Save settings
     */
    public function save_settings() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch-widgets'));
        }
        
        $settings = array(
            'user_id' => sanitize_text_field($_POST['user_id']),
            'api_key' => sanitize_text_field($_POST['api_key']),
            'business_name' => sanitize_text_field($_POST['business_name']),
            'default_widget' => sanitize_text_field($_POST['default_widget']),
            'default_theme' => sanitize_hex_color($_POST['default_theme']),
            'default_width' => sanitize_text_field($_POST['default_width']),
            'show_header' => sanitize_text_field($_POST['show_header'])
        );
        
        update_option('xbrch_widgets_settings', $settings);
        
        wp_send_json_success(array('message' => __('Settings saved successfully!', 'xbrch-widgets')));
    }
    
    /**
     * Connect account
     */
    public function connect_account() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        $email = sanitize_email($_POST['email']);
        $password = sanitize_text_field($_POST['password']);
        
        // Verify credentials with XBRCH API
        $response = wp_remote_post(XBRCH_BASE_URL . '/auth/verify', array(
            'body' => json_encode(array(
                'email' => $email,
                'password' => $password
            )),
            'headers' => array(
                'Content-Type' => 'application/json'
            )
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => __('Connection failed. Please try again.', 'xbrch-widgets')));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['success']) && $data['success']) {
            $settings = get_option('xbrch_widgets_settings');
            $settings['user_id'] = $data['user_id'];
            $settings['api_key'] = $data['api_key'];
            $settings['business_name'] = $data['business_name'];
            update_option('xbrch_widgets_settings', $settings);
            
            wp_send_json_success(array('message' => __('Successfully connected to XBRCH!', 'xbrch-widgets')));
        } else {
            wp_send_json_error(array('message' => __('Invalid credentials. Please check your email and password.', 'xbrch-widgets')));
        }
    }
}

// Initialize the plugin
new XBRCH_Widgets_Plugin();

/**
 * XBRCH Broadcast Widget
 */
class XBRCH_Broadcast_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'xbrch_broadcast_widget',
            __('XBRCH Broadcast Wall', 'xbrch-widgets'),
            array(
                'description' => __('Display your XBRCH updates and products in a beautiful wall layout.', 'xbrch-widgets')
            )
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        $settings = get_option('xbrch_widgets_settings');
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        
        if (empty($user_id)) {
            echo '<div class="xbrch-error">' . __('Please configure XBRCH Widgets settings first.', 'xbrch-widgets') . '</div>';
        } else {
            $widget_url = XBRCH_PLUGIN_URL . 'widget-broadcast-wall.html';
            $params = http_build_query(array(
                'user_id' => $user_id,
                'width' => !empty($instance['width']) ? $instance['width'] : $settings['default_width'],
                'theme' => !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'],
                'header' => !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'],
                'items' => !empty($instance['items']) ? $instance['items'] : '12'
            ));
            
            echo '<iframe src="' . esc_url($widget_url . '?' . $params) . '" 
                    width="100%" 
                    height="600" 
                    frameborder="0" 
                    style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
                    title="XBRCH Broadcast Wall Widget">
                </iframe>';
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $settings = get_option('xbrch_widgets_settings');
        
        $user_id = !empty($instance['user_id']) ? $instance['user_id'] : $settings['user_id'];
        $width = !empty($instance['width']) ? $instance['width'] : $settings['default_width'];
        $theme = !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'];
        $show_header = !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'];
        $items = !empty($instance['items']) ? $instance['items'] : '12';
        
        ?>
        <p>
            <label for="<?php echo $this->get_field_id('user_id'); ?>"><?php _e('User ID:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('user_id'); ?>" 
                   name="<?php echo $this->get_field_name('user_id'); ?>" type="text" 
                   value="<?php echo esc_attr($user_id); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('width'); ?>"><?php _e('Width:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('width'); ?>" 
                    name="<?php echo $this->get_field_name('width'); ?>">
                <option value="100%" <?php selected($width, '100%'); ?>><?php _e('Full Width', 'xbrch-widgets'); ?></option>
                <option value="800px" <?php selected($width, '800px'); ?>>800px</option>
                <option value="600px" <?php selected($width, '600px'); ?>>600px</option>
                <option value="400px" <?php selected($width, '400px'); ?>>400px</option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('theme'); ?>"><?php _e('Theme Color:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('theme'); ?>" 
                   name="<?php echo $this->get_field_name('theme'); ?>" type="color" 
                   value="<?php echo esc_attr($theme); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('show_header'); ?>"><?php _e('Show Header:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('show_header'); ?>" 
                    name="<?php echo $this->get_field_name('show_header'); ?>">
                <option value="true" <?php selected($show_header, 'true'); ?>><?php _e('Yes', 'xbrch-widgets'); ?></option>
                <option value="false" <?php selected($show_header, 'false'); ?>><?php _e('No', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('items'); ?>"><?php _e('Items per Page:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('items'); ?>" 
                    name="<?php echo $this->get_field_name('items'); ?>">
                <option value="6" <?php selected($items, '6'); ?>>6 items</option>
                <option value="12" <?php selected($items, '12'); ?>>12 items</option>
                <option value="24" <?php selected($items, '24'); ?>>24 items</option>
                <option value="all" <?php selected($items, 'all'); ?>><?php _e('Show All', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <?php
    }
}

/**
 * XBRCH Updates Widget
 */
class XBRCH_Updates_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'xbrch_updates_widget',
            __('XBRCH Updates Feed', 'xbrch-widgets'),
            array(
                'description' => __('Display your latest XBRCH updates in a clean feed format.', 'xbrch-widgets')
            )
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        $settings = get_option('xbrch_widgets_settings');
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        
        if (empty($user_id)) {
            echo '<div class="xbrch-error">' . __('Please configure XBRCH Widgets settings first.', 'xbrch-widgets') . '</div>';
        } else {
            $widget_url = XBRCH_PLUGIN_URL . 'widget-updates-feed.html';
            $params = http_build_query(array(
                'user_id' => $user_id,
                'width' => !empty($instance['width']) ? $instance['width'] : $settings['default_width'],
                'theme' => !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'],
                'header' => !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'],
                'items' => !empty($instance['items']) ? $instance['items'] : '10'
            ));
            
            echo '<iframe src="' . esc_url($widget_url . '?' . $params) . '" 
                    width="100%" 
                    height="600" 
                    frameborder="0" 
                    style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
                    title="XBRCH Updates Feed Widget">
                </iframe>';
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        // Similar form as broadcast widget but with different defaults
        $settings = get_option('xbrch_widgets_settings');
        
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        $width = !empty($instance['width']) ? $instance['width'] : $settings['default_width'];
        $theme = !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'];
        $show_header = !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'];
        $items = !empty($instance['items']) ? $instance['items'] : '10';
        
        // Form HTML similar to broadcast widget
        ?>
        <p>
            <label for="<?php echo $this->get_field_id('user_id'); ?>"><?php _e('User ID:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('user_id'); ?>" 
                   name="<?php echo $this->get_field_name('user_id'); ?>" type="text" 
                   value="<?php echo esc_attr($user_id); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('width'); ?>"><?php _e('Width:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('width'); ?>" 
                    name="<?php echo $this->get_field_name('width'); ?>">
                <option value="100%" <?php selected($width, '100%'); ?>><?php _e('Full Width', 'xbrch-widgets'); ?></option>
                <option value="800px" <?php selected($width, '800px'); ?>>800px</option>
                <option value="600px" <?php selected($width, '600px'); ?>>600px</option>
                <option value="400px" <?php selected($width, '400px'); ?>>400px</option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('theme'); ?>"><?php _e('Theme Color:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('theme'); ?>" 
                   name="<?php echo $this->get_field_name('theme'); ?>" type="color" 
                   value="<?php echo esc_attr($theme); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('show_header'); ?>"><?php _e('Show Header:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('show_header'); ?>" 
                    name="<?php echo $this->get_field_name('show_header'); ?>">
                <option value="true" <?php selected($show_header, 'true'); ?>><?php _e('Yes', 'xbrch-widgets'); ?></option>
                <option value="false" <?php selected($show_header, 'false'); ?>><?php _e('No', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('items'); ?>"><?php _e('Items per Page:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('items'); ?>" 
                    name="<?php echo $this->get_field_name('items'); ?>">
                <option value="5" <?php selected($items, '5'); ?>>5 items</option>
                <option value="10" <?php selected($items, '10'); ?>>10 items</option>
                <option value="15" <?php selected($items, '15'); ?>>15 items</option>
                <option value="all" <?php selected($items, 'all'); ?>><?php _e('Show All', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <?php
    }
}

/**
 * XBRCH Products Widget
 */
class XBRCH_Products_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'xbrch_products_widget',
            __('XBRCH Products Showcase', 'xbrch-widgets'),
            array(
                'description' => __('Display your XBRCH products in an attractive grid layout.', 'xbrch-widgets')
            )
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        $settings = get_option('xbrch_widgets_settings');
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        
        if (empty($user_id)) {
            echo '<div class="xbrch-error">' . __('Please configure XBRCH Widgets settings first.', 'xbrch-widgets') . '</div>';
        } else {
            $widget_url = XBRCH_PLUGIN_URL . 'widget-products-showcase.html';
            $params = http_build_query(array(
                'user_id' => $user_id,
                'width' => !empty($instance['width']) ? $instance['width'] : $settings['default_width'],
                'theme' => !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'],
                'header' => !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'],
                'items' => !empty($instance['items']) ? $instance['items'] : '12'
            ));
            
            echo '<iframe src="' . esc_url($widget_url . '?' . $params) . '" 
                    width="100%" 
                    height="600" 
                    frameborder="0" 
                    style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
                    title="XBRCH Products Showcase Widget">
                </iframe>';
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        // Similar form structure
        $settings = get_option('xbrch_widgets_settings');
        
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        $width = !empty($instance['width']) ? $instance['width'] : $settings['default_width'];
        $theme = !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'];
        $show_header = !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'];
        $items = !empty($instance['items']) ? $instance['items'] : '12';
        
        // Form HTML similar to other widgets
        ?>
        <p>
            <label for="<?php echo $this->get_field_id('user_id'); ?>"><?php _e('User ID:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('user_id'); ?>" 
                   name="<?php echo $this->get_field_name('user_id'); ?>" type="text" 
                   value="<?php echo esc_attr($user_id); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('width'); ?>"><?php _e('Width:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('width'); ?>" 
                    name="<?php echo $this->get_field_name('width'); ?>">
                <option value="100%" <?php selected($width, '100%'); ?>><?php _e('Full Width', 'xbrch-widgets'); ?></option>
                <option value="800px" <?php selected($width, '800px'); ?>>800px</option>
                <option value="600px" <?php selected($width, '600px'); ?>>600px</option>
                <option value="400px" <?php selected($width, '400px'); ?>>400px</option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('theme'); ?>"><?php _e('Theme Color:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('theme'); ?>" 
                   name="<?php echo $this->get_field_name('theme'); ?>" type="color" 
                   value="<?php echo esc_attr($theme); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('show_header'); ?>"><?php _e('Show Header:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('show_header'); ?>" 
                    name="<?php echo $this->get_field_name('show_header'); ?>">
                <option value="true" <?php selected($show_header, 'true'); ?>><?php _e('Yes', 'xbrch-widgets'); ?></option>
                <option value="false" <?php selected($show_header, 'false'); ?>><?php _e('No', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('items'); ?>"><?php _e('Items per Page:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('items'); ?>" 
                    name="<?php echo $this->get_field_name('items'); ?>">
                <option value="6" <?php selected($items, '6'); ?>>6 items</option>
                <option value="12" <?php selected($items, '12'); ?>>12 items</option>
                <option value="18" <?php selected($items, '18'); ?>>18 items</option>
                <option value="all" <?php selected($items, 'all'); ?>><?php _e('Show All', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <?php
    }
}

/**
 * XBRCH Dashboard Widget
 */
class XBRCH_Dashboard_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'xbrch_dashboard_widget',
            __('XBRCH Mini Dashboard', 'xbrch-widgets'),
            array(
                'description' => __('Display a compact XBRCH dashboard with key metrics.', 'xbrch-widgets')
            )
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        $settings = get_option('xbrch_widgets_settings');
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        
        if (empty($user_id)) {
            echo '<div class="xbrch-error">' . __('Please configure XBRCH Widgets settings first.', 'xbrch-widgets') . '</div>';
        } else {
            $widget_url = XBRCH_PLUGIN_URL . 'widget-mini-dashboard.html';
            $params = http_build_query(array(
                'user_id' => $user_id,
                'width' => !empty($instance['width']) ? $instance['width'] : $settings['default_width'],
                'theme' => !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'],
                'header' => !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header']
            ));
            
            echo '<iframe src="' . esc_url($widget_url . '?' . $params) . '" 
                    width="100%" 
                    height="400" 
                    frameborder="0" 
                    style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
                    title="XBRCH Mini Dashboard Widget">
                </iframe>';
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        // Similar form structure
        $settings = get_option('xbrch_widgets_settings');
        
        $user_id = !empty($instance['user_id']) ? $settings['user_id'] : $instance['user_id'];
        $width = !empty($instance['width']) ? $instance['width'] : $settings['default_width'];
        $theme = !empty($instance['theme']) ? $instance['theme'] : $settings['default_theme'];
        $show_header = !empty($instance['show_header']) ? $instance['show_header'] : $settings['show_header'];
        
        // Form HTML
        ?>
        <p>
            <label for="<?php echo $this->get_field_id('user_id'); ?>"><?php _e('User ID:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('user_id'); ?>" 
                   name="<?php echo $this->get_field_name('user_id'); ?>" type="text" 
                   value="<?php echo esc_attr($user_id); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('width'); ?>"><?php _e('Width:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('width'); ?>" 
                    name="<?php echo $this->get_field_name('width'); ?>">
                <option value="100%" <?php selected($width, '100%'); ?>><?php _e('Full Width', 'xbrch-widgets'); ?></option>
                <option value="800px" <?php selected($width, '800px'); ?>>800px</option>
                <option value="600px" <?php selected($width, '600px'); ?>>600px</option>
                <option value="400px" <?php selected($width, '400px'); ?>>400px</option>
            </select>
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('theme'); ?>"><?php _e('Theme Color:', 'xbrch-widgets'); ?></label>
            <input class="widefat" id="<?php echo $this->get_field_id('theme'); ?>" 
                   name="<?php echo $this->get_field_name('theme'); ?>" type="color" 
                   value="<?php echo esc_attr($theme); ?>" />
        </p>
        <p>
            <label for="<?php echo $this->get_field_id('show_header'); ?>"><?php _e('Show Header:', 'xbrch-widgets'); ?></label>
            <select class="widefat" id="<?php echo $this->get_field_id('show_header'); ?>" 
                    name="<?php echo $this->get_field_name('show_header'); ?>">
                <option value="true" <?php selected($show_header, 'true'); ?>><?php _e('Yes', 'xbrch-widgets'); ?></option>
                <option value="false" <?php selected($show_header, 'false'); ?>><?php _e('No', 'xbrch-widgets'); ?></option>
            </select>
        </p>
        <?php
    }
}
