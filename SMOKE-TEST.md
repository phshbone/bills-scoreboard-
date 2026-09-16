# Stage 9 smoke checklist

Validated before merge with executed runtime/browser checks plus source/data-flow review.

## Executed evidence
- Playwright runtime preflight: **RUNTIME READY — EXECUTED**. Python Playwright is installed and system Chromium at `/usr/bin/chromium` launched and rendered a minimal page.
- Deterministic browser smoke at a 390×844 viewport: **PASS**.
- Score-overlay assertion confirms the Stage 9 override removes the rail background image/color, border, and box shadow so score text sits directly over the plaque artwork.
- NFL standings fixture confirms the division-level hierarchy normalizes to eight leaf groups (AFC/NFC East, North, South, West) and selects NFC East for a Giants fixture.
- MLB depth-chart fixture confirms explicit `2B` and `CF` positions survive normalization and preserve provider rank order for Starter / 2nd / later depth labels.
- New Stage 9 JavaScript files pass syntax checks.

## Static/regression review
- `index.html` loads the NFL standings repair after the existing MLB standings wrapper and before the freshness wrapper, preserving wrapper order.
- MLB Depth Chart is loaded after the board/team plumbing and only adds a control after a usable depth-chart response is verified.
- The existing Roster remains based on provider primary roster positions; Stage 9 does not manufacture empty 2B/CF groups or relabel roster players from guesses.
- NFL standings failure falls back to the existing standings snapshot rather than breaking the team page.
- The score overlay remains a presentation-only child of the existing plaque and inherits the existing `pointer-events: none` / Edit-mode behavior from the Stage 8 rail implementation.
- PWA cache is bumped to `scoreboard-v9-repairs` and includes all Stage 9 CSS/JS assets.
- Existing live scoring, LIVE plaque pill, MLB standings fallback, Basic/Full Stats, grouped roster, schedule depth, low Back control, and team customization remain wired.

## Validation limitation
The browser runtime is usable, but this host does not reliably permit the browser itself to reach the deployed GitHub Pages site and live sports-provider endpoints. Deployed-provider verification therefore remains a real-device/deployed smoke on the user's phone. No production mock sports data was added.

Overall pre-merge classification: **PASS WITH WARNINGS** — deterministic browser behavior is executed; live deployed-provider behavior remains environment-blocked here.
