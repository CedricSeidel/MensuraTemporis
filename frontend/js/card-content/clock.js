import {
    formatDigitalClock,
    getTimePartsInTimezone,
    sanitizeTimezone,
    setText,
} from './core.js';

export function createClockController(elements, state) {
    let clockAnimationFrameId = null;
    let analogClockFaceSize = 0;
    const CLOCK_HORIZONTAL_GUTTER = 44;
    const CLOCK_VERTICAL_GUTTER = 78;
    const CLOCK_SIZE_SCALE = 0.82;

    function resizeAnalogClockFace() {
        const collapsed = document.querySelector('.container5 .clock-collapsed');
        if (!collapsed || !elements.analogClockFace) return;

        const collapsedRect = collapsed.getBoundingClientRect();
        const availableWidth = Math.max(120, collapsedRect.width - CLOCK_HORIZONTAL_GUTTER);
        const availableHeight = Math.max(120, collapsedRect.height - CLOCK_VERTICAL_GUTTER);
        const size = Math.floor(Math.min(availableWidth, availableHeight) * CLOCK_SIZE_SCALE);

        if (!size || size === analogClockFaceSize) return;

        analogClockFaceSize = size;
        elements.analogClockFace.style.width = `${size}px`;
        elements.analogClockFace.style.height = `${size}px`;
    }

    function updateClock(showMeta = true) {
        const now = new Date();
        const timezone = sanitizeTimezone(state.clock.timezone, state.settings.timezone);
        const parts = getTimePartsInTimezone(now, timezone);
        const milliseconds = now.getMilliseconds();

        const secondProgress = parts.seconds + (milliseconds / 1000);
        const minuteProgress = parts.minutes + (secondProgress / 60);
        const hourProgress = (parts.hours % 12) + (minuteProgress / 60);

        elements.clockHourHand.style.transform = `translate(-50%, 0) rotate(${hourProgress * 30}deg)`;
        elements.clockMinuteHand.style.transform = `translate(-50%, 0) rotate(${minuteProgress * 6}deg)`;
        elements.clockSecondHand.style.transform = `translate(-50%, 0) rotate(${secondProgress * 6}deg)`;

        if (!showMeta) return;

        setText(elements.clockTopLine, `${state.clock.city} / ${timezone}`);
        setText(elements.clockBottomLine, formatDigitalClock(now, timezone, state.settings.mode24h));
    }

    function startClockAnimationLoop() {
        if (clockAnimationFrameId) {
            window.cancelAnimationFrame(clockAnimationFrameId);
        }

        const renderFrame = () => {
            updateClock(false);
            clockAnimationFrameId = window.requestAnimationFrame(renderFrame);
        };

        renderFrame();
    }

    return {
        resizeAnalogClockFace,
        updateClock,
        startClockAnimationLoop,
    };
}
