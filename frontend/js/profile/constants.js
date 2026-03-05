export const STORAGE_KEYS = {
    users: 'mensura-auth-users-v1',
    session: 'mensura-auth-session-v1',
    profile: 'mensura-user-profile-card-v1',
};

export const APP_STORAGE_KEYS = {
    settings: 'mensura-settings-v2',
    weather: 'mensura-weather-v2',
    clock: 'mensura-clock-v2',
};

export const DEFAULT_PREFERENCES = {
    timezone: 'Europe/Berlin',
    weatherCity: 'Kassel',
    temperatureUnit: 'c',
    mode24h: true,
};

export const AVATAR_CHOICES = ['purple', 'orange', 'black', 'yellow'];

export const AVATAR_THEME_COLORS = {
    purple: {
        accent: '#d8c7ff',
        accentBlue: '#7c4dff',
    },
    orange: {
        accent: '#ffd2ac',
        accentBlue: '#f28b30',
    },
    black: {
        accent: '#c7ccd6',
        accentBlue: '#4d5976',
    },
    yellow: {
        accent: '#fff08e',
        accentBlue: '#f0cb00',
    },
};

export const MODAL_EXPAND_MS = 600;
export const MODAL_EXPAND_EASE = 'cubic-bezier(0.2, 0.0, 0.2, 1)';
export const MODAL_CLOSE_MS = 600;
export const MODAL_CLOSE_EASE = 'cubic-bezier(0.0, 0.0, 0.2, 1)';

export const NAV_ACTIVE_CLASS = 'is-active';
export const REGISTER_USERNAME_MIN_LEN = 3;
export const USER_SAVE_TOAST_MS = 1800;
export const USER_SAVE_TOAST_FADE_MS = 180;
