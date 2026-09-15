# Stage 4 smoke checklist

Validated before merge with mobile and desktop Chromium emulation using deterministic provider fixtures:

- Seven My Teams records still render.
- Reorder/remove/restore/persistence behavior remains intact.
- Tapping a team opens the team page.
- Team page occupies the full viewport height on phone and desktop.
- Record, Last Game, Next Game, Schedule, and Roster render from normalized live-data responses.
- Record opens standings and highlights the current team.
- Schedule opens recent + upcoming games.
- Roster opens the full returned roster and displays position / jersey when available.
- Back returns detail → overview → originating team-card context.
- Successful responses cache during the visit; Retry forces fresh requests.
- No horizontal page overflow.
- JavaScript syntax checks pass.

Environment note: this runtime blocks outbound sports-provider DNS/network requests, so production live-feed verification must occur on the deployed GitHub Pages site. Browser interaction smoke uses mocked provider responses only in the test harness; production source contains no mocked sports results.
