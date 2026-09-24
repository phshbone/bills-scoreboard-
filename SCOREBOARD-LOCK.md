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


## Stage 11B8K lock — Home score timing repair (2026-09-17)
- Home plaque state priority is `LIVE → NEXT within six hours → latest FINAL`.
- A scheduled game takes over the plaque beginning six hours before its listed start time.
- Before that six-hour window, the latest completed result remains visible.
- When a game becomes live, the current live score/state supersedes both NEXT and FINAL.
- When the game becomes final, that result becomes the newest FINAL and remains until the following game enters its six-hour window.
- If a team has no completed game yet, its earliest future scheduled game may appear as NEXT even when it is more than six hours away so the plaque does not remain blank.


## Stage 11B8L lock — Standings team identity and navigation (2026-09-17)
- Selected My Teams rows in Global Standings are direct navigation targets for their existing team pages.
- The whole selected row is tappable/clickable and keyboard-operable; non-selected league rows remain informational only.
- Opening a team from Standings preserves the active league and standings scroll position. Back returns focus to the originating standings row when it still exists.
- Selected standings rows retain the subtle shared highlight and add restrained team identity: a small provider-supplied team logo when available plus a narrow team-color accent.
- If a standings provider omits a usable logo, a compact abbreviation badge is used instead; missing logo artwork must not break navigation.
- Team-page visual redesign remains deferred to the later cosmetic pass.


## Stage 11B9 lock — Sports News foundation (2026-09-17)
- Sports News is now a complete top-level screen in the spatial order `Sports News ← My Teams → Standings`.
- On phone, swipe right from My Teams opens Sports News; swipe left from Sports News returns to My Teams. Existing My Teams ↔ Standings swipe remains unchanged.
- Desktop navigation exposes News, My Teams, and Standings, with matching left/right keyboard navigation when focus is not inside an interactive control.
- The feed aggregates current ESPN public news from the distinct leagues represented by My Teams rather than hard-coding a separate portal menu.
- Stories are deduplicated and sorted newest first. The first release caps the rendered aggregate to 40 current stories.
- Stories associated with a selected My Teams club are visibly tagged using provider-supplied article categories.
- Each story is a real outbound article link. No placeholder story viewer or dead article control is introduced.
- A partial provider failure leaves successful league stories usable and reports partial freshness; Retry appears only when all requested league news feeds fail.
- The news feed refreshes when its My Teams composition changes or when its in-visit snapshot is older than five minutes.
- Team-context story presentation and team-page-specific News remain later increments; this stage establishes the working broad/global Sports News screen first.


## Stage 11B10 lock — Team-specific News (2026-09-17)
- Every team page exposes a functional News detail view using the same story-card visual language as Sports News.
- Team News is lazy-loaded when opened rather than adding another required feed to the initial team-page data load.
- Team stories are selected from the team's own league news feed using provider-supplied team-category metadata; headline text alone is not treated as proof that a story belongs to the team.
- Team News snapshots are cached in-visit for five minutes and capped at 20 current stories per team.
- Story cards retain image, headline, description, league/team tags, byline/age, premium marker when supplied, and the real outbound article link.
- If no current team-tagged stories are returned, the News view shows a real empty state rather than fabricated content.
- A team-news fetch failure produces a working Retry control inside the News view and does not affect the rest of the team page.
- Back from Team News returns to that team's overview; the next Back continues to preserve the original My Teams or Standings context.


## Stage 11B11 lock — MLB live-state fallback (2026-09-17)
- ESPN remains the primary live-score provider for all leagues.
- A demonstrated MLB gap exists when ESPN's scoreboard feed remains `pre` or otherwise fails to expose a game that is already in progress.
- For MLB only, the app may fall back to the public MLB StatsAPI schedule/linescore feed when ESPN does not return an in-progress game.
- The MLB fallback is used consistently by the live-score overlay, team-page live-state freshness, and My Teams LIVE awareness so those surfaces cannot disagree solely because ESPN's MLB state is stale.
- If ESPN already returns an in-progress game, ESPN remains authoritative and the MLB fallback is not called.
- The MLB fallback is cached briefly in-visit to avoid duplicate current-day schedule requests when multiple selected MLB teams are playing in the same game.
- If the MLB fallback fails, the existing ESPN path remains usable; failure of the fallback must not break non-MLB live scoring.


## Stage 11B12 lock — Team News feed repair (2026-09-17)
- Team-page News must use a team-scoped provider request rather than depending solely on filtering the league-wide top-news slice.
- The canonical ESPN numeric team ID from the already-loaded team payload is passed into the team-news request when available.
- Team News tries the team resource first, then the documented team-filtered league News query, and only then falls back to the league-wide category filter.
- A successful team-scoped response is treated as belonging to the requested team even when individual article category metadata is absent.
- The team-scoped feed retains the existing five-minute in-visit cache, 20-story cap, shared story-card treatment, real empty state, and working Retry behavior.
- Global Sports News remains unchanged and continues to aggregate league-wide feeds.


