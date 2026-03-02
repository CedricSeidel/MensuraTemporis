/**
 * Card Expansion System
 * ============================================
 * Grid-based click-to-expand system
 * Cards expand to fill the grid area, hiding others
 * Click outside or ESC to close
 */

export class CardExpansion {
    static state = {
        expandedCard: null,
        isAnimating: false,
    };

    static TIMING = {
        expand: 600,
        ease: 'cubic-bezier(0.2, 0.0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    };

    constructor(cardElement) {
        this.card = cardElement;
        this.init();
    }

    init() {
        // Container is clickable
        this.card.addEventListener('click', (e) => {
            if (this.card._isExpanded) return;
            this.handleCardClick(e);
        });
    }

    handleCardClick(e) {
        if (CardExpansion.state.isAnimating) return;
        e.stopPropagation();

        if (CardExpansion.state.expandedCard) {
            CardExpansion.closeExpandedCard().then(() => {
                this.expandCard();
            });
        } else {
            this.expandCard();
        }
    }

    expandCard() {
        if (CardExpansion.state.isAnimating) return;

        CardExpansion.state.isAnimating = true;
        CardExpansion.state.expandedCard = this.card;
        this.card._isExpanded = true;

        // Hide other cards immediately when expansion starts
        const grid = document.querySelector('.grid');
        const otherCards = Array.from(grid.children).filter(card => card !== this.card);
        otherCards.forEach(card => {
            card.classList.add('card--hidden');
        });
        this.card._hiddenCards = otherCards;

        // Card-Position im Viewport
        const cardRect = this.card.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();

        // Target: Complete Grid + Padding
        const gridStyles = window.getComputedStyle(grid);
        const paddingTop = parseFloat(gridStyles.paddingTop) || 0;
        const paddingLeft = parseFloat(gridStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(gridStyles.paddingRight) || 0;
        const paddingBottom = parseFloat(gridStyles.paddingBottom) || 0;

        // Safe original Styles
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

        // Reset Card to Fixed Position
        this.card.style.position = 'fixed';
        this.card.style.top = cardRect.top + 'px';
        this.card.style.left = cardRect.left + 'px';
        this.card.style.width = cardRect.width + 'px';
        this.card.style.height = cardRect.height + 'px';
        this.card.style.zIndex = '1000';
        this.card.style.opacity = '1';

        // Force Reflow
        this.card.offsetHeight;

        // Target Position
        const targetRect = {
            top: gridRect.top + paddingTop,
            left: gridRect.left + paddingLeft,
            width: gridRect.width - paddingLeft - paddingRight,
            height: gridRect.height - paddingTop - paddingBottom,
        };

        // Start Animation with Transition
        this.card.style.transition = `all ${CardExpansion.TIMING.expand}ms ${CardExpansion.TIMING.ease}`;
        this.card.style.top = targetRect.top + 'px';
        this.card.style.left = targetRect.left + 'px';
        this.card.style.width = targetRect.width + 'px';
        this.card.style.height = targetRect.height + 'px';

        // Setup Interaction after Animation
        setTimeout(() => {
            this.setupExpandedInteractions();
            CardExpansion.state.isAnimating = false;
        }, CardExpansion.TIMING.expand);
    }

    static closeExpandedCard() {
        return new Promise((resolve) => {
            if (CardExpansion.state.isAnimating || !CardExpansion.state.expandedCard) {
                resolve();
                return;
            }

            CardExpansion.state.isAnimating = true;
            const card = CardExpansion.state.expandedCard;
            const expansion = card._cardExpansionInstance;

            if (!expansion) {
                resolve();
                return;
            }

            expansion.cleanupExpandedInteractions();

            // Original Position
            const grid = document.querySelector('.grid');
            const cardIndex = Array.from(grid.children).indexOf(card);

            // Grid Position
            const cols = 3;
            const gridCol = (cardIndex % cols) + 1;
            const gridRow = Math.floor(cardIndex / cols) + 1;

            const gridStyles = window.getComputedStyle(grid);
            const gap = parseFloat(gridStyles.gap) || 0;
            const gridRect = grid.getBoundingClientRect();
            const paddingLeft = parseFloat(gridStyles.paddingLeft) || 0;
            const paddingTop = parseFloat(gridStyles.paddingTop) || 0;
            const paddingRight = parseFloat(gridStyles.paddingRight) || 0;
            const paddingBottom = parseFloat(gridStyles.paddingBottom) || 0;

            const contentWidth = gridRect.width - paddingLeft - paddingRight;
            const contentHeight = gridRect.height - paddingTop - paddingBottom;

            const colWidth = (contentWidth - (cols - 1) * gap) / cols;
            const rowHeight = (contentHeight - gap) / 2;

            const targetLeft = gridRect.left + paddingLeft + (gridCol - 1) * (colWidth + gap);
            const targetTop = gridRect.top + paddingTop + (gridRow - 1) * (rowHeight + gap);

            // Animate back to original position
            card.style.transition = `all ${CardExpansion.TIMING.expand}ms ${CardExpansion.TIMING.easeOut}`;
            card.style.top = targetTop + 'px';
            card.style.left = targetLeft + 'px';
            card.style.width = colWidth + 'px';
            card.style.height = rowHeight + 'px';

            setTimeout(() => {
                expansion.restoreCardToGrid();
                CardExpansion.state.expandedCard = null;
                CardExpansion.state.isAnimating = false;
                card._isExpanded = false;
                resolve();
            }, CardExpansion.TIMING.expand);
        });
    }

    restoreCardToGrid() {
        // Restore original styles
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
    }

    setupExpandedInteractions() {
        // Hide Cards while expandCard()
        // Prevent clicks inside the expanded card from bubbling
        const handleExpandedCardClick = (event) => {
            event.stopPropagation();
        };

        const handleOutsideClick = () => {
            CardExpansion.closeExpandedCard().then();
        };

        // Stop propagation for clicks inside
        this.card.addEventListener('click', handleExpandedCardClick);
        this.card._expandedClickHandler = handleExpandedCardClick;

        // Close on clicks outside - with Timeout to prevent immediate Trigger
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            this.card._outsideClickHandler = handleOutsideClick;
        }, 100);

        // ESC Key to close
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                CardExpansion.closeExpandedCard().then();
            }
        };

        document.addEventListener('keydown', handleEscape);
        this.card._escapeHandler = handleEscape;
    }

    cleanupExpandedInteractions() {
        // Show other cards again
        if (this.card._hiddenCards) {
            this.card._hiddenCards.forEach(card => {
                card.classList.remove('card--hidden');
            });
            delete this.card._hiddenCards;
        }

        if (this.card._expandedClickHandler) {
            this.card.removeEventListener('click', this.card._expandedClickHandler);
            delete this.card._expandedClickHandler;
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


}

// Initialise CardExpansion for all cards on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[class^="container"]').forEach(container => {
        container._cardExpansionInstance = new CardExpansion(container);
    });
});

