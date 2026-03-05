import {
    DEFAULT_CITY,
    DEFAULT_TIMEZONE,
} from './config.js';
import { getDateInTimezone, sanitizeTimezone, setText } from './core.js';

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_GEOCODING_ENDPOINT = 'https://api-bdc.io/data/reverse-geocode-client';
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FETCH_THROTTLE_MS = 90 * 1000;
const NIGHT_START_HOUR = 20;
const NIGHT_END_HOUR = 6;
const MIN_PRECIP_MM_FOR_RAIN_SCENE = 0.08;
const MIN_SNOW_CM_FOR_SNOW_SCENE = 0.03;
const GEOLOCATION_TIMEOUT_MS = 7000;
const GEOLOCATION_MAX_AGE_MS = 15 * 60 * 1000;

const WMO_CONDITION_LABELS = {
    0: 'sunny',
    1: 'mostly sunny',
    2: 'partly cloudy',
    3: 'cloudy',
    45: 'foggy',
    48: 'rime fog',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'heavy drizzle',
    56: 'freezing drizzle',
    57: 'heavy freezing drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    66: 'freezing rain',
    67: 'heavy freezing rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    77: 'snow grains',
    80: 'light rain showers',
    81: 'rain showers',
    82: 'heavy rain showers',
    85: 'light snow showers',
    86: 'snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm with hail',
    99: 'severe thunderstorm with hail',
};

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const FOG_CODES = new Set([45, 48]);

function normalizeCity(cityInput) {
    const value = String(cityInput || '').trim();
    return value || DEFAULT_CITY;
}

function pushCandidate(list, value) {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    if (!list.includes(normalized)) {
        list.push(normalized);
    }
}

function buildGeocodeCandidates(cityInput) {
    const city = normalizeCity(cityInput);
    const candidates = [];

    pushCandidate(candidates, city);
    pushCandidate(candidates, city.replace(/\b\d{4,6}\b/g, ' ').replace(/\s+/g, ' ').trim());
    pushCandidate(candidates, city.replace(/^(\d{4,6})\s+(.+)$/, '$2').trim());
    pushCandidate(candidates, city.replace(/^(.+?)\s+\d{4,6}$/, '$1').trim());

    return candidates;
}

function toCityShort(cityInput) {
    const city = normalizeCity(cityInput);
    const stripped = city.replace(/\b\d{4,6}\b/g, ' ').replace(/\s+/g, ' ').trim();

    if (!stripped) return 'KS';
    if (stripped.toLowerCase() === 'kassel') return 'KS';

    const parts = stripped.split(/[\s-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return parts
            .map((part) => part.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 3);
    }

    return stripped.slice(0, 3).toUpperCase();
}

function getSystemTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    } catch {
        return DEFAULT_TIMEZONE;
    }
}

function extractCityFromReverseGeocode(payload) {
    const candidates = [
        payload?.city,
        payload?.locality,
        payload?.principalSubdivision,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
        const city = String(candidates[index] || '').trim();
        if (city) return city;
    }

    return DEFAULT_CITY;
}

function toUnit(tempCelsius, unit) {
    const value = Number(tempCelsius);
    const safeValue = Number.isFinite(value) ? value : 0;
    if (unit === 'f') return Math.round((safeValue * 9) / 5 + 32);
    return Math.round(safeValue);
}

function withUnit(value, unit) {
    return `${value}${unit === 'f' ? '°F' : '°C'}`;
}

function isNightByTimezone(timezone) {
    const nowInZone = getDateInTimezone(timezone);
    return nowInZone.hours >= NIGHT_START_HOUR || nowInZone.hours < NIGHT_END_HOUR;
}

function toConditionLabel(wmoCode) {
    return WMO_CONDITION_LABELS[wmoCode] || 'changeable';
}

