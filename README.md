# Bill's Scoreboard

## Stage 6 — Basic Stats + Live Awareness + Standings Repair

This release preserves the approved **My Teams** board, customization, full-height team pages, schedules, grouped rosters, low thumb-zone Back control, and the Stage 5 live-game interaction, then adds three complete capabilities: Basic Stats, reliable live-score awareness, and an MLB division-standings repair.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 6 capability
- **Basic Stats:** when a usable team-leaders feed is returned, the team overview gets a working Basic Stats card. It opens a lightweight current team-leader view with up to six sport-appropriate categories. If the feed is unusable, no dead control is shown.
- **Live score repair:** the live-score overlay now reads the league scoreboard feed rather than depending on the team schedule response for current scores. It shows both teams, current score, game-state detail, manual Refresh, and automatic 30-second refresh while live.
- **My Teams LIVE awareness:** selected-team plaques receive a small upper-right `LIVE` pill while that team is actively playing. League scoreboards are checked once per league, not once per team, and the board refreshes live state periodically while the app is open.
- **MLB standings repair:** MLB uses the public MLB StatsAPI standings feed as a demonstrated fallback so American/National League divisions can render as separate groups. If that fallback is unavailable, the existing ESPN standings path remains the fallback.
- Existing position-grouped rosters, jersey-number badges, schedule, record, Last Game, Next Game, Retry, caching, reordering, removal/restoration, and contextual Back remain intact.

### Data architecture
The UI continues to consume normalized Scoreboard data rather than provider-specific response shapes. ESPN public JSON remains the primary general sports source. MLB StatsAPI is used only for the demonstrated MLB division-standings gap. No paid service, API key, or Cloudflare Worker is required.

### Deferred
- Full sortable/dense Stats tables
- Sports News and team News
- Full team-page visual themes
- Weather and attendance analysis
- Starter/backup depth labels unless a trustworthy source supplies them
- Deep game-strategy analysis

### Stage contract
- No fake sports data in production.
- No dead controls: Basic Stats appears only after usable data is confirmed.
- A failure in the Basic Stats, live-awareness, or MLB-standings helper does not remove the already-working core team page.
