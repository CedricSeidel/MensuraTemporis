import { renderCalendarCollapsed } from './calendar.js';
import { createClockController } from './clock.js';
import { getCardContentElements, hasRequiredElements } from './dom.js';
import { renderEventsCollapsed } from './events.js';
import { renderNoteSummary } from './notes.js';
import { applyBodyModes, renderSettingsSummary } from './settings.js';
import { createInitialState, restoreState } from './state.js';
import { createWeatherRenderer } from './weather.js';

const INIT_FLAG = '__mensuraCardContentInitialized__';

export function initCardContent() {
    if (window[INIT_FLAG]) return;

    const elements = getCardContentElements();
    if (!hasRequiredElements(elements)) return;
    window[INIT_FLAG] = true;

    const state = createInitialState();
    const weatherRenderer = createWeatherRenderer(elements);
    const clockController = createClockController(elements, state);

    function isValidTimezone(value) {
        if (!value || typeof value !== 'string') return false;
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
            return true;
        } catch {
            return false;
        }
    }

    function applyRuntimePreferences(detail) {
        if (!detail || typeof detail !== 'object') return;

        const settings = detail.settings && typeof detail.settings === 'object' ? detail.settings : null;
        const weather = detail.weather && typeof detail.weather === 'object' ? detail.weather : null;
        const clock = detail.clock && typeof detail.clock === 'object' ? detail.clock : null;

        if (settings) {
            if (typeof settings.mode24h === 'boolean') state.settings.mode24h = settings.mode24h;
            if (isValidTimezone(settings.timezone)) state.settings.timezone = settings.timezone;
        }

        state.settings.focus = true;
        state.settings.compact = true;

        if (weather) {
            const weatherCity = String(weather.city || '').trim();
            if (weatherCity) state.weather.city = weatherCity;
            if (isValidTimezone(weather.timezone)) state.weather.timezone = weather.timezone;
            if (weather.unit === 'f' || weather.unit === 'c') state.weather.unit = weather.unit;
        }

        if (clock) {
            const clockCity = String(clock.city || '').trim();
            if (clockCity) state.clock.city = clockCity;
            if (isValidTimezone(clock.timezone)) state.clock.timezone = clock.timezone;
        }

        applyBodyModes(state);
        renderCalendarCollapsed(elements, state);
        renderEventsCollapsed(elements, state);
        renderSettingsSummary(elements, state);
        clockController.updateClock(true);
        void weatherRenderer.renderWeatherCollapsed(state, { forceFetch: true });
    }

    restoreState(state);

    applyBodyModes(state);
    renderCalendarCollapsed(elements, state);
    renderEventsCollapsed(elements, state);
    void weatherRenderer.renderWeatherCollapsed(state);
    renderNoteSummary(elements, state);
    renderSettingsSummary(elements, state);

    clockController.resizeAnalogClockFace();
    clockController.updateClock(true);
    clockController.startClockAnimationLoop();

    void weatherRenderer.detectSystemLocation(state).then((detected) => {
        if (!detected) return;
        clockController.updateClock(true);
        void weatherRenderer.renderWeatherCollapsed(state, { forceFetch: true });
    });

    window.addEventListener('mensura:preferences-updated', (event) => {
        applyRuntimePreferences(event?.detail);
    });

    window.addEventListener('resize', clockController.resizeAnalogClockFace);

    setInterval(() => {
        renderCalendarCollapsed(elements, state);
        renderEventsCollapsed(elements, state);
        clockController.updateClock(true);
    }, 1000);

    setInterval(() => {
        void weatherRenderer.refreshSkyScene(state);
    }, 180000);

}