## Stage 11B13 lock — Team News empty-response fallthrough (2026-09-17)
- Team News prefers the league News endpoint with the provider team filter because that endpoint is the documented team-news path for ESPN Site API feeds.
- A successful HTTP response containing zero usable stories is not treated as a terminal success; Team News continues to the next scoped source.
- The team-resource News endpoint remains a secondary scoped source, followed by the existing league-wide category-filter fallback.
- Only a non-empty scoped story set is cached as a successful team-news result before the final fallback is attempted.
- The existing team-page News UI, five-minute cache, 20-story cap, Retry behavior, and global Sports News feed remain otherwise unchanged.


## Stage 11B14 lock — Standings MLB marks + swipe discovery cue (2026-09-17)
- When the MLB standings fallback lacks provider logo artwork, selected MLB rows use MLB's official `team-cap-on-dark/<teamId>.svg` mark before falling back to a text abbreviation.
- This restores the interlocking NY cap marks for the Yankees and Mets while also giving the same official-logo fallback to other selected MLB clubs.
- If an official remote mark fails to load, the existing compact abbreviation badge remains the safety fallback.
- Phone My Teams shows one restrained, informational spatial cue directly below the section plate: `‹ News · Swipe · Standings ›`.
- The swipe cue is not a control; it does not intercept taps or gestures and does not change the existing swipe thresholds or navigation behavior.
- The cue is hidden on desktop, while editing, and whenever the active top-level screen is News or Standings.


## Stage 11B16 lock — Multi-source Sports News (2026-09-18)
- ESPN remains the primary structured News provider.
- FOX Sports, CBS Sports, and Yahoo Sports are added as optional secondary league-news sources through their public RSS/syndication feeds.
- Browser RSS conversion uses the documented rss2json JSON bridge; failure of that bridge or any individual publisher must not take down ESPN News or other working publishers.
- The current secondary league map covers MLB, NFL, NBA, NHL, college football, and WNBA where each publisher exposes a feed. CBS does not supply a WNBA RSS feed in its published feed list, so that league continues with ESPN plus the secondary feeds that are available.
- Every story card carries a visible publisher badge so FOX attribution requirements and source identity remain clear.
- The global News feed remains capped at 40 current stories across all selected-team leagues.
- Individual team News combines ESPN's team-scoped feed with matching FOX/CBS/Yahoo league stories and remains capped at 20 stories.
- Secondary team matching is limited to the story's league and uses explicit team aliases; unrelated league stories are not promoted into a team page.
- Cross-publisher duplicate control preserves one representative story when headlines are identical or strongly overlapping for the same selected team within a 12-hour window, preferring ESPN, then FOX, CBS, and Yahoo as the retained card while preserving useful image/description metadata.
- Secondary feeds are cached in-visit for five minutes. Publisher failures are isolated with `Promise.allSettled` so available sources continue rendering.
- Global and team News retain real outbound article links, no local article scraping, and no fabricated story content.


## Stage 11B17 lock — News card layout + source balance (2026-09-18)
- News cards without a usable image render as full-width text cards rather than reserving an empty image column.
- If an image URL exists but fails at render time, the broken image is removed and the same full-width text layout takes over.
- Global Sports News applies source balancing only after duplicate suppression.
- When multiple publishers are active, the global feed uses a soft per-source ceiling of 30% of the 40-story target, with a minimum allowance of eight stories per source.
- The global ordering prevents more than two consecutive cards from the same publisher while alternative publishers still have stories available.
- Source balancing may intentionally render fewer than 40 cards rather than refill the page with one disproportionately prolific publisher.
- Individual team News remains relevance-first and is not source-balanced; team pages continue to show the most useful matching stories regardless of publisher distribution.


## Stage 11B18 lock — Team-page visual themes (2026-09-18)
- Team-page information architecture, controls, provider logic, and Back behavior remain unchanged; this stage is visual-only.
- The team-page shell keeps an industrial metal outer frame while the interior is themed per selected team.
- All 12 current library teams receive reusable CSS theme variables for primary, secondary, accent, edge, and background pattern treatment.
- Team identity is intentionally restrained: subtle pinstripes/diagonals/color washes rather than full-photo plaque artwork behind readable data.
- Yankees use a faint pinstripe treatment; Phillies use powder-blue/red cues; Flyers use black/orange; Army uses black/gold; the remaining teams use their established primary/secondary identity colors.
- Overview panels, schedule/roster rows, standings, team News cards, live badges, and the sticky bottom Back bar inherit the active team theme.
- The page remains dark-first for readability. A future pass may add clean logo watermarks after suitable standalone logo assets are available; the existing ripped-metal homepage plaques are not reused as watermarks.
- Team theme styling is isolated in `team-theme-v12.css` so it can be tuned or reverted independently of team-page behavior.


