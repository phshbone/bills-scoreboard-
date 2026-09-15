# Stage 3 smoke checklist

Validated before commit:

- Seven team records still render with the Stage 2 order/customization system.
- All seven team records include a provider mapping for the common ESPN endpoint pattern.
- JavaScript syntax check passes.
- Browser test runs in mobile and desktop Chromium using deterministic mocked provider responses because this host blocks external provider DNS/network access.
- Opening a team triggers exactly three proof requests: team, schedule, roster.
- Record and standing summary render from team data.
- Last Game and Next Game are derived from schedule event status/date rather than hard-coded.
- Roster count and sample names render.
- Successful proof responses cache for the visit; Retry forces three fresh calls.
- Back closes the data sheet and restores team context.
- Existing reorder, remove, restore, and local persistence flows still pass.
- No horizontal overflow on the tested mobile/desktop viewports.
- Production contains no mocked provider payloads; mocks exist only in the local smoke harness.
