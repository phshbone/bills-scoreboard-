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
- My Teams may carry at-a-glance game information integrated into the existing plaque without shrinking or replacing the plaque artwork.
- Home score information is informational and must not create a second conflicting tap target; the whole plaque continues to open the team page.

## Main navigation
- Planned top-level spatial order is `Sports News ← My Teams → Standings`.
- On phone, horizontal swipe is the primary top-level navigation; do not cover content with a floating global taskbar.
- Only complete top-level screens participate. Sports News is not exposed until it is functional.
- Team/detail pages do not use global swipe navigation.
- Horizontal content always wins over app navigation.
- Top-level swipe should ignore extreme screen-edge starts so browser/system edge gestures are not deliberately competed with.
- Back returns to the exact prior context when practical, including prior feed/scroll position.

## Team page
Opening a team shows last game, next game, current record, Schedule, Roster, Standings, Basic Stats, and Full Stats when usable data is available. Team-specific News remains a later increment.

## Live game rules
The data provider supplies game facts/status; the app determines presentation:
- most recent completed/final event = Last Game
- first future scheduled event = Next Game
- in-progress event = Live Now
- postponed/cancelled events are not treated as normal completed/next games
- My Teams may show a small `LIVE` indicator when a selected team has an in-progress event
- the detailed live-score view should use a scoreboard/game source that actually carries current scores rather than assuming the schedule payload does
- when a game is live, the home score treatment replaces the previous final result with the current live score/state; after the game becomes final, that result becomes the newest completed result.

## Stats
- Basic Stats is the default lightweight view and may show current team leaders when a usable leaders feed is available.
- Basic Stats must remain hidden rather than expose a dead control if current leader data is unavailable.
- Full Stats is a denser player-table view and must also remain hidden until a usable athlete-stat response has been verified.
- Full Stats loads player season data only on demand and should cache successful player responses during the visit.
- Full tables use a sticky column header and sticky player-name column.
- Alternating vertical column shading runs continuously from the header through the data rows.
- Faint row separators and stronger stat-group separators aid tracking.
- Horizontal scrolling is reserved for the stat table while it has focus/interaction.
- A tapped stat header may emphasize that column.
- A duplicated footer header is not part of the initial stats design; the sticky header solves the same problem with less screen loss.
- Custom user-selected columns remain a later enhancement.

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

## Stage 7 lock — Full Stats and home score rails (2026-09-15)
- Keep the existing large metal plaques; integrate at-a-glance game information as a compact lower score rail rather than shrinking the artwork in the first implementation.
- Rail priority is `LIVE` current score/state → most recent completed result/date → next game only when no completed result is available.
- Rails hide during Edit mode to avoid interference with reorder/remove controls.
- Full Stats uses the current roster plus athlete season-stat responses, fetched only when needed and with concurrency limits.
- Full Stats preserves the previously locked sticky-header, sticky-player-column, vertical-shading, horizontal-scroll, and column-emphasis behavior.
- Full Stats is conditional; a team does not receive a Full Stats control unless at least one usable athlete-stat response has been confirmed.
- No paid provider, API key, Cloudflare dependency, or new account is introduced by Stage 7.

## Stage 8 lock — Compact score rail, roster completeness, and schedule depth (2026-09-16)
- The home score rail remains full-width but is a single compact line so the plaque artwork and ripped-metal effect stay visually dominant.
- Final rails include status, score, and date on one line; live rails include status, score, and current game-state detail on one line.
- Roster normalization must preserve every unique recognized player returned by the feed, consolidate duplicates, and never drop a player solely because the position label is unfamiliar.
- Unknown or missing roster positions remain visible as `Other / Unassigned`; empty position headings are not fabricated.
- Roster headings represent provider-listed primary positions, not inferred real-world lineup assignments.
- Football schedules show the full remaining provider-returned season because the schedule is naturally short.
- Longer-season sports use an initial upcoming window with a real incremental `Show next` control until all provider-returned games can be reached.
- In-visit team data becomes stale after a short freshness window; reopening a team after that window refreshes the feeds, while Retry remains the immediate manual refresh.

## Stage 9 lock — Direct score overlay, NFL divisions, and MLB depth chart (2026-09-16)
- Stage 8's visible metal score plate is superseded: keep the single-line score content but render it directly over the existing plaque artwork with text-shadow contrast and no opaque rail background, border, or plate effect.
- Score text remains presentation-only and never becomes a competing tap target.
- NFL standings should request division-level hierarchy and prefer eight AFC/NFC division leaf groups when usable data is returned; failure falls back to the prior standings snapshot.
- Baseball Roster remains a primary-position roster view and must not invent empty 2B/CF/etc. groups simply because a real lineup uses those positions.
- MLB may expose a separate conditional Depth Chart view when a usable depth-chart response exists.
- Depth Chart owns field-position depth and Starter/backup order; those labels must come from provider rank/order rather than inference from roster order.
- A baseball team receives no Depth Chart control when the provider response is missing or unusable.
- The ESPN depth-chart and NFL division-standings additions are demonstrated-gap repairs, not a change to the broader normalized-provider architecture.

## Stage 10 lock — Top-level navigation and global standings (2026-09-16)
- My Teams remains the default/home screen and the center of the product.
- Global Standings derives its league choices from the user's currently active My Teams leagues rather than a hard-coded sports portal menu.
- League standings load through the same normalized `ScoreboardData` chain used by team pages, including the MLB division fallback and NFL division repair.
- All selected My Teams clubs in the active league are highlighted; multiple selected teams in one league may be highlighted simultaneously.
- NCAA global standings may use the selected team's relevant returned group rather than implying that a universal national table is always comparable.
- A Retry control appears only after an actual standings-load failure; no dead or decorative controls are permitted.
- Yankees MLB depth-chart provider-shape cleanup and the possible FINAL→NEXT home-score timing rule are explicitly deferred and do not block Stage 10.

## Stage 10.1 lock — Swipe navigation correction + richer standings (2026-09-16)
- Stage 10's floating bottom navigation bar is superseded and removed; it must not cover standings or team content.
- On phone, My Teams is spatially centered: swipe left opens Standings; swipe right is reserved for Sports News once that complete screen exists.
- From Standings, swipe right returns to My Teams.
- Global swipe is disabled while editing, while team/modal overlays are open, and when a gesture begins inside content that genuinely owns horizontal scrolling.
- Extreme-edge swipe starts are ignored to reduce conflict with system/browser gestures.
- Top-level screens preserve their vertical scroll position when switching.
- Global standings should expose more useful sport-specific information without shrinking text or forcing page-level horizontal scrolling.
- Phone standings use three primary columns (Team / Record / PCT, or PTS for NHL) and place secondary sport-specific fields beneath the team name.
- MLB secondary fields may include GB, last 10, home, away, run differential, and streak; analogous provider-returned fields are used for NFL, NHL, WNBA, and NCAA.
- Missing secondary values stay absent rather than being fabricated.
- Sports News remains unexposed until functional; Stage 10.1 establishes its future swipe direction but no dead destination.
