# Contentful Optimization SDK Suite Repository Research

## SpecKit Metadata

- `document_type`: `research`
- `status`: `complete`
- `created_on`: `2026-03-12`
- `repository_root`: `/Users/charles.hudson/Projects/contentful/optimization`
- `analyzed_surface`: `packages/universal/*`, `packages/node/node-sdk`, `packages/web/*`,
  `packages/web/frameworks/react-web-sdk`, `packages/react-native-sdk`, `lib/*`,
  `implementations/*`, `.github/workflows/*`, `.specify/memory/constitution.md`
- `method`: static architecture and source analysis (code, configs, CI, package metadata)

## Research Scope

- Validate architecture against the repository constitution.
- Document package topology, dependency direction, and runtime behavior.
- Capture accepted design decisions and non-negotiable constraints.
- Record only unresolved, non-accepted risks.

## Executive Summary

- The repository is a layered monorepo for Contentful Personalization and Analytics SDKs with
  validated dependency direction:
  `api-schemas -> api-client -> core -> platform SDKs -> framework SDKs -> implementations`.
- Runtime architecture centers on `@contentful/optimization-core` with separate stateless and
  stateful execution models.
- Stateful adapters (`web`, `react-native`) add persistence and lifecycle wiring on top of the
  shared core; `node` stays stateless.
- External interface boundaries are explicit through package entrypoints and subpath exports (for
  example `./core-sdk`, `./api-client`, `./api-schemas`).
- Preview tooling is intentionally tightly coupled to core signal internals through
  `registerPreviewPanel(...)` and interceptors for no-roundtrip local overrides.
- Build/release workflows support multi-format JS outputs, implementation-level integration
  validation, and path-filtered CI execution.

## Repository Inventory and Topology

### Size and Test Surface

- Code files (`ts/tsx/js/jsx/mjs/cjs/ejs`) across `packages`, `lib`, `implementations`: `483`
- Code LOC across same surface: `50,105`
- Unit test files in SDK/shared libraries (`packages`, `lib`): `54`
- Implementation E2E test files (`implementations/**/e2e`): `30`

### Top-Level Responsibilities

| Path                                    | Role                                                |
| --------------------------------------- | --------------------------------------------------- |
| `packages/universal/*`                  | Platform-agnostic contracts and core runtime logic  |
| `packages/node/node-sdk`                | Node adapter SDK                                    |
| `packages/web/web-sdk`                  | Browser adapter SDK                                 |
| `packages/web/preview-panel`            | Browser preview panel package                       |
| `packages/web/frameworks/react-web-sdk` | React framework SDK on top of web SDK               |
| `packages/react-native-sdk`             | React Native adapter SDK                            |
| `lib/build-tools`                       | Internal build/publish helper utilities             |
| `lib/mocks`                             | Internal fixtures and mock servers for tests        |
| `implementations/*`                     | Reference apps for integration and E2E verification |

### Package Matrix

| Package                                      | Path                                    | Layer                    | Approx LOC | Test Files |
| -------------------------------------------- | --------------------------------------- | ------------------------ | ---------: | ---------: |
| `@contentful/optimization-api-schemas`       | `packages/universal/api-schemas`        | Contracts                |      2,972 |          1 |
| `@contentful/optimization-api-client`        | `packages/universal/api-client`         | Transport client         |      3,615 |          9 |
| `@contentful/optimization-core`              | `packages/universal/core-sdk`           | Runtime core             |      8,992 |         12 |
| `@contentful/optimization-node`              | `packages/node/node-sdk`                | Platform adapter         |        759 |          1 |
| `@contentful/optimization-web`               | `packages/web/web-sdk`                  | Platform adapter         |      8,249 |         19 |
| `@contentful/optimization-web-preview-panel` | `packages/web/preview-panel`            | Preview tooling          |      2,010 |          0 |
| `@contentful/optimization-react-web`         | `packages/web/frameworks/react-web-sdk` | Framework adapter        |      1,939 |          2 |
| `@contentful/optimization-react-native`      | `packages/react-native-sdk`             | Platform adapter         |     10,721 |          7 |
| `build-tools`                                | `lib/build-tools`                       | Internal build utility   |        469 |          3 |
| `mocks`                                      | `lib/mocks`                             | Internal testing infra   |      1,544 |          0 |
| `@implementation/node-sdk`                   | `implementations/node-sdk`              | Reference implementation |        726 |          2 |
| `@implementation/node-sdk+web-sdk`           | `implementations/node-sdk+web-sdk`      | Reference implementation |      1,453 |          7 |
| `@implementation/web-sdk`                    | `implementations/web-sdk`               | Reference implementation |        751 |          6 |
| `@implementation/web-sdk_react`              | `implementations/web-sdk_react`         | Reference implementation |      2,779 |          8 |
| `@implementation/react-native-sdk`           | `implementations/react-native-sdk`      | Reference implementation |      3,126 |          9 |

