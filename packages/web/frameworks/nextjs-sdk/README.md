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

| Runtime           | Import path                                           | Responsibility                                              |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| App Router server | `@contentful/optimization-nextjs/app-router/server`   | Server binding, request mode, and explicit handoff helpers  |
| App Router client | `@contentful/optimization-nextjs/app-router/client`   | Client binding for App Router Client Components             |
| Cache middleware  | `@contentful/optimization-nextjs/cache-middleware`    | Next proxy or middleware public permutation cache rewrites  |
| Pages Router      | `@contentful/optimization-nextjs/pages-router`        | Pages Router client binding and React roots                 |
| Pages server      | `@contentful/optimization-nextjs/pages-router/server` | Pages Router `getServerSideProps` request handoff           |
| Edge              | `@contentful/optimization-nextjs/edge`                | Edge runtime request and public permutation handoff helpers |
| Client            | `@contentful/optimization-nextjs/client`              | Router-neutral React SDK providers, hooks, roots            |
| Schemas           | `@contentful/optimization-nextjs/api-schemas`         | Shared API types, schemas, and structural guards            |
| Server            | `@contentful/optimization-nextjs/server`              | Node SDK configuration, request binding, wrappers           |
| Request handler   | `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request context forwarding            |
| Tracking          | `@contentful/optimization-nextjs/tracking-attributes` | SSR `data-ctfl-*` tracking attributes                       |

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

Use the explicit `/app-router/server` and `/app-router/client` entrypoints so each module has one
runtime and type surface. `bindNextjsAppRouterServerOptimization()` returns
`NextjsAppRouterServerOptimization`; `bindNextjsAppRouterClientOptimization()` returns
`NextjsAppRouterClientOptimization`.

### Request-personalized quick start

Bind the server SDK once in a server-only module. The nested `optimization.request` family is the
default surface for private request personalization:

```tsx
import 'server-only'
import { bindNextjsAppRouterServerOptimization } from '@contentful/optimization-nextjs/app-router/server'
import { contentfulClient } from './contentful'
import { getAppConsent } from './consent'

export const optimization = bindNextjsAppRouterServerOptimization({
  clientId: 'client-id',
  environment: 'main',
  locale: 'en-US',
  contentful: { client: contentfulClient },
  consent: {
    server: ({ cookies }) => (getAppConsent(cookies) ? { events: true, persistence: true } : false),
    clientDefaults: { consent: false, persistenceConsent: false },
  },
})

export const {
  NextAppAutoPageTracker: RequestNextAppAutoPageTracker,
  OptimizationProvider: RequestOptimizationProvider,
  OptimizationRoot: RequestOptimizationRoot,
  OptimizedEntry: RequestOptimizedEntry,
} = optimization.request
```

Configure the request handler so Server Components receive sanitized request context. Next.js 16
uses `proxy.ts` with a `proxy` export. Next.js 13 to 15 uses `middleware.ts` with a `middleware`
export; the handler body is the same:

```ts
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()
```

Keep public shell content outside the request boundary. Put the request runtime, tracker, and
personalized island inside `Suspense`; the tracker reads Next.js search parameters. Root prefetch
also supplies the managed baseline to the browser handoff:

```tsx
import { AppShell } from '@/components/AppShell'
import { Hero } from '@/components/Hero'
import {
  RequestNextAppAutoPageTracker,
  RequestOptimizationRoot,
  RequestOptimizedEntry,
} from '@/lib/optimization'
import { Suspense } from 'react'

const heroEntryId = 'hero-entry-id'

function PersonalizedContentFallback() {
  return <section aria-busy="true">Loading featured content…</section>
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<PersonalizedContentFallback />}>
        <RequestOptimizationRoot prefetchManagedEntries={[heroEntryId]}>
          <RequestNextAppAutoPageTracker />
          <RequestOptimizedEntry entryId={heroEntryId}>
            {(resolvedHero) => <Hero entry={resolvedHero} />}
          </RequestOptimizedEntry>
        </RequestOptimizationRoot>
      </Suspense>
    </AppShell>
  )
}
```

The request family creates a `private-request` handoff, uses `preserve-server` hydration by default,
and makes all four request components share the same request initialization. For SDK-managed
entries, it starts request initialization and Contentful baseline fetching together, then resolves
the selected variant after both complete. It derives the URL, route key, initial page payload,
headers, and cookies from the forwarded request context. The app does not need its own React cache,
request shell, duplicate awaits, URL parsing, or page-payload builder.

### Choose who owns entry fetching

Both fetching workflows resolve request-selected content:

| Ownership       | Entry source                | Use when                                                                                   |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| **App-owned**   | `baselineEntry`             | Your app owns the Contentful client, query, cache, or data layer.                          |
| **SDK-managed** | `entryId` or `managedEntry` | The server binding configures `contentful: { client }` and the SDK owns the baseline read. |

For app-owned fetching, load the entry and pass it directly:

```tsx
const hero = await getHeroEntry({ locale: 'en-US', include: 10 })

