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
pnpm add @contentful/optimization-nextjs contentful
```

Next.js, React, and React DOM are application-owned peer dependencies. The adapter uses the runtime
already installed by your app instead of installing its own copy. The `contentful` package is the
app-owned CDA client used by the managed entry fetching example.

## Server setup

```tsx
import {
  ServerOptimizedEntry,
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { NextjsOptimizationState } from '@contentful/optimization-nextjs/client'
import { createClient } from 'contentful'
import { cookies, headers } from 'next/headers'

const contentfulClient = createClient({
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
  space: process.env.CONTENTFUL_SPACE_ID!,
})

const sdk = createNextjsOptimization({
  clientId: 'client-id',
  contentful: { client: contentfulClient },
  environment: 'main',
  locale: 'en-US',
})

export default async function Page() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const { data, requestOptimization } = await getNextjsServerOptimizationData(sdk, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: 'en-US',
  })

  const result = await requestOptimization.fetchOptimizedEntry('hero-entry')

  return (
    <>
      <NextjsOptimizationState data={data} />
      <ServerOptimizedEntry result={result}>{result.entry.fields.title}</ServerOptimizedEntry>
    </>
  )
}
```

`ServerOptimizedEntry` also keeps the manual `baselineEntry` plus `resolvedData` props for apps that
fetch Contentful entries outside the SDK.

`NextjsOptimizationState` must render under SDK context. That context can come from
`OptimizationRoot` or `OptimizationProvider`, commonly mounted in a shared App Router layout.

## Client setup

```tsx
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
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

Use `serverOptimizationState={data}` on `OptimizationRoot` or `OptimizationProvider` when that
provider or root receives the server Optimization data directly:

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

When a shared App Router layout owns the SDK context and a page owns the server data, render
`NextjsOptimizationState` under that context near the server-rendered optimized content:

```tsx
<NextjsOptimizationState data={data} />
```

Keep `defaults` for configuration or default state such as consent. Pass server-returned profile,
selected optimizations, and changes through `serverOptimizationState` or `NextjsOptimizationState`.

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
