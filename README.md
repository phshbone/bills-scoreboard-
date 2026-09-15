# Bill's Scoreboard

## Stage 2 — Customizable My Teams

The current release remains a complete, working **MY TEAMS** board, but the board is now user-configurable without touching code.

Included team library:

- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Stage 2 contract

- Tap **Edit** to manage the board.
- Reorder teams with explicit ↑ / ↓ controls on phone; desktop can also drag cards.
- Remove a team from My Teams without deleting it from the Team Library.
- **Add team** restores any removed team.
- **Reset** restores the original seven-team order.
- Selection and order persist locally between visits.
- The seven current plaques remain the approved responsive visual source of truth.
- No paid services, Cloudflare dependency, live sports API, or fake future data are required.
- `window.__APP_READY__` remains available for deterministic browser verification.

The product/interaction decisions for later stages are recorded in `SCOREBOARD-LOCK.md`.

### Planned later functional increments

Next comes live sports data and the first working team view. Later increments add standings, schedules/rosters, basic/full stats, global and team-specific news, and additional team artwork/library entries. Deep strategy/analyst synthesis is explicitly deferred until the core scoreboard is complete.
