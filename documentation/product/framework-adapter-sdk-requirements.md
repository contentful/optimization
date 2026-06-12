---
title: Framework adapter SDK requirements
---

# Framework adapter SDK requirements

> [!NOTE]
>
> This product document defines target-state requirements for framework adapter SDKs in the
> Optimization SDK Suite. Package README files, integration guides, and generated reference docs
> remain the source of truth for implemented API names, signatures, and setup commands.

## Summary

Framework adapter SDKs make Contentful Personalization, Analytics, and Preview behavior feel native
inside application frameworks while preserving the shared Optimization SDK Suite behavior model.

Each adapter SDK must compose the appropriate runtime SDK and the shared Core SDK behavior. It must
not reimplement profile evaluation, event construction, entry resolution, consent gates, locale
matching, queue behavior, or preview override logic locally.

The product goal is to give framework users an idiomatic setup path without changing the
cross-runtime contract for consent, profile continuity, entry personalization, event delivery,
locale handling, preview behavior, and analytics handoff.

## Scope

This document applies to framework adapter SDKs that wrap an Optimization runtime SDK for a
framework-specific integration surface.

Framework adapter SDKs include:

- UI framework adapters for browser or mobile UI frameworks.
- Server framework adapters for request, middleware, controller, route, or dependency-injection
  frameworks.
- Router adapters that map framework routing state to Optimization page or screen events.
- Framework-specific optimized rendering, state access, and analytics handoff helpers.

Framework adapter SDKs can support frameworks with client-only, server-only, or hybrid execution
models. When an application framework can be supported through runtime SDK composition without a
dedicated package, that support belongs in a reference implementation pattern rather than in a
framework adapter SDK.

Native iOS and Android UI helpers can live inside their runtime SDK packages unless the suite
defines a separate native framework adapter package.

## Non-goals

- A framework adapter SDK does not own application content fetching, routing definitions, rendering
  strategy, identity policy, consent policy, or third-party destination policy.
- A framework adapter SDK does not replace the framework's router, data-fetching layer, server
  runtime, dependency-injection container, or state-management conventions.
- A framework adapter SDK does not provide a production starter application.
- A framework adapter SDK does not expose private Core SDK or runtime SDK internals as public
  adapter API.
- A framework adapter SDK does not make server-only SDK behavior available in browser bundles or
  browser-only SDK behavior available in server bundles.

## Users and jobs

| User                 | Job                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Application engineer | Add Optimization behavior through framework-native setup, state access, rendering, routing, and events. |
| Server engineer      | Bind request-scoped Optimization behavior to routes, middleware, handlers, or controllers.              |
| SDK maintainer       | Add and validate a framework package without changing shared runtime behavior.                          |
| Content author       | Preview audience and variant behavior in framework applications that support preview tooling.           |
| Analytics engineer   | Subscribe to Optimization context and forward it to approved application-owned destinations.            |

## Design principles

- **Framework-native surface** - The adapter must use the framework's expected setup and access
  primitives.
- **Runtime composition** - The adapter must delegate shared behavior to the correct runtime SDK.
- **Cross-SDK parity** - The adapter must keep terminology and behavior aligned with other public
  SDKs.
- **Explicit ownership** - The adapter must separate SDK responsibilities from application
  responsibilities.
- **Safe defaults** - The adapter must fail closed on consent, fall back to baseline content, and
  avoid duplicate events.
- **Validation by reference implementation** - The adapter must ship with a reference implementation
  that exercises its primary integration path.

## Package and layering requirements

- **FSDK-1 Package role** - Each adapter package must have a clear suite role: UI framework adapter,
  server framework adapter, router adapter, or a documented combination of those roles.
- **FSDK-2 Runtime SDK dependency** - Each adapter must compose the runtime SDK that owns the target
  execution environment. Browser UI adapters compose the Web SDK. Server adapters compose the Node
  SDK. Mobile framework-facing adapters compose the mobile runtime SDK.
- **FSDK-3 Core behavior reuse** - Adapter code must not duplicate Core SDK behavior for event
  construction, consent gates, queueing, locale resolution, entry resolution, merge tags, Custom
  Flags, or preview overrides.
- **FSDK-4 Public entrypoints** - The package must expose a primary entrypoint and scoped subpath
  entrypoints where subpaths reduce bundle weight or separate incompatible runtime assumptions.
- **FSDK-5 Runtime isolation** - Server-only exports must not pull browser-only dependencies into
  server bundles. Browser-only exports must not execute during server rendering.
- **FSDK-6 Type safety** - JavaScript framework adapters must expose typed TypeScript APIs. Native
  or server-framework adapters must expose platform-idiomatic typed models.
