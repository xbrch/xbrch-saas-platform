jQuery(document).ready(function($) {
    // Initialize tooltips
    $('.xbrch-tooltip').tooltip();
    
    // Handle connection form
    $('#xbrch-connect-form').on('submit', function(e) {
        e.preventDefault();
        
        var $form = $(this);
        var $submit = $form.find('button[type="submit"]');
        var originalText = $submit.text();
        
        // Show loading state
        $submit.prop('disabled', true).text('Connecting...');
        
        $.ajax({
            url: xbrch_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'xbrch_connect_account',
                email: $('#xbrch-email').val(),
                password: $('#xbrch-password').val(),
                nonce: xbrch_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    $('.xbrch-status').removeClass('not-connected').addClass('connected')
                        .html('<strong>' + xbrch_ajax.strings.connect_success + '</strong>');
                    
                    // Reload page after 2 seconds
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    $('.xbrch-status').removeClass('connected').addClass('not-connected')
                        .html('<strong>' + response.data.message + '</strong>');
                }
            },
            error: function() {
                $('.xbrch-status').removeClass('connected').addClass('not-connected')
                    .html('<strong>' + xbrch_ajax.strings.connect_error + '</strong>');
            },
            complete: function() {
                $submit.prop('disabled', false).text(originalText);
            }
        });
    });
    
    // Handle settings form
    $('#xbrch-settings-form').on('submit', function(e) {
        e.preventDefault();
        
        var $form = $(this);
        var $submit = $form.find('button[type="submit"]');
        var originalText = $submit.text();
        
        // Show loading state
        $submit.prop('disabled', true).text('Saving...');
        
        $.ajax({
            url: xbrch_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'xbrch_save_settings',
                user_id: $('#xbrch-user-id').val(),
                api_key: $('#xbrch-api-key').val(),
                business_name: $('#xbrch-business-name').val(),
                default_widget: $('#xbrch-default-widget').val(),
                default_theme: $('#xbrch-default-theme').val(),
                default_width: $('#xbrch-default-width').val(),
                show_header: $('#xbrch-show-header').val(),
                nonce: xbrch_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    $('.xbrch-notification').remove();
                    $('<div class="notice notice-success xbrch-notification">' + 
                        xbrch_ajax.strings.save_success + '</div>')
                        .insertAfter('#xbrch-settings-form');
                } else {
                    $('.xbrch-notification').remove();
                    $('<div class="notice notice-error xbrch-notification">' + 
                        response.data.message + '</div>')
                        .insertAfter('#xbrch-settings-form');
                }
            },
            error: function() {
                $('.xbrch-notification').remove();
                $('<div class="notice notice-error xbrch-notification">' + 
                    xbrch_ajax.strings.save_error + '</div>')
                    .insertAfter('#xbrch-settings-form');
            },
            complete: function() {
                $submit.prop('disabled', false).text(originalText);
            }
        });
    });
    
    // Handle copy code functionality
    $('.xbrch-copy-code').on('click', function() {
        var $button = $(this);
        var $codeContainer = $button.closest('.xbrch-code-preview');
        var codeText = $codeContainer.find('code').text();
        
        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(codeText).then(function() {
                $button.text('Copied!');
                setTimeout(function() {
                    $button.text('Copy Code');
                }, 2000);
            }).catch(function() {
                // Fallback for older browsers
                copyToClipboard(codeText);
            });
        } else {
            // Fallback for older browsers
            copyToClipboard(codeText);
        }
    });
    
    // Fallback copy function
    function copyToClipboard(text) {
        var $temp = $('<textarea>');
        $('body').append($temp);
        $temp.val(text).select();
        document.execCommand('copy');
        $temp.remove();
        
        $('.xbrch-copy-code').text('Copied!');
        setTimeout(function() {
            $('.xbrch-copy-code').text('Copy Code');
        }, 2000);
    }
    
    // Handle widget builder
    $('.xbrch-widget-type').on('change', function() {
        var widgetType = $(this).val();
        updateWidgetPreview(widgetType);
    });
    
    $('.xbrch-customize-input').on('input change', function() {
        var widgetType = $('.xbrch-widget-type').val();
        updateWidgetPreview(widgetType);
    });
    
    function updateWidgetPreview(widgetType) {
        var userId = $('#xbrch-user-id').val() || 'demo-user';
        var width = $('#xbrch-widget-width').val() || '100%';
        var theme = $('#xbrch-widget-theme').val() || '#3b82f6';
        var header = $('#xbrch-widget-header').val() || 'true';
        var items = $('#xbrch-widget-items').val() || '12';
        
        var widgetUrl = xbrch_ajax.plugin_url + 'widget-' + widgetType + '.html';
        var params = 'user_id=' + userId + '&width=' + width + '&theme=' + encodeURIComponent(theme) + '&header=' + header + '&items=' + items;
        
        var embedCode = '<iframe src="' + widgetUrl + '?' + params + '" ' +
            'width="' + width + '" ' +
            'height="600" ' +
            'frameborder="0" ' +
            'style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: ' + width + ';" ' +
            'title="XBRCH ' + widgetType.replace('-', ' ') + ' Widget">' +
            '</iframe>';
        
        $('#xbrch-embed-code').val(embedCode);
        
        // Update preview iframe
        $('#xbrch-preview-frame').attr('src', widgetUrl + '?' + params);
    }
    
    // Initialize widget preview
    var initialWidgetType = $('.xbrch-widget-type').val();
    if (initialWidgetType) {
        updateWidgetPreview(initialWidgetType);
    }
    
    // Handle tabs
    $('.xbrch-tab').on('click', function() {
        var $tab = $(this);
        var target = $tab.data('target');
        
        // Update active tab
        $('.xbrch-tab').removeClass('active');
        $tab.addClass('active');
        
        // Update active content
        $('.xbrch-tab-content').removeClass('active');
        $('#' + target).addClass('active');
    });
    
    // Auto-save settings
    var autoSaveTimer;
    $('.xbrch-auto-save').on('input change', function() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function() {
            $('#xbrch-settings-form').submit();
        }, 2000);
    });
});
