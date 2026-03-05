(function initProfileFiguresFactory() {
    const LOGIN_CHARACTER_ERROR_MS = 720;
    const LOGIN_CHARACTER_SUCCESS_MS = 640;
    const LOGIN_CHARACTER_PASSWORD_LOOK = {
        x: 0.24,
        y: 0.28,
    };
    const CHARACTER_SCENE_BASE_EDGE = 500;
    const CHARACTER_SCENE_SCALE_MIN = 0.72;
    const CHARACTER_SCENE_SCALE_MAX = 1.35;

    function toNumber(value, fallback = 0) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function lerp(start, end, amount) {
        return start + ((end - start) * amount);
    }

    function getCharacterSceneScale(scene) {
        if (!scene) return 1;
        const rect = scene.getBoundingClientRect();
        if (!rect.width || !rect.height) return 1;
        const sceneEdge = Math.min(rect.width, rect.height);
        const rawScale = sceneEdge / CHARACTER_SCENE_BASE_EDGE;
        return clamp(rawScale, CHARACTER_SCENE_SCALE_MIN, CHARACTER_SCENE_SCALE_MAX);
    }

    function syncCharacterSceneScale(characterState) {
        if (!characterState?.scene) return 1;
        const scale = getCharacterSceneScale(characterState.scene);
        characterState.motionScale = scale;
        characterState.scene.style.setProperty('--character-scene-scale', scale.toFixed(4));
        return scale;
    }

    function createCharacterState(scene, cluster) {
        const chars = scene
            ? Array.from(scene.querySelectorAll('.character')).map((character) => ({
                el: character,
                body: character.querySelector('.body'),
                trackers: Array.from(character.querySelectorAll('.tracker')),
                cfg: {
                    move: toNumber(character.dataset.move),
                    rotate: toNumber(character.dataset.rotate),
                    skew: toNumber(character.dataset.skew),
                    lift: toNumber(character.dataset.lift),
                    pupil: toNumber(character.dataset.pupil, 1.8),
                },
                state: {
                    tx: 0,
                    ty: 0,
                    rot: 0,
                    skew: 0,
                },
            }))
            : [];

        return {
            scene,
            cluster,
            chars,
            hasFigure: Boolean(scene && cluster && chars.length),
            motionScale: 1,
            rafId: 0,
            pointer: {
                x: window.innerWidth * 0.5,
                y: window.innerHeight * 0.5,
                inside: false,
            },
            blinkTimerId: 0,
            reactionTimerId: 0,
            registerTakenTimerId: 0,
            isPasswordMode: false,
            isReactionLocked: false,
        };
    }

    function centerCharacterPointer(characterState) {
        if (!characterState.scene) return;
        const rect = characterState.scene.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            characterState.pointer.x = window.innerWidth * 0.5;
            characterState.pointer.y = window.innerHeight * 0.5;
            characterState.pointer.inside = false;
            return;
        }

        characterState.pointer.x = rect.left + (rect.width * 0.5);
        characterState.pointer.y = rect.top + (rect.height * 0.5);
        characterState.pointer.inside = false;
    }

    function updateCharacterTrackers(characterState, character, pointerTarget) {
        const motionScale = characterState.motionScale || 1;
        character.trackers.forEach((tracker) => {
            const rect = tracker.getBoundingClientRect();
            const centerX = rect.left + (rect.width * 0.5);
            const centerY = rect.top + (rect.height * 0.5);

            const dx = pointerTarget.x - centerX;
            const dy = pointerTarget.y - centerY;
            const distance = Math.hypot(dx, dy) || 1;
            const maxMove = tracker.classList.contains('white')
                ? character.cfg.pupil * motionScale
                : Math.min(character.cfg.pupil, 1.8) * motionScale;
            const reach = Math.min(maxMove, distance * 0.12);

            tracker.style.setProperty('--px', `${(dx / distance) * reach}px`);
            tracker.style.setProperty('--py', `${(dy / distance) * reach}px`);
        });
    }

    function resetCharacters(characterState) {
        characterState.chars.forEach((character) => {
            character.state.tx = 0;
            character.state.ty = 0;
            character.state.rot = 0;
            character.state.skew = 0;
            character.el.style.transform = '';
            if (character.body) {
                character.body.style.transform = '';
            }
            character.trackers.forEach((tracker) => {
                tracker.style.setProperty('--px', '0px');
                tracker.style.setProperty('--py', '0px');
                tracker.classList.remove('blink');
            });
        });
    }

    window.createProfileFiguresController = function createProfileFiguresController(options = {}) {
        const isLoginModalOpen = typeof options.isLoginModalOpen === 'function'
            ? options.isLoginModalOpen
            : () => true;
        const isUserModalOpen = typeof options.isUserModalOpen === 'function'
            ? options.isUserModalOpen
            : () => true;

        const loginCharacter = createCharacterState(options.loginScene || null, options.loginCluster || null);
        const userCharacter = createCharacterState(options.userScene || null, options.userCluster || null);

        function syncScales() {
            syncCharacterSceneScale(loginCharacter);
            syncCharacterSceneScale(userCharacter);
        }

        function clearLoginRaf() {
            if (!loginCharacter.rafId) return;
            window.cancelAnimationFrame(loginCharacter.rafId);
            loginCharacter.rafId = 0;
        }

        function clearUserRaf() {
            if (!userCharacter.rafId) return;
            window.cancelAnimationFrame(userCharacter.rafId);
            userCharacter.rafId = 0;
        }

        function clearLoginBlinkTimer() {
            if (!loginCharacter.blinkTimerId) return;
            window.clearTimeout(loginCharacter.blinkTimerId);
            loginCharacter.blinkTimerId = 0;
        }

        function clearUserBlinkTimer() {
            if (!userCharacter.blinkTimerId) return;
            window.clearTimeout(userCharacter.blinkTimerId);
            userCharacter.blinkTimerId = 0;
        }

        function clearLoginReactionTimer() {
            if (!loginCharacter.reactionTimerId) return;
            window.clearTimeout(loginCharacter.reactionTimerId);
            loginCharacter.reactionTimerId = 0;
        }

        function clearRegisterUsernameTakenReactionTimer() {
            if (!loginCharacter.registerTakenTimerId) return;
            window.clearTimeout(loginCharacter.registerTakenTimerId);
            loginCharacter.registerTakenTimerId = 0;
        }

        function setLoginCharacterConcernedState() {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            const concerned = loginCharacter.isPasswordMode;
            loginCharacter.scene.classList.toggle('concerned', concerned);
        }

        function clearLoginCharacterReactionClasses() {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            loginCharacter.scene.classList.remove('is-error', 'is-success', 'is-shaking');
        }

        function getLoginCharacterPointerTarget() {
            const sceneRect = loginCharacter.scene?.getBoundingClientRect();
            if (!sceneRect || !sceneRect.width || !sceneRect.height) {
                return {
                    x: loginCharacter.pointer.x,
                    y: loginCharacter.pointer.y,
                };
            }

            if (loginCharacter.isPasswordMode) {
                return {
                    x: sceneRect.left + (sceneRect.width * LOGIN_CHARACTER_PASSWORD_LOOK.x),
                    y: sceneRect.top + (sceneRect.height * LOGIN_CHARACTER_PASSWORD_LOOK.y),
                };
            }

            if (loginCharacter.isReactionLocked) {
                return {
                    x: sceneRect.left + (sceneRect.width * 0.5),
                    y: sceneRect.top + (sceneRect.height * 0.42),
                };
            }

            if (loginCharacter.pointer.inside) {
                return {
                    x: loginCharacter.pointer.x,
                    y: loginCharacter.pointer.y,
                };
            }

            return {
                x: sceneRect.left + (sceneRect.width * 0.5),
                y: sceneRect.top + (sceneRect.height * 0.48),
            };
        }

        function updateLoginCharacterBodies(time, pointerTarget) {
            const sceneRect = loginCharacter.scene?.getBoundingClientRect();
            if (!sceneRect || !sceneRect.width || !sceneRect.height) return;
            const motionScale = loginCharacter.motionScale || 1;

            const centerX = sceneRect.left + (sceneRect.width * 0.5);
            const centerY = sceneRect.top + (sceneRect.height * 0.55);

            const normalizedX = clamp((pointerTarget.x - centerX) / (sceneRect.width * 0.5), -1, 1);
            const normalizedY = clamp((pointerTarget.y - centerY) / (sceneRect.height * 0.5), -1, 1);

            loginCharacter.chars.forEach((character, index) => {
                const wobble = Math.sin((time * 0.0018) + (index * 0.9)) * 0.25;

                const targetTx = normalizedX * character.cfg.move * motionScale;
                const targetTy = ((-Math.abs(normalizedY) * character.cfg.lift) + (loginCharacter.isPasswordMode ? 3 : 0)) * motionScale;
                const targetRot = (normalizedX * character.cfg.rotate) + wobble;
                const targetSkew = normalizedX * character.cfg.skew;

                character.state.tx = lerp(character.state.tx, targetTx, 0.14);
                character.state.ty = lerp(character.state.ty, targetTy, 0.14);
                character.state.rot = lerp(character.state.rot, targetRot, 0.14);
                character.state.skew = lerp(character.state.skew, targetSkew, 0.14);

                character.el.style.transform = `translate3d(${character.state.tx}px, ${character.state.ty}px, 0) rotate(${character.state.rot}deg)`;

                if (character.body) {
                    const squash = loginCharacter.isPasswordMode ? 0.965 : 1;
                    character.body.style.transform = `skewX(${character.state.skew}deg) scaleY(${squash})`;
                }
            });
        }

        function renderLoginCharacterFrame(time) {
            loginCharacter.rafId = 0;
            if (!loginCharacter.hasFigure) return;
            if (!isLoginModalOpen()) return;

            const pointerTarget = getLoginCharacterPointerTarget();
            updateLoginCharacterBodies(time, pointerTarget);
            loginCharacter.chars.forEach((character) => updateCharacterTrackers(loginCharacter, character, pointerTarget));

            loginCharacter.rafId = window.requestAnimationFrame(renderLoginCharacterFrame);
        }

        function runLoginCharacterBlinkSequence() {
            loginCharacter.blinkTimerId = 0;
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            if (!isLoginModalOpen()) return;

            const order = ['purple', 'black', 'yellow', 'orange'];
            const nodes = order
                .map((name) => loginCharacter.scene.querySelector(`.character.${name}`))
                .filter((node) => node instanceof Element);

            nodes.forEach((node, index) => {
                window.setTimeout(() => node.classList.add('blink'), index * 45);
            });

            window.setTimeout(() => {
                nodes.forEach((node, index) => {
                    window.setTimeout(() => node.classList.remove('blink'), index * 35);
                });
            }, 120);

            const nextBlinkInMs = 1800 + (Math.random() * 2400);
            loginCharacter.blinkTimerId = window.setTimeout(runLoginCharacterBlinkSequence, nextBlinkInMs);
        }

        function startLoginAnimation() {
            if (!loginCharacter.hasFigure) return;
            if (!isLoginModalOpen()) return;

            if (!loginCharacter.rafId) {
                loginCharacter.rafId = window.requestAnimationFrame(renderLoginCharacterFrame);
            }

            if (!loginCharacter.blinkTimerId) {
                loginCharacter.blinkTimerId = window.setTimeout(runLoginCharacterBlinkSequence, 900);
            }
        }

        function setLoginPasswordMode(isActive) {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            loginCharacter.isPasswordMode = Boolean(isActive);
            loginCharacter.scene.classList.toggle('is-password-mode', loginCharacter.isPasswordMode);
            setLoginCharacterConcernedState();
            startLoginAnimation();
        }

        function finishLoginCharacterReaction() {
            if (!loginCharacter.hasFigure) return;
            clearLoginReactionTimer();
            clearLoginCharacterReactionClasses();
            loginCharacter.isReactionLocked = false;
            setLoginCharacterConcernedState();
            startLoginAnimation();
        }

        function triggerLoginReaction(type) {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;

            clearLoginReactionTimer();
            clearLoginCharacterReactionClasses();
            loginCharacter.isReactionLocked = true;
            setLoginCharacterConcernedState();

            if (type === 'error') {
                loginCharacter.scene.classList.add('is-error', 'is-shaking');
                loginCharacter.reactionTimerId = window.setTimeout(finishLoginCharacterReaction, LOGIN_CHARACTER_ERROR_MS);
                startLoginAnimation();
                return;
            }

            if (type === 'success') {
                loginCharacter.isPasswordMode = false;
                loginCharacter.scene.classList.remove('is-password-mode');
                loginCharacter.scene.classList.add('is-success');
                setLoginCharacterConcernedState();
                loginCharacter.reactionTimerId = window.setTimeout(finishLoginCharacterReaction, LOGIN_CHARACTER_SUCCESS_MS);
                startLoginAnimation();
            }
        }

        function clearRegisterUsernameTakenReaction() {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            clearRegisterUsernameTakenReactionTimer();
            loginCharacter.scene.classList.remove('is-register-username-taken');
        }

        function triggerRegisterUsernameTakenReaction() {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            clearRegisterUsernameTakenReactionTimer();
            loginCharacter.scene.classList.remove('is-register-username-taken');
            loginCharacter.scene.offsetWidth;
            loginCharacter.scene.classList.add('is-register-username-taken');
            loginCharacter.registerTakenTimerId = window.setTimeout(() => {
                loginCharacter.scene?.classList.remove('is-register-username-taken');
                loginCharacter.registerTakenTimerId = 0;
            }, 520);
        }

        function setRegisterUsernameOkState(shouldShow) {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            loginCharacter.scene.classList.toggle('is-register-username-ok', Boolean(shouldShow));
        }

        function resetLoginState() {
            if (!loginCharacter.hasFigure || !loginCharacter.scene) return;
            clearLoginRaf();
            clearLoginReactionTimer();
            clearLoginBlinkTimer();
            clearRegisterUsernameTakenReactionTimer();
            clearLoginCharacterReactionClasses();
            loginCharacter.isPasswordMode = false;
            loginCharacter.isReactionLocked = false;
            loginCharacter.scene.classList.remove('is-password-mode', 'concerned', 'is-register-username-ok', 'is-register-username-taken');
            centerCharacterPointer(loginCharacter);
            resetCharacters(loginCharacter);
        }

        function handleLoginPointerMove(event) {
            if (!loginCharacter.hasFigure) return;
            if (event.pointerType === 'touch') return;
            loginCharacter.pointer.x = event.clientX;
            loginCharacter.pointer.y = event.clientY;
            loginCharacter.pointer.inside = true;
            startLoginAnimation();
        }

        function handleLoginPointerLeave() {
            if (!loginCharacter.hasFigure) return;
            if (loginCharacter.isPasswordMode) return;
            centerCharacterPointer(loginCharacter);
        }

        function getUserCharacterPointerTarget() {
            const sceneRect = userCharacter.scene?.getBoundingClientRect();
            if (!sceneRect || !sceneRect.width || !sceneRect.height) {
                return {
                    x: userCharacter.pointer.x,
                    y: userCharacter.pointer.y,
                };
            }

            if (userCharacter.pointer.inside) {
                return {
                    x: userCharacter.pointer.x,
                    y: userCharacter.pointer.y,
                };
            }

            return {
                x: sceneRect.left + (sceneRect.width * 0.5),
                y: sceneRect.top + (sceneRect.height * 0.48),
            };
        }

        function updateUserCharacterBodies(time, pointerTarget) {
            const sceneRect = userCharacter.scene?.getBoundingClientRect();
            if (!sceneRect || !sceneRect.width || !sceneRect.height) return;
            const motionScale = userCharacter.motionScale || 1;

            const centerX = sceneRect.left + (sceneRect.width * 0.5);
            const centerY = sceneRect.top + (sceneRect.height * 0.55);

            const normalizedX = clamp((pointerTarget.x - centerX) / (sceneRect.width * 0.5), -1, 1);
            const normalizedY = clamp((pointerTarget.y - centerY) / (sceneRect.height * 0.5), -1, 1);

            userCharacter.chars.forEach((character, index) => {
                const wobble = Math.sin((time * 0.0018) + (index * 0.9)) * 0.25;

                const targetTx = normalizedX * character.cfg.move * motionScale;
                const targetTy = -Math.abs(normalizedY) * character.cfg.lift * motionScale;
                const targetRot = (normalizedX * character.cfg.rotate) + wobble;
                const targetSkew = normalizedX * character.cfg.skew;

                character.state.tx = lerp(character.state.tx, targetTx, 0.14);
                character.state.ty = lerp(character.state.ty, targetTy, 0.14);
                character.state.rot = lerp(character.state.rot, targetRot, 0.14);
                character.state.skew = lerp(character.state.skew, targetSkew, 0.14);

                character.el.style.transform = `translate3d(${character.state.tx}px, ${character.state.ty}px, 0) rotate(${character.state.rot}deg)`;

                if (character.body) {
                    character.body.style.transform = `skewX(${character.state.skew}deg)`;
                }
            });
        }

        function renderUserCharacterFrame(time) {
            userCharacter.rafId = 0;
            if (!userCharacter.hasFigure) return;
            if (!isUserModalOpen()) return;

            const pointerTarget = getUserCharacterPointerTarget();
            updateUserCharacterBodies(time, pointerTarget);
            userCharacter.chars.forEach((character) => updateCharacterTrackers(userCharacter, character, pointerTarget));

            userCharacter.rafId = window.requestAnimationFrame(renderUserCharacterFrame);
        }

        function runUserCharacterBlinkSequence() {
            userCharacter.blinkTimerId = 0;
            if (!userCharacter.hasFigure || !userCharacter.scene) return;
            if (!isUserModalOpen()) return;

            const order = ['purple', 'black', 'yellow', 'orange'];
            const nodes = order
                .map((name) => userCharacter.scene.querySelector(`.character.${name}`))
                .filter((node) => node instanceof Element);

            nodes.forEach((node, index) => {
                window.setTimeout(() => node.classList.add('blink'), index * 45);
            });

            window.setTimeout(() => {
                nodes.forEach((node, index) => {
                    window.setTimeout(() => node.classList.remove('blink'), index * 35);
                });
            }, 120);

            const nextBlinkInMs = 1800 + (Math.random() * 2400);
            userCharacter.blinkTimerId = window.setTimeout(runUserCharacterBlinkSequence, nextBlinkInMs);
        }

        function startUserAnimation() {
            if (!userCharacter.hasFigure) return;
            if (!isUserModalOpen()) return;

            if (!userCharacter.rafId) {
                userCharacter.rafId = window.requestAnimationFrame(renderUserCharacterFrame);
            }

            if (!userCharacter.blinkTimerId) {
                userCharacter.blinkTimerId = window.setTimeout(runUserCharacterBlinkSequence, 900);
            }
        }

        function resetUserState() {
            if (!userCharacter.hasFigure || !userCharacter.scene) return;
            clearUserRaf();
            clearUserBlinkTimer();
            centerCharacterPointer(userCharacter);
            resetCharacters(userCharacter);
        }

        function handleUserPointerMove(event) {
            if (!userCharacter.hasFigure) return;
            if (event.pointerType === 'touch') return;
            userCharacter.pointer.x = event.clientX;
            userCharacter.pointer.y = event.clientY;
            userCharacter.pointer.inside = true;
            startUserAnimation();
        }

        function handleUserPointerLeave() {
            if (!userCharacter.hasFigure) return;
            centerCharacterPointer(userCharacter);
        }

        const resizeObserver = typeof window.ResizeObserver === 'function'
            ? new window.ResizeObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.target === loginCharacter.scene) {
                        syncCharacterSceneScale(loginCharacter);
                        return;
                    }

                    if (entry.target === userCharacter.scene) {
                        syncCharacterSceneScale(userCharacter);
                    }
                });
            })
            : null;

        if (resizeObserver) {
            if (loginCharacter.scene) resizeObserver.observe(loginCharacter.scene);
            if (userCharacter.scene) resizeObserver.observe(userCharacter.scene);
        }

        syncScales();

        return {
            syncScales,
            centerLoginPointer: () => centerCharacterPointer(loginCharacter),
            startLoginAnimation,
            setLoginPasswordMode,
            triggerLoginReaction,
            clearRegisterUsernameTakenReaction,
            triggerRegisterUsernameTakenReaction,
            setRegisterUsernameOkState,
            resetLoginState,
            handleLoginPointerMove,
            handleLoginPointerLeave,
            centerUserPointer: () => centerCharacterPointer(userCharacter),
            startUserAnimation,
            resetUserState,
            handleUserPointerMove,
            handleUserPointerLeave,
            destroy() {
                clearLoginRaf();
                clearUserRaf();
                clearLoginBlinkTimer();
                clearUserBlinkTimer();
                clearLoginReactionTimer();
                clearRegisterUsernameTakenReactionTimer();
                resizeObserver?.disconnect?.();
            },
        };
    };
})();