## Stage 11B19 lock — Team-page light canvas reference (2026-09-18)
- Stage 11B19 supersedes the Stage 11B18 dark team-page visual direction while preserving all existing team-page JavaScript, navigation, data providers, live state, News, schedule, roster, standings, and Back behavior.
- The Yankees are the reference implementation before extending the system to the other teams.
- The outer team-page chassis uses the same approved dark-blue industrial steel language as the Scoreboard section/header metal: the same 38×24 diagonal-groove SVG texture and layered steel gradient are reused rather than inventing a new My Teams-style plate.
- The Yankees inner page is one continuous soft off-white field with faint navy vertical pinstripes.
- Overview/detail sections remain logically separate but are visually embedded in the shared light surface using restrained translucent fills, thin navy rules, and minimal shadow instead of heavy dark floating cards.
- Yankees page text flips to dark navy/slate for contrast; team labels and interactive accents use Yankees navy.
- Team News, standings, roster, schedule, status, and live badges inherit the same light Yankees surface treatment.
- The bottom team-page navigation is centered. The Back control sits on a narrow Scoreboard-metal rail and remains the only primary bottom action.
- No watermark is added in the reference pass. Watermarks remain optional and require a clean standalone logo asset.
- Phillies follow-up design is locked to a very pale robin’s-egg/powder-blue continuous field with subtle red/burgundy pinstripes, dark navy/charcoal text, Phillies-red accents, and supporting powder-blue tones.
- Mets follow-up remains a soft off-white/light field with subtle blue pinstripes and restrained orange accents.
- The reference layer is isolated in `team-theme-v13.css` so it can be judged on-device before being generalized to the remaining teams.


## Stage 11B20 lock — Yankees header/card refinement (2026-09-18)
- Visual-only refinement of the Stage 11B19 Yankees reference. Team-page behavior, providers, navigation, data loading, live state, standings, roster, schedule, News, and Back behavior remain unchanged.
- The Yankees top header is no longer part of the pinstripe wallpaper. It is a compact Scoreboard-metal placard using the same approved dark-blue steel texture, bolt treatment, weathering, and layered gradient language as the main Scoreboard header.
- Header content stays minimal: MLB kicker and New York Yankees title only. Standings/place information is not duplicated in the header.
- A visible metal break separates the header placard from the light pinstripe content field below it.
- Light content panels retain the continuous Yankees page treatment but receive a slightly stronger 2px navy rim, subtle inset highlight, and restrained shadow for clearer separation.
- Yankees roster jersey-number badges switch from square/pinstriped badges to dark navy circular medallions with light numbers and a subtle inner rim.
- The broader team-theme palette direction remains softened/dusty rather than highly saturated.
- The refinement is isolated in `team-theme-v14.css` so it can be judged independently before being generalized to other teams.


## Stage 11B21 lock — Yankees header typography refinement (2026-09-18)
- Visual-only typography pass on the Stage 11B20 Yankees metal header.
- No mockup or generated visual asset is used; the implementation is applied directly in the app.
- The metal header structure, frame, content field, cards, circular roster badge, bottom Back rail, and all team-page behavior remain unchanged.
- The Yankees team name switches away from the blocky stencil/Arial Black treatment to a narrower industrial sans stack.
- Header lettering shifts from bright white to aged off-white/light steel.
- Distress is intentionally minimal: sparse tiny wear marks and a muted vertical steel-toned text gradient, preserving readability.
- The lowercase MLB kicker is softened to a muted light-steel tone and uses the same narrower typography direction.
- This refinement is isolated in `team-theme-v15.css`.


## Stage 11B22 lock — Yankees metal source + roster readability (2026-09-18)
- Yankees team header is no longer sticky/floating; it scrolls in normal document flow.
- The header and thin outer rails use the existing `assets/yankees.webp` plaque artwork as the metal/material source instead of another procedural CSS diamond-plate approximation.
- A restrained dark veil is used only for title readability; prior procedural weathering pseudo-layers are retired for the Yankees header.
- Roster position headings (for example Starting Pitchers and Catchers) use dark Yankees navy on the light field.
- Roster position counts use a navy circular badge with light text.
- The Yankees Retry button gets explicit light text for contrast on its dark control background.
- No team-page data, provider, navigation, roster grouping, standings, News, live-state, or Back behavior changes.


## Stage 11B23 lock — Yankees artwork-driven header cleanup (2026-09-18)
- The wide Yankees plaque-art header remains the visual team identity.
- The large overlaid “New York Yankees” text is removed visually because the artwork already identifies the team.
- The semantic team title remains in the DOM for accessibility and dialog labeling.
- The small MLB kicker remains visible as the only UI text in the header.
- Header stays in normal document flow and retains a shallow hero-header footprint.
- No content-card, roster, News, standings, navigation, provider, live-state, or Back behavior changes.
- This pass remains Yankees-only before the same artwork-driven header system is generalized to other teams.


## Stage 11B24 lock — Phillies artwork-driven robin’s-egg reference (2026-09-18)
- Phillies now use the approved artwork-driven team-header system established on Yankees.
- The wide Phillies plaque artwork is the visible team identity; the large semantic team title remains in the DOM but is visually hidden to avoid duplicate wording.
- The small MLB kicker remains visible.
- The interior is a very pale robin’s-egg/powder-blue field with subtle dusty red/burgundy vertical pinstripes.
- Main text is dark navy/charcoal-blue; labels, active accents, roster position headings, badges, and roster-number medallions use softened/dusty Phillies red rather than bright saturated red.
- Content panels use the same light embedded-card treatment with a slightly stronger 2px rim for separation.
- Phillies roster numbers use circular dusty-burgundy medallions with light numbers.
- Roster position headings and counts are explicitly readable on the light field.
- The centered industrial Back rail is retained.
- No team-page data, provider, navigation, roster grouping, standings, News, live-state, or Back behavior changes.


