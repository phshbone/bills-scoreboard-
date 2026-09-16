# Scoreboard product lock

Locked after the Stage 1 review on 2026-09-15.

## Build law
Every stage must finish as a complete, deployable application. No dead navigation, placeholder controls, or dependency on a later stage for the current stage to work.

## Team board and customization
- `My Teams` is the user's selected board; the team library is separate.
- Team order is user-controlled and persists locally.
- Edit mode owns reordering/removal so normal scrolling is never confused with editing.
- Phone must have reliable non-drag reorder controls; desktop may additionally support drag-and-drop.
- Removed teams remain in the library and can be restored.
- Future teams can be added to the library without redesigning the board.

## Main navigation
- Planned top level: `Standings | My Teams | Sports News`.
- Visible controls are primary navigation.
- Horizontal swipe is only an optional shortcut on those top-level screens.
- Team/detail pages do not use global swipe navigation.
- Horizontal content always wins over app navigation.
- Back returns to the exact prior context when practical, including prior feed/scroll position.

## Team page
Opening a team shows last game, next game, current record, Schedule, Roster, Standings, and Basic Stats when usable data is available. Full Stats and team-specific News remain later increments.

## Live game rules
The data provider supplies game facts/status; the app determines presentation:
- most recent completed/final event = Last Game
- first future scheduled event = Next Game
- in-progress event = Live Now
- postponed/cancelled events are not treated as normal completed/next games
- My Teams may show a small `LIVE` indicator when a selected team has an in-progress event
- the detailed live-score view should use a scoreboard/game source that actually carries current scores rather than assuming the schedule payload does

## Stats
- Basic Stats is the default lightweight view and may show current team leaders when a usable leaders feed is available.
- Basic Stats must remain hidden rather than expose a dead control if current leader data is unavailable.
- Full Stats is a denser expansion/view; Custom columns may be added later.
- Full tables use a sticky column header and sticky player-name column.
- Alternating vertical column shading runs continuously from the header through the data rows.
- Faint row separators and stronger stat-group separators aid tracking.
- Horizontal scrolling is reserved for the stat table while it has focus/interaction.
- A tapped stat header may optionally emphasize that column.
- A duplicated footer header is not part of the initial stats design; the sticky header solves the same problem with less screen loss.

## News
- Sports News is the broad/global feed.
- Team-specific News belongs inside each team page.
- A general-feed story associated with one of My Teams may open inside that team's context with the story front and center.
- Closing the story reveals the team page; Back returns to the originating news context.
- Broader multi-team/league stories remain in the global Sports News context.

## Data architecture
- The app should see one normalized data interface, not team-specific APIs.
- Start with a broad sports provider where practical; add other sources only for demonstrated gaps.
- A Cloudflare gateway is optional, not required until key protection, caching, normalization, or multi-provider aggregation makes it worthwhile.

## Deferred late-stage concept
Deep game-strategy analysis combining play-by-play, statistical context, manager comments, and public analyst commentary is explicitly deferred until the core scoreboard is complete.

## Stage 3 data-provider proof (2026-09-15)
- Stage 3 uses ESPN public site JSON as a **proof provider**, not as a permanent vendor lock.
- The endpoints are keyless and share one pattern across NFL, MLB, NHL, WNBA, and college football.
- Because the ESPN endpoints are public but unofficial/unsupported, all provider details stay behind the Scoreboard data mapping layer.
- The team endpoint may supply record and `standingSummary`; the schedule endpoint supplies events; the roster endpoint supplies players.
- Scoreboard owns the semantic rule for Last Game / Next Game / Live Now rather than trusting provider-specific labels.
- A failure in one feed must not make the whole team proof view fail.
- TheSportsDB free V1 is not the primary proof provider because its team next/previous calls are home-event limited and its free standings/table coverage does not satisfy the current U.S. leagues.

## Stage 4 structural lock — Team pages and optional game context (2026-09-15)
- Team pages are full-height views on phone; the Stage 3 partial-height proof sheet is retired.
- Back navigation is contextual: detail screen → team overview → My Teams, preserving originating team context.
- Record / division position is the standings entry point. It is actionable only when standings data is actually available.
- Schedule and Roster controls are shown only when their underlying data is usable.
- Normal operation does not display provider/debug wording. Feed errors may surface only when they affect usable data.
- The UI consumes normalized Scoreboard objects. Provider-specific response shapes stay inside the adapter layer.
- ESPN public JSON remains the primary working provider until a concrete missing-data or reliability problem justifies a fallback. Do not add providers preemptively.
- The normalized game object reserves optional `venue`, `attendance`, `capacity`, `weather`, and `broadcast` context fields. Empty fields are valid and must not create dead UI.
- Weather, attendance trends, venue-capacity analysis, and similar pattern features are deferred and can be added later without changing the core game model.

## Stage 5 usability lock — Team page ergonomics (2026-09-15)
- Team-page Back belongs in a persistent low thumb-zone control area, not the upper-right header.
- Supporting/muted text on team pages should be at least one deliberate size step larger than the Stage 4 baseline; primary white values can remain visually dominant.
- Standings should prefer separate provider-supplied leaf groups/divisions over a single large aggregate table when that structure exists.
- The selected team remains visibly highlighted inside standings.
- Roster rows use a compact team-themed jersey-number badge. The badge is presentation only and does not require image assets or a new data provider.
- Jersey number belongs in the badge; position remains as secondary roster text. Deeper biography remains deferred unless a demonstrated need justifies it.
- Full team-page visual theming is still deferred; Stage 5 only establishes lightweight team-theme hooks through roster badges.
- Rosters may group players by returned position. Starter/backup labels must not be inferred without trustworthy depth-chart data.

## Stage 6 lock — Basic Stats, live awareness, and MLB standings repair (2026-09-15)
- Basic Stats is a lightweight current-team-leaders view, not the later Full Stats table. It appears only when a usable leaders response has been verified.
- A selected-team plaque may show a small upper-right `LIVE` pill while that team is actively playing. The pill is informational; the team plaque keeps its normal navigation behavior.
- Home live-state checks should be batched by league where possible rather than issuing one request per selected team.
- The live-score overlay uses the league scoreboard feed for current scores and game-state detail, refreshing periodically only while the live-score view is open.
- MLB division grouping is a demonstrated provider gap. MLB StatsAPI is permitted as an MLB-only standings fallback while ESPN remains the general primary sports source.
- If the MLB fallback fails, the existing ESPN standings path remains usable rather than breaking the team page.
- No paid provider, API key, or Cloudflare dependency is introduced by Stage 6.
