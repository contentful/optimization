<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK Adapter</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../../CONTRIBUTING.md)

</div>

`@contentful/optimization-nextjs` is a thin adapter for Next.js applications. It composes Node
server helpers, React Web roots, and edge-safe Core pass-throughs; it is not a new optimization
runtime. The package root intentionally has no runtime export. Import one of the documented
subpaths so server, client, router, and edge boundaries stay explicit.

## What this package provides

| Runtime          | Import path                                           | Responsibility                                              |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| App Router       | `@contentful/optimization-nextjs/app-router`          | App Router binding, request, and public permutation handoff |
| Cache middleware | `@contentful/optimization-nextjs/cache-middleware`    | Next proxy or middleware public permutation cache rewrites  |
| Pages Router     | `@contentful/optimization-nextjs/pages-router`        | Pages Router client binding and React roots                 |
| Pages server     | `@contentful/optimization-nextjs/pages-router/server` | Pages Router `getServerSideProps` request handoff           |
| Edge             | `@contentful/optimization-nextjs/edge`                | Edge runtime request and public permutation handoff helpers |
| Client           | `@contentful/optimization-nextjs/client`              | Router-neutral React SDK providers, hooks, roots            |
| Schemas          | `@contentful/optimization-nextjs/api-schemas`         | Shared API types, schemas, and structural guards            |
| Server           | `@contentful/optimization-nextjs/server`              | Node SDK configuration, request binding, wrappers           |
| Request handler  | `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request context forwarding            |
| Shared           | `@contentful/optimization-nextjs/tracking-attributes` | SSR `data-ctfl-*` tracking attributes                       |

## Install

```sh
pnpm add @contentful/optimization-nextjs contentful
```

Next.js, React, and React DOM are application-owned peer dependencies. The adapter uses the runtime
already installed by your app instead of installing its own copy. The `contentful` package is the
app-owned CDA client used by managed entry fetching examples.

The bound `OptimizationProvider` handles the React Web content SDK context, browser handoff,
hydration mode, and managed-entry prefetch for a subtree. Use the bound `OptimizationRoot` at route
roots because it adds initial page-event wiring through `routeKey`, `buildPagePayload`, or
`initialPagePayload`. Do not pass those page-event props to `OptimizationProvider`.

## App Router setup

Start App Router integrations from `/app-router` and define app-local bound exports once. Next.js
resolves that import to the server implementation for Server Components and to the client
implementation for Client Components.

```tsx
import { bindNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'
import { contentfulClient } from './contentful'
import { getAppConsent } from './consent'

export const {
  OptimizationRoot,
  OptimizationAnalyticsRoot,
  OptimizedEntry,
  createRequestHandoff,
  createHandoffFromSelections,
  createPublicPermutationHandoff,
  getServerTrackingAttributes,
  resolveEntriesForSelections,
} = bindNextjsAppRouterOptimization({
  clientId: 'client-id',
  environment: 'main',
  locale: 'en-US',
  contentful: { client: contentfulClient },
  consent: {
    server: ({ cookies }) => (getAppConsent(cookies) ? { events: true, persistence: true } : false),
    clientDefaults: { consent: false, persistenceConsent: false },
  },
})
```

The App Router binding uses `contentful` on server-capable paths and omits that client from
serialized client props. Keep any browser-only Contentful fetching explicitly app-owned.

The bound server `OptimizedEntry` accepts exactly one source: manual `baselineEntry`, managed
`entryId` with optional `entryQuery`, or a `managedEntry` object with `contentType`, `slug`, optional
`slugField`, and optional `entryQuery`. `slugField` defaults to `slug`. A successful slug lookup
renders and tracks with the fetched entry's `sys.id`. Invalid source combinations reject with
`Bound Next.js OptimizedEntry requires exactly one source: baselineEntry, entryId, or managedEntry.`

Use `createRequestHandoff()` when a route should call `page()` on the server and pass canonical
browser handoff state into the React Web root:

```tsx
import { cookies, headers } from 'next/headers'
import { OptimizationRoot, createRequestHandoff } from '@/lib/optimization'

export default async function Page() {
  const requestHeaders = new Headers(await headers())
  const handoff = await createRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { route: '/products' } },
    request: {
      cookies: await cookies(),
      headers: requestHeaders,
      url: 'https://example.com/products',
    },
  })

  return (
    <OptimizationRoot
      handoff={handoff}
      prefetchManagedEntries={[
        { contentType: 'productPage', slug: 'featured', entryQuery: { locale: 'en-US' } },
      ]}
      routeKey="/products"
      buildPagePayload={() => ({ properties: { route: '/products' } })}
    >
      {/* route content */}
    </OptimizationRoot>
  )
}
```

`prefetchManagedEntries` fetches descriptors on the server and merges their baselines into
`handoff.entries`; slug handoffs nest the normalized descriptor under `managedEntry` and store the
fetched `sys.id` in `entryId`. A server `OptimizedEntry` fetches for that render only, so use root
prefetch when a matching browser managed source must hydrate without another fetch.

Use `createPublicPermutationHandoff()` for app-owned public permutations rendered by App Router
Cache Components, Pages Router ISR, CDN-cached routes, or Edge runtime route handlers. The
application supplies the selected optimizations and public permutation dimensions. Request-derived
profile handoffs must use `private-request` cache scope.

```tsx
const handoff = createPublicPermutationHandoff({
  permutationKey: permutation.slug,
  cacheVersion: permutation.cacheVersion,
  locale: permutation.locale,
  entryIds: permutation.entryIds,
  selectedOptimizations: permutation.selectedOptimizations,
  hydration: 'preserve-server',
  initialPageEvent: 'emit',
})
```

Use `OptimizationAnalyticsRoot` for analytics-only routes. Render personalized content on the
server, attach tracking attributes with `getServerTrackingAttributes()`, and pass an
`analytics-only` handoff to the root.

## Pages Router setup

Use `/pages-router` for client roots in `_app.tsx` and `/pages-router/server` for
`getServerSideProps`. The server helper is separate because the client binding is a `"use client"`
entry.

```tsx
import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

