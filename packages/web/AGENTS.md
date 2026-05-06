# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

These instructions apply to Web-family packages under `packages/web/`.

## Web package boundaries

- Keep Web-family packages browser-oriented. Server-only assumptions belong in Node-specific
  packages or implementations.
- `web-sdk` owns browser runtime behavior, entry interaction tracking, and Web SDK preview bridge
  integration points.
- `preview-panel` is intentionally coupled to Web SDK preview internals. Preview bridge changes
  usually need coordinated Web SDK and preview-panel updates.
- `frameworks/react-web-sdk` owns reusable React abstractions on top of
  `@contentful/optimization-web`. Do not move those abstractions into reference implementations.
- Keep Web package-local `dev/` harnesses aligned with the browser, preview, or framework behavior
  they demonstrate.

## Usually validate

- Watch bundle-size impact for Web runtime changes.
- Validate both `web-sdk` and `preview-panel` when preview bridge behavior, panel bootstrapping, or
  CSP-related setup changes.
- Validate affected Web reference implementations when browser behavior, preview behavior, routing,
  event flow, or React integration changes.
