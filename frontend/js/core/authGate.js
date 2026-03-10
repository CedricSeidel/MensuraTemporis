const AUTH_REQUIRED_POPUP_CLASS = 'auth-required-popup';
const AUTH_REQUIRED_AUTO_HIDE_MS = 6400;

let hideTimeoutId = 0;

function clearHideTimeout() {
    if (!hideTimeoutId) return;
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = 0;
}

function hasLocalSession() {
    try {
        const raw = localStorage.getItem('mensura-auth-session-v1');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return typeof parsed?.username === 'string' && parsed.username.trim().length > 0;
    } catch {
        return false;
    }
}

function openLoginModalFromPopup() {
    const openLogin = window.ProfileModalController?.openLogin;
    if (typeof openLogin === 'function') {
        void openLogin(document.getElementById('fingerprintImage'));
        return;
    }

    const fingerprintTrigger = document.getElementById('fingerprintImage');
    fingerprintTrigger?.click();
}

function ensureAuthRequiredPopup() {
    const existing = document.body.querySelector(`.${AUTH_REQUIRED_POPUP_CLASS}`);
    if (existing instanceof HTMLElement) return existing;

    const popup = document.createElement('aside');
    popup.className = AUTH_REQUIRED_POPUP_CLASS;
    popup.hidden = true;
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'polite');

    const icon = document.createElement('span');
    icon.className = 'auth-required-popup__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '&#128274;';

    const text = document.createElement('p');
    text.className = 'auth-required-popup__text';
    text.textContent = 'Bitte erst einloggen, um diese Funktion zu nutzen.';

    const loginLink = document.createElement('a');
    loginLink.className = 'auth-required-popup__link';
    loginLink.href = '#';
    loginLink.textContent = 'Zum Login';
    loginLink.addEventListener('click', (event) => {
        event.preventDefault();
        hideAuthRequiredPopup({ immediate: true });
        openLoginModalFromPopup();
    });

    popup.append(icon, text, loginLink);
    document.body.appendChild(popup);
    return popup;
}

export function isUserLoggedIn() {
    const isLoggedIn = window.ProfileModalController?.isLoggedIn;
    if (typeof isLoggedIn === 'function') {
        return Boolean(isLoggedIn());
    }
    return hasLocalSession();
}

export function hideAuthRequiredPopup({ immediate = false } = {}) {
    const popup = ensureAuthRequiredPopup();
    clearHideTimeout();

    if (immediate) {
        popup.hidden = true;
        popup.classList.remove('is-visible');
        return;
    }

    popup.classList.remove('is-visible');
    window.setTimeout(() => {
        if (!popup.classList.contains('is-visible')) {
            popup.hidden = true;
        }
    }, 180);
}

export function showAuthRequiredPopup(message = 'Bitte erst einloggen, um diese Funktion zu nutzen.') {
    const popup = ensureAuthRequiredPopup();
    const text = popup.querySelector('.auth-required-popup__text');
    if (text) {
        text.textContent = message;
    }

    clearHideTimeout();
    popup.hidden = false;
    popup.classList.remove('is-visible');
    window.requestAnimationFrame(() => {
        popup.classList.add('is-visible');
    });

    hideTimeoutId = window.setTimeout(() => {
        hideAuthRequiredPopup();
    }, AUTH_REQUIRED_AUTO_HIDE_MS);
}