return (
  <RequestOptimizedEntry baselineEntry={hero}>
    {(resolvedHero) => <Hero entry={resolvedHero} />}
  </RequestOptimizedEntry>
)
```

Only SDK-managed fetching receives direct overlap between request initialization and the Contentful
read. App-owned fetching still uses the same request-selected resolution after the app supplies the
baseline.

The proxy or middleware boundary remains required because it forwards the sanitized request URL.
Keep any `Suspense` or `connection()` boundary required by your Next.js rendering and Cache
Components setup; request mode removes SDK request plumbing, not Next.js rendering requirements.

Set `request.hydration` on the server binder only when a route needs another fixed hydration mode or
a synchronous resolver based on `requestUrl` and `routeKey`. Set `request.trustedRequestHandoff` to
`true` only when the request handler is configured with the server SDK and consent so it can forward
trusted page and profile context.

### Client Components

Bind the App Router client surface in a `"use client"` module. It has no private request family or
manual server handoff API:

```tsx
'use client'

import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'

export const clientOptimization = bindNextjsAppRouterClientOptimization({
  clientId: 'client-id',
  environment: 'main',
  locale: 'en-US',
  consent: {
    clientDefaults: { consent: false, persistenceConsent: false },
  },
})
```

The server binder uses `contentful` on server-capable paths and omits that client from serialized
client props. Keep any browser-only Contentful fetching explicitly app-owned.

The bound server `OptimizedEntry` accepts exactly one source: manual `baselineEntry`, managed
`entryId` with optional `entryQuery`, or a `managedEntry` object with `contentType`, `slug`, optional
`slugField`, and optional `entryQuery`. `slugField` defaults to `slug`. A successful slug lookup
renders and tracks with the fetched entry's `sys.id`. Invalid source combinations reject with
`Bound Next.js OptimizedEntry requires exactly one source: baselineEntry, entryId, or managedEntry.`

### Static, public, and analytics surfaces

Use the top-level server members, not `optimization.request`, for cacheable static routes,
app-owned public permutations, and analytics-only routes. These members use explicit inputs and do
not read `next/headers` or call `cookies()`.

Use `createPublicPermutationHandoff()` for app-owned public permutations rendered by App Router
Cache Components, Pages Router ISR, CDN-cached routes, or Edge runtime route handlers. The
application supplies the selected optimizations and public permutation dimensions. Request-derived
profile handoffs must use `private-request` cache scope.

```tsx
const handoff = optimization.createPublicPermutationHandoff({
  permutationKey: permutation.slug,
  cacheVersion: permutation.cacheVersion,
  locale: permutation.locale,
  entryIds: permutation.entryIds,
  selectedOptimizations: permutation.selectedOptimizations,
  hydration: 'preserve-server',
  initialPageEvent: 'emit',
})
```

Use the top-level `OptimizationAnalyticsRoot` for analytics-only routes. Render personalized content
on the server, attach tracking attributes from
`@contentful/optimization-nextjs/tracking-attributes`, and pass an `analytics-only` handoff to the
root.

### Manual request orchestration

Use the top-level `createRequestHandoff()` only when advanced orchestration needs explicit control
of the request, page payload, or handoff. Pass that handoff to the top-level root:

```tsx
import { cookies, headers } from 'next/headers'
import { optimization } from '@/lib/optimization'

const { OptimizationRoot } = optimization