## Stage 11B25 lock — MLB header tune + Mets reference (2026-09-18)
- Yankees and Phillies artwork-driven headers move upward by 4px and shift their plaque crop from 36% to 40% so the embedded team-name artwork reads more centrally in the header band.
- The header artwork may remain asymmetrical; the embedded team name is the alignment priority.
- Mets now use the same approved artwork-driven header system as Yankees and Phillies.
- The large semantic Mets team title remains in the DOM but is visually hidden; the small MLB kicker remains visible.
- Mets interior uses a cool soft off-white field with faint dusty-blue pinstripes, dark navy/charcoal text, dusty orange accents, and circular dusty-blue roster-number medallions.
- Mets content cards use restrained 2px rims, readable dark roster-position headings/counts, light themed News/standings/schedule surfaces, and the centered industrial Back rail.
- No team-page data, provider, navigation, roster grouping, standings, News, live-state, or Back behavior changes.


## Stage 11B26 lock — remaining team-page themes (2026-09-18)
- Giants, Jets, Rangers, Army, Fever, Eagles, Flyers, 76ers, and Knicks now use the approved artwork-driven header/light-canvas team-page system.
- No invented pinstripes or decorative body patterns are added for these teams.
- Team identity comes primarily from the wide plaque artwork header plus restrained team-tinted light canvases and accents.
- Background direction:
  - Giants: pale cool blue-gray.
  - Jets: pale sage/gray-green.
  - Rangers: icy blue-white.
  - Army: warm stone/parchment.
  - Fever: warm cream/pale gold.
  - Eagles: pale blue-green/gray.
  - Flyers: warm off-white with a slight orange cast.
  - 76ers: cool white with a faint powder-blue cast.
  - Knicks: pale cool blue.
- All nine use dark readable text, softened team-color labels/accents, circular roster-number medallions, restrained 2px card rims, readable roster-position headings/counts, and the centered industrial Back rail.
- Team headers use the same slightly raised placement and centered artwork crop established by the MLB pages.
- The semantic team title remains in the DOM but is visually hidden when the artwork already identifies the team; the small league kicker remains visible.
- No team-page data, provider, navigation, roster-grouping, standings, News, live-state, or Back behavior changes.


## Stage 11B27 lock — final inspection polish (2026-09-18)
- Giants and Eagles keep the approved artwork-driven header layout; only the darkest artwork is lifted with a restrained light veil/center glow so the embedded logo/wordmark reads more clearly.
- Jets and the other team headers remain unchanged unless a later real-device review identifies a specific readability problem.
- Global Standings remains a dark Scoreboard screen. The highlight status copy is simplified to `<league> standings · <n> My Team(s) highlighted` and is slightly smaller/less bright so it does not compete with the tables.
- Highlighted standings rows, team-color edge bars, logos/fallbacks, `MY TEAM` badges, row navigation, league tabs, and the dark table design remain unchanged.
- MLB roster loading keeps ESPN as the primary provider and now supplements it with the MLB StatsAPI active roster for Yankees (147), Mets (121), and Phillies (143).
- Supplemental MLB data is merged by normalized player name. Existing ESPN entries are retained; missing active players are added, and generic ESPN `IF/INF/OF` positions may be enriched to the MLB-specific position such as `2B` or `CF`.
- If MLB StatsAPI roster loading fails, the page falls back to the existing ESPN roster without blocking the rest of the team page.
- No fabricated roster entries are introduced.
- Sports News source mix, deduplication, source balancing, team aliases, card layout, navigation, six-hour home-score timing, live-state behavior, and team-page navigation remain unchanged.


## Stage 11B28 lock — Giants/Jets header readability (2026-09-18)
- Giants and Jets keep the approved artwork-driven header layout, crop, dimensions, scrolling behavior, and league kicker.
- Only the two darkest NFL headers receive a stronger brightness/readability lift using a light screen blend plus a modest brightness/saturation adjustment.
- Eagles and all other team headers remain unchanged in this stage.
- The Yankees MLB roster remains provider-truthful. The app continues to use ESPN primary plus MLB StatsAPI active-roster supplementation; it does not switch to a 40-man/depth-chart roster merely to manufacture missing position groups.
- No standings, News, navigation, live-score, roster-grouping, or team-page interaction behavior changes.


## Stage 11B29 lock — team-page isolation repair (2026-09-18)
- Team pages remain fixed full-viewport dialogs and continue to scroll internally.
- While a team page is open, the underlying My Teams app is removed from the paint tree with a dedicated `team-page-open` body state so iOS/Safari cannot expose team cards beneath the dialog.
- The team-page overlay is opaque and isolated; backdrop blur is disabled for this dialog to avoid Safari compositing leakage.
- The team-page shell is explicitly constrained to 100% of the dialog height with internal scrolling.
- `[hidden]` remains authoritative with `display:none !important`.
- Existing team-page header scrolling, sticky bottom Back rail, data rendering, navigation, and return-to-board scroll restoration remain unchanged.


