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

    function setStateMessage(target, text, type = '') {
        if (!target) return;
        target.textContent = text || '';
        target.className = `modal-state${type ? ` is-${type}` : ''}`;
    }

    function formatTimestamp(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('de-DE');
    }

    function anyModalOpen() {
        return !elements.loginModal.hidden || !elements.registerModal.hidden || !elements.userModal.hidden;
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
        elements.profileTooltip.textContent = loggedIn ? 'Profil' : 'Profil (nicht eingeloggt)';
        elements.fingerprintTooltip.textContent = loggedIn ? 'Account' : 'Login';
    }

    function updateUserPanel() {
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
        elements.loginForm.hidden = loggedIn;
        elements.openRegisterModalButton.hidden = loggedIn;
        elements.loggedInPanel.hidden = !loggedIn;
        elements.loggedInUsername.textContent = state.user?.username || '-';

        elements.registerForm.hidden = loggedIn;
        elements.openLoginModalButton.hidden = loggedIn;

        if (loggedIn) {
            setStateMessage(elements.registerState, 'Du bist bereits eingeloggt. Logout im Login-Popup.', 'success');
        }

        updateTooltips();
    }

    async function apiRequest(path, options = {}) {
        const request = {
            method: options.method || 'GET',
            credentials: 'include',
            headers: {},
        };

        if (options.body !== undefined) {
            request.headers['Content-Type'] = 'application/json';
            request.body = JSON.stringify(options.body);
        }

        let lastError = null;

        for (let index = 0; index < API_BASES.length; index += 1) {
            const base = API_BASES[index];
            const isLastBase = index === API_BASES.length - 1;
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
                    if (!isLastBase) {
                        continue;
                    }

                    const message = payload?.error || `Request fehlgeschlagen (${response.status})`;
                    lastError = new Error(message);
                    break;
                }

                return payload;
            } catch (error) {
                lastError = error;
                (!isLastBase);
            }
        }

        throw lastError || new Error('Backend nicht erreichbar');
    }

    async function refreshSession() {
        try {
            const payload = await apiRequest('/api/me');
            state.user = payload?.user || null;
        } catch {
            state.user = null;
        } finally {
            updateAuthPanels();
            updateUserPanel();
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        setStateMessage(elements.loginState, '');

        const username = event.target.username.value.trim();
        const password = event.target.password.value;

        try {
            const payload = await apiRequest('/api/login', {
                method: 'POST',
                body: { username, password },
            });
            state.user = payload.user;
            updateAuthPanels();
            updateUserPanel();
            setStateMessage(elements.loginState, 'Login erfolgreich', 'success');
            closeModal(elements.loginModal);
            event.target.reset();
        } catch (error) {
            setStateMessage(elements.loginState, error.message, 'error');
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        setStateMessage(elements.registerState, '');

        const username = event.target.username.value.trim();
        const password = event.target.password.value;
        const passwordConfirm = event.target.passwordConfirm.value;

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
            updateAuthPanels();
            updateUserPanel();
            setStateMessage(elements.registerState, 'Registrierung erfolgreich', 'success');
            closeModal(elements.registerModal);
            event.target.reset();
        } catch (error) {
            setStateMessage(elements.registerState, error.message, 'error');
        }
    }

    async function handleLogout() {
        setStateMessage(elements.loginState, '');

        try {
            await apiRequest('/api/logout', { method: 'POST' });
            state.user = null;
            updateAuthPanels();
            updateUserPanel();
            setStateMessage(elements.loginState, 'Logout erfolgreich', 'success');
            closeModal(elements.loginModal);
            closeModal(elements.userModal);
        } catch (error) {
            setStateMessage(elements.loginState, error.message, 'error');
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
            updateUserPanel();
            updateAuthPanels();
            setStateMessage(elements.userState, 'User-Daten gespeichert', 'success');
        } catch (error) {
            setStateMessage(elements.userState, error.message, 'error');
        }
    }

    function openLoginModal() {
        closeModal(elements.registerModal);
        setStateMessage(elements.loginState, '');
        updateAuthPanels();
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
        updateAuthPanels();
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
        elements.fingerprintImage.addEventListener('click', openLoginModal);
        elements.profileImage.addEventListener('click', openUserModal);

        elements.profileContainer.addEventListener('mouseenter', updateTooltips);
        elements.fingerprintContainer.addEventListener('mouseenter', updateTooltips);

        elements.loginForm.addEventListener('submit', handleLogin);
        elements.registerForm.addEventListener('submit', handleRegister);
        elements.logoutButton.addEventListener('click', handleLogout);
        elements.userDataForm.addEventListener('submit', handleSaveUserData);
        elements.openRegisterModalButton.addEventListener('click', openRegisterModal);
        elements.openLoginModalButton.addEventListener('click', openLoginModal);

        document.querySelectorAll('[data-modal-close]').forEach((button) => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal-close');
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
    refreshSession().then();
})();
