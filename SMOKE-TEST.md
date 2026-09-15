# Stage 2 smoke checklist

Validated before commit:

- Seven default team records render.
- Edit mode exposes working reorder, remove, Add team, Reset, and Done controls.
- Phone reorder works with explicit up/down controls; desktop also supports drag-and-drop.
- Removing a team immediately removes it from My Teams but keeps it in the Team Library.
- Add team restores a removed team.
- Team order/selection persistence is written to `localStorage` and survives a fresh app load.
- Reset restores the original seven-team order.
- Empty-board state remains recoverable through Add team.
- `window.__APP_READY__` remains truthful and deterministic.
- Mobile and desktop Chromium interaction smoke passed in the Skills Smoke Test in-memory browser fallback.
- Localhost navigation was environment-blocked by administrator policy, so localhost execution was not treated as a product failure.
- No standings, team pages, stats, news, or API controls were introduced, so Stage 2 still contains no dead future-navigation controls.