## Stage 11B30 lock — iOS team-page overscroll containment (2026-09-18)
- Stage 11B29 correctly hides the underlying My Teams board, but real-iPhone verification showed the team-page scroller itself could still rubber-band upward at its lower edge.
- While a team page is open, both the root element and body are scroll-locked; the body is fixed to the viewport and the saved My Teams scroll position is restored on close.
- Team-page vertical overscroll behavior is none, not contain, so browser overscroll affordance is not permitted at the team-page edges.
- A touch-edge guard cancels only outward movement at the exact top/bottom of the internal team-page scroller as an iOS fallback. Normal vertical scrolling inside the team page remains native.
- The existing artwork header, light team canvas, sticky Back rail, data rendering, detail navigation, and Back-to-My-Teams restoration behavior remain unchanged.


## Stage 11B31 lock — flush team-page Back rail (2026-09-18)
- Real-iPhone verification confirmed Stage 11B30 anchors the team page and prevents the prior rubber-band exposure.
- The remaining dark strip below the metal Back rail came from the theme layer's deliberate 6px phone / 8px larger-screen sticky bottom offset plus shell bottom padding.
- The team-page shell now has no bottom padding and the sticky Back rail uses bottom: 0, so the rail background reaches the viewport edge.
- Existing Back button safe-area padding remains inside the rail; button placement, team themes, scrolling, and navigation behavior are otherwise unchanged.


## Stage 11B32 lock — live-panel state bridge (2026-09-18)
- The direct league scoreboard remains the authoritative live-state check used by My Teams live awareness.
- A team page must not require its slower team-schedule snapshot to have already created a Live now panel before the direct live feed can be opened.
- When the direct scoreboard reports the current team as live and the team-page snapshot has no Live now panel, the live freshness layer creates the standard Live now panel dynamically.
- The dynamically created panel uses the existing data-panel structure so live-score-v11.js automatically decorates it as the existing tappable live-score feed; no second live UI is introduced.
- Direct refresh updates both the live score line and game-state detail.
- A dynamically promoted live panel is removed if the direct feed no longer reports an in-progress game.
- ESPN remains the primary live source and the existing MLB StatsAPI live fallback remains unchanged.


## Stage 11B33 lock — darker live cue + authoritative footer flush (2026-09-18)
- The team-page live interaction remains the same existing tappable Live now panel and live-score overlay.
- The Tap for live score prompt uses a darker, higher-contrast green on light team cards; the matching trigger border/focus accents are darkened without changing interaction behavior.
- Stage 11B31's footer intent is preserved, but its generic selectors were not strong enough to override older team-specific 6px/8px footer offsets and shell padding.
- A final high-specificity team-page override now forces shell bottom padding and sticky Back-rail offset to zero across every team theme.
- The Back rail's bottom corners are squared so the metal background visually owns the viewport edge; internal safe-area padding and button placement remain unchanged.


## Stage 11B34 lock — authentic alternating footer metal (2026-09-18)
- The Back rail keeps the Stage 11B33 flush viewport geometry, safe-area padding, button placement, and navigation behavior.
- The previous CSS/data-URI tread is retired for the footer because it repeated only one diagonal direction and read as a synthetic approximation beside the team artwork.
- The footer now uses a dedicated reusable steel texture asset with alternating opposing tread rows, raised-lug highlight/shadow treatment, dark blue steel depth, and restrained pits/scratches/grain.
- The texture is visual only. No team-page layout, scrolling, live-score, provider, or navigation logic changes.


## Stage 11B35 lock — integrated footer frame (2026-09-18)
- The Stage 11B34 steel texture is retained, but the Back rail is no longer a sticky slab painted over scrolling team content.
- The team-page header and light content now live together inside a dedicated internal scroller so the header still scrolls away exactly as before.
- The Back rail is a separate structural bottom row outside that scroller, so team cards/content cannot run underneath it.
- The team-page shell and Back-rail area share the same weathered alternating steel texture. The nav itself is transparent over that common shell surface, eliminating the pasted-on rectangle effect.
- Existing Back button dimensions, safe-area padding, team content themes, live-score behavior, and My Teams scroll/focus restoration remain unchanged.
- Stage 11B30 iOS edge-rubber-band protection now targets the dedicated internal scroller.


## Stage 11B36 lock — restore approved team-page header/content structure (2026-09-18)
- Stage 11B35 changed the team-page document structure to solve a footer presentation problem and unintentionally altered the already-approved header/frame behavior.
- index.html, team-page-v8.js, team-page-v8.css, and team-theme-v20.css are restored exactly to the Stage 11B34 source state.
- This restores the approved artwork header, original team-page shell scrolling model, established content framing, and the Stage 11B34 alternating/weathered footer texture.
- Stage 11B32 live-feed state bridge and Stage 11B33 darker live-score cue remain intact because they live outside the reverted Stage 11B35 structural files.
- No attempt is made in this stage to further redesign the footer. Header restoration is isolated first.


