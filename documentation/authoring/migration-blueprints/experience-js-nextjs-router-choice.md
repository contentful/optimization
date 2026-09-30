---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/choosing-a-nextjs-migration-path-from-experience-js.md
---

# experience.js Next.js router-choice migration blueprint

## Reader goal

- **Use when:** A Next.js app uses `@ninetailed/experience.js-next`,
  `@ninetailed/experience.js-next-esr`, or the SSR plugin and must choose App Router, Pages Router,
  or a manual Node/Web hybrid target.
- **Target result:** The reader picks the right target migration guide before changing code.
- **Guide file:** `documentation/guides/choosing-a-nextjs-migration-path-from-experience-js.md`
- **Write after:** None.
- **First verification:** The reader can name the target router path, server-preview and browser-
  replay owners, cookie/consent owner, and whether request-bound personalization can be dynamic.

## Migration route

| Legacy surface                               | Target route                                                    | Detail owner                                             |
| -------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| Pages-Router-oriented Next package           | Pages Router SDK migration                                      | `migrating-experience-js-next-to-nextjs-pages-router.md` |
| App Router application using legacy wrappers | App Router SDK migration                                        | `migrating-experience-js-next-to-nextjs-app-router.md`   |
| ESR helpers or SSR plugin                    | App Router SDK where possible; otherwise manual Node/Web hybrid | This decision guide plus Node/Web migration guides       |

## Section plan

| Section                                           | Purpose                                                                                                                                                                                                                                                                                   | Must route to                                        | Fact sources                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identify the current Next.js integration          | Classify router, SSR plugin, ESR helpers, and profile cookie usage before target selection.                                                                                                                                                                                               | Legacy Next.js, SSR, ESR, and identifier facts.      | [package mapping](../../internal/migration-knowledge/experience-js.md#package-mapping), [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence)                                                                                            |
| Choose App Router, Pages Router, or manual hybrid | Give a default target by actual app router and supported target SDK package.                                                                                                                                                                                                              | Target Next.js package guides and Node/Web fallback. | [App Router package](../../internal/sdk-knowledge/web/nextjs-app-router.md#package--entry-points), [Pages Router package](../../internal/sdk-knowledge/web/nextjs-pages-router.md#package--entry-points), [Node package](../../internal/sdk-knowledge/node/node.md#package--entry-points), [Web package](../../internal/sdk-knowledge/web/web.md#package--entry-points)      |
| Route SSR preview and browser replay ownership    | Replace legacy server commit plus browser skip logic with target preview state, full handoff hydration that stages one continuation, matching-route delivery, a successful browser Experience commit/persistence owned by one route coordinator, and a visible no-JavaScript consequence. | Target request-handoff and route-tracking sections.  | [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [App events](../../internal/sdk-knowledge/web/nextjs-app-router.md#events--tracking), [Pages events](../../internal/sdk-knowledge/web/nextjs-pages-router.md#events--tracking), [replay](../../internal/sdk-knowledge/shared/concepts.md#experience-preflight-and-private-replay) |
| Route cookie and profile continuity               | Keep continuity explicit across legacy `ntaid`, app-owned consent, and target browser-owned SDK cookie persistence.                                                                                                                                                                       | Target identifier sections.                          | [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence), [App identifiers](../../internal/sdk-knowledge/web/nextjs-app-router.md#identifier-ownership), [Pages identifiers](../../internal/sdk-knowledge/web/nextjs-pages-router.md#identifier-ownership)                                                                             |

## Handoffs

None.

## Link roles

- [Next.js App Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).
- [Next.js Pages Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
- [Node SDK integration guide](../../guides/integrating-the-node-sdk-in-a-node-app.md).
- [Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [App Router migration guide](../../guides/migrating-experience-js-next-to-nextjs-app-router.md).
- [Pages Router migration guide](../../guides/migrating-experience-js-next-to-nextjs-pages-router.md).
