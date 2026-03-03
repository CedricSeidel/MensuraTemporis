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

    handleCardClick(event) {
        if (CardExpansion.state.isAnimating) return;

        const closeButton = event.target.closest('[data-container-close]');
        if (closeButton) {
            if (CardExpansion.state.expandedInstance === this) {
                CardExpansion.closeExpandedCard().then();
            }
            return;
        }

        if (CardExpansion.state.expandedInstance === this) {
            return;
        }

        if (CardExpansion.state.expandedInstance) {
            CardExpansion.closeExpandedCard().then(() => this.expandCard());
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
            CardExpansion.closeExpandedCard().then();
        };

        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            this.card._outsideClickHandler = handleOutsideClick;
        }, 100);

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                CardExpansion.closeExpandedCard().then();
            }
        };

        document.addEventListener('keydown', handleEscape);
        this.card._escapeHandler = handleEscape;
    }

    cleanupExpandedInteractions() {
        if (this.card._hiddenCards) {
            this.card._hiddenCards.forEach((card) => card.classList.remove('card--hidden'));
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

    restoreCardToGrid() {
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

            card.style.transition = `all ${CardExpansion.TIMING.expand}ms ${CardExpansion.TIMING.easeOut}`;
            card.style.top = `${originalRect.top}px`;
            card.style.left = `${originalRect.left}px`;
            card.style.width = `${originalRect.width}px`;
            card.style.height = `${originalRect.height}px`;

            setTimeout(() => {
                expansion.restoreCardToGrid();
                card._isExpanded = false;
                CardExpansion.state.expandedInstance = null;
                CardExpansion.state.isAnimating = false;
                resolve();
            }, CardExpansion.TIMING.expand);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[class^="container"]').forEach((container) => {
        new CardExpansion(container);
    });
});
