---
title: Framework and meta-framework reference implementation requirements
---

# Framework and meta-framework reference implementation requirements

> [!NOTE]
>
> This product document defines target-state requirements for reference implementations that
> demonstrate framework adapter SDKs and meta-framework SDK composition patterns in the Optimization
> SDK Suite. Package README files, integration guides, and generated reference docs remain the
> source of truth for implemented API names, signatures, and setup commands.

## Summary

Reference implementations are executable examples and validation harnesses for supported
Optimization SDK integration patterns. They show SDK maintainers and application engineers how
public SDK APIs fit into realistic framework and meta-framework applications.

Each reference implementation must demonstrate the intended application workflow, exercise the
relevant SDK surface against shared mocks and fixtures, and provide automated E2E coverage for the
practical happy paths exposed by the demonstrated SDKs.

The product goal is to keep framework SDKs and meta-framework patterns usable, documented, and
validated across personalization, tracking, consent, locale handling, preview, offline behavior,
analytics handoff, SSR, hydration, and runtime composition boundaries.

## Scope

This document applies to reference implementations for:

- Framework adapter SDKs.
- Runtime SDKs when a framework-facing example is the primary integration path.
- Meta-framework patterns that compose runtime SDKs and framework SDKs without a dedicated adapter
  package.
- Distinct rendering or routing modalities such as CSR, SSR, SSR plus CSR takeover, prerendering,
  edge rendering, middleware routing, and hybrid server/browser flows.
- Multi-shell platform references where one SDK supports multiple UI surfaces, such as native UI
  frameworks.

Reference implementations must be maintained as product surface for the SDK Suite. They are not
throwaway demos.

## Non-goals

- A reference implementation is not a reusable SDK layer, application framework, starter template,
  design system, or production application.
- A reference implementation does not hide missing SDK behavior behind local abstractions or casts.
- A reference implementation does not own customer content models, legal consent decisions, content
  governance, deployment architecture, or third-party analytics destination policy.
- A reference implementation does not require live Contentful services for normal local validation
  when the repository provides shared mocks and fixtures.
- A reference implementation does not substitute README assertions for executable coverage when the
  behavior can be tested locally.

## Users and jobs

| User                 | Job                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| SDK maintainer       | Validate public SDK behavior in an application context before release.                                       |
| Framework maintainer | Confirm that the framework adapter follows framework conventions and runtime boundaries.                     |
| Application engineer | Copy integration patterns, responsibility boundaries, and validation approaches into a customer application. |
| Content author       | Preview audience and variant behavior in an application-like runtime.                                        |
| Analytics engineer   | Verify Optimization events and context handoff without relying on private SDK internals.                     |

## Reference implementation types

| Type                                | Purpose                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Framework SDK reference             | Demonstrates the primary path for a framework adapter SDK package.                                                 |
| Runtime SDK reference               | Demonstrates the primary path for a runtime SDK when no framework adapter is involved.                             |
| Meta-framework pattern reference    | Demonstrates SDK composition in an application framework that does not require a dedicated SDK package.            |
| Modality-specific reference         | Demonstrates one rendering or routing modality when combining modalities makes validation unclear.                 |
| Multi-shell platform reference      | Demonstrates parity across UI shells that share one SDK, such as native UI frameworks or comparable platform APIs. |
| Cross-runtime composition reference | Demonstrates server/browser or runtime/runtime cooperation, such as request-to-browser profile continuity.         |

## Design principles

- **Public SDK surface only** - Reference implementations must use public package APIs.
- **Small but complete** - Each app must stay focused while still exercising the primary workflow.
- **Scenario-driven validation** - E2E tests must prove observable user and SDK outcomes, not only
  render pages.
- **Shared fixtures** - Tests must use stable mock Experience API, Insights API, and Contentful
  fixture data.
- **Application responsibility clarity** - Examples must show what the SDK owns and what application
  code owns.
- **Parity where it matters** - Comparable SDKs and UI shells must use aligned scenarios,
  identifiers, fixtures, and expectations.

