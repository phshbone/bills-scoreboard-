# Scoreboard smoke-test record

## Cadence rule
- Run a standard smoke test after every **five merged feature/repair iterations**, before beginning the sixth.
- Also run an immediate smoke test whenever a change touches navigation, service-worker/cache behavior, live-game state, provider adapters, or shared app-shell structure.
- A failed smoke test blocks additional feature work until the failure is repaired or explicitly classified as environment-blocked.

## Stage 11B6 repair smoke
Validated with executed syntax checks, a deterministic Playwright fixture, and service-worker policy simulation.

### Executed evidence
- Python Playwright and system Chromium at `/usr/bin/chromium` launched successfully.
- `live-panel-freshness-v11.js` passes `node --check`.
- Updated service-worker fetch logic passes `node --check`.
- Deterministic 390×844 Chromium fixture: **PASS**.
- A stale team-page live state (`Bot 10th`) is immediately replaced by a fresher scoreboard state (`Top 11th`).
- A live panel rendered after the freshness enhancer loads is also detected and refreshed (`Mid 12th`).
- The live-state enhancer avoids redundant DOM mutation loops by changing text only when the game-state detail actually differs.
- Same-origin PWA shell/assets are network-first with `cache: no-store`; successful responses are written into the current release cache.
- Offline behavior falls back to the current cached asset/page.
- Cross-origin sports-provider requests are left outside the service-worker cache policy.
- The wide header asset was regenerated from the approved wide crop and reattached as a valid WebP.

### Validation limitation
This host still does not reliably permit browser outbound navigation to the deployed GitHub Pages app/live sports endpoints. Final deployed-provider, PWA update behavior, and real-iPhone visual verification remain real-device smoke checks.

Overall pre-merge classification: **PASS WITH LIVE VERIFICATION RECOMMENDED**.

---

## Stage 10.1 smoke checklist
Validated before merge with executed syntax checks, a deterministic Playwright fixture, and targeted data-shape tests.

### Executed evidence
- Python Playwright and system Chromium at `/usr/bin/chromium` launched successfully.
- `global-standings-v10.js` passes `node --check`.
- `standings-repair-v6.js` passes `node --check`.
- Deterministic Chromium fixture at 390×844: **PASS**.
- Fixture confirms there is no floating `.primary-nav` taskbar.
- Swipe left from a normal My Teams plaque switches to Standings and changes the page title.
- Standings hides the My Teams Edit/header actions rather than leaving Edit visible on the standings screen.
- Swipe right from a standings row returns to My Teams.
- A gesture started inside the horizontally scrollable league-tab strip does not trigger top-level screen navigation.
- Edit mode blocks top-level swipe.
- Extreme-edge swipe starts are ignored.
- Rich standings secondary text remains visible under the team name while the page itself has no horizontal overflow at 390px.
- Desktop regression at 1280×900 also has no page-level horizontal overflow.
- Targeted MLB normalization fixture confirms returned home, away, last-10, streak, and run-differential values are preserved in the normalized standings row.

### Static/regression review
- My Teams remains the initial screen.
- Sports News is still not exposed as a dead destination; right-swipe from My Teams is reserved for the later complete News screen.
- Team pages/modals continue to block top-level swipe behavior.
- The swipe detector does not call `preventDefault`, so ordinary vertical scrolling remains native.
- The league-tab row retains ownership of its own horizontal gesture.
- Global standings use three primary phone columns, with sport-specific secondary facts under the team name rather than a wide tiny-text table.
- MLB retains the previously proven StatsAPI standings URL; Stage 10.1 only preserves additional fields already present in the returned team-record shape.
- Existing NFL division repair, MLB division fallback, live scoring, schedules, stats, roster grouping, customization, and team-page Back remain wired.

### Known cleanup not treated as Stage 10.1 failure
- Yankees MLB depth-chart live provider-shape repair remains deferred.
- The possible home score `FINAL → NEXT` timing change remains deferred.

### Validation limitation
The browser runtime works for deterministic in-memory fixtures, but this host still does not reliably permit browser outbound navigation to the deployed GitHub Pages app/live sports endpoints. Final deployed-provider and real iPhone gesture feel remain a real-device smoke.

Overall pre-merge classification: **PASS WITH LIVE VERIFICATION RECOMMENDED**.


## Stage 11B8L smoke — Standings team links and identity
Validated before merge with JavaScript compilation checks and deterministic in-memory DOM fixtures.

