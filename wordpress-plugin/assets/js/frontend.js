jQuery(document).ready(function($) {
    // Initialize widget containers
    $('.xbrch-widget-container iframe').on('load', function() {
        $(this).parent().find('.xbrch-loading').remove();
    });
    
    // Handle widget resizing
    function resizeWidgets() {
        $('.xbrch-widget-container').each(function() {
            var $container = $(this);
            var $iframe = $container.find('iframe');
            
            if ($iframe.length) {
                // Set iframe height based on content
                $iframe.on('load', function() {
                    try {
                        var iframeContent = this.contentWindow.document.body;
                        var height = iframeContent.scrollHeight;
                        $(this).height(height);
                    } catch (e) {
                        // Cross-origin restriction, use default height
                        $(this).height(600);
                    }
                });
            }
        });
    }
    
    // Initialize resizing
    resizeWidgets();
    
    // Handle window resize
    $(window).on('resize', function() {
        resizeWidgets();
    });
    
    // Add responsive classes
    function addResponsiveClasses() {
        var screenWidth = $(window).width();
        
        if (screenWidth < 768) {
            $('body').addClass('xbrch-mobile');
        } else {
            $('body').removeClass('xbrch-mobile');
        }
    }
    
    addResponsiveClasses();
    $(window).on('resize', addResponsiveClasses);
    
    // Handle widget errors
    $('.xbrch-widget-container iframe').on('error', function() {
        $(this).parent().html(
            '<div class="xbrch-error">' +
                'Unable to load XBRCH widget. Please check your settings and try again.' +
            '</div>'
        );
    });
});
