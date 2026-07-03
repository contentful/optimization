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

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

`@contentful/optimization-nextjs` is a thin adapter for Next.js applications. It composes the Node
SDK on the server with the React Web SDK on the client; it is not a new optimization runtime.

## What this package provides

| Runtime         | Import path                                           | Responsibility                                            |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| App Router      | `@contentful/optimization-nextjs/app-router`          | Bound App Router components and SDK proxy                 |
| Pages Router    | `@contentful/optimization-nextjs/pages-router`        | Bound Pages Router client component factory               |
| Pages server    | `@contentful/optimization-nextjs/pages-router/server` | Config-bound `getServerSideProps` state handoff           |
| Client          | `@contentful/optimization-nextjs/client`              | Router-neutral React SDK providers, hooks, and components |
| Schemas         | `@contentful/optimization-nextjs/api-schemas`         | Shared API types, schemas, and structural guards          |
| Server          | `@contentful/optimization-nextjs/server`              | Node SDK creation, request binding, and state handoff     |
| ESR             | `@contentful/optimization-nextjs/esr`                 | Edge/request-rendered data and response persistence       |
| Request handler | `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request context forwarding          |
| Shared          | `@contentful/optimization-nextjs/tracking-attributes` | SSR `data-ctfl-*` tracking attributes                     |

## Install

```sh
pnpm add @contentful/optimization-nextjs
```

Next.js, React, and React DOM are application-owned peer dependencies. The adapter uses the runtime
already installed by your app instead of installing its own copy.

## App Router setup

Start App Router integrations from `/app-router` and define app-local bound exports once. Next.js
resolves that import to the automatic server implementation for Server Components and to the client
implementation for Client Components.

```tsx
import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'
import { getAppConsent } from './consent'

export const {
  proxy,
  NextAppAutoPageTracker,
  OptimizationProvider,
  OptimizationRoot,
  OptimizedEntry,
} = createNextjsAppRouterOptimization({
  clientId: 'client-id',
  environment: 'main',
  locale: 'en-US',
  defaults: { consent: false, persistenceConsent: false },
  server: {
    enabled: true,
    consent: ({ cookies }) =>
      getAppConsent(cookies) ? { events: true, persistence: true } : false,
  },
})
```

`server.consent` is required when `server.enabled` is `true`. It can be a consent value or a
resolver that receives the values read from the proxy request cookies and headers.

Export the SDK proxy from `proxy.ts` and declare the matcher as a literal Next.js config object so
Next.js can statically analyze it. The SDK proxy calls `page()`, persists `ctfl-opt-aid`, and
forwards server state before Server Components render:

```ts
export { proxy } from '@/lib/optimization'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

Use the bound root in an App Router layout:

```tsx
import { getAppConsent } from '@/lib/consent'
import { NextAppAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import { cookies } from 'next/headers'
import { Suspense, type ReactNode } from 'react'

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const appConsent = getAppConsent(cookieStore)

  return (
    <OptimizationRoot>
      <Suspense>
        <NextAppAutoPageTracker initialPageEvent={appConsent ? 'skip' : 'emit'} />
      </Suspense>
      {children}
    </OptimizationRoot>
  )
}
```

Use the same app-local `OptimizedEntry` name on either side of the component boundary:

```tsx
import { OptimizedEntry } from '@/lib/optimization'

export function ServerEntry({ entry }) {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolvedEntry, { getMergeTagValue }) => (
        <EntryCard entry={resolvedEntry} getMergeTagValue={getMergeTagValue} />
      )}
    </OptimizedEntry>
  )
}
```

A file without `'use client'` gets server-resolved first paint through the Node SDK. The bound root
and provider pass server data as `serverOptimizationState`, and the bound `OptimizedEntry` resolves
through the server SDK. A file with `'use client'` gets browser resolution and live updates through
the React Web SDK with server-only config removed. `OptimizedEntry` render props receive
`(resolvedEntry, { getMergeTagValue })` in both cases. The automatic API accepts config props only;
it does not accept injected SDK instances.

## Pages Router setup

Start Pages Router integrations from `/pages-router` and pass server state through `_app.tsx`
because `getServerSideProps` delivers it through `pageProps`.

```tsx
import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

export const { NextPagesAutoPageTracker, OptimizationProvider, OptimizationRoot, OptimizedEntry } =
  createNextjsPagesRouterOptimization({
    clientId: 'client-id',
    environment: 'main',
    locale: 'en-US',
    defaults: { consent: false, persistenceConsent: false },
  })
```

Use the bound root and tracker in `pages/_app.tsx`:

