# Stage 6 smoke checklist

Validated before merge:

- JavaScript syntax checks pass for all Stage 6 helpers.
- Deterministic live-score data smoke confirms a league-scoreboard event can resolve the selected team, opponent, current score, and in-game detail. The test fixture resolves Yankees 3, Twins 1, Top 5th.
- Deterministic MLB standings smoke confirms the MLB fallback normalizes separate division groups and selects/highlights the Yankees division with an 87-63 record fixture.
- Deterministic Basic Stats parser smoke confirms sport-appropriate team-leader categories can be normalized and selected from a leaders response.
- Basic Stats is conditional: the overview receives a working card only after usable leader data is returned; failure leaves no dead button.
- My Teams live-awareness checks one scoreboard per represented league and adds/removes a small `LIVE` pill without changing team-card navigation.
- Live-score overlay now reads the league scoreboard source, refreshes every 30 seconds while live, and stops automatic polling when the event is no longer in progress.
- MLB standings fallback failure returns to the existing ESPN-normalized standings rather than breaking the page.
- Existing grouped rosters, schedules, record/Last/Next game, low Back control, Retry, local team customization, and PWA behavior remain wired.
- PWA cache is bumped to `scoreboard-v6-basic-stats-live-awareness` and includes all Stage 6 assets.

Environment note: this runtime has previously blocked browser-backed navigation/outbound provider tests. Production live-provider verification therefore remains a deployed GitHub Pages smoke on the user's phone. Deterministic local tests contain fixtures only; production source contains no mocked sports results.
