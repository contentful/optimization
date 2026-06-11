---
title: Optimization SDK Suite fPRD
---

# Optimization SDK Suite fPRD

> [!NOTE]
>
> This product document describes the suite-level target product surface. Package README files,
> integration guides, and generated reference docs remain the source of truth for API names,
> signatures, and setup commands.

## Summary

The Optimization SDK Suite gives developers a consistent way to add Contentful Personalization,
Analytics, and Preview behavior to web, server, mobile, and native applications.

The suite is layered:

- The Core SDK owns shared optimization behavior.
- Runtime SDKs adapt Core behavior to a specific execution environment.
- Framework adapter SDKs provide framework-native integration surfaces on top of runtime SDKs.
- Meta-framework reference patterns document supported SDK compositions for application frameworks
  that do not require a dedicated SDK.
- Reference implementations provide executable examples and validation harnesses for supported
  integration patterns.
- Supporting packages provide low-level API transport, schemas, preview tooling, and native bridge
  infrastructure.

The product goal is to let developers use the SDK layer that matches their application while keeping
profile evaluation, consent behavior, entry resolution, event tracking, locale handling, preview
overrides, and analytics attribution consistent across runtimes.

## Problem

Personalization and analytics integrations span multiple application boundaries. A single customer
journey can include server rendering, browser hydration, client-side route changes, mobile screens,
native app lifecycle events, Contentful entry fetching, consent policy, and third-party analytics
reporting.

Without a consistent SDK suite, teams must rebuild the same behavior in every runtime:

- Evaluate profiles and selected optimizations.
- Resolve Contentful entry variants.
- Track page, screen, view, click, tap, hover, flag, and custom events.
- Enforce consent and persistence policy.
- Keep locale handling aligned between Contentful content and Experience API responses.
- Preview audience and variant changes before release.
- Forward optimization context to analytics systems.

The SDK Suite must centralize shared behavior while giving each runtime and framework an idiomatic
integration surface.

## Goals

- Provide one shared optimization behavior model across all public SDKs.
- Make the correct SDK layer clear for each application runtime or framework.
- Support client, server, mobile, and native personalization workflows.
- Support Contentful Analytics event delivery and optimization attribution.
- Treat preview tooling as a core suite feature.
- Expose third-party analytics reporting handoffs without owning third-party delivery policy.
- Use reference implementations to demonstrate and validate supported SDK integration patterns.
- Keep application responsibilities explicit: content fetching, routing, rendering, identity policy,
  consent policy, and destination policy stay with the application.

## Non-goals

- The suite does not own legal interpretation, CMP behavior, consent records, privacy notices, or
  vendor-specific consent policy.
- The suite does not choose a customer's Contentful content model or localization strategy.
- The suite does not fetch and render application content end to end. Applications fetch Contentful
  entries and render UI.
- The suite does not provide separate native framework adapter SDKs. Native iOS and Android SDKs can
  include SwiftUI, UIKit, Jetpack Compose, and XML Views helpers inside the runtime SDK packages.
- The suite does not replace third-party analytics SDKs, tag managers, CDPs, or data warehouses.
- Reference implementations are not reusable SDK layers, production starter templates, or
  substitutes for package APIs.

## Users and jobs

| User                | Job                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Web developer       | Add client-side personalization, tracking, consent handling, preview, and analytics attribution.                             |
| Server developer    | Resolve optimization decisions during SSR, server functions, middleware, or backend services.                                |
| Mobile developer    | Add personalization, tracking, persistence, offline behavior, and preview to mobile apps.                                    |
| Framework developer | Use a first-party adapter that maps SDK behavior into framework-native providers, hooks, middleware, routers, or components. |
| Content author      | Preview audience and variant behavior inside an application-like runtime before release.                                     |
| Analytics user      | Report optimization exposure and outcomes in Contentful Analytics and approved third-party systems.                          |
| SDK maintainer      | Validate public SDK behavior in realistic application contexts before release.                                               |