```tsx
import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  const contentfulOptimization = pageProps.contentfulOptimization

  return (
    <OptimizationRoot
      clientDefaults={contentfulOptimization?.clientDefaults}
      serverOptimizationState={contentfulOptimization?.serverOptimizationState}
    >
      <NextPagesAutoPageTracker initialPageEvent={contentfulOptimization?.initialPageEvent} />
      <Component {...pageProps} />
    </OptimizationRoot>
  )
}
```

Use the config-bound server helper from `getServerSideProps` on personalized Pages routes:

```tsx
import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router/server'

const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
  clientId: 'client-id',
  environment: 'main',
  server: {
    consent: { events: true, persistence: true },
  },
})

export async function getServerSideProps(context) {
  const optimization = await getServerSideOptimizationProps(context)

  return { props: optimization.props }
}
```

The Pages helper builds request context from the `getServerSideProps` context, calls `page()`
through the request-bound SDK, writes or clears `ctfl-opt-aid` on the response, and returns
serializable `props.contentfulOptimization`. Its default `initialPageEvent` is `skip` only when the
server already emitted a consented page event; pre-consent server resolution still emits the initial
browser page event so client-side tracking state starts populated.

## Manual server setup

Use `/server` helpers only when an application needs direct Node SDK request control instead of a
router-specific bound setup.

```tsx
import { OptimizationRoot } from '@contentful/optimization-nextjs/client'
import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'
import { cookies, headers } from 'next/headers'

const sdk = createNextjsOptimization({
  clientId: 'client-id',
  environment: 'main',
})

export default async function Page() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const { data } = await getNextjsServerOptimizationData(sdk, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: 'en-US',
  })

  const resolvedData = sdk.resolveOptimizedEntry(entry, data?.selectedOptimizations)
  const trackingAttributes = getServerTrackingAttributes(entry, resolvedData)

  return (
    <OptimizationRoot clientId="client-id" environment="main" serverOptimizationState={data}>
      <div {...trackingAttributes}>{resolvedData.entry.fields.title}</div>
    </OptimizationRoot>
  )
}
```

## Manual client setup

Use `/client` imports when a client-only provider must be wired manually. App Router layouts that
use the bound root import do not need this setup.

```tsx
import { NextAppAutoPageTracker } from '@contentful/optimization-nextjs/app-router'
import { OptimizationRoot } from '@contentful/optimization-nextjs/client'
import { Suspense, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OptimizationRoot clientId="client-id" environment="main">
      <Suspense>
        <NextAppAutoPageTracker initialPageEvent="skip" />
      </Suspense>
      {children}
    </OptimizationRoot>
  )
}
```

Use `initialPageEvent="skip"` only when the server already called `page()` for the same initial
route. Route changes still emit normally.

## Server-to-browser state handoff

App Router bound roots and providers pass `serverOptimizationState` from Server Components. Pages
Router bound roots and providers accept it at render time from `pageProps`. In manual server/client
setups, use `serverOptimizationState={data}` on `OptimizationRoot` or `OptimizationProvider` when
that provider or root receives the server Optimization data directly:

```tsx
<OptimizationRoot
  clientId="client-id"
  environment="main"
  defaults={{ consent: true }}
  serverOptimizationState={data}
>
  {children}
</OptimizationRoot>
```

Keep `defaults` for configuration or default state such as consent. Pass server-returned profile,
selected optimizations, and changes through `serverOptimizationState`.

## Request context setup

```ts
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()
```

The returned handler can be exported from `middleware.ts` or `proxy.ts`. It forwards sanitized
request context headers, including the SDK-owned request URL header that the bound and manual server
paths read from `headers()`. It does not call `page()`, resolve consent, or write response cookies.

## Edge/request-rendered personalization

Use the ESR helper when a route handler, edge function, or request-rendered surface owns both the
incoming `Request` and outgoing `Response` instead of using App Router `cookies()` and `headers()`
as the integration boundary:

```ts
import { getNextjsEsrOptimizationData } from '@contentful/optimization-nextjs/esr'
import { createNextjsOptimization } from '@contentful/optimization-nextjs/server'

const sdk = createNextjsOptimization({
  clientId: 'client-id',
  environment: 'main',
})

export async function GET(request: Request) {
  const esr = await getNextjsEsrOptimizationData(sdk, {
    consent: { events: true, persistence: true },
    locale: 'en-US',
    request,
  })

  const response = new Response(renderHtml(esr.data), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })

  esr.persist(response)

  return response
}
```

The ESR helper derives page context from `request.url`, reads `ctfl-opt-aid` from request cookies
when available, calls `page()`, and returns an object containing `data`, `requestOptimization`, and
`persist()`. Call `persist(response)` only after your application creates the response that is safe
to personalize and not shared across visitors.
