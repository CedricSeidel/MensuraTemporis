export function getEventElement(event) {
    if (event?.target instanceof Element) return event.target;
    if (typeof event?.composedPath !== 'function') return null;
    const path = event.composedPath();
    return path.find((node) => node instanceof Element) || null;
}

export function isElementVisible(element) {
    if (!element) return false;
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

export function escapeCssValue(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
}
