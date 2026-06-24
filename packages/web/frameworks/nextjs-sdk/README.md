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
| Server          | `@contentful/optimization-nextjs/server`              | Node SDK creation, request binding, and SSR wrapper  |
| Request handler | `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request composition            |
| Shared          | `@contentful/optimization-nextjs/tracking-attributes` | SSR `data-ctfl-*` tracking attributes                |

## Install

```sh
pnpm add @contentful/optimization-nextjs
```

Next.js, React, and React DOM are application-owned peer dependencies. The adapter uses the runtime
already installed by your app instead of installing its own copy.

## Server setup

```tsx
import {
  ServerOptimizedEntry,
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
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

  return (
    <ServerOptimizedEntry baselineEntry={entry} resolvedData={resolvedData}>
      {resolvedData.entry.fields.title}
    </ServerOptimizedEntry>
  )
}
```

## Client setup

```tsx
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OptimizationRoot clientId="client-id" environment="main">
      <NextAppAutoPageTracker initialPageEvent="skip" />
      {children}
    </OptimizationRoot>
  )
}
```

Use `initialPageEvent="skip"` only when the server already called `page()` for the same initial
route. Route changes still emit normally.

## Request setup

```ts
import { optimization } from '@/lib/optimization-server'
import { createNextjsOptimizationRequestHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationRequestHandler(optimization, {
  getLocale: () => 'en-US',
  resolveConsent: () => ({ events: true, persistence: true }),
})
```

The returned handler can be exported from `middleware.ts` or `proxy.ts`. It can also compose with
another request-layer handler by accepting and returning the same `NextResponse`.
