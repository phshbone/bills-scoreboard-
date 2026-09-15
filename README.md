# Bill's Scoreboard

## Stage 4 — Team Pages

This release preserves the approved **My Teams** board and Stage 2 customization, keeps the Stage 3 provider adapter, and turns the live-data proof into the first real team-page experience.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 4 capability
- Tap any plaque outside Edit mode to open a full-height team page.
- Record / standing summary is live and opens a standings view when standings data is available.
- Last Game and Next Game are derived by Scoreboard from the schedule feed.
- Schedule opens a working recent + upcoming schedule view.
- Roster opens a working full roster view with position / jersey when supplied.
- Back is context-sensitive: detail view → team overview → My Teams board.
- Provider/debug wording stays out of the normal interface when all feeds succeed.
- Successful responses are cached during the visit; Retry forces fresh requests.

### Data architecture
The UI consumes normalized Scoreboard objects rather than provider-specific response shapes. Stage 4 continues to use ESPN public JSON as the working primary provider, but those endpoints are unofficial and remain replaceable behind the adapter.

The app now asks for four independent sources where supported: team, schedule, roster, and league standings. One failed feed does not break the others.

No paid service, API key, or Cloudflare Worker is required.

### Optional game context reserved, not exposed
The normalized game model reserves optional fields for venue, attendance, capacity, weather, and broadcast. Those fields may remain empty and do not create controls or blank UI. Weather, attendance trends, and similar pattern features are intentionally deferred until the core scoreboard is complete.

### Existing customization preserved
- Edit mode
- Phone up/down reorder
- Desktop drag-and-drop reorder
- Remove / restore through Team Library
- Reset to original seven-team order
- Local persistence

### Stage contract
- No fake data in production.
- No dead controls.
- Stats, news, weather, attendance analysis, and global top-level navigation remain deferred until each can ship as a complete functional increment.
