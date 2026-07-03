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

| Runtime         | Import path                                           | Responsibility                                       |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Client          | `@contentful/optimization-nextjs/client`              | React SDK providers, hooks, components, and trackers |
| Schemas         | `@contentful/optimization-nextjs/api-schemas`         | Shared API types, schemas, and structural guards     |
| Server          | `@contentful/optimization-nextjs/server`              | Node SDK creation, request binding, and SSR wrapper  |
| ESR             | `@contentful/optimization-nextjs/esr`                 | Edge/request-rendered data and response persistence  |
| Request handler | `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request context forwarding     |
| Shared          | `@contentful/optimization-nextjs/tracking-attributes` | SSR `data-ctfl-*` tracking attributes                |

## Install

```sh
pnpm add @contentful/optimization-nextjs
```

Next.js, React, and React DOM are application-owned peer dependencies. The adapter uses the runtime
already installed by your app instead of installing its own copy.

## Server setup

Resolve the request Optimization data in a Server Component. Wrap it in React `cache()` so the
layout and pages share one call per request. Entry resolution is pure and runs on the server.

```tsx
import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

export const sdk = createNextjsOptimization({
  clientId: 'client-id',
  environment: 'main',
})

// One Experience `page()` call per request, shared across server components.
export const getServerOptimizationData = cache(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const { data } = await getNextjsServerOptimizationData(sdk, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: 'en-US',
  })
  return data
})
```

## Client setup

Mount `OptimizationRoot` in the App Router layout and pass the server data through
`serverOptimizationState`. The provider renders personalized state on the server (so the first paint
is correct even without JavaScript) and hydrates the live browser SDK with the same data on the
client.

```tsx
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import { getServerOptimizationData } from '@/lib/optimization'
import { Suspense, type ReactNode } from 'react'

export default async function RootLayout({ children }: { children: ReactNode }) {
  const serverOptimizationState = await getServerOptimizationData()

  return (
    <OptimizationRoot
      clientId="client-id"
      environment="main"
      defaults={{ consent: true }}
      serverOptimizationState={serverOptimizationState}
    >
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

## Rendering optimized entries

Render entries with the isomorphic `OptimizedEntry`. It resolves the variant on the server for first
paint, emits the tracking attributes the browser observes, and hydrates for interaction tracking and
live updates — one component in both environments.

```tsx
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
;<OptimizedEntry baselineEntry={entry}>
  {(resolvedEntry) => <h2>{String(resolvedEntry.fields.title ?? '')}</h2>}
</OptimizedEntry>
```

> [!NOTE]
>
> `ServerOptimizedEntry` is deprecated. Pass server data through the provider's
> `serverOptimizationState` prop and render entries with `OptimizedEntry`. To seed a
> configuration-only provider and hydrate page-specific data later, call `hydrateOptimizationData`
> from `@contentful/optimization-web/bridge-support` inside a Client Component.
> `ServerOptimizedEntry` remains for pure zero-JavaScript Server Component rendering where you
> resolve `resolvedData` yourself.

## Request context setup

```ts
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()
```

The returned handler can be exported from `middleware.ts` or `proxy.ts`. It forwards sanitized
request context headers, including the SDK-owned request URL header that
`getNextjsServerOptimizationData()` reads when you pass `headers()`. It does not call `page()`,
resolve consent, or write response cookies.

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
