import { NOTE_PREVIEW_MAX_CHARS, NOTE_STATUS_ACTIVE, NOTE_STATUS_IDLE } from './config.js';
import { setText } from './core.js';

function getLatestNoteText(notes) {
    for (let index = notes.length - 1; index >= 0; index -= 1) {
        const text = notes[index]?.text?.trim();
        if (text) return text;
    }
    return '';
}

export function renderNoteSummary(elements, state) {
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