### Executed evidence
- `global-standings-v10.js`, `team-page-v8.js`, and `sw.js` compile successfully.
- A selected Phillies standings row is rendered with `my-team-standing`, `data-team-id="phillies"`, keyboard focus, button semantics, and an accessible team-page label.
- Provider-supplied logo rendering is used when present; a compact abbreviation fallback remains available when logo data is absent.
- Clicking the selected row opens the existing Phillies team page; Enter keyboard activation does the same.
- A non-selected league row remains informational and receives no team-page click handler.
- Team-page return-context fixture preserves the originating standings scroll position and restores focus to the exact standings row on Back.
- The service-worker cache namespace is bumped so the changed standings/team-page JavaScript and CSS are not paired with an older cached shell.
- Team-color accents are present for all current library teams without changing the underlying standings data or provider mapping.

Overall pre-merge classification: **PASS**.


## Stage 11B9 smoke — Sports News foundation
Validated before merge with live provider checks, JavaScript compilation checks, and deterministic in-memory DOM/navigation fixtures.

### Executed evidence
- ESPN public news endpoints returned current JSON article feeds for MLB, NFL, NHL, WNBA, college football, and NBA.
- `sports-news-v11.js`, `global-standings-v10.js`, `desktop-nav-v11.js`, `swipe-repair-v11.js`, and `sw.js` compile successfully.
- Deterministic News-feed fixture: **PASS**.
- Two league feeds merge into one newest-first list.
- Team-category matching correctly tags Philadelphia Eagles NFL news to Eagles and Philadelphia Phillies MLB news to Phillies despite both providers using the `phi` abbreviation in separate leagues.
- News story cards use real outbound links with safe `noopener noreferrer` behavior and HTTP ESPN links are normalized to HTTPS.
- Partial provider failure leaves successful league stories visible and reports `1 of 2 leagues updated` without exposing Retry.
- Total provider failure replaces the feed with an error state and exposes the working Retry control.
- Deterministic phone navigation fixture: **PASS** for `News ← My Teams → Standings`.
- Swipe right from My Teams opens News; swipe left from News returns to My Teams; My Teams ↔ Standings remains intact.
- The legacy swipe compatibility listener stands down on the News-capable shell, avoiding duplicate navigation.
- Header actions remain visible only on My Teams.
- The service-worker cache namespace is bumped and includes the new News JavaScript and CSS.

### Validation limitation
The local deterministic runtime does not substitute for final real-iPhone gesture feel or deployed GitHub Pages rendering. The live provider shape itself was independently verified against current ESPN public JSON.

Overall pre-merge classification: **PASS WITH LIVE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B10 standard smoke — Team News + five-iteration checkpoint
Validated before merge with live provider inspection, JavaScript compilation checks, deterministic team-news fixtures, and regression wiring checks across the current shell.

### Executed evidence
- Core JavaScript compiles successfully: `app.js`, `team-data-v8.js`, `team-page-v8.js`, `live-awareness-v6.js`, `live-score-v11.js`, `home-score-rail-v8.js`, `global-standings-v10.js`, `sports-news-v11.js`, `desktop-nav-v11.js`, `swipe-repair-v11.js`, and `sw.js`.
- Current ESPN NFL/MLB news JSON still exposes team-category metadata containing stable team IDs/abbreviations, which the Scoreboard team-news filter uses rather than headline text matching.
- Deterministic team-news provider fixture: **PASS**.
- A Phillies feed filters out unrelated Mets stories, caps output at 20 team-tagged stories, normalizes article links to HTTPS, and reuses the five-minute in-visit cache without a second fetch.
- Deterministic team-page fixture: **PASS**.
- The team overview exposes a working News action; opening it renders shared Sports News cards; Back returns to the team overview; the next Back preserves the original standings/My Teams origin scroll and focus.
- Team News includes working empty/error states and a Retry path; the rest of the team page remains usable if the news request fails.
- Regression wiring confirms all 12 current team-library entries remain present.
- Home score timing remains `LIVE → NEXT within six hours → latest FINAL`.
- Live awareness still publishes `scoreboard:live-state` on its 60-second polling cycle.
- Highlighted Global Standings rows remain linked to their team pages and the complete News-capable top-level shell remains enabled.
- Global Sports News still aggregates via `Promise.allSettled` and retains the 40-story cap.
- Service-worker cache namespace is bumped to `scoreboard-v11b10-team-news`; network-first `cache: no-store` shell behavior remains intact.

Overall pre-merge classification: **PASS WITH LIVE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B11 smoke — MLB live-state provider fallback
Validated before merge with a current live-game provider comparison, JavaScript compilation checks, and deterministic live-state fixtures.

