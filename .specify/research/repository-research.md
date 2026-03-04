# Contentful Optimization SDK Suite Repository Research

## SpecKit Metadata

- `document_type`: `research`
- `status`: `complete`
- `created_on`: `2026-02-24`
- `repository_root`: `/Users/charles.hudson/Projects/contentful/optimization`
- `analyzed_surface`: `packages/universal/*`, `packages/node/node-sdk`, `packages/web/*`,
  `packages/web/frameworks/*`, `packages/react-native-sdk`, `lib/*`, `implementations/*`,
  `.github/workflows/*`, `.specify/memory/constitution.md`
- `method`: static architecture and source analysis (code, configs, CI, package metadata)

## Research Scope

- Validate architecture against the repository constitution.
- Document package topology, dependency direction, and runtime behavior.
- Capture accepted design decisions and non-negotiable constraints.
- Record only unresolved, non-accepted risks.

## Executive Summary

- The repository is a layered monorepo for Contentful Personalization and Analytics SDKs with clear
  dependency direction: `api-schemas -> api-client -> core -> platform SDKs -> implementations`.
- Architecture centers on `packages/universal/core-sdk`, with stateful and stateless execution
  models, shared typed contracts (`zod/mini`), and queue-based resilience for event delivery.
- Web and React Native SDKs are stateful adapters with persistent caches and lifecycle listeners;
  Node is a stateless adapter.
- Preview tooling is intentionally tightly coupled to core signals/interceptors for immediate local
  overrides.
- Build/release tooling is mature (multi-format bundles, tarball-based implementation integration,
  path-filtered CI, publish workflows).
- Primary open risks are process/test gaps; accepted constraints/decisions are explicitly separated
  and excluded from risk classification.

## Repository Inventory and Topology

### Size and Test Surface

- Code files (`ts/tsx/js/jsx/mjs/cjs`) across `packages/universal`, `packages/server`,
  `packages/web`, `packages/react-native-sdk`, `lib`, `implementations`: `357`
- Code LOC across same surface: `37,084`
- Unit test files in SDK and shared libraries (`packages/universal`, `packages/server`,
  `packages/web`, `packages/react-native-sdk`, `lib`): `35`
- Implementation test/e2e files (`implementations`): `20`

### Top-Level Responsibilities

| Path                        | Role                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `packages/universal/*`      | Platform-agnostic contracts and core runtime logic          |
| `packages/node/node-sdk`    | Platform adapter (`node`)                                   |
| `packages/web/*`            | Platform adapters (`web`, `web-preview-panel`, `react-web`) |
| `packages/react-native-sdk` | Platform adapter (`react-native`)                           |
| `lib/*`                     | Internal shared tooling (`build-tools`, `logger`, `mocks`)  |
| `implementations/*`         | Reference apps for integration and E2E verification         |

### Package Matrix

| Package                                      | Path                               | Layer                    | Approx LOC | Test Files |
| -------------------------------------------- | ---------------------------------- | ------------------------ | ---------: | ---------: |
| `@contentful/optimization-api-schemas`       | `packages/universal/api-schemas`   | Contracts                |      2,791 |          1 |
| `@contentful/optimization-api-client`        | `packages/universal/api-client`    | Transport client         |      3,406 |          7 |
| `@contentful/optimization-core`              | `packages/universal/core-sdk`      | Runtime core             |      7,205 |         11 |
| `@contentful/optimization-node`              | `packages/node/node-sdk`           | Platform adapter         |        505 |          1 |
| `@contentful/optimization-web`               | `packages/web/web-sdk`             | Platform adapter         |      4,346 |          5 |
| `@contentful/optimization-web-preview-panel` | `packages/web/preview-panel`       | Preview tooling          |      1,863 |          0 |
| `@contentful/optimization-react-native`      | `packages/react-native-sdk`        | Platform adapter         |      9,683 |          6 |
| `logger`                                     | `lib/logger`                       | Internal utility         |        682 |          2 |
| `mocks`                                      | `lib/mocks`                        | Internal testing infra   |      1,190 |          0 |
| `build-tools`                                | `lib/build-tools`                  | Internal build helpers   |        393 |          2 |
| `@implementation/node-sdk`                   | `implementations/node-sdk`         | Reference implementation |        389 |          2 |
| `@implementation/node-sdk+web-sdk`           | `implementations/node-sdk+web-sdk` | Reference implementation |        461 |          4 |
| `@implementation/web-sdk`                    | `implementations/web-sdk`          | Reference implementation |        282 |          3 |
| `@implementation/web-sdk_react`              | `implementations/web-sdk_react`    | Reference implementation |      1,264 |          4 |
| `@implementation/react-native-sdk`           | `implementations/react-native-sdk` | Reference implementation |      2,624 |          7 |

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
  H[build-tools]
  I[logger]
  J[mocks]

  H --> A
  A --> B
  H --> B
  I --> B
  J --> B
  B --> C
  H --> C
  I --> C
  J --> C
  C --> D
  H --> D
  C --> E
  H --> E
  E --> F
  H --> F
  C --> G
  H --> G
  J --> G
  H --> I
  A --> J
