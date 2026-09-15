# Stage 5.1 — roster grouping

This small functional increment improves roster readability without changing sports providers or adding speculative depth-chart labels.

## Included
- Group roster players by returned position.
- Use sport-aware position ordering so related roles stay together.
- Preserve team-themed jersey-number badges.
- Keep the existing larger typography and low Back navigation.

## Deliberately not inferred
Starter/backup status is not shown unless a future data source supplies a trustworthy depth-chart field. Roster order is not treated as depth order.

## Standings note
The current ESPN standings response is not consistently returning the expected leaf-division hierarchy in the deployed app. This stage does not invent division labels or hard-code live standings. Division grouping remains a separate data/display fix.
