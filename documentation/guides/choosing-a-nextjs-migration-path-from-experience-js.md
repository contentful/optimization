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
- Whether legacy code commits the first page on the server, browser, or both.
- Where visitor identity is persisted and whether the browser must continue the same profile.
- Whether the target route can be per-request dynamic.

Use these terms consistently:

- App Router means routes under `app/`, including Server Components and route handlers.
- Pages Router means routes under `pages/`, especially pages personalized in `getServerSideProps`.
- SSR plugin means legacy experience.js server-side profile and cookie behavior.
- ESR means legacy edge-side rendering helpers from `@ninetailed/experience.js-next-esr`.
- Manual Node/Web hybrid means the app uses the Node SDK on a custom server boundary and the Web or
  React Web SDK in the browser.
- Server preview means the server evaluates zero or more optional `identify`/`track` commands in
  application-supplied order, followed by the SDK-appended `page` command. It returns preview state
  without committing the sequence. The handoff's **private replay** is the SDK-owned, route-bound
  continuation for the initial browser route. A **successful Experience commit** is the non-preflight
  browser profile response; only that response can persist browser continuity.

> [!NOTE]
>
> Without JavaScript, previewed server HTML can still render, but matching-route delivery and a new
> browser `ctfl-opt-aid` cookie do not occur.

## Migration path

1. Classify the current router and legacy SSR/ESR surfaces.
2. Choose the target package by the route that owns personalization.
3. Replace server commit plus browser-skip logic with target server preview, private replay, and one
   browser route coordinator.
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
private replay, and route tracking that a manual hybrid would otherwise need to rebuild.

### Route SSR preview and browser replay ownership

Legacy Next tracking can commit page events on the first route and route changes while SSR helpers
also commit the first request. The target framework adapters instead create preview state on the
server, apply preview state in memory, and commit the admitted replay in the browser.

In the target App Router path, the no-argument request handler forwards the original URL and sanitized context. The server binding's nested `optimization.request` family previews the optional commands followed by the SDK page in one request. Inject the client `RequestOptimizationRoot` and mount the nested `optimization.request.OptimizationRoot`. It applies private preview state in memory, owns the initial replay/page decision, and tracks later routes while rendering remains independent of delivery.

In the target Pages Router path, bind the server SDK with `bindNextjsPagesRouterServerOptimization(config)` and call `createRequestHandoff(context, options)` inside `getServerSideProps`. Pass the handoff, stable route key, and lazy page builder to one `OptimizationRoot` in `_app.tsx`. The root hydrates preview state and makes the initial replay/page decision through ordinary queues and route deduplication. It owns later routes; do not add a separate tracker.

The legacy `initialPageEvent` option is compatibility-only and inert. Remove explicit emit/skip
plumbing during migration instead of using it to coordinate the server and browser.

### Route cookie and profile continuity

Legacy continuity commonly used `ntaid`. Target Web, React Web, and Next.js browser/framework SDKs
use `ctfl-opt-aid` for the SDK-owned anonymous profile cookie. In a manual Node/Web hybrid, the Node
SDK exports the `ANONYMOUS_ID_COOKIE` constant; app code reads an existing cookie and passes the
profile ID through `forRequest({ profile })`. A hybrid route previews the initial sequence in Node,
creates a private replay handoff, and lets full Web hydration stage it for ordinary current-page
tracking. A successful browser Experience response commits the sequence and can write the target
cookie when persistence consent permits. A server-only Node route can commit events directly and
persist the returned profile ID in app code. Decide whether migration resets visitor identity or
performs a one-time operational handoff from the legacy cookie.

The target consent record remains app-owned. Do not reuse `__nt-consent__` as if it were an SDK
contract.

## Validate the migration

- The selected guide matches the route that renders personalized content.
- The server preview contains zero or more optional identify/track events in application-supplied
  order, followed by the SDK-appended page.
- For the chosen router, run the exact browser commit, duplicate-route, and continuity-cookie checks
  in the [App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#the-bound-root-and-page-events)
  or [Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#the-bound-root-and-page-events).
- Observe one successful browser Experience commit for the initial route, no duplicate request for
  the same path plus search, and `ctfl-opt-aid` only after that response when persistence consent
  permits it.
- Cookie and consent ownership are documented in app code before deleting legacy packages.

## Troubleshooting

| Symptom                                             | Check                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser page events duplicate                       | Remove the legacy tracker, direct page call, and inert `initialPageEvent` plumbing; keep one target browser root as route coordinator.            |
| Server variant renders but no target cookie appears | Run the selected guide's browser Experience commit check; confirm JavaScript ran and persistence consent is true.                                 |
| App Router route no longer behaves statically       | Request-family personalization reads request data; use a public-permutation, static, or browser-only path if static output is required.           |
| ESR migration has no matching import                | The legacy ESR package did not export every helper present in source; use the explicit App Router server entry point or a manual Node/Web hybrid. |

## Related guides

- [Migrate experience.js Next.js to App Router](./migrating-experience-js-next-to-nextjs-app-router.md)
- [Migrate experience.js Next.js to Pages Router](./migrating-experience-js-next-to-nextjs-pages-router.md)
- [Migrate experience.js Node, SSR, and ESR](./migrating-experience-js-node-ssr-and-esr.md)
- [Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
