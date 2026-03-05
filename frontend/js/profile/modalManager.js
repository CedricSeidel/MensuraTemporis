export function createModalManager(options) {
    const {
        elements,
        navActiveClass,
        modalExpandMs,
        modalExpandEase,
        modalCloseMs,
        modalCloseEase,
        onFigureScaleSync = () => {},
        onLoginModalClosed = () => {},
        onUserModalClosed = () => {},
    } = options;

    function anyModalOpen() {
        return [elements.loginModal, elements.userModal].some((modal) => modal && !modal.hidden);
    }

    function getOpenModal() {
        return [elements.loginModal, elements.userModal]
            .find((modal) => modal && !modal.hidden) || null;
    }

    function setGridModalState(isOpen) {
        const grid = document.querySelector('.grid');
        if (!grid) return;
        grid.classList.toggle('modal-grid-open', isOpen);
    }

    function isModalOpen(modal) {
        return Boolean(modal && !modal.hidden);
    }

    function syncProfileNavActive() {
        const openModalId = [elements.loginModal, elements.userModal]
            .find((modal) => modal && !modal.hidden)?.id || '';

        const loginActive = openModalId === 'loginModal';
        const userActive = openModalId === 'userModal';

        elements.fingerprintContainer?.classList.toggle(navActiveClass, loginActive);
        elements.profileContainer?.classList.toggle(navActiveClass, userActive);
    }

    function switchExpandedCardToModalContext() {
        const expansionApi = window.CardExpansion;
        const activeExpansion = expansionApi?.state?.expandedInstance;
        if (!activeExpansion) return false;

        const card = activeExpansion.card;
        if (!card) return false;

        activeExpansion.cleanupExpandedInteractions?.({ keepHiddenCards: true });
        card.classList.add('card--hidden');
        activeExpansion.restoreCardToGrid?.();
        card._isExpanded = false;

        expansionApi.state.expandedInstance = null;
        expansionApi.state.isAnimating = false;
        expansionApi.syncActiveNav?.('');
        return true;
    }

    function restoreAllGridCards() {
        const grid = document.querySelector('.grid');
        if (!grid) return;

        Array.from(grid.children).forEach((card) => {
            if (!(card instanceof HTMLElement)) return;

            card.classList.remove('card--hidden');
            card.classList.remove('card--closing');
            card.classList.remove('card--expanded');

            card.style.position = '';
            card.style.top = '';
            card.style.left = '';
            card.style.width = '';
            card.style.height = '';
            card.style.zIndex = '';
            card.style.transition = '';
            card.style.opacity = '';

            card._isExpanded = false;
            delete card._hiddenCards;
            delete card._originalRect;
            delete card._originalStyles;
        });

        const expansionApi = window.CardExpansion;
        if (expansionApi?.state) {
            expansionApi.state.expandedInstance = null;
            expansionApi.state.isAnimating = false;
            expansionApi.syncActiveNav?.('');
        }
    }

    function resolveOriginRect(origin) {
        if (!origin) return null;
        if (origin instanceof Element) {
            return origin.getBoundingClientRect();
        }

        if (typeof origin === 'object') {
            const top = Number(origin.top);
            const left = Number(origin.left);
            const width = Number(origin.width);
            const height = Number(origin.height);
            if ([top, left, width, height].every(Number.isFinite)) {
                return { top, left, width, height };
            }
        }

        return null;
    }

    function clearModalAnimation(modalOverlay) {
        if (!modalOverlay) return;

        if (modalOverlay._openAnimationTimeoutId) {
            window.clearTimeout(modalOverlay._openAnimationTimeoutId);
            delete modalOverlay._openAnimationTimeoutId;
        }

        if (modalOverlay._closeAnimationTimeoutId) {
            window.clearTimeout(modalOverlay._closeAnimationTimeoutId);
            delete modalOverlay._closeAnimationTimeoutId;
        }
    }

    function clearModalGridLayout(modalOverlay) {
        if (!modalOverlay) return;
        clearModalAnimation(modalOverlay);
        modalOverlay.classList.remove('is-grid-modal');
        modalOverlay.classList.remove('is-closing');
        modalOverlay._isClosing = false;
        delete modalOverlay._closePromise;
        delete modalOverlay._modalOriginRect;
        const modalCard = modalOverlay.querySelector('.modal');
        if (!modalCard) return;

        modalCard.style.top = '';
        modalCard.style.left = '';
        modalCard.style.width = '';
        modalCard.style.height = '';
        modalCard.style.opacity = '';
        modalCard.style.transition = '';
    }

    function applyModalGridLayout(modalOverlay) {
        if (!modalOverlay) return;
        const modalCard = modalOverlay.querySelector('.modal');
        const grid = document.querySelector('.grid');
        if (!modalCard || !grid) {
            clearModalGridLayout(modalOverlay);
            return null;
        }

        const gridRect = grid.getBoundingClientRect();
        const gridStyles = window.getComputedStyle(grid);
        const paddingTop = parseFloat(gridStyles.paddingTop) || 0;
        const paddingLeft = parseFloat(gridStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(gridStyles.paddingRight) || 0;
        const paddingBottom = parseFloat(gridStyles.paddingBottom) || 0;

        const targetTop = gridRect.top + paddingTop;
        const targetLeft = gridRect.left + paddingLeft;
        const targetWidth = gridRect.width - paddingLeft - paddingRight;
        const targetHeight = gridRect.height - paddingTop - paddingBottom;

        modalOverlay.classList.add('is-grid-modal');
        modalCard.style.top = `${targetTop}px`;
        modalCard.style.left = `${targetLeft}px`;
        modalCard.style.width = `${targetWidth}px`;
        modalCard.style.height = `${targetHeight}px`;
        modalCard.style.opacity = '1';

        return {
            top: targetTop,
            left: targetLeft,
            width: targetWidth,
            height: targetHeight,
        };
    }

    function animateModalOpen(modalOverlay, origin) {
        if (!modalOverlay) return;
        const modalCard = modalOverlay.querySelector('.modal');
        if (!modalCard) return;

        const targetRect = applyModalGridLayout(modalOverlay);
        if (!targetRect) return;

        const originRect = resolveOriginRect(origin);
        modalOverlay._modalOriginRect = originRect || null;
        const fallbackWidth = Math.max(44, targetRect.width * 0.24);
        const fallbackHeight = Math.max(44, targetRect.height * 0.24);
        const startRect = originRect || {
            top: targetRect.top + (targetRect.height - fallbackHeight) / 2,
            left: targetRect.left + (targetRect.width - fallbackWidth) / 2,
            width: fallbackWidth,
            height: fallbackHeight,
        };

        clearModalAnimation(modalOverlay);

        modalCard.style.transition = 'none';
        modalCard.style.top = `${startRect.top}px`;
        modalCard.style.left = `${startRect.left}px`;
        modalCard.style.width = `${Math.max(44, startRect.width)}px`;
        modalCard.style.height = `${Math.max(44, startRect.height)}px`;
        modalCard.style.opacity = '0.92';

        modalCard.offsetHeight;

        modalCard.style.transition = [
            `top ${modalExpandMs}ms ${modalExpandEase}`,
            `left ${modalExpandMs}ms ${modalExpandEase}`,
            `width ${modalExpandMs}ms ${modalExpandEase}`,
            `height ${modalExpandMs}ms ${modalExpandEase}`,
            `opacity ${modalExpandMs}ms ${modalExpandEase}`,
        ].join(', ');

        modalCard.style.top = `${targetRect.top}px`;
        modalCard.style.left = `${targetRect.left}px`;
        modalCard.style.width = `${targetRect.width}px`;
        modalCard.style.height = `${targetRect.height}px`;
        modalCard.style.opacity = '1';

        modalOverlay._openAnimationTimeoutId = window.setTimeout(() => {
            if (!modalOverlay.hidden) {
                modalCard.style.transition = '';
            }
            onFigureScaleSync();
            delete modalOverlay._openAnimationTimeoutId;
        }, modalExpandMs);
    }

    function resolveCloseTargetRect(startRect, origin) {
        const originRect = resolveOriginRect(origin) || null;
        const storedRect = originRect || (startRect && typeof startRect === 'object' ? startRect : null);
        const minSize = 42;

        if (originRect) {
            const width = Math.max(minSize, originRect.width || minSize);
            const height = Math.max(minSize, originRect.height || minSize);
            return {
                top: originRect.top + (originRect.height - height) / 2,
                left: originRect.left + (originRect.width - width) / 2,
                width,
                height,
            };
        }

        const width = Math.max(minSize, (storedRect?.width || minSize) * 0.24);
        const height = Math.max(minSize, (storedRect?.height || minSize) * 0.24);
        return {
            top: (storedRect?.top || 0) + ((storedRect?.height || height) - height) / 2,
            left: (storedRect?.left || 0) + ((storedRect?.width || width) - width) / 2,
            width,
            height,
        };
    }

    function animateModalClose(modalOverlay, origin, options = {}) {
        if (!modalOverlay || modalOverlay.hidden) return Promise.resolve(false);
        if (modalOverlay._isClosing) return modalOverlay._closePromise || Promise.resolve(true);
        const { preserveExpandedState = false } = options;
        const hasOtherOpenModal = [elements.loginModal, elements.userModal]
            .some((modal) => modal && modal !== modalOverlay && !modal.hidden);
        const revealGridDuringClose = !preserveExpandedState && !hasOtherOpenModal;

        const modalCard = modalOverlay.querySelector('.modal');
        if (!modalCard) {
            modalOverlay.hidden = true;
            return Promise.resolve(false);
        }

        clearModalAnimation(modalOverlay);
        modalOverlay._isClosing = true;
        modalOverlay.classList.add('is-closing');

        if (revealGridDuringClose) {
            setGridModalState(false);
            restoreAllGridCards();
        }

        const currentRect = applyModalGridLayout(modalOverlay) || (() => {
            const rect = modalCard.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            };
        })();

        const closeTargetRect = resolveCloseTargetRect(currentRect, origin || modalOverlay._modalOriginRect);

        modalCard.style.transition = 'none';
        modalCard.style.top = `${currentRect.top}px`;
        modalCard.style.left = `${currentRect.left}px`;
        modalCard.style.width = `${currentRect.width}px`;
        modalCard.style.height = `${currentRect.height}px`;
        modalCard.style.opacity = '1';

        modalCard.offsetHeight;

        modalCard.style.transition = [
            `top ${modalCloseMs}ms ${modalCloseEase}`,
            `left ${modalCloseMs}ms ${modalCloseEase}`,
            `width ${modalCloseMs}ms ${modalCloseEase}`,
            `height ${modalCloseMs}ms ${modalCloseEase}`,
            `opacity ${modalCloseMs}ms ${modalCloseEase}`,
        ].join(', ');

        modalCard.style.top = `${closeTargetRect.top}px`;
        modalCard.style.left = `${closeTargetRect.left}px`;
        modalCard.style.width = `${closeTargetRect.width}px`;
        modalCard.style.height = `${closeTargetRect.height}px`;
        modalCard.style.opacity = '0';

        modalOverlay._closePromise = new Promise((resolve) => {
            modalOverlay._closeAnimationTimeoutId = window.setTimeout(() => {
                modalOverlay.hidden = true;
                clearModalGridLayout(modalOverlay);
                delete modalOverlay._modalOriginRect;

                if (!anyModalOpen()) {
                    setGridModalState(false);
                    document.body.classList.remove('modal-open');
                    if (!preserveExpandedState && !revealGridDuringClose) {
                        restoreAllGridCards();
                    }
                }
                syncProfileNavActive();
                resolve(true);
            }, modalCloseMs);
        });

        return modalOverlay._closePromise;
    }

    function refreshOpenModalLayouts() {
        [elements.loginModal, elements.userModal].forEach((modal) => {
            if (!modal || modal.hidden) return;
            applyModalGridLayout(modal);
        });
        onFigureScaleSync();
    }

    function openModal(modal, origin, options = {}) {
        if (!modal) return Promise.resolve(false);

        const { animate = true } = options;
        clearModalAnimation(modal);
        modal.classList.remove('is-closing');
        modal._isClosing = false;
        modal.hidden = false;
        setGridModalState(true);
        syncProfileNavActive();
        if (animate) {
            animateModalOpen(modal, origin);
        } else {
            applyModalGridLayout(modal);
            const modalCard = modal.querySelector('.modal');
            if (modalCard) {
                modalCard.style.transition = '';
                modalCard.style.opacity = '1';
            }
        }
        onFigureScaleSync();
        document.body.classList.add('modal-open');
        return Promise.resolve(true);
    }

    function closeModal(modal, options = {}) {
        if (!modal) return Promise.resolve(false);
        if (modal.hidden && !modal._isClosing) return Promise.resolve(false);

        const { animate = true, origin = null, preserveExpandedState = false } = options;
        if (modal._isClosing && !animate) {
            clearModalGridLayout(modal);
            modal.hidden = true;
        }
        if (modal._isClosing) return modal._closePromise || Promise.resolve(true);

        if (animate && !modal.hidden) {
            return animateModalClose(modal, origin, { preserveExpandedState }).then((closed) => {
                if (modal === elements.loginModal) {
                    onLoginModalClosed();
                }
                if (modal === elements.userModal) {
                    onUserModalClosed();
                }
                return closed;
            });
        }

        modal.hidden = true;
        clearModalGridLayout(modal);
        if (modal === elements.loginModal) {
            onLoginModalClosed();
        }
        if (modal === elements.userModal) {
            onUserModalClosed();
        }
        if (!anyModalOpen() && !preserveExpandedState) {
            setGridModalState(false);
            document.body.classList.remove('modal-open');
            restoreAllGridCards();
        }
        syncProfileNavActive();
        return Promise.resolve(true);
    }

    function closeAllModals(options = {}) {
        return Promise.all([
            closeModal(elements.loginModal, options),
            closeModal(elements.userModal, options),
        ]);
    }

    return {
        anyModalOpen,
        closeAllModals,
        closeModal,
        getOpenModal,
        isModalOpen,
        openModal,
        refreshOpenModalLayouts,
        resolveOriginRect,
        setGridModalState,
        switchExpandedCardToModalContext,
        syncProfileNavActive,
    };
}