- **FSDK-7 Package metadata** - The package must declare peer dependencies, optional peer
  dependencies, side effects, exports, and build targets that match the framework's package
  conventions.
- **FSDK-8 SDK identity** - Events emitted through the adapter must include library metadata that
  identifies the framework adapter while preserving the runtime channel semantics.
- **FSDK-9 Source boundaries** - Reusable adapter behavior belongs in the package. Example-only
  composition belongs in the reference implementation.

## Initialization and lifecycle requirements

- **FSDK-10 Primary setup primitive** - Each adapter must provide one primary setup primitive that
  matches the framework, such as a provider, plugin, module, middleware, wrapper, initializer, or
  dependency-injection binding.
- **FSDK-11 Owned and injected runtime modes** - UI adapters must support a provider-owned runtime
  SDK instance and an injected runtime SDK instance when framework composition requires external
  ownership.
- **FSDK-12 Request scoping** - Server framework adapters must bind consent, profile, event context,
  locale, and Experience API options to the request scope. They must not retain request-specific
  profile or consent state in a process singleton.
- **FSDK-13 Stateful singleton protection** - Stateful adapters must avoid duplicate stateful SDK
  instances in a single application runtime unless the framework integration explicitly isolates
  those instances.
- **FSDK-14 Framework lifecycle cleanup** - Adapters must subscribe, unsubscribe, flush, reset, and
  destroy SDK resources according to the framework lifecycle.
- **FSDK-15 Hot reload and remount safety** - Adapters must avoid duplicate initialization,
  subscriptions, route events, interaction observers, and timers during hot reload, strict
  rendering, remounts, nested providers, or repeated middleware execution.
- **FSDK-16 Readiness gating** - UI adapters must expose a readiness model and prevent child effects
  from emitting SDK events before required provider-managed state subscriptions are attached.
- **FSDK-17 Configuration capture** - Adapters must define which configuration values are
  initialization-scoped and which can update live.
- **FSDK-18 Locale updates** - Stateful adapters that accept live locale changes must call the
  runtime SDK locale API and expose the resolved Contentful locale to application-owned CDA fetches.
- **FSDK-19 Error handling** - Adapter initialization failures must surface through
  framework-appropriate errors or readiness state without leaving partially initialized SDK
  resources alive.

## State access requirements

- **FSDK-20 Framework-native state** - Adapters must expose SDK state through framework-native
  mechanisms such as hooks, composables, stores, services, contexts, dependency injection,
  publishers, signals, or observables.
- **FSDK-21 Direct SDK access** - Adapters must provide a framework-native way to access the
  underlying public runtime SDK methods when application code needs direct control.
- **FSDK-22 Read-only SDK state** - Adapter state surfaces must preserve runtime SDK state
  ownership. Application code can read state and call public methods, but it must not mutate
  internal signals or private state.
- **FSDK-23 Diagnostics** - Adapters must expose emitted event streams, blocked-event diagnostics,
  readiness, profile state, selected optimizations, consent, persistence consent, locale, and
  preview state where the composed runtime supports them.
- **FSDK-24 Provider-managed subscriptions** - UI adapters must provide an app-level subscription
  setup point so analytics forwarding and diagnostics can attach before child components emit
  events.
- **FSDK-25 Request-local data access** - Server framework adapters must expose request-local
  Optimization data returned from Experience API calls so route handlers, renderers, and analytics
  enrichment can use the same request result.

## Personalization and rendering requirements

- **FSDK-26 Optimized rendering primitive** - UI adapters must provide a framework-native
  optimized-entry rendering primitive that accepts an application-fetched baseline Contentful entry,
  resolves the selected variant, renders the selected entry, and passes non-optimized entries
  through unchanged.
- **FSDK-27 Manual entry resolver** - Adapters must expose a manual entry-resolution helper for
  applications that need to resolve entries outside the optimized rendering primitive.
- **FSDK-28 Single-locale CDA contract** - Adapters must preserve the shared single-locale CDA entry
  contract. Adapter docs and examples must direct applications to fetch entries using the resolved
  Contentful locale.
- **FSDK-29 Fallback rendering** - Optimized rendering must return baseline content when profile
  data, selected optimizations, linked variant entries, optimization fields, or entry shapes are
  unavailable or invalid.
- **FSDK-30 Nested optimized entries** - UI adapters must support nested optimized entries without
  duplicate resolution, invalid tracking attributes, or infinite render loops.
- **FSDK-31 Merge tag helper** - Adapters must expose framework-native access to merge-tag
  resolution for rich-text or component rendering flows.
- **FSDK-32 Custom Flag helper** - Adapters must expose Custom Flag reads through framework-native
  state or helper APIs and preserve flag-view tracking semantics where the runtime supports them.
