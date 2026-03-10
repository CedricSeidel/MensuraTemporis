export function createProfileModel(options) {
    const {
        avatarChoices,
        avatarThemeColors,
        storageKey,
        resolveStorageKey,
        readStorage,
        writeStorage,
        normalizeUsername,
    } = options;

    function getStorageKey() {
        if (typeof resolveStorageKey !== 'function') return storageKey;
        const resolved = resolveStorageKey();
        return typeof resolved === 'string' && resolved ? resolved : storageKey;
    }

    function sanitizeAvatarChoice(value) {
        return avatarChoices.includes(value) ? value : avatarChoices[0];
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
        const key = getStorageKey();
        const profile = sanitizeProfile(readStorage(key, null));
        writeStorage(key, profile);
        return profile;
    }

    function saveProfile(profile) {
        if (!profile) return;
        writeStorage(getStorageKey(), profile);
    }

    function getAvatarThemeColors(avatar) {
        const normalized = sanitizeAvatarChoice(avatar);
        return avatarThemeColors[normalized] || avatarThemeColors.purple;
    }

    function applyAvatarTheme(avatar, root = document.documentElement) {
        if (!root) return;

        const normalized = sanitizeAvatarChoice(avatar);
        const colors = getAvatarThemeColors(normalized);
        root.style.setProperty('--color-accent', colors.accent);
        root.style.setProperty('--color-accent-blue', colors.accentBlue);
        root.dataset.avatarTheme = normalized;
    }

    return {
        sanitizeAvatarChoice,
        createDefaultProfile,
        loadProfile,
        saveProfile,
        applyAvatarTheme,
    };
}