### Internal Dependency Direction (Validated)

```mermaid
graph LR
  A[@contentful/optimization-api-schemas]
  B[@contentful/optimization-api-client]
  C[@contentful/optimization-core]
  D[@contentful/optimization-node]
  E[@contentful/optimization-web]
  F[@contentful/optimization-web-preview-panel]
  G[@contentful/optimization-react-native]
  H[@contentful/optimization-react-web]
  I[build-tools]
  J[mocks]

  I --> A
  A --> B
  I --> B
  J --> B
  B --> C
  I --> C
  J --> C
  C --> D
  I --> D
  C --> E
  I --> E
  E --> F
  I --> F
  C --> G
  I --> G
  J --> G
  E --> H
  I --> H
  A --> J
```

- Local package dependency graph is acyclic.
- `pnpm-workspace.yaml` includes `lib/*`, `packages/universal/*`, `packages/node/node-sdk`,
  `packages/web/*`, `packages/web/frameworks/*`, and `packages/react-native-sdk`.
- Implementations are intentionally outside workspace package definitions and consume packed
  tarballs.

## Architecture Deep Dive

### 1) Core Runtime Composition

- `CoreBase` composes:
  - shared `ApiClient`
  - shared `EventBuilder`
  - lifecycle interceptor managers (`event`, `state`)
- `CoreBase` exposes high-level methods:
  - personalization path: `identify`, `page`, `screen`, `track`
  - personalization resolution path: `getFlag`, `personalizeEntry`, `getMergeTagValue`
  - mixed path: `trackView` (sticky routes through personalization; non-sticky routes through
    analytics)
  - analytics path: `trackClick`, `trackHover`, `trackFlagView`
- Resolver utilities are centralized and surfaced through core methods:
  - key-scoped flag resolution (`getFlag`)
  - advanced full-map flag resolution through `flagsResolver.resolve(...)`
  - personalized entry resolution
  - merge-tag value resolution

### 2) Stateful vs Stateless Runtime Models

- `CoreStateless`:
  - no state signal model
  - composes `AnalyticsStateless` + `PersonalizationStateless`
  - `getFlag(...)` does not auto-emit `trackFlagView`
  - intended for server/SSR usage
- `CoreStateful`:
  - module-global signal model (`@preact/signals-core`) for `consent`, `profile`, `changes`,
    `selectedPersonalizations`, `event`, `blockedEvent`, `online`, `previewPanelAttached`,
    `previewPanelOpen`
  - key-scoped reactive flag access via `states.flag(name)`
  - `getFlag(...)` and `states.flag(name)` auto-emit flag-view analytics
  - singleton lock enforced via `StatefulRuntimeSingleton` keyed in `globalThis`
  - explicit lifecycle controls: `destroy()`, `flush()`, `reset()`
  - preview bridge method `registerPreviewPanel(...)` exposes mutable `signals` and `signalFns`

### 3) Consent and Blocking Semantics

- Core-level default allow-list in `ProductBase`: `['identify', 'page', 'screen']`.
- Platform adapters narrow pre-consent allow-list by default where needed:
  - Web: `['identify', 'page']`
  - React Native: `['identify', 'screen']`
- Guarding uses the decorator-based `@guardedBy` pattern:
  - synchronous predicate checks
  - optional `onBlocked` callback
  - blocked async methods preserve async shape with `Promise<undefined>` semantics
- Blocked-event payload shape is structured:
  - `{ reason: 'consent', product, method, args }`

### 4) Stateful Queue and Flush Behavior

#### Analytics (`AnalyticsStateful`)

- In-memory queue keyed by profile ID (`Map<profileId, events>`).
- Flushes grouped batches (`BatchInsightsEventArray`) to Insights API.
- Uses shared `QueueFlushRuntime` for:
  - in-flight suppression
  - online gating
  - exponential backoff + jitter
  - circuit-open windows
  - scheduled retries

#### Personalization (`PersonalizationStateful`)

- Offline queue is insertion-ordered (`Set<ExperienceEvent>`).
- Default offline queue bound: `100` events (`maxEvents` configurable).
- Overflow policy drops oldest entries first and emits optional `onDrop` telemetry.
- Online transitions trigger force-flush attempts and reset pending retry timers.

#### Shared Queue Flush Policy Defaults

