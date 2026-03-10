import {
    applyAlwaysOnBodyModes as applyBodyModeClasses,
    getScopedStorageKey,
    isValidTimezone,
    readBoolean,
    readStorage,
    writeStorage,
    removeStorage,
} from './core/runtimeUtils.js';
import { getEventElement } from './core/domUtils.js';
import { hideAuthRequiredPopup, showAuthRequiredPopup } from './core/authGate.js';
import {
    APP_STORAGE_KEYS,
    AVATAR_CHOICES,
    AVATAR_THEME_COLORS,
    DEFAULT_PREFERENCES,
    MODAL_CLOSE_EASE,
    MODAL_CLOSE_MS,
    MODAL_EXPAND_EASE,
    MODAL_EXPAND_MS,
    NAV_ACTIVE_CLASS,
    REGISTER_USERNAME_MIN_LEN,
    STORAGE_KEYS,
    USER_SAVE_TOAST_FADE_MS,
    USER_SAVE_TOAST_MS,
} from './profile/constants.js';
import { getProfileElements } from './profile/elements.js';
import { createLocalAuthApi } from './profile/localAuth.js';
import { createModalManager } from './profile/modalManager.js';
import { createProfileModel } from './profile/model.js';
import { createPreferencesService } from './profile/preferences.js';

(function initProfileAndAuth() {
    const state = {
        user: null,
        profile: null,
    };

    const elements = getProfileElements();
    if (!elements.profileImage || !elements.fingerprintImage) return;

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

    function normalizeUsername(value) {
        return (value || '').trim();
    }

    const profileModel = createProfileModel({
        avatarChoices: AVATAR_CHOICES,
        avatarThemeColors: AVATAR_THEME_COLORS,
        storageKey: STORAGE_KEYS.profile,
        resolveStorageKey: () => getScopedStorageKey(STORAGE_KEYS.profile, state.user?.username),
        readStorage,
        writeStorage,
        normalizeUsername,
    });

    const {
        applyAvatarTheme,
        createDefaultProfile,
        loadProfile,
        sanitizeAvatarChoice,
        saveProfile: saveProfileToStorage,
    } = profileModel;

    function saveProfile() {
        if (!state.profile) return;
        saveProfileToStorage(state.profile);
    }

    const localAuthApi = createLocalAuthApi({
        storageKeys: STORAGE_KEYS,
        readStorage,
        writeStorage,
        removeStorage,
        normalizeUsername,
        createHttpError,
    });

    const {
        findLocalUser,
        getLocalUsers,
        getSessionUser,
        localAuthRequest,
        toPublicUser,
    } = localAuthApi;

    const preferencesService = createPreferencesService({
        appStorageKeys: APP_STORAGE_KEYS,
        defaultPreferences: DEFAULT_PREFERENCES,
        state,
        elements,
        getScopedStorageKey,
        isValidTimezone,
        readBoolean,
        readStorage,
        writeStorage,
    });

    const {
        dispatchPreferencesUpdated,
        populatePreferenceForm,
        readPreferencesFromForm,
        readUserPreferences,
        writeUserPreferences,
    } = preferencesService;

    function applyActivePreferencesToWidgets() {
        const preferences = readUserPreferences();
        dispatchPreferencesUpdated(preferences);
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

    const modalManager = createModalManager({
        elements,
        navActiveClass: NAV_ACTIVE_CLASS,
        modalExpandMs: MODAL_EXPAND_MS,
        modalExpandEase: MODAL_EXPAND_EASE,
        modalCloseMs: MODAL_CLOSE_MS,
        modalCloseEase: MODAL_CLOSE_EASE,
        onFigureScaleSync: syncFigureSceneScales,
        onLoginModalClosed: () => {
            resetRegisterAvailabilityUi();
            setAuthMode('login');
            setLoginPasswordVisibility(false);
            resetLoginCharacterState();
        },
        onUserModalClosed: () => {
            hideUserSaveToast({ immediate: true });
            resetUserCharacterState();
        },
    });

    const {
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
    } = modalManager;

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
        const users = getLocalUsers();
        const currentUser = getSessionUser(users);
        state.user = toPublicUser(currentUser);
        state.profile = loadProfile();
        if (state.user) {
            hideAuthRequiredPopup({ immediate: true });
        }
        syncProfileUsernameFromAuth();
        syncUi();
        applyActivePreferencesToWidgets();
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
            hideAuthRequiredPopup({ immediate: true });
            state.profile = loadProfile();
            syncProfileUsernameFromAuth();
            syncUi();
            applyActivePreferencesToWidgets();
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
            hideAuthRequiredPopup({ immediate: true });
            state.profile = loadProfile();
            syncProfileUsernameFromAuth();
            resetRegisterAvailabilityUi();
            setAuthMode('login');
            syncUi();
            applyActivePreferencesToWidgets();
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
            state.profile = loadProfile();
            syncUi();
            applyActivePreferencesToWidgets();
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
        applyBodyModeClasses();
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
        if (!isLoggedIn()) {
            showAuthRequiredPopup();
            return;
        }

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
        isLoggedIn: () => isLoggedIn(),
        openLogin(origin = elements.fingerprintImage) {
            void openLoginModal(origin);
            return true;
        },
        closeAll: (options = {}) => closeAllModals(options),
        closeForCardSwitch: () => closeAllModals({ animate: false }),
        switchToCard(cardId) {
            if (!cardId || !anyModalOpen()) return false;
            if (!isLoggedIn()) {
                showAuthRequiredPopup();
                void openLoginModal(elements.fingerprintImage);
                return true;
            }

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
    applyBodyModeClasses();
    attachEvents();
    refreshSession();
})();
