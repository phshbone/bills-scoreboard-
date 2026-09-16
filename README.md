# Bill's Scoreboard

## Stage 9 — Repair Pass: Direct Score Overlay + NFL Divisions + MLB Depth Chart

This release preserves the approved **My Teams** board, live scoring, Basic/Full Stats, schedules, grouped rosters, customization, and phone-first navigation, then repairs three issues isolated by the Stage 8 diagnostic smoke pass.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 9 capability
- **Direct score overlay:** the separate bottom metal plate is removed visually. The existing one-line score text now sits directly on the plaque artwork with text-shadow contrast, so the ripped-metal artwork remains dominant.
- The score overlay remains presentation-only, keeps the full plaque as the one tap target, and still disappears in Edit mode.
- **NFL division standings repair:** NFL team loads make a division-level standings request and replace the fallback conference-wide table only when usable division groups are returned. The existing standings renderer then shows AFC/NFC divisions separately and keeps the selected team highlighted.
- **MLB depth chart:** baseball team pages can add a conditional Depth Chart card after a usable provider depth-chart response is confirmed.
- The baseball Roster remains truthful to the provider's primary roster-position labels; the new Depth Chart is the separate field-position view for positions such as 2B/CF and for provider starter/backup ranking.
- The depth-chart helper tries both commonly observed ESPN depth-chart path variants and can resolve the provider's numeric team id when the abbreviation path is insufficient.
- If depth-chart data is unavailable or unusable, no dead Depth Chart control is shown.

### Existing capability preserved
- live-score popup with 30-second refresh while live
- upper-right LIVE plaque pill
- MLB division standings fallback through MLB StatsAPI
- Basic Stats and Full Stats
- grouped roster + jersey-number badges
- full remaining football schedule and paged long-season schedules
- Record / Last Game / Next Game
- low thumb-zone Back
- team reorder/remove/restore + persistence
- two-minute in-visit team-data freshness rule plus manual Retry

### Data architecture
ESPN public JSON remains the primary general sports source. MLB StatsAPI remains limited to the demonstrated MLB standings gap. Stage 9 adds only demonstrated data-shape repairs: an ESPN division-level NFL standings request and an ESPN MLB depth-chart feed. No paid service, API key, Cloudflare Worker, or new account is required.

### Deferred
- Custom user-selected stat columns
- Sports News and team News
- Full team-page visual themes
- Weather and attendance analysis
- Non-baseball depth-chart UI unless a demonstrated need justifies it
- Deep game-strategy analysis

### Stage contract
- No fake sports data in production.
- Roster primary-position labels are not rewritten into guessed field positions.
- Starter/backup labels come only from a depth-chart source that actually supplies ranking/order.
- NFL division grouping falls back to the existing standings data if the division-level request fails.
- Stage 9 repairs do not create a competing tap target on the home plaques.