## Selection requirements

- **REFREQ-1 SDK coverage** - Each public framework adapter SDK must have at least one reference
  implementation that demonstrates its primary integration path.
- **REFREQ-2 Runtime coverage** - Each public runtime SDK must have at least one reference
  implementation that demonstrates initialization, consent, personalization, tracking, locale
  handling, diagnostics, and preview where the runtime supports those behaviors.
- **REFREQ-3 Meta-framework coverage** - Each supported meta-framework pattern must have a reference
  implementation when the pattern involves distinct server/browser, routing, rendering, caching, or
  hydration decisions.
- **REFREQ-4 Modality separation** - CSR, SSR, SSR plus CSR takeover, prerendering, edge,
  middleware, and hybrid modalities must have separate reference implementations when combining them
  reduces clarity or testability.
- **REFREQ-5 Multi-shell parity** - SDKs that support multiple UI shells must demonstrate each
  public shell and validate comparable flows against the same scenario contract.
- **REFREQ-6 Reference ownership** - Each reference implementation must have a documented owning SDK
  or pattern and a clear statement of what it validates.

## Application design requirements

- **REFREQ-7 Customer-style structure** - The app must use normal framework application structure:
  routes, screens, providers, modules, middleware, controllers, components, or views as appropriate.
- **REFREQ-8 Minimal domain surface** - The app must include enough content, navigation, controls,
  and state display to validate SDK behavior without becoming a broad sample product.
- **REFREQ-9 App-owned content fetching** - The app must fetch Contentful entries in application
  code and pass single-locale CDA entries to SDK resolution helpers.
- **REFREQ-10 App-owned consent controls** - The app must include explicit consent controls when the
  demonstrated flow depends on user consent.
- **REFREQ-11 App-owned identity controls** - The app must include identify and reset controls when
  profile transitions are part of the SDK behavior being demonstrated.
- **REFREQ-12 Real routing or navigation** - The app must use the framework's routing or navigation
  system when testing page, screen, request, middleware, or navigation tracking.
- **REFREQ-13 Stable test identifiers** - The app must expose stable automation identifiers for
  meaningful user controls and rendered SDK outcomes.
- **REFREQ-14 Observable SDK outcomes** - The app must make events, rendered variants, profile
  readiness, consent state, preview state, or analytics handoff observable in ways that E2E tests
  can assert.
- **REFREQ-15 No reusable behavior in apps** - Shared SDK behavior must stay in packages. Reference
  app helpers can organize app code but must not become hidden adapter layers.
- **REFREQ-16 Deterministic setup** - The app must run against deterministic mocks and fixtures for
  normal local and CI validation.

## SDK usage requirements

- **REFREQ-17 Public APIs only** - The app must import and call public package APIs, public subpath
  exports, and documented runtime setup paths.
- **REFREQ-18 No private internals** - The app must not import package internals, generated build
  outputs, private symbols, or test-only package utilities.
- **REFREQ-19 Local package consumption** - The app must consume locally built package artifacts
  through the repository's implementation install flow.
- **REFREQ-20 No local shims for missing API** - The app must not add local shims, casts, or adapter
  logic to mask a missing public SDK capability.
- **REFREQ-21 Runtime boundary discipline** - Server files must import server-compatible packages.
  Browser files must import browser-compatible packages. Shared files must avoid side effects that
  violate either runtime.
- **REFREQ-22 Framework-native APIs** - The app must use the demonstrated SDK's framework-native
  providers, hooks, composables, stores, middleware, modules, wrappers, or services instead of
  bypassing them for equivalent lower-level runtime calls.
- **REFREQ-23 Preview through public surface** - Preview tooling must be mounted through the
  platform's public preview setup path.

## Feature coverage requirements

Each reference implementation must cover the features exposed by the SDKs it demonstrates. When a
runtime cannot support a feature, the README must define the unsupported scope as part of the
pattern.

