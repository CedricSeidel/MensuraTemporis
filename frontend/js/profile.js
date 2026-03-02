// Login State Management
let isLoggedIn = false;

// DOM Elements
const profileImage = document.getElementById('profileImage');
const fingerprintImage = document.getElementById('fingerprintImage');
const profileTooltip = document.getElementById('profileTooltip');
const fingerprintTooltip = document.getElementById('fingerprintTooltip');
const profileContainer = document.querySelector('.profile-container');
const fingerprintContainer = document.querySelector('.fingerprint-container');

/**
 * Initialise Login/Logout
 */
function initializeProfile() {
    // Fingerprint Click Handler (toggle Login/Logout)
    fingerprintImage.addEventListener('click', toggleLoginState);

    // Tooltip Updates
    profileContainer.addEventListener('mouseenter', updateProfileTooltip);
    fingerprintContainer.addEventListener('mouseenter', updateFingerprintTooltip);
}

/**
 * Toggle between Login and Logout
 */
function toggleLoginState() {
    isLoggedIn = !isLoggedIn;
    updateFingerprintTooltip();
}

/**
 * Update Profile-Tooltip
 */
function updateProfileTooltip() {
    profileTooltip.textContent = isLoggedIn ? 'Profil' : 'Profil (nicht eingeloggt)';
}

/**
 * Update Fingerprint-Tooltip
 */
function updateFingerprintTooltip() {
    fingerprintTooltip.textContent = isLoggedIn ? 'Logout' : 'Login';
}

// Initialise Profile if DOM loaded
document.addEventListener('DOMContentLoaded', initializeProfile);


