(function initProfileAndAuth() {
    const state = {
        user: null,
    };

    const elements = {
        profileImage: document.getElementById('profileImage'),
        fingerprintImage: document.getElementById('fingerprintImage'),
        profileTooltip: document.getElementById('profileTooltip'),
        fingerprintTooltip: document.getElementById('fingerprintTooltip'),
        profileContainer: document.querySelector('.profile-container'),
        fingerprintContainer: document.querySelector('.fingerprint-container'),
        loginModal: document.getElementById('loginModal'),
        registerModal: document.getElementById('registerModal'),
        userModal: document.getElementById('userModal'),
        loginState: document.getElementById('loginState'),
        registerState: document.getElementById('registerState'),
        userState: document.getElementById('userState'),
        loginForm: document.getElementById('loginForm'),
        registerForm: document.getElementById('registerForm'),
        loggedInPanel: document.getElementById('loggedInPanel'),
        loggedInUsername: document.getElementById('loggedInUsername'),
        logoutButton: document.getElementById('logoutButton'),
        openRegisterModalButton: document.getElementById('openRegisterModalButton'),
        openLoginModalButton: document.getElementById('openLoginModalButton'),
        userNameValue: document.getElementById('userNameValue'),
        userCreatedValue: document.getElementById('userCreatedValue'),
        userUpdatedValue: document.getElementById('userUpdatedValue'),
        userDataForm: document.getElementById('userDataForm'),
        userDataInput: document.getElementById('userDataInput'),
    };

    if (!elements.profileImage || !elements.fingerprintImage) return;

    const STORAGE_KEYS = {
        users: 'mensura-auth-users-v1',
        session: 'mensura-auth-session-v1',
    };

    const FALLBACK_HTTP_STATUSES = new Set([404, 405, 500, 502, 503, 504]);
    const REGISTER_ALREADY_LOGGED_IN_TEXT = 'Du bist bereits eingeloggt. Logout im Login-Popup.';
    const MODAL_EXPAND_MS = 600;
    const MODAL_EXPAND_EASE = 'cubic-bezier(0.2, 0.0, 0.2, 1)';
    const MODAL_CLOSE_MS = 600;
    const MODAL_CLOSE_EASE = 'cubic-bezier(0.0, 0.0, 0.2, 1)';
    const NAV_ACTIVE_CLASS = 'is-active';

    const API_BASES = (() => {
        const bases = [];
        const origin = window.location.origin;

        if (origin && origin !== 'null') {
            bases.push(origin);
        }

        if (!bases.includes('http://localhost:3000')) {
            bases.push('http://localhost:3000');
        }

        return bases;
    })();

    function createHttpError(message, status = 400) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    function readStorage(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // ignore write errors
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore remove errors
        }
    }

    function normalizeUsername(value) {
        return (value || '').trim();
    }

    function toPublicUser(user) {
        if (!user) return null;
        return {
            username: user.username,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            data: user.data && typeof user.data === 'object' ? user.data : {},
        };
    }

    function getLocalUsers() {
        const users = readStorage(STORAGE_KEYS.users, []);
        return Array.isArray(users) ? users : [];
    }

    function saveLocalUsers(users) {
        writeStorage(STORAGE_KEYS.users, users);
    }

    function getLocalSession() {
        const session = readStorage(STORAGE_KEYS.session, null);
        if (!session || typeof session.username !== 'string') return null;
        return session;
    }

    function setLocalSession(username) {
        writeStorage(STORAGE_KEYS.session, { username });
    }

    function clearLocalSession() {
        removeStorage(STORAGE_KEYS.session);
    }

    function findLocalUser(users, username) {
        const wanted = normalizeUsername(username).toLowerCase();
        return users.find((entry) => entry?.username?.toLowerCase() === wanted) || null;
    }

    function getSessionUser(users) {
        const session = getLocalSession();
        if (!session) return null;
        return users.find((entry) => entry?.username === session.username) || null;
    }

    function localAuthRequest(path, method, body) {
        const upperMethod = method.toUpperCase();
        const users = getLocalUsers();
        const now = new Date().toISOString();

        if (path === '/api/me' && upperMethod === 'GET') {
            const currentUser = getSessionUser(users);
            return { user: toPublicUser(currentUser) };
        }

        if (path === '/api/login' && upperMethod === 'POST') {
            const username = normalizeUsername(body?.username);
            const password = body?.password || '';
            const user = findLocalUser(users, username);

            if (!user || user.password !== password) {
                throw createHttpError('Ungültige Zugangsdaten', 401);
            }

            setLocalSession(user.username);
            return { user: toPublicUser(user) };
        }

        if (path === '/api/register' && upperMethod === 'POST') {
            const username = normalizeUsername(body?.username);
            const password = body?.password || '';

            if (username.length < 3) {
                throw createHttpError('Username muss mindestens 3 Zeichen haben', 400);
            }

            if (password.length < 8) {
                throw createHttpError('Passwort muss mindestens 8 Zeichen haben', 400);
            }

            if (findLocalUser(users, username)) {
                throw createHttpError('Username bereits vergeben', 409);
            }

            const newUser = {
                username,
                password,
                data: body?.data && typeof body.data === 'object' ? body.data : {},
                createdAt: now,
                updatedAt: now,
            };

            users.push(newUser);
            saveLocalUsers(users);
            setLocalSession(newUser.username);
            return { user: toPublicUser(newUser) };
        }

        if (path === '/api/logout' && upperMethod === 'POST') {
            clearLocalSession();
            return { ok: true };
        }

        if (path === '/api/me/data' && upperMethod === 'PUT') {
            const currentUser = getSessionUser(users);
            if (!currentUser) {
                throw createHttpError('Bitte zuerst einloggen', 401);
            }

            currentUser.data = body?.data && typeof body.data === 'object' ? body.data : {};
            currentUser.updatedAt = now;

            saveLocalUsers(users);
            return { user: toPublicUser(currentUser) };
        }

        throw createHttpError('Aktion nicht verfügbar', 404);
    }

    function setStateMessage(target, text, type = '') {
        if (!target) return;
        target.textContent = text || '';
        target.className = `modal-state${type ? ` is-${type}` : ''}`;
    }

    function getErrorMessage(error, fallback = 'Unbekannter Fehler') {
        if (error instanceof Error && error.message) {
            return error.message;
        }
        return fallback;
    }

    function formatTimestamp(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('de-DE');
    }

    function anyModalOpen() {
        return [elements.loginModal, elements.registerModal, elements.userModal].some((modal) => modal && !modal.hidden);
    }

    function getOpenModal() {
        return [elements.loginModal, elements.registerModal, elements.userModal]
            .find((modal) => modal && !modal.hidden) || null;
    }

    function setGridModalState(isOpen) {
        const grid = document.querySelector('.grid');
        if (!grid) return;
        grid.classList.toggle('modal-grid-open', isOpen);
    }

    function getEventElement(event) {
        if (event.target instanceof Element) return event.target;
        if (typeof event.composedPath !== 'function') return null;
        const path = event.composedPath();
        return path.find((node) => node instanceof Element) || null;
    }

    function isModalOpen(modal) {
        return Boolean(modal && !modal.hidden);
    }

    function syncProfileNavActive() {
        const openModalId = [elements.loginModal, elements.registerModal, elements.userModal]
            .find((modal) => modal && !modal.hidden)?.id || '';

        const loginActive = openModalId === 'loginModal' || openModalId === 'registerModal';
        const userActive = openModalId === 'userModal';

        elements.fingerprintContainer?.classList.toggle(NAV_ACTIVE_CLASS, loginActive);
        elements.profileContainer?.classList.toggle(NAV_ACTIVE_CLASS, userActive);
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
            `top ${MODAL_EXPAND_MS}ms ${MODAL_EXPAND_EASE}`,
            `left ${MODAL_EXPAND_MS}ms ${MODAL_EXPAND_EASE}`,
            `width ${MODAL_EXPAND_MS}ms ${MODAL_EXPAND_EASE}`,
            `height ${MODAL_EXPAND_MS}ms ${MODAL_EXPAND_EASE}`,
            `opacity ${MODAL_EXPAND_MS}ms ${MODAL_EXPAND_EASE}`,
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
            delete modalOverlay._openAnimationTimeoutId;
        }, MODAL_EXPAND_MS);
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
        const hasOtherOpenModal = [elements.loginModal, elements.registerModal, elements.userModal]
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
            // Reveal all cards at close-start so fade-in runs together with modal closing.
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
            `top ${MODAL_CLOSE_MS}ms ${MODAL_CLOSE_EASE}`,
            `left ${MODAL_CLOSE_MS}ms ${MODAL_CLOSE_EASE}`,
            `width ${MODAL_CLOSE_MS}ms ${MODAL_CLOSE_EASE}`,
            `height ${MODAL_CLOSE_MS}ms ${MODAL_CLOSE_EASE}`,
            `opacity ${MODAL_CLOSE_MS}ms ${MODAL_CLOSE_EASE}`,
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
            }, MODAL_CLOSE_MS);
        });

        return modalOverlay._closePromise;
    }

    function refreshOpenModalLayouts() {
        [elements.loginModal, elements.registerModal, elements.userModal].forEach((modal) => {
            if (!modal || modal.hidden) return;
            applyModalGridLayout(modal);
        });
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
            return animateModalClose(modal, origin, { preserveExpandedState });
        }

        modal.hidden = true;
        clearModalGridLayout(modal);
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
            closeModal(elements.registerModal, options),
            closeModal(elements.userModal, options),
        ]);
    }

    function isLoggedIn() {
        return Boolean(state.user);
    }

    function updateTooltips() {
        const loggedIn = isLoggedIn();
        if (elements.profileTooltip) {
            elements.profileTooltip.textContent = loggedIn ? 'Profil' : 'Profil (nicht eingeloggt)';
        }
        if (elements.fingerprintTooltip) {
            elements.fingerprintTooltip.textContent = loggedIn ? 'Account' : 'Login';
        }
    }

    function updateUserPanel() {
        if (!elements.userNameValue || !elements.userCreatedValue || !elements.userUpdatedValue || !elements.userDataInput) {
            return;
        }

        if (!state.user) {
            elements.userNameValue.textContent = '-';
            elements.userCreatedValue.textContent = '-';
            elements.userUpdatedValue.textContent = '-';
            elements.userDataInput.value = '';
            return;
        }

        elements.userNameValue.textContent = state.user.username || '-';
        elements.userCreatedValue.textContent = formatTimestamp(state.user.createdAt);
        elements.userUpdatedValue.textContent = formatTimestamp(state.user.updatedAt);
        elements.userDataInput.value = JSON.stringify(state.user.data || {}, null, 2);
    }

    function updateAuthPanels() {
        const loggedIn = isLoggedIn();

        if (elements.loginForm) elements.loginForm.hidden = loggedIn;
        if (elements.openRegisterModalButton) elements.openRegisterModalButton.hidden = loggedIn;
        if (elements.loggedInPanel) elements.loggedInPanel.hidden = !loggedIn;
        if (elements.loggedInUsername) elements.loggedInUsername.textContent = state.user?.username || '-';

        if (elements.registerForm) elements.registerForm.hidden = loggedIn;
        if (elements.openLoginModalButton) elements.openLoginModalButton.hidden = loggedIn;

        if (loggedIn) {
            setStateMessage(elements.registerState, REGISTER_ALREADY_LOGGED_IN_TEXT, 'success');
        } else if (elements.registerState?.textContent === REGISTER_ALREADY_LOGGED_IN_TEXT) {
            setStateMessage(elements.registerState, '');
        }

        updateTooltips();
    }

    function syncUi() {
        updateAuthPanels();
        updateUserPanel();
        syncProfileNavActive();
    }

    async function requestBackend(path, options = {}) {
        const request = {
            method: options.method || 'GET',
            credentials: 'include',
            headers: {},
        };

        if (options.body !== undefined) {
            request.headers['Content-Type'] = 'application/json';
            request.body = JSON.stringify(options.body);
        }

        for (const base of API_BASES) {
            const url = `${base}${path}`;

            try {
                const response = await fetch(url, request);
                let payload = null;

                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }

                if (!response.ok) {
                    const error = createHttpError(
                        payload?.error || `Request fehlgeschlagen (${response.status})`,
                        response.status
                    );

                    if (!FALLBACK_HTTP_STATUSES.has(response.status)) {
                        throw error;
                    }
                    continue;
                }

                return payload;
            } catch (error) {
                const status = typeof error?.status === 'number' ? error.status : null;
                if (status && !FALLBACK_HTTP_STATUSES.has(status)) {
                    throw error;
                }
            }
        }

        return null;
    }

    async function apiRequest(path, options = {}) {
        const backendPayload = await requestBackend(path, options);
        if (backendPayload !== null) return backendPayload;
        return localAuthRequest(path, options.method || 'GET', options.body);
    }

    async function refreshSession() {
        try {
            const payload = await apiRequest('/api/me');
            state.user = payload?.user || null;
        } catch {
            state.user = null;
        } finally {
            syncUi();
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        setStateMessage(elements.loginState, '');

        const form = event.currentTarget;
        const username = normalizeUsername(form.username.value);
        const password = form.password.value;

        try {
            const payload = await apiRequest('/api/login', {
                method: 'POST',
                body: { username, password },
            });
            state.user = payload.user;
            syncUi();
            setStateMessage(elements.loginState, 'Login erfolgreich', 'success');
            closeModal(elements.loginModal);
            form.reset();
        } catch (error) {
            setStateMessage(elements.loginState, getErrorMessage(error), 'error');
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        setStateMessage(elements.registerState, '');

        const form = event.currentTarget;
        const username = normalizeUsername(form.username.value);
        const password = form.password.value;
        const passwordConfirm = form.passwordConfirm.value;

        if (password !== passwordConfirm) {
            setStateMessage(elements.registerState, 'Passwörter stimmen nicht überein', 'error');
            return;
        }

        try {
            const payload = await apiRequest('/api/register', {
                method: 'POST',
                body: { username, password, data: {} },
            });
            state.user = payload.user;
            syncUi();
            setStateMessage(elements.registerState, 'Registrierung erfolgreich', 'success');
            closeModal(elements.registerModal);
            form.reset();
        } catch (error) {
            setStateMessage(elements.registerState, getErrorMessage(error), 'error');
        }
    }

    async function handleLogout() {
        setStateMessage(elements.loginState, '');

        try {
            await apiRequest('/api/logout', { method: 'POST' });
            state.user = null;
            syncUi();
            setStateMessage(elements.loginState, 'Logout erfolgreich', 'success');
            closeModal(elements.loginModal);
            closeModal(elements.userModal);
        } catch (error) {
            setStateMessage(elements.loginState, getErrorMessage(error), 'error');
        }
    }

    async function handleSaveUserData(event) {
        event.preventDefault();
        if (!state.user) {
            setStateMessage(elements.userState, 'Bitte zuerst einloggen', 'error');
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(elements.userDataInput.value || '{}');
        } catch {
            setStateMessage(elements.userState, 'Ungültiges JSON', 'error');
            return;
        }

        if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
            setStateMessage(elements.userState, 'Bitte ein JSON-Objekt eingeben', 'error');
            return;
        }

        setStateMessage(elements.userState, '');
        try {
            const payload = await apiRequest('/api/me/data', {
                method: 'PUT',
                body: { data: parsedData },
            });
            state.user = payload.user;
            syncUi();
            setStateMessage(elements.userState, 'User-Daten gespeichert', 'success');
        } catch (error) {
            setStateMessage(elements.userState, getErrorMessage(error), 'error');
        }
    }

    async function openLoginModal(origin = elements.fingerprintImage) {
        const originRect = resolveOriginRect(origin);
        const switchingFromModal = isModalOpen(elements.registerModal) || isModalOpen(elements.userModal);
        const switchingFromExpandedCard = switchExpandedCardToModalContext();
        const shouldAnimateOpen = !switchingFromModal && !switchingFromExpandedCard;

        await closeModal(elements.registerModal, { animate: false, preserveExpandedState: switchingFromModal });
        await closeModal(elements.userModal, { animate: false, preserveExpandedState: switchingFromModal });
        setStateMessage(elements.loginState, '');
        syncUi();
        await openModal(elements.loginModal, originRect, { animate: shouldAnimateOpen });

        if (!isLoggedIn()) {
            document.getElementById('loginUsername')?.focus();
        }
    }

    async function openRegisterModal(origin = elements.openRegisterModalButton) {
        const originRect = resolveOriginRect(origin);
        if (isLoggedIn()) {
            await openLoginModal(originRect);
            setStateMessage(elements.loginState, 'Du bist bereits eingeloggt.', 'success');
            return;
        }

        const switchingFromModal = isModalOpen(elements.loginModal) || isModalOpen(elements.userModal);
        const switchingFromExpandedCard = switchExpandedCardToModalContext();
        const shouldAnimateOpen = !switchingFromModal && !switchingFromExpandedCard;

        await closeModal(elements.loginModal, { animate: false, preserveExpandedState: switchingFromModal });
        await closeModal(elements.userModal, { animate: false, preserveExpandedState: switchingFromModal });
        setStateMessage(elements.registerState, '');
        syncUi();
        await openModal(elements.registerModal, originRect, { animate: shouldAnimateOpen });
        document.getElementById('registerUsername')?.focus();
    }

    async function openUserModal(origin = elements.profileImage) {
        const originRect = resolveOriginRect(origin);
        if (!state.user) {
            await openLoginModal(originRect);
            setStateMessage(elements.loginState, 'Bitte zuerst einloggen', 'error');
            return;
        }

        const switchingFromModal = isModalOpen(elements.loginModal) || isModalOpen(elements.registerModal);
        const switchingFromExpandedCard = switchExpandedCardToModalContext();
        const shouldAnimateOpen = !switchingFromModal && !switchingFromExpandedCard;

        await closeModal(elements.loginModal, { animate: false, preserveExpandedState: switchingFromModal });
        await closeModal(elements.registerModal, { animate: false, preserveExpandedState: switchingFromModal });
        setStateMessage(elements.userState, '');
        updateUserPanel();
        await openModal(elements.userModal, originRect, { animate: shouldAnimateOpen });
    }

    async function toggleAuthModal(origin = elements.fingerprintImage) {
        if (isModalOpen(elements.loginModal) || isModalOpen(elements.registerModal)) {
            await closeModal(elements.loginModal);
            await closeModal(elements.registerModal);
            return;
        }

        await openLoginModal(origin);
    }

    async function toggleUserModal(origin = elements.profileImage) {
        if (isModalOpen(elements.userModal)) {
            await closeModal(elements.userModal);
            return;
        }

        if (!state.user && (isModalOpen(elements.loginModal) || isModalOpen(elements.registerModal))) {
            await closeModal(elements.loginModal);
            await closeModal(elements.registerModal);
            return;
        }

        await openUserModal(origin);
    }

    function attachEvents() {
        elements.fingerprintImage?.addEventListener('click', (event) => {
            void toggleAuthModal(event.currentTarget);
        });
        elements.profileImage?.addEventListener('click', (event) => {
            void toggleUserModal(event.currentTarget);
        });

        elements.profileContainer?.addEventListener('mouseenter', updateTooltips);
        elements.fingerprintContainer?.addEventListener('mouseenter', updateTooltips);

        elements.loginForm?.addEventListener('submit', handleLogin);
        elements.registerForm?.addEventListener('submit', handleRegister);
        elements.logoutButton?.addEventListener('click', handleLogout);
        elements.userDataForm?.addEventListener('submit', handleSaveUserData);
        elements.openRegisterModalButton?.addEventListener('click', (event) => {
            void openRegisterModal(event.currentTarget);
        });
        elements.openLoginModalButton?.addEventListener('click', (event) => {
            void openLoginModal(event.currentTarget);
        });

        document.addEventListener('click', (event) => {
            const target = getEventElement(event);
            if (!target) return;

            const closeTrigger = target.closest('[data-modal-close]');
            if (closeTrigger) {
                const modalId = closeTrigger.getAttribute('data-modal-close');
                if (!modalId) return;
                void closeModal(document.getElementById(modalId));
                return;
            }

            const openModalOverlay = getOpenModal();
            if (!openModalOverlay) return;

            const isInsideModal = Boolean(target.closest('.modal'));
            const isProfileTrigger = Boolean(target.closest('.profile-container, .fingerprint-container'));
            const isCardLink = Boolean(target.closest('a[data-target-card]'));

            if (!isInsideModal && !isProfileTrigger && !isCardLink) {
                void closeModal(openModalOverlay);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                void closeAllModals();
            }
        });

        window.addEventListener('resize', refreshOpenModalLayouts);
    }

    window.ProfileModalController = {
        hasOpenModal: anyModalOpen,
        closeAll: (options = {}) => closeAllModals(options),
        closeForCardSwitch: () => closeAllModals({ animate: false }),
        switchToCard(cardId) {
            if (!cardId || !anyModalOpen()) return false;
            void closeAllModals({ animate: false, preserveExpandedState: true }).then(() => {
                setGridModalState(false);
                document.body.classList.remove('modal-open');
                if (window.CardExpansion?.openCardByIdWithoutExpandAnimation) {
                    window.CardExpansion.openCardByIdWithoutExpandAnimation(cardId);
                } else if (window.CardExpansion?.openCardById) {
                    window.CardExpansion.openCardById(cardId);
                }
            });
            return true;
        },
    };

    attachEvents();
    refreshSession();
})();
