import { setText } from './core.js';

export function applyBodyModes(state) {
    state.settings.focus = true;
    state.settings.compact = true;
    document.body.classList.add('app-focus');
    document.body.classList.add('app-compact');
}

export function renderSettingsSummary(elements, state) {
    const activeCount = [state.settings.mode24h, true, true].filter(Boolean).length;

    setText(
        elements.settingsSummary,
        `${state.settings.mode24h ? '24H ON' : '24H OFF'} / Focus ON / Compact ON`
    );
    setText(elements.settingsZoneText, state.settings.timezone);
    setText(elements.settingsModeCount, `${activeCount} active`);
    setText(elements.settingsHelpVisible, '0 help entries');
}