- `baseBackoffMs`: `500`
- `maxBackoffMs`: `30000`
- `jitterRatio`: `0.2`
- `maxConsecutiveFailures`: `8`
- `circuitOpenMs`: `120000`
- callbacks: `onFlushFailure`, `onCircuitOpen`, `onFlushRecovered`

### 5) Personalization Resolution Subsystem

- `FlagsResolver`:
  - flattens `ChangeArray` into a key/value map
  - unwraps nested `{ value }` structures where present
- `PersonalizedEntryResolver`:
  - resolves baseline vs variant entries from selected personalizations
  - treats `variantIndex` as 1-based for variants; `0` means baseline
  - returns baseline on invalid/missing replacement data
- `MergeTagValueResolver`:
  - normalizes merge-tag selectors from Contentful entry IDs
  - resolves profile values through selector probing
  - falls back to merge-tag fallback value when lookup fails

### 6) API Contracts and Transport

#### Contract Boundary

- API payload boundaries are validated by `@contentful/optimization-api-schemas` (`zod/mini`).
- `ExperienceEvent` discriminated union includes:
  - `alias`, `component`, `group`, `identify`, `page`, `screen`, `track`
- `InsightsEvent` discriminated union includes:
  - `component`, `component_click`, `component_hover`

#### API Client Composition

- `ApiClient` aggregates:
  - `experience` client (profile reads/mutations)
  - `insights` client (batch event ingestion)
- Experience client methods:
  - `getProfile`, `createProfile`, `updateProfile`, `upsertProfile`, `upsertManyProfiles`
- Insights client method:
  - `sendBatchEvents` with beacon-first strategy and fetch fallback

#### Protected Fetch Stack

- fetch pipeline combines:
  - timeout wrapper (`requestTimeout` default `3000ms`)
  - retry wrapper (`p-retry`-style behavior implemented in package)
- retry policy:
  - automatic retries only for HTTP `503`
  - non-OK non-503 responses abort retry path and fail immediately

### 7) Platform and Framework Adapter Behavior

#### Node SDK (`@contentful/optimization-node`)

- Adapter over `CoreStateless`.
- Defaults event metadata to `channel: 'server'` with Node SDK library name/version.
- Root package exports Node-specific class/constants; transitive core/API surfaces are provided via
  dedicated subpath entrypoints (`./core-sdk`, `./api-client`, `./api-schemas`).

#### Web SDK (`@contentful/optimization-web`)

- Adapter over `CoreStateful`.
- Persistence and identity:
  - `LocalStore` for consent/profile/changes/personalizations/debug
  - anonymous ID persistence via cookie + local storage with legacy cookie migration
- Runtime listeners:
  - online/offline listener updates `online`
  - visibility/pagehide listener triggers `flush()`
- Global behavior:
  - enforces singleton instance at `window.contentfulOptimization`
  - UMD/dev path attaches class constructor to `window.ContentfulOptimization`
- Entry interaction tracking runtime supports auto + per-element controls for views/clicks/hovers.

#### React Web SDK (`@contentful/optimization-react-web`)

- Framework layer on top of `@contentful/optimization-web`.
- Exposes provider/root/context/hooks/components:
  - `OptimizationProvider`, `OptimizationRoot`, `LiveUpdatesProvider`
  - `useOptimization`, `useLiveUpdates`, `useAnalytics`, `usePersonalization`
  - `Personalization` component with live-update and loading-fallback behavior
- Inherits singleton constraints from underlying web runtime.

#### React Native SDK (`@contentful/optimization-react-native`)

- Adapter over `CoreStateful` with async creation (`ContentfulOptimization.create(config)`).
- Explicit active-instance guard (`activeOptimizationInstance`) on top of core singleton semantics.
- Persistence:
  - `AsyncStorageStore` with schema-safe initialization/reads and invalid-value eviction
- Runtime listeners:
  - NetInfo connectivity listener (warning-only fallback when dependency absent)
  - AppState listener for background/inactive flush behavior
- Exposes framework primitives:
  - providers, hooks, analytics/personalization tracking components
  - preview panel UI components and overlay integration

#### Preview Panel Coupling

- Web preview panel (`@contentful/optimization-web-preview-panel`) intentionally depends on:
  - `registerPreviewPanel(...)` signal bridge
  - state interceptors to apply/retain local personalization overrides
- `attachOptimizationPreviewPanel` accepts `{ contentful, optimization, nonce }` and writes to
  `previewPanelAttached`/`previewPanelOpen` signals.

### 8) Persistence and State Durability Model

- Web:
  - durable cache in `localStorage` (best-effort, fault-tolerant)
  - anonymous ID persisted in cookie + storage
