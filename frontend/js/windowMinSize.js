(function enforceWindowMinimumSize() {
    const MIN_WINDOW_WIDTH = 1500;
    const MIN_WINDOW_HEIGHT = 930;
    const BASE_LAYOUT_WIDTH = 1500;
    const BASE_LAYOUT_HEIGHT = 930;
    const BASE_CARD_WIDTH = 476;
    const BASE_CARD_HEIGHT = 404;
    const MIN_DENSITY = 0.34;
    const CALENDAR_DAY_MIN_SIZE = 48;
    const CALENDAR_DAY_MAX_SIZE = 620;
    const CALENDAR_DAY_FROM_CARD_WIDTH = 0.88;
    const CALENDAR_DAY_FROM_CARD_HEIGHT = 0.66;
    const CALENDAR_META_RATIO = 0.12;
    const CALENDAR_VERTICAL_RESERVED_PX = 16;
    const CALENDAR_TEXT_SAMPLE = '88';
    const CALENDAR_MEASURE_ITERATIONS = 12;
    const CALENDAR_SAFE_WIDTH_PX = 10;
    const CALENDAR_SAFE_HEIGHT_PX = 12;
    const CALENDAR_DEFAULT_LINE_HEIGHT = 0.74;

    let lastCalendarDaySize = -1;
    let lastCalendarMetaSize = -1;
    let calendarMeasureNode = null;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function parsePx(value, fallback = 0) {
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric : fallback;
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
        const style = window.getComputedStyle(dayElement);
        const measureNode = getCalendarMeasureNode();
        const currentFontSize = parsePx(style.fontSize, 16);

        let lineHeightRatio = CALENDAR_DEFAULT_LINE_HEIGHT;
        const rawLineHeight = String(style.lineHeight || '').trim();
        if (rawLineHeight.endsWith('px')) {
            lineHeightRatio = parsePx(rawLineHeight, currentFontSize) / Math.max(currentFontSize, 1);
        } else {
            const parsedLineHeight = Number.parseFloat(rawLineHeight);
            if (Number.isFinite(parsedLineHeight)) {
                lineHeightRatio = parsedLineHeight;
            }
        }

        const letterSpacingPx = parsePx(style.letterSpacing, 0);
        const letterSpacingEm = letterSpacingPx / Math.max(currentFontSize, 1);

        measureNode.style.fontFamily = style.fontFamily;
        measureNode.style.fontWeight = style.fontWeight;
        measureNode.style.fontStyle = style.fontStyle;
        measureNode.style.fontVariantNumeric = style.fontVariantNumeric;
        measureNode.style.textTransform = style.textTransform;
        measureNode.style.lineHeight = String(lineHeightRatio);
        measureNode.style.letterSpacing = `${letterSpacingEm}em`;
        measureNode.style.fontSize = `${fontSizePx}px`;
        measureNode.textContent = text;

        const rect = measureNode.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
        };
    }

    function fitCalendarDaySize(dayElement, preferredSize, maxWidth, maxHeight) {
        let low = CALENDAR_DAY_MIN_SIZE;
        let high = clamp(preferredSize, CALENDAR_DAY_MIN_SIZE, CALENDAR_DAY_MAX_SIZE);
        let best = low;

        for (let index = 0; index < CALENDAR_MEASURE_ITERATIONS; index += 1) {
            const current = (low + high) / 2;
            const measured = measureCalendarText(dayElement, CALENDAR_TEXT_SAMPLE, current);
            const fitsWidth = measured.width + CALENDAR_SAFE_WIDTH_PX <= maxWidth;
            const fitsHeight = measured.height + CALENDAR_SAFE_HEIGHT_PX <= maxHeight;

            if (fitsWidth && fitsHeight) {
                best = current;
                low = current;
            } else {
                high = current;
            }
        }

        return clamp(Math.floor(best), CALENDAR_DAY_MIN_SIZE, CALENDAR_DAY_MAX_SIZE);
    }

    function applyCalendarDaySize(cardWidth, cardHeight) {
        const root = document.documentElement;
        if (!root) return;

        const collapsed = document.querySelector('.container1 .calendar-collapsed');
        const dayElement = document.getElementById('calendarCurrentDay');
        if (!collapsed || !dayElement) return;

        const safeCardWidth = Number.isFinite(cardWidth) ? cardWidth : BASE_CARD_WIDTH;
        const safeCardHeight = Number.isFinite(cardHeight) ? cardHeight : BASE_CARD_HEIGHT;
        const widthLimitedSize = safeCardWidth * CALENDAR_DAY_FROM_CARD_WIDTH;
        const heightLimitedSize = safeCardHeight * CALENDAR_DAY_FROM_CARD_HEIGHT;
        const preferredSize = clamp(
            Math.round(Math.min(widthLimitedSize, heightLimitedSize)),
            CALENDAR_DAY_MIN_SIZE,
            CALENDAR_DAY_MAX_SIZE
        );

        const dayStyle = window.getComputedStyle(dayElement);
        const dayPaddingX = parsePx(dayStyle.paddingLeft) + parsePx(dayStyle.paddingRight);
        const dayPaddingY = parsePx(dayStyle.paddingTop) + parsePx(dayStyle.paddingBottom);
        const caption = collapsed.querySelector('.summary-caption');
        const captionHeight = caption ? caption.getBoundingClientRect().height : 0;
        const collapsedStyle = window.getComputedStyle(collapsed);
        const collapsedGap = parsePx(collapsedStyle.rowGap || collapsedStyle.gap, 0);

        const maxTextWidth = Math.max(40, collapsed.clientWidth - dayPaddingX - CALENDAR_SAFE_WIDTH_PX);
        const maxTextHeight = Math.max(
            40,
            collapsed.clientHeight - captionHeight - collapsedGap - dayPaddingY - CALENDAR_VERTICAL_RESERVED_PX
        );
        const daySize = fitCalendarDaySize(dayElement, preferredSize, maxTextWidth, maxTextHeight);

        const metaSize = clamp(
            Math.round(daySize * CALENDAR_META_RATIO),
            12,
            68
        );

        if (daySize === lastCalendarDaySize && metaSize === lastCalendarMetaSize) {
            return;
        }

        lastCalendarDaySize = daySize;
        lastCalendarMetaSize = metaSize;
        root.style.setProperty('--calendar-day-size', `${daySize}px`);
        root.style.setProperty('--calendar-meta-size', `${metaSize}px`);
    }

    function isBelowMinimum() {
        return window.outerWidth < MIN_WINDOW_WIDTH || window.outerHeight < MIN_WINDOW_HEIGHT;
    }

    function applyLayoutTokens() {
        const root = document.documentElement;
        if (!root) return;

        const viewportWidth = Math.max(320, window.innerWidth || 0);
        const viewportHeight = Math.max(320, window.innerHeight || 0);
        const rootStyles = window.getComputedStyle(root);
        const maxContentWidthToken = Number.parseFloat(rootStyles.getPropertyValue('--max-width-content'));
        const maxContentWidth = Number.isFinite(maxContentWidthToken) ? maxContentWidthToken : 2400;
        const effectiveLayoutWidth = Math.min(viewportWidth, maxContentWidth);
        const densityFromWidth = effectiveLayoutWidth / BASE_LAYOUT_WIDTH;
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
        const availableWidth = Math.max(280, effectiveLayoutWidth - (gridPad * 2) - (gridGap * (columns - 1)));
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
        applyCalendarDaySize(cardWidth, cardHeight);
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
            applyLayoutTokens();
            enforceMinimumSize();
        });
    }

    window.addEventListener('resize', scheduleEnforce, { passive: true });
    window.addEventListener('load', scheduleEnforce);
    window.addEventListener('DOMContentLoaded', scheduleEnforce);
    scheduleEnforce();
})();