export default async function Page() {
  const handoff = await optimization.createRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { route: '/products' } },
    request: {
      cookies: await cookies(),
      headers: new Headers(await headers()),
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

## Work before the initial page decision

Both client binders accept `beforeInitialPage` when browser identity or custom Experience event work
must finish before the bound content root's initial page decision. That decision is the root's one
choice to send the first browser page event or skip it because an applied handoff already owns that
route:

```tsx
'use client'

import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'

export const clientOptimization = bindNextjsAppRouterClientOptimization({
  clientId: 'client-id',
  environment: 'main',
  beforeInitialPage: {
    run: async ({ identify }) => {
      await identify({ userId: visitor.id })
    },
    onError: reportBeforeInitialPageError,
  },
})

export const { RequestOptimizationRoot: ClientRequestOptimizationRoot } = clientOptimization

export function OptimizationApp({ children, routeKey }) {
  return (
    <clientOptimization.OptimizationRoot
      routeKey={routeKey}
      buildPagePayload={() => ({ properties: { route: routeKey } })}
    >
      {children}
    </clientOptimization.OptimizationRoot>
  )
}
```

The direct App client `OptimizationRoot` requires those explicit route inputs. For the App Router
request family, inject the client request root with before-initial-page work into the server binder
instead:

```tsx
import 'server-only'

import { bindNextjsAppRouterServerOptimization } from '@contentful/optimization-nextjs/app-router/server'
import { ClientRequestOptimizationRoot } from './optimization-client'

export const optimization = bindNextjsAppRouterServerOptimization(serverConfig, {
  request: { OptimizationRoot: ClientRequestOptimizationRoot },
})

export const { OptimizationRoot: RequestOptimizationRoot } = optimization.request
```

`RequestOptimizationRoot` is part of the App client result with before-initial-page work; the result
without that work keeps its existing members.

The injected `RequestOptimizationRoot` derives `routeKey` and `buildPagePayload` from App Router
state and replaces the request family's default root. Mount it without
`RequestNextAppAutoPageTracker`; the injected root owns the direct initial page decision and later
route changes. The component reference crosses the server composition boundary, but the callback
remains in its client module and does not enter server config or Flight data.

The App server request family can accept its page event and put that ownership in the handoff. The
browser request root applies the handoff; after its live owned runtime exists, it invokes
`beforeInitialPage`, makes one direct page attempt or same-route handoff skip, marks the attempted
route, and emits for later route changes.

The Pages Router client binder uses the same option in its client-only module:

```tsx
import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

export const optimization = bindNextjsPagesRouterOptimization({
  clientId: 'client-id',
  environment: 'main',
  beforeInitialPage: {
    run: ({ identify }) => identify({ userId: visitor.id }),
  },
})
```

The client binder captures the callback and forwards it only to the bound content root. The callback
receives receiver-safe `identify`, `screen`, and `track` methods. It is not forwarded to the bound
`OptimizationProvider` or `OptimizationAnalyticsRoot`, and injected providers do not accept it.
For Pages Router requests, the server helper can accept the page event and record that ownership in
the handoff passed through page props. After the browser root applies that handoff and its live owned
runtime exists, it invokes `beforeInitialPage`, makes one direct page attempt or same-route handoff
skip, marks the attempted route, and emits for later route changes.

The `NextjsClientOptimizationConfigWithoutBeforeInitialPage` and
`NextjsClientOptimizationConfigWithBeforeInitialPage` branches derive from
`NextjsBoundRootConfig`, and the selected branch determines the bound root's page props. Without
`beforeInitialPage`, the existing optional page inputs remain available, including
`initialPagePayload`. With `beforeInitialPage`, the bound root requires `routeKey` and lazy
`buildPagePayload` and rejects `initialPagePayload`. A variable typed as the widened
`NextjsClientOptimizationConfig` uses this stricter before-initial-page root contract until the
config is narrowed before binding.

After the callback's returned work finishes or the watchdog expires, the root reads the latest route
and payload builder for one direct page attempt. A successfully applied same-route handoff can make
that direct decision a `skip`; otherwise, it attempts `emit`. After the attempt reaches a terminal
result, the existing page emitter makes a non-emitting initial `skip` mark for the attempted route,
then uses its normal `emit` path for later route changes. The before-initial-page root is the sole
page owner in its subtree. Direct App roots, injected App request roots, and Pages roots therefore
do not mount a separate `NextAppAutoPageTracker`, `RequestNextAppAutoPageTracker`, or
`NextPagesAutoPageTracker` on this path.

When `maxWaitMs` is omitted, it defaults to 3,000 ms. It accepts positive finite values. `0`,
negative values, `NaN`, `Infinity`, and `-Infinity` synchronously throw
`TypeError('beforeInitialPage.maxWaitMs must be a positive finite number.')` before the provider,
callback, page, or `onError` runs.

The sequence is best-effort. Return every promise or thenable that belongs to the
before-initial-page work. Fire-and-forget work is later activity, and the watchdog stops waiting
without canceling callback code or in-flight requests. While the root remains mounted and the same
live owned runtime is current, callback failure or watchdog expiry still leads to the direct page
attempt. If the root unmounts or its runtime is replaced, only unsent local page and readiness
continuation is suppressed.

A route change after the direct page attempt starts neither cancels that attempt nor starts a
competing attempt. The root settles and marks the captured attempted route before enabling later
page emission. A route observed only during the in-flight attempt is not emitted; a route change
after readiness emits normally. The existing entry deadline can commit fallback content first, and
default non-live behavior keeps that fallback frozen after the before-initial-page work later
succeeds.

Keep `beforeInitialPage` config in a client-only module. The App Router server config inherits, and
the Pages Router server binder uses, an explicit `beforeInitialPage?: never` boundary. Both server
binders reject an exported client-config variable that contains this callback. App request-root
injection passes a client component reference separately; it does not weaken that config boundary.
The Pages server binder neither runs the callback nor serializes it into the handoff passed through
page props. In App Router composition, the callback stays in its Client Component module and does
not enter Server Components, request config, Flight data, the handoff, cache state, ISR, or Edge
helpers.

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
`ctfl-opt-aid` on the `NextResponse` when persistence is allowed. Set
`request.trustedRequestHandoff` to `true` on the App Router server binding so the request family uses
the forwarded `profileId` without a second `page()` call and uses `pageAccepted` to avoid duplicate
first page events. For manual orchestration, pass `trustedRequestHandoff: true` to the top-level
`createRequestHandoff()` instead. Only opt in on routes covered by this configured request handler;
raw client-supplied `x-ctfl-opt-server-data` is ignored unless the route opts in.

Use `createNextjsPublicPermutationCacheMiddleware()` from
`@contentful/optimization-nextjs/cache-middleware` when proxy code needs public permutation
cache-key rewrites. The cache middleware is chainable with an existing `NextResponse`; it preserves
non-SDK response and request override state while removing stale SDK-owned `x-ctfl-opt-*` request
context before rewriting.