| Feature area               | Required coverage                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Initialization             | SDK setup, readiness, teardown, duplicate prevention, and framework lifecycle integration.                           |
| Consent                    | Accepted, denied, and split event/persistence consent when supported.                                                |
| Profile continuity         | Anonymous or identified profile continuity through runtime-appropriate storage or request state.                     |
| Personalization            | Baseline rendering, identified variants, unidentified variants, fallback behavior, and nested entries where present. |
| Entry resolution           | Optimized rendering primitive and manual entry-resolution helper when both are public.                               |
| Merge tags                 | Resolved merge-tag values in rendered content when the SDK supports merge tags.                                      |
| Custom Flags               | Flag reads and flag-view event emission when the SDK supports Custom Flags.                                          |
| Locale handling            | Resolved Contentful locale applied to app-owned CDA fetches and Experience API calls as appropriate.                 |
| Page/request/screen events | Router, request, middleware, page, or screen event flows supported by the target framework.                          |
| Interaction tracking       | View, click, tap-equivalent, hover, and per-entry overrides for interactions the runtime can observe.                |
| Live updates               | Default locked behavior, global opt-in, per-entry opt-in or opt-out, and preview-forced live updates.                |
| Preview                    | Panel mounting, open/close behavior, audience overrides, variant overrides, reset, refresh, and remount semantics.   |
| Offline behavior           | Queueing and recovery for runtimes with offline support.                                                             |
| Analytics handoff          | Event stream or request-local context handoff without sending to third-party destinations.                           |
| Diagnostics                | Blocked events, event logs, profile readiness, consent state, and reset behavior where supported.                    |
| Error resilience           | Baseline fallback, mock API failures where practical, and stable UI after recoverable SDK errors.                    |

## Framework SDK reference requirements

- **REFREQ-24 Framework setup** - The app must use the framework adapter SDK's primary setup
  primitive in the same place a customer application uses it.
- **REFREQ-25 State access** - The app must demonstrate framework-native state access and direct SDK
  access.
- **REFREQ-26 Optimized rendering** - The app must render personalized entries through the adapter's
  optimized rendering primitive.
- **REFREQ-27 Manual resolution** - The app must include a manual resolution path when the adapter
  exposes one.
- **REFREQ-28 Router integration** - Client framework references must exercise the adapter's router
  integration across at least two routes and a revisit.
- **REFREQ-29 Interaction tracking configuration** - UI framework references must exercise global
  and per-entry interaction tracking configuration.
- **REFREQ-30 Live update matrix** - UI framework references must exercise default locked, global
  live, per-entry live, per-entry locked, and preview-forced live behavior where supported.
- **REFREQ-31 Provider-managed analytics handoff** - The app must attach app-level event subscribers
  through the adapter's framework-native setup point before child components can emit events.

## Server framework reference requirements

- **REFREQ-32 Request binding** - Server framework references must bind consent, profile, locale,
  event context, and Experience API options per request.
- **REFREQ-33 Middleware or route integration** - The app must demonstrate the framework's intended
  middleware, route, controller, handler, or dependency-injection integration path.
- **REFREQ-34 Stateless behavior** - Server references must demonstrate that request-specific
  profile and consent data stay request-local.
- **REFREQ-35 Server-rendered personalization** - SSR references must resolve entries on the server
  and render the selected variant in the HTML response when consent and profile state permit it.
- **REFREQ-36 Request-local analytics handoff** - The app must make request-local Optimization data
  available for application-owned analytics enrichment.
- **REFREQ-37 Cache boundaries** - The README must explain which server outputs can be cached and
  which values are request-local.

## Meta-framework pattern requirements

- **REFREQ-38 Composition contract** - Meta-framework references must identify which runtime SDKs
  and framework SDKs are composed and which application boundary owns each part of the flow.
- **REFREQ-39 Server/browser separation** - Server files must use server-compatible SDKs and browser
  files must use browser-compatible SDKs. The app must keep imports isolated by runtime.
- **REFREQ-40 First paint behavior** - SSR or hybrid references must define and validate what the
  user sees on first paint with and without consent.
