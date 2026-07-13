---
sdk: react-web
archetype: integration
kb: ../../internal/sdk-knowledge/web/react-web.md
guide: ../../guides/integrating-the-react-web-sdk-in-a-react-app.md
---

# React Web guide blueprint

## Quick-start contract

- **Outcome:** One entry moves through loading to a personalized variant or safe baseline in the
  browser.
- **Verification:** Target all visitors, load the app, and observe the resolved variant after the
  loading state.
- **Reader shape:** A client-rendered React app that fetches an entry and renders it through an
  app-owned component.
- **Required artifacts:** Package install; root-provider diff; entry fetch; entry-renderer diff;
  loading/error handling; verification.
- **Deliberate simplifications:** Consent starts granted; real policy is deferred.
- **Explainer switches:** profile point = omit; managed-fetch clause = include.
- **Fact sources:** [setup](../../internal/sdk-knowledge/web/react-web.md#setup--factory),
  [rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution),
  [fallback](../../internal/sdk-knowledge/web/react-web.md#failure--fallback-behavior).

## Milestone contract

- **Milestone 1:** Personalized first client render after SDK readiness.
- **Milestone 2:** Opt-in live re-personalization after state changes.
- **Boundary:** First resolution pass versus re-resolution of mounted content.
- **Fact sources:** [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks).

## Section map

| Section                                        | Category                       | Purpose                                                   | Required evidence                                                                | Fact sources                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How the SDK fits your app                      | Required for first integration | Establish the single root and provider composition.       | Root diff; config ownership; one-mount rule.                                     | [setup](../../internal/sdk-knowledge/web/react-web.md#setup--factory)                                                                                                  |
| SDK readiness, loading, and error states       | Required for first integration | Make the asynchronous browser lifecycle explicit.         | Readiness timeline; loading/error UI; baseline-reveal behavior.                  | [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks), [fallback](../../internal/sdk-knowledge/web/react-web.md#failure--fallback-behavior) |
| Fetching Contentful entries                    | Required for first integration | Explain manual and managed entry sources.                 | Both paths; client ownership; locale/include requirements.                       | [rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution)                                                                                    |
| Resolving entries and rendering the result     | Required for first integration | Complete Milestone 1 at the component boundary.           | Render-prop diff and definition; cast; host-element/double-wrap rules; fallback. | [rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution)                                                                                    |
| Page events and route tracking                 | Required for first integration | Keep route-based evaluation current.                      | Router tracker example; first-route behavior; one-tracker rule.                  | [events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                                                                               |
| Consent and privacy handoff                    | Common but policy-dependent    | Replace the quick-start shortcut.                         | Two-axis consent example; pre-consent admission; app-owned record.               | [consent](../../internal/sdk-knowledge/web/react-web.md#consent--persistence)                                                                                          |
| Entry interaction tracking                     | Common but policy-dependent    | Explain component-owned view/click/hover instrumentation. | Defaults and opt-outs; consent relationship.                                     | [events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                                                                               |
| Identity, profile, and reset                   | Common but policy-dependent    | Integrate authentication lifecycle.                       | Identify/reset example and consent persistence distinction.                      | [consent](../../internal/sdk-knowledge/web/react-web.md#consent--persistence)                                                                                          |
| Live updates                                   | Optional                       | Implement Milestone 2 without implying it is default.     | Root and per-entry scopes; state-change example.                                 | [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks)                                                                                       |
| Merge tags and Custom Flags                    | Optional                       | Cover content-model-dependent reads.                      | Hook/render helper examples and event behavior.                                  | [rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution)                                                                                    |
| Analytics forwarding                           | Optional                       | Hand off to the supplemental workflow.                    | Early subscription seam and message dedupe; guide link.                          | [events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                                                                               |
| Preview panel                                  | Optional                       | Add environment-gated authoring tooling.                  | Separate-package dynamic attach and readiness seam.                              | [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks)                                                                                       |
| Owning the Web SDK instance                    | Advanced or production-only    | Explain explicit provider composition and SSR handoff.    | Injected instance; provider stack; managed-entry prefetch handoff.               | [components](../../internal/sdk-knowledge/web/react-web.md#components--hooks), [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks)        |
| Strict consent, storage, and delivery controls | Advanced or production-only    | Expose production posture.                                | Empty allow-list; storage/queue settings; blocked diagnostics.                   | [consent](../../internal/sdk-knowledge/web/react-web.md#consent--persistence)                                                                                          |

## SDK-specific authoring overrides

- Keep readiness/loading/error separate from fetching and rendering; collapsing them hides the main
  client-only lifecycle constraint. Facts:
  [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks).

## Troubleshooting scope

| Reader symptom                                          | Why it belongs                                                         | Fact sources                                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry stays on baseline, loading, or error fallback     | Distinguishes three common states.                                     | [fallback](../../internal/sdk-knowledge/web/react-web.md#failure--fallback-behavior)                                                                       |
| Render-prop type error or wrapped entry renders nothing | Common component-boundary mistakes.                                    | [rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution)                                                                        |
| Hook is outside provider or SDK initializes twice       | Common provider-tree mistakes.                                         | [setup](../../internal/sdk-knowledge/web/react-web.md#setup--factory)                                                                                      |
| Page/interaction events or live updates are missing     | Makes tracker, consent, metadata, and opt-in live behavior actionable. | [events](../../internal/sdk-knowledge/web/react-web.md#events--tracking), [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks) |
| Preview panel does not attach                           | Common readiness/package boundary.                                     | [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks)                                                                           |

## Link roles

- Integration guides for [Next.js App Router](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md),
  [Next.js Pages Router](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md),
  and [the Web SDK](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- Maintained references for [React Web](../../../implementations/react-web-sdk/README.md) and
  [the custom React adapter](../../../implementations/web-sdk_react/README.md).
