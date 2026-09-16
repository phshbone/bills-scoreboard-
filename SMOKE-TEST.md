# Stage 7 smoke checklist

Validated before merge by source inspection and deterministic data-shape review:

- `index.html` wires the Stage 7 Full Stats and home score-rail CSS/JS after the existing Stage 6 assets.
- PWA cache is bumped to `scoreboard-v7-full-stats-score-rail` and includes all new Stage 7 assets.
- Home score rails are presentation-only children of the existing team card; they use `pointer-events: none`, so the whole plaque remains the single navigation target.
- Score rails hide during Edit mode so reorder/remove controls remain unobstructed.
- Rail priority is live game → most recent completed game → next game fallback.
- Live rail data reuses the league-batched live-awareness feed; recent/final results come from the existing team schedule source.
- Full Stats probes a small roster sample first and adds the Full Stats control only when a usable athlete-stat category is returned.
- Full Stats player requests are made only after the user opens the view, are cached during the visit, and are concurrency-limited to six requests at a time.
- Full Stats table markup provides sticky header, sticky player-name column, horizontal scrolling, alternating vertical column shading, row separators, and tap-to-emphasize columns.
- Basic Stats remains independent and continues to work if Full Stats is unavailable.
- Existing live-score popup, LIVE pill, schedules, standings fallback, grouped roster, low Back control, Retry, and team customization remain wired.

Provider endpoint patterns used by Stage 7 were cross-checked against current public ESPN endpoint documentation for team rosters and athlete season statistics.

Environment note: this runtime cannot perform the normal browser-backed/deployed-provider smoke because outbound browser/provider access is blocked. Final visual/provider verification remains the deployed GitHub Pages check on the user's phone. No production mock sports data was added.