## Product model

| Layer                             | Target scope                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core SDK                          | Shared optimization engine and behavior contract.                                                                                                       |
| Runtime SDKs                      | Web, Node, React Native, iOS, and Android.                                                                                                              |
| Framework adapter SDKs            | Application and UI adapters: Angular, React Web, Svelte, and Vue. Mobile UI APIs: React Native. Server adapters: Express and NestJS.                    |
| Meta-framework reference patterns | Next.js, Nuxt.js, SvelteKit, and comparable application frameworks where SDK composition can support the required integration without a dedicated SDK.  |
| Reference implementations         | At least one per published SDK, plus pattern-specific apps for SSR, CSR, hybrid web, native UI shells, mobile/offline behavior, preview, and analytics. |
| Supporting packages               | API Client, API Schemas, Preview Panel, native bridge packages, mocks, fixtures, and shared scenario contracts.                                         |

Some SDK packages can span multiple product roles. For example, the mobile JavaScript SDK is a
runtime SDK because it owns mobile runtime behavior, storage, networking, and app lifecycle
integration. It also provides framework-facing APIs, including providers, hooks, optimized entry
rendering, navigation tracking, and component-level tracking configuration.

Reference implementations are intentionally pattern-oriented. Some framework targets include routing
and rendering strategies inside the framework itself, while meta-frameworks such as Next.js,
Nuxt.js, and SvelteKit can be validated through SDK composition rather than dedicated framework
adapter SDKs. Any target with distinct SSR, CSR, prerendering, or hybrid modalities can have
multiple reference implementations when those patterns are difficult or infeasible to combine in one
application.

## Core SDK requirements

The Core SDK must provide the shared behavior that runtime and framework SDKs compose.

- **CORE-1 Stateful and stateless modes** - Core must support stateful runtimes through
  `CoreStateful` and stateless request-scoped runtimes through `CoreStateless`.
- **CORE-2 Event model** - Core must support shared event methods for profile evaluation, analytics
  delivery, and custom tracking, including identify, page, screen, track, view, click, hover,
  tap-equivalent, and flag-view flows where the runtime supports them.
- **CORE-3 API coordination** - Core must coordinate Experience API calls that return optimization
  data and Insights API calls that record Analytics events.
- **CORE-4 Consent gates** - Core must block non-allowed events when consent is unset or denied,
  expose blocked-event diagnostics, and support runtime-specific pre-consent allow-lists.
- **CORE-5 Profile state** - Stateful Core must expose profile, selected optimization, changes,
  consent, persistence consent, event stream, blocked-event stream, locale, Custom Flag, and preview
  state through read-only observable surfaces.
- **CORE-6 Request state** - Stateless Core must require request-bound consent, profile, event
  context, and Experience API options before event methods are called.
- **CORE-7 Entry resolution** - Core must resolve a baseline Contentful entry to the selected
  variant using application-fetched, single-locale CDA payloads and Experience API selected
  optimization data.
- **CORE-8 Fallback behavior** - Entry resolution must return baseline content when required
  optimization fields, selections, variant indexes, linked entries, or data shapes are missing.
- **CORE-9 Merge tags and Custom Flags** - Core must resolve merge tags and Custom Flags from the
  current profile and changes data. Stateful flag reads must support flag-view tracking.
- **CORE-10 Locale support** - Core must provide shared locale validation and matching primitives so
  runtime SDKs can expose a resolved Contentful locale for app-owned CDA fetches.
- **CORE-11 Queue and fetch behavior** - Core must provide retry, timeout, queue, flush, and
  offline-buffering primitives that runtime SDKs can adapt.
- **CORE-12 Interceptors** - Core must expose lifecycle extension points for SDK layers and
  first-party integrations without requiring application code to mutate internal state.