- **REFREQ-41 Hydration behavior** - Hybrid references must define and validate how SDK state,
  rendered content, page events, interaction tracking, and browser readiness behave after hydration.
- **REFREQ-42 Client-side navigation** - CSR or hybrid references must validate client-side
  navigation, route event emission, and entry resolution for supported route transitions.
- **REFREQ-43 Full navigation behavior** - SSR or hybrid references must validate browser refresh or
  full-navigation behavior when server resolution is part of the pattern.
- **REFREQ-44 Identity bridge** - Server/browser references must validate anonymous ID or profile ID
  continuity through the application's supported cookie, session, header, or storage mechanism.
- **REFREQ-45 Prerendering constraints** - Prerendering references must document which
  personalization decisions are allowed before request-time profile data exists and how browser
  follow-up tracking behaves.
- **REFREQ-46 Edge and middleware constraints** - Edge or middleware references must document
  runtime API limits, fetch behavior, cookie behavior, and SDK import boundaries.
- **REFREQ-47 Hydration data seeding** - When a pattern seeds browser SDK state from server-resolved
  data, the app must validate that duplicate Experience API calls and hydration mismatches are
  avoided.

## Preview requirements

- **REFREQ-48 Preview setup** - Preview-capable references must mount the first-party preview
  surface through public SDK APIs.
- **REFREQ-49 Preview data** - Preview-capable references must provide Contentful audience and
  experience definitions through mock-backed fixture data.
- **REFREQ-50 Preview scenario contract** - Preview-capable references must validate audience
  activation, audience deactivation, audience reset, variant override, variant reset, reset all,
  refresh, and remount behavior when the platform can automate the scenario.
- **REFREQ-51 Preview-forced rendering** - Preview tests must prove that preview state forces live
  re-resolution for optimized rendering surfaces.
- **REFREQ-52 Preview production gating** - The app must demonstrate the supported build or runtime
  gate for excluding preview tooling from production exposure.
- **REFREQ-53 Preview automation identifiers** - Preview controls must expose stable identifiers or
  labels for E2E automation when the platform supports them.

## E2E validation requirements

- **REFREQ-54 E2E runner** - Each reference implementation must define the appropriate E2E runner
  for its platform, such as Playwright, Detox, XCUITest, Maestro, or a framework-specific runner.
- **REFREQ-55 Mock-backed execution** - E2E tests must run against shared mock Experience API,
  Insights API, and Contentful fixture data.
- **REFREQ-56 Scenario matrix** - Each reference implementation must maintain a scenario matrix that
  maps demonstrated SDK features to automated E2E coverage.
- **REFREQ-57 Happy-path coverage** - E2E must cover the practical happy path for every supported
  SDK feature demonstrated by the app.
- **REFREQ-58 Negative consent coverage** - E2E must verify that consent-gated events do not emit
  before consent when the demonstrated runtime exposes consent-gated events.
- **REFREQ-59 Event assertions** - E2E must assert emitted event type, component or route identity,
  profile readiness, or queue behavior through observable app state or mock API effects.
- **REFREQ-60 Render assertions** - E2E must assert rendered baseline and variant content by stable
  rendered output, not only by internal SDK state.
- **REFREQ-61 Deterministic offline testing** - Offline-capable references must drive SDK offline
  and online state deterministically and assert queued events or profile updates after recovery.
- **REFREQ-62 Cross-shell parity** - Multi-shell references must run the same scenario set against
  each shell with aligned identifiers and expectations.
- **REFREQ-63 Targeted execution** - The README must document how to run the full E2E suite and how
  to run a single scenario file, class, suite, or flow.
- **REFREQ-64 No generic-test substitution** - Generic unit or smoke tests must not substitute for
  E2E when the behavior depends on framework routing, rendering, event delivery, native lifecycle,
  preview UI, or offline transitions.

## Mock and fixture requirements

- **REFREQ-65 Shared mock APIs** - Reference implementations must use repository-standard mock
  Experience API and Insights API services for local and CI validation.
