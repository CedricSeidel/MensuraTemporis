import { escapeCssValue, getEventElement, isElementVisible } from './core/domUtils.js';

(function initHotkeys() {

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

    function hasOpenModal() {
        return Boolean(document.querySelector('.modal-overlay:not([hidden])'));
    }

    function prepareCardSwitch(cardId) {
        if (window.ProfileModalController?.hasOpenModal?.()) {
            if (cardId && window.ProfileModalController.switchToCard?.(cardId)) {
                return true;
            }

            window.ProfileModalController.closeForCardSwitch?.();
            return false;
        }

        if (hasOpenModal()) {
            if (cardId && window.CardExpansion?.openCardByIdWithoutExpandAnimation) {
                document.querySelectorAll('.modal-overlay:not([hidden])').forEach((modal) => {
                    modal.hidden = true;
                });
                document.querySelector('.grid')?.classList.remove('modal-grid-open');
                document.body.classList.remove('modal-open');
                window.CardExpansion.openCardByIdWithoutExpandAnimation(cardId);
                return true;
            }

            document.querySelectorAll('.modal-overlay:not([hidden])').forEach((modal) => {
                modal.hidden = true;
            });
            document.querySelector('.grid')?.classList.remove('modal-grid-open');
            document.body.classList.remove('modal-open');
            return;
        }
        return false;
    }

    document.addEventListener('keydown', (event) => {
        if (!event?.key || isTypingTarget(event.target)) return;
        if (event.repeat || hasModifierKeys(event)) return;

        const key = event.key.toLowerCase();
        const selector = `[data-hotkey="${escapeCssValue(key)}"]`;
        const target = document.querySelector(selector);

        if (!isElementVisible(target)) return;

        const cardId = target instanceof Element ? target.getAttribute('data-target-card') : '';

        event.preventDefault();

        if (cardId && window.CardExpansion?.openCardById) {
            if (prepareCardSwitch(cardId)) return;
            window.CardExpansion.openCardById(cardId);
            return;
        }

        target.click();
    });

    document.addEventListener('click', (event) => {
        const target = getEventElement(event);
        const link = target ? target.closest('a[data-target-card]') : null;
        if (!link) return;

        event.preventDefault();
        const cardId = link.dataset.targetCard;
        if (cardId && window.CardExpansion?.openCardById) {
            if (prepareCardSwitch(cardId)) {
                event.stopImmediatePropagation();
                return;
            }
            window.CardExpansion.openCardById(cardId);
            event.stopImmediatePropagation();
            return;
        }

        const card = cardId ? document.getElementById(cardId) : null;
        if (card) card.click();
    });

    document.addEventListener('keydown', (event) => {
        if (hasModifierKeys(event)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = getEventElement(event);
        const trigger = target ? target.closest('[role="button"]') : null;
        if (!trigger) return;

        event.preventDefault();
        trigger.click();
    });
})();
