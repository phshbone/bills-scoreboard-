# Bill's Scoreboard

## Stage 10 — Top-Level Navigation + Global Standings

This release preserves the approved **My Teams** board and all Stage 9 team-page/live-data capability, then establishes the first real top-level application section outside My Teams: **Standings**.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 10 capability
- A persistent low, thumb-reachable top-level navigation control now switches between **Standings** and **My Teams**.
- My Teams remains the default/home screen.
- Only complete sections are exposed. **Sports News is not shown as a dead tab**; it will be added when that section is implemented.
- Standings builds its league choices from the user's currently selected My Teams leagues, so hidden/removed leagues do not leave dead controls behind.
- Selecting a league loads its normalized standings through the same Scoreboard data layer already used by team pages.
- NFL uses the Stage 9 division-level hierarchy and can display AFC/NFC East, North, South, and West.
- MLB continues to use the demonstrated MLB StatsAPI division fallback.
- NHL/WNBA use the existing normalized standings hierarchy when returned.
- NCAA football uses the selected team's relevant standings group rather than pretending a national table is always meaningful.
- All selected My Teams clubs in the active league are highlighted in the global standings view, including multiple teams in one league such as Giants/Jets or Yankees/Mets.
- Standings tables own their horizontal overflow; the app itself does not gain horizontal page scrolling.
- A real Retry control appears only after a standings load failure.
- Edit mode hides the global navigation so reorder/remove controls remain unambiguous.

### Existing capability preserved
- direct score text over plaque artwork
- live-score popup with 30-second refresh while live
- upper-right LIVE plaque pill
- full remaining football schedule and paged long-season schedules
- team standings, Schedule, Roster, Basic Stats, and Full Stats
- NFL division repair and MLB standings fallback
- grouped roster + jersey-number badges
- low thumb-zone team-page Back
- team reorder/remove/restore + persistence
- two-minute in-visit team-data freshness rule plus manual Retry

### Known cleanup intentionally deferred
- Yankees MLB depth-chart live response still needs a provider-shape adapter repair before the conditional Depth Chart control can be considered reliable.
- Home plaque score timing may later move from previous FINAL to NEXT approximately six hours before the next game; that timing rule is not changed in Stage 10.

### Data architecture
Global Standings does not introduce a new sports-data provider. It reuses the normalized `ScoreboardData` chain, including the MLB and NFL demonstrated-gap repairs already in place. No paid service, API key, Cloudflare Worker, or new account is required.

### Next major section
- **Sports News** and later team-specific News remain the next major content family.

### Stage contract
- Every exposed top-level navigation destination is functional.
- My Teams remains the center/home of the product.
- Global standings are derived from the user's active leagues rather than a hard-coded portal menu.
- Selected teams are highlighted without changing the underlying league data.
- Horizontal standings tables never take over app-level navigation or force page-wide horizontal scrolling.
- Existing team pages and customization remain independent of the global standings screen.
