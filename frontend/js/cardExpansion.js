/**
 * Card Expansion System
 * Click on card: expand
 * Click outside / close button / ESC: close
 * Click another card while expanded: switch
 */
export class CardExpansion {
    static state = {
        expandedInstance: null,
        isAnimating: false,
    };
    static NAV_ACTIVE_CLASS = 'is-active';

    static TIMING = {
        expand: 600,
        ease: 'cubic-bezier(0.2, 0.0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    };

    constructor(cardElement) {
        this.card = cardElement;
        this.card._cardExpansionInstance = this;
        this.init();
    }

    init() {
        this.card.addEventListener('click', (event) => {
            this.handleCardClick(event);
        });
    }

    static syncActiveNav(cardId = '') {
        const links = document.querySelectorAll('a[data-target-card]');
        links.forEach((link) => {
            const isActive = link.dataset.targetCard === cardId;
            link.classList.toggle(CardExpansion.NAV_ACTIVE_CLASS, isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    static getInstanceByCardId(cardId) {
        if (!cardId) return null;
        const card = document.getElementById(cardId);
        if (!card) return null;
        return card._cardExpansionInstance || null;
    }

    static openCardById(cardId) {
        const nextInstance = CardExpansion.getInstanceByCardId(cardId);
        if (!nextInstance) return;

        if (CardExpansion.state.expandedInstance === nextInstance) {
            void CardExpansion.closeExpandedCard();
            return;
        }

        if (CardExpansion.state.expandedInstance) {
            CardExpansion.switchExpandedCard(nextInstance);
            return;
        }

        nextInstance.expandCard();
    }

    static openCardByIdWithoutExpandAnimation(cardId) {
        const nextInstance = CardExpansion.getInstanceByCardId(cardId);
        if (!nextInstance) return;

        if (CardExpansion.state.expandedInstance === nextInstance) {
            CardExpansion.syncActiveNav(cardId);
            return;
        }

        if (CardExpansion.state.expandedInstance) {
            CardExpansion.switchExpandedCard(nextInstance);
            return;
        }

        const grid = document.querySelector('.grid');
        if (!grid) return;

        const nextCard = nextInstance.card;
        const nextCardRect = nextCard.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const gridStyles = window.getComputedStyle(grid);
        const paddingTop = parseFloat(gridStyles.paddingTop) || 0;
        const paddingLeft = parseFloat(gridStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(gridStyles.paddingRight) || 0;
        const paddingBottom = parseFloat(gridStyles.paddingBottom) || 0;

        nextCard._originalRect = nextCardRect;
        nextCard._originalStyles = {
            position: nextCard.style.position,
            top: nextCard.style.top,
            left: nextCard.style.left,
            width: nextCard.style.width,
            height: nextCard.style.height,
            zIndex: nextCard.style.zIndex,
            transition: nextCard.style.transition,
            opacity: nextCard.style.opacity,
        };

        const otherCards = Array.from(grid.children).filter((card) => card !== nextCard);
        otherCards.forEach((card) => card.classList.add('card--hidden'));
        nextCard._hiddenCards = otherCards;

        const targetRect = {
            top: gridRect.top + paddingTop,
            left: gridRect.left + paddingLeft,
            width: gridRect.width - paddingLeft - paddingRight,
            height: gridRect.height - paddingTop - paddingBottom,
        };

        nextCard.classList.remove('card--closing');
        nextCard.classList.remove('card--hidden');
        nextCard.style.position = 'fixed';
        nextCard.style.top = `${targetRect.top}px`;
        nextCard.style.left = `${targetRect.left}px`;
        nextCard.style.width = `${targetRect.width}px`;
        nextCard.style.height = `${targetRect.height}px`;
        nextCard.style.zIndex = '1000';
        nextCard.style.opacity = '1';
        nextCard.style.transition = 'none';
        nextCard.classList.add('card--expanded');
        nextCard._isExpanded = true;

        CardExpansion.state.expandedInstance = nextInstance;
        CardExpansion.syncActiveNav(nextCard.id);
        nextInstance.setupExpandedInteractions();
    }

    static switchExpandedCard(nextInstance) {
        const current = CardExpansion.state.expandedInstance;
        if (!current || current === nextInstance || CardExpansion.state.isAnimating) return;

        const grid = document.querySelector('.grid');
        if (!grid) return;

        CardExpansion.state.isAnimating = true;

        const currentCard = current.card;
        const nextCard = nextInstance.card;
        const expandedRect = currentCard.getBoundingClientRect();

        current.cleanupExpandedInteractions({ keepHiddenCards: true });
        currentCard.classList.add('card--closing');
        currentCard.classList.add('card--hidden');
        current.restoreCardToGrid({ keepClosingState: true });
        currentCard._isExpanded = false;

        const nextCardRect = nextCard.getBoundingClientRect();
        nextCard._originalRect = nextCardRect;
        nextCard._originalStyles = {
            position: nextCard.style.position,
            top: nextCard.style.top,
            left: nextCard.style.left,
            width: nextCard.style.width,
            height: nextCard.style.height,
            zIndex: nextCard.style.zIndex,
            transition: nextCard.style.transition,
            opacity: nextCard.style.opacity,
        };

        const otherCards = Array.from(grid.children).filter((card) => card !== nextCard);
        otherCards.forEach((card) => card.classList.add('card--hidden'));
        nextCard._hiddenCards = otherCards;

        nextCard.classList.remove('card--closing');
        nextCard.classList.remove('card--hidden');
        nextCard.style.position = 'fixed';
        nextCard.style.top = `${expandedRect.top}px`;
        nextCard.style.left = `${expandedRect.left}px`;
        nextCard.style.width = `${expandedRect.width}px`;
        nextCard.style.height = `${expandedRect.height}px`;
        nextCard.style.zIndex = '1000';
        nextCard.style.opacity = '1';
        nextCard.style.transition = 'none';
        nextCard.classList.add('card--expanded');
        nextCard._isExpanded = true;

        CardExpansion.state.expandedInstance = nextInstance;
        CardExpansion.syncActiveNav(nextCard.id);
        nextInstance.setupExpandedInteractions();

        CardExpansion.state.isAnimating = false;
    }

    handleCardClick(event) {
        if (CardExpansion.state.isAnimating) return;

        const target = event.target instanceof Element ? event.target : null;
        const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const closeFromPath = eventPath.find(
            (node) => node instanceof Element && node.matches('[data-container-close]')
        );
        const closeButton = (target && target.closest('[data-container-close]')) || closeFromPath || null;
        if (closeButton) {
            if (CardExpansion.state.expandedInstance === this) {
                void CardExpansion.closeExpandedCard();
            }
            return;
        }

        if (CardExpansion.state.expandedInstance === this) {
            return;
        }

        if (CardExpansion.state.expandedInstance) {
            CardExpansion.switchExpandedCard(this);
            return;
        }

        this.expandCard();
    }

    expandCard() {
        if (CardExpansion.state.isAnimating) return;
        const grid = document.querySelector('.grid');
        if (!grid) return;

        CardExpansion.state.isAnimating = true;
        CardExpansion.state.expandedInstance = this;
        this.card._isExpanded = true;
        this.card.classList.remove('card--closing');
        this.card.classList.remove('card--hidden');
        CardExpansion.syncActiveNav(this.card.id);

        const otherCards = Array.from(grid.children).filter((card) => card !== this.card);
        otherCards.forEach((card) => card.classList.add('card--hidden'));
        this.card._hiddenCards = otherCards;

        const cardRect = this.card.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const gridStyles = window.getComputedStyle(grid);
        const paddingTop = parseFloat(gridStyles.paddingTop) || 0;
        const paddingLeft = parseFloat(gridStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(gridStyles.paddingRight) || 0;
        const paddingBottom = parseFloat(gridStyles.paddingBottom) || 0;

        this.card._originalRect = cardRect;
        this.card._originalStyles = {
            position: this.card.style.position,
            top: this.card.style.top,
            left: this.card.style.left,
            width: this.card.style.width,
            height: this.card.style.height,
            zIndex: this.card.style.zIndex,
            transition: this.card.style.transition,
            opacity: this.card.style.opacity,
        };

        this.card.style.position = 'fixed';
        this.card.style.top = `${cardRect.top}px`;
        this.card.style.left = `${cardRect.left}px`;
        this.card.style.width = `${cardRect.width}px`;
        this.card.style.height = `${cardRect.height}px`;
        this.card.style.zIndex = '1000';
        this.card.style.opacity = '1';
        this.card.classList.add('card--expanded');

        this.card.offsetHeight;

        const targetRect = {
            top: gridRect.top + paddingTop,
            left: gridRect.left + paddingLeft,
            width: gridRect.width - paddingLeft - paddingRight,
            height: gridRect.height - paddingTop - paddingBottom,
        };

        this.card.style.transition = `all ${CardExpansion.TIMING.expand}ms ${CardExpansion.TIMING.ease}`;
        this.card.style.top = `${targetRect.top}px`;
        this.card.style.left = `${targetRect.left}px`;
        this.card.style.width = `${targetRect.width}px`;
        this.card.style.height = `${targetRect.height}px`;

        setTimeout(() => {
            this.setupExpandedInteractions();
            CardExpansion.state.isAnimating = false;
        }, CardExpansion.TIMING.expand);
    }

    setupExpandedInteractions() {
        const handleOutsideClick = (event) => {
            if (this.card.contains(event.target)) return;
            void CardExpansion.closeExpandedCard();
        };

        this.card._outsideClickTimeoutId = window.setTimeout(() => {
            if (!this.card._isExpanded) return;
            document.addEventListener('click', handleOutsideClick);
            this.card._outsideClickHandler = handleOutsideClick;
            delete this.card._outsideClickTimeoutId;
        }, 100);

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                void CardExpansion.closeExpandedCard();
            }
        };

        document.addEventListener('keydown', handleEscape);
        this.card._escapeHandler = handleEscape;
    }

    cleanupExpandedInteractions({ keepHiddenCards = false } = {}) {
        if (this.card._outsideClickTimeoutId) {
            window.clearTimeout(this.card._outsideClickTimeoutId);
            delete this.card._outsideClickTimeoutId;
        }

        if (this.card._hiddenCards) {
            if (!keepHiddenCards) {
                this.card._hiddenCards.forEach((card) => {
                    card.classList.remove('card--hidden');
                    card.classList.remove('card--closing');
                });
            }
            delete this.card._hiddenCards;
        }

        if (this.card._outsideClickHandler) {
            document.removeEventListener('click', this.card._outsideClickHandler);
            delete this.card._outsideClickHandler;
        }

        if (this.card._escapeHandler) {
            document.removeEventListener('keydown', this.card._escapeHandler);
            delete this.card._escapeHandler;
        }
    }

    restoreCardToGrid({ keepClosingState = false } = {}) {
        if (this.card._originalStyles) {
            this.card.style.position = this.card._originalStyles.position;
            this.card.style.top = this.card._originalStyles.top;
            this.card.style.left = this.card._originalStyles.left;
            this.card.style.width = this.card._originalStyles.width;
            this.card.style.height = this.card._originalStyles.height;
            this.card.style.zIndex = this.card._originalStyles.zIndex;
            this.card.style.transition = this.card._originalStyles.transition;
            this.card.style.opacity = this.card._originalStyles.opacity;
            delete this.card._originalStyles;
        }

        this.card.classList.remove('card--expanded');
        if (!keepClosingState) {
            this.card.classList.remove('card--closing');
        }
        delete this.card._originalRect;
    }

    static closeExpandedCard() {
        return new Promise((resolve) => {
            const expansion = CardExpansion.state.expandedInstance;
            if (!expansion || CardExpansion.state.isAnimating) {
                resolve();
                return;
            }

            CardExpansion.state.isAnimating = true;
            expansion.cleanupExpandedInteractions();

            const card = expansion.card;
            const originalRect = card._originalRect || card.getBoundingClientRect();
            card.classList.add('card--closing');

            card.style.transition = `all ${CardExpansion.TIMING.expand}ms ${CardExpansion.TIMING.easeOut}`;
            card.style.top = `${originalRect.top}px`;
            card.style.left = `${originalRect.left}px`;
            card.style.width = `${originalRect.width}px`;
            card.style.height = `${originalRect.height}px`;

            setTimeout(() => {
                expansion.restoreCardToGrid();
                card._isExpanded = false;
                CardExpansion.state.expandedInstance = null;
                CardExpansion.syncActiveNav('');
                CardExpansion.state.isAnimating = false;
                resolve();
            }, CardExpansion.TIMING.expand);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.grid > [id^="container"]').forEach((container) => {
        new CardExpansion(container);
    });
});

window.CardExpansion = CardExpansion;
