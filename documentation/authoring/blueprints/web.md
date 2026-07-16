---
sdk: web
archetype: integration
kb: ../../internal/sdk-knowledge/web/web.md
guide: ../../guides/integrating-the-web-sdk-in-a-web-app.md
---

# Web guide blueprint

## Quick-start contract

- **Outcome:** One fetched entry resolves and renders as a personalized variant or safe baseline.
- **Verification:** Target all visitors, load the page, and inspect the rendered entry text.
- **Reader shape:** Browser code that fetches an entry and writes its fields into the DOM.
- **Required artifacts:** Package install; environment/config values; one complete create-emit-fetch-
  resolve-render example; the verification step.
- **Deliberate simplifications:** Consent starts granted; production gating is deferred.
- **Explainer switches:** profile point = omit; managed-fetch clause = include.
- **Fact sources:** [setup](../../internal/sdk-knowledge/web/web.md#setup--initialization-and-binding),
  [rendering](../../internal/sdk-knowledge/web/web.md#render--entry-resolution),
  [fallback](../../internal/sdk-knowledge/web/web.md#failure--fallback-behavior).

## Milestone contract

- **Milestone 1:** First resolve-and-paint.
- **Milestone 2:** Re-resolve after SDK state changes without a reload.
- **Boundary:** Initial render versus ongoing imperative render lifecycle.
- **Fact sources:** [runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks).

## Section map

| Section                                               | Category                       | Purpose                                                     | Must teach or show                                                           | Fact sources                                                                       |
| ----------------------------------------------------- | ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| How the SDK fits your app                             | Required for first integration | Establish the single stateful browser instance.             | Complete reusable singleton; config ownership; duplicate-instance warning.   | [setup](../../internal/sdk-knowledge/web/web.md#setup--initialization-and-binding) |
| The SDK lifecycle: create, emit, resolve              | Required for first integration | Teach the ordering that prevents silent baseline output.    | Lifecycle diagram or ordered example; accepted-event checkpoint.             | [runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks)         |
| Fetching Contentful entries                           | Required for first integration | Explain manual and managed entry sources.                   | Both paths; locale/include requirements; client ownership.                   | [rendering](../../internal/sdk-knowledge/web/web.md#render--entry-resolution)      |
| Resolving entries and rendering the result            | Required for first integration | Complete Milestone 1.                                       | Resolve/render example; result fields; baseline ID distinction and fallback. | [rendering](../../internal/sdk-knowledge/web/web.md#render--entry-resolution)      |
| Page and route events                                 | Required for first integration | Maintain selections across initial load and SPA navigation. | Initial page example; stable route-key dedupe; hybrid skip note.             | [events](../../internal/sdk-knowledge/web/web.md#events--tracking)                 |
| Consent and privacy handoff                           | Common but policy-dependent    | Replace the quick-start consent shortcut.                   | Consent state transitions; app-owned record; denied behavior.                | [consent](../../internal/sdk-knowledge/web/web.md#consent--persistence)            |
| State subscriptions, locale changes, and re-rendering | Common but policy-dependent    | Implement Milestone 2 for an imperative runtime.            | Subscription cleanup; re-resolve trigger; locale ownership.                  | [runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks)         |
| Entry interaction tracking                            | Common but policy-dependent    | Explain browser view/click/hover instrumentation.           | Defaults; opt-outs; clickable-path override.                                 | [events](../../internal/sdk-knowledge/web/web.md#events--tracking)                 |
| Identity, profile, and reset                          | Common but policy-dependent    | Integrate login and logout with browser state.              | Identify/reset example and consent distinction.                              | [consent](../../internal/sdk-knowledge/web/web.md#consent--persistence)            |
| Web Components entry rendering                        | Optional                       | Offer the declarative alternative to the class API.         | Registration and element example; manual-versus-managed inputs.              | [components](../../internal/sdk-knowledge/web/web.md#components--hooks)            |
| Merge tags and Custom Flags                           | Optional                       | Cover content-model-dependent reads.                        | Merge-tag and flag examples with event behavior.                             | [rendering](../../internal/sdk-knowledge/web/web.md#render--entry-resolution)      |
| Analytics forwarding                                  | Optional                       | Hand off to the supplemental workflow.                      | Subscription seam and supplemental-guide link.                               | [events](../../internal/sdk-knowledge/web/web.md#events--tracking)                 |
| Preview panel                                         | Optional                       | Add environment-gated authoring tooling.                    | Separate package; attach example; required input.                            | [runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks)         |
| Hybrid Node SSR and browser continuity                | Advanced or production-only    | Preserve profile and event ownership across runtimes.       | Cookie and first-event contract; reference link.                             | [identifiers](../../internal/sdk-knowledge/web/web.md#identifier-ownership)        |
| Strict consent, storage, and delivery controls        | Advanced or production-only    | Expose production privacy and delivery posture.             | Empty allow-list; storage/queue settings; blocked diagnostics.               | [consent](../../internal/sdk-knowledge/web/web.md#consent--persistence)            |

## SDK-specific authoring overrides

- Teach lifecycle ordering as its own Core section; it is the imperative SDK's defining integration
  constraint. Facts: [runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks).

## Troubleshooting scope

| Reader symptom                                        | Why it belongs                                          | Fact sources                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry remains on baseline                             | Most common first-run symptom.                          | [fallback](../../internal/sdk-knowledge/web/web.md#failure--fallback-behavior)                                                                  |
| SDK initializes twice                                 | Common SPA singleton mistake.                           | [setup](../../internal/sdk-knowledge/web/web.md#setup--initialization-and-binding)                                                              |
| SPA page or interaction events are missing/duplicated | Makes route keys, consent, and DOM metadata actionable. | [events](../../internal/sdk-knowledge/web/web.md#events--tracking)                                                                              |
| Custom Flag or hybrid profile behavior is unexpected  | Covers dedupe and cross-runtime identity.               | [events](../../internal/sdk-knowledge/web/web.md#events--tracking), [identifiers](../../internal/sdk-knowledge/web/web.md#identifier-ownership) |

## Link roles

- Integration guides for [React Web](../../guides/integrating-the-react-web-sdk-in-a-react-app.md),
  [Next.js App Router](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md),
  and [Next.js Pages Router](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- Maintained references for [Vanilla Web](../../../implementations/web-sdk/README.md),
  [the custom React adapter](../../../implementations/web-sdk_react/README.md),
  [Angular](../../../implementations/web-sdk_angular/README.md), and
  [Node plus Web](../../../implementations/node-sdk+web-sdk/README.md).
