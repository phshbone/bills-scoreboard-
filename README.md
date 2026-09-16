# Bill's Scoreboard

## Stage 8 — Home Rail Refinement + Roster Reliability + Schedule Depth

This release preserves the approved **My Teams** board, live scoring, standings repair, Basic/Full Stats, grouped rosters, customization, and phone-first navigation, then tightens three areas exposed by live use.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 8 capability
- **One-line home score rail:** the large metal plaques remain unchanged in size. The prior two-line bottom block is replaced by a much shorter single-line metal rail such as `FINAL · NYY 8 — MIN 1 · Tue, Sep 15` or `LIVE · NYY 4 — MIN 2 · Top 6th`.
- The rail blends into the plaque color family, remains presentation-only, and disappears in Edit mode.
- **Roster reliability:** roster normalization now handles more returned roster shapes, consolidates duplicates, preserves every unique player it recognizes, and expands position aliases across baseball, football, hockey, and basketball.
- The roster view reports how many unique players are being shown and explains that headings reflect the provider's listed primary positions; empty position groups are not fabricated.
- Players without a usable position are retained under `Other / Unassigned` rather than disappearing.
- **Schedule depth:** NFL and Army football now show the entire remaining schedule returned by the provider instead of stopping after eight upcoming games.
- MLB, NHL, and WNBA keep a readable rolling window and expose a working `Show next 12 games` control until all returned upcoming games are visible.
- Team data is treated as stale after two minutes when reopening a team page, so completed/live/upcoming changes do not remain trapped indefinitely in the in-visit cache. Retry still forces an immediate refresh.

### Existing capability preserved
- live-score popup with 30-second refresh while live
- upper-right LIVE plaque pill
- MLB division standings fallback
- Basic Stats and Full Stats
- grouped roster + jersey-number badges
- Record / Last Game / Next Game
- low thumb-zone Back
- team reorder/remove/restore + persistence

### Data architecture
ESPN public JSON remains the primary general sports source. MLB StatsAPI remains limited to the demonstrated MLB standings gap. No paid service, API key, Cloudflare Worker, or new account is required.

### Deferred
- Custom user-selected stat columns
- Sports News and team News
- Full team-page visual themes
- Weather and attendance analysis
- Starter/backup depth labels unless a trustworthy source supplies them
- Deep game-strategy analysis

### Stage contract
- No fake sports data in production.
- No player is intentionally discarded because its position label is unfamiliar; unknown positions remain visible.
- Schedule controls are real and only appear when more returned games exist.
- Stage 8 refinements do not create new competing tap targets on the home plaques.
