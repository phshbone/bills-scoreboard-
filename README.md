# Bill's Scoreboard

## Stage 10.1 — Swipe Navigation + Richer Global Standings

This correction preserves the approved My Teams board and all Stage 9/10 team-page capability, but removes the Stage 10 floating navigation bar after live phone review showed that it covered standings content and did not match the intended interaction model.

### Current top-level behavior
- **My Teams remains the center/home screen.**
- **Swipe left from My Teams → Standings.**
- **Swipe right from Standings → My Teams.**
- A future **swipe right from My Teams → Sports News** remains reserved until Sports News is a complete working section.
- Top-level swipe is disabled while editing, while a modal/team page is open, and when the gesture starts inside horizontally scrollable content.
- Gestures beginning at the extreme screen edge are ignored so browser/system edge gestures are not deliberately competed with.
- Each top-level screen preserves its prior vertical scroll position when switching.

### Global Standings
- The floating bottom taskbar is removed completely.
- Standings still derives league choices from the user's active My Teams leagues.
- NFL keeps the eight-division Stage 9 repair; MLB keeps the MLB StatsAPI division fallback.
- Selected My Teams clubs remain highlighted.
- Phone tables are now limited to three primary columns: **Team / Record / PCT** (or **PTS** for NHL).
- Additional useful sport-specific standings information is placed under the team name instead of forcing a wide microscopic table.
- MLB can show GB, last 10, home, away, run differential, and streak when returned.
- NFL can show division/conference record, points for/against, differential, and streak when returned.
- NHL can show games played, differential, home/away, and streak when returned.
- WNBA/NCAA expose the comparable useful fields that their provider response actually supplies.
- MLB StatsAPI normalization now preserves home/away, last-10, streak, run differential, and games-played data for this richer view.

### Existing capability preserved
- direct score text over plaque artwork
- live-score popup and home LIVE awareness
- full football schedules and paged long-season schedules
- team standings, Schedule, Roster, Basic Stats, and Full Stats
- NFL division repair and MLB standings fallback
- grouped roster + jersey-number badges
- team reorder/remove/restore + persistence
- team-page low Back navigation

### Known cleanup intentionally deferred
- Yankees MLB depth-chart live response/provider-shape repair.
- Possible home plaque `FINAL → NEXT` change roughly six hours before the next game.

### Stage contract
- No floating top-level taskbar.
- Top-level horizontal swipe exists only between complete top-level screens.
- Detail pages and horizontally scrollable content keep ownership of their own gestures.
- Sports News is not exposed as a dead destination.
- Standings may show more data, but must remain readable on phone without page-level horizontal scrolling.