- React Native:
  - durable cache in AsyncStorage with parser validation and proactive invalidation
- In-memory runtime:
  - state signals are source of truth during active process lifetime

### 9) Build, Packaging, and Delivery Architecture

#### Build Toolchain

- `rslib` used for publishable package builds.
- Shared JS SDK packaging pattern:
  - ESM (`.mjs`)
  - CJS (`.cjs`)
  - dual declaration outputs (`.d.mts` + `.d.cts`) via `build-tools emit-dual-dts`
- UMD bundles are shipped by:
  - `@contentful/optimization-web`
  - `@contentful/optimization-web-preview-panel`
- React Native build preserves runtime externals and compatibility aliases.

#### Version and Runtime Controls

- Root `engines.node`: `>=20.19.0`
- Workspace pinning:
  - `.nvmrc`: `24.13.0`
  - `pnpm-workspace.yaml`: `nodeVersion`/`useNodeVersion` set to `24.13.0`

#### Reference Implementation Integration

- Implementations consume local `pkgs/*.tgz` tarballs via overrides.
- Root orchestration script (`scripts/run-implementation-script.ts`) normalizes implementation
  install/build/typecheck/test/e2e operations.

### 10) CI/CD and Governance Integration

- Main pipeline (`.github/workflows/main-pipeline.yaml`):
  - path-filtered workload selection
  - setup/install, format, build, typecheck, lint, unit tests
  - per-implementation E2E lanes (`node-sdk`, `node-sdk+web-sdk`, `web-sdk`, `web-sdk_react`)
  - dedicated React Native Android E2E lane
- Publish workflow (`publish-npm.yaml`):
  - release/manual trigger
  - version from tag
  - build, pack, and publish
- Docs workflow (`publish-docs.yml`):
  - TypeDoc generation
  - GitHub Pages deploy

## Verification Strategy in Practice

- Unit tests cover shared libraries and platform packages (`api-client`, `core`, `web`,
  `react-native`, etc.).
- Integration behavior is validated in sparse reference implementations:
  - Node SSR only
  - Node SSR + Web vanilla
  - Web vanilla
  - Web React + Web SDK
  - React Native (Detox Android lane)
- Repository constitution treats reference implementations as required integration gates for
  user-visible behavior changes.

## Accepted Design Decisions (Do Not Treat as Risks)

### DEC-001: Enforce layered, acyclic dependency direction

- `status`: `accepted`
- `decision`: Keep dependencies directional from contracts upward and avoid reverse-layer imports.
- `rationale`: Supports safe multi-platform expansion with lower coupling.
- `alternatives_considered`: flat package graph; peer-coupled cross imports.
- `consequences`: clearer ownership boundaries with stronger package-discipline requirements.

### DEC-002: Contract-first API boundary with schema validation

- `status`: `accepted`
- `decision`: Validate runtime payload boundaries through `@contentful/optimization-api-schemas`.
- `rationale`: Reduces contract drift across SDKs/environments.
- `alternatives_considered`: compile-time typing only; package-local ad hoc checks.
- `consequences`: schema maintenance must stay synchronized with API evolution.

### DEC-003: Stateful runtime uses module-global signals with singleton lock

- `status`: `accepted`
- `decision`: Keep shared state in module-global signals and enforce one stateful instance per
  runtime.
- `rationale`: Ensures coherent shared state and predictable subscription behavior.
- `alternatives_considered`: fully instance-local state graphs; multi-instance shared buses.
- `consequences`: stateful SDKs must be consumed as runtime singletons.

### DEC-004: Consent gating defaults to allow-list model

- `status`: `accepted`
- `decision`: Block non-allowlisted events pre-consent and emit structured blocked-event
  diagnostics.
- `rationale`: Aligns with privacy-first behavior while preserving minimal pre-consent
  functionality.
- `alternatives_considered`: block-all pre-consent; permissive defaults.
- `consequences`: integrators must explicitly collect consent before broad tracking.

### DEC-005: Guard behavior is decorator-based and synchronous

- `status`: `accepted`
- `decision`: Use stage-3 `@guardedBy` wrappers for guard composition.
- `rationale`: Centralized, consistent guard enforcement.
- `alternatives_considered`: inline checks; middleware chains.
- `consequences`: decorator support is a build/runtime assumption.

### DEC-006: Stateful analytics queues by profile and flushes in batches

- `status`: `accepted`
- `decision`: Keep profile-scoped event queues with batch flush and retry runtime.
- `rationale`: Preserves profile-event association and network efficiency.
- `alternatives_considered`: immediate send; global ungrouped queue.
- `consequences`: added queue orchestration complexity.

