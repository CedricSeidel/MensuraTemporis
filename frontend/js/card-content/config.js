export const DEFAULT_TIMEZONE = 'Europe/Berlin';

export const NOTE_PREVIEW_MAX_CHARS = 80;
export const NOTE_STATUS_IDLE = 'Status: inaktiv';
export const NOTE_STATUS_ACTIVE = 'Status: aktiv';

export const STORAGE_KEYS = {
    settings: 'mensura-settings-v2',
    weather: 'mensura-weather-v2',
    clock: 'mensura-clock-v2',
    postits: 'mensura-postits-v2',
};

export const EVENTS = [
    { title: 'Team Sync', time: '09:30', priority: 'critical' },
    { title: 'Code Review', time: '11:00', priority: 'normal' },
    { title: 'Client Call', time: '13:30', priority: 'critical' },
    { title: 'Design Handoff', time: '15:00', priority: 'normal' },
    { title: 'Sprint Planning', time: '16:30', priority: 'critical' },
    { title: 'Follow-Up Mails', time: '18:00', priority: 'low' },
    { title: 'Backlog Cleanup', time: '19:15', priority: 'low' },
    { title: 'Release Notes', time: '20:00', priority: 'normal' },
];

export const WEATHER_PROFILES = {
    berlin: { label: 'Berlin', tempC: 7, wind: 14, humidity: 62, rain: 18, condition: 'bewölkt' },
    hamburg: { label: 'Hamburg', tempC: 6, wind: 18, humidity: 68, rain: 32, condition: 'windig' },
    munich: { label: 'Munich', tempC: 4, wind: 10, humidity: 54, rain: 8, condition: 'klar' },
    london: { label: 'London', tempC: 9, wind: 20, humidity: 76, rain: 44, condition: 'niesel' },
    tokyo: { label: 'Tokyo', tempC: 12, wind: 11, humidity: 58, rain: 14, condition: 'trocken' },
    newyork: { label: 'New York', tempC: 3, wind: 17, humidity: 61, rain: 22, condition: 'kalt' },
};

export const WEATHER_VIDEO_SOURCES = {};
