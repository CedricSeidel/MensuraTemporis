(function initHotkeys() {
    function escapeCssValue(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return String(value).replace(/["\\]/g, '\\$&');
    }

    function hasModifierKeys(event) {
        return event.altKey || event.ctrlKey || event.metaKey;
    }

    function isTypingTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            target.isContentEditable
        );
    }

    function isVisible(element) {
        if (!element) return false;
        if (element.hidden) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function hasOpenModal() {
        return Boolean(document.querySelector('.modal-overlay:not([hidden])'));
    }

    document.addEventListener('keydown', (event) => {
        if (!event?.key || isTypingTarget(event.target)) return;
        if (event.repeat || hasModifierKeys(event)) return;
        if (hasOpenModal()) return;

        const key = event.key.toLowerCase();
        const selector = `[data-hotkey="${escapeCssValue(key)}"]`;
        const target = document.querySelector(selector);

        if (!isVisible(target)) return;

        event.preventDefault();
        target.click();
    });

    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const link = target ? target.closest('a[data-target-card]') : null;
        if (!link) return;

        event.preventDefault();
        const cardId = link.dataset.targetCard;
        const card = cardId ? document.getElementById(cardId) : null;
        if (card) {
            card.click();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (hasModifierKeys(event)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target instanceof Element ? event.target : null;
        const trigger = target ? target.closest('[role="button"]') : null;
        if (!trigger) return;

        event.preventDefault();
        trigger.click();
    });
})();
