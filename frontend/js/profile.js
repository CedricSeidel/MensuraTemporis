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
 * Initialisiert die Login/Logout Funktionalität
 */
function initializeProfile() {
    // Fingerabdruck Click Handler (toggle Login/Logout)
    fingerprintImage.addEventListener('click', toggleLoginState);

    // Tooltip Updates
    profileContainer.addEventListener('mouseenter', updateProfileTooltip);
    fingerprintContainer.addEventListener('mouseenter', updateFingerprintTooltip);
}

/**
 * Toggelt zwischen Login und Logout
 */
function toggleLoginState() {
    isLoggedIn = !isLoggedIn;
    updateFingerprintTooltip();
}

/**
 * Updated das Profil-Tooltip
 */
function updateProfileTooltip() {
    profileTooltip.textContent = isLoggedIn ? 'Profil' : 'Profil (nicht eingeloggt)';
}

/**
 * Updated das Fingerabdruck-Tooltip
 */
function updateFingerprintTooltip() {
    fingerprintTooltip.textContent = isLoggedIn ? 'Logout' : 'Login';
}

// Initialisiere Profile wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', initializeProfile);