## Stage 11B37 lock — real plate anchored footer (2026-09-19)
- The approved Stage 11B36 team-page/header structure is untouched.
- The Back rail now uses Bill's supplied plain diamond-plate artwork directly as its background asset: assets/score-metal-footer.webp.
- The footer remains sticky at bottom: 0 inside the existing team-page scroller, with an explicit high z-index and GPU compositing hint for iOS stability.
- The footer has no bottom radius or bottom border gap and includes safe-area padding inside the plate itself, so no page/background strip should appear beneath it.
- The plate uses cover/no-repeat positioning so the rail reads as one continuous section of the same weathered metal rather than a tiled or synthetic pattern.
- Live-score behavior, header artwork, team themes, navigation, and scroll restoration are unchanged.


## Stage 11B38 lock — rich roster cards + player detail (2026-09-19)
- MLB, NBA/WNBA, and NHL roster detail pages use the approved Prototype C density: team emblem, team-colored jersey medallion, provider headshot when available, player name/position, four core season stats, last appearance/start line, and at most one recent-trend line.
- Cards are fully tappable and open a player detail view inside the existing team detail surface; no second modal layer is introduced.
- Back behavior from a player returns to Roster and restores the prior roster scroll position.
- Roster cards lazy-load one ESPN common-v3 athlete overview request per visible player and cache it for the session; a dedicated gamelog request is used only when the overview lacks enough labeled recent-game data. Full stats/gamelog requests are reserved for a player tap. Missing data degrades without fabricated values.
- Trend text is derived only from returned game logs and only for explicit supported rules (for example triple-doubles, quality starts, hitting/HR streaks, NHL point streaks); otherwise the trend row stays hidden.
- NFL/NCAA football roster cards remain on the existing simpler layout in this stage.
- Global site typography is NOT changed in this stage. The richer roster cards use the existing condensed system font stack as a contained typography test before any site-wide font decision.
- Existing team-page header structure, footer plate, live-score behavior, top-level swipes, standings, schedules, and news are unchanged.


## Stage 11B39 lock — repaired card stats + semantic player detail + football cards (2026-09-19)
- Basketball and hockey rich roster cards no longer stop at an empty overview snapshot. When overview lacks useful values, cards fall back to season-scoped ESPN athlete stats; if the current season is not yet populated, a career fallback is allowed only when explicitly labeled "Career snapshot".
- Player-detail "Current season snapshot" is now sourced from a season-scoped regular-season stats request. Comprehensive provider categories remain available below it for career/expanded/advanced/postseason context.
- Player-detail statistics are reorganized into semantic concept cards rather than a flat wall of unrelated stat tiles. Examples: baseball Record & role / Run prevention / Command & workload / Core batting / Power & production / Plate discipline / Baserunning; basketball Scoring / Playmaking / Rebounding / Defense / Usage / Milestones; hockey Record / Goaltending / Scoring / Shooting; football Passing / Rushing / Receiving / Tackling / Pressure & turnovers / Pass defense / Kicking / Punting.
- Each semantic card uses a three-column scan grid inside one grouped panel. Wins/losses/percentage and other related values remain visually adjacent.
- Common opaque abbreviations can expose a compact stat key beneath their semantic group (for example WHIP = walks + hits allowed per inning pitched, HLD = holds, BLSV = blown saves).
- Rich roster cards now apply to football as well as baseball, basketball, and hockey. Football core-card stats are position-aware and recent-game/trend lines remain feed-driven only.
- Existing header artwork, anchored real-plate footer, team-page scrolling model, top-level swipes, live score behavior, standings, schedules, and news remain untouched.


## Stage 11B40 lock — football stat cleanup (2026-09-19)
- Football player-detail grouping is category-first. Generic abbreviations such as YDS, TD, ATT, AVG, INT and LNG inherit meaning from the provider category (Passing, Rushing, Receiving, etc.) before abbreviation fallbacks are considered.
- Football player-detail groups that contain only zero/dash values are suppressed. Repeated GP/GS/other values are de-duplicated across provider categories.
- Football roster/player snapshot stats use category-scoped lookups so passing yards cannot be mistaken for rushing/receiving yards.
- QBR and passer rating are distinct. QBR is shown only when a real QBR value is returned; otherwise a passer-rating field is labeled RTG.
- Football abbreviation keys prefer local context-aware definitions before provider glossary entries, preventing collisions such as ATT being described as a punt-return field inside Passing.
- Baseball, basketball, hockey, approved headers, anchored diamond-plate footer, team-page scroll model, top-level swipes, live scores, standings, schedules, and news are unchanged.


## Stage 11B41 lock — football detail refinement (2026-09-19)
- Football category binding happens before generic GP/GS/ATT/YDS/TD handling, so GP from Passing/Rushing/Receiving/Defense folds into that player-relevant group instead of creating a one-stat Usage card.
- Provider Scoring data is normalized into one Scoring group. Passing/rushing/receiving touchdown entries that duplicate an already-rendered position group are suppressed through semantic identities; total touchdowns/2PT/PAT/points may remain when they add information.
- Football primary position groups retain meaningful zero values (for example a quarterback with 0 INT). Secondary/off-position groups suppress zero/dash fields and show only real activity (for example an RB with 1 FR shows the recovery without 0 SACK and 0 FF).
- Generic non-line Usage cards are suppressed. Offensive-line players may retain Usage when that is the only meaningful statistical context.
- Football source categories are ordered so Passing/Rushing/Receiving/Defense/Special Teams render before Scoring, enabling deterministic duplicate removal.
- Baseball, basketball, hockey, roster-card layout, approved header, anchored diamond-plate footer, team-page scrolling, top-level swipes, live score, standings, schedules, and news are unchanged.


