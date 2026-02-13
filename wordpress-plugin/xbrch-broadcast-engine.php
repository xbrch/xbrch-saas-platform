<?php
/**
 * Plugin Name: XBRCH Broadcast Engine
 * Plugin URI: https://xbrch.com
 * Description: Professional social media and website content management for XBRCH
 * Version: 1.0.0
 * Author: XBRCH
 * Author URI: https://xbrch.com
 * License: GPL v2 or later
 * Text Domain: xbrch
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('XBRCH_VERSION', '1.0.0');
define('XBRCH_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('XBRCH_PLUGIN_URL', plugin_dir_url(__FILE__));
define('XBRCH_API_BASE', get_option('xbrch_api_base', 'https://api.xbrch.com'));
define('XBRCH_API_SECRET', get_option('xbrch_api_secret', ''));

/**
 * Main plugin class
 */
class XBRCH_Broadcast_Engine {
    
    private $api_token = null;
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wp_ajax_xbrch_authenticate', array($this, 'ajax_authenticate'));
        add_action('wp_ajax_xbrch_create_broadcast', array($this, 'ajax_create_broadcast'));
        add_action('wp_ajax_xbrch_create_announcement', array($this, 'ajax_create_announcement'));
        add_action('wp_ajax_xbrch_create_blog', array($this, 'ajax_create_blog'));
        add_action('wp_ajax_xbrch_create_wall_update', array($this, 'ajax_create_wall_update'));
        add_action('wp_ajax_xbrch_get_status', array($this, 'ajax_get_status'));
        
