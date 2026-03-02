/**
 * KERNWERK - CardExpansion Component
 * ============================================
 * Expandable Cards für WebApp Dashboard
 * - Klick öffnet Card Modal-ähnlich
 * - Body wird non-scrollable wenn Card offen
 * - Hotkey Support [ESC] zum Schließen
 * ============================================
 */

import { appStore } from '../stores/state.js';

export class CardExpansion {
    constructor(cardElement) {
        this.card = cardElement;
        this.isExpanded = false;
        this.originalHTML = null;
        this.init();
    }

    init() {
        this.card.addEventListener('click', (e) => {
            // Nur bei Header/Title Click, nicht bei Body Interaktion
            if (e.target.closest('.card__expand-trigger')) {
                this.toggle();
            }
        });
    }

    /**
     * Card expandieren / kollabieren
     */
    toggle() {
        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    /**
     * Card expandieren
     * - Body wird non-scrollable
     * - Card bekommt Modal-Overlay
     */
    expand() {
        this.isExpanded = true;

        // Speichere originalen HTML Zustand
        this.originalHTML = this.card.innerHTML;

        // Füge Expanded-Klasse hinzu
        this.card.classList.add('card--expanded');

        // Disable body scroll
        this.disableBodyScroll();

        // Add Close Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'card__close';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => this.collapse());
        this.card.appendChild(closeBtn);

        // ESC Key zum Schließen
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.collapse();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);

        console.log('[CardExpansion] Card expandiert', this.card);
    }

    /**
     * Card kollabieren
     */
    collapse() {
        if (!this.isExpanded) return;

        this.isExpanded = false;

        // Entferne Expanded-Klasse
        this.card.classList.remove('card--expanded');

        // Enable body scroll wieder
        this.enableBodyScroll();

        // Entferne Close Button
        const closeBtn = this.card.querySelector('.card__close');
        if (closeBtn) closeBtn.remove();

        // Entferne ESC Handler
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }

        console.log('[CardExpansion] Card kollabiert', this.card);
    }

    /**
     * Body Scroll deaktivieren
     */
    disableBodyScroll() {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // Für iOS
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }

    /**
     * Body Scroll aktivieren
     */
    enableBodyScroll() {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // Für iOS
        document.body.style.position = '';
        document.body.style.width = '';
    }

    /**
     * Alle expandierten Cards schließen
     */
    static collapseAll() {
        document.querySelectorAll('.card--expanded').forEach(card => {
            const instance = CardExpansion.getInstance(card);
            if (instance) {
                instance.collapse();
            }
        });
    }

    /**
     * CardExpansion Instanz abrufen
     */
    static getInstance(cardElement) {
        return cardElement._cardExpansion;
    }
}

/**
 * Globale Initialisierung
 */
export function initCardExpansion() {
    document.querySelectorAll('.card').forEach(card => {
        card._cardExpansion = new CardExpansion(card);
    });

    console.log('[CardExpansion] Initialized');
}

// ESC Key -> Alle Cards schließen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        CardExpansion.collapseAll();
    }
});