### Executed evidence
- During the Phillies–Mets game on 2026-09-17, ESPN's MLB scoreboard payload still reported the matchup as scheduled/pre while independent current game sources reported it in progress. This is treated as a demonstrated provider gap rather than a UI-only failure.
- `live-score-v11.js`, `live-panel-freshness-v11.js`, `live-awareness-v6.js`, and `sw.js` compile successfully.
- Deterministic live-score fixture: **PASS**.
- When ESPN reports `pre` and MLB StatsAPI reports a live Mets–Phillies game, the normalized live result switches to MLB StatsAPI and returns the current score, inning/outs detail, and batting side.
- When ESPN itself reports `in`, ESPN remains primary and the MLB fallback is not called.
- Deterministic My Teams live-awareness fixture: **PASS**.
- With an empty/stale ESPN live payload, the MLB fallback publishes `scoreboard:live-state`, adds the LIVE pill, updates the plaque accessibility label, and supplies the live score object.
- Deterministic team-page freshness fixture: **PASS**.
- The existing Live Now panel updates its stale detail through the same normalized provider-fallback path.
- The MLB daily schedule fallback is cached for 15 seconds in-visit so multiple selected MLB teams do not cause duplicate immediate fallback requests.
- Service-worker cache namespace is bumped to `scoreboard-v11b11-mlb-live-fallback`.

Overall pre-merge classification: **PASS WITH REAL-DEVICE LIVE VERIFICATION RECOMMENDED**.


## Stage 11B12 smoke — Team News feed repair
Validated before merge with provider-path review, JavaScript compilation checks, and deterministic team-news/team-page fixtures.

### Executed evidence
- `sports-news-v11.js`, `team-page-v8.js`, and `sw.js` compile successfully.
- ESPN endpoint documentation confirms dedicated team-news resources and team-filtered News requests are available in the Site API; the previous implementation relied only on filtering the limited league-wide top-news slice.
- Deterministic team-news fixture: **PASS**.
- The team resource path is attempted first with the canonical numeric ESPN team ID.
- If that path fails, the documented `news?team=<id>` path is attempted.
- A successful team-scoped response is rendered even when its articles omit team-category metadata because the request itself is already team-scoped.
- If both team-scoped paths fail, the prior league-wide category-filter path remains as a final fallback.
- Deterministic team-page fixture: **PASS**.
- A Phillies team page with canonical ESPN team ID `22` passes `22` into the team-news loader, opens the News detail view, and renders returned story cards.
- The service-worker cache namespace is bumped to `scoreboard-v11b12-team-news-feed-repair`.

Overall pre-merge classification: **PASS WITH REAL-DEVICE TEAM-NEWS VERIFICATION RECOMMENDED**.


## Stage 11B13 smoke — Team News empty-response fallthrough
Validated before merge with endpoint-order review, JavaScript compilation checks, and deterministic team-news fallthrough fixtures.

### Executed evidence
- `sports-news-v11.js`, `team-page-v8.js`, and `sw.js` compile successfully.
- ESPN team-news references support `news?team=<TEAM_ID>`; New York Giants use ESPN team ID `19`.
- Deterministic Giants team-news fixture: **PASS**.
- If `news?team=19` returns HTTP success with zero stories, the loader now continues to `teams/19/news` instead of incorrectly caching and returning an empty result.
- If `news?team=19` returns stories, that documented team-filtered endpoint wins and no secondary request is made.
- If both team-scoped sources return empty, the existing league-wide category-filter fallback still runs and can return Giants-tagged stories.
- Service-worker cache namespace is bumped to `scoreboard-v11b13-team-news-empty-fallthrough`.

Overall pre-merge classification: **PASS WITH REAL-DEVICE GIANTS NEWS VERIFICATION RECOMMENDED**.


## Stage 11B14 smoke — MLB standings marks + swipe discovery cue
Validated before merge with JavaScript compilation checks, deterministic standings rendering, and top-level visibility-state fixtures.

### Executed evidence
- `global-standings-v10.js` and `sw.js` compile successfully.
- Deterministic MLB standings fixture: **PASS**.
- Yankees normalized MLB team ID `147` resolves to `https://www.mlbstatic.com/team-logos/team-cap-on-dark/147.svg`.
- Mets normalized MLB team ID `121` resolves to `https://www.mlbstatic.com/team-logos/team-cap-on-dark/121.svg`.
- If an official MLB mark fails to load, the row replaces it with the existing abbreviation fallback rather than leaving a broken image.
- The same official MLB cap-mark fallback applies generically to selected MLB rows whose StatsAPI standings entries lack ESPN logo metadata.
- Phone swipe cue markup is present as `‹ News · Swipe · Standings ›`, is pointer-transparent, and is hidden while editing.
- Deterministic top-level fixture: **PASS**. The cue is visible on My Teams and hidden on Sports News and Standings; the existing screen transition API remains unchanged.
- Service-worker cache namespace is bumped to `scoreboard-v11b14-standings-logos-swipe-hint`.

Overall pre-merge classification: **PASS WITH REAL-DEVICE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B15 smoke — Swipe cue visibility repair
- Confirmed the Stage 11B14 markup was present but the phone media rule never overrode the global `display: none`.
- Phone rule now explicitly sets `display: grid`.
- `[hidden]` still overrides the phone rule on News/Standings.
- Edit mode still hides the cue.
- The cue remains pointer-transparent and cannot intercept swipe gestures.
- Service-worker cache namespace is bumped to `scoreboard-v11b15-swipe-hint-visible`.

