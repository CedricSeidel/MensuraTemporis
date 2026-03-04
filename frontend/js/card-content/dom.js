export function getCardContentElements() {
    return {
        calendarCurrentDay: document.getElementById('calendarCurrentDay'),
        calendarCurrentMeta: document.getElementById('calendarCurrentMeta'),
        eventsVisibleCounter: document.getElementById('eventsVisibleCounter'),
        eventsCriticalCount: document.getElementById('eventsCriticalCount'),
        eventsNextTitle: document.getElementById('eventsNextTitle'),
        eventsNextTime: document.getElementById('eventsNextTime'),
        weatherCity: document.getElementById('weatherCity'),
        weatherTemp: document.getElementById('weatherTemp'),
        weatherMeta: document.getElementById('weatherMeta'),
        weatherHumidity: document.getElementById('weatherHumidity'),
        weatherRain: document.getElementById('weatherRain'),
        notePreview: document.getElementById('notePreview'),
        noteUpdated: document.getElementById('noteUpdated'),
        noteCount: document.getElementById('noteCount'),
        postitCount: document.getElementById('postitCount'),
        analogClockFace: document.getElementById('analogClockFace'),
        clockHourHand: document.getElementById('clockHourHand'),
        clockMinuteHand: document.getElementById('clockMinuteHand'),
        clockSecondHand: document.getElementById('clockSecondHand'),
        clockTopLine: document.getElementById('clockTopLine'),
        clockBottomLine: document.getElementById('clockBottomLine'),
        settingsSummary: document.getElementById('settingsSummary'),
        settingsZoneText: document.getElementById('settingsZoneText'),
        settingsModeCount: document.getElementById('settingsModeCount'),
        settingsHelpVisible: document.getElementById('settingsHelpVisible'),
    };
}

export function hasRequiredElements(elements) {
    const required = [
        elements.calendarCurrentDay,
        elements.clockHourHand,
        elements.clockMinuteHand,
        elements.clockSecondHand,
        elements.analogClockFace,
        elements.settingsSummary,
    ];

    return required.every(Boolean);
}
