# Stage 5 smoke checklist

Validated before merge:

- Stage 5 JavaScript syntax checks pass for the normalized data adapter and team-page controller.
- A deterministic Node data smoke confirms record, roster number, schedule parsing, and grouped-standings normalization.
- Upcoming games suppress the provider's duplicate pregame date/time detail instead of showing the same time twice.
- Static markup validation confirms Back is in the low `team-page-bottom-nav` and no longer in the upper-right team header.
- Static markup validation confirms Stage 5 CSS/data/controller assets are wired from `index.html`.
- Roster rendering code places jersey number in a dedicated team-themed badge while leaving position as secondary text.
- Standings rendering prefers provider-supplied leaf groups/divisions and keeps current-team highlighting.
- PWA cache is bumped to `scoreboard-v5-usability` and includes all Stage 5 assets.

Environment note: Chromium is installed in this runtime, but the headless browser process is blocked/hangs under the host's sandbox/system-service restrictions, so the Stage 5 browser-backed interaction pass is classified **environment blocked**, not failed. Production sports-provider DNS/network is also blocked here. The deployed GitHub Pages site therefore remains the final live interaction/provider smoke target.