Overall pre-merge classification: **PASS**.


## Stage 11B15 checkpoint — five-iteration standard smoke
Run on current `main` before beginning Stage 11B16.

### Executed evidence
- Core JavaScript compiles successfully: `app.js`, `team-data-v8.js`, `team-page-v8.js`, `live-score-v11.js`, `live-awareness-v6.js`, `home-score-rail-v8.js`, `global-standings-v10.js`, `sports-news-v11.js`, `desktop-nav-v11.js`, `swipe-repair-v11.js`, and `sw.js`.
- All 12 current team-library entries remain present.
- Home plaque score timing remains on the six-hour NEXT window.
- MLB live fallback remains wired through `fetchCurrentGame`.
- Global News retains the 40-story cap and team News remains exposed from the team page.
- Global Standings retains the News-capable top-level navigation shell.
- Service-worker cache namespace is current at `scoreboard-v11b15-swipe-hint-visible`.

Overall checkpoint classification: **PASS**.


## Stage 11B16 smoke — Multi-source Sports News
Validated before merge with official feed discovery, JavaScript compilation, deterministic source-adapter fixtures, deterministic global/team News fixtures, and duplicate-control checks.

### Executed evidence
- FOX Sports currently publishes official RSS feeds for MLB, NFL, college football, NBA, NHL, and WNBA.
- CBS Sports currently publishes official RSS feeds for MLB, NFL, college football, NBA, and NHL.
- Yahoo Sports currently exposes a Sports syndication/feed directory for MLB, NFL, NBA, NHL, college football and related sports coverage.
- rss2json documents browser-side JavaScript/AJAX conversion of RSS to JSON without requiring an API key for the base request.
- `news-sources-v12.js`, `sports-news-v11.js`, and `sw.js` compile successfully.
- Deterministic secondary-source adapter fixture: **PASS**. FOX and Yahoo stories survive while a simulated CBS failure is isolated; HTTPS normalization and HTML-to-text description cleanup pass.
- Deterministic global News fixture: **PASS**. ESPN, FOX, CBS, and Yahoo cards render together with publisher badges, selected-team tags, and a four-source status summary.
- Deterministic team News fixture: **PASS**. Giants News combines ESPN + matching FOX/CBS stories and excludes an unrelated Yahoo Jets story from the same NFL feed.
- Deterministic cross-publisher duplicate fixture: **PASS**. Identical Giants headlines collapse to one card and retain ESPN as the representative source according to the locked priority.
- The new secondary adapter is loaded before `sports-news-v11.js` and precached in the current service-worker release.

### Validation limitation
The build environment cannot directly exercise browser CORS against every live RSS publisher. Secondary sources are therefore intentionally optional and failure-isolated; final real-iPhone verification should confirm which external feeds are currently returning through the JSON bridge.

Overall pre-merge classification: **PASS WITH REAL-DEVICE MULTI-SOURCE VERIFICATION RECOMMENDED**.


## Stage 11B17 smoke — News card layout + source balance
Validated before merge with JavaScript compilation and deterministic publisher-mix/card-layout fixtures.

### Executed evidence
- `sports-news-v11.js` and `sw.js` compile successfully.
- Deterministic source-mix fixture: **PASS**.
- Input mix of 30 Yahoo, 6 ESPN, 4 CBS, and 4 FOX stories produces 26 balanced cards: 12 Yahoo, 6 ESPN, 4 CBS, and 4 FOX.
- No balanced run exceeds two consecutive stories from one publisher.
- The global balance occurs after duplicate suppression; team-specific News remains on the existing relevance-first path.
- Deterministic imageless-card fixture: **PASS**.
- A story with no image receives the `no-image` card class and uses a full-width text layout.
- A story whose image errors removes the broken image and switches to the same `no-image` layout.
- Service-worker cache namespace is bumped to `scoreboard-v11b17-news-layout-balance`.

Overall pre-merge classification: **PASS WITH REAL-DEVICE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B18 smoke — Team-page visual themes
Validated before merge with static theme coverage, runtime selector wiring, stylesheet load-order, and service-worker checks.

### Executed evidence
- All 12 current team IDs have explicit theme selectors in `team-theme-v12.css`.
- Existing runtime team-page code still assigns `data-team-id` to the modal before rendering, so the correct theme is selected without new JavaScript behavior.
- The new stylesheet loads after the shared Sports News styling so team-page News cards can inherit the active team theme.
- The outer team-page shell retains a dedicated metal border treatment while content panels remain readable dark surfaces.
- Yankees pinstripe, Phillies powder-blue/red, Flyers orange/black, and Army black/gold theme markers are present as intended; all other current teams also have explicit color identities.
- Overview cards, standings, roster/schedule rows, live badges, team News cards, and bottom navigation are covered by the theme layer.
- `sw.js` compiles successfully, precaches `team-theme-v12.css`, and uses cache namespace `scoreboard-v11b18-team-page-themes`.
- No team-page JavaScript, provider adapter, navigation, or data-normalization code changed in this stage.

