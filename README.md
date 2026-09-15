# Bill's Scoreboard

## Stage 1 — Team Board

This release is intentionally limited to one complete function: a responsive **MY TEAMS** board using the approved team plaque artwork.

Included teams:

- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Stage 1 contract

- No dead navigation.
- No fake roster, schedule, standings, stats, news, or API data.
- No paid services or Cloudflare dependency.
- Plaque artwork is the responsive visual source of truth: resize/reflow the frame, preserve the artwork.
- Stable team IDs and league/sport metadata are present so later stages can add team pages and data without restructuring the board.
- Static PWA shell supports offline caching.
- Team artwork is stored locally in the repository; no image CDN or paid storage is required.
- Browser smoke coverage is included for desktop and mobile Chromium emulation.

### Planned later stages

Standings, team pages, live sports data, news, and optional additional teams are intentionally deferred until each can ship as its own complete working increment.
