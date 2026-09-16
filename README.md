# Bill's Scoreboard

## Stage 7 — Full Stats + Home Score Rails

This release preserves the approved **My Teams** board, live scoring, grouped rosters, standings repair, Basic Stats, team customization, and phone-first navigation, then adds two complete capabilities: at-a-glance home scores and the first dense Full Stats view.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 7 capability
- **Home score rails:** each plaque can show a compact metal score strip across its lower edge. A live game shows `LIVE` plus the current score and game-state detail. Otherwise the rail shows the most recent completed result and date; if no completed result is returned, it can fall back to the next game.
- The original plaque artwork remains the primary visual and the entire card remains one tap target for the team page.
- Score rails hide automatically during Edit mode so reorder/remove controls stay unobstructed.
- **Full Stats:** when a usable athlete-stat response is verified, the team page gains a working Full Stats card.
- Full Stats loads current roster player season data on demand and groups available columns by provider stat category.
- Full Stats tables use a sticky header, sticky player-name column, alternating vertical column shading, horizontal scrolling, row separators, and tap-to-emphasize columns as previously locked.
- Full Stats stays hidden when the provider does not return usable athlete statistics, avoiding a dead destination.
- Basic Stats remains the lighter quick-view option.
- Existing live-score popup, LIVE plaque pill, schedules, standings, grouped rosters, jersey-number badges, Retry, caching, reordering, removal/restoration, and contextual Back remain intact.

### Data architecture
ESPN public JSON remains the primary general sports source. MLB StatsAPI remains limited to the demonstrated MLB standings gap. Full Stats uses the provider's athlete season-stat endpoint only when the user opens that view; roster/player results are cached during the visit and player requests are concurrency-limited.

No paid service, API key, Cloudflare Worker, or new account is required.

### Deferred
- Custom user-selected stat columns
- Sports News and team News
- Full team-page visual themes
- Weather and attendance analysis
- Starter/backup depth labels unless a trustworthy source supplies them
- Deep game-strategy analysis

### Stage contract
- No fake sports data in production.
- No dead controls: Full Stats appears only after a usable athlete-stat response is confirmed.
- Score-rail failures do not affect plaque navigation or the existing team pages.
- Existing Stage 6 features remain functional if any Stage 7 helper fails.
