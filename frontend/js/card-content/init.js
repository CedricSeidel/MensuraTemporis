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

    restoreState(state);
    weatherRenderer.setupSkyVideoListeners();

    applyBodyModes(state);
    renderCalendarCollapsed(elements, state);
    renderEventsCollapsed(elements, state);
    void weatherRenderer.renderWeatherCollapsed(state);
    renderNoteSummary(elements, state);
    renderSettingsSummary(elements, state);

    clockController.resizeAnalogClockFace();
    clockController.updateClock(true);
    clockController.startClockAnimationLoop();

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