- **FSDK-33 Live update modes** - UI adapters must support locked first-resolution behavior by
  default and opt-in live updates at global and per-rendering-primitive scope.
- **FSDK-34 Preview-driven live updates** - Preview mode must force optimized rendering surfaces to
  re-resolve when preview state changes, even when normal live updates are disabled.
- **FSDK-35 Server rendering** - SSR-capable adapters must define how server-resolved content,
  client hydration, browser follow-up tracking, and client-side re-resolution work together.
- **FSDK-36 Hydration behavior** - SSR-capable adapters must avoid hydration mismatches, duplicate
  page events, duplicate interaction observers, and visible content flicker in supported rendering
  modes.

## Event and tracking requirements

- **FSDK-37 Manual event methods** - Adapters must expose framework-native access to runtime SDK
  event methods such as identify, page, screen, track, view, click, tap-equivalent, hover, and
  flag-view where the runtime supports them.
- **FSDK-38 Route tracking** - Client framework adapters must provide router-aware page or screen
  tracking for supported routers.
- **FSDK-39 Request tracking** - Server framework adapters must provide request-aware event
  construction for route handlers, middleware, controllers, server functions, or server components.
- **FSDK-40 Interaction tracking** - UI adapters must support global and per-component entry
  interaction tracking configuration for interactions the runtime can observe.
- **FSDK-41 Tracking attributes** - UI adapters that rely on runtime DOM or native element
  observation must emit stable tracking metadata for resolved entries and baseline entries.
- **FSDK-42 Consent gates** - Adapter events must respect the composed runtime SDK consent policy
  and allowed pre-consent event types.
- **FSDK-43 Duplicate prevention** - Adapters must prevent duplicate route events, interaction
  events, flag-view events, and manual event emissions caused by framework rerenders, route reuse,
  remounts, or strict rendering.
- **FSDK-44 Event context customization** - Adapters must allow applications to add framework or
  route-specific event context without mutating SDK internals.
- **FSDK-45 Blocked-event visibility** - Adapters must surface blocked-event diagnostics through the
  framework's state or callback model.

## Consent and profile-continuity requirements

- **FSDK-46 Application-owned consent policy** - Adapter APIs and docs must make clear that the
  application owns the consent decision and any legal or CMP policy.
- **FSDK-47 Consent controls** - Adapters must expose runtime consent APIs for accepting, denying,
  and splitting event consent from durable profile-continuity persistence consent.
- **FSDK-48 Persistence boundaries** - Adapters must preserve the composed runtime SDK's persistence
  model and must not create a second source of truth for profile continuity.
- **FSDK-49 Server/browser identity bridge** - Hybrid adapters or documented compositions must
  define how anonymous profile IDs move between server and browser code when persistence consent
  permits continuity.
- **FSDK-50 Reset behavior** - Adapter reset helpers must clear profile-derived SDK state through
  public runtime SDK APIs and preserve application-owned consent state unless the runtime API
  explicitly changes it.

## Locale requirements

- **FSDK-51 Application Contentful locale ownership** - Adapters must leave Contentful CDA locale
  selection to the application and must document where the app passes that locale to CDA requests.
- **FSDK-52 SDK Experience/event locale input** - Stateful adapters must expose one promoted
  top-level SDK locale for Experience API requests and default event context. Stateless adapters
  must expose an equivalent request-scoped locale option.
- **FSDK-53 Request locale pairing** - Server adapters must make it easy to apply the
  application-chosen locale to a single request's Experience API calls and default event context
  without taking over CDA locale resolution.
- **FSDK-54 Experience API pass-through separation** - Adapters must preserve advanced low-level
  Experience API locale pass-throughs while documenting top-level or request-scoped `locale` as the
  promoted path.
- **FSDK-55 Locale validation** - Adapter APIs must reject invalid explicit SDK/request locale
  values through the shared SDK locale validation behavior.

## Preview requirements

- **FSDK-56 Preview surface** - Preview-capable adapters must provide a framework-native setup path
  for first-party preview tooling.
- **FSDK-57 Preview bridge** - Adapters must connect preview tooling through the runtime SDK preview
  bridge instead of exposing private mutable SDK state.
- **FSDK-58 Preview build control** - Adapters must let applications gate preview tooling from
  production bundles or production runtime exposure where the platform supports it.
- **FSDK-59 Preview override semantics** - Audience and variant overrides must preserve the shared
  preview override contract for activation, deactivation, reset, refresh, and remount behavior.
- **FSDK-60 Preview accessibility** - Preview UI controls must expose stable accessibility labels or
  identifiers when the framework supports E2E automation.

## Analytics handoff requirements

