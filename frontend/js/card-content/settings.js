import { setText } from './core.js';

export function applyBodyModes(state) {
    document.body.classList.toggle('app-focus', state.settings.focus);
    document.body.classList.toggle('app-compact', state.settings.compact);
}

export function renderSettingsSummary(elements, state) {
    const activeCount = [state.settings.mode24h, state.settings.focus, state.settings.compact].filter(Boolean).length;

    setText(
        elements.settingsSummary,
        `${state.settings.mode24h ? '24H ON' : '24H OFF'} / ${state.settings.focus ? 'Focus ON' : 'Focus OFF'} / ${state.settings.compact ? 'Compact ON' : 'Compact OFF'}`
    );
    setText(elements.settingsZoneText, state.settings.timezone);
    setText(elements.settingsModeCount, `${activeCount} aktiv`);
    setText(elements.settingsHelpVisible, '0 Help Einträge');
}
