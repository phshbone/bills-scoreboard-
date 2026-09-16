# Stage 10.1 smoke checklist

Validated before merge with executed syntax checks, a deterministic Playwright fixture, and targeted data-shape tests.

## Executed evidence
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

## Static/regression review
- My Teams remains the initial screen.
- Sports News is still not exposed as a dead destination; right-swipe from My Teams is reserved for the later complete News screen.
- Team pages/modals continue to block top-level swipe behavior.
- The swipe detector does not call `preventDefault`, so ordinary vertical scrolling remains native.
- The league-tab row retains ownership of its own horizontal gesture.
- Global standings use three primary phone columns, with sport-specific secondary facts under the team name rather than a wide tiny-text table.
- MLB retains the previously proven StatsAPI standings URL; Stage 10.1 only preserves additional fields already present in the returned team-record shape.
- Existing NFL division repair, MLB division fallback, live scoring, schedules, stats, roster grouping, customization, and team-page Back remain wired.
- PWA cache is bumped to `scoreboard-v10-1-swipe-standings`.

## Known cleanup not treated as Stage 10.1 failure
- Yankees MLB depth-chart live provider-shape repair remains deferred.
- The possible home score `FINAL → NEXT` timing change remains deferred.

## Validation limitation
The browser runtime works for deterministic in-memory fixtures, but this host still does not reliably permit browser outbound navigation to the deployed GitHub Pages app/live sports endpoints. Final deployed-provider and real iPhone gesture feel remain a real-device smoke.

Overall pre-merge classification: **PASS WITH LIVE VERIFICATION RECOMMENDED**.