export const { OptimizationRoot, OptimizationAnalyticsRoot, OptimizedEntry } =
  bindNextjsPagesRouterOptimization({
    clientId: 'client-id',
    environment: 'main',
    consent: {
      clientDefaults: { consent: false, persistenceConsent: false },
    },
  })
```

```tsx
import { OptimizationRoot } from '@/lib/optimization'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const routeKey = router.asPath || router.pathname

  return (
    <OptimizationRoot
      buildPagePayload={() => ({ properties: { route: routeKey } })}
      handoff={pageProps.contentfulOptimization?.handoff}
      routeKey={routeKey}
    >
      <Component {...pageProps} />
    </OptimizationRoot>
  )
}
```

```tsx
import { bindNextjsPagesRouterServerOptimization } from '@contentful/optimization-nextjs/pages-router/server'
import { contentfulClient } from './contentful'

const { createRequestHandoff } = bindNextjsPagesRouterServerOptimization({
  clientId: 'client-id',
  contentful: { client: contentfulClient },
  environment: 'main',
  consent: {
    server: { events: true, persistence: true },
  },
})

export async function getServerSideProps(context) {
  const handoff = await createRequestHandoff(context, {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { route: context.resolvedUrl } },
    prefetchManagedEntries: [
      { contentType: 'productPage', slug: context.params.slug, entryQuery: { locale: 'en-US' } },
    ],
  })

  return { props: { contentfulOptimization: { handoff } } }
}
```

Pages Router server prefetch accepts ID or content-type/slug descriptors and appends their baselines
to the browser handoff. The bound client `OptimizedEntry` and `/client` `useOptimizedEntry` accept
`baselineEntry`, `entryId` with optional `entryQuery`, or a content-type/slug descriptor under
`managedEntry`. Matching slug sources use the handed-off baseline and its real `sys.id`.

## Edge runtime

Use `/edge` for Edge runtime route handlers that export `runtime = 'edge'`. The helper accepts
Web-standard `Request`, `Headers`, and cookie snapshots and does not import the Node SDK or other
Node-only APIs.

```ts
import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'

const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
  clientId: 'client-id',
  environment: 'main',
  consent: {
    server: { events: true, persistence: true },
    clientDefaults: { consent: false, persistenceConsent: false },
  },
})

export const runtime = 'edge'

export async function GET(request: Request) {
  const { handoff, persist } = await createEdgeRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { route: new URL(request.url).pathname } },
    request,
  })
  const response = new Response(renderHtml({ handoff }), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })

  persist(response)

  return response
}
```

Public Edge runtime permutations use `createPublicPermutationHandoff()` from the configured `/edge`
helper. Keep that separate from App Router Cache Components and Pages Router ISR; a route name or
helper name does not by itself prove Edge runtime execution.

## Server and tracking helpers

`@contentful/optimization-nextjs/server` exposes low-level Node utilities such as
`configureNextjsServerOptimization()`, `createNextjsRequestHandoff()`, `ServerOptimizedEntry`, and
`getNextjsServerOptimizationData()` for applications that need direct Node request control.

To model baseline and variant entries with different content types, see
[Entry optimization and variant resolution](../../../../documentation/concepts/entry-personalization-and-variant-resolution.md).

`@contentful/optimization-nextjs/tracking-attributes` exposes `getServerTrackingAttributes()`, a
Next.js wrapper around the React Web/Web tracking-attribute pass-through. Use it for
server/static/edge-rendered markup that should be observed by analytics-only browser roots.

## Request handler helpers

`@contentful/optimization-nextjs/request-handler` exposes proxy and middleware helpers for
request-context forwarding.

```ts
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()
```

The request-context handler always forwards sanitized request context headers. Called without
options, it only forwards request context. When configured with `sdk` and `consent`, it resolves
consent, performs the server page request once, forwards compact `x-ctfl-opt-server-data` context as
`encodeURIComponent(JSON.stringify({ consent, pageAccepted, profileId }))`, and persists
`ctfl-opt-aid` on the `NextResponse` when persistence is allowed. App Router Server Components can
pass the forwarded headers to `createRequestHandoff()` with `trustedRequestHandoff: true`, which
uses the forwarded `profileId` to fetch profile and selection data without a second `page()` call
and uses `pageAccepted` to avoid duplicate first page events. Only set `trustedRequestHandoff: true`
for routes covered by this request handler; raw client-supplied `x-ctfl-opt-server-data` is ignored
unless the route opts in.
Use `createNextjsPublicPermutationCacheMiddleware()` from
`@contentful/optimization-nextjs/cache-middleware` when proxy code needs public permutation
cache-key rewrites. The cache middleware is chainable with an existing `NextResponse`; it preserves
non-SDK response and request override state while removing stale SDK-owned `x-ctfl-opt-*` request
context before rewriting.