function resolveScene(weatherData) {
    const wmoCode = Number(weatherData.wmoCode ?? 3);
    const isDay = Boolean(weatherData.isDay);
    const precipitation = Number(weatherData.precipitation ?? 0);
    const rain = Number(weatherData.rain ?? 0);
    const snowfall = Number(weatherData.snowfall ?? 0);

    if (isDay) {
        if (snowfall >= MIN_SNOW_CM_FOR_SNOW_SCENE || SNOW_CODES.has(wmoCode)) return 'snow-day';
        if (rain >= MIN_PRECIP_MM_FOR_RAIN_SCENE || precipitation >= MIN_PRECIP_MM_FOR_RAIN_SCENE || RAIN_CODES.has(wmoCode)) return 'rain-day';
        if (FOG_CODES.has(wmoCode)) return 'fog-day';
        if (wmoCode === 2) return 'partly-cloudy-day';
        if (wmoCode === 1) return 'clear-day';
        if (wmoCode === 3) return 'cloudy-day';
        if (wmoCode === 0) return 'clear-day';
        return 'cloudy-day';
    }

    if (snowfall >= MIN_SNOW_CM_FOR_SNOW_SCENE || SNOW_CODES.has(wmoCode)) return 'night-snow';
    if (rain >= MIN_PRECIP_MM_FOR_RAIN_SCENE || precipitation >= MIN_PRECIP_MM_FOR_RAIN_SCENE || RAIN_CODES.has(wmoCode)) return 'night-rain';
    if (FOG_CODES.has(wmoCode)) return 'fog-night';
    if (wmoCode === 0 || wmoCode === 1) return 'night-clear';
    return 'night-cloudy';
}

async function fetchJson(url) {
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

function getSystemCoordinates() {
    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = Number(position?.coords?.latitude);
                const longitude = Number(position?.coords?.longitude);
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    reject(new Error('Invalid geolocation coordinates'));
                    return;
                }
                resolve({ latitude, longitude });
            },
            (error) => reject(error),
            {
                enableHighAccuracy: false,
                timeout: GEOLOCATION_TIMEOUT_MS,
                maximumAge: GEOLOCATION_MAX_AGE_MS,
            }
        );
    });
}

async function resolveCityByCoordinates(latitude, longitude) {
    const url = new URL(REVERSE_GEOCODING_ENDPOINT);
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('localityLanguage', 'en');

    const payload = await fetchJson(url);
    return normalizeCity(extractCityFromReverseGeocode(payload));
}

