# Mensura Temporis

Frontend-first dashboard with modular card widgets (calendar, events, weather, notes, clock, settings).

## Quick Start

Start a local server from the repository root:

```bash
python3 -m http.server 8000
```

Open: `http://localhost:8000`

## Scalable Project Structure

```
frontend/
  assets/               static images/icons/svg
  css/                  app, widgets, modals, navbar, figures
  js/
    app/                app entrypoints (bootstrap)
    core/               cross-cutting runtime + dom utilities
    card-content/       card rendering, state, feature data
    profile/            profile/auth domain modules
    cardContent.js      card-content entry
    cardExpansion.js    expansion behavior
    hotkeys.js          keyboard navigation
    profile.js          profile domain orchestrator
    profileFigures.js   figure animation factory
backend/
  README.md             backend scaffold placeholder
index.html              app shell
```

## Initialization Flow

`frontend/js/app/bootstrap.js` is the single JS entrypoint and imports modules in this order:

1. card expansion
2. card content
3. profile figures
4. profile/auth orchestration
5. hotkeys

## Architecture Notes

- Keep domain logic in `frontend/js/profile/*` and `frontend/js/card-content/*`.
- Keep reusable helpers in `frontend/js/core/*`.
- Keep entrypoints thin and orchestration-focused.
