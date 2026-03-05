import { DEFAULT_TIMEZONE } from './config.js';
import {
    applyAlwaysOnBodyModes,
    isValidTimezone,
    readBoolean,
    readStorage,
} from '../core/runtimeUtils.js';

export {
    applyAlwaysOnBodyModes,
    isValidTimezone,
    readBoolean,
    readStorage,
};

export function setText(element, value) {
    if (!element) return;
    element.textContent = value;
}

export function sanitizeTimezone(value, fallback = DEFAULT_TIMEZONE) {
    return isValidTimezone(value) ? value : fallback;
}

export function formatDigitalClock(date, timeZone, use24h) {
    const locale = use24h ? 'en-GB' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24h,
    }).format(date);
}

export function getTimePartsInTimezone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        hours: Number(map.hour),
        minutes: Number(map.minute),
        seconds: Number(map.second),
    };
}

export function getDateInTimezone(timeZone) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hours: Number(map.hour),
        minutes: Number(map.minute),
    };
}

export function toZoneShort(value) {
    if (!value) return 'LOCAL';
    const last = value.split('/').pop() || value;
    return last.replace(/_/g, ' ').slice(0, 3).toUpperCase();
}
