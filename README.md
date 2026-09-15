# Bill's Scoreboard

## Stage 3 — Live Data Proof

The current release keeps the approved **My Teams** board and Stage 2 customization, then adds one new complete capability: tap any team plaque to open a compact live-data proof view.

### Current teams
- New York Giants — NFL
- New York Yankees — MLB
- New York Mets — MLB
- New York Jets — NFL
- New York Rangers — NHL
- Army Black Knights — NCAA football
- Indiana Fever — WNBA

### Working Stage 3 capability
- Tap any plaque outside Edit mode to open live data.
- Keyless ESPN public JSON endpoints are used for the proof layer.
- Team endpoint supplies record / standing summary when available.
- Team schedule endpoint supplies the event list; Scoreboard derives Last Game / Next Game / Live Now itself.
- Roster endpoint is checked independently and reports the returned roster count plus a small sample.
- Team, schedule, and roster requests fail independently so one unavailable feed does not break the whole sheet.
- Successful responses are cached in memory for the current visit; Retry forces a fresh request.
- Back closes the live-data proof and returns focus to the originating team plaque.

### Provider status
ESPN's public site JSON endpoints are keyless and cover all seven current sports/teams through a common URL pattern, but they are not a documented/support-contract API. They are therefore a **Stage 3 proof provider**, not permanently locked infrastructure.

TheSportsDB free V1 was evaluated first. Its free next/previous team schedule calls are home-event limited, and its free table lookup is limited to featured soccer leagues, so it is not sufficient by itself for Scoreboard's true Last Game / Next Game / standings requirements.

### Existing Stage 2 capability preserved
- Edit mode
- Phone up/down reorder
- Desktop drag-and-drop reorder
- Remove / restore through Team Library
- Reset to original seven-team order
- Local persistence

### Stage contract
- No paid services.
- No Cloudflare dependency.
- No fake data in production.
- No exposed controls for unfinished standings, full schedules, full rosters, stats, or news.
- The provider is behind team metadata/adaptor logic so it can be replaced later without redesigning the board.