Overall pre-merge classification: **PASS WITH REAL-DEVICE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B19 smoke — Yankees light-canvas reference
Validated before merge as a visual-only reference pass.

### Executed evidence
- `team-theme-v13.css` is loaded after `team-theme-v12.css`, so the reference layer supersedes the Stage 11B18 Yankees skin without removing the older rollback layer.
- Yankees selectors are scoped to `data-team-id="yankees"`; no other team receives the reference styling in this pass.
- The outer shell reuses the approved Scoreboard dark-blue steel SVG/gradient texture rather than the simplified My Teams plate treatment.
- Yankees header/content use the same off-white canvas and the same vertical pinstripe x-position, preserving a continuous-field effect across the page.
- Existing overview panels, rows, standings, status, and team-News cards are overridden to light/translucent surfaces with dark text.
- The bottom navigation is centered and rendered as a Scoreboard-metal rail.
- Existing runtime `data-team-id` assignment is unchanged; no team-page JavaScript or provider files changed.
- `sw.js` compiles successfully, precaches `team-theme-v13.css`, and uses cache namespace `scoreboard-v11b19-yankees-reference`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION REQUIRED BEFORE GENERALIZING THE THEME**.


## Stage 11B20 smoke — Yankees header/card refinement
Validated before merge as a Yankees-only visual layer.

### Executed evidence
- `team-theme-v14.css` loads after `team-theme-v13.css` and is scoped only to `data-team-id="yankees"`.
- The Yankees header no longer inherits the pinstripe field; it uses the approved Scoreboard steel texture with corner-bolt treatment, weathering overlays, and dark-blue layered metal gradient.
- A 6–7px metal gap visually separates the metal header from the light pinstripe content field.
- Header content remains the existing MLB kicker + team name; no standings/rank field was added.
- Overview cards, schedule/roster rows, standings container, status, and team News cards use a 2px navy rim with restrained inset/outer definition.
- Yankees roster number badge is circular, dark navy, and light-numbered; the existing roster DOM is unchanged.
- No team-page JavaScript, provider, navigation, or data files changed.
- `sw.js` compiles successfully, precaches `team-theme-v14.css`, and uses cache namespace `scoreboard-v11b20-yankees-refinement`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B21 smoke — Yankees header typography refinement
Validated before merge as a Yankees-only CSS typography pass.

### Executed evidence
- `team-theme-v15.css` loads after `team-theme-v14.css` and is scoped only to `data-team-id="yankees"`.
- The team-name font no longer uses the Stage 11B20 stencil/Arial Black stack; it uses a narrower industrial sans-serif fallback stack.
- Team-name color is aged off-white/light steel rather than pure white.
- Text wear is limited to sparse sub-pixel radial marks plus a muted steel-toned gradient; no full spray-paint or heavy masking treatment is introduced.
- The MLB kicker receives the same softened/narrower typography direction.
- No HTML structure, team-page JavaScript, data/provider logic, navigation, roster, standings, News, or live-state behavior changed.
- `sw.js` compiles successfully, precaches `team-theme-v15.css`, and uses cache namespace `scoreboard-v11b21-yankees-header-type`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE TYPOGRAPHY VERIFICATION RECOMMENDED**.


## Stage 11B21 checkpoint / Stage 11B22 smoke
A delayed five-iteration checkpoint was run before merging the next visual pass.

### Checkpoint evidence
- Core JavaScript compile checks pass for `app.js`, `team-data-v8.js`, `team-page-v8.js`, `live-score-v11.js`, `live-awareness-v6.js`, `home-score-rail-v8.js`, `global-standings-v10.js`, `sports-news-v11.js`, `desktop-nav-v11.js`, `swipe-repair-v11.js`, and `sw.js`.

### Stage 11B22 evidence
- `team-theme-v16.css` is Yankees-scoped and loads after the prior Yankees theme layers.
- Team header is explicitly `position: relative` with `top: auto`, so it no longer floats over scrolled content.
- Header and shell reference the existing `assets/yankees.webp` artwork as their material source.
- Roster position headings now use dark navy contrast; position-count badges use light text on navy.
- Yankees Retry button has explicit light text.
- No team-page JavaScript or provider files changed.
- `sw.js` compiles successfully, precaches `team-theme-v16.css`, and uses cache namespace `scoreboard-v11b22-yankees-metal-readability`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B23 smoke — Yankees artwork-driven header cleanup
Validated before merge as a Yankees-only visual pass.

