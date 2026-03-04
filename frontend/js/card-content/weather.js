import {
    DEFAULT_TIMEZONE,
} from './config.js';
import { getDateInTimezone, sanitizeTimezone, setText, toZoneShort } from './core.js';

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FETCH_THROTTLE_MS = 90 * 1000;
const NIGHT_START_HOUR = 20;
const NIGHT_END_HOUR = 6;
const MIN_PRECIP_MM_FOR_RAIN_SCENE = 0.08;
const MIN_SNOW_CM_FOR_SNOW_SCENE = 0.03;

const WMO_CONDITION_LABELS = {
    0: 'sonnig',
    1: 'meist sonnig',
    2: 'leicht bewölkt',
    3: 'bewölkt',
    45: 'nebelig',
    48: 'raureif nebel',
    51: 'leichter niesel',
    53: 'niesel',
    55: 'starker niesel',
    56: 'gefrierender niesel',
    57: 'starker gefrierender niesel',
    61: 'leichter regen',
    63: 'regen',
    65: 'starker regen',
    66: 'gefrierender regen',
    67: 'starker gefrierender regen',
    71: 'leichter schneefall',
    73: 'schneefall',
    75: 'starker schneefall',
    77: 'schneegriesel',
    80: 'leichte regenschauer',
    81: 'regenschauer',
    82: 'starke regenschauer',
    85: 'leichte schneeschauer',
    86: 'schneeschauer',
    95: 'gewitter',
    96: 'gewitter mit hagel',
    99: 'starkes gewitter mit hagel',
};

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const FOG_CODES = new Set([45, 48]);

function normalizeCity(cityInput) {
    const value = String(cityInput || '').trim();
    return value || 'Kassel';
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
    return WMO_CONDITION_LABELS[wmoCode] || 'wechselhaft';
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

export function createWeatherRenderer(elements) {
    let lastCityKey = '';
    let lastFetchAt = 0;
    let lastWeather = null;
    let requestCounter = 0;
    const geocodeCache = new Map();

    function renderWeatherValues(weather, state, unit) {
        const wind = Math.round(Number(weather.wind ?? 0));
        const humidity = Math.round(Number(weather.humidity ?? 0));
        const precipitation = Number(weather.precipitation ?? 0);
        const snowfall = Number(weather.snowfall ?? 0);
        const precipitationText = snowfall > MIN_SNOW_CM_FOR_SNOW_SCENE
            ? `Schnee ${snowfall.toFixed(1)} cm`
            : `Niederschlag ${precipitation.toFixed(1)} mm`;

        setText(elements.weatherCity, weather.label);
        setText(elements.weatherTemp, withUnit(toUnit(weather.tempC, unit), unit));
        setText(elements.weatherMeta, `${weather.condition} / Wind ${wind} km/h / ${toZoneShort(weather.timezone)}`);
        setText(elements.weatherHumidity, `Feuchte ${humidity}%`);
        setText(elements.weatherRain, precipitationText);

        state.weather.timezone = weather.timezone;
    }

    async function resolveGeocode(city) {
        const cityKey = city.toLowerCase();
        if (geocodeCache.has(cityKey)) return geocodeCache.get(cityKey);

        const url = new URL(GEOCODING_ENDPOINT);
        url.searchParams.set('name', city);
        url.searchParams.set('count', '1');
        url.searchParams.set('language', 'de');
        url.searchParams.set('format', 'json');

        const data = await fetchJson(url);
        const result = Array.isArray(data?.results) ? data.results[0] : null;
        if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
            throw new Error('Kein Ort gefunden');
        }

        const geocode = {
            name: result.name || city,
            latitude: result.latitude,
            longitude: result.longitude,
            timezone: result.timezone || DEFAULT_TIMEZONE,
        };

        geocodeCache.set(cityKey, geocode);
        return geocode;
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
            throw new Error('Keine Wetterdaten');
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
        const timezone = sanitizeTimezone(state.weather.timezone, DEFAULT_TIMEZONE);

        setText(elements.weatherCity, city);
        setText(elements.weatherTemp, unit === 'f' ? '--°F' : '--°C');
        setText(elements.weatherMeta, `wetterdaten nicht verfügbar / ${toZoneShort(timezone)}`);
        setText(elements.weatherHumidity, 'Feuchte --%');
        setText(elements.weatherRain, 'Niederschlag --.- mm');
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

    function refreshSkyScene(state) {
        return renderWeatherCollapsed(state);
    }

    return {
        renderWeatherCollapsed,
        refreshSkyScene,
    };
}
