(function initHotkeys() {
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
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function hasOpenModal() {
        return Boolean(document.querySelector('.modal-overlay:not([hidden])'));
    }

    document.addEventListener('keydown', (event) => {
        if (!event?.key || isTypingTarget(event.target)) return;
        if (hasOpenModal()) return;

        const key = event.key.toLowerCase();
        const selector = `[data-hotkey="${CSS.escape(key)}"]`;
        const target = document.querySelector(selector);

        if (!isVisible(target)) return;

        event.preventDefault();
        target.click();
    });

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-target-card]');
        if (!link) return;

        event.preventDefault();
        const cardId = link.dataset.targetCard;
        const card = cardId ? document.getElementById(cardId) : null;
        if (card) {
            card.click();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const trigger = event.target.closest('[role="button"]');
        if (!trigger) return;

        event.preventDefault();
        trigger.click();
    });
})();
