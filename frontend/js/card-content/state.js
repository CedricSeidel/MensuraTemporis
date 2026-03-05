import { DEFAULT_CITY, DEFAULT_TIMEZONE, STORAGE_KEYS } from './config.js';
import { readStorage, sanitizeTimezone } from './core.js';

function readBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function sanitizeCity(value, fallback = DEFAULT_CITY) {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

export function createInitialState() {
    return {
        settings: {
            mode24h: true,
            focus: false,
            compact: false,
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
    const savedSettings = readStorage(STORAGE_KEYS.settings, null);
    if (savedSettings) {
        state.settings.mode24h = readBoolean(savedSettings.mode24h, state.settings.mode24h);
        state.settings.focus = readBoolean(savedSettings.focus, state.settings.focus);
        state.settings.compact = readBoolean(savedSettings.compact, state.settings.compact);
        state.settings.timezone = sanitizeTimezone(savedSettings.timezone, state.settings.timezone);
    }

    const savedWeather = readStorage(STORAGE_KEYS.weather, null);
    state.weather.city = DEFAULT_CITY;
    if (savedWeather) {
        state.weather.city = sanitizeCity(savedWeather.city, state.weather.city);
        state.weather.timezone = sanitizeTimezone(savedWeather.timezone, state.weather.timezone);
        state.weather.unit = savedWeather.unit === 'f' ? 'f' : 'c';
    }

    const savedClock = readStorage(STORAGE_KEYS.clock, null);
    state.clock.city = state.weather.city;
    if (savedClock) {
        state.clock.city = sanitizeCity(savedClock.city, state.weather.city);
        state.clock.timezone = sanitizeTimezone(savedClock.timezone, state.settings.timezone);
    } else {
        state.clock.timezone = state.settings.timezone;
    }

    const savedPostits = readStorage(STORAGE_KEYS.postits, []);
    state.postits = Array.isArray(savedPostits)
        ? savedPostits.filter((entry) => entry && typeof entry.text === 'string')
        : [];
}
