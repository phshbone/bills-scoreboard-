# Stage 8 smoke checklist

Validated before merge by source inspection and deterministic data-shape review:

- `index.html` replaces the Stage 7 home score rail with the Stage 8 compact one-line rail and wires the Stage 8 team-data, team-page, roster-grouping, and freshness helpers.
- PWA cache is bumped to `scoreboard-v8-home-rail-roster-schedule` and includes every new Stage 8 asset.
- Home score rails remain `pointer-events: none`, stay hidden in Edit mode, and keep the entire plaque as the single team navigation target.
- Final score/date and live score/game-state are rendered on one line with overflow protection rather than a tall two-line block.
- Roster normalization walks grouped/direct roster collections, unwraps `athlete`/`player` records, de-duplicates by player identity, and retains unrecognized positions instead of filtering them out.
- Position normalization includes additional baseball, football, hockey, and basketball aliases; an empty/missing position is routed to `Other / Unassigned`.
- Roster detail reports the unique player count and explains that headings use provider-listed primary positions, so the absence of an empty 2B/CF/etc. heading is not treated as proof that a player vanished.
- Football schedule rendering uses the full `games.upcoming` collection returned by the provider instead of the prior eight-game slice.
- Non-football schedules start with 12 upcoming games and expose a working `Show next 12 games` control only when more returned games remain.
- Team-data freshness wrapper forces a feed refresh when reopening a team after two minutes; Retry still forces a refresh immediately.
- Existing MLB standings fallback, Basic Stats, Full Stats, live-score popup, LIVE plaque pill, grouped roster styling, jersey badges, low Back control, and team customization remain wired.

Environment note: this runtime cannot perform the normal browser-backed/deployed-provider smoke because outbound browser/provider access is blocked. Final visual/provider verification remains the deployed GitHub Pages check on the user's phone. No production mock sports data was added.
