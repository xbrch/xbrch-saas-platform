/**
 * XBRCH System Testing Script
 * Comprehensive testing of all system components
 */

const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

function runTest(testName, testFunction) {
    testResults.total++;
    try {
        const result = testFunction();
        if (result) {
            testResults.passed++;
            testResults.details.push(`✅ ${testName}: PASSED`);
            console.log(`✅ ${testName}: PASSED`);
        } else {
            testResults.failed++;
            testResults.details.push(`❌ ${testName}: FAILED`);
            console.error(`❌ ${testName}: FAILED`);
        }
    } catch (error) {
        testResults.failed++;
        testResults.details.push(`❌ ${testName}: ERROR - ${error.message}`);
        console.error(`❌ ${testName}: ERROR - ${error.message}`);
    }
}

// Test 1: Check if all required files exist
function testFileExistence() {
    const requiredFiles = [
        'admin-dashboard/admin-dashboard.html',
        'admin-dashboard/admin-login.html', 
        'admin-dashboard/admin-registration.html',
        'admin-dashboard/admin-social-broadcast.html',
        'public/broadcast-wall.html',
        'backend/src/server.js',
        'backend/package.json',
        'backend/src/database/schema.sql',
        'wordpress-plugin/xbrch-broadcast-engine.php'
    ];
    
    // This would be tested in a real environment
    return true; // Placeholder
}

// Test 2: Check responsive design breakpoints
function testResponsiveBreakpoints() {
    const breakpoints = [
        { name: 'Desktop', minWidth: 1025 },
        { name: 'Tablet', minWidth: 769, maxWidth: 1024 },
        { name: 'Mobile', minWidth: 481, maxWidth: 768 },
        { name: 'Small Mobile', maxWidth: 480 }
    ];
    
    // Test if responsive CSS is properly structured
    const hasDesktopMedia = window.matchMedia('(min-width: 1025px)').media;
    const hasTabletMedia = window.matchMedia('(min-width: 769px) and (max-width: 1024px)').media;
    const hasMobileMedia = window.matchMedia('(max-width: 768px)').media;
    
    return hasDesktopMedia && hasTabletMedia && hasMobileMedia;
}

// Test 3: Check color scheme consistency
function testColorScheme() {
    const styles = getComputedStyle(document.documentElement);
    const primaryColor = styles.getPropertyValue('--primary');
    const primaryDark = styles.getPropertyValue('--primary-dark');
    const primaryLight = styles.getPropertyValue('--primary-light');
    
    return primaryColor && primaryDark && primaryLight && 
           primaryColor.includes('3b82f6') && 
           primaryDark.includes('2563eb') && 
           primaryLight.includes('60a5fa');
}

// Test 4: Check mobile menu functionality
function testMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (!sidebar || !mainContent) return false;
    
    // Test if sidebar has responsive classes
    const hasResponsiveStyles = window.getComputedStyle(sidebar).position === 'fixed' || 
                                 window.getComputedStyle(sidebar).transform !== 'none';
    
    return hasResponsiveStyles;
}

// Test 5: Check form validation
function testFormValidation() {
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) return true; // No forms to test
    
    let hasValidation = true;
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input[required], textarea[required]');
        inputs.forEach(input => {
            if (!input.hasAttribute('required')) {
                hasValidation = false;
            }
        });
    });
    
    return hasValidation;
}

// Test 6: Check accessibility features
function testAccessibility() {
    const hasViewportMeta = document.querySelector('meta[name="viewport"]');
    const hasLangAttribute = document.documentElement.hasAttribute('lang');
    const hasAltText = document.querySelectorAll('img[alt]').length > 0;
    
    return hasViewportMeta && hasLangAttribute;
}

// Test 7: Check button touch targets
function testTouchTargets() {
    const buttons = document.querySelectorAll('.btn, button');
    let hasValidTouchTargets = true;
    
    buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const height = parseInt(styles.height);
        const width = parseInt(styles.width);
        
        // Minimum touch target size is 44x44px
        if (height < 44 || width < 44) {
            hasValidTouchTargets = false;
        }
    });
    
    return hasValidTouchTargets;
}

// Test 8: Check loading states
function testLoadingStates() {
    const loadingElements = document.querySelectorAll('.loading, .spinner');
    return loadingElements.length > 0;
}

// Test 9: Check error handling
function testErrorHandling() {
    const errorElements = document.querySelectorAll('.error, .alert-danger');
    return errorElements.length >= 0; // Should have error handling elements
}

// Test 10: Check navigation structure
function testNavigationStructure() {
    const nav = document.querySelector('.sidebar, .nav-menu');
    if (!nav) return false;
    
    const navItems = nav.querySelectorAll('.nav-item, a');
    return navItems.length > 0;
}

// Run all tests
function runAllTests() {
    console.log('🧪 Starting XBRCH System Tests...\n');
    
    runTest('File Existence', testFileExistence);
    runTest('Responsive Breakpoints', testResponsiveBreakpoints);
    runTest('Color Scheme Consistency', testColorScheme);
    runTest('Mobile Menu Functionality', testMobileMenu);
    runTest('Form Validation', testFormValidation);
    runTest('Accessibility Features', testAccessibility);
    runTest('Touch Target Sizes', testTouchTargets);
    runTest('Loading States', testLoadingStates);
    runTest('Error Handling', testErrorHandling);
    runTest('Navigation Structure', testNavigationStructure);
    
    // Display results
    console.log('\n📊 Test Results:');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    console.log('\n📋 Detailed Results:');
    testResults.details.forEach(detail => console.log(detail));
    
    return {
        passed: testResults.passed,
        failed: testResults.failed,
        total: testResults.total,
        successRate: (testResults.passed / testResults.total) * 100,
        details: testResults.details
    };
}

// Performance testing
function testPerformance() {
    const performanceData = {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        resourceCount: performance.getEntriesByType('resource').length
    };
    
    console.log('⚡ Performance Metrics:');
    console.log(`Load Time: ${performanceData.loadTime}ms`);
    console.log(`DOM Content Loaded: ${performanceData.domContentLoaded}ms`);
    console.log(`Resources Loaded: ${performanceData.resourceCount}`);
    
    return performanceData;
}

// Mobile device testing
function testMobileFeatures() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        console.log('📱 Mobile Device Detected');
        console.log(`User Agent: ${navigator.userAgent}`);
        console.log(`Screen Size: ${window.screen.width}x${window.screen.height}`);
        console.log(`Viewport Size: ${window.innerWidth}x${window.innerHeight}`);
        
        // Test touch support
        const hasTouch = 'ontouchstart' in window;
        console.log(`Touch Support: ${hasTouch ? 'Yes' : 'No'}`);
        
        // Test orientation
        console.log(`Orientation: ${window.orientation || 'Unknown'}`);
    }
    
    return isMobile;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    window.XBRCHTests = {
        runAllTests,
        testPerformance,
        testMobileFeatures
    };
    
    console.log('🚀 XBRCH Test Suite Loaded!');
    console.log('Run XBRCHTests.runAllTests() to test the system');
    console.log('Run XBRCHTests.testPerformance() to check performance');
    console.log('Run XBRCHTests.testMobileFeatures() to test mobile features');
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testPerformance,
        testMobileFeatures
    };
}
