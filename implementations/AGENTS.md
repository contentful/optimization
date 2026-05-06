# AGENTS.md

Read the repository root `AGENTS.md` first, then the nearest implementation-specific `AGENTS.md`.

These instructions apply to all reference implementations under `implementations/` and to shared
implementation contracts such as `PREVIEW_PANEL_SCENARIOS.md`.

For implementation README prose style, follow [`../STYLE_GUIDE.md`](../STYLE_GUIDE.md). This file
owns implementation boundaries, implementation README structure, and local validation rules.

## Implementation boundaries

- Reference implementations demonstrate integration patterns. Reusable SDK behavior belongs in the
  relevant package under `packages/`.
- Keep implementation code minimal, example-oriented, and aligned with the public SDK surface it is
  demonstrating.
- Prefer root wrapper commands such as `pnpm implementation:run -- <implementation> <script>` for
  implementations that have a `package.json`.
- If the implementation has no `package.json`, use its local README or child `AGENTS.md` commands.

## Implementation README standards

- Reference implementation READMEs must open with the repository-standard centered Contentful
  header, implementation-specific `<h3>`, navigation links including `Readme`, Guides, Reference,
  and Contributing, and the pre-release warning.
- Header navigation in reference implementation READMEs is rendered in both GitHub source browsing
  and TypeDoc project documents. Keep Guides and Reference links as stable generated-docs URLs
  unless you have verified the replacement in both render targets.
- The introduction must identify the SDK package or packages being demonstrated and link back to the
  SDK suite root README.
- Put `## What this demonstrates` near the top and describe the smallest useful scenario, tested SDK
  surfaces, and any important architecture caveat. Keep the tone example-oriented, not marketing
  oriented.
- Keep implementation READMEs procedural. Explain what code path demonstrates the SDK behavior and
  where to inspect it, but do not duplicate package API manuals or authored integration guides.
- Use `## Prerequisites`, `## Setup`, `## Running locally`, `## Running E2E tests`, and `## Related`
  when applicable. Omit sections that do not match the implementation, such as `Running locally` for
  a test-only native app.
- Setup and run commands must prefer monorepo-root commands first, especially `pnpm build:pkgs`,
  `pnpm implementation:run -- <implementation> implementation:install`,
  `pnpm implementation:run -- <implementation> <script>`, and the root `setup:e2e:*` / `test:e2e:*`
  wrappers when they exist.
- Keep `.env` instructions tied to the implementation-local `.env.example`. Do not suggest
  overwriting an existing `.env`, and state when defaults are mock-safe.
- If the README mentions ports, scripts, process cleanup, browsers, Docker, Detox, Xcode,
  Playwright, PM2, or emulator requirements, keep those details aligned with the implementation
  `package.json`, nearest child `AGENTS.md`, and actual scripts.
- End with `## Related` links to the demonstrated package README, nearby comparison implementations,
  shared mocks, and scenario contracts when relevant.

## Shared failure modes

- Package changes are not reflected in a package-backed implementation: run `pnpm build:pkgs`, then
  rerun `pnpm implementation:run -- <implementation> implementation:install`.
- If the goal is full E2E setup rather than the narrowest refresh step, prefer the root
  `pnpm setup:e2e:<implementation>` wrapper when one exists.
- For a full E2E run, prefer the root `pnpm test:e2e:<implementation>` wrapper when one exists.
- Behavior differs from the documented mock setup: compare the implementation `.env` with
  `.env.example` before changing code.
- The app or mocks fail to bind local ports: stop only the affected implementation's local processes
  with its documented stop command.
- Do not use broad PM2 cleanup for reference apps. Prefer implementation-local `serve:stop` scripts
  where they exist.
- Implementation-specific runtime failures such as Docker availability, Playwright browser setup,
  emulator requirements, `.env` drift, PM2 state, and local port conflicts belong in the relevant
  implementation `AGENTS.md`.

## Preview panel contract

- `PREVIEW_PANEL_SCENARIOS.md` is the shared contract for cross-platform preview-panel E2E behavior.
- Keep scenario names, fixture IDs, accessibility identifiers, and test expectations aligned across
  React Native Detox and native iOS XCUITest coverage.
- Do not add debug-only UI labels solely to satisfy preview-panel tests; assertions must observe
  rendered content or real controls.

## Usually validate

- Run implementation `typecheck` for local TypeScript or TSX changes when the implementation
  provides it.
- Run `build` when changing production bundling, static assets, copied SDK assets, or serving
  behavior.
- Run implementation unit tests only when meaningful local unit tests exist and the changed behavior
  is covered there.
- Run Detox or XCUITest for native implementation changes that affect runtime tracking, preview
  behavior, navigation, offline behavior, or end-to-end user experience.