### Executed evidence
- `team-theme-v17.css` loads after `team-theme-v16.css` and is scoped only to `data-team-id="yankees"`.
- The visible large Yankees title is removed with a standard visually-hidden treatment while the semantic `h2` remains available to accessibility APIs.
- The MLB kicker remains visible.
- The header retains an explicit minimum height so removal of the visible title does not collapse the artwork-driven header.
- No team-page JavaScript, provider, roster, standings, News, navigation, live-state, or Back logic changed.
- `sw.js` compiles successfully, precaches `team-theme-v17.css`, and uses cache namespace `scoreboard-v11b23-yankees-art-header-cleanup`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B24 smoke — Phillies artwork-driven robin’s-egg reference
Validated before merge as a Phillies-only visual pass.

### Executed evidence
- `team-theme-v18.css` loads after `team-theme-v17.css` and is scoped only to `data-team-id="phillies"`.
- The Phillies header and thin shell rails reference the existing `assets/phillies.webp` plaque artwork.
- The semantic Phillies team title is visually hidden while the MLB kicker remains visible.
- The content field uses a pale robin’s-egg base with one-pixel dusty red/burgundy vertical pinstripes.
- Overview panels, rows, standings, status, and team-News cards use light/translucent surfaces with 2px restrained rims and dark readable text.
- Phillies roster position headings/counts and circular roster-number medallions have explicit contrast on the light field.
- The bottom Back rail is centered and retains the approved industrial treatment.
- No team-page JavaScript, provider, navigation, roster-grouping, standings, News, or live-state files changed.
- `sw.js` compiles successfully, precaches `team-theme-v18.css`, and uses cache namespace `scoreboard-v11b24-phillies-reference`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B25 smoke — MLB header tune + Mets reference
Validated before merge as a visual-only MLB team-page pass.

### Executed evidence
- `team-theme-v19.css` loads after `team-theme-v18.css`.
- Yankees and Phillies header selectors only adjust top margin and artwork crop; no behavior or structure changes.
- Both approved headers use `margin-top: -4px` and `background-position: center 40%` for the plaque artwork layer.
- Mets selectors are scoped to `data-team-id="mets"`.
- Mets header references `assets/mets.webp`, keeps the MLB kicker visible, and visually hides the duplicate semantic team title.
- Mets content uses a cool light canvas, one-pixel dusty-blue vertical pinstripes, dark readable text, and softened orange/blue accents.
- Mets roster position headings/counts and circular roster-number medallions have explicit contrast.
- Team News, standings, schedule, status, and roster surfaces inherit the light Mets theme.
- No team-page JavaScript, provider, navigation, roster-grouping, standings, News, or live-state files changed.
- `sw.js` compiles successfully, precaches `team-theme-v19.css`, and uses cache namespace `scoreboard-v11b25-mlb-header-tune-mets`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B26 smoke — remaining team-page themes
Validated before merge as a visual-only nine-team pass.

### Executed evidence
- `team-theme-v20.css` loads after `team-theme-v19.css`.
- Explicit palette/art variables exist for Giants, Jets, Rangers, Army, Fever, Eagles, Flyers, 76ers, and Knicks.
- Each of the nine headers references its existing team artwork asset and uses the approved raised artwork-header geometry.
- The large semantic team title is visually hidden while the league kicker remains visible.
- No body pinstripe or decorative pattern is introduced; each content field is a quiet light team-tinted surface.
- All nine receive dark readable content text, light/translucent cards with restrained 2px rims, themed badges, explicit roster-position contrast, circular roster-number medallions, and the centered industrial Back rail.
- MLB Yankees/Mets/Phillies selectors are not altered by this stylesheet.
- No team-page JavaScript, provider, navigation, roster-grouping, standings, News, or live-state files changed.
- `sw.js` compiles successfully, precaches `team-theme-v20.css`, and uses cache namespace `scoreboard-v11b26-remaining-team-themes`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B27 final inspection + five-iteration checkpoint
Run before merge as the standard checkpoint following Stages 11B23–11B27.

### Repository smoke
- Core JavaScript compilation: **PASS** for `app.js`, `team-data-v8.js`, `team-page-v8.js`, `roster-groups-v8.js`, `live-score-v11.js`, `live-awareness-v6.js`, `home-score-rail-v8.js`, `sports-news-v11.js`, `news-sources-v12.js`, `global-standings-v10.js`, `desktop-nav-v11.js`, `swipe-repair-v11.js`, and `sw.js`.
- All 12 team-library entries remain present and all 12 team IDs retain theme coverage.
- Every local file referenced by `index.html` exists in the branch tree.
- Every service-worker local asset reference exists in the branch tree.
- Service-worker cache namespace is `scoreboard-v11b27-final-inspection`; same-origin network-first `cache: 'no-store'` behavior remains intact.
- Six-hour home-score timing, `scoreboard:live-state`, top-level News/Standings navigation, team News, and swipe/desktop navigation wiring remain present.

