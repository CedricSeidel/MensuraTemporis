export function createLocalAuthApi(options) {
    const {
        storageKeys,
        readStorage,
        writeStorage,
        removeStorage,
        normalizeUsername,
        createHttpError,
    } = options;

    const PASSWORD_HASH_SCHEME = 'pbkdf2-sha256';
    const PASSWORD_HASH_ITERATIONS = 120000;
    const PASSWORD_SALT_BYTES = 16;
    const PASSWORD_HASH_BITS = 256;
    const textEncoder = new TextEncoder();
    let legacyPasswordMigrationDone = false;

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
        const users = readStorage(storageKeys.users, []);
        return Array.isArray(users) ? users : [];
    }

    function saveLocalUsers(users) {
        writeStorage(storageKeys.users, users);
    }

    function getLocalSession() {
        const session = readStorage(storageKeys.session, null);
        if (!session || typeof session.username !== 'string') return null;
        return session;
    }

    function setLocalSession(username) {
        writeStorage(storageKeys.session, { username });
    }

    function clearLocalSession() {
        removeStorage(storageKeys.session);
    }

    function findLocalUser(users, username) {
        const wanted = normalizeUsername(username).toLowerCase();
        return users.find((entry) => entry?.username?.toLowerCase() === wanted) || null;
    }

    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function timingSafeEqualBytes(left, right) {
        if (left.length !== right.length) return false;
        let mismatch = 0;
        for (let i = 0; i < left.length; i += 1) {
            mismatch |= left[i] ^ right[i];
        }
        return mismatch === 0;
    }

    function supportsPasswordHashing() {
        return Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
    }

    async function derivePasswordHash(password, saltBytes, iterations = PASSWORD_HASH_ITERATIONS) {
        const passwordKey = await globalThis.crypto.subtle.importKey(
            'raw',
            textEncoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits'],
        );

        const derivedBits = await globalThis.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: saltBytes,
                iterations,
            },
            passwordKey,
            PASSWORD_HASH_BITS,
        );

        return new Uint8Array(derivedBits);
    }

    async function createPasswordHash(password) {
        if (!supportsPasswordHashing()) {
            throw createHttpError('Secure password hashing is not supported in this browser', 500);
        }

        const salt = globalThis.crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
        const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
        return {
            scheme: PASSWORD_HASH_SCHEME,
            iterations: PASSWORD_HASH_ITERATIONS,
            salt: bytesToBase64(salt),
            hash: bytesToBase64(hash),
        };
    }

    async function verifyPasswordHash(password, passwordHash) {
        if (!passwordHash || typeof passwordHash !== 'object') return false;
        if (!supportsPasswordHashing()) return false;

        const {
            scheme,
            iterations,
            salt,
            hash,
        } = passwordHash;

        if (
            scheme !== PASSWORD_HASH_SCHEME
            || typeof iterations !== 'number'
            || !Number.isFinite(iterations)
            || iterations <= 0
            || typeof salt !== 'string'
            || typeof hash !== 'string'
        ) {
            return false;
        }

        try {
            const saltBytes = base64ToBytes(salt);
            const expectedHashBytes = base64ToBytes(hash);
            const actualHashBytes = await derivePasswordHash(password, saltBytes, iterations);
            return timingSafeEqualBytes(actualHashBytes, expectedHashBytes);
        } catch {
            return false;
        }
    }

    async function verifyUserPassword(password, user) {
        if (!user || typeof user !== 'object') return false;

        if (user.passwordHash) {
            return verifyPasswordHash(password, user.passwordHash);
        }

        return typeof user.password === 'string' && user.password === password;
    }

    async function migrateLegacyPasswords(users) {
        if (legacyPasswordMigrationDone) return;

        let changed = false;
        for (const user of users) {
            const hasLegacyPassword = typeof user?.password === 'string' && !user?.passwordHash;
            if (!hasLegacyPassword) continue;

            user.passwordHash = await createPasswordHash(user.password);
            delete user.password;
            user.updatedAt = new Date().toISOString();
            changed = true;
        }

        if (changed) {
            saveLocalUsers(users);
        }

        legacyPasswordMigrationDone = true;
    }

    function getSessionUser(users) {
        const session = getLocalSession();
        if (!session) return null;
        return users.find((entry) => entry?.username === session.username) || null;
    }

    async function localAuthRequest(path, method, body) {
        const upperMethod = method.toUpperCase();
        const users = getLocalUsers();
        const now = new Date().toISOString();
        await migrateLegacyPasswords(users);

        if (path === '/api/login' && upperMethod === 'POST') {
            const username = normalizeUsername(body?.username);
            const password = body?.password || '';
            const user = findLocalUser(users, username);

            if (!user || !(await verifyUserPassword(password, user))) {
                throw createHttpError('Invalid credentials', 401);
            }

            if (!user.passwordHash) {
                user.passwordHash = await createPasswordHash(password);
                delete user.password;
                saveLocalUsers(users);
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

            const passwordHash = await createPasswordHash(password);
            const newUser = {
                username,
                passwordHash,
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

        throw createHttpError('Action not available', 404);
    }

    return {
        toPublicUser,
        getLocalUsers,
        findLocalUser,
        getSessionUser,
        localAuthRequest,
    };
}
