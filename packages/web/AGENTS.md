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
- `frameworks/nextjs-sdk` owns the Next.js adapter that composes the Node SDK on the server with the
  React Web SDK on the client.
- Keep Web `dev/` harnesses aligned with the browser, preview, or framework behavior they
  demonstrate.

## Validate

- Follow the root `Bundle size` policy for Web runtime size validation.
- Validate both `web-sdk` and `preview-panel` for preview bridge, panel bootstrapping, or CSP setup
  changes.
- Validate affected Web reference implementations for browser behavior, preview behavior, routing,
  event flow, or React integration changes.
- Schedule Web-family package validation by dependency order. `@contentful/optimization-web` is
  upstream of `@contentful/optimization-react-web` and `@contentful/optimization-web-preview-panel`;
  `@contentful/optimization-nextjs` depends on `@contentful/optimization-web`,
  `@contentful/optimization-react-web`, and `@contentful/optimization-node`. Run upstream Web and
  React Web build, size, and packaging commands to completion before starting dependent Next.js
  package build, size, or packaging commands.
- Do not run Web SDK `build`, `clean`, `size:report`, or `size:check` concurrently with React Web,
  Next.js, or preview-panel build, declaration, package, or size commands. Those dependents may read
  Web SDK `dist/` output, including emitted shared chunks and declarations.