### DEC-007: Stateful personalization uses bounded offline queue with drop policy

- `status`: `accepted`
- `decision`: Buffer offline personalization events with bounded queue and oldest-first drop on
  overflow.
- `rationale`: Prevents unbounded memory growth in prolonged offline scenarios.
- `alternatives_considered`: unbounded queue; reject-new policy.
- `consequences`: oldest offline events can be dropped under sustained pressure.

### DEC-008: Use shared queue flush runtime with backoff, jitter, and circuit opening

- `status`: `accepted`
- `decision`: Centralize queue resilience behavior in `QueueFlushRuntime`.
- `rationale`: Consistent retry/circuit behavior across analytics and personalization.
- `alternatives_considered`: per-product retry stacks.
- `consequences`: policy tuning affects both domains.

### DEC-009: Preview tooling is intentionally coupled to core signal internals

- `status`: `accepted`
- `decision`: Expose signal bridges through `registerPreviewPanel(...)` and apply overrides via
  interceptors.
- `rationale`: Enables immediate local preview overrides without network roundtrips.
- `alternatives_considered`: API-only preview mutations; isolated shadow state stores.
- `consequences`: preview packages are intentionally coupled to core internals.

### DEC-010: Publish JavaScript SDKs as ESM, CJS, and dual declarations

- `status`: `accepted`
- `decision`: Ship multi-format artifacts for broad consumer compatibility.
- `rationale`: Supports mixed ESM/CJS ecosystems.
- `alternatives_considered`: ESM-only strategy.
- `consequences`: broader build/release surface area.

### DEC-011: Include UMD outputs for browser-oriented packages

- `status`: `accepted`
- `decision`: Ship UMD builds for web runtime and preview panel packages.
- `rationale`: Enables direct script-tag and legacy browser integration paths.
- `alternatives_considered`: module-only web distribution.
- `consequences`: extra bundling and global-surface compatibility work.

### DEC-012: Retry logic is intentionally limited to HTTP 503

- `status`: `accepted`
- `decision`: Apply automatic retries only to `503 Service Unavailable` responses.
- `rationale`: Treats `503` as explicit transient availability signal and avoids broad retry side
  effects.
- `alternatives_considered`: broader 5xx retry, custom predicate-based retry at base layer.
- `consequences`: non-503 transient failures surface immediately to callers.

## Accepted Constraints (Do Not Treat as Risks)

- `CON-001`: Exactly one stateful SDK instance is supported per JS runtime.
- `CON-002`: `CoreStateful.reset()` intentionally preserves consent and preview panel signals.
- `CON-003`: Implementations intentionally sit outside workspace package definitions and consume
  packed tarballs.
- `CON-004`: Main pipeline E2E execution is intentionally path-filtered for runtime/cost control.
- `CON-005`: React Native connectivity handling depends on optional
  `@react-native-community/netinfo`; absence degrades to warning + no connectivity listener.
- `CON-006`: Constitution principles in `.specify/memory/constitution.md` are normative for
  architecture and verification behavior.

## Open Risk Register (Unresolved / Undocumented Only)

### RSK-001: SpecKit command-template bootstrap remains incomplete

- `severity`: `low`
- `evidence`: expected `.specify/templates/commands/` artifacts are absent.
- `impact`: local command-template-level guardrails for constitution/spec workflows are incomplete.
- `mitigation`: add command templates and integrate checks in contributor workflow.

### RSK-002: Preview panel package lacks direct unit-test coverage

- `severity`: `medium`
- `evidence`: `packages/web/preview-panel` has no direct unit-test suite.
- `impact`: preview override regressions are primarily detected at integration/E2E stages.
- `mitigation`: add focused unit tests for override apply/reset behavior and signal bridge
  interactions.

## Appendix A: Runtime Behavior Notes

- Stateful adapters persist state through reactive effects tied to core signals.
- Blocked events are surfaced through both callback (`onEventBlocked`) and signal stream
  (`blockedEventStream`).
- Online transitions trigger flush behavior in stateful products/adapters.
- Preview overrides are applied at state-interceptor boundaries rather than by mutating server
  responses.

## Appendix B: Quality and Delivery Snapshot

- Main CI lanes: setup, format, build, typecheck, lint, unit tests, and path-filtered implementation
  E2E lanes.
- RN Android E2E lane provisions emulator + mock server + Metro + Detox run.
- Publish lane derives release version from tag, bumps package versions, builds, packs, and
  publishes.
- Docs lane regenerates TypeDoc and deploys to GitHub Pages.