export function createWeatherRenderer(elements) {
    let lastCityKey = '';
    let lastFetchAt = 0;
    let lastWeather = null;
    let requestCounter = 0;
    let systemLocationPromise = null;
    const geocodeCache = new Map();

    function renderWeatherValues(weather, state, unit) {
        const wind = Math.round(Number(weather.wind ?? 0));
        const humidity = Math.round(Number(weather.humidity ?? 0));
        const precipitation = Number(weather.precipitation ?? 0);
        const snowfall = Number(weather.snowfall ?? 0);
        const selectedCity = normalizeCity(state.weather.city);
        const cityShort = toCityShort(selectedCity);
        const precipitationText = snowfall > MIN_SNOW_CM_FOR_SNOW_SCENE
            ? `Snow ${snowfall.toFixed(1)} cm`
            : `Precipitation ${precipitation.toFixed(1)} mm`;

        setText(elements.weatherCity, selectedCity);
        setText(elements.weatherTemp, withUnit(toUnit(weather.tempC, unit), unit));
        setText(elements.weatherMeta, `${weather.condition} / Wind ${wind} km/h / ${cityShort}`);
        setText(elements.weatherHumidity, `Humidity ${humidity}%`);
        setText(elements.weatherRain, precipitationText);

        state.weather.timezone = weather.timezone;
    }

    async function resolveGeocode(city) {
        const cityKey = city.toLowerCase();
        if (geocodeCache.has(cityKey)) return geocodeCache.get(cityKey);

        const candidates = buildGeocodeCandidates(city);
        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const url = new URL(GEOCODING_ENDPOINT);
            url.searchParams.set('name', candidate);
            url.searchParams.set('count', '1');
            url.searchParams.set('language', 'en');
            url.searchParams.set('format', 'json');

            const data = await fetchJson(url);
            const result = Array.isArray(data?.results) ? data.results[0] : null;
            if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
                continue;
            }

            const geocode = {
                name: result.name || candidate,
                latitude: result.latitude,
                longitude: result.longitude,
                timezone: result.timezone || DEFAULT_TIMEZONE,
            };

            geocodeCache.set(cityKey, geocode);
            return geocode;
        }

        throw new Error('Location not found');
    }

    async function fetchLiveWeather(cityInput, preferredTimezone, forceFetch = false) {
        const city = normalizeCity(cityInput);
        const cityKey = city.toLowerCase();
        const now = Date.now();

        if (!forceFetch && lastWeather && lastCityKey === cityKey && (now - lastFetchAt) < FETCH_THROTTLE_MS) {
            return lastWeather;
        }

        const geocode = await resolveGeocode(city);
        const timezone = sanitizeTimezone(geocode.timezone || preferredTimezone, DEFAULT_TIMEZONE);

        const url = new URL(FORECAST_ENDPOINT);
        url.searchParams.set('latitude', String(geocode.latitude));
        url.searchParams.set('longitude', String(geocode.longitude));
        url.searchParams.set(
            'current',
            'temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,weather_code,wind_speed_10m,is_day'
        );
        url.searchParams.set('timezone', timezone);

        const data = await fetchJson(url);
        const current = data?.current;
        if (!current) {
            throw new Error('No weather data');
        }

        const wmoCode = Number(current.weather_code ?? 3);
        const apiIsDay = Number(current.is_day);
        const isDay = Number.isFinite(apiIsDay) ? apiIsDay === 1 : !isNightByTimezone(timezone);

        const weather = {
            label: geocode.name,
            timezone,
            tempC: Number(current.temperature_2m ?? 0),
            wind: Number(current.wind_speed_10m ?? 0),
            humidity: Number(current.relative_humidity_2m ?? 0),
            precipitation: Number(current.precipitation ?? 0),
            rain: Number(current.rain ?? 0),
            snowfall: Number(current.snowfall ?? 0),
            wmoCode,
            condition: toConditionLabel(wmoCode),
            scene: resolveScene({
                wmoCode,
                isDay,
                precipitation: Number(current.precipitation ?? 0),
                rain: Number(current.rain ?? 0),
                snowfall: Number(current.snowfall ?? 0),
            }),
        };

        lastCityKey = cityKey;
        lastFetchAt = now;
        lastWeather = weather;
        return weather;
    }

    function renderWeatherUnavailable(state) {
        const unit = state.weather.unit === 'f' ? 'f' : 'c';
        const city = normalizeCity(state.weather.city);
        const cityShort = toCityShort(city);

        setText(elements.weatherCity, city);
        setText(elements.weatherTemp, unit === 'f' ? '--°F' : '--°C');
        setText(elements.weatherMeta, `weather data unavailable / ${cityShort}`);
        setText(elements.weatherHumidity, 'Humidity --%');
        setText(elements.weatherRain, 'Precipitation --.- mm');
    }

    async function renderWeatherCollapsed(state, { forceFetch = false } = {}) {
        const requestId = ++requestCounter;
        const unit = state.weather.unit === 'f' ? 'f' : 'c';
        const preferredTimezone = sanitizeTimezone(state.weather.timezone, DEFAULT_TIMEZONE);

        try {
            const weather = await fetchLiveWeather(state.weather.city, preferredTimezone, forceFetch);
            if (requestId !== requestCounter) return;
            renderWeatherValues(weather, state, unit);
        } catch {
            if (requestId !== requestCounter) return;
            if (lastWeather && lastCityKey === normalizeCity(state.weather.city).toLowerCase()) {
                renderWeatherValues(lastWeather, state, unit);
                return;
            }
            renderWeatherUnavailable(state);
        }
    }

    async function detectSystemLocation(state) {
        if (systemLocationPromise) return systemLocationPromise;

        systemLocationPromise = (async () => {
            try {
                const { latitude, longitude } = await getSystemCoordinates();
                const city = await resolveCityByCoordinates(latitude, longitude);
                const timezone = sanitizeTimezone(getSystemTimezone(), DEFAULT_TIMEZONE);

                state.weather.city = city;
                state.weather.timezone = timezone;

                if (state.clock) {
                    state.clock.city = city;
                    state.clock.timezone = timezone;
                }

                return true;
            } catch {
                return false;
            }
        })();

        return systemLocationPromise;
    }

    function refreshSkyScene(state) {
        return renderWeatherCollapsed(state);
    }

    return {
        detectSystemLocation,
        renderWeatherCollapsed,
        refreshSkyScene,
    };
}
