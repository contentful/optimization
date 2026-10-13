---
fern:
  slug: choose-a-nextjs-migration-path-from-experience-js
  section: Migration guides
  description: >-
    Use this guide when a Next.js app uses `@ninetailed/experience.js-next`,
    `@ninetailed/experience.js-next-esr`, or SSR plugin behavior and you need to choose App Router,
    Pages Router, or a manual Node/Web hybrid target before changing code.
---

# Choose a Next.js migration path from experience.js

Use this guide when a Next.js app uses `@ninetailed/experience.js-next`,
`@ninetailed/experience.js-next-esr`, or SSR plugin behavior and you need to choose App Router,
Pages Router, or a manual Node/Web hybrid target before changing code.

## What changes

Legacy Next.js surfaces mix React provider behavior, route tracking, SSR profile continuity, and ESR
helpers. The Optimization SDK Suite splits the target by actual runtime:

- App Router Server Components use `@contentful/optimization-nextjs/app-router/server`; bound
  Client Components use `@contentful/optimization-nextjs/app-router/client` when needed.
- Pages Router apps use `@contentful/optimization-nextjs/pages-router` and
  `@contentful/optimization-nextjs/pages-router/server`.
- Non-Next or unsupported server-rendering shapes use `@contentful/optimization-node` on the server
  plus Web or React Web in the browser.

After choosing, follow the target migration guide instead of mixing router patterns.

## Before you migrate

Gather these inputs:

- Whether the app renders through `app/`, `pages/`, or both.
- Use of `@ninetailed/experience.js-next`, `@ninetailed/experience.js-next-esr`, SSR plugin helpers,
  route trackers, or `ntaid`.
- Where the first page event is emitted today: server, browser tracker, or both.
- Where visitor identity is persisted and whether the browser must continue the same profile.
- Whether the target route can be per-request dynamic.

Use these terms consistently:

- App Router means routes under `app/`, including Server Components and route handlers.
- Pages Router means routes under `pages/`, especially pages personalized in `getServerSideProps`.
- SSR plugin means legacy experience.js server-side profile and cookie behavior.
- ESR means legacy edge-side rendering helpers from `@ninetailed/experience.js-next-esr`.
- Manual Node/Web hybrid means the app uses the Node SDK on a custom server boundary and the Web or
  React Web SDK in the browser.

## Migration path

1. Classify the current router and legacy SSR/ESR surfaces.
2. Choose the target package by the route that owns personalization.
3. Plan server preview and browser commitment for the first page event.
4. Decide how profile continuity moves from `ntaid` to the target `ctfl-opt-aid` policy.
5. Follow the selected runtime migration guide.

## Replace legacy surfaces

### Identify the current Next.js integration

Classify the app by the route that renders personalized content:

- Use the App Router path when personalized content lives in `app/` routes or Server Components.
- Use the Pages Router path when personalized pages use `pages/` and `getServerSideProps`.
- Use a manual Node/Web hybrid only when the app has a custom server-rendering boundary that the
  Next.js adapters do not cover.

Do not treat unexported ESR middleware or selector source as supported import surfaces. Some ESR
helper files exist in the legacy package source but are not exported from the package entry, so they
are not supported import contracts. If the legacy integration depends on ESR helpers, prefer the
App Router SDK when the route can move there; otherwise treat the replacement as a manual Node/Web
handoff.

### Choose App Router, Pages Router, or manual hybrid

Decide whether personalized first paint may be per-request dynamic before choosing the adapter. App
Router server personalization reads request data and makes the affected route dynamic, so it is not
compatible with routes that must stay SSG or ISR. Pages Router `getServerSideProps` is already
per-request. A manual Node/Web hybrid has the same cache responsibility as any custom SSR path:
never share personalized output across visitors.

| Current app shape                                                | Target                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| App Router owns the personalized route                           | [App Router migration](./migrating-experience-js-next-to-nextjs-app-router.md)                                         |
| Pages Router and `getServerSideProps` own the personalized route | [Pages Router migration](./migrating-experience-js-next-to-nextjs-pages-router.md)                                     |
| Custom SSR outside the Next.js adapters                          | [Node, SSR, and ESR migration](./migrating-experience-js-node-ssr-and-esr.md), then Web or React Web browser migration |

Use the highest-level adapter that matches the app. In an App Router request path, the server
binding's nested `optimization.request` family owns request initialization, provider state handoff,
and browser page tracking that a manual hybrid would otherwise need to wire.

### Route server preview and browser page commitment

Legacy Next tracking can emit page events on the first route and route changes, while SSR helpers
can also evaluate the first request. Remove legacy first-route calls as you adopt the target path.

In the target App Router path, the no-argument request handler only forwards the original request
URL and sanitized request context. The server binding's nested `optimization.request` family
prepares events, previews request state for server rendering, and creates a handoff. Mount its
`NextAppAutoPageTracker` inside `optimization.request.OptimizationRoot`. The browser commits the
matching prepared events through the SDK queue and tracks later navigation. The ordinary request
family supplies the handoff and route inputs itself.

In the target Pages Router path, bind the server SDK with
`bindNextjsPagesRouterServerOptimization(config)` and call its returned
`createRequestHandoff(context, options)` inside `getServerSideProps`. The server preview supplies
selections for useful first paint when it succeeds; the handoff retains prepared events for browser
delivery even if the preview fails.

Pass that Pages Router handoff to `OptimizationRoot`. On the matching route, the browser admits the
prepared events to its queue. The tracker handles routes without a handoff and later navigation.

### Route cookie and profile continuity

Legacy continuity commonly used `ntaid`. Target Web, React Web, and Next.js browser/framework SDKs
use `ctfl-opt-aid` for the SDK-owned anonymous profile cookie. In a manual Node/Web hybrid, the Node
SDK only exports the `ANONYMOUS_ID_COOKIE` constant; app code must read, write, and clear that
cookie and pass the profile ID through `forRequest({ profile })`. Decide whether migration resets
visitor identity or whether the app reads the legacy cookie and writes the target continuity value
as a one-time operational handoff.

The target consent record remains app-owned. Do not reuse `__nt-consent__` as if it were an SDK
contract.

## Validate the migration

- The selected guide matches the route that renders personalized content.
- The server preview and browser event delivery are verified separately.
- The App Router request family supplies its handoff to the browser automatically; explicit paths
  pass a matching route key and handoff.
- Cookie and consent ownership are documented in app code before deleting legacy packages.

## Troubleshooting

| Symptom                                       | Check                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| First page events duplicate                   | Remove legacy page calls and pass the same handoff and route to the browser root.                                                                 |
| App Router route no longer behaves statically | Request-family personalization reads request data; use a public-permutation, static, or browser-only path if static output is required.           |
| ESR migration has no matching import          | The legacy ESR package did not export every helper present in source; use the explicit App Router server entry point or a manual Node/Web hybrid. |

## Related guides

- [Migrate experience.js Next.js to App Router](./migrating-experience-js-next-to-nextjs-app-router.md)
- [Migrate experience.js Next.js to Pages Router](./migrating-experience-js-next-to-nextjs-pages-router.md)
- [Migrate experience.js Node, SSR, and ESR](./migrating-experience-js-node-ssr-and-esr.md)
- [Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