### Final visual polish checks
- Giants/Eagles readability override is scoped only to those two team headers and does not change header geometry or page logic.
- Global Standings retains the dark design, highlighted-row treatment, logos, edge bars, and `MY TEAM` badges.
- Status line now reads `<league> standings · <n> My Team(s) highlighted` with reduced size/brightness.

### MLB roster repair checks
- `team-data-v8.js` now uses MLB StatsAPI active-roster supplementation for NYY 147, NYM 121, and PHI 143 while preserving ESPN as primary.
- Deterministic merge fixture: **PASS**.
- Generic ESPN `IF` was enriched to `2B`; generic `OF` was enriched to `CF`; existing specific positions remained unchanged; a missing active player was appended; matching players were not duplicated.
- Existing baseball grouping already recognizes `2B / Second Baseman` and `CF / Center Fielder`, so the known Yankees gap was addressed at the provider/normalization layer rather than by inventing new UI groups.
- MLB supplementation is failure-isolated; an unavailable StatsAPI roster leaves the existing ESPN roster usable.

### Sports News verification
- All 12 team aliases remain present.
- ESPN primary plus FOX/CBS/Yahoo secondary-source configuration remains present.
- Global cap 40, team cap 20, duplicate suppression, global source balancing, no-image card handling, and secondary-source `Promise.allSettled` failure isolation remain wired.

### Live-smoke limitation
- Chromium and Python Playwright are available in the execution environment, but navigation to the public GitHub Pages URL is currently blocked by the environment with `net::ERR_BLOCKED_BY_ADMINISTRATOR`.
- Therefore the automated interactive live-browser portion is classified **ENVIRONMENT BLOCKED**, not an application failure. Deployment/static live verification and real-iPhone verification remain the live evidence path for this stage.

Overall pre-merge classification: **PASS; INTERACTIVE LIVE BROWSER ENVIRONMENT BLOCKED**.


## Stage 11B28 smoke — Giants/Jets header readability
Validated before merge as a two-team visual-only pass.

### Executed evidence
- `team-theme-v20.css` keeps the Stage 11B28 override scoped only to `data-team-id="giants"` and `data-team-id="jets"`.
- Both headers retain the approved `center 40%` artwork crop and normal scrolling layout.
- Readability lift uses a light screen-blend layer plus `brightness(1.16)` and mild saturation; no team artwork asset is replaced.
- Eagles and the remaining ten team headers are untouched by the Stage 11B28 override.
- `sw.js` compiles successfully and uses cache namespace `scoreboard-v11b28-giants-jets-header-lift`.
- No JavaScript/data/provider/navigation files changed in this stage.
- Yankees roster behavior remains on the Stage 11B27 ESPN-primary + MLB active-roster supplementation path; no 40-man/depth-chart substitution was introduced.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B29 smoke — team-page isolation repair
Validated before merge as a shared-shell regression repair.

### Executed evidence
- `team-page-v8.js` and `sw.js` compile successfully.
- Opening a team page now adds both `modal-open` and `team-page-open`; closing removes both.
- `team-page-v8.css` forces the dialog to full viewport height, isolates its paint layer, makes the overlay opaque, and constrains the shell to 100% height with internal scrolling.
- The underlying `.app` is hidden only while `body.team-page-open` is active.
- `.team-page[hidden]` explicitly uses `display:none !important`.
- Existing Back-to-Team / Back-to-My-Teams logic and saved board scroll restoration remain intact.
- Service-worker cache namespace is `scoreboard-v11b29-team-page-isolation`.

Overall pre-merge classification: **PASS WITH REAL-IPHONE REPRODUCTION CHECK RECOMMENDED**.


## Stage 11B30 smoke — iOS team-page overscroll containment
Validated before merge as a targeted follow-up to the failed Stage 11B29 real-iPhone reproduction check.

### Executed evidence
- team-page-v8.js and sw.js compile successfully.
- Opening a team page applies team-page-open to both html and body; closing removes both before restoring the saved board scroll position.
- Root/body scrolling is locked while the team page is open.
- The internal team-page scroller uses overscroll-behavior-y: none.
- A passive-safe touch guard cancels only outward edge gestures at the exact top/bottom of the internal scroller, preventing iOS elastic drag while leaving ordinary vertical scrolling untouched.
- Stage 11B29 underlying-board paint isolation remains in place.
- Service-worker cache namespace is scoreboard-v11b30-ios-overscroll-lock.

Overall pre-merge classification: **PASS WITH REAL-IPHONE REPRODUCTION CHECK REQUIRED**.


## Stage 11B31 smoke — flush team-page Back rail
Validated as a CSS-only follow-up to the successful Stage 11B30 anchoring repair.

