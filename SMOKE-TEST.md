# Stage 10 smoke checklist

Validated before merge with executed browser fixtures plus source/data-flow review.

## Executed evidence
- Python Playwright is installed and system Chromium at `/usr/bin/chromium` launches successfully.
- Direct `file://` navigation is blocked by this host's administrator policy, so the Stage 10 browser smoke used the existing in-memory DOM fallback rather than bypassing the restriction.
- Stage 10 JavaScript passes `node --check` syntax validation.
- Deterministic browser fixture at 390×844: **PASS**.
- The fixture switches from My Teams to Standings and updates the page title correctly.
- League controls are generated from active selected teams rather than from a hard-coded menu.
- NFL fixture renders all eight AFC/NFC division groups and simultaneously highlights both selected New York teams in their relevant divisions.
- MLB fixture renders the returned division group and highlights the selected Yankees row through the normalized `standingRow` path.
- Switching back to My Teams restores the My Teams screen and title.
- Standings table horizontal overflow remains inside the table scroller; the 390px page itself has no horizontal overflow.
- Desktop regression at 1280×900 also shows no page-level horizontal overflow.

## Static/regression review
- `index.html` keeps My Teams as the default screen and adds only one new complete destination: Standings.
- Sports News is intentionally not exposed as a dead top-level tab.
- The global standings helper loads after the complete `ScoreboardData` wrapper chain, so MLB and NFL repairs remain available to the global screen.
- Global standings uses one representative active team per league to load the normalized league snapshot, while every selected team in that league is used for row highlighting.
- NCAA uses the selected team's relevant standings group rather than fabricating a generic national table.
- Retry is hidden during normal success/loading flow and becomes available only after a real standings-load failure.
- The low top-level navigation is behind team-page and modal z-index layers, so existing team pages/library dialogs retain visual and interaction priority.
- Edit mode hides the top-level navigation to avoid mixing team-management controls with section navigation.
- PWA cache is bumped to `scoreboard-v10-global-standings` and includes the new Stage 10 CSS/JS.
- Existing plaque scores, live scoring, schedules, team standings, Basic/Full Stats, roster grouping, MLB standings fallback, NFL division repair, team customization, and team-page Back remain wired.

## Known cleanup not treated as Stage 10 failure
- Yankees MLB depth-chart live response still does not reliably expose the conditional Depth Chart control and remains a later adapter cleanup.
- The proposed home score `FINAL → NEXT` timing change remains deferred.

## Validation limitation
The browser runtime works for deterministic in-memory fixtures, but this host does not reliably permit browser outbound navigation to GitHub Pages/live provider endpoints. Final deployed-provider verification remains the user's real-device smoke.

Overall pre-merge classification: **PASS WITH LIVE VERIFICATION RECOMMENDED**.