- **CORE-13 Preview primitives** - Core must provide first-party preview support for registering
  preview bridges, applying overrides, building preview view models, and forcing live update
  behavior while preview is active.

## Runtime SDK requirements

Runtime SDKs must adapt Core to the execution environment while preserving shared behavior.

Public runtime SDKs include Web, Node, React Native, iOS, and Android.

- **RUN-1 Runtime initialization** - Each runtime SDK must provide one primary initialization path
  that fits the environment and avoids duplicate stateful instances.
- **RUN-2 Runtime persistence** - Stateful runtimes must persist consent and profile-continuity data
  with runtime-appropriate storage when persistence consent allows it.
- **RUN-3 Stateless operation** - Node must remain stateless between requests and require
  application-provided request context for consent, profile identity, locale, and event data.
- **RUN-4 Consent controls** - Each runtime SDK must expose APIs for accepting, denying, splitting,
  and reading event consent and durable profile-continuity persistence consent.
- **RUN-5 Profile continuity** - Runtime SDKs must support profile continuity in ways appropriate to
  the environment, such as browser cookies and localStorage, mobile storage, native storage, or
  application-owned server cookies.
- **RUN-6 Event delivery** - Runtime SDKs must deliver Experience API and Insights API events using
  runtime-appropriate transport, retry, timeout, queue, and flush behavior.
- **RUN-7 Tracking APIs** - Runtime SDKs must expose manual tracking methods for supported event
  types and runtime-specific automatic tracking where reliable observation is possible.
- **RUN-8 Page and screen tracking** - Browser and server runtimes must support page events. Mobile
  and native runtimes must support screen events.
- **RUN-9 Interaction tracking** - Runtime SDKs must support entry interaction tracking appropriate
  to the UI environment, including views and clicks on web, views and taps on mobile and native, and
  hovers where browser DOM behavior supports them.
- **RUN-10 Entry personalization** - Runtime SDKs must expose entry resolution APIs that use the
  shared Core resolver and preserve the single-locale CDA entry contract.
- **RUN-11 Locale helpers** - Runtime SDKs must expose the resolved Contentful locale or a helper
  that lets app-owned CDA requests fetch entries in the locale expected by entry resolution.
- **RUN-12 Diagnostics** - Runtime SDKs must expose event streams, blocked-event diagnostics,
  logging, reset, flush, and teardown behavior in forms that match the runtime.
- **RUN-13 Offline behavior** - Mobile and native runtimes must queue Analytics events when offline
  and flush when connectivity or app lifecycle permits.
- **RUN-14 Preview support** - Runtime SDKs with supported preview surfaces must attach or host the
  preview panel, accept preview overrides, and force live updates while preview is active.

## Framework adapter SDK requirements

Framework adapter SDKs must make runtime SDK behavior natural inside a framework without changing
the shared product behavior.

Target framework adapter surfaces include application and UI adapters for Angular, React Web,
Svelte, and Vue; mobile UI APIs for React Native; and server adapters for Express and NestJS.

- **FW-1 Framework-native setup** - Each adapter must provide the framework's expected setup
  primitive, such as a provider, plugin, module, middleware, or application wrapper.
- **FW-2 Lifecycle ownership** - Adapters must initialize, subscribe, update, and clean up SDK
  resources according to framework lifecycle rules.
- **FW-3 State access** - Adapters must expose SDK state through framework-native mechanisms, such
  as hooks, composables, services, stores, dependency injection, or request-scoped context.
- **FW-4 Optimized rendering** - UI framework adapters must provide an optimized entry rendering
  primitive that resolves baseline entries, renders selected variants, and passes non-optimized
  entries through unchanged.
- **FW-5 Manual helpers** - Adapters must provide framework-native access to manual entry
  resolution, merge tag resolution, Custom Flag reads, and direct SDK methods.
- **FW-6 Route and request tracking** - Client framework adapters must support router-aware page or
  screen tracking. Server framework adapters must support request-aware page or custom event
  tracking.
