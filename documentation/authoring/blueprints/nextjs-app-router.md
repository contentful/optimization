---
sdk: nextjs-app-router
archetype: integration
kb: ../../internal/sdk-knowledge/web/nextjs-app-router.md
guide: ../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md
---

# Next.js App Router guide blueprint

## Quick-start contract

- **Outcome:** One Contentful entry renders its personalized variant in the raw server HTML and
  remains stable after hydration.
- **Verification:** Target all visitors, use View Source to find distinctive variant text, and
  confirm the same text remains after hydration.
- **Reader shape:** An App Router application that already fetches a page and hands its entries to
  app-owned components.
- **Required artifacts:** Package install; environment values; one bound factory module; the
  version-appropriate request handler; a root-layout diff; an entry-renderer diff; the verification
  step; the one-locale/include-depth fetch constraint. The quick start must contain runnable or
  adaptable code for every artifact.
- **Deliberate simplifications:** Consent is granted on server and browser only for the first proof;
  the guide must point to the production consent section.
- **Explainer switches:** profile point = omit; managed-fetch clause = include.
- **Fact sources:** [setup and factory](../../internal/sdk-knowledge/web/nextjs-app-router.md#setup--factory),
  [components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks),
  [identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership),
  [events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking),
  [rendering](../../internal/sdk-knowledge/web/nextjs-app-router.md#render--entry-resolution),
  [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks),
  [entry-source boundary](../../internal/sdk-knowledge/shared/concepts.md#entry-source-boundary-managed-or-manual),
  [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution),
  [fallback](../../internal/sdk-knowledge/shared/concepts.md#baseline-fallback).

## Milestone contract

- **Milestone 1:** Personalized first paint from one server render; independently useful without
  post-load re-personalization.
- **Milestone 2:** Browser takeover and live updates after consent, identity, or profile changes.
- **Boundary:** Server-render-time behavior versus post-load browser behavior.
- **Fact sources:** [runtime model](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks),
  [live updates](../../internal/sdk-knowledge/shared/concepts.md#live-updates).

## Section map

| Section                                                      | Category                       | Purpose                                                                                             | Required evidence                                                                                                   | Fact sources                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How the SDK fits your app                                    | Required for first integration | Orient the reader to the bound factory and server/client entry points before deeper configuration.  | Import-path table; one-factory rule; bridge from the quick start instead of repeating it.                           | [package](../../internal/sdk-knowledge/web/nextjs-app-router.md#package--entry-points), [setup](../../internal/sdk-knowledge/web/nextjs-app-router.md#setup--factory)                                                                                                                                                                                                      |
| Fetching Contentful entries                                  | Required for first integration | Establish the manual-versus-managed entry boundary before personalization.                          | Manual and managed examples; resolvable-payload checklist; ownership statement.                                     | [App Router setup](../../internal/sdk-knowledge/web/nextjs-app-router.md#setup--factory), [entry-source boundary](../../internal/sdk-knowledge/shared/concepts.md#entry-source-boundary-managed-or-manual), [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution)                                                                           |
| Request context and the profile cookie                       | Common but policy-dependent    | Teach how a request receives visitor context and where application policy enters.                   | Next.js 15/16 handler variants; matcher ownership; cookie ownership; failure warning.                               | [identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership), [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks)                                                                                                                                                                                 |
| Personalizing first paint on the server                      | Required for first integration | Show the entry-to-component handoff that produces Milestone 1.                                      | Renderer diff; render-prop definition and cast; baseline contract; dynamic-render consequence; nested-wrap warning. | [rendering](../../internal/sdk-knowledge/web/nextjs-app-router.md#render--entry-resolution), [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks), [fallback](../../internal/sdk-knowledge/shared/concepts.md#baseline-fallback)                                                                                                |
| The bound root and page events                               | Required for first integration | Explain the server-state handoff and ownership of the first page event.                             | Root/tracker example; emit-versus-skip decision; Suspense placement.                                                | [components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks), [events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking)                                                                                                                                                                                                    |
| Browser takeover and live updates                            | Required for first integration | Explain the handoff mental model every integration uses while marking re-personalization as opt-in. | App-wide and per-entry choices; server/client import boundary; one state-changing example.                          | [components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks), [live updates](../../internal/sdk-knowledge/shared/concepts.md#live-updates)                                                                                                                                                                                                        |
| Entry interaction tracking                                   | Common but policy-dependent    | Make default interaction instrumentation and policy controls visible.                               | Tracked interactions; opt-out location; consent relationship.                                                       | [App Router events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking), [shared consent](../../internal/sdk-knowledge/shared/concepts.md#consent--persistence)                                                                                                                                                                                        |
| Consent, identity, profile, and reset                        | Common but policy-dependent    | Replace the quick-start consent shortcut with application-owned policy and identity flows.          | App-owned consent storage example; server/browser handoff; identify and reset example; ownership warning.           | [App Router consent](../../internal/sdk-knowledge/web/nextjs-app-router.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership), [React Web consent/actions](../../internal/sdk-knowledge/web/react-web.md#consent--persistence)                                                                               |
| Analytics forwarding                                         | Optional                       | Route readers to the supplemental workflow without reteaching it.                                   | Subscription seam and duplicate-forwarding warning; supplemental-guide link.                                        | [React Web events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                                                                                                                                                                                                                                                                         |
| Merge tags and Custom Flags                                  | Optional                       | Cover content-model-dependent personalization beyond entry replacement.                             | Merge-tag guard and resolver example; Custom Flag usage boundary.                                                   | [App Router components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks), [React Web rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution), [React Web events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                                                                        |
| Preview panel                                                | Optional                       | Provide an environment-gated authoring and debugging path.                                          | Separate-package install/import; attach timing; reader-owned environment gate.                                      | [React Web runtime quirks](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks)                                                                                                                                                                                                                                                                          |
| Route-level SSR, browser takeover, and browser-owned islands | Advanced or production-only    | Help mature applications choose ownership per route.                                                | Decision table covering the supported route strategies.                                                             | [App Router components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks), [App Router runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks), [live updates](../../internal/sdk-knowledge/shared/concepts.md#live-updates)                                                                                 |
| Manual server and client escape hatches                      | Advanced or production-only    | Expose lower-level APIs only after the bound path is understood.                                    | Server and client examples or a precise API map; state what remains app-owned.                                      | [package and setup](../../internal/sdk-knowledge/web/nextjs-app-router.md#package--entry-points), [components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks)                                                                                                                                                                                    |
| Caching and request deduplication                            | Advanced or production-only    | Prevent profile-specific output from entering shared caches.                                        | Cache-safety table; request-deduplication distinction; local validation.                                            | [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks), [managed fetching](../../internal/sdk-knowledge/shared/concepts.md#entry-source-boundary-managed-or-manual)                                                                                                                                                               |
| Strict consent and duplicate-event controls                  | Advanced or production-only    | Turn privacy and duplicate-event policy into explicit production decisions.                         | Strict allow-list example; blocked-event diagnostics; first-event ownership check.                                  | [App Router consent](../../internal/sdk-knowledge/web/nextjs-app-router.md#consent--persistence), [App Router events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking), [React Web consent](../../internal/sdk-knowledge/web/react-web.md#consent--persistence), [React Web events](../../internal/sdk-knowledge/web/react-web.md#events--tracking) |

## SDK-specific authoring overrides

- Put the request-handler filename/export choice in the quick start and repeat the failure symptom in
  Troubleshooting; it can silently prevent all server state. Facts:
  [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks).
- Put the dynamic-render consequence in the first-paint Core section, not only in caching. Facts:
  [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks).
- Keep “Browser takeover and live updates” in Core because the handoff model is required knowledge,
  but distinguish that from enabling live updates, which is opt-in. Facts:
  [components](../../internal/sdk-knowledge/web/nextjs-app-router.md#components--hooks).

## Troubleshooting scope

| Reader symptom                                                 | Why it belongs                                                                  | Fact sources                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Entries remain on baseline                                     | Most common first-run ambiguity; connect authoring, consent, and payload shape. | [fallback](../../internal/sdk-knowledge/web/nextjs-app-router.md#failure--fallback-behavior)    |
| Authored variant never appears                                 | Makes the all-visitors verification actionable.                                 | [fallback](../../internal/sdk-knowledge/shared/concepts.md#baseline-fallback)                   |
| Entry component has a type error                               | The public render type is wider than generated app types.                       | [rendering](../../internal/sdk-knowledge/web/nextjs-app-router.md#render--entry-resolution)     |
| Server or browser sends duplicate/missing first page events    | The handoff requires explicit event ownership.                                  | [events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking)                |
| Live entries do not change after identity/reset                | Distinguishes the default locked render from opt-in live updates.               | [live updates](../../internal/sdk-knowledge/shared/concepts.md#live-updates)                    |
| Server and browser use different profiles                      | Cookie scope and readability are cross-runtime integration work.                | [identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership)       |
| Server code sees browser globals or personalized HTML is stale | These expose the defining server/client and cache boundaries.                   | [runtime quirks](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks) |

## Link roles

- [The sibling Next.js Pages Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained App Router reference implementation](../../../implementations/nextjs-sdk_app-router/README.md).
- [The maintained Pages Router reference implementation for comparison](../../../implementations/nextjs-sdk_pages-router/README.md).
