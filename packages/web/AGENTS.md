# AGENTS.md

Web-family packages under `packages/web/`.

## Boundaries

- Keep Web packages browser-oriented; server-only assumptions belong in Node packages or
  implementations.
- `web-sdk` owns browser runtime behavior, entry interaction tracking, and Web preview bridge
  integration points.
- `preview-panel` is coupled to Web SDK preview internals; preview bridge changes usually affect
  both packages.
- `frameworks/react-web-sdk` owns reusable React abstractions over `@contentful/optimization-web`.
- Keep Web `dev/` harnesses aligned with the browser, preview, or framework behavior they
  demonstrate.

## Validate

- Watch bundle-size impact for Web runtime changes.
- Validate both `web-sdk` and `preview-panel` for preview bridge, panel bootstrapping, or CSP setup
  changes.
- Validate affected Web reference implementations for browser behavior, preview behavior, routing,
  event flow, or React integration changes.
