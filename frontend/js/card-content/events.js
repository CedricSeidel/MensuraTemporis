import { EVENTS } from './config.js';
import { getDateInTimezone, sanitizeTimezone, setText } from './core.js';

function parseMinutes(text) {
    const [hour, minute] = text.split(':').map((part) => Number(part));
    return (hour * 60) + minute;
}

const eventsWithMinutes = EVENTS
    .map((event) => ({ ...event, minutes: parseMinutes(event.time) }))
    .sort((a, b) => a.minutes - b.minutes);

const criticalEventCount = eventsWithMinutes.filter((event) => event.priority === 'critical').length;

function formatMinutesToLabel(totalMinutes, use24h) {
    const hour24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;

    if (use24h) {
        return `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const hour12 = hour24 % 12 || 12;
    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export function renderEventsCollapsed(elements, state) {
    const timezone = sanitizeTimezone(state.settings.timezone);
    const nowInZone = getDateInTimezone(timezone);
    const nowMinutes = (nowInZone.hours * 60) + nowInZone.minutes;

    const nextToday = eventsWithMinutes.find((event) => event.minutes >= nowMinutes);
    const nextEvent = nextToday || eventsWithMinutes[0];
    const label = nextToday ? 'Today' : 'Tomorrow';

    setText(elements.eventsVisibleCounter, `${eventsWithMinutes.length} events visible`);
    setText(elements.eventsCriticalCount, `${criticalEventCount} Critical`);
    setText(elements.eventsNextTitle, nextEvent ? nextEvent.title : '-');
    setText(
        elements.eventsNextTime,
        `${label} · ${nextEvent ? formatMinutesToLabel(nextEvent.minutes, state.settings.mode24h) : '--:--'}`
    );
}
