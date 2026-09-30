---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-node-ssr-and-esr.md
---

# experience.js Node, SSR, and ESR migration blueprint

## Reader goal

- **Use when:** A server integration uses `@ninetailed/experience.js-node`, SSR plugin helpers, ESR
  helpers, or a manual server-to-browser handoff.
- **Target result:** The server uses direct Node event calls for server-only routes or a
  preview/private-replay handoff for routes that continue in a Web or framework SDK.
- **Guide file:** `documentation/guides/migrating-experience-js-node-ssr-and-esr.md`
- **Write after:** `choosing-a-nextjs-migration-path-from-experience-js.md` for Next.js apps;
  otherwise None.
- **First verification:** One accepted request and one denied-consent request prove direct Node
  results or Node/Web preview/replay, rendered content, browser persistence, and cache boundaries.

## Migration route

| Legacy surface                  | Target route                                                                                             | Detail owner                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `NinetailedAPIClient`           | Node SDK request client and event calls                                                                  | [Node blueprint](../blueprints/node.md)                                              |
| SSR plugin profile handoff      | Preview state plus a continuation staged by Web hydration for matching-route delivery and browser commit | [Node events](../../internal/sdk-knowledge/node/node.md#events--tracking)            |
| ESR helper preflight behavior   | Framework request preview/replay where possible                                                          | Next.js router-choice migration                                                      |
| Server-rendered content mapping | Node entry resolution or framework SDK rendering                                                         | [Node rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution) |

## Section plan

| Section                                      | Purpose                                                                                                                                                                                                                                                                                                                                                         | Must route to                                              | Fact sources                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventory server profile and event ownership | Identify which server path creates profiles, emits page events, and persists visitor identity.                                                                                                                                                                                                                                                                  | Legacy Node, SSR, ESR, and identifiers.                    | [package mapping](../../internal/migration-knowledge/experience-js.md#package-mapping), [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence)                                                                                                                      |
| Replace Node API client calls                | Move server mutations and event handling to request-scoped Node SDK calls.                                                                                                                                                                                                                                                                                      | Node setup, context, events, and consent sections.         | [legacy runtime](../../internal/migration-knowledge/experience-js.md#legacy-runtime-surfaces), [Node setup](../../internal/sdk-knowledge/node/node.md#setup--initialization-and-binding), [Node events](../../internal/sdk-knowledge/node/node.md#events--tracking), [Node consent](../../internal/sdk-knowledge/node/node.md#consent--persistence)                                                    |
| Replace SSR and ESR handoff                  | Pick a framework SDK when available; otherwise distinguish direct Node server commits from a Node-plus-Web sequence of optional commands plus the SDK page, preview state, app-owned handoff transport, staged continuation, matching-route delivery, successful browser Experience commit/persistence, and the no-JavaScript consequence in a visible callout. | Next.js router-choice guide; Node/Web continuity sections. | [Next.js SSR ESR](../../internal/migration-knowledge/experience-js.md#nextjs-ssr-and-esr), [unsupported boundaries](../../internal/migration-knowledge/experience-js.md#unsupported-or-manual-migration-boundaries), [Node events](../../internal/sdk-knowledge/node/node.md#events--tracking), [replay](../../internal/sdk-knowledge/shared/concepts.md#experience-preflight-and-private-replay)      |
| Replace server content resolution            | Move from legacy experience-config mapping to target entry resolution and fallback behavior.                                                                                                                                                                                                                                                                    | Node rendering and content-model migration guide.          | [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [unsupported boundaries](../../internal/migration-knowledge/experience-js.md#unsupported-or-manual-migration-boundaries), [Node rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution), [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution) |
| Validate server migration                    | Verify accepted or blocked events, rendered content, cache safety, and use the Node guide's exact browser commit, duplicate-route, and continuity-cookie checks for paired routes.                                                                                                                                                                              | Node production checks and troubleshooting.                | [Node events](../../internal/sdk-knowledge/node/node.md#events--tracking), [Node fallback](../../internal/sdk-knowledge/node/node.md#failure--fallback-behavior), [Node runtime](../../internal/sdk-knowledge/node/node.md#version--runtime-quirks)                                                                                                                                                    |

## Handoffs

None.

## Link roles

- [Node SDK integration guide](../../guides/integrating-the-node-sdk-in-a-node-app.md).
- [Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [Profile synchronization concept](../../concepts/profile-synchronization-between-client-and-server.md).
- [Node reference implementation](../../../implementations/node-sdk/README.md).
- [Node plus Web reference implementation](../../../implementations/node-sdk+web-sdk/README.md).
- [Next.js migration path decision guide](../../guides/choosing-a-nextjs-migration-path-from-experience-js.md).