- **FW-7 Interaction tracking** - UI framework adapters must support global and per-component entry
  interaction tracking configuration.
- **FW-8 Live updates** - UI framework adapters must support locked first-resolution behavior by
  default and opt-in live updates at global or component scope. Preview mode must force live
  updates.
- **FW-9 SSR and hydration** - Frameworks that support SSR must define how server-resolved
  optimization data, browser follow-up tracking, route-level rendering strategies, prerendering, and
  hydration behavior work together.
- **FW-10 Duplicate prevention** - Adapters must avoid duplicate SDK initialization, route events,
  interaction events, and subscriptions during hot reload, remounts, nested providers, or repeated
  middleware execution.
- **FW-11 Runtime composition** - Adapters must compose the correct runtime SDK rather than
  reimplementing Core behavior locally.

## Native SDK requirements

Native iOS and Android SDKs are public runtime SDKs. They can include native UI helpers, but those
helpers are part of the runtime SDK rather than separate native framework adapter SDKs.

- **NAT-1 Native runtime ownership** - Native SDKs must own native persistence, networking,
  lifecycle handling, and bridge execution for shared optimization behavior.
- **NAT-2 Native UI helpers** - iOS can include SwiftUI and UIKit helpers. Android can include
  Jetpack Compose and XML Views helpers.
- **NAT-3 Native tracking** - Native SDKs must support screen tracking, entry view tracking, and
  entry tap tracking where the UI surface can observe the interaction.
- **NAT-4 Native personalization** - Native SDKs must expose direct entry personalization APIs and
  UI rendering helpers that use the shared entry resolver.
- **NAT-5 Native preview** - Native SDKs must support in-app preview panel behavior, preview
  overrides, and live updates.
- **NAT-6 Native offline behavior** - Native SDKs must persist allowed profile-continuity state and
  queue eligible events across app lifecycle and offline transitions.

## Reference implementation requirements

Reference implementations are part of the SDK Suite product surface. They show how public SDK APIs
fit into realistic applications and provide executable validation for supported integration
patterns.

- **REF-1 Public-surface examples** - Each reference implementation must use the public SDK surface
  it demonstrates. Reusable SDK behavior belongs in packages, not reference apps.
- **REF-2 SDK coverage** - Each published SDK must have at least one reference implementation that
  demonstrates its primary integration path.
- **REF-3 Runtime behavior coverage** - Runtime SDK reference implementations must demonstrate
  initialization, consent, personalization, tracking, locale handling, local mock API usage, and
  preview where the runtime supports it.
- **REF-4 Framework adapter coverage** - Each framework adapter SDK must have a customer-style
  reference implementation that demonstrates framework-native setup, routing or request tracking,
  optimized rendering, live updates, preview where supported, and analytics handoff.
- **REF-5 Meta-framework pattern coverage** - Meta-frameworks such as Next.js, Nuxt.js, and
  SvelteKit can be supported through reference implementations instead of dedicated SDKs when SDK
  composition covers the required behavior.
- **REF-6 Modality coverage** - CSR, SSR, prerendering, and hybrid web application patterns must
  have separate reference implementations when combining them would make the example unclear or
  technically impractical. This applies whether those modalities are built into a framework or
  provided by a meta-framework.
- **REF-7 Native parity coverage** - Native iOS and Android reference implementations must cover
  supported UI shells and keep test identifiers, preview behavior, and interaction expectations in
  parity.
- **REF-8 Preview scenario contract** - Preview-capable runtimes must share scenario contracts for
  audience overrides, variant overrides, reset behavior, refresh behavior, and remount behavior.
- **REF-9 Mock-backed validation** - Reference implementations must run against shared mock
  Experience API, Insights API, and Contentful fixture data so behavior is repeatable locally and in
  CI.
- **REF-10 E2E validation** - Reference implementations must define the appropriate E2E runner for
  the platform, such as Playwright, Detox, XCUITest, or Maestro.
