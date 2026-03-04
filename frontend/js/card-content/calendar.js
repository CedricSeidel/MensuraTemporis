import { getDateInTimezone, sanitizeTimezone, setText } from './core.js';

export function renderCalendarCollapsed(elements, state) {
    const timezone = sanitizeTimezone(state.settings.timezone);
    const tzDate = getDateInTimezone(timezone);
    const local = new Date(Date.UTC(tzDate.year, tzDate.month - 1, tzDate.day, 12, 0, 0));
    const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
    const month = local.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

    setText(elements.calendarCurrentDay, String(tzDate.day).padStart(2, '0'));
    setText(elements.calendarCurrentMeta, `${weekday} · ${month} ${tzDate.year}`);
}
