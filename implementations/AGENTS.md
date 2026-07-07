# AGENTS.md

Applies to reference implementations and shared implementation contracts under `implementations/`.

## Boundaries

- Reference implementations are first-class product artifacts: maintained SDK integration contracts,
  E2E targets, customer-facing evidence, and concrete consumer reference material. They are not
  optional demos or package-local `dev/` harnesses; do not dismiss failures, stale flows, incomplete
  coverage, or docs gaps as demo-only.
- Reusable SDK behavior belongs in `packages/`; reference implementations should consume the public
  SDK surface the way customers do.
- Keep apps focused, consumer-oriented, coverage-preserving, and aligned with the public SDK surface
  they exercise.
- Do not remove, reduce, or bypass implementation behavior because it appears app-local. First
  verify whether it documents a supported integration path, backs E2E coverage, or exposes an SDK
  gap.
- CDA entry fetches used for SDK entry resolution must stay single-locale. Do not use
  `withAllLocales` or `locale=*`; choose the application Contentful locale in the implementation and
  pass it explicitly to CDA requests.
- Experience API calls that render MergeTags should use the same app locale through SDK top-level or
  request-scoped `locale`.
- Prefer root wrappers: `pnpm implementation:run -- <implementation> <script>`. If an implementation
  has no `package.json`, use its local README or child `AGENTS.md`.

## Implementation READMEs

- Follow root Markdown rules and [`../STYLE_GUIDE.md`](../STYLE_GUIDE.md).
- Use the repo-standard header, implementation-specific `<h3>`, Readme/Guides/Reference/Contributing
  navigation, pre-release warning, and an introduction naming the SDK packages they integrate and
  the customer-style integration path they validate.
- Use this default top-level order: header/navigation/warning, introduction naming the integrated
  SDK package or native status, `## What this covers`, optional near-top architecture notes,
  `## CDA locale handling`, `## Prerequisites`, `## Setup`, `## Running locally`,
  `## Running E2E tests`, implementation-specific maintainer notes, and `## Related`.
- Keep the tone procedural and reference-oriented, not a package API manual.
- Use `## Prerequisites`, `## Setup`, `## Running locally`, `## Running E2E tests`, and `## Related`
  when they fit the implementation.
- Prefer monorepo-root setup/run commands, local `.env.example` guidance, and links to integrated
  package READMEs, related implementations, shared mocks, or scenario contracts.
- Keep ports, process cleanup, Docker, Playwright, Detox, Xcode, emulator, and PM2 details aligned
  with scripts and local `AGENTS.md`.

## Shared failure modes

- If package changes are not reflected in an implementation, run `pnpm build:pkgs`, then rerun that
  implementation's install script.
- Missing SDK APIs or stale SDK types in an implementation are artifact or install-state failures
  until proven otherwise; compare built package declarations with installed declarations before
  adding implementation-local shims.
- Prefer root `pnpm setup:e2e:<implementation>` and `pnpm test:e2e:<implementation>` wrappers when
  they exist.
- For native and React Native E2E, prefer the child implementation's runner script over raw tool
  invocations. The runners start mocks, build/install apps, configure ports, and clean up their own
  child processes.
- Do not treat a missing attached emulator/simulator before a runner starts as proof that E2E cannot
  run locally. Try the documented runner or report its concrete preflight failure.
- Do not treat a generic implementation `test` script as a replacement for Playwright, Detox,
  Maestro, or XCUITest. If the E2E concern is app behavior, run the E2E command.
- If behavior differs from documented mocks, compare the implementation `.env` with `.env.example`
  before changing code.
- Stop only the affected implementation's local processes with its documented stop command. Do not
  use broad PM2 cleanup.

## Preview panel contract

- `PREVIEW_PANEL_SCENARIOS.md` is the shared cross-platform preview-panel E2E contract.
- Keep scenario names, fixture IDs, accessibility identifiers, and expectations aligned across React
  Native Detox, native iOS XCUITest, Android Maestro, and affected package tests.
- Do not add debug-only UI labels solely for tests; assertions should observe rendered content or
  real controls.

## Validate

- Run implementation `typecheck` for local TypeScript or TSX changes when available.
- Run `build` for production bundling, static assets, copied SDK assets, or serving changes.
- Run unit tests only when meaningful local tests exist for the changed behavior.
- Run Playwright, Detox, XCUITest, or Maestro when user-visible behavior, routing, event flow,
  tracking, preview behavior, navigation, offline behavior, or native lifecycle behavior changes.
- Use targeted E2E first: Playwright project/file filters, RN Detox `--test-file` or `-t`, Android
  Maestro `--flow`, and iOS `IOS_ONLY_TESTING` or the local iOS runner's `ONLY_TESTING`.
