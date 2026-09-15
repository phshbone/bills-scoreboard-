# Bill's Scoreboard

## Stage 5 — Team Page Usability

This release keeps the approved **My Teams** board, customization, live data, schedule, roster, and standings from Stage 4, then makes the team pages easier to use on a phone.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 5 capability
- Team/detail pages remain full-height.
- Back navigation now lives in a persistent low thumb-zone bar instead of the upper-right header.
- Supporting/muted text is one deliberate size step larger across overview cards, schedules, standings, and rosters.
- Standings use the provider's smaller leaf groups/divisions when available instead of presenting a single long aggregate table. The current team remains highlighted.
- Roster rows now use a small team-themed jersey-number badge. Yankees use a subtle pinstripe badge; the other current teams use their own team-color treatments.
- Jersey number is carried by the badge while position remains readable beside the player name.
- Upcoming game rows no longer repeat the provider's duplicate date/time string when the formatted local date/time already supplies it.
- Contextual Back remains detail → team overview → originating My Teams card.
- Retry, in-visit caching, and Stage 2 team customization remain intact.

### Data architecture
The UI still consumes normalized Scoreboard objects rather than provider-specific response shapes. ESPN public JSON remains the working primary provider until a demonstrated gap justifies another source. No paid service, API key, or Cloudflare Worker is required.

Optional game fields for venue, attendance, capacity, weather, and broadcast remain reserved but are not exposed.

### Deferred
Full team-page visual theming, deeper roster biography, Basic/Full Stats, News, weather, attendance analysis, and global top-level navigation remain later complete increments.

### Stage contract
- No fake sports data in production.
- No dead controls.
- Usability changes do not remove or weaken the working Stage 4 features.