- **REF-11 Documentation role** - Reference implementation README files must explain what the app
  demonstrates, how to run it, how to validate it, and which SDK or package docs it supports.
- **REF-12 Known gaps** - Reference implementations must document product or handoff gaps when they
  expose a missing SDK capability, such as server-to-client initial optimization data seeding.

## Preview tooling requirements

Preview is part of the core SDK Suite feature set, not an optional side project.

- **PRE-1 Preview bridge** - Runtime SDKs must expose a first-party bridge that preview tooling can
  use without application code mutating internal SDK state.
- **PRE-2 Preview panel** - Supported runtimes must provide a preview panel or host surface that
  lets authors inspect audiences, experiences, variants, and overrides.
- **PRE-3 Variant overrides** - Preview tooling must let authors override selected variants locally
  without changing production profile evaluation.
- **PRE-4 Live update forcing** - Preview mode must force optimized rendering surfaces to re-resolve
  when preview state changes.
- **PRE-5 Production control** - Applications must be able to gate preview tooling from production
  builds or production runtime exposure.
- **PRE-6 Cross-platform parity** - Preview override semantics must remain consistent across Web,
  React Native, iOS, Android, and any later supported runtime surface.

## Third-party analytics reporting requirements

The suite must help applications report optimization context to third-party systems without becoming
a third-party analytics delivery layer.

- **ANL-1 SDK event visibility** - Stateful SDKs must expose emitted SDK events through observable
  event streams or equivalent runtime-native state surfaces.
- **ANL-2 Blocked-event visibility** - Stateful SDKs must expose blocked-event diagnostics so
  applications can validate consent and event-policy behavior.
- **ANL-3 Provider-managed handoff** - Framework adapters must provide an app-level subscription or
  setup point so applications can register analytics forwarding before child components emit SDK
  events.
- **ANL-4 Request-local handoff** - Node and server framework adapters must expose request-local
  optimization data from the SDK call that produced it.
- **ANL-5 Business-event enrichment** - Applications must be able to add experience, variant, entry,
  flag, and profile readiness context to existing business events.
- **ANL-6 Destination ownership** - The suite must not own vendor SDK initialization, third-party
  queues, destination schemas, consent mode, or destination-specific retry behavior.
- **ANL-7 Consent alignment** - Documentation and examples must make clear that applications own
  whether a third-party destination can receive forwarded optimization context.

## Cross-SDK behavioral requirements

The SDK Suite must preserve these behaviors across all public SDKs unless a runtime cannot support
the behavior.

- Consent semantics must be consistent across runtimes.
- Event allow-lists and blocked-event diagnostics must use the same policy model.
- Entry resolution must use the same single-locale CDA payload contract.
- Fallback behavior must render baseline content instead of failing hard when optimization data is
  absent or invalid.
- Applications must own Contentful CDA locale selection and pass one single-locale CDA payload shape
  into SDK entry-resolution helpers.
- SDK `locale` state must represent the current Experience API and default event locale, not a
  resolved Contentful locale.
- Experience API localization must remain separate from application-owned Contentful CDA locale
  selection, while docs should show how to keep the values aligned when localized content requires
  it.
- Profile data, selected optimizations, and changes must have the same conceptual meaning across
  stateful and stateless SDKs.
- Preview overrides must not mutate production content, profile evaluation, or remote audience
  allocation.
- APIs can be runtime-idiomatic, but terminology and behavior must stay aligned.

## Key workflows

The suite must support these application and validation workflows:

- Web client-side personalization with entry resolution, page events, interaction tracking, consent,
  preview, and analytics handoff.
- Application and UI framework personalization across Angular, React Web, Svelte, and Vue with
  framework-native setup, state access, optimized rendering, route tracking, rendering-strategy
  support where applicable, preview-aware live updates, and analytics handoff.
