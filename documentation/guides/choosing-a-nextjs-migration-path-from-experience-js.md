# Choosing a Next.js migration path from experience.js

Use this guide when a Next.js app uses `@ninetailed/experience.js-next`,
`@ninetailed/experience.js-next-esr`, or SSR plugin behavior and you need to choose App Router,
Pages Router, or a manual Node/Web hybrid target before changing code.

## What changes

Legacy Next.js surfaces mix React provider behavior, route tracking, SSR profile continuity, and ESR
helpers. The Optimization SDK Suite splits the target by actual runtime:

- App Router apps use `@contentful/optimization-nextjs/app-router`.
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
3. Decide which layer owns the first page event.
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
were not stable import contracts. If the legacy integration depended on ESR helpers, prefer the App
Router SDK when the route can move there; otherwise treat the replacement as a manual Node/Web
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

Use the highest-level adapter that matches the app. The adapter owns the framework request,
provider, tracker, state handoff, and cookie mechanics that a manual hybrid would otherwise need to
rebuild.

### Route SSR and first page event ownership

Avoid duplicate page evaluation. Legacy Next tracking emitted page events on the first route and on
route changes, while SSR helpers could also evaluate the first request.

In the target App Router path, the configured request handler can own the first page event for
matching requests. In the target Pages Router path, `getServerSideOptimizationProps()` can own the
first page event and pass an `initialPageEvent` value to the browser tracker. If the server did not
report a consented view, the browser tracker can emit the initial page event.

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
- Exactly one layer owns the first page event for the first route.
- The browser tracker skips or emits the first route intentionally.
- Cookie and consent ownership are documented in app code before deleting legacy packages.

## Troubleshooting

| Symptom                                           | Check                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Both server and browser emit the first page event | Use the target guide's initial-page-event skip path when server evaluation succeeded.                                                        |
| App Router route no longer behaves statically     | Server personalization reads request data and makes the route dynamic; use Pages Router or a browser-only path if static output is required. |
| ESR migration has no matching import              | The legacy ESR package did not export every helper present in source; use App Router or a manual Node/Web hybrid.                            |

## Related guides

- [Migrating experience.js Next.js to App Router](./migrating-experience-js-next-to-nextjs-app-router.md)
- [Migrating experience.js Next.js to Pages Router](./migrating-experience-js-next-to-nextjs-pages-router.md)
- [Migrating experience.js Node, SSR, and ESR](./migrating-experience-js-node-ssr-and-esr.md)
- [Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
