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

    function openModal(modal) {
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add('modal-open');
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.hidden = true;
        if (!anyModalOpen()) {
            document.body.classList.remove('modal-open');
        }
    }

    function closeAllModals() {
        closeModal(elements.loginModal);
        closeModal(elements.registerModal);
        closeModal(elements.userModal);
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

    function openLoginModal() {
        closeModal(elements.registerModal);
        setStateMessage(elements.loginState, '');
        syncUi();
        openModal(elements.loginModal);

        if (!isLoggedIn()) {
            document.getElementById('loginUsername')?.focus();
        }
    }

    function openRegisterModal() {
        if (isLoggedIn()) {
            openLoginModal();
            setStateMessage(elements.loginState, 'Du bist bereits eingeloggt.', 'success');
            return;
        }

        closeModal(elements.loginModal);
        setStateMessage(elements.registerState, '');
        syncUi();
        openModal(elements.registerModal);
        document.getElementById('registerUsername')?.focus();
    }

    function openUserModal() {
        if (!state.user) {
            openLoginModal();
            setStateMessage(elements.loginState, 'Bitte zuerst einloggen', 'error');
            return;
        }

        setStateMessage(elements.userState, '');
        updateUserPanel();
        openModal(elements.userModal);
    }

    function attachEvents() {
        elements.fingerprintImage?.addEventListener('click', openLoginModal);
        elements.profileImage?.addEventListener('click', openUserModal);

        elements.profileContainer?.addEventListener('mouseenter', updateTooltips);
        elements.fingerprintContainer?.addEventListener('mouseenter', updateTooltips);

        elements.loginForm?.addEventListener('submit', handleLogin);
        elements.registerForm?.addEventListener('submit', handleRegister);
        elements.logoutButton?.addEventListener('click', handleLogout);
        elements.userDataForm?.addEventListener('submit', handleSaveUserData);
        elements.openRegisterModalButton?.addEventListener('click', openRegisterModal);
        elements.openLoginModalButton?.addEventListener('click', openLoginModal);

        document.querySelectorAll('[data-modal-close]').forEach((button) => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal-close');
                if (!modalId) return;
                closeModal(document.getElementById(modalId));
            });
        });

        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal-overlay')) {
                closeModal(event.target);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeAllModals();
            }
        });
    }

    attachEvents();
    refreshSession();
})();