- Server personalization across Node, Express, and NestJS with request-scoped profile evaluation,
  middleware or route integration, SSR support, event delivery, and browser follow-up tracking where
  applicable.
- Meta-framework reference patterns for Next.js, Nuxt.js, and SvelteKit across CSR, SSR-primary,
  prerendering where compatible with personalization constraints, and hybrid takeover modalities.
- Mobile framework-facing personalization through React Native APIs with provider setup, optimized
  entries, screen tracking, interaction tracking, offline behavior, preview, and analytics handoff.
- Native app personalization across iOS and Android with direct client APIs, native UI helpers,
  screen tracking, entry tracking, offline behavior, preview, and analytics handoff.
- Content author preview workflows that inspect and override variants in a supported runtime.
- Reference implementation validation for published SDKs, framework adapters, meta-framework
  modalities, preview parity, native UI shells, and mobile offline behavior.

## Non-functional requirements

- **Reliability** - SDKs must fail closed on consent, fall back to baseline content when resolution
  cannot complete, and continue with in-memory state when best-effort persistence fails.
- **Privacy controls** - SDKs must provide consent and persistence controls, blocked-event
  diagnostics, and clear boundaries for application-owned policy.
- **Performance** - SDKs must avoid unnecessary runtime work, duplicate events, and avoidable bundle
  weight. Preview tooling must be gateable from production bundles where the platform supports it.
- **Runtime compatibility** - SDKs must respect platform constraints for module format, storage,
  network APIs, app lifecycle, router behavior, and SSR boundaries.
- **Developer ergonomics** - Integration surfaces must match the runtime or framework conventions
  and keep default integration paths short.
- **Type and schema safety** - JavaScript and TypeScript packages must expose typed APIs and use
  schema validation for API and Contentful payload shapes where applicable. Native SDKs must expose
  platform-idiomatic typed models.
- **Observability** - SDKs must provide enough state, event, blocked-event, and logging visibility
  for developers to validate behavior without inspecting internal implementation details.
- **Documentation** - Package README files, guides, concepts, reference docs, and reference
  implementations must explain the same responsibility model and cross-SDK behavior.
- **Validation** - Public SDK behavior must be covered by package tests and reference
  implementations that exercise integration workflows end to end.

## Success metrics

- Time from package installation to first personalized render.
- Time from package installation to first valid Analytics event.
- Percentage of reference workflows covered by automated or documented validation.
- Event delivery success rate by runtime.
- Rate of duplicate page, screen, view, click, tap, hover, and flag-view events in reference flows.
- Number of integrations that use preview tooling during development or author review.
- Percentage of public SDKs with maintained README, guide, concept, and reference implementation
  coverage.
- Percentage of framework adapters with customer-style reference implementations.
- Percentage of supported meta-framework modalities covered by reference implementations.
- E2E pass rate by reference implementation and platform.
- Number of shared preview scenarios covered across supported runtimes.
- Number of documented SDK gaps discovered through reference implementations.
- Support-ticket volume for SDK selection, consent, locale handling, entry resolution, preview, and
  analytics forwarding.

## Dependencies and constraints

- Experience API and Insights API behavior remain upstream dependencies for profile evaluation,
  selected optimizations, changes, and event ingestion.
- Applications remain responsible for Contentful CDA fetching, include depth, routing, rendering,
  identity policy, consent policy, and third-party destination policy.
- Framework adapter SDKs must reuse runtime SDKs and Core behavior rather than diverging into
  independent implementations.
- Native SDKs must keep bridge behavior aligned with shared Core semantics.
- Reference implementations must stay small and example-oriented. They must not become reusable
  application frameworks or hidden SDK layers.
- Shared mocks, fixtures, and scenario contracts are internal validation dependencies for reference
  implementations.
- Documentation that describes public SDK status must align with this fPRD. If package docs describe
  native SDKs as non-public or implementation-only, that discrepancy requires a separate
  documentation update.
