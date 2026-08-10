# Migrating experience.js Next.js to the App Router SDK

Use this guide when a Next.js App Router app carries legacy Next.js, ESR, SSR plugin, or React
experience.js wiring and you want to move server rendering to
`@contentful/optimization-nextjs/app-router/server`, with
`@contentful/optimization-nextjs/app-router/client` only for bound Client Components.

## What changes

The App Router server binding provides a nested `optimization.request` component family for request
context, server first paint, route tracking, entry resolution, and browser handoff. A separate client
binding supports bound Client Components. Legacy Next provider, tracker, SSR plugin, ESR helper,
React component, and plugin behavior should be replaced by these App Router surfaces plus the shared
migration guides.

Start with the
[Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).

## Before you migrate

Gather these inputs:

- Current `@ninetailed/experience.js-next`, `@ninetailed/experience.js-next-esr`, SSR plugin, and
  React imports.
- Existing middleware, proxy, route tracker, and page-event ownership.
- Use of `ntaid` or browser legacy storage for profile continuity.
- Personalized Server Components, Client Components, and Contentful fetches.
- Consent policy and whether server personalization may make affected routes dynamic.

## Migration path

1. Confirm this app should use App Router through
   [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md).
   Then open the
   [App Router integration quick start](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#quick-start)
   and make the forwarding-only request handler run before replacing render components.
2. Migrate authored Contentful entries when legacy mapper output is still required. See
   [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md).
3. Install the App Router SDK and bind its server entry point.
4. Replace SSR/ESR profile continuity with target request context and cookie behavior.
5. Replace server-rendered personalization with bound `OptimizedEntry`.
6. Replace browser takeover features and plugins through target client surfaces.
7. Remove legacy Next, ESR, React, and plugin packages after imports are gone.

## Replace legacy surfaces

### Remove legacy Next.js package assumptions

Do not carry forward package-root or ESR helper assumptions. The target App Router import path is
`@contentful/optimization-nextjs/app-router/server` for Server Components. Use
`@contentful/optimization-nextjs/app-router/client` only for bound Client Components and
`@contentful/optimization-nextjs/client` for browser hooks and per-entry controls. Legacy ESR
middleware and selector files are not supported public import surfaces.

Remove legacy tracker and provider wiring before adding `optimization.request.OptimizationRoot` and
`optimization.request.NextAppAutoPageTracker`, so the request family owns server state handoff and
browser tracking once.

### Install and bind the App Router SDK

Create one server binding with `bindNextjsAppRouterServerOptimization` from
`@contentful/optimization-nextjs/app-router/server`, then use its nested `optimization.request`
components for ordinary per-visitor routes. Configure the no-argument
`createNextjsOptimizationContextHandler()` from `@contentful/optimization-nextjs/request-handler` as
shown in
[Request context and the profile cookie](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#request-context-and-the-profile-cookie):
Next.js 16 uses `proxy.ts` with a `proxy` export, while Next.js 13 to 15 use `middleware.ts` with a
`middleware` export. The default handler only forwards sanitized request context and the original
request URL; the request family performs request evaluation.

If the handler is missing or misnamed, the request family reports a missing forwarded request URL.
Verify the handler by loading a matched route and confirming that error is absent before replacing
many render surfaces.

### Replace SSR/ESR profile continuity

Move profile continuity to the App Router request context and target SDK cookie behavior. The target
profile cookie is `ctfl-opt-aid`; it must be browser-readable so browser takeover can continue the
same visitor. The app still owns the consent record and the server consent resolver.

Every `optimization.request` wrapper shares one SDK-owned initializer for the active request. It
derives the request URL, route key, page payload, hydration mode, and handoff once. Mount
`optimization.request.NextAppAutoPageTracker` inside `optimization.request.OptimizationRoot`; the
tracker receives first-page-event ownership from that shared handoff automatically. Do not create or
pass app-owned handoff, route-key, page-payload, or `initialPageEvent` plumbing for the ordinary
request-family path.

### Replace server-rendered personalization

Replace legacy mapped experiences and React wrappers with
`optimization.request.OptimizedEntry`. Use `baselineEntry` when your app fetched the entry manually.
Use `entryId` only when the binding config includes `contentful` for managed server fetching. If the
browser must continue that managed entry, pass matching descriptors through
`optimization.request.OptimizationRoot`'s `prefetchManagedEntries` prop. The request family fetches
and merges those entries into its handoff. The server component resolves against the current
request's selected optimizations and returns the variant or baseline.

Server personalization reads request data and makes the route dynamic. Do not keep ISR or static
assumptions on routes that render request-specific personalized output.

### Replace browser takeover features

Bound Client Components use a separate binding from
`@contentful/optimization-nextjs/app-router/client`. Client-side flags, analytics forwarding,
preview, and live updates use the React Web runtime behind the App Router SDK:

- Flag reads auto-attempt flag-view tracking when consent and profile state allow it.
- Accepted and blocked event streams are available on the live client SDK.
- Preview panel attachment is a browser concern and forces live updates while open.
- Legacy plugin behavior moves to
  [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md).

### Validate App Router migration

Verify server HTML, hydration, and browser takeover together:

- The request handler runs for the personalized route.
- Server rendering uses the nested `optimization.request` root, entry, and tracker components.
- Server-rendered content uses the expected variant or baseline.
- Browser hydration does not briefly revert to empty optimization state.
- The request tracker receives first-page-event ownership without app-owned handoff or tracker props.
- Personalized HTML and resolved outputs are not shared across visitors through caching.

## Validate the migration

- Search for remaining `@ninetailed/experience.js-next`, `@ninetailed/experience.js-next-esr`, and
  legacy React imports.
- Verify one all-visitors variant on a dynamic App Router route.
- Verify denied consent and accepted consent event paths.
- Verify preview and analytics forwarding only after the core route works.

## Troubleshooting

| Symptom                                               | Check                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Request components report a missing request URL       | Confirm the request handler file, export, and route matcher for your Next.js version.                              |
| The route conflicts with static generation            | Request-family personalization is dynamic; use a public-permutation, static, or browser-only path when required.   |
| Hydration changes a managed entry                     | Prefetch the matching descriptor through the request root and keep the browser on the same component path.         |
| Duplicate page events appear on a request-family path | Mount the request-family root and tracker together; remove app-owned handoff and `initialPageEvent` tracker props. |

## Related guides

- [Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
