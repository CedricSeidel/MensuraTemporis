export function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore write errors
    }
}

export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore remove errors
    }
}

export function readBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

export function isValidTimezone(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

export function applyAlwaysOnBodyModes(targetDocument = document) {
    const body = targetDocument?.body;
    if (!body) return;
    body.classList.add('app-focus');
    body.classList.add('app-compact');
}