```

- Local package graph is acyclic (`cycle: no` from current manifest graph validation).
- `pnpm-workspace.yaml` includes `lib/*`, `packages/react-native-sdk`, `packages/web/*`,
  `packages/web/frameworks/*`, `packages/node/node-sdk`, `packages/universal/*`; implementations are
  intentionally outside workspace and consume packed SDK tarballs via overrides.

## Architecture Deep Dive

### 1) Core Runtime Composition

- `CoreBase` composes shared `ApiClient`, `EventBuilder`, and interceptor managers:
  - `event` interceptors for outbound events.
  - `state` interceptors for inbound optimization state (`OptimizationData`).
- `CoreBase` provides high-level product delegation methods:
  - personalization path: `identify`, `page`, `screen`, `track`, sticky `trackComponentView`.
  - analytics path: `trackFlagView`, non-sticky `trackComponentView`.

### 2) Stateful vs Stateless Runtime Models

- `CoreStateless`:
  - no internal mutable runtime state model.
  - composes `AnalyticsStateless` + `PersonalizationStateless`.
  - intended for server/SSR.
- `CoreStateful`:
  - module-global signal model (`@preact/signals-core`) for `consent`, `profile`, `changes`,
    `personalizations`, `event`, `blockedEvent`, `online`.
  - singleton lock enforced through `StatefulRuntimeSingleton` on `globalThis`.
  - explicit lifecycle methods: `destroy()`, `flush()`, `reset()` (reset intentionally preserves
    consent).
  - preview bridge method `registerPreviewPanel()` returns mutable `signals` and `signalFns`.

### 3) Consent and Blocking Semantics

- `ProductBase` defaults pre-consent allow-list to `['page', 'identify']`.
- Stateful products normalize `trackComponentView`/`trackFlagView` to `component` for allow-list
  evaluation.
- Guarding is method-level via stage-3 decorator `@guardedBy`:
  - synchronous predicate gating.
  - optional `onBlocked` hook.
  - blocked async methods return `Promise<undefined>` to preserve call shape.
- Blocked event payload is structured and emitted to signal/callback:
  - `{ reason: 'consent', product, method, args }`.

### 4) Stateful Queue and Flush Behavior

#### Analytics (`AnalyticsStateful`)

- In-memory queue keyed by profile ID (`Map<profileId, events>`).
- Max queued event threshold: `25` before auto-flush.
- Flush grouped by profile into `BatchInsightsEventArray`.
- Shared `QueueFlushRuntime` manages:
  - in-flight gating,
  - online gating,
  - backoff windows,
  - circuit-open windows,
  - scheduled retries.

#### Personalization (`PersonalizationStateful`)

- Offline queue uses insertion-ordered `Set` of events.
- Default queue bound: `100` events (`maxEvents` configurable).
- On overflow:
  - drops oldest events first,
  - invokes optional `onDrop` callback with detailed context.
- On online state:
  - attempts force flush of queued events,
  - retries/circuit handled via same runtime mechanism.

#### Shared Queue Flush Policy Defaults

- `baseBackoffMs`: `500`
- `maxBackoffMs`: `30000`
- `jitterRatio`: `0.2`
- `maxConsecutiveFailures`: `8`
- `circuitOpenMs`: `120000`
- Hooks: `onFlushFailure`, `onCircuitOpen`, `onFlushRecovered`.

### 5) Personalization Resolution Subsystem

- `FlagsResolver`:
  - flattens `ChangeArray` into key/value `Flags`.
  - unwraps nested `{ value: {...} }` structures when present.
- `PersonalizedEntryResolver`:
  - resolves baseline vs variant entry using selected experiences.
  - interprets `variantIndex` as 1-based; `0` is baseline.
  - fallback strategy returns baseline on invalid/missing replacement structures.
- `MergeTagValueResolver`:
  - normalizes merge-tag selectors from `_` segmented IDs.
  - resolves primitive values from profile via selector probing.
  - falls back to configured merge-tag fallback value.

### 6) API Contracts and Transport

#### Contract Boundary

- All primary payload boundaries are schema-validated in `@contentful/optimization-api-schemas`
  (`zod/mini`).
- `ExperienceEvent` is a discriminated union of:
  - `alias`, `component`, `group`, `identify`, `page`, `screen`, `track`.
- `InsightsEvent` currently accepts only component-view event shape (forward-extensible union).

#### API Client Composition

- `ApiClient` aggregates:
  - `experience` client for profile mutations/queries,
  - `insights` client for batched analytics ingestion.
- Experience client capabilities:
  - `getProfile`, `createProfile`, `updateProfile`, `upsertProfile`, `upsertManyProfiles`.
  - request options for features, locale, forced IP, preflight, plain text.
- Insights client capabilities:
  - `sendBatchEvents` with optional beacon-first strategy and fetch fallback.

#### Protected Fetch Stack

- fetch pipeline composition:
  - timeout wrapper (`requestTimeout` default `3000ms`),
  - retry wrapper (`p-retry`).
- retry behavior:
  - retries explicitly for HTTP `503` responses.
  - non-OK non-503 statuses abort retry loop and fail the request path.

### 7) Platform Adapter Behavior

#### Node SDK (`@contentful/optimization-node`)

- Adapter over `CoreStateless`.
- Default channel/library metadata for server runtime (`channel: 'server'`).
- No platform-specific state persistence.

#### Web SDK (`@contentful/optimization-web`)

- Adapter over `CoreStateful`.
- Persistence and identity handling:
  - `LocalStore` for consent/profile/changes/personalizations/debug.
  - anonymous ID cookie and localStorage key management with legacy migration.
- Runtime listeners:
  - online/offline listener drives `online` state updates.
  - visibility/pagehide listener triggers flush.
- Auto entry view tracking:
  - `ElementViewObserver` (`IntersectionObserver` dwell-time and retry model, visibility
    pause/resume, orphan sweep).
  - `ElementExistenceObserver` (`MutationObserver` coalesced add/remove, move suppression,
    idle/chunked delivery).

#### React Native SDK (`@contentful/optimization-react-native`)

- Async creation model: `Optimization.create(config)` to initialize storage before runtime
  construction.
- Explicit single active instance guard (`activeOptimizationInstance`) plus core singleton
  semantics.
- Persistence:
  - `AsyncStorageStore` with schema validation and invalid cache eviction.
- Runtime listeners:
  - NetInfo-based online/offline listener (optional peer dependency; warning-only fallback if
    absent).
  - AppState background/inactive listener for flush on lifecycle transitions.
- Exposes React integration primitives:
  - providers, hooks (`useOptimization`, `useViewportTracking`, screen tracking), tracking
    components.

#### Preview Panel Coupling

- Web preview panel (`@contentful/optimization-web-preview-panel`) and RN preview hooks
  intentionally depend on:
  - `registerPreviewPanel()` mutable signal bridge.
  - state interceptors to preserve manual overrides while API responses continue.
- This enables immediate no-roundtrip local override behavior for debugging/preview workflows.

### 8) Persistence and State Durability Model

- Web:
  - durable cache in `localStorage` (best effort; storage failures logged, runtime continues).
  - anonymous ID persisted in cookie and localStorage key.
- React Native:
  - durable cache in AsyncStorage with parser-based validation on initialize/access.
  - malformed or schema-invalid values are proactively invalidated.
- In-memory runtime:
  - state signals are immediate source of truth during active process lifetime.

### 9) Build, Packaging, and Delivery Architecture

#### Build Toolchain

- `rslib` used for publishable package builds.
- Common output for SDK packages:
  - ESM (`.mjs`)
  - CJS (`.cjs`)
  - dual declaration output via `build-tools emit-dual-dts`.
- Web and web-preview-panel also ship UMD bundles with enforced default export shape.
- React Native build:
  - runtime externals preserved for RN ecosystem packages,
  - browser alias shims for `diary` and `util` compatibility.

#### Version and Runtime Controls

- Root `engines.node`: `>=20.19.0`.
- Workspace/node pinning:
  - `.nvmrc`: `24.13.0`
  - `pnpm-workspace.yaml`: `nodeVersion/useNodeVersion: 24.13.0`.

#### Reference Implementation Integration

- Implementations consume local package tarballs from `pkgs/*.tgz` via `pnpm` overrides.
- Root orchestration script (`scripts/run-implementation-script.ts`) standardizes
  install/build/test/e2e commands per implementation.

### 10) CI/CD and Governance Integration

- Main pipeline (`.github/workflows/main-pipeline.yaml`):
  - path-filtered change detection for build/unit/e2e workloads,
  - install/setup, license checks, format, build, typecheck, lint, package-matrix unit tests,
  - per-implementation e2e jobs (`node-sdk`, `node-sdk+web-sdk`, `web-sdk`, `web-sdk_react`) plus
    dedicated RN Android emulator lane.
- Publish workflow (`publish-npm.yaml`):
  - release/manual dispatch,
  - version derivation from tag,
  - package version bump, build, pack, and publish.
- Docs deployment workflow (`publish-docs.yml`):
  - generates TypeDoc output and deploys to GitHub Pages.

## Verification Strategy in Practice

- Unit tests focus on shared and platform SDK behavior (`api-client`, `core`, `web`, `react-native`,
  etc.).
- E2E behavior is verified in sparse reference implementations:
  - Node SSR only,
  - Node SSR + Web vanilla,
  - Web vanilla,
  - Web React + Web SDK,
  - React Native (Detox Android lane in CI).
- Constitution explicitly positions reference implementations as required verification gates for
  user-visible behavior changes.

## Accepted Design Decisions (Do Not Treat as Risks)

### DEC-001: Enforce layered, acyclic dependency direction

- `status`: `accepted`
- `decision`: Keep dependencies directional from contracts upward and prohibit reverse-layer
  imports.
- `rationale`: Enables safe expansion across platforms/environments while minimizing cross-layer
  coupling.
- `alternatives_considered`: flat package graph; peer-coupled cross imports.
- `consequences`: clearer ownership boundaries; requires disciplined package boundaries.

### DEC-002: Contract-first API boundary with schema validation

- `status`: `accepted`
- `decision`: Validate serialized request/response payloads via
  `@contentful/optimization-api-schemas`.
- `rationale`: Prevents runtime contract drift across SDK targets and environments.
- `alternatives_considered`: compile-time types only; ad hoc runtime checks per package.
- `consequences`: strict schema maintenance burden on contract changes.

### DEC-003: Stateful runtime uses module-global signals with singleton lock

- `status`: `accepted`
- `decision`: Maintain shared state via module-global signals and permit one stateful instance per
  runtime.
- `rationale`: Guarantees consistent state propagation and avoids conflicting stateful instances.
- `alternatives_considered`: fully instance-local state graphs; multi-instance shared buses.
- `consequences`: stateful SDKs must be treated as runtime singletons.

### DEC-004: Consent gating defaults to allow-list for `identify` and `page`

- `status`: `accepted`
- `decision`: Block non-allowlisted events pre-consent; emit structured blocked-event diagnostics.
- `rationale`: Aligns analytics/personalization behavior with consent-by-default privacy stance.
- `alternatives_considered`: block-all pre-consent; configurable permissive defaults.
- `consequences`: integration teams must explicitly collect consent before broader tracking.

### DEC-005: Guard behavior is decorator-based and synchronous

- `status`: `accepted`
- `decision`: Use stage-3 `@guardedBy` wrappers for consent guard composition.
- `rationale`: Consistent guard semantics without repeated inline guard logic.
- `alternatives_considered`: inline method-level checks; middleware chains per product.
- `consequences`: decorator support required in build pipeline.

### DEC-006: Stateful analytics queues by profile and flushes in batches

- `status`: `accepted`
- `decision`: Profile-scoped in-memory queue with auto flush threshold and retry runtime.
- `rationale`: Maintains profile-event affinity and improves delivery efficiency.
- `alternatives_considered`: per-event immediate send; single global ungrouped queue.
- `consequences`: brief memory overhead and flush orchestration complexity.

### DEC-007: Stateful personalization uses bounded offline queue with drop policy

- `status`: `accepted`
- `decision`: Buffer offline personalization events in bounded queue, drop oldest when full.
- `rationale`: Prevents unbounded memory growth in prolonged offline scenarios.
- `alternatives_considered`: unbounded queue; reject-new-event policy on overflow.
- `consequences`: oldest offline events may be lost under sustained offline pressure.

### DEC-008: Use shared queue flush runtime with backoff, jitter, and circuit opening

- `status`: `accepted`
- `decision`: Centralize retry/circuit behavior through `QueueFlushRuntime`.
- `rationale`: Consistent resilience behavior across analytics and personalization queues.
- `alternatives_considered`: product-specific retry implementations.
- `consequences`: shared policy tuning affects both queue domains.

### DEC-009: Preview tooling is tightly coupled to core signal internals

- `status`: `accepted`
- `decision`: Expose mutable signal refs through `registerPreviewPanel()` plus interceptors for
  overrides.
- `rationale`: Enables immediate preview overrides without network roundtrips.
- `alternatives_considered`: API-only preview mutations; separate shadow state stores.
- `consequences`: preview subsystems are intentionally coupled to core internals.

### DEC-010: Publish JavaScript SDKs as ESM, CJS, and dual declarations

- `status`: `accepted`
- `decision`: Ship multi-format artifacts for platform interoperability; include UMD for web
  packages.
- `rationale`: Supports mixed consumer ecosystems and script-tag usage.
- `alternatives_considered`: ESM-only strategy.
- `consequences`: more complex build and release matrix.

### DEC-011: Use reference implementations as integration verification gates

- `status`: `accepted`
- `decision`: Validate user-visible changes through implementation-level e2e coverage.
- `rationale`: Catches cross-layer integration regressions not visible in isolated unit tests.
- `alternatives_considered`: unit-test-only verification strategy.
- `consequences`: higher CI complexity and runtime cost.

### DEC-012: Retry logic is intentionally limited to HTTP 503

- `status`: `accepted`
- `decision`: Apply automatic retry only for `503 Service Unavailable` responses in protected fetch.
- `rationale`: Treats `503` as the explicit transient backend-unavailable signal and avoids retrying
  non-transient/non-idempotent failure classes by default.
- `alternatives_considered`: broad retry for additional 5xx/network classes; fully configurable
  retry predicate at base client layer.
- `consequences`: transient failures outside `503` are surfaced immediately without retry.

## Accepted Constraints (Do Not Treat as Risks)

- `CON-001`: Exactly one stateful SDK instance is supported per JS runtime.
- `CON-002`: `CoreStateful.reset()` preserves consent by design.
- `CON-003`: Implementations are intentionally outside PNPM workspace package set and consume packed
  tarballs.
- `CON-004`: CI e2e execution is intentionally path-filtered for cost/runtime control.
- `CON-005`: React Native offline detection depends on optional `@react-native-community/netinfo`;
  absence degrades to warning + no offline detection, not failure.
- `CON-006`: Contract-critical runtime behavior is anchored to constitution principles in
  `.specify/memory/constitution.md`.

## Open Risk Register (Unresolved / Undocumented Only)

### RSK-001: SpecKit template bootstrap is incomplete

- `severity`: `low`
- `evidence`: `.specify/templates/commands/` artifacts referenced by constitution sync guidance are
  still absent.
- `impact`: plan/spec/task workflows cannot be fully constitution-enforced through local template
  command checks.
- `mitigation`: add the missing command template set under `.specify/templates/commands/` and wire
  compliance checks into contributor workflow.

### RSK-002: Contract and preview packages have thin direct unit-test coverage

- `severity`: `medium`
- `evidence`:
  - `packages/universal/api-schemas` has a unit suite, but coverage is narrow (validation
    utility-centric; limited direct schema-shape edge tests).
  - `packages/web/preview-panel` has no unit test suite (`test:unit` is TODO/no-op).
- `impact`: schema regressions or preview override regressions may primarily surface via downstream
  integration tests.
- `mitigation`: add focused unit suites for schema edge cases and preview override merge/reset
  behavior.

## Appendix A: Runtime Behavior Notes

- Stateful runtime writes profile/changes/personalizations via reactive effects and persistence
  adapters.
- Blocked events are surfaced through both callback (`onEventBlocked`) and state stream
  (`blockedEventStream`).
- Online transitions actively trigger queue flush attempts for both analytics and personalization in
  stateful adapters.
- Preview overrides are preserved against incoming API responses using state interceptors.

## Appendix B: Quality and Delivery Snapshot

- Main CI lanes: `setup`, `license-check`, `format`, `build`, `type-check`, `lint`, per-package unit
  matrix, per-implementation e2e (`node-sdk`, `node-sdk+web-sdk`, `web-sdk`, `web-sdk_react`,
  `react-native-sdk`).
- RN Android e2e lane provisions emulator, mock server, Metro bundler, and runs Detox suites.
- Publish lane bumps package versions from release tags and publishes built artifacts after
  build/pack steps.
- Docs lane regenerates TypeDoc and deploys GitHub Pages from `docs/`.