- **REFREQ-66 Stable Contentful fixtures** - Apps must use stable Contentful fixture entries for
  baselines, variants, merge tags, nested optimizations, Custom Flags, audiences, and experiences.
- **REFREQ-67 Profile personas** - Fixtures must include profile personas for unidentified,
  identified, consented, audience-qualified, and audience-unqualified paths required by the scenario
  matrix.
- **REFREQ-68 Event capture** - Tests must be able to observe Analytics and Personalization events
  without relying on external network services.
- **REFREQ-69 Locale fixtures** - Locale-sensitive references must include enough fixture data to
  verify the resolved Contentful locale and Experience API locale relationship.
- **REFREQ-70 Fixture documentation** - README or supporting docs must identify the fixture
  personas, important entry IDs, and scenario contracts needed to maintain the tests.

## README and runbook requirements

- **REFREQ-71 README role** - Each reference implementation README must explain what the app
  demonstrates, which SDK packages it validates, and which application pattern it represents.
- **REFREQ-72 Setup** - The README must provide setup commands from the monorepo root and document
  environment variables using `.env.example`.
- **REFREQ-73 Running locally** - The README must explain how to start the app and required mock
  services locally.
- **REFREQ-74 Running E2E** - The README must explain full and targeted E2E commands.
- **REFREQ-75 Architecture** - Framework and meta-framework references must explain the
  responsibility split between server, browser, framework, SDK, content fetching, routing, consent,
  identity, and rendering.
- **REFREQ-76 Locale handling** - The README must explain how the app uses the resolved Contentful
  locale for CDA fetches and how it avoids all-locale CDA payloads in SDK resolution paths.
- **REFREQ-77 Validation matrix** - The README or adjacent test documentation must map feature areas
  to validation commands and E2E scenario files.
- **REFREQ-78 Unsupported scope** - The README must define unsupported framework modes or SDK
  behaviors for the pattern, such as unsupported routing modes, unsupported rendering modalities, or
  unsupported preview surfaces.
- **REFREQ-79 Related docs** - The README must link to the demonstrated package README files,
  relevant integration guides, concepts, preview scenario contracts, and generated reference docs.

## Acceptance checklist

Use this checklist when adding or evaluating a framework or meta-framework reference implementation.

- [ ] The implementation has a clear SDK or pattern owner and belongs in the correct
      `implementations/` subtree.
- [ ] The app uses public SDK APIs and does not import package internals or generated outputs.
- [ ] The app demonstrates a realistic framework setup path rather than a synthetic test harness
      alone.
- [ ] App-owned Contentful fetching uses the resolved Contentful locale and single-locale CDA entry
      payloads.
- [ ] Consent, identify, reset, and profile-continuity flows are observable and testable when the
      SDK supports them.
- [ ] Optimized rendering, manual resolution, merge tags, Custom Flags, and fallback rendering are
      demonstrated where exposed by the SDK.
- [ ] Page, request, screen, route, interaction, tap-equivalent, hover, view, click, and flag-view
      events are covered according to runtime capability.
- [ ] Live update behavior covers default locked, global live, per-entry live, per-entry locked, and
      preview-forced live modes where supported.
- [ ] Preview-capable apps validate panel mounting, overrides, reset, refresh, and remount
      semantics.
- [ ] Offline-capable apps validate queueing and recovery through deterministic SDK online/offline
      controls or platform-appropriate local runners.
- [ ] Meta-framework apps validate first paint, hydration, client navigation, full navigation,
      server/browser identity continuity, and import boundaries.
- [ ] The scenario matrix maps every demonstrated SDK feature to automated E2E coverage or to an
      explicitly unsupported scope.
- [ ] E2E tests assert rendered content, event output, profile state, consent behavior, queue
      behavior, or mock API effects.
- [ ] Multi-shell apps run aligned scenario sets against every supported shell.
- [ ] README setup, local run, E2E, architecture, locale, validation matrix, and related-doc links
      are complete.
- [ ] Typecheck, lint, build, implementation install, mock startup, and targeted E2E commands are
      documented and pass through repository-standard scripts.
