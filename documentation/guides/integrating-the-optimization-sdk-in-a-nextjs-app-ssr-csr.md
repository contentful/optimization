# Integrating the Optimization SDK in a Next.js app (hybrid SSR + CSR takeover)

Use this guide when you want to personalize a Next.js App Router application where the first page
load is server-resolved (no flicker, SEO-friendly) and subsequent client-side interactions such as
identify, consent, and profile reset re-resolve entries immediately without a page refresh.

If instant post-identify reactivity is not required and you prefer the simpler mental model where
the server is always the sole source of truth, use the
[SSR-primary guide](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md) instead.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Install the packages](#1-install-the-packages)
- [2. Create the Node SDK singleton and a cached page helper](#2-create-the-node-sdk-singleton-and-a-cached-page-helper)
- [3. Set up the anonymous ID cookie in middleware](#3-set-up-the-anonymous-id-cookie-in-middleware)
- [4. Resolve entries on the server for first paint](#4-resolve-entries-on-the-server-for-first-paint)
  - [Add data attributes for client-side tracking](#add-data-attributes-for-client-side-tracking)
- [5. Seed the React Web SDK with server-resolved state](#5-seed-the-react-web-sdk-with-server-resolved-state)
  - [Pass defaults from the server layout](#pass-defaults-from-the-server-layout)
- [6. Re-resolve entries client-side after hydration](#6-re-resolve-entries-client-side-after-hydration)
  - [Subscribing to selectedOptimizations](#subscribing-to-selectedoptimizations)
  - [Using OptimizedEntry for fully reactive entries](#using-optimizedentry-for-fully-reactive-entries)
- [7. Handle consent and identify from client components](#7-handle-consent-and-identify-from-client-components)
- [Understand when personalization updates](#understand-when-personalization-updates)
- [Known gap: redundant Experience API call on hydration](#known-gap-redundant-experience-api-call-on-hydration)
- [Choosing between SSR-primary and hybrid patterns per route](#choosing-between-ssr-primary-and-hybrid-patterns-per-route)
- [The server and client SDK boundary](#the-server-and-client-sdk-boundary)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The hybrid SSR + CSR takeover pattern uses the same two packages as the SSR-primary pattern, but
gives the React Web SDK a more active role after hydration:

- `@contentful/optimization-node` — stateless, server-side. Resolves entry variants before the HTML
  response leaves the server. Also used to seed initial optimization state into the client provider.
- `@contentful/optimization-react-web` — stateful, browser-side. After hydration, takes over entry
  resolution so that profile changes (consent, identify, reset) immediately re-resolve which variant
  to render without a server roundtrip.

What this setup gives you:

- No flicker on first paint. The initial HTML contains server-resolved personalized content.
- Instant reactivity after hydration. Calling `sdk.identify()`, `sdk.consent()`, or `sdk.reset()`
  immediately updates the resolved entries on screen.
- SPA-style navigation. After the first server request, subsequent `<Link>` navigations resolve
  variants client-side.
- Mixed per-route strategy. High-SEO pages (homepage, landing pages) can remain Server Components
  with Node SDK resolution. Interactive pages (dashboard, account settings) can be Client Components
  with React Web SDK resolution.

What it does not give you (compared to the SSR-primary pattern):

- Simplified mental model. There are now two resolution paths — the server path for first paint and
  the client path for subsequent interactions. Bugs that appear only after hydration can be harder
  to reproduce.
- A fully server-authoritative content model. After hydration, the client SDK decides what to render
  based on its own state. The server and client can briefly disagree if the client SDK has not yet
  finished its initial API call.

## The integration flow

| Concern                    | First paint (server)                              | After hydration (client)                         |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Profile resolution         | Middleware + Server Component (Node SDK)          | React Web SDK (automatic on init)                |
| Entry resolution           | `sdk.resolveOptimizedEntry()` in Server Component | `resolveEntry()` via `useOptimization()` hook    |
| Entry fetching             | Server-side from Contentful                       | Client-side from Contentful (for new routes)     |
| Page tracking              | N/A                                               | `NextAppAutoPageTracker` fires on route change   |
| Interaction tracking       | N/A (data attributes rendered server-side)        | `autoTrackEntryInteraction` observes elements    |
| Consent / identify / reset | N/A                                               | React Web SDK — triggers immediate re-resolution |

In practice, the integration follows this sequence:

1. Create one Node SDK instance shared across Server Components and middleware.
2. Use Next.js middleware to maintain the anonymous ID cookie on every request.
3. In the server layout, call `sdk.page()` once and pass the result as `defaults` into the client
   provider.
4. In Server Component pages, use `sdk.resolveOptimizedEntry()` for first-paint content.
5. In Client Component pages or components, use `resolveEntry()` from `useOptimization()` for
   reactive content.
6. Load the React Web SDK with `next/dynamic` and `ssr: false`.
7. Use Client Components for consent, identify, and any interactive SDK controls.

The hybrid reference implementation in this repository shows that pattern in a working application:

- [`implementations/react-web-sdk+node-sdk_nextjs-ssr-csr`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/README.md)

## 1. Install the packages

```sh
pnpm add @contentful/optimization-node @contentful/optimization-react-web
```

## 2. Create the Node SDK singleton and a cached page helper

Create the SDK once at module level, then wrap `sdk.page()` in React's `cache()` function so that
multiple Server Components on the same request share a single API call:

```ts
// lib/optimization-server.ts
import ContentfulOptimization from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

const sdk = new ContentfulOptimization({
  clientId: process.env.CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
  environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  api: {
    experienceBaseUrl: process.env.CONTENTFUL_EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: process.env.CONTENTFUL_INSIGHTS_API_BASE_URL,
  },
  app: {
    name: 'my-next-app',
    version: '1.0.0',
  },
  logLevel: 'error',
})

const getOptimizationData = cache(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  return sdk.page({
    locale: headerStore.get('accept-language')?.split(',')[0] ?? 'en-US',
    userAgent: headerStore.get('user-agent') ?? 'next-js-server',
    profile,
  })
})

export { sdk, getOptimizationData }
```

`cache()` is a React Server Component primitive that deduplicates calls within a single render pass.
Both the layout and the page can call `getOptimizationData()` and only one HTTP request to the
Experience API is made per server request. This is more important in the hybrid pattern than in the
SSR-primary pattern because the layout also needs the data to seed the client provider.

## 3. Set up the anonymous ID cookie in middleware

This step is identical to the SSR-primary pattern. Middleware runs before every request and ensures
the anonymous ID cookie is set before any Server Component reads it:

```ts
// middleware.ts
import { sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const anonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  const url = new URL(request.url)
  const data = await sdk.page({
    locale: request.headers.get('accept-language')?.split(',')[0] ?? 'en-US',
    userAgent: request.headers.get('user-agent') ?? 'next-js-server',
    page: {
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      referrer: request.headers.get('referer') ?? '',
      search: url.search,
      url: request.url,
    },
    profile,
  })

  const response = NextResponse.next()

  if (data.profile.id) {
    response.cookies.set(ANONYMOUS_ID_COOKIE, data.profile.id, {
      path: '/',
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

The `ANONYMOUS_ID_COOKIE` constant is shared between the Node SDK and the React Web SDK. After
hydration, the Web SDK reads the same cookie from `document.cookie` and continues the same anonymous
profile journey. Do not mark this cookie as `HttpOnly`.

## 4. Resolve entries on the server for first paint

In Server Component pages, resolve entries the same way as the SSR-primary pattern:

```tsx
// app/page.tsx
import { sdk, getOptimizationData } from '@/lib/optimization-server'

export default async function Home() {
  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntriesFromContentful(),
    getOptimizationData(),
  ])

  const resolvedEntries = baselineEntries.map((entry) => {
    const { entry: resolved } = sdk.resolveOptimizedEntry(
      entry,
      optimizationData.selectedOptimizations,
    )
    return resolved
  })

  return (
    <main>
      <HybridEntryList baselineEntries={baselineEntries} serverResolvedEntries={resolvedEntries} />
    </main>
  )
}
```

`HybridEntryList` is a Client Component (described in step 6) that receives both the baseline
entries and the server-resolved entries. It renders the server-resolved entries immediately, then
switches to the client-resolved versions once the React Web SDK is ready.

### Add data attributes for client-side tracking

Include `data-ctfl-entry-id` and `data-ctfl-baseline-id` on the wrapper element so the React Web SDK
can register interaction trackers after hydration:

```tsx
<div data-ctfl-entry-id={resolvedEntry.sys.id} data-ctfl-baseline-id={baselineEntry.sys.id}>
  {resolvedEntry.fields.title}
</div>
```

## 5. Seed the React Web SDK with server-resolved state

The key difference from the SSR-primary pattern is passing `defaults` to `OptimizationRoot`. This
seeds the client SDK with the profile and `selectedOptimizations` the server already resolved, which
allows `resolveEntry()` calls in Client Components to return immediately on the first render after
hydration.

Create the client wrapper component:

```tsx
// components/ClientProviderWrapper.tsx
'use client'

import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'
import type {
  Profile,
  SelectedOptimizationArray,
  ChangeArray,
} from '@contentful/optimization-react-web/api-schemas'

const OptimizationRoot = dynamic(
  () =>
    import('@contentful/optimization-react-web').then((mod) => ({
      default: mod.OptimizationRoot,
    })),
  { ssr: false },
)

const NextAppAutoPageTracker = dynamic(
  () =>
    import('@contentful/optimization-react-web/router/next-app').then((mod) => ({
      default: mod.NextAppAutoPageTracker,
    })),
  { ssr: false },
)

interface ClientProviderWrapperProps {
  children: ReactNode
  defaults?: {
    profile?: Profile
    selectedOptimizations?: SelectedOptimizationArray
    changes?: ChangeArray
  }
}

export function ClientProviderWrapper({ children, defaults }: ClientProviderWrapperProps) {
  return (
    <OptimizationRoot
      clientId={process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? ''}
      environment={process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
      autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      logLevel="error"
      defaults={defaults}
    >
      <Suspense>
        <NextAppAutoPageTracker />
      </Suspense>
      {children}
    </OptimizationRoot>
  )
}
```

### Pass defaults from the server layout

The layout is a Server Component and can call `getOptimizationData()` to fetch the optimization
state for the current request. Pass that data to `ClientProviderWrapper` as `defaults`:

```tsx
// app/layout.tsx
import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { getOptimizationData } from '@/lib/optimization-server'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const optimizationData = await getOptimizationData()

  return (
    <html lang="en">
      <body>
        <ClientProviderWrapper
          defaults={{
            profile: optimizationData.profile,
            selectedOptimizations: optimizationData.selectedOptimizations,
            changes: optimizationData.changes,
          }}
        >
          {children}
        </ClientProviderWrapper>
      </body>
    </html>
  )
}
```

Because `getOptimizationData()` is wrapped with `cache()`, calling it in the layout and in a page
Server Component on the same request makes only one API call to the Experience API.

## 6. Re-resolve entries client-side after hydration

Client Components that need to re-resolve entries when the profile changes subscribe to
`selectedOptimizations` and call `resolveEntry()` directly:

```tsx
// components/HybridEntry.tsx
'use client'

import { useOptimization, useOptimizationContext } from '@contentful/optimization-react-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-react-web/api-schemas'
import { useEffect, useState } from 'react'

function HybridEntry({
  baselineEntry,
  serverResolvedEntry,
}: {
  baselineEntry: ContentEntry
  serverResolvedEntry: ContentEntry
}) {
  const { sdk, isReady } = useOptimizationContext()
  const { resolveEntry } = useOptimization()
  const [selectedOptimizations, setSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)

  useEffect(() => {
    if (!sdk || !isReady) return

    const subscription = sdk.states.selectedOptimizations.subscribe(setSelectedOptimizations)

    return () => subscription.unsubscribe()
  }, [sdk, isReady])

  const clientReady = isReady && selectedOptimizations !== undefined
  const resolvedEntry = clientReady
    ? resolveEntry(baselineEntry, selectedOptimizations)
    : serverResolvedEntry

  return (
    <div data-ctfl-entry-id={resolvedEntry.sys.id} data-ctfl-baseline-id={baselineEntry.sys.id}>
      <p>{resolvedEntry.fields.title}</p>
    </div>
  )
}
```

The component uses `serverResolvedEntry` as the initial render value. This ensures the content
matches what the server rendered while the Web SDK initializes. Once `isReady` is `true` and
`selectedOptimizations` is populated (either from `defaults` or from the Web SDK's first API call),
the component switches to `resolveEntry()` for all subsequent resolution.

After this point, calling `sdk.identify()`, `sdk.consent()`, or `sdk.reset()` updates
`selectedOptimizations` in the SDK state, which triggers the `subscribe` callback, which updates
`selectedOptimizations` in component state, which causes `resolveEntry()` to run again with the
updated data. The result is immediate content re-resolution without a server roundtrip.

### Subscribing to selectedOptimizations

The subscription in the example above is the low-level imperative approach. It gives you full
control over when to switch from server to client resolution, but requires more component state
management.

### Using OptimizedEntry for fully reactive entries

For pages or components where all entries should be client-side reactive (for example, an
interactive dashboard that does not need the SSR-first-paint guarantee), use `OptimizedEntry` with
`liveUpdates` enabled instead:

```tsx
'use client'

import { OptimizedEntry } from '@contentful/optimization-react-web'

function ReactiveSection({ baselineEntry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={true}>
      {(resolved) => <Card entry={resolved} />}
    </OptimizedEntry>
  )
}
```

`OptimizedEntry` with `liveUpdates={true}` continuously re-resolves when `selectedOptimizations`
changes. This is the right choice for sections of the page that do not need the SSR handoff logic.

## 7. Handle consent and identify from client components

Consent and identify controls are identical to the SSR-primary pattern. Create a Client Component
that reads the SDK state and exposes controls:

```tsx
// components/InteractiveControls.tsx
'use client'

import { useOptimizationContext } from '@contentful/optimization-react-web'
import { useEffect, useState } from 'react'

export function InteractiveControls() {
  const { sdk, isReady } = useOptimizationContext()
  const [consent, setConsent] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!sdk || !isReady) return

    const sub = sdk.states.consent.subscribe(setConsent)

    return () => sub.unsubscribe()
  }, [sdk, isReady])

  if (!sdk || !isReady) return null

  return (
    <div>
      <button onClick={() => sdk.consent(consent !== true)}>
        {consent === true ? 'Reject consent' : 'Accept consent'}
      </button>
      <button onClick={() => sdk.identify({ userId: 'user-123' })}>Identify</button>
      <button onClick={() => sdk.reset()}>Reset profile</button>
    </div>
  )
}
```

In this pattern, unlike the SSR-primary pattern, calling `sdk.identify()` or `sdk.consent()`
immediately updates `selectedOptimizations` in the client SDK, which causes all Client Components
subscribed to that state to re-render with the new variant. No page refresh is required.

## Understand when personalization updates

| User action                        | Effect on displayed content                         | When it takes effect       |
| ---------------------------------- | --------------------------------------------------- | -------------------------- |
| First page load                    | Server-resolved personalized HTML                   | Immediate (in HTML)        |
| After hydration (same page)        | No change — server content stays until SDK is ready | Seamless                   |
| Accept or reject consent           | Client Components re-resolve with updated profile   | Instant (client-side)      |
| Identify (`sdk.identify()`)        | Client Components re-resolve with updated profile   | Instant (client-side)      |
| Reset (`sdk.reset()`)              | Client Components re-resolve with updated profile   | Instant (client-side)      |
| Navigate via `<Link>`              | New page entries resolved client-side               | Fast (no server roundtrip) |
| Browser refresh or full navigation | Back to server-resolved first paint                 | Immediate (new SSR)        |

## Known gap: redundant Experience API call on hydration

`OptimizationRoot` always initializes a fresh Web SDK instance that calls the Experience API to
fetch `selectedOptimizations`. This is the same data the server already resolved and passed as
`defaults`.

The `defaults` prop seeds the initial state so that `resolveEntry()` works immediately on first
render. However, the Web SDK still makes its own API call in the background to establish a live,
reactive state for subsequent profile changes.

**Impact:** There is a brief window after hydration where both server-resolved defaults and the
client's own API call may be in flight simultaneously. The `defaults` prop ensures content appears
correct during this window (no flicker), but be aware that the client API call will overwrite the
default state once it resolves.

**Mitigation:** If the Experience API call latency is a concern, test whether the `defaults` prop
fully prevents any visible content change. In most cases, because the server and client resolve
against the same profile (via the shared cookie), the API call returns the same
`selectedOptimizations` and the effective displayed content is identical.

## Choosing between SSR-primary and hybrid patterns per route

The App Router lets you choose the strategy per-route. You can use the Node SDK for Server Component
routes and the React Web SDK for Client Component routes within the same application:

- **Server Component routes (Node SDK):** homepage, landing pages, SEO-critical content. Use
  `sdk.resolveOptimizedEntry()` for first-paint content. Best for routes where personalization
  decisions are based on stable profile traits, not real-time interactions.
- **Client Component routes (React Web SDK):** interactive dashboards, account pages, flows where
  `identify` or consent changes must be reflected immediately. Use `resolveEntry()` or
  `OptimizedEntry` with `liveUpdates={true}`.

Mixed-strategy applications are valid and can use a single `ClientProviderWrapper` in the root
layout to provide the React Web SDK to all client-component subtrees.

## The server and client SDK boundary

As with the SSR-primary pattern, keep this boundary strict:

- Server Components import only from `@contentful/optimization-node`.
- Client Components (`'use client'`) import only from `@contentful/optimization-react-web`.

Any file that imports from `@contentful/optimization-react-web` must begin with `'use client'`, or
it must only be imported by files that do. Importing the React Web SDK in a Server Component causes
runtime errors because the SDK accesses browser globals at import time.

## Reference implementations to compare against

- [`implementations/react-web-sdk+node-sdk_nextjs-ssr-csr`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/README.md):
  working Next.js App Router application using the hybrid SSR + CSR takeover pattern.
  - [`middleware.ts`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/middleware.ts):
    Edge Runtime cookie lifecycle
  - [`lib/optimization-server.ts`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/lib/optimization-server.ts):
    Node SDK singleton with `cache()`-wrapped `getOptimizationData()`
  - [`app/layout.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/app/layout.tsx):
    Server Component layout that fetches defaults and passes them to the client provider
  - [`app/page.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/app/page.tsx):
    Server Component page resolving entries for first paint
  - [`components/ClientProviderWrapper.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/components/ClientProviderWrapper.tsx):
    dynamic React Web SDK provider with `defaults` prop
  - [`components/HybridEntryList.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr-csr/components/HybridEntryList.tsx):
    Client Component switching between server-resolved and client-resolved entries
