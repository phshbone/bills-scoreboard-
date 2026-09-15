# Stage 1 smoke checklist

Validated before commit:

- Seven team records render.
- Seven plaque image paths resolve in the build.
- No anchors or buttons are present in Stage 1, so there are no dead navigation controls.
- `window.__APP_READY__` provides deterministic browser readiness.
- Mobile layout uses one column; desktop layout uses two columns.
- PWA manifest and service worker are present.
