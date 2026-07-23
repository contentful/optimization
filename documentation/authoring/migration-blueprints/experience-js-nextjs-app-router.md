---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-next-to-nextjs-app-router.md
---

# experience.js Next.js to App Router migration blueprint

## Reader goal

- **Use when:** A Next.js App Router app carries legacy Next.js, ESR, SSR plugin, or React
  experience.js wiring.
- **Target result:** The app uses the App Router SDK for request context, server first paint,
  browser takeover, and policy-dependent client features.
- **Guide file:** `documentation/guides/migrating-experience-js-next-to-nextjs-app-router.md`
- **Write after:** `choosing-a-nextjs-migration-path-from-experience-js.md`.
- **First verification:** One dynamic App Router route renders an all-visitors variant and verifies
  both accepted and denied-consent event paths.

## Migration route

| Legacy surface                   | Target route                                     | Detail owner                                                                                           |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Legacy Next provider and tracker | Bound App Router root, handler, and page tracker | [App Router blueprint](../blueprints/nextjs-app-router.md)                                             |
| SSR/ESR profile helpers          | App Router request context and profile cookie    | [App Router identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership)   |
| React render hooks/components    | App Router `OptimizedEntry` and browser takeover | [App Router rendering](../../internal/sdk-knowledge/web/nextjs-app-router.md#render--entry-resolution) |
| Legacy plugins                   | Supplemental plugin migration                    | `migrating-experience-js-plugins-and-preview.md`                                                       |

## Section plan

| Section                                   | Purpose                                                                                               | Must route to                                                     | Fact sources                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove legacy Next.js package assumptions | Prevent writers from treating ESR middleware/selector source as supported imports.                    | Legacy package mapping and unsupported boundaries.                | [package mapping](../../internal/migration-knowledge/experience-js.md#package-mapping), [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [unsupported boundaries](../../internal/migration-knowledge/experience-js.md#unsupported-or-manual-migration-boundaries)                                                                                                                         |
| Install and bind the App Router SDK       | Restore the App Router request/root shape before replacing render calls.                              | App Router setup, package, and runtime sections.                  | [package](../../internal/sdk-knowledge/web/nextjs-app-router.md#package--entry-points), [setup](../../internal/sdk-knowledge/web/nextjs-app-router.md#setup--factory), [runtime](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks)                                                                                                                                                                     |
| Replace SSR/ESR profile continuity        | Move profile cookie and request evaluation to target request context with app-owned policy.           | Request context, identifiers, consent, and first-event ownership. | [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [legacy identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence), [target identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership), [events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking)                                                |
| Replace server-rendered personalization   | Route legacy mapped experiences and React wrappers to target entry resolution and server first paint. | App Router rendering and content-model migration.                 | [React legacy](../../internal/migration-knowledge/experience-js.md#react-render-and-hooks), [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [rendering](../../internal/sdk-knowledge/web/nextjs-app-router.md#render--entry-resolution), [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution)                                                     |
| Replace browser takeover features         | Move flags, analytics forwarding, preview, and live updates through the target client runtime.        | App Router browser/client sections and supplemental plugin guide. | [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [flag views](../../internal/sdk-knowledge/shared/concepts.md#custom-flag-views), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams), [preview](../../internal/sdk-knowledge/shared/concepts.md#preview-overrides), [live updates](../../internal/sdk-knowledge/shared/concepts.md#live-updates) |
| Validate App Router migration             | Verify server HTML, hydration stability, profile continuity, event ownership, and cache safety.       | App Router production checks and troubleshooting.                 | [runtime](../../internal/sdk-knowledge/web/nextjs-app-router.md#version--runtime-quirks), [fallback](../../internal/sdk-knowledge/web/nextjs-app-router.md#failure--fallback-behavior), [events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking)                                                                                                                                                            |

## Handoffs

None.

## Link roles

- [Next.js App Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).
- [Profile synchronization concept](../../concepts/profile-synchronization-between-client-and-server.md).
- [App Router reference implementation](../../../implementations/nextjs-sdk_app-router/README.md).
- [Contentful model migration guide](../../guides/migrating-experience-js-contentful-model-to-optimization.md).
- [Plugin, privacy, analytics, and preview migration guide](../../guides/migrating-experience-js-plugins-and-preview.md).
