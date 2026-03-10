import { DEFAULT_CITY, DEFAULT_TIMEZONE, STORAGE_KEYS } from './config.js';
import { getCurrentUserScopedStorageKey, readBoolean, readStorage, sanitizeTimezone } from './core.js';

const STORAGE_MISSING = Symbol('storage-missing');

function readScopedStorage(baseKey, fallback) {
    const scopedKey = getCurrentUserScopedStorageKey(baseKey);
    if (scopedKey === baseKey) {
        return readStorage(baseKey, fallback);
    }

    const scopedValue = readStorage(scopedKey, STORAGE_MISSING);
    if (scopedValue === STORAGE_MISSING) {
        return readStorage(baseKey, fallback);
    }

    return scopedValue;
}

function sanitizeCity(value, fallback = DEFAULT_CITY) {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

export function createInitialState() {
    return {
        settings: {
            mode24h: true,
            focus: true,
            compact: true,
            timezone: DEFAULT_TIMEZONE,
        },
        weather: {
            city: DEFAULT_CITY,
            timezone: DEFAULT_TIMEZONE,
            unit: 'c',
        },
        clock: {
            city: DEFAULT_CITY,
            timezone: DEFAULT_TIMEZONE,
        },
        postits: [],
    };
}

export function restoreState(state) {
    const savedSettings = readScopedStorage(STORAGE_KEYS.settings, null);
    if (savedSettings) {
        state.settings.mode24h = readBoolean(savedSettings.mode24h, state.settings.mode24h);
        state.settings.timezone = sanitizeTimezone(savedSettings.timezone, state.settings.timezone);
    }
    state.settings.focus = true;
    state.settings.compact = true;

    const savedWeather = readScopedStorage(STORAGE_KEYS.weather, null);
    state.weather.city = DEFAULT_CITY;
    if (savedWeather) {
        state.weather.city = sanitizeCity(savedWeather.city, state.weather.city);
        state.weather.timezone = sanitizeTimezone(savedWeather.timezone, state.weather.timezone);
        state.weather.unit = savedWeather.unit === 'f' ? 'f' : 'c';
    }

    const savedClock = readScopedStorage(STORAGE_KEYS.clock, null);
    state.clock.city = state.weather.city;
    if (savedClock) {
        state.clock.city = sanitizeCity(savedClock.city, state.weather.city);
        state.clock.timezone = sanitizeTimezone(savedClock.timezone, state.settings.timezone);
    } else {
        state.clock.timezone = state.settings.timezone;
    }

    const savedPostits = readScopedStorage(STORAGE_KEYS.postits, []);
    state.postits = Array.isArray(savedPostits)
        ? savedPostits.filter((entry) => entry && typeof entry.text === 'string')
        : [];
}
