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
- **Target result:** The app uses the Pages Router SDK for server preview, full browser hydration,
  root-owned route tracking that commits a staged continuation, and target entry resolution.
- **Guide file:** `documentation/guides/migrating-experience-js-next-to-nextjs-pages-router.md`
- **Write after:** `choosing-a-nextjs-migration-path-from-experience-js.md`.
- **First verification:** One Pages Router server data path renders an all-visitors variant,
  delivers its private replay in the browser, and verifies denied-consent behavior.

## Migration route

| Legacy surface                  | Target route                                            | Detail owner                                                                                        |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Next provider/tracker           | Pages Router root-owned route coordination              | [Pages Router blueprint](../blueprints/nextjs-pages-router.md)                                      |
| SSR plugin profile continuity   | Pages Router request preview and private browser replay | [Pages identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership)   |
| React components and hooks      | Pages Router `OptimizedEntry` and React Web hooks       | [Pages rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution) |
| Third-party plugin integrations | Supplemental plugin migration                           | `migrating-experience-js-plugins-and-preview.md`                                                    |

## Section plan

| Section                                    | Purpose                                                                                                                                                                                                                                                                                                                                  | Must route to                                          | Fact sources                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory legacy Pages Router wiring       | Identify provider placement, tracker override, SSR plugin use, and profile cookie assumptions.                                                                                                                                                                                                                                           | Legacy Next.js and identifiers.                        | [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence)                                                                                                                                                                                         |
| Install and bind the Pages Router SDK      | Establish the target package, browser binding, and `bindNextjsPagesRouterServerOptimization`; before root props, define `routeKey` as path-plus-search match/dedup identity and `buildPagePayload` as the full page URL event-data seam.                                                                                                 | Pages setup and runtime sections.                      | [package](../../internal/sdk-knowledge/web/nextjs-pages-router.md#package--entry-points), [setup](../../internal/sdk-knowledge/web/nextjs-pages-router.md#setup--initialization-and-binding), [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks)                                                                                          |
| Replace server profile and page evaluation | Replace the legacy SSR plugin with `createRequestHandoff` in `getServerSideProps`; use zero or more optional commands plus the SDK page, preview state, a staged continuation, matching-route delivery, successful Experience commit/persistence, and a visible no-JavaScript consequence with one root-owned browser route coordinator. | Pages events, identifiers, consent, and replay.        | [legacy SSR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [target identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking), [replay](../../internal/sdk-knowledge/shared/concepts.md#experience-preflight-and-private-replay)   |
| Replace personalized rendering             | Move legacy React components and Contentful mapper output to Pages Router entry resolution.                                                                                                                                                                                                                                              | Pages rendering and content-model migration.           | [React legacy](../../internal/migration-knowledge/experience-js.md#react-render-and-hooks), [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [rendering](../../internal/sdk-knowledge/web/nextjs-pages-router.md#render--entry-resolution), [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution) |
| Replace client-side extras                 | Route flags, analytics forwarding, preview, and consent diagnostics through React Web client behavior.                                                                                                                                                                                                                                   | Pages/React Web events plus supplemental plugin guide. | [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [flag views](../../internal/sdk-knowledge/shared/concepts.md#custom-flag-views), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams), [preview](../../internal/sdk-knowledge/shared/concepts.md#preview-overrides)                             |
| Validate Pages Router migration            | Verify server props, rendered variant/baseline, cache boundaries, and use the integration guide's exact browser commit, duplicate-route, and continuity-cookie checks.                                                                                                                                                                   | Pages production checks and troubleshooting.           | [runtime](../../internal/sdk-knowledge/web/nextjs-pages-router.md#version--runtime-quirks), [fallback](../../internal/sdk-knowledge/web/nextjs-pages-router.md#failure--fallback-behavior), [events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking)                                                                                                    |

## Handoffs

None.

## Link roles

- [Next.js Pages Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
- [Profile synchronization concept](../../concepts/profile-synchronization-between-client-and-server.md).
- [Pages Router reference implementation](../../../implementations/nextjs-sdk_pages-router/README.md).
- [Contentful model migration guide](../../guides/migrating-experience-js-contentful-model-to-optimization.md).
- [Plugin, privacy, analytics, and preview migration guide](../../guides/migrating-experience-js-plugins-and-preview.md).
