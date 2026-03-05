(function initProfileAndAuth() {
    const state = {
        user: null,
        profile: null,
    };

    const elements = {
        profileImage: document.getElementById('profileImage'),
        fingerprintImage: document.getElementById('fingerprintImage'),
        profileTooltip: document.getElementById('profileTooltip'),
        fingerprintTooltip: document.getElementById('fingerprintTooltip'),
        profileContainer: document.querySelector('.profile-container'),
        fingerprintContainer: document.querySelector('.fingerprint-container'),
        loginModal: document.getElementById('loginModal'),
        userModal: document.getElementById('userModal'),
        loginModalTitle: document.getElementById('loginModalTitle'),
        loginState: document.getElementById('loginState'),
        registerState: document.getElementById('registerState'),
        userState: document.getElementById('userState'),
        loginPane: document.getElementById('loginPane'),
        registerPane: document.getElementById('registerPane'),
        loginForm: document.getElementById('loginForm'),
        loginUsername: document.getElementById('loginUsername'),
        loginPassword: document.getElementById('loginPassword'),
        loginPasswordToggle: document.getElementById('loginPasswordToggle'),
        registerForm: document.getElementById('registerForm'),
        registerUsername: document.getElementById('registerUsername'),
        registerUsernameCheck: document.getElementById('registerUsernameCheck'),
        registerUsernameHint: document.getElementById('registerUsernameHint'),
        loggedInPanel: document.getElementById('loggedInPanel'),
        loggedInUsername: document.getElementById('loggedInUsername'),
        logoutButton: document.getElementById('logoutButton'),
        openRegisterModalButton: document.getElementById('openRegisterModalButton'),
        openLoginModalButton: document.getElementById('openLoginModalButton'),
        userNameValue: document.getElementById('userNameValue'),
        userAvatarValue: document.getElementById('userAvatarValue'),
        userNameInput: document.getElementById('userNameInput'),
        userTimezoneInput: document.getElementById('userTimezoneInput'),
        userWeatherCityInput: document.getElementById('userWeatherCityInput'),
        userTemperatureUnitSelect: document.getElementById('userTemperatureUnitSelect'),
        userTimeFormatSelect: document.getElementById('userTimeFormatSelect'),
        userFocusModeInput: document.getElementById('userFocusModeInput'),
        userCompactModeInput: document.getElementById('userCompactModeInput'),
        userDataForm: document.getElementById('userDataForm'),
        userAvatarChoices: document.getElementById('userAvatarChoices'),
        userCharacterScene: document.getElementById('userCharacterScene'),
        userCharacterFigure: document.getElementById('userCharacterFigure'),
        loginCharacterScene: document.getElementById('loginCharacterScene'),
        loginCharacterFigure: document.getElementById('loginCharacterFigure'),
    };

    if (!elements.profileImage || !elements.fingerprintImage) return;

    const STORAGE_KEYS = {
        users: 'mensura-auth-users-v1',
        session: 'mensura-auth-session-v1',
        profile: 'mensura-user-profile-card-v1',
    };
    const APP_STORAGE_KEYS = {
        settings: 'mensura-settings-v2',
        weather: 'mensura-weather-v2',
        clock: 'mensura-clock-v2',
    };
    const DEFAULT_PREFERENCES = {
        timezone: 'Europe/Berlin',
        weatherCity: 'Kassel',
        temperatureUnit: 'c',
        mode24h: true,
        focus: false,
        compact: false,
    };
    const AVATAR_CHOICES = ['purple', 'orange', 'black', 'yellow'];
    const AVATAR_THEME_COLORS = {
        purple: {
            accent: '#d8c7ff',
            accentBlue: '#7c4dff',
        },
        orange: {
            accent: '#ffd2ac',
            accentBlue: '#f28b30',
        },
        black: {
            accent: '#c7ccd6',
            accentBlue: '#4d5976',
        },
        yellow: {
            accent: '#ffeaa3',
            accentBlue: '#c5a200',
        },
    };
    const MODAL_EXPAND_MS = 600;
    const MODAL_EXPAND_EASE = 'cubic-bezier(0.2, 0.0, 0.2, 1)';
    const MODAL_CLOSE_MS = 600;
    const MODAL_CLOSE_EASE = 'cubic-bezier(0.0, 0.0, 0.2, 1)';
    const NAV_ACTIVE_CLASS = 'is-active';
    const REGISTER_USERNAME_MIN_LEN = 3;
    const USER_SAVE_TOAST_MS = 1800;
    const USER_SAVE_TOAST_FADE_MS = 180;

    const authUi = {
        mode: 'login',
        usernameCheckRequestId: 0,
        registerUsernameFocused: false,
    };
    let userSaveToastHideTimeoutId = 0;
    let userSaveToastFadeTimeoutId = 0;

    const profileFigures = typeof window.createProfileFiguresController === 'function'
        ? window.createProfileFiguresController({
            loginScene: elements.loginCharacterScene,
            loginCluster: elements.loginCharacterFigure,
            userScene: elements.userCharacterScene,
            userCluster: elements.userCharacterFigure,
            isLoginModalOpen: () => isModalOpen(elements.loginModal),
            isUserModalOpen: () => isModalOpen(elements.userModal),
        })
        : null;

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

    function isValidTimezone(value) {
        if (!value || typeof value !== 'string') return false;
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
            return true;
        } catch {
            return false;
        }
    }

    function sanitizeTimezoneInput(value, fallback = DEFAULT_PREFERENCES.timezone) {
        return isValidTimezone(value) ? value : fallback;
    }

    function sanitizeTemperatureUnit(value) {
        return value === 'f' ? 'f' : 'c';
    }

    function readBoolean(value, fallback) {
        return typeof value === 'boolean' ? value : fallback;
    }

    function readUserPreferences() {
        const savedSettings = readStorage(APP_STORAGE_KEYS.settings, {});
        const savedWeather = readStorage(APP_STORAGE_KEYS.weather, {});
        const savedClock = readStorage(APP_STORAGE_KEYS.clock, {});
        const profilePreferences = state.profile?.data && typeof state.profile.data === 'object'
            ? state.profile.data.preferences
            : null;
        const profilePrefs = profilePreferences && typeof profilePreferences === 'object'
            ? profilePreferences
            : {};

        const timezone = sanitizeTimezoneInput(
            savedSettings.timezone || savedWeather.timezone || savedClock.timezone || profilePrefs.timezone,
            DEFAULT_PREFERENCES.timezone
        );
        const weatherCity = String(
            savedWeather.city || savedClock.city || profilePrefs.weatherCity || DEFAULT_PREFERENCES.weatherCity
        ).trim()
            || DEFAULT_PREFERENCES.weatherCity;

        return {
            timezone,
            weatherCity,
            temperatureUnit: sanitizeTemperatureUnit(savedWeather.unit || profilePrefs.temperatureUnit),
            mode24h: readBoolean(savedSettings.mode24h, readBoolean(profilePrefs.mode24h, DEFAULT_PREFERENCES.mode24h)),
            focus: readBoolean(savedSettings.focus, readBoolean(profilePrefs.focus, DEFAULT_PREFERENCES.focus)),
            compact: readBoolean(savedSettings.compact, readBoolean(profilePrefs.compact, DEFAULT_PREFERENCES.compact)),
        };
    }

    function applyBodyModeClasses(preferences) {
        document.body.classList.toggle('app-focus', Boolean(preferences.focus));
        document.body.classList.toggle('app-compact', Boolean(preferences.compact));
    }

    function writeUserPreferences(preferences) {
        const savedSettings = readStorage(APP_STORAGE_KEYS.settings, {});
        const savedWeather = readStorage(APP_STORAGE_KEYS.weather, {});
        const savedClock = readStorage(APP_STORAGE_KEYS.clock, {});

        writeStorage(APP_STORAGE_KEYS.settings, {
            ...savedSettings,
            mode24h: Boolean(preferences.mode24h),
            focus: Boolean(preferences.focus),
            compact: Boolean(preferences.compact),
            timezone: preferences.timezone,
        });

        writeStorage(APP_STORAGE_KEYS.weather, {
            ...savedWeather,
            city: preferences.weatherCity,
            timezone: preferences.timezone,
            unit: sanitizeTemperatureUnit(preferences.temperatureUnit),
        });

        writeStorage(APP_STORAGE_KEYS.clock, {
            ...savedClock,
            city: preferences.weatherCity,
            timezone: preferences.timezone,
        });
    }

    function readPreferencesFromForm() {
        const timezone = sanitizeTimezoneInput(
            String(elements.userTimezoneInput?.value || '').trim(),
            DEFAULT_PREFERENCES.timezone
        );
        const weatherCity = String(elements.userWeatherCityInput?.value || '').trim()
            || DEFAULT_PREFERENCES.weatherCity;
        const temperatureUnit = sanitizeTemperatureUnit(elements.userTemperatureUnitSelect?.value);
        const mode24h = (elements.userTimeFormatSelect?.value || '24h') !== '12h';
        const focus = Boolean(elements.userFocusModeInput?.checked);
        const compact = Boolean(elements.userCompactModeInput?.checked);

        return {
            timezone,
            weatherCity,
            temperatureUnit,
            mode24h,
            focus,
            compact,
        };
    }

    function populatePreferenceForm(preferences) {
        if (elements.userTimezoneInput) {
            elements.userTimezoneInput.value = preferences.timezone;
        }
        if (elements.userWeatherCityInput) {
            elements.userWeatherCityInput.value = preferences.weatherCity;
        }
        if (elements.userTemperatureUnitSelect) {
            elements.userTemperatureUnitSelect.value = sanitizeTemperatureUnit(preferences.temperatureUnit);
        }
        if (elements.userTimeFormatSelect) {
            elements.userTimeFormatSelect.value = preferences.mode24h ? '24h' : '12h';
        }
        if (elements.userFocusModeInput) {
            elements.userFocusModeInput.checked = Boolean(preferences.focus);
        }
        if (elements.userCompactModeInput) {
            elements.userCompactModeInput.checked = Boolean(preferences.compact);
        }
    }

    function dispatchPreferencesUpdated(preferences) {
        window.dispatchEvent(new CustomEvent('mensura:preferences-updated', {
            detail: {
                settings: {
                    mode24h: Boolean(preferences.mode24h),
                    focus: Boolean(preferences.focus),
                    compact: Boolean(preferences.compact),
                    timezone: preferences.timezone,
                },
                weather: {
                    city: preferences.weatherCity,
                    timezone: preferences.timezone,
                    unit: sanitizeTemperatureUnit(preferences.temperatureUnit),
                },
                clock: {
                    city: preferences.weatherCity,
                    timezone: preferences.timezone,
                },
            },
        }));
    }

    function sanitizeAvatarChoice(value) {
        return AVATAR_CHOICES.includes(value) ? value : AVATAR_CHOICES[0];
    }

    function createDefaultProfile() {
        const now = new Date().toISOString();
        return {
            username: 'Guest',
            avatar: 'purple',
            data: {},
            createdAt: now,
            updatedAt: now,
        };
    }

    function sanitizeProfile(value) {
        const fallback = createDefaultProfile();
        if (!value || typeof value !== 'object') return fallback;

        const username = normalizeUsername(value.username) || fallback.username;
        const createdAt = typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt;
        const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;
        const avatar = sanitizeAvatarChoice(value.avatar);
        const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data)
            ? value.data
            : {};

        return {
            username,
            avatar,
            data,
            createdAt,
            updatedAt,
        };
    }

    function loadProfile() {
        const profile = sanitizeProfile(readStorage(STORAGE_KEYS.profile, null));
        writeStorage(STORAGE_KEYS.profile, profile);
        return profile;
    }

    function saveProfile() {
        if (!state.profile) return;
        writeStorage(STORAGE_KEYS.profile, state.profile);
    }

    function getAvatarThemeColors(avatar) {
        const normalized = sanitizeAvatarChoice(avatar);
        return AVATAR_THEME_COLORS[normalized] || AVATAR_THEME_COLORS.purple;
    }

    function applyAvatarTheme(avatar) {
        const root = document.documentElement;
        if (!root) return;

        const normalized = sanitizeAvatarChoice(avatar);
        const colors = getAvatarThemeColors(normalized);
        root.style.setProperty('--color-accent', colors.accent);
        root.style.setProperty('--color-accent-blue', colors.accentBlue);
        root.dataset.avatarTheme = normalized;
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

    function setRegisterUsernameHint(text, type = '') {
        if (!elements.registerUsernameHint) return;
        elements.registerUsernameHint.textContent = text || '';
        elements.registerUsernameHint.className = `field-hint${type ? ` is-${type}` : ''}`;

        if (!elements.registerUsernameCheck) return;
        let label = 'Check';
        if (type === 'pending') label = 'Checking';
        if (type === 'success') label = 'OK';
        if (type === 'error') label = 'Taken';
        if (type === 'short') label = 'Short';

        elements.registerUsernameCheck.textContent = label;
        elements.registerUsernameCheck.className = `username-check${type ? ` is-${type}` : ''}`;
    }

    function clearRegisterUsernameTakenReaction() {
        profileFigures?.clearRegisterUsernameTakenReaction();
    }

    function triggerRegisterUsernameTakenReaction() {
        profileFigures?.triggerRegisterUsernameTakenReaction();
    }

    function setLoginCharacterNodState(isActive) {
        const shouldShow = Boolean(isActive)
            && authUi.mode === 'register'
            && !isLoggedIn()
            && authUi.registerUsernameFocused;
        profileFigures?.setRegisterUsernameOkState(shouldShow);
    }

    function applyAuthCardVisibility() {
        const loggedIn = isLoggedIn();
        const showRegister = !loggedIn && authUi.mode === 'register';
        const showLogin = !loggedIn && !showRegister;

        if (elements.loginModalTitle) {
            elements.loginModalTitle.textContent = showRegister ? 'Register' : 'Login';
        }

        if (elements.loginPane) elements.loginPane.hidden = !showLogin;
        if (elements.registerPane) elements.registerPane.hidden = !showRegister;
        if (elements.loggedInPanel) elements.loggedInPanel.hidden = !loggedIn;

        if (!showRegister) {
            authUi.registerUsernameFocused = false;
            setRegisterUsernameHint('');
        }

        if (loggedIn || !showRegister) {
            setLoginCharacterNodState(false);
            clearRegisterUsernameTakenReaction();
        }
    }

    function setAuthMode(mode) {
        authUi.mode = mode === 'register' ? 'register' : 'login';
        applyAuthCardVisibility();
    }

    async function checkRegisterUsernameAvailability(username) {
        const normalized = normalizeUsername(username);
        if (normalized.length < REGISTER_USERNAME_MIN_LEN) {
            return null;
        }

        const users = getLocalUsers();
        return !findLocalUser(users, normalized);
    }

    async function runRegisterUsernameAvailabilityCheck() {
        if (authUi.mode !== 'register' || isLoggedIn()) return;
        if (!elements.registerUsername) return;

        const username = normalizeUsername(elements.registerUsername.value);
        authUi.usernameCheckRequestId += 1;
        const requestId = authUi.usernameCheckRequestId;

        if (username.length < REGISTER_USERNAME_MIN_LEN) {
            setRegisterUsernameHint(username ? `At least ${REGISTER_USERNAME_MIN_LEN} characters` : '');
            setLoginCharacterNodState(false);
            clearRegisterUsernameTakenReaction();
            return;
        }

        setRegisterUsernameHint('Checking username...');
        setLoginCharacterNodState(false);
        clearRegisterUsernameTakenReaction();

        const available = await checkRegisterUsernameAvailability(username);
        if (requestId !== authUi.usernameCheckRequestId) return;

        const latestValue = normalizeUsername(elements.registerUsername?.value || '');
        if (latestValue !== username) return;

        if (available) {
            setRegisterUsernameHint('Username is available', 'success');
            setLoginCharacterNodState(true);
            clearRegisterUsernameTakenReaction();
            return;
        }

        setRegisterUsernameHint('Username is already taken', 'error');
        setLoginCharacterNodState(false);
        triggerRegisterUsernameTakenReaction();
    }

    function handleRegisterUsernameInput() {
        void runRegisterUsernameAvailabilityCheck();
    }

    function handleRegisterUsernameFocus() {
        authUi.registerUsernameFocused = true;
        void runRegisterUsernameAvailabilityCheck();
    }

    function handleRegisterUsernameBlur() {
        authUi.registerUsernameFocused = false;
        setLoginCharacterNodState(false);
        void runRegisterUsernameAvailabilityCheck();
    }

    function resetRegisterAvailabilityUi() {
        authUi.usernameCheckRequestId += 1;
        authUi.registerUsernameFocused = false;
        setRegisterUsernameHint('');
        setLoginCharacterNodState(false);
        clearRegisterUsernameTakenReaction();
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
                throw createHttpError('Invalid credentials', 401);
            }

            setLocalSession(user.username);
            return { user: toPublicUser(user) };
        }

        if (path === '/api/register' && upperMethod === 'POST') {
            const username = normalizeUsername(body?.username);
            const password = body?.password || '';

            if (username.length < 3) {
                throw createHttpError('Username must be at least 3 characters', 400);
            }

            if (password.length < 8) {
                throw createHttpError('Password must be at least 8 characters', 400);
            }

            if (findLocalUser(users, username)) {
                throw createHttpError('Username is already taken', 409);
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
                throw createHttpError('Please log in first', 401);
            }

            currentUser.data = body?.data && typeof body.data === 'object' ? body.data : {};
            currentUser.updatedAt = now;

            saveLocalUsers(users);
            return { user: toPublicUser(currentUser) };
        }

        throw createHttpError('Action not available', 404);
    }

    function setStateMessage(target, text, type = '') {
        if (!target) return;
        target.textContent = text || '';
        target.className = `modal-state${type ? ` is-${type}` : ''}`;
    }

    function getErrorMessage(error, fallback = 'Unknown error') {
        if (error instanceof Error && error.message) {
            return error.message;
        }
        return fallback;
    }

    function clearUserSaveToastTimers() {
        if (userSaveToastHideTimeoutId) {
            window.clearTimeout(userSaveToastHideTimeoutId);
            userSaveToastHideTimeoutId = 0;
        }
        if (userSaveToastFadeTimeoutId) {
            window.clearTimeout(userSaveToastFadeTimeoutId);
            userSaveToastFadeTimeoutId = 0;
        }
    }

    function ensureUserSaveToastElement() {
        let toast = document.body.querySelector('.user-save-toast');
        if (toast instanceof HTMLElement) return toast;

        toast = document.createElement('div');
        toast.className = 'user-save-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.hidden = true;
        document.body.appendChild(toast);
        return toast;
    }

    function hideUserSaveToast({ immediate = false } = {}) {
        const toast = ensureUserSaveToastElement();
        if (!(toast instanceof HTMLElement)) return;

        clearUserSaveToastTimers();

        if (immediate) {
            toast.hidden = true;
            toast.classList.remove('is-visible', 'is-success', 'is-error');
            return;
        }

        toast.classList.remove('is-visible');
        userSaveToastFadeTimeoutId = window.setTimeout(() => {
            toast.hidden = true;
            userSaveToastFadeTimeoutId = 0;
        }, USER_SAVE_TOAST_FADE_MS);
    }

    function showUserSaveToast(message, type = 'success') {
        const toast = ensureUserSaveToastElement();
        if (!(toast instanceof HTMLElement)) return;

        clearUserSaveToastTimers();
        toast.textContent = message;
        toast.hidden = false;
        toast.classList.remove('is-success', 'is-error', 'is-visible');
        toast.classList.add(type === 'error' ? 'is-error' : 'is-success');
        window.requestAnimationFrame(() => {
            toast.classList.add('is-visible');
        });

        userSaveToastHideTimeoutId = window.setTimeout(() => {
            hideUserSaveToast();
        }, USER_SAVE_TOAST_MS);
    }

    function syncFigureSceneScales() {
        profileFigures?.syncScales();
    }

    function centerLoginCharacterPointer() {
        profileFigures?.centerLoginPointer();
    }

    function startLoginCharacterAnimation() {
        profileFigures?.startLoginAnimation();
    }

    function setLoginPasswordVisibility(isVisible, options = {}) {
        if (!elements.loginPassword) return;
        const { focusInput = false } = options;
        const visible = Boolean(isVisible);

        elements.loginPassword.type = visible ? 'text' : 'password';
        elements.loginPasswordToggle?.setAttribute('aria-pressed', String(visible));
        elements.loginPasswordToggle?.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');

        if (elements.loginPasswordToggle) {
            elements.loginPasswordToggle.textContent = visible ? 'Hide' : 'Show';
        }

        setLoginCharacterPasswordMode(visible);

        if (!focusInput) return;
        elements.loginPassword.focus();
        const length = elements.loginPassword.value.length;
        elements.loginPassword.setSelectionRange(length, length);
    }

    function toggleLoginPasswordVisibility() {
        if (!elements.loginPassword) return;
        const isVisible = elements.loginPassword.type === 'text';
        setLoginPasswordVisibility(!isVisible, { focusInput: true });
    }

    function setLoginCharacterPasswordMode(isActive) {
        profileFigures?.setLoginPasswordMode(isActive);
    }

    function triggerLoginCharacterReaction(type) {
        profileFigures?.triggerLoginReaction(type);
    }

    function resetLoginCharacterState() {
        profileFigures?.resetLoginState();
    }

    function handleLoginModalPointerMove(event) {
        profileFigures?.handleLoginPointerMove(event);
    }

    function handleLoginModalPointerLeave() {
        profileFigures?.handleLoginPointerLeave();
    }

    function centerUserCharacterPointer() {
        profileFigures?.centerUserPointer();
    }

    function startUserCharacterAnimation() {
        profileFigures?.startUserAnimation();
    }

    function resetUserCharacterState() {
        profileFigures?.resetUserState();
    }

    function handleUserModalPointerMove(event) {
        profileFigures?.handleUserPointerMove(event);
    }

    function handleUserModalPointerLeave() {
        profileFigures?.handleUserPointerLeave();
    }

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
        const openModalId = [elements.loginModal, elements.userModal]
            .find((modal) => modal && !modal.hidden)?.id || '';

        const loginActive = openModalId === 'loginModal';
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
            syncFigureSceneScales();
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
        [elements.loginModal, elements.userModal].forEach((modal) => {
            if (!modal || modal.hidden) return;
            applyModalGridLayout(modal);
        });
        syncFigureSceneScales();
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
        syncFigureSceneScales();
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
                    resetRegisterAvailabilityUi();
                    setAuthMode('login');
                    setLoginPasswordVisibility(false);
                    resetLoginCharacterState();
                }
                if (modal === elements.userModal) {
                    hideUserSaveToast({ immediate: true });
                    resetUserCharacterState();
                }
                return closed;
            });
        }

        modal.hidden = true;
        clearModalGridLayout(modal);
        if (modal === elements.loginModal) {
            resetRegisterAvailabilityUi();
            setAuthMode('login');
            setLoginPasswordVisibility(false);
            resetLoginCharacterState();
        }
        if (modal === elements.userModal) {
            hideUserSaveToast({ immediate: true });
            resetUserCharacterState();
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

    function isLoggedIn() {
        return Boolean(state.user);
    }

    function updateTooltips() {
        const loggedIn = isLoggedIn();
        const profileName = normalizeUsername(state.profile?.username) || (loggedIn ? state.user?.username : '') || 'Guest';
        if (elements.profileTooltip) {
            elements.profileTooltip.textContent = `Profile: ${profileName}`;
        }
        if (elements.fingerprintTooltip) {
            elements.fingerprintTooltip.textContent = loggedIn ? 'Account' : 'Login';
        }
    }

    function applySelectedUserAvatar(avatar) {
        const normalized = sanitizeAvatarChoice(avatar);
        applyAvatarTheme(normalized);
        if (elements.userCharacterScene) {
            elements.userCharacterScene.dataset.selectedAvatar = normalized;
        }
        if (elements.userAvatarValue) {
            const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
            elements.userAvatarValue.textContent = label;
        }
        if (elements.userAvatarChoices) {
            Array.from(elements.userAvatarChoices.querySelectorAll('[data-avatar-choice]')).forEach((button) => {
                const isActive = button instanceof HTMLElement && button.dataset.avatarChoice === normalized;
                button.classList.toggle('is-active', isActive);
            });
        }
    }

    function updateUserPanel() {
        if (
            !elements.userNameValue ||
            !elements.userNameInput
        ) {
            return;
        }

        const profile = state.profile || createDefaultProfile();
        state.profile = profile;

        elements.userNameValue.textContent = profile.username || '-';
        elements.userNameInput.value = profile.username || '';
        applySelectedUserAvatar(profile.avatar);
        populatePreferenceForm(readUserPreferences());
        updateTooltips();
    }

    function handleUserNameInput() {
        if (!elements.userNameInput || !elements.userNameValue) return;
        const value = normalizeUsername(elements.userNameInput.value) || 'Guest';
        elements.userNameValue.textContent = value;
        if (state.profile) {
            state.profile.username = value;
        }
        updateTooltips();
    }

    function selectUserAvatar(avatar) {
        if (!state.profile) state.profile = createDefaultProfile();
        const normalized = sanitizeAvatarChoice(avatar);
        const changed = state.profile.avatar !== normalized;
        state.profile.avatar = normalized;
        if (changed) {
            state.profile.updatedAt = new Date().toISOString();
            saveProfile();
        }
        applySelectedUserAvatar(state.profile.avatar);
    }

    function handleUserAvatarChoice(event) {
        const target = getEventElement(event);
        const choiceElement = target?.closest?.('[data-avatar-choice]');
        if (!choiceElement) return;
        const avatar = choiceElement.getAttribute('data-avatar-choice');
        if (!avatar) return;
        selectUserAvatar(avatar);
    }

    function handleUserCharacterChoice(event) {
        const target = getEventElement(event);
        const character = target?.closest?.('.character[data-avatar-choice]');
        if (!character) return;
        const avatar = character.getAttribute('data-avatar-choice');
        if (!avatar) return;
        selectUserAvatar(avatar);
    }

    function syncProfileUsernameFromAuth() {
        if (!state.profile) return;
        const authName = normalizeUsername(state.user?.username);
        const currentProfileName = normalizeUsername(state.profile.username);
        if (!authName) return;

        if (!currentProfileName || currentProfileName === 'Guest') {
            state.profile.username = authName;
            state.profile.updatedAt = new Date().toISOString();
            saveProfile();
        }
    }

    function updateAuthPanels() {
        if (elements.loggedInUsername) elements.loggedInUsername.textContent = state.user?.username || '-';
        applyAuthCardVisibility();

        updateTooltips();
    }

    function syncUi() {
        updateAuthPanels();
        updateUserPanel();
        syncProfileNavActive();
    }

    async function apiRequest(path, options = {}) {
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
            syncProfileUsernameFromAuth();
            syncUi();
            setStateMessage(elements.loginState, 'Login successful', 'success');
            triggerLoginCharacterReaction('success');
            await new Promise((resolve) => window.setTimeout(resolve, 220));
            setLoginPasswordVisibility(false);
            await closeModal(elements.loginModal);
            form.reset();
        } catch (error) {
            setStateMessage(elements.loginState, getErrorMessage(error), 'error');
            triggerLoginCharacterReaction('error');
            elements.loginPassword?.focus();
            elements.loginPassword?.select?.();
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
            setStateMessage(elements.registerState, 'Passwords do not match', 'error');
            return;
        }

        const usernameAvailable = await checkRegisterUsernameAvailability(username);
        if (usernameAvailable === false) {
            setRegisterUsernameHint('Username is already taken', 'error');
            setLoginCharacterNodState(false);
            setStateMessage(elements.registerState, 'Username is already taken', 'error');
            return;
        }

        try {
            const payload = await apiRequest('/api/register', {
                method: 'POST',
                body: { username, password, data: {} },
            });
            state.user = payload.user;
            syncProfileUsernameFromAuth();
            resetRegisterAvailabilityUi();
            setAuthMode('login');
            syncUi();
            setStateMessage(elements.registerState, 'Registration successful', 'success');
            await closeModal(elements.loginModal);
            form.reset();
        } catch (error) {
            setLoginCharacterNodState(false);
            setStateMessage(elements.registerState, getErrorMessage(error), 'error');
        }
    }

    async function handleLogout() {
        setStateMessage(elements.loginState, '');

        try {
            await apiRequest('/api/logout', { method: 'POST' });
            state.user = null;
            syncUi();
            setStateMessage(elements.loginState, 'Logout successful', 'success');
            closeModal(elements.loginModal);
            closeModal(elements.userModal);
        } catch (error) {
            setStateMessage(elements.loginState, getErrorMessage(error), 'error');
        }
    }

    async function handleSaveUserData(event) {
        event.preventDefault();
        hideUserSaveToast({ immediate: true });
        if (!state.profile) state.profile = createDefaultProfile();

        const username = normalizeUsername(elements.userNameInput?.value);
        if (username.length < 2) {
            setStateMessage(elements.userState, 'Username must be at least 2 characters', 'error');
            return;
        }

        const rawTimezone = String(elements.userTimezoneInput?.value || '').trim();
        if (rawTimezone && !isValidTimezone(rawTimezone)) {
            setStateMessage(elements.userState, 'Timezone is invalid (example: Europe/Berlin)', 'error');
            return;
        }

        const preferences = readPreferencesFromForm();

        setStateMessage(elements.userState, '');
        state.profile = {
            ...state.profile,
            username,
            avatar: sanitizeAvatarChoice(state.profile.avatar),
            data: {
                ...(state.profile.data && typeof state.profile.data === 'object' ? state.profile.data : {}),
                preferences,
            },
            updatedAt: new Date().toISOString(),
        };

        writeUserPreferences(preferences);
        applyBodyModeClasses(preferences);
        dispatchPreferencesUpdated(preferences);
        saveProfile();
        updateUserPanel();
        showUserSaveToast('Saved', 'success');

        window.requestAnimationFrame(() => {
            refreshOpenModalLayouts();
            window.requestAnimationFrame(() => {
                refreshOpenModalLayouts();
            });
        });
    }

    async function openLoginModal(origin = elements.fingerprintImage) {
        const originRect = resolveOriginRect(origin);
        const loginAlreadyOpen = isModalOpen(elements.loginModal);
        const switchingFromModal = isModalOpen(elements.userModal);
        const switchingFromExpandedCard = switchExpandedCardToModalContext();
        const shouldAnimateOpen = !loginAlreadyOpen && !switchingFromModal && !switchingFromExpandedCard;

        await closeModal(elements.userModal, { animate: false, preserveExpandedState: switchingFromModal });
        resetRegisterAvailabilityUi();
        setAuthMode('login');
        setStateMessage(elements.registerState, '');
        setStateMessage(elements.loginState, '');
        if (!loginAlreadyOpen) {
            resetLoginCharacterState();
            await openModal(elements.loginModal, originRect, { animate: shouldAnimateOpen });
            centerLoginCharacterPointer();
            startLoginCharacterAnimation();
        }

        setLoginPasswordVisibility(false);
        syncUi();

        if (!isLoggedIn()) {
            elements.loginUsername?.focus();
        }
    }

    async function openRegisterModal(origin = elements.openRegisterModalButton) {
        const originRect = resolveOriginRect(origin);
        if (isLoggedIn()) {
            await openLoginModal(originRect);
            setStateMessage(elements.loginState, 'You are already logged in.', 'success');
            return;
        }

        const loginAlreadyOpen = isModalOpen(elements.loginModal);
        const switchingFromModal = isModalOpen(elements.userModal);
        const switchingFromExpandedCard = switchExpandedCardToModalContext();
        const shouldAnimateOpen = !loginAlreadyOpen && !switchingFromModal && !switchingFromExpandedCard;

        await closeModal(elements.userModal, { animate: false, preserveExpandedState: switchingFromModal });
        setLoginPasswordVisibility(false);
        if (!loginAlreadyOpen) {
            resetLoginCharacterState();
            await openModal(elements.loginModal, originRect, { animate: shouldAnimateOpen });
            centerLoginCharacterPointer();
            startLoginCharacterAnimation();
        }
        setAuthMode('register');
        setStateMessage(elements.registerState, '');
        setStateMessage(elements.loginState, '');
        syncUi();
        void runRegisterUsernameAvailabilityCheck();
        elements.registerUsername?.focus();
    }

    async function openUserModal(origin = elements.profileImage) {
        const originRect = resolveOriginRect(origin);
        const switchingFromModal = isModalOpen(elements.loginModal);
        const switchingFromExpandedCard = switchExpandedCardToModalContext();
        const shouldAnimateOpen = !switchingFromModal && !switchingFromExpandedCard;

        await closeModal(elements.loginModal, { animate: false, preserveExpandedState: switchingFromModal });
        hideUserSaveToast({ immediate: true });
        setStateMessage(elements.userState, '');
        updateUserPanel();
        await openModal(elements.userModal, originRect, { animate: shouldAnimateOpen });
        centerUserCharacterPointer();
        startUserCharacterAnimation();
        elements.userNameInput?.focus();
    }

    async function toggleAuthModal(origin = elements.fingerprintImage) {
        if (isModalOpen(elements.loginModal)) {
            await closeModal(elements.loginModal);
            return;
        }

        await openLoginModal(origin);
    }

    async function toggleUserModal(origin = elements.profileImage) {
        if (isModalOpen(elements.userModal)) {
            await closeModal(elements.userModal);
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
        elements.loginPasswordToggle?.addEventListener('click', toggleLoginPasswordVisibility);
        elements.registerForm?.addEventListener('submit', handleRegister);
        elements.registerUsername?.addEventListener('input', handleRegisterUsernameInput);
        elements.registerUsername?.addEventListener('focus', handleRegisterUsernameFocus);
        elements.registerUsername?.addEventListener('blur', handleRegisterUsernameBlur);
        elements.logoutButton?.addEventListener('click', handleLogout);
        elements.userNameInput?.addEventListener('input', handleUserNameInput);
        elements.userDataForm?.addEventListener('submit', handleSaveUserData);
        elements.userAvatarChoices?.addEventListener('click', handleUserAvatarChoice);
        elements.userCharacterScene?.addEventListener('click', handleUserCharacterChoice);
        elements.openRegisterModalButton?.addEventListener('click', (event) => {
            void openRegisterModal(event.currentTarget);
        });
        elements.openLoginModalButton?.addEventListener('click', (event) => {
            void openLoginModal(event.currentTarget);
        });
        elements.loginModal?.addEventListener('pointermove', handleLoginModalPointerMove);
        elements.loginModal?.addEventListener('pointerleave', handleLoginModalPointerLeave);
        elements.userModal?.addEventListener('pointermove', handleUserModalPointerMove);
        elements.userModal?.addEventListener('pointerleave', handleUserModalPointerLeave);

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

    state.profile = loadProfile();
    applyAvatarTheme(state.profile?.avatar);
    attachEvents();
    refreshSession();
})();