## Stage 11B42 lock — strict football season snapshots (2026-09-19)
- Football roster/player "Current season" snapshots may use only the season-scoped stats response after career/postseason/impossible-season categories are rejected.
- Football overview responses are never trusted for current-season core stats because ESPN can expose career totals there.
- Football current-season snapshots never fall back silently to career totals. If a trustworthy season block is unavailable, the UI explicitly shows "Season stats unavailable".
- Comprehensive football stat sections remain available below and are labeled Career when their source is the unscoped career stats response.
- A conservative football season sanity gate rejects categories marked Career/Postseason/Playoff and impossible regular-season totals such as >25 GP or obviously career-scale passing/rushing/receiving totals.
- Baseball, basketball, hockey behavior is unchanged.


## Stage 11B43 lock — TV / venue game context (2026-09-19)
- Game broadcast and venue context comes only from the existing provider schedule payload; no stations, streaming services, or venues are guessed.
- Duplicate broadcast names are consolidated before display.
- Team Overview shows provider TV/venue context on Live Now and Next Game when present.
- Schedule rows show provider TV/venue context when present.
- If the provider supplies neither broadcast nor venue, no placeholder line is rendered.
- Existing score/state/date logic is unchanged.


## Stage 11B44 lock — real diamond-plate top navigation rail (2026-09-19)
- The top title/navigation rail keeps the existing DOM, buttons, edit control, desktop navigation, and phone swipe model.
- The former CSS-generated tread/background is removed from header-plate-v11.css.
- The rail now uses the same approved real diamond-plate asset as the footer: assets/score-metal-footer.webp.
- The visual rail is reduced to 44px minimum height on phone and desktop, with 40px controls inside it.
- A restrained inner border/shadow is retained only to preserve the raised-plate edge; no generated tread or weathering overlay remains.
- Existing painted/stencil text treatment is preserved.
- Header artwork above the rail is unchanged.


## Stage 11B45 lock — football game-log season fallback (2026-09-19)
- If ESPN does not provide a usable football current-season summary for a player, the roster card/player snapshot may derive current-season totals from that player's season game log.
- The game-log fallback is role-aware: QB passing totals, RB rushing/receiving totals, WR/TE receiving totals, defensive tackles/sacks/interceptions/forced fumbles, kicker totals, punter totals, and limited OL appearances when actual player stat rows exist.
- This fallback never uses career totals and therefore preserves the Stage 11B42 Geno/career safeguard.
- When used, the snapshot context is "Current season · game log".
- Players with neither a trustworthy season summary nor meaningful current-season game-log activity remain "Stats unavailable".


## Stage 11B46 lock — painted Back rail (2026-09-19)
- The full-width diamond-plate footer remains visual/anchored metal.
- Back-to-My-Teams / Back-to-Team / Back-to-Roster remains a real button for accessibility, but has no visible button chrome.
- The text uses the same stencil/distressed paint treatment as the top navigation.
- Only the centered 68% of the footer is interactive; the outer ~16% on each side is a dead zone to reduce accidental thumb navigation.
- The interactive center remains at least 48px tall and retains keyboard focus treatment.


## Stage 11B47 lock — MLB playoff + Wild Card picture (2026-09-19)
- MLB division standings continue to use MLB StatsAPI regular-season standings.
- A second MLB StatsAPI request uses standingsTypes=wildCardWithLeaders for the playoff race.
- Global MLB standings show a separate Playoff + Wild Card Picture after the division tables.
- Individual MLB team standings show only the relevant AL or NL playoff picture when that team is present.
- Wild Card rank, WC games back, division-leader state, clinched state, clinch indicator, magic/elimination values are taken from provider fields only.
- The third Wild Card row is visually marked as the current cut line when the provider supplies wildCardRank=3.
- No playoff qualification or clinch state is invented from record math.


## Stage 11B48 lock — multileague playoff context (2026-09-19)
- NFL, NBA, WNBA, and NHL load a supplemental ESPN playoff-standings view using conference-level standings first (level=2, sorted by playoff seed) with an overall level=1 fallback.
- The supplemental loader selects broad league/conference groups rather than division-sized groups and caches them per league.
- Generic playoff rows use provider playoffSeed and clincher fields only. No playoff qualification, clinch, elimination, or seed is inferred from record math.
- A clincher badge is shown only when ESPN supplies a real clincher display value or clincher description. The generic stat label "Clincher" by itself never creates a false clinched state.
- Provider clincher descriptions drive the accessible status; eliminated rows show OUT, explicit clinched rows show the provider symbol plus IN, and seed-only rows carry the seed without a false clinch badge.
- Global standings show a separate Playoff Picture after normal standings when supplemental groups exist. Individual team standings show the playoff group containing the selected team when possible.
- Regular standings may also show explicit provider clinch/elimination markers.
- NBA secondary standings context now receives the same GB / HOME / AWAY / L10 / STK treatment already used for WNBA.
- NCAA/Army does not use this generic playoff loader.
- MLB continues to use the Stage 11B47 MLB StatsAPI Wild Card implementation rather than the generic ESPN playoff loader.