- **FSDK-61 Event stream handoff** - Stateful adapters must provide a provider-level, app-level, or
  framework-level hook for subscribing to emitted SDK events.
- **FSDK-62 Request-local handoff** - Server adapters must expose request-local optimization context
  for enriching application-owned business events.
- **FSDK-63 Destination ownership** - Adapters must not initialize or send to third-party analytics
  destinations. Applications own destination SDKs, schemas, queues, consent mode, and retry policy.
- **FSDK-64 Context enrichment** - Adapters must let applications read experience, variant, entry,
  flag, profile readiness, consent, and locale context needed for approved analytics handoff.

## Documentation requirements

- **FSDK-65 Package README** - Each adapter package README must explain the package role, when to
  use it, installation, minimal setup, common configuration, critical caveats, and links to guides,
  reference implementations, and generated reference docs.
- **FSDK-66 Integration guide** - Each adapter SDK must have a guide that walks through the primary
  integration path from install to first personalized render and first valid Analytics event.
- **FSDK-67 Responsibility model** - Documentation must separate SDK responsibilities from
  application responsibilities for content fetching, routing, rendering, identity, consent, locale,
  preview exposure, and analytics destinations.
- **FSDK-68 SSR guidance** - SSR-capable adapters must document supported rendering modes, hydration
  behavior, cache boundaries, request identity, consent boundaries, and client follow-up tracking.
- **FSDK-69 API reference** - Public exports must be documented through generated reference docs.
  Authored docs must avoid duplicating exhaustive signatures unless the detail prevents integration
  mistakes.
- **FSDK-70 Reference implementation link** - Each adapter package README must link to the reference
  implementation that validates the primary integration path.

## Validation requirements

- **FSDK-71 Unit coverage** - Adapter packages must include package-level tests for setup, lifecycle
  cleanup, state access, rendering helpers, router/request adapters, live updates, and duplicate
  prevention.
- **FSDK-72 Typecheck and lint** - Adapter packages must pass package typecheck and lint through the
  repository's standard validation commands.
- **FSDK-73 Build validation** - Adapter packages must pass package build validation for emitted
  runtime code, declarations, entrypoints, and subpaths.
- **FSDK-74 Bundle-size validation** - Browser or bundled adapter packages must include bundle-size
  validation for dependency, export, or bundle-shape changes.
- **FSDK-75 Reference implementation validation** - Each adapter package must have a matching
  reference implementation with automated E2E coverage for the adapter's primary happy paths.
- **FSDK-76 Downstream validation** - When adapter behavior affects shared runtime behavior or
  public SDK contracts, validation must include affected downstream reference implementations.
- **FSDK-77 Mock-backed E2E** - Adapter E2E validation must run against shared mock Experience API,
  Insights API, and Contentful fixture data.

## Acceptance checklist

Use this checklist when adding or evaluating a framework adapter SDK.

- [ ] Package role, supported framework versions, runtime assumptions, and non-goals are documented.
- [ ] The adapter composes the correct runtime SDK and does not duplicate Core SDK behavior.
- [ ] Public entrypoints and subpaths isolate server, browser, router, and preview concerns.
- [ ] Initialization follows the framework's expected setup primitive.
- [ ] Owned and injected SDK ownership modes are supported where the framework needs them.
- [ ] Lifecycle cleanup prevents leaked subscriptions, observers, timers, and SDK instances.
- [ ] Stateful singleton or request-scoped behavior matches the composed runtime SDK.
- [ ] Readiness state prevents child effects from emitting before provider-managed subscriptions are
      attached.
- [ ] Framework-native state access exposes profile, selected optimizations, consent, persistence
      consent, locale, events, blocked events, and preview state where supported.
- [ ] Optimized rendering resolves variants, falls back to baseline content, supports nested
      entries, and preserves the single-locale CDA entry contract.
- [ ] Manual helpers cover entry resolution, merge tags, Custom Flags, and direct SDK access.
- [ ] Route, request, screen, page, manual, interaction, and flag-view events are supported where
      the framework and runtime can observe them.
- [ ] Duplicate events are prevented across remounts, strict rendering, hot reload, route reuse, and
      repeated middleware execution.
- [ ] Consent controls support accepted, denied, and split event/persistence consent.
- [ ] Locale helpers expose resolved Contentful locale and keep CDA, event-context, and Experience
      API locale roles separate.
- [ ] Preview-capable adapters use the first-party preview bridge and support build/runtime gating.
- [ ] Analytics handoff exposes SDK context without owning third-party destination delivery.
- [ ] Package README, guide, generated reference docs, and reference implementation links are in
      place.
- [ ] Unit tests, typecheck, lint, build, bundle-size checks, and reference implementation E2E cover
      the adapter's public behavior.
