---
sdk: nextjs-pages-router
archetype: integration
kb: ../../internal/sdk-knowledge/web/nextjs-pages-router.md
guide: ../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md
---

# Next.js Pages Router guide blueprint

## Quick-start contract

- **Outcome:** One entry renders its personalized variant in server HTML and hydrates without a
  baseline flash.
- **Verification:** Target all visitors, find variant text in View Source, and confirm it remains
  after hydration.
- **Reader shape:** A Pages Router page whose `getServerSideProps` fetches entries and passes them to
  app-owned components.
- **Required artifacts:** Package install; browser factory; server helper; `_app.tsx` diff;
  `getServerSideProps` diff; entry-renderer diff; verification.
- **Deliberate simplifications:** Consent is granted for the first proof.
- **Explainer switches:** profile point = omit; managed-fetch clause = include.
- **Fact sources:** [setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#setup--factory),
  [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution),
  [fallback](../../internal/sdk-knowledge/web/nextjs-pages-router.md#failure--fallback-behavior).

## Milestone contract

- **Milestone 1:** Server-resolved first paint and matching hydration.
- **Milestone 2:** Opt-in browser re-personalization after hydration.
- **Boundary:** Serialized server state versus live browser-owned state.
- **Fact sources:** [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks).

## Section map

| Section                                                     | Category                       | Purpose                                                                  | Required evidence                                                                      | Fact sources                                                                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How the SDK fits your app                                   | Required for first integration | Establish the explicit browser/server module split.                      | Import-path table; two factory modules; bridge from quick start.                       | [package and setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#package--entry-points)                                                                                   |
| Fetching Contentful entries                                 | Required for first integration | Establish manual and managed server entry sources.                       | Both paths; locale/include rules; client ownership.                                    | [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution)                                                                                        |
| The getServerSideProps state handoff and the profile cookie | Required for first integration | Teach how server decisions reach `_app.tsx`.                             | Complete props merge; failure handling; cookie ownership; explicit no-middleware note. | [setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#setup--factory), [identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership)         |
| The bound root and page events                              | Required for first integration | Apply serialized state before children and assign first-event ownership. | `_app.tsx` example; tracker example; emit-versus-skip explanation.                     | [components](../../internal/sdk-knowledge/web/nextjs-pages-router.md#components--hooks), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)          |
| Personalizing entries                                       | Required for first integration | Complete Milestone 1 at the renderer boundary.                           | Render-prop diff; cast/fallback; nested-wrap warning; managed-prefetch shape.          | [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution)                                                                                        |
| Browser takeover and live updates                           | Common but policy-dependent    | Implement Milestone 2 when mounted content must change.                  | App-wide and per-entry controls; identity/reset example.                               | [components](../../internal/sdk-knowledge/web/nextjs-pages-router.md#components--hooks)                                                                                              |
| Entry interaction tracking                                  | Common but policy-dependent    | Explain default browser interactions and consent.                        | Defaults; opt-outs; resolved-entry metadata.                                           | [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)                                                                                                   |
| Consent, identity, profile, and reset                       | Common but policy-dependent    | Replace the quick-start shortcut across server and browser.              | App-owned cookie example; server callback; browser actions.                            | [consent](../../internal/sdk-knowledge/web/nextjs-pages-router.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership) |
| Analytics forwarding                                        | Optional                       | Hand off to the supplemental workflow.                                   | Early subscription seam; duplicate-forwarding warning; link.                           | [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)                                                                                                   |
| Merge tags and Custom Flags                                 | Optional                       | Cover content-model-dependent reads.                                     | Guard/resolver and flag examples.                                                      | [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution)                                                                                        |
| Preview panel                                               | Optional                       | Add environment-gated authoring tooling.                                 | Separate package; readiness attach; reader-owned gate.                                 | [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks)                                                                                           |
| Mixed route strategies                                      | Advanced or production-only    | Help mature apps choose ownership by route.                              | Strategy decision table.                                                               | [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks)                                                                                           |
| Manual server and client escape hatches                     | Advanced or production-only    | Expose lower-level APIs after the bound path.                            | Server/client API map and ownership boundary.                                          | [package and setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#package--entry-points)                                                                                   |
| Caching and request policy                                  | Advanced or production-only    | Keep personalized state and HTML out of shared caches.                   | Cache-safety table and request failure policy.                                         | [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks)                                                                                           |
| Strict consent and duplicate-event controls                 | Advanced or production-only    | Make production event posture explicit.                                  | Empty allow-list; blocked diagnostics; first-event check.                              | [consent](../../internal/sdk-knowledge/web/nextjs-pages-router.md#consent--persistence), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)          |

## SDK-specific authoring overrides

- State plainly that Pages Router server work happens in `getServerSideProps`, not middleware or a
  proxy. Facts: [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks).
- Treat the props merge and Experience API failure path as required evidence, not incidental notes.
  Facts: [setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#setup--factory).

## Troubleshooting scope

| Reader symptom                                            | Why it belongs                                    | Fact sources                                                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every entry stays on baseline                             | Common missing-props or payload symptom.          | [fallback](../../internal/sdk-knowledge/web/nextjs-pages-router.md#failure--fallback-behavior)                                                                                          |
| Page returns 500 instead of baseline                      | Server helper failure must be handled by the app. | [fallback](../../internal/sdk-knowledge/web/nextjs-pages-router.md#failure--fallback-behavior)                                                                                          |
| Entry type error or missing/duplicate first page event    | Common renderer and handoff mistakes.             | [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)       |
| Live content, profile continuity, or cached HTML is wrong | Covers the defining runtime boundaries.           | [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks), [identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership) |

## Link roles

- [The sibling Next.js App Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained Pages Router reference implementation](../../../implementations/nextjs-sdk_pages-router/README.md).
- [The maintained App Router reference implementation for comparison](../../../implementations/nextjs-sdk_app-router/README.md).