        // Register activation hook
        register_activation_hook(__FILE__, array($this, 'activate'));
    }
    
    public function init() {
        // Load text domain
        load_plugin_textdomain('xbrch', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Add shortcode for broadcast wall
        add_shortcode('xbrch_wall', array($this, 'broadcast_wall_shortcode'));
    }
    
    public function activate() {
        // Set default options
        if (!get_option('xbrch_api_base')) {
            add_option('xbrch_api_base', 'https://api.xbrch.com');
        }
        
        if (!get_option('xbrch_api_secret')) {
            add_option('xbrch_api_secret', wp_generate_password(32, false));
        }
    }
    
    public function add_admin_menu() {
        add_menu_page(
            __('XBRCH Broadcast Engine', 'xbrch'),
            __('XBRCH', 'xbrch'),
            'manage_options',
            'xbrch-dashboard',
            array($this, 'dashboard_page'),
            'dashicons-megaphone',
            30
        );
        
        add_submenu_page(
            'xbrch-dashboard',
            __('Dashboard', 'xbrch'),
            __('Dashboard', 'xbrch'),
            'manage_options',
            'xbrch-dashboard',
            array($this, 'dashboard_page')
        );
        
        add_submenu_page(
            'xbrch-dashboard',
            __('New Broadcast', 'xbrch'),
            __('New Broadcast', 'xbrch'),
            'manage_options',
            'xbrch-broadcast',
            array($this, 'broadcast_page')
        );
        
        add_submenu_page(
            'xbrch-dashboard',
            __('Website & Blog', 'xbrch'),
            __('Website & Blog', 'xbrch'),
            'manage_options',
            'xbrch-website',
            array($this, 'website_page')
        );
        
        add_submenu_page(
            'xbrch-dashboard',
            __('Broadcast Wall', 'xbrch'),
            __('Broadcast Wall', 'xbrch'),
            'manage_options',
            'xbrch-wall',
            array($this, 'wall_page')
        );
        
        add_submenu_page(
            'xbrch-dashboard',
            __('History', 'xbrch'),
            __('History', 'xbrch'),
            'manage_options',
            'xbrch-history',
            array($this, 'history_page')
        );
        
        add_submenu_page(
            'xbrch-dashboard',
            __('Settings', 'xbrch'),
            __('Settings', 'xbrch'),
            'manage_options',
            'xbrch-settings',
            array($this, 'settings_page')
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'xbrch-') === false) {
            return;
        }
        
        wp_enqueue_style('xbrch-admin', XBRCH_PLUGIN_URL . 'assets/css/admin.css', array(), XBRCH_VERSION);
        wp_enqueue_script('xbrch-admin', XBRCH_PLUGIN_URL . 'assets/js/admin.js', array('jquery'), XBRCH_VERSION, true);
        
        wp_localize_script('xbrch-admin', 'xbrch_vars', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('xbrch_nonce'),
            'api_base' => XBRCH_API_BASE,
            'strings' => array(
                'confirm_delete' => __('Are you sure you want to delete this item?', 'xbrch'),
                'loading' => __('Loading...', 'xbrch'),
                'error' => __('An error occurred. Please try again.', 'xbrch'),
                'success' => __('Success!', 'xbrch')
            )
        ));
    }
    
    public function dashboard_page() {
        include XBRCH_PLUGIN_DIR . 'templates/dashboard.php';
    }
    
    public function broadcast_page() {
        include XBRCH_PLUGIN_DIR . 'templates/broadcast.php';
    }
    
    public function website_page() {
        include XBRCH_PLUGIN_DIR . 'templates/website.php';
    }
    
    public function wall_page() {
        include XBRCH_PLUGIN_DIR . 'templates/wall.php';
    }
    
    public function history_page() {
        include XBRCH_PLUGIN_DIR . 'templates/history.php';
    }
    
    public function settings_page() {
        include XBRCH_PLUGIN_DIR . 'templates/settings.php';
    }
    
    /**
     * Authenticate with XBRCH API
     */
    public function ajax_authenticate() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch'));
        }
        
        $site_url = sanitize_text_field($_POST['site_url']);
        $api_key = sanitize_text_field($_POST['api_key']);
        
        if (empty($site_url) || empty($api_key)) {
            wp_send_json_error(array('message' => __('Site URL and API Key are required.', 'xbrch')));
        }
        
        $response = $this->api_request('/auth', array(
            'siteUrl' => $site_url,
            'apiKey' => $api_key
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['wpToken'])) {
            update_option('xbrch_wp_token', $data['wpToken']);
            update_option('xbrch_site_url', $site_url);
            wp_send_json_success($data);
        } else {
            wp_send_json_error(array('message' => __('Authentication failed.', 'xbrch')));
        }
    }
    
    /**
     * Create broadcast
     */
    public function ajax_create_broadcast() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch'));
        }
        
        $message = sanitize_textarea_field($_POST['message']);
        $platforms = array_map('sanitize_text_field', $_POST['platforms']);
        $wp_token = get_option('xbrch_wp_token');
        
        if (empty($message) || empty($platforms) || empty($wp_token)) {
            wp_send_json_error(array('message' => __('Message, platforms, and authentication are required.', 'xbrch')));
        }
        
        $response = $this->api_request('/broadcast', array(
            'message' => $message,
            'platforms' => $platforms,
            'wpToken' => $wp_token
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['broadcast'])) {
            wp_send_json_success($data);
        } else {
            wp_send_json_error(array('message' => __('Failed to create broadcast.', 'xbrch')));
        }
    }
    
    /**
     * Create announcement
     */
    public function ajax_create_announcement() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch'));
        }
        
        $message = sanitize_textarea_field($_POST['message']);
        $publish_immediately = isset($_POST['publish_immediately']) ? (bool) $_POST['publish_immediately'] : false;
        $wp_token = get_option('xbrch_wp_token');
        
        if (empty($message) || empty($wp_token)) {
            wp_send_json_error(array('message' => __('Message and authentication are required.', 'xbrch')));
        }
        
        $response = $this->api_request('/announcement', array(
            'message' => $message,
            'publishImmediately' => $publish_immediately,
            'wpToken' => $wp_token
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['post'])) {
            wp_send_json_success($data);
        } else {
            wp_send_json_error(array('message' => __('Failed to create announcement.', 'xbrch')));
        }
    }
    
    /**
     * Create blog post
     */
    public function ajax_create_blog() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch'));
        }
        
        $topic = sanitize_text_field($_POST['topic']);
        $publish_immediately = isset($_POST['publish_immediately']) ? (bool) $_POST['publish_immediately'] : false;
        $wp_token = get_option('xbrch_wp_token');
        
        if (empty($topic) || empty($wp_token)) {
            wp_send_json_error(array('message' => __('Topic and authentication are required.', 'xbrch')));
        }
        
        $response = $this->api_request('/blog', array(
            'topic' => $topic,
            'publishImmediately' => $publish_immediately,
            'wpToken' => $wp_token
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['post'])) {
            wp_send_json_success($data);
        } else {
            wp_send_json_error(array('message' => __('Failed to create blog post.', 'xbrch')));
        }
    }
    
    /**
     * Create wall update
     */
    public function ajax_create_wall_update() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch'));
        }
        
        $content = sanitize_textarea_field($_POST['content']);
        $image_url = isset($_POST['image_url']) ? esc_url_raw($_POST['image_url']) : '';
        $link_url = isset($_POST['link_url']) ? esc_url_raw($_POST['link_url']) : '';
        $link_title = isset($_POST['link_title']) ? sanitize_text_field($_POST['link_title']) : '';
        $wp_token = get_option('xbrch_wp_token');
        
        if (empty($content) || empty($wp_token)) {
            wp_send_json_error(array('message' => __('Content and authentication are required.', 'xbrch')));
        }
        
        $response = $this->api_request('/wall-update', array(
            'content' => $content,
            'imageUrl' => $image_url,
            'linkUrl' => $link_url,
            'linkTitle' => $link_title,
            'wpToken' => $wp_token
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['update'])) {
            wp_send_json_success($data);
        } else {
            wp_send_json_error(array('message' => __('Failed to create wall update.', 'xbrch')));
        }
    }
    
    /**
     * Get status
     */
    public function ajax_get_status() {
        check_ajax_referer('xbrch_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.', 'xbrch'));
        }
        
        $wp_token = get_option('xbrch_wp_token');
        
        if (empty($wp_token)) {
            wp_send_json_error(array('message' => __('Not authenticated with XBRCH.', 'xbrch')));
        }
        
        $response = $this->api_request('/status', array(), 'GET');
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        wp_send_json_success($data);
    }
    
    /**
     * Make API request to XBRCH
     */
    private function api_request($endpoint, $data = array(), $method = 'POST') {
        $url = trailingslashit(XBRCH_API_BASE) . ltrim($endpoint, '/');
        
        $args = array(
            'method' => $method,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-WP-Secret' => XBRCH_API_SECRET,
                'X-WP-Token' => get_option('xbrch_wp_token'),
            ),
            'timeout' => 30,
        );
        
        if (!empty($data) && $method === 'POST') {
            $args['body'] = json_encode($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        
        if ($status_code !== 200) {
            return new WP_Error('api_error', sprintf(__('API request failed with status %d', 'xbrch'), $status_code));
        }
        
        return $response;
    }
    
    /**
     * Broadcast wall shortcode
     */
    public function broadcast_wall_shortcode($atts) {
        $atts = shortcode_atts(array(
            'business' => '',
            'width' => '100%',
            'height' => '600'
        ), $atts);
        
        if (empty($atts['business'])) {
            return '<p>' . __('Business name is required for XBRCH broadcast wall.', 'xbrch') . '</p>';
        }
        
        $business_slug = sanitize_title($atts['business']);
        $api_base = XBRCH_API_BASE;
        
        return sprintf(
            '<iframe src="%s/wall/public/%s" width="%s" height="%s" frameborder="0" scrolling="auto" style="border: none; max-width: 100%;"></iframe>',
            esc_url($api_base),
            esc_attr($business_slug),
            esc_attr($atts['width']),
            esc_attr($atts['height'])
        );
    }
}

// Initialize plugin
new XBRCH_Broadcast_Engine();

/**
 * Helper function for XBRCH wall shortcode
 */
function xbrch_wall($business_name, $width = '100%', $height = '600') {
    echo do_shortcode("[xbrch_wall business='{$business_name}' width='{$width}' height='{$height}']");
}
?>
