(function enforceWindowMinimumSize() {
    const MIN_WINDOW_WIDTH = 1508;
    const MIN_WINDOW_HEIGHT = 932;
    const BASE_LAYOUT_WIDTH = 1508;
    const BASE_LAYOUT_HEIGHT = 932;
    const BASE_CARD_WIDTH = 476;
    const BASE_CARD_HEIGHT = 404;
    const MIN_DENSITY = 0.34;
    const CALENDAR_DAY_MIN_SIZE = 48;
    const CALENDAR_DAY_MAX_SIZE = 620;
    const CALENDAR_HORIZONTAL_PADDING_RATIO = 0.08;
    const CALENDAR_VERTICAL_RESERVED_PX = 12;
    const CALENDAR_FIT_PADDING_EM = 0.12;

    let calendarMeasureNode = null;
    let calendarResizeObserver = null;
    let calendarMutationObserver = null;
    let calendarRafId = 0;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function getCalendarMeasureNode() {
        if (calendarMeasureNode) return calendarMeasureNode;
        const node = document.createElement('span');
        node.setAttribute('aria-hidden', 'true');
        node.style.position = 'fixed';
        node.style.left = '-99999px';
        node.style.top = '-99999px';
        node.style.visibility = 'hidden';
        node.style.pointerEvents = 'none';
        node.style.whiteSpace = 'nowrap';
        node.style.padding = '0';
        node.style.margin = '0';
        node.style.border = '0';
        document.body.appendChild(node);
        calendarMeasureNode = node;
        return node;
    }

    function measureCalendarText(dayElement, text, fontSizePx) {
        const measureNode = getCalendarMeasureNode();
        const style = window.getComputedStyle(dayElement);
        measureNode.style.fontFamily = style.fontFamily;
        measureNode.style.fontWeight = style.fontWeight;
        measureNode.style.fontStyle = style.fontStyle;
        measureNode.style.letterSpacing = style.letterSpacing;
        measureNode.style.fontVariantNumeric = style.fontVariantNumeric;
        measureNode.style.lineHeight = style.lineHeight;
        measureNode.style.textTransform = style.textTransform;
        measureNode.style.fontSize = `${fontSizePx}px`;
        measureNode.textContent = text || '--';
        const rect = measureNode.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    function fitCalendarDaySize(dayElement, text, maxWidth, maxHeight) {
        let low = CALENDAR_DAY_MIN_SIZE;
        let high = CALENDAR_DAY_MAX_SIZE;
        let best = CALENDAR_DAY_MIN_SIZE;

        for (let index = 0; index < 14; index += 1) {
            const size = (low + high) / 2;
            const measured = measureCalendarText(dayElement, text, size);
            const horizontalSafeSpace = size * CALENDAR_FIT_PADDING_EM;
            const fitsWidth = measured.width + horizontalSafeSpace <= maxWidth;
            const fitsHeight = measured.height <= maxHeight;

            if (fitsWidth && fitsHeight) {
                best = size;
                low = size;
            } else {
                high = size;
            }
        }

        return clamp(best, CALENDAR_DAY_MIN_SIZE, CALENDAR_DAY_MAX_SIZE);
    }

    function applyCalendarDaySize() {
        const root = document.documentElement;
        if (!root) return;

        const collapsed = document.querySelector('.container1 .calendar-collapsed');
        const dayElement = document.getElementById('calendarCurrentDay');
        if (!collapsed || !dayElement) return;

        const caption = collapsed.querySelector('.summary-caption');
        const collapsedRect = collapsed.getBoundingClientRect();
        const captionHeight = caption ? caption.getBoundingClientRect().height : 0;

        const horizontalPadding = Math.max(12, collapsedRect.width * CALENDAR_HORIZONTAL_PADDING_RATIO);
        const maxWidth = Math.max(120, collapsedRect.width - (horizontalPadding * 2));
        const maxHeight = Math.max(120, collapsedRect.height - captionHeight - CALENDAR_VERTICAL_RESERVED_PX);
        const text = (dayElement.textContent || '--').trim() || '--';

        const daySize = fitCalendarDaySize(dayElement, text, maxWidth, maxHeight);
        const metaSize = clamp(daySize * 0.12, 12, 68);

        root.style.setProperty('--calendar-day-size', `${daySize.toFixed(2)}px`);
        root.style.setProperty('--calendar-meta-size', `${metaSize.toFixed(2)}px`);
    }

    function scheduleCalendarDaySizeUpdate() {
        if (calendarRafId) return;
        calendarRafId = window.requestAnimationFrame(() => {
            calendarRafId = 0;
            applyCalendarDaySize();
        });
    }

    let hasCalendarResizeFallback = false;
    let hasCalendarMutationFallback = false;

    function initCalendarObservers() {
        if ((calendarResizeObserver || hasCalendarResizeFallback) && (calendarMutationObserver || hasCalendarMutationFallback)) return;

        const collapsed = document.querySelector('.container1 .calendar-collapsed');
        const dayElement = document.getElementById('calendarCurrentDay');

        if (!collapsed || !dayElement) return;

        if (typeof ResizeObserver === 'function') {
            calendarResizeObserver = new ResizeObserver(() => {
                scheduleCalendarDaySizeUpdate();
            });
            calendarResizeObserver.observe(collapsed);
        } else if (!hasCalendarResizeFallback) {
            hasCalendarResizeFallback = true;
            window.addEventListener('resize', scheduleCalendarDaySizeUpdate, { passive: true });
        }

        if (typeof MutationObserver === 'function') {
            calendarMutationObserver = new MutationObserver(() => {
                scheduleCalendarDaySizeUpdate();
            });
            calendarMutationObserver.observe(dayElement, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        } else if (!hasCalendarMutationFallback) {
            hasCalendarMutationFallback = true;
            window.setInterval(scheduleCalendarDaySizeUpdate, 1000);
        }
    }

    function isBelowMinimum() {
        return window.outerWidth < MIN_WINDOW_WIDTH || window.outerHeight < MIN_WINDOW_HEIGHT;
    }

    function applyLayoutTokens() {
        const root = document.documentElement;
        if (!root) return;

        const viewportWidth = Math.max(320, window.innerWidth || 0);
        const viewportHeight = Math.max(320, window.innerHeight || 0);
        const densityFromWidth = viewportWidth / BASE_LAYOUT_WIDTH;
        const densityFromHeight = viewportHeight / BASE_LAYOUT_HEIGHT;
        const density = clamp(Math.min(densityFromWidth, densityFromHeight), MIN_DENSITY, 1);

        const header = document.querySelector('header');
        const headerHeight = header
            ? Math.ceil(header.getBoundingClientRect().height)
            : Math.ceil(72 * density);

        const columns = 3;
        const rows = 2;
        const gridGap = clamp(20 * density, 8, 24);
        const gridPad = clamp(20 * density, 10, 24);
        const gridTopInset = clamp(12 * density, 8, 14);
        const topPadding = headerHeight + gridTopInset;
        const availableWidth = Math.max(280, viewportWidth - (gridPad * 2) - (gridGap * (columns - 1)));
        const availableHeight = Math.max(220, viewportHeight - topPadding - gridPad - (gridGap * (rows - 1)));
        const cardWidth = availableWidth / columns;
        const cardHeight = availableHeight / rows;
        const cardDensity = Math.min(cardWidth / BASE_CARD_WIDTH, cardHeight / BASE_CARD_HEIGHT);
        const contentDensity = clamp(Math.min(density, cardDensity), 0.3, 1);

        root.style.setProperty('--app-density', density.toFixed(4));
        root.style.setProperty('--content-density', contentDensity.toFixed(4));
        root.style.setProperty('--grid-columns', '3');
        root.style.setProperty('--grid-rows', '2');
        root.style.setProperty('--header-height', `${headerHeight}px`);
        scheduleCalendarDaySizeUpdate();
    }

    function enforceMinimumSize() {
        if (typeof window.resizeTo !== 'function') return;
        if (!isBelowMinimum()) return;

        const targetWidth = Math.max(window.outerWidth, MIN_WINDOW_WIDTH);
        const targetHeight = Math.max(window.outerHeight, MIN_WINDOW_HEIGHT);
        window.resizeTo(targetWidth, targetHeight);
    }

    let rafId = 0;
    function scheduleEnforce() {
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => {
            rafId = 0;
            initCalendarObservers();
            applyLayoutTokens();
            enforceMinimumSize();
        });
    }

    window.addEventListener('resize', scheduleEnforce, { passive: true });
    window.addEventListener('load', scheduleEnforce);
    window.addEventListener('DOMContentLoaded', scheduleEnforce);
    scheduleEnforce();
})();
