(function initCardContent() {
    const DEFAULT_TIMEZONE = 'Europe/Berlin';
    const NOTE_PREVIEW_MAX_CHARS = 80;
    const NOTE_STATUS_IDLE = 'Status: inaktiv';
    const NOTE_STATUS_ACTIVE = 'Status: aktiv';

    const elements = {
        // Calendar
        calendarCurrentDay: document.getElementById('calendarCurrentDay'),
        calendarCurrentMeta: document.getElementById('calendarCurrentMeta'),

        // Events
        eventsVisibleCounter: document.getElementById('eventsVisibleCounter'),
        eventsCriticalCount: document.getElementById('eventsCriticalCount'),
        eventsNextTitle: document.getElementById('eventsNextTitle'),
        eventsNextTime: document.getElementById('eventsNextTime'),

        // Weather
        weatherCity: document.getElementById('weatherCity'),
        weatherTemp: document.getElementById('weatherTemp'),
        weatherMeta: document.getElementById('weatherMeta'),
        weatherHumidity: document.getElementById('weatherHumidity'),
        weatherRain: document.getElementById('weatherRain'),

        // Notes
        notePreview: document.getElementById('notePreview'),
        noteUpdated: document.getElementById('noteUpdated'),
        noteCount: document.getElementById('noteCount'),
        postitCount: document.getElementById('postitCount'),

        // Clock
        analogClockFace: document.getElementById('analogClockFace'),
        clockHourHand: document.getElementById('clockHourHand'),
        clockMinuteHand: document.getElementById('clockMinuteHand'),
        clockSecondHand: document.getElementById('clockSecondHand'),
        clockTopLine: document.getElementById('clockTopLine'),
        clockBottomLine: document.getElementById('clockBottomLine'),

        // Settings
        settingsSummary: document.getElementById('settingsSummary'),
        settingsZoneText: document.getElementById('settingsZoneText'),
        settingsModeCount: document.getElementById('settingsModeCount'),
        settingsHelpVisible: document.getElementById('settingsHelpVisible'),
    };

    if (!elements.calendarCurrentDay || !elements.clockHourHand || !elements.settingsSummary) {
        return;
    }

    const STORAGE_KEYS = {
        settings: 'mensura-settings-v2',
        weather: 'mensura-weather-v2',
        clock: 'mensura-clock-v2',
        postits: 'mensura-postits-v2',
    };

    const state = {
        settings: {
            mode24h: true,
            focus: false,
            compact: false,
            timezone: DEFAULT_TIMEZONE,
        },
        weather: {
            city: 'Berlin',
            timezone: DEFAULT_TIMEZONE,
            unit: 'c',
        },
        clock: {
            city: 'Berlin',
            timezone: DEFAULT_TIMEZONE,
        },
        postits: [],
    };

    const events = [
        { title: 'Team Sync', time: '09:30', priority: 'critical' },
        { title: 'Code Review', time: '11:00', priority: 'normal' },
        { title: 'Client Call', time: '13:30', priority: 'critical' },
        { title: 'Design Handoff', time: '15:00', priority: 'normal' },
        { title: 'Sprint Planning', time: '16:30', priority: 'critical' },
        { title: 'Follow-Up Mails', time: '18:00', priority: 'low' },
        { title: 'Backlog Cleanup', time: '19:15', priority: 'low' },
        { title: 'Release Notes', time: '20:00', priority: 'normal' },
    ];

    const weatherProfiles = {
        berlin: { label: 'Berlin', tempC: 7, wind: 14, humidity: 62, rain: 18, condition: 'bewölkt' },
        hamburg: { label: 'Hamburg', tempC: 6, wind: 18, humidity: 68, rain: 32, condition: 'windig' },
        munich: { label: 'Munich', tempC: 4, wind: 10, humidity: 54, rain: 8, condition: 'klar' },
        london: { label: 'London', tempC: 9, wind: 20, humidity: 76, rain: 44, condition: 'niesel' },
        tokyo: { label: 'Tokyo', tempC: 12, wind: 11, humidity: 58, rain: 14, condition: 'trocken' },
        newyork: { label: 'New York', tempC: 3, wind: 17, humidity: 61, rain: 22, condition: 'kalt' },
    };

    let clockAnimationFrameId = null;
    let analogClockFaceSize = 0;

    function setText(element, value) {
        if (!element) return;
        element.textContent = value;
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

    function isValidTimezone(value) {
        if (!value || typeof value !== 'string') return false;
        try {
            new Intl.DateTimeFormat('de-DE', { timeZone: value }).format(new Date());
            return true;
        } catch {
            return false;
        }
    }

    function sanitizeTimezone(value, fallback = DEFAULT_TIMEZONE) {
        return isValidTimezone(value) ? value : fallback;
    }

    function formatDateParts(date, timeZone) {
        const text = new Intl.DateTimeFormat('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            weekday: 'short',
            timeZone,
        }).format(date);
        return text.replace(',', ' ·');
    }

    function getTimePartsInTimezone(date, timeZone) {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date);
        const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return {
            hours: Number(map.hour),
            minutes: Number(map.minute),
            seconds: Number(map.second),
        };
    }

    function getDateInTimezone(timeZone) {
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(now);
        const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return {
            year: Number(map.year),
            month: Number(map.month),
            day: Number(map.day),
            hours: Number(map.hour),
            minutes: Number(map.minute),
        };
    }

    function toZoneShort(value) {
        if (!value) return 'LOCAL';
        const last = value.split('/').pop() || value;
        return last.replace(/_/g, ' ').slice(0, 3).toUpperCase();
    }

    function parseMinutes(text) {
        const [hour, minute] = text.split(':').map((part) => Number(part));
        return (hour * 60) + minute;
    }

    const eventsWithMinutes = events
        .map((event) => ({ ...event, minutes: parseMinutes(event.time) }))
        .sort((a, b) => a.minutes - b.minutes);
    const criticalEventCount = eventsWithMinutes.filter((event) => event.priority === 'critical').length;

    function formatMinutesToLabel(totalMinutes, use24h) {
        const hour24 = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        if (use24h) {
            return `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        const hour12 = hour24 % 12 || 12;
        const meridiem = hour24 >= 12 ? 'PM' : 'AM';
        return `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
    }

    function renderCalendarCollapsed() {
        const timezone = sanitizeTimezone(state.settings.timezone);
        const tzDate = getDateInTimezone(timezone);
        const local = new Date(Date.UTC(tzDate.year, tzDate.month - 1, tzDate.day, 12, 0, 0));
        const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
        const month = local.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

        setText(elements.calendarCurrentDay, String(tzDate.day).padStart(2, '0'));
        setText(elements.calendarCurrentMeta, `${weekday} · ${month} ${tzDate.year}`);
    }

    function renderEventsCollapsed() {
        const timezone = sanitizeTimezone(state.settings.timezone);
        const nowInZone = getDateInTimezone(timezone);
        const nowMinutes = (nowInZone.hours * 60) + nowInZone.minutes;

        const nextToday = eventsWithMinutes.find((event) => event.minutes >= nowMinutes);
        const nextEvent = nextToday || eventsWithMinutes[0];
        const label = nextToday ? 'Heute' : 'Morgen';

        setText(elements.eventsVisibleCounter, `${eventsWithMinutes.length} Events sichtbar`);
        setText(elements.eventsCriticalCount, `${criticalEventCount} Critical`);
        setText(elements.eventsNextTitle, nextEvent ? nextEvent.title : '-');
        setText(
            elements.eventsNextTime,
            `${label} · ${nextEvent ? formatMinutesToLabel(nextEvent.minutes, state.settings.mode24h) : '--:--'}`
        );
    }

    function hashString(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function resolveWeatherProfile(cityInput) {
        const normalized = (cityInput || '').toLowerCase().replace(/\s+/g, '');
        if (weatherProfiles[normalized]) return weatherProfiles[normalized];

        const hash = hashString(normalized || 'default');
        const base = 3 + (hash % 14);
        return {
            label: cityInput || 'Custom',
            tempC: base,
            wind: 8 + (hash % 20),
            humidity: 40 + (hash % 45),
            rain: 5 + (hash % 55),
            condition: 'variabel',
        };
    }

    function toUnit(tempCelsius, unit) {
        if (unit === 'f') return Math.round((tempCelsius * 9) / 5 + 32);
        return tempCelsius;
    }

    function withUnit(value, unit) {
        return `${value}${unit === 'f' ? '°F' : '°C'}`;
    }

    function renderWeatherCollapsed() {
        const unit = state.weather.unit === 'f' ? 'f' : 'c';
        const timezone = sanitizeTimezone(state.weather.timezone, DEFAULT_TIMEZONE);
        const profile = resolveWeatherProfile(state.weather.city);
        const nowTemp = toUnit(profile.tempC, unit);

        setText(elements.weatherCity, profile.label);
        setText(elements.weatherTemp, withUnit(nowTemp, unit));
        setText(elements.weatherMeta, `${profile.condition} / Wind ${profile.wind} km/h / ${toZoneShort(timezone)}`);
        setText(elements.weatherHumidity, `Feuchte ${profile.humidity}%`);
        setText(elements.weatherRain, `Regen ${profile.rain}%`);
    }

    function getLatestNoteText(notes) {
        for (let index = notes.length - 1; index >= 0; index -= 1) {
            const text = notes[index]?.text?.trim();
            if (text) return text;
        }
        return '';
    }

    function renderNoteSummary() {
        const notes = state.postits;
        const noteCount = notes.length;
        const latestText = getLatestNoteText(notes);

        setText(elements.postitCount, `${noteCount} Post-its`);
        setText(elements.noteCount, `${latestText.length} Zeichen`);

        if (!latestText) {
            setText(elements.notePreview, 'Noch keine Notiz gespeichert.');
            setText(elements.noteUpdated, NOTE_STATUS_IDLE);
            return;
        }

        const preview = latestText.length > NOTE_PREVIEW_MAX_CHARS
            ? `${latestText.slice(0, NOTE_PREVIEW_MAX_CHARS)}...`
            : latestText;
        const timestamp = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        setText(elements.notePreview, preview);
        setText(elements.noteUpdated, `${NOTE_STATUS_ACTIVE} · ${timestamp}`);
    }

    function applyBodyModes() {
        document.body.classList.toggle('app-focus', state.settings.focus);
        document.body.classList.toggle('app-compact', state.settings.compact);
    }

    function renderSettingsSummary() {
        const activeCount = [state.settings.mode24h, state.settings.focus, state.settings.compact].filter(Boolean).length;
        setText(
            elements.settingsSummary,
            `${state.settings.mode24h ? '24H ON' : '24H OFF'} / ${state.settings.focus ? 'Focus ON' : 'Focus OFF'} / ${state.settings.compact ? 'Compact ON' : 'Compact OFF'}`
        );
        setText(elements.settingsZoneText, state.settings.timezone);
        setText(elements.settingsModeCount, `${activeCount} aktiv`);
        setText(elements.settingsHelpVisible, '0 Help Einträge');
    }

    function resizeAnalogClockFace() {
        const collapsed = document.querySelector('.container5 .clock-collapsed');
        if (!collapsed || !elements.analogClockFace) return;

        const collapsedRect = collapsed.getBoundingClientRect();
        const availableWidth = Math.max(120, collapsedRect.width - 8);
        const availableHeight = Math.max(120, collapsedRect.height - 12);
        const size = Math.floor(Math.min(availableWidth, availableHeight));

        if (!size || size === analogClockFaceSize) return;
        analogClockFaceSize = size;
        elements.analogClockFace.style.width = `${size}px`;
        elements.analogClockFace.style.height = `${size}px`;
    }

    function updateClock(showMeta = true) {
        const now = new Date();
        const timezone = sanitizeTimezone(state.clock.timezone, state.settings.timezone);
        const parts = getTimePartsInTimezone(now, timezone);
        const milliseconds = now.getMilliseconds();

        const secondProgress = parts.seconds + (milliseconds / 1000);
        const minuteProgress = parts.minutes + (secondProgress / 60);
        const hourProgress = (parts.hours % 12) + (minuteProgress / 60);

        elements.clockHourHand.style.transform = `translate(-50%, 0) rotate(${hourProgress * 30}deg)`;
        elements.clockMinuteHand.style.transform = `translate(-50%, 0) rotate(${minuteProgress * 6}deg)`;
        elements.clockSecondHand.style.transform = `translate(-50%, 0) rotate(${secondProgress * 6}deg)`;

        if (!showMeta) return;

        setText(elements.clockTopLine, `${state.clock.city} / ${timezone}`);
        setText(elements.clockBottomLine, formatDateParts(now, timezone));
    }

    function startClockAnimationLoop() {
        if (clockAnimationFrameId) {
            window.cancelAnimationFrame(clockAnimationFrameId);
        }
        const renderFrame = () => {
            updateClock(false);
            clockAnimationFrameId = window.requestAnimationFrame(renderFrame);
        };
        renderFrame();
    }

    function restoreState() {
        const savedSettings = readStorage(STORAGE_KEYS.settings, null);
        if (savedSettings) {
            state.settings.mode24h = Boolean(savedSettings.mode24h);
            state.settings.focus = Boolean(savedSettings.focus);
            state.settings.compact = Boolean(savedSettings.compact);
            state.settings.timezone = sanitizeTimezone(savedSettings.timezone, state.settings.timezone);
        }

        const savedWeather = readStorage(STORAGE_KEYS.weather, null);
        if (savedWeather) {
            state.weather.city = String(savedWeather.city || state.weather.city).trim() || state.weather.city;
            state.weather.timezone = sanitizeTimezone(savedWeather.timezone, state.weather.timezone);
            state.weather.unit = savedWeather.unit === 'f' ? 'f' : 'c';
        }

        const savedClock = readStorage(STORAGE_KEYS.clock, null);
        if (savedClock) {
            state.clock.city = String(savedClock.city || state.clock.city).trim() || state.clock.city;
            state.clock.timezone = sanitizeTimezone(savedClock.timezone, state.settings.timezone);
        } else {
            state.clock.timezone = state.settings.timezone;
        }

        const savedPostits = readStorage(STORAGE_KEYS.postits, []);
        state.postits = Array.isArray(savedPostits)
            ? savedPostits.filter((entry) => entry && typeof entry.text === 'string')
            : [];
    }

    restoreState();
    applyBodyModes();
    renderCalendarCollapsed();
    renderEventsCollapsed();
    renderWeatherCollapsed();
    renderNoteSummary();
    renderSettingsSummary();
    resizeAnalogClockFace();
    updateClock(true);
    startClockAnimationLoop();

    window.addEventListener('resize', resizeAnalogClockFace);

    setInterval(() => {
        renderCalendarCollapsed();
        renderEventsCollapsed();
        updateClock(true);
    }, 1000);
})();
