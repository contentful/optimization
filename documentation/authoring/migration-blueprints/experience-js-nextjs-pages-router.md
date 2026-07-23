---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-next-to-nextjs-pages-router.md
---

# experience.js Next.js to Pages Router migration blueprint

## Reader goal

- **Use when:** A Pages Router app uses `@ninetailed/experience.js-next`, SSR plugin behavior, or
  legacy React surfaces.
- **Target result:** The app uses the Pages Router SDK for server data functions, provider wiring,
  page tracking, and target entry resolution.
- **Guide file:** `documentation/guides/migrating-experience-js-next-to-nextjs-pages-router.md`
- **Write after:** `choosing-a-nextjs-migration-path-from-experience-js.md`.
- **First verification:** One Pages Router server data path renders an all-visitors variant and
  verifies accepted server evaluation plus denied-consent behavior.

## Migration route

| Legacy surface                  | Target route                                      | Detail owner                                                                                        |
| ------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Next provider/tracker           | Pages Router provider and page tracker            | [Pages Router blueprint](../blueprints/nextjs-pages-router.md)                                      |
| SSR plugin profile continuity   | Pages Router request context and profile cookie   | [Pages identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership)   |
| React components and hooks      | Pages Router `OptimizedEntry` and React Web hooks | [Pages rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution) |
| Third-party plugin integrations | Supplemental plugin migration                     | `migrating-experience-js-plugins-and-preview.md`                                                    |

## Section plan

| Section                                    | Purpose                                                                                                      | Must route to                                          | Fact sources                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory legacy Pages Router wiring       | Identify provider placement, tracker override, SSR plugin use, and profile cookie assumptions.               | Legacy Next.js and identifiers.                        | [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence)                                                                                                                                                                                         |
| Install and bind the Pages Router SDK      | Establish target package, factory, server props, and provider before rendering changes.                      | Pages setup and runtime sections.                      | [package](../../internal/sdk-knowledge/web/nextjs-pages-router.md#package--entry-points), [setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#setup--factory), [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks)                                                                                                             |
| Replace server profile and page evaluation | Map SSR plugin and tracker behavior to target request context and duplicate-event controls.                  | Pages events, identifiers, and consent.                | [legacy SSR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [target identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking), [page events](../../internal/sdk-knowledge/shared/concepts.md#page-events)                          |
| Replace personalized rendering             | Move legacy React components and Contentful mapper output to Pages Router entry resolution.                  | Pages rendering and content-model migration.           | [React legacy](../../internal/migration-knowledge/experience-js.md#react-render-and-hooks), [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution), [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution) |
| Replace client-side extras                 | Route flags, analytics forwarding, preview, and consent diagnostics through React Web client behavior.       | Pages/React Web events plus supplemental plugin guide. | [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [flag views](../../internal/sdk-knowledge/shared/concepts.md#custom-flag-views), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams), [preview](../../internal/sdk-knowledge/shared/concepts.md#preview-overrides)                             |
| Validate Pages Router migration            | Verify server props, rendered variant/baseline, tracker ownership, profile continuity, and cache boundaries. | Pages production checks and troubleshooting.           | [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks), [fallback](../../internal/sdk-knowledge/web/nextjs-pages-router.md#failure--fallback-behavior), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)                                                                                                    |

## Handoffs

None.

## Link roles

- [Next.js Pages Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
- [Profile synchronization concept](../../concepts/profile-synchronization-between-client-and-server.md).
- [Pages Router reference implementation](../../../implementations/nextjs-sdk_pages-router/README.md).
- [Contentful model migration guide](../../guides/migrating-experience-js-contentful-model-to-optimization.md).
- [Plugin, privacy, analytics, and preview migration guide](../../guides/migrating-experience-js-plugins-and-preview.md).