## Stage 11B49 lock — playoff scope hardening (2026-09-19)
- NFL, NBA, and NHL prefer provider conference-level playoff standings and explicitly prefer conference groups when ESPN also returns a larger league-wide parent table.
- WNBA prefers the provider's league-wide playoff-seed table first; conference-level data is only a fallback.
- Conference group selection is based on provider group identity/name and de-duplicates identical team sets.
- No change is made to MLB's dedicated StatsAPI Wild Card path or NCAA standings.


## Stage 11B50 lock — CBS-primary NFL player season stats (2026-09-22)
- NFL rich roster cards for the configured Giants, Jets, and Eagles prefer the public CBS Sports team-statistics page for current-season core player statistics.
- One CBS team-statistics snapshot supplies the roster's passing, rushing, receiving, defense, kicking, and punting rows; the app does not fetch a separate CBS page for every visible player card.
- CBS rows are matched to the existing roster by normalized player name; no CBS player IDs are hard-coded into the app.
- CBS requests use ordinary browser fetch with no API key, login, cookie credentials, proxy, or bypass.
- The CBS team-statistics snapshot is cached for two minutes, allowing frequent refresh without refetching the same large page for every player.
- ESPN remains the failure fallback for NFL player statistics and continues to supply the existing expanded/career player-detail categories when available.
- NFL roster identity, jersey numbers, headshots, schedules, live scores, standings, and all non-NFL sports data paths remain unchanged.
- MLB StatsAPI behavior remains unchanged.
- A CBS HTML/CORS/availability or player-row failure must degrade to the existing ESPN path rather than blanking the roster.


## Stage 11B51 lock — reusable live/final mini scoreboard (2026-09-24)
- The existing live-score overlay is now a reusable compact scoreboard rather than a two-line score-only panel.
- Live games retain manual refresh plus the existing 30-second refresh timer; completed games do not continue polling.
- NFL/NCAA football, NBA/WNBA, and NHL show provider period scoring when the underlying event exposes competitor linescores. Regulation periods are labeled compactly, with overtime columns added as needed.
- MLB live/final scoreboards prefer MLB StatsAPI where available and show a compact R/H/E table plus the existing batting-team indicator.
- Football may show a possession line when the provider supplies an explicit possession team; no play-by-play or last-play text is introduced.
- The Team page Last Game card is tappable and opens the same scoreboard component in FINAL mode. FINAL mode is frozen and does not show or run the Refresh control.
- Final-game lookup uses the already-loaded team schedule event when available; MLB also attempts the game's StatsAPI date so final R/H/E can be shown.
- Live-status detail strings are compacted to remove duplicate identical fragments before display.
- This stage does not change sports providers, schedules, standings, rosters, news, team-page layout, or provider-routing priorities.


## Stage 11B52 lock — final-game period-score hydration (2026-09-24)
- Completed non-MLB games now attempt a richer event-summary fetch by the existing schedule event ID before rendering the FINAL mini scoreboard.
- The richer summary is used only when it returns a completed event with explicit period/quarter linescores.
- Football, basketball/WNBA, and hockey retain the existing normalized quarter/period table renderer from Stage 11B51; Stage 11B52 only supplies the missing completed-game linescore data.
- If the event-summary request fails, omits linescores, or changes shape, the app falls back to the already-working final score from the team schedule.
- MLB remains on the MLB StatsAPI final-game path with R/H/E and is not routed through this hydration step.
- No play-by-play, scoring-play feed, box-score expansion, provider migration, standings, roster, or team-page layout change is introduced here.


## Stage 11B53 lock — full CBS NFL player-stat detail (2026-09-24)
- The CBS adapter is our application code, not a CBS-supplied API adapter. Stage 11B53 removes the earlier one-category/four-stat limitation from the expanded NFL player view.
- For configured CBS-primary NFL teams, the adapter now captures every current CBS team-stat category presently exposed on the team stats page: Passing, Rushing, Receiving, Defense, Scoring, Punt Returns, Kickoff Returns, Kicking, and Punting.
- Every factual stat column/value for a matched player is preserved in order and rendered in the expanded player page using Scoreboard's own layout.
- CBS explanatory prose/site presentation is not copied; only stat abbreviations and factual values are rendered.
- The compact roster card still shows up to four useful headline values, preferring the player's primary statistical category and falling back to any CBS category in which the player appears.
- A successful CBS fetch with no player statistical row is treated as "No recorded stats yet" rather than falling through to potentially misleading ESPN career data.
- ESPN remains a network/parser failure fallback only when the CBS team-stat page itself cannot be used.
- No changes are made to NFL roster identity/headshots, schedules, live scores, standings, non-NFL providers, or MLB StatsAPI behavior.


## Stage 11B54 lock — CBS stat-label fidelity (2026-09-24)
- Preserve CBS stat abbreviations exactly as the first header token, including trailing punctuation such as %, +, /, and hyphens.
- This corrects labels including TGT%, FD%, 10+, 25+, 50+, FGM-A, XPM-A, PTS/G, and 2-PT.
- No stat values, category selection, provider routing, roster behavior, or player-detail layout changes are introduced.
