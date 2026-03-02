/**
 * @fileoverview Hotkey Navigation System
 *
 * Enables keyboard shortcuts for quick navigation throughout the application.
 * Maps keyboard keys to navigation links for improved accessibility and user experience.
 *
 * Features:
 * - Keyboard event listening for hotkey activation
 * - Support for navigation links with data-hotkey attributes
 * - Excludes text input fields from hotkey processing
 * - CSS.escape() for safe CSS selector generation
 * - Error handling for malformed or missing elements
 *
 * Hotkeys defined in HTML with data-hotkey attributes on links:
 * - [K] = Home
 * - [R] = Register
 * - [L] = Login/Logout
 * - [P] = Profile
 * - [H] = Help/Features
 *
 * @version 1.0.0
 * @author Cedric Seidel
 */

/**
 * IIFE - Initialize hotkey system on page load
 *
 * Sets up global keyboard event listener that:
 * - Detects keypress events
 * - Skips processing if user is typing in input/textarea
 * - Matches key to navigation link with data-hotkey attribute
 * - Simulates click on matching link if visible
 *
 * Error handling ensures malformed selectors or missing elements
 * don't break the application.
 *
 * @function initHotkeys
 * @returns {void}
 */
(function initHotkeys() {
    try {
        /**
         * Global keydown event listener
         * Triggered whenever user presses a key
         */
        document.addEventListener('keydown', function(e) {
            try {
                // === Skip if user is typing in input field ===
                // Check if event target is an input or textarea element
                if (!e?.key || e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') {
                    return;
                }

                try {
                    // === Find matching navigation link ===
                    // Convert key to lowercase for case-insensitive matching
                    const key = e.key.toLowerCase();

                    // Use CSS.escape() to safely create selector for special characters
                    const link = document.querySelector(`a[data-hotkey="${CSS.escape(key)}"]`);

                    // === Trigger link if found and visible ===
                    // Only click if element exists and is not hidden
                    if (link && link.style.display !== 'none') {
                        e.preventDefault();
                        link.click();
                    }
                } catch (innerError) {
                    console.warn('Error processing hotkey:', innerError);
                }
            } catch (error) {
                console.error('Hotkey event listener error:', error);
            }
        });
    } catch (error) {
        console.error('Hotkey initialization failed:', error);
    }
})();