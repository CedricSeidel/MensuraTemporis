export function createPreferencesService(options) {
    const {
        appStorageKeys,
        defaultPreferences,
        state,
        elements,
        isValidTimezone,
        readBoolean,
        readStorage,
        writeStorage,
    } = options;

    function sanitizeTimezoneInput(value, fallback = defaultPreferences.timezone) {
        return isValidTimezone(value) ? value : fallback;
    }

    function sanitizeTemperatureUnit(value) {
        return value === 'f' ? 'f' : 'c';
    }

    function readUserPreferences() {
        const savedSettings = readStorage(appStorageKeys.settings, {});
        const savedWeather = readStorage(appStorageKeys.weather, {});
        const savedClock = readStorage(appStorageKeys.clock, {});
        const profilePreferences = state.profile?.data && typeof state.profile.data === 'object'
            ? state.profile.data.preferences
            : null;
        const profilePrefs = profilePreferences && typeof profilePreferences === 'object'
            ? profilePreferences
            : {};

        const timezone = sanitizeTimezoneInput(
            savedSettings.timezone || savedWeather.timezone || savedClock.timezone || profilePrefs.timezone,
            defaultPreferences.timezone
        );
        const weatherCity = String(
            savedWeather.city || savedClock.city || profilePrefs.weatherCity || defaultPreferences.weatherCity
        ).trim()
            || defaultPreferences.weatherCity;

        return {
            timezone,
            weatherCity,
            temperatureUnit: sanitizeTemperatureUnit(savedWeather.unit || profilePrefs.temperatureUnit),
            mode24h: readBoolean(savedSettings.mode24h, readBoolean(profilePrefs.mode24h, defaultPreferences.mode24h)),
        };
    }

    function writeUserPreferences(preferences) {
        const savedSettings = readStorage(appStorageKeys.settings, {});
        const settingsWithoutModeToggles = savedSettings && typeof savedSettings === 'object'
            ? Object.fromEntries(
                Object.entries(savedSettings).filter(([key]) => key !== 'focus' && key !== 'compact')
            )
            : {};
        const savedWeather = readStorage(appStorageKeys.weather, {});
        const savedClock = readStorage(appStorageKeys.clock, {});

        writeStorage(appStorageKeys.settings, {
            ...settingsWithoutModeToggles,
            mode24h: Boolean(preferences.mode24h),
            focus: true,
            compact: true,
            timezone: preferences.timezone,
        });

        writeStorage(appStorageKeys.weather, {
            ...savedWeather,
            city: preferences.weatherCity,
            timezone: preferences.timezone,
            unit: sanitizeTemperatureUnit(preferences.temperatureUnit),
        });

        writeStorage(appStorageKeys.clock, {
            ...savedClock,
            city: preferences.weatherCity,
            timezone: preferences.timezone,
        });
    }

    function readPreferencesFromForm() {
        const timezone = sanitizeTimezoneInput(
            String(elements.userTimezoneInput?.value || '').trim(),
            defaultPreferences.timezone
        );
        const weatherCity = String(elements.userWeatherCityInput?.value || '').trim()
            || defaultPreferences.weatherCity;
        const temperatureUnit = sanitizeTemperatureUnit(elements.userTemperatureUnitSelect?.value);
        const mode24h = (elements.userTimeFormatSelect?.value || '24h') !== '12h';

        return {
            timezone,
            weatherCity,
            temperatureUnit,
            mode24h,
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
    }

    function dispatchPreferencesUpdated(preferences) {
        window.dispatchEvent(new CustomEvent('mensura:preferences-updated', {
            detail: {
                settings: {
                    mode24h: Boolean(preferences.mode24h),
                    focus: true,
                    compact: true,
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

    return {
        sanitizeTimezoneInput,
        sanitizeTemperatureUnit,
        readUserPreferences,
        writeUserPreferences,
        readPreferencesFromForm,
        populatePreferenceForm,
        dispatchPreferencesUpdated,
    };
}