### Executed evidence
- Universal final theme override sets team-page shell bottom padding to 0.
- Universal final theme override sets team-page bottom navigation sticky offset to bottom: 0.
- Existing internal Back-rail safe-area padding remains unchanged.
- Stage 11B30 root scroll lock and iOS edge guard remain unchanged.
- sw.js compiles successfully.
- Service-worker cache namespace is scoreboard-v11b31-footer-flush.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B32 smoke — live-panel state bridge
Triggered by a real-use regression report: My Teams could display LIVE while the team page exposed no tappable live feed.

### Recon finding
- live-awareness-v6.js detects live games from the direct league scoreboard.
- team-page-v8.js only creates Live now from the team schedule snapshot.
- live-panel-freshness-v11.js previously returned immediately when no Live now panel already existed, so it could refresh an existing live panel but could not transition a pregame team page into a live-feed state.
- live-score-v11.js and its overlay remained present and wired; the failure was the missing UI/state bridge, not deletion of the live provider or overlay.

### Executed evidence
- live-panel-freshness-v11.js compiles successfully.
- When the direct feed returns state=in, the freshness layer now ensures a standard Live now panel exists even if the schedule snapshot did not create one.
- The promoted panel uses data-label Live now plus existing data-panel classes, so live-score-v11.js MutationObserver can attach the existing Tap for live score interaction.
- Direct refresh updates both displayed score and game detail.
- A direct-only promoted panel is removed when the direct feed no longer reports a live game.
- The observer now checks direct live state whenever the team-page data grid changes, instead of requiring an existing live panel before checking.
- Existing ESPN primary and MLB StatsAPI fallback paths are unchanged.
- Service-worker cache namespace is scoreboard-v11b32-live-panel-state-bridge.

Overall pre-merge classification: **PASS WITH LIVE/REAL-DEVICE VERIFICATION RECOMMENDED**.


## Stage 11B33 smoke — darker live cue + authoritative footer flush
Validated as a CSS-only real-iPhone visual repair.

### Recon finding
- The remaining bottom strip survived Stage 11B31 because selectors such as .team-page[data-team-id="mets"] .team-page-bottom-nav and the mobile team-theme selectors had greater specificity than the generic Stage 11B31 override.
- The live prompt remained the original pale #b9e7c5, which had poor visual weight on the new light team canvases.

### Executed evidence
- live-score-v6.css keeps the existing Tap for live score pseudo-element and changes only its green contrast treatment.
- Final team-theme-v20.css selectors use .team-page[data-team-id] scope plus important bottom offset/padding locks, defeating the older per-team and mobile offsets without changing horizontal shell padding.
- Back-rail bottom corner radii are removed so no themed shell background can show through at the two bottom corners.
- Stage 11B30 iOS overscroll containment and Stage 11B32 live-state bridge remain untouched.
- sw.js compiles successfully.
- Service-worker cache namespace is scoreboard-v11b33-live-cue-footer-flush.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B34 smoke — authentic alternating footer metal
Validated as a footer-texture-only production repair after real-iPhone visual review.

### Executed evidence
- New asset assets/score-metal-tread.svg contains tread rows in both opposing diagonal directions rather than the retired single-direction pattern.
- The tile includes raised-lug dark shadow, steel body, highlight, surface grain, pits, and scratch marks to avoid the previous clean synthetic appearance.
- team-theme-v20.css applies the new texture only to the team-page Back rail and preserves Stage 11B33 bottom:0 / padding-bottom:0 geometry.
- Footer button styling and internal safe-area padding are unchanged.
- sw.js precaches the new SVG and compiles successfully.
- Service-worker cache namespace is scoreboard-v11b34-authentic-footer-metal.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION RECOMMENDED**.


## Stage 11B35 smoke — integrated footer frame
Triggered by real-iPhone visual verification showing that Stage 11B34's improved tread still read as a separate overlay slab.

### Executed evidence
- index.html now wraps team-page header + content in .team-page-scroll while keeping the Back nav as a sibling structural bottom row.
- The header remains inside the scrolling region, preserving the locked behavior that team artwork scrolls away with page content.
- team-page-v8.css makes .team-page-shell non-scrolling and .team-page-scroll the sole vertical scroller.
- team-page-v8.js scroll reset and iOS top/bottom edge guard now target .team-page-scroll, preserving Stage 11B30 overscroll containment.
- team-theme-v20.css applies the same Stage 11B34 steel texture to the shell and makes the nav background transparent; content no longer paints underneath the nav.
- Existing Back button styling/safe-area padding and Stage 11B32 live-feed bridge are unchanged.
- index.html, team-page-v8.js, and sw.js pass syntax/structure checks.
- Service-worker cache namespace is scoreboard-v11b35-integrated-footer-frame.

Overall pre-merge classification: **PASS WITH REAL-IPHONE VISUAL VERIFICATION REQUIRED**.
