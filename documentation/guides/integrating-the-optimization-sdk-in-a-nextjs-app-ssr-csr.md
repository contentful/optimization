# Integrating the Optimization SDK in a Next.js app (hybrid SSR + CSR takeover)

Use this guide when you want to personalize a Next.js App Router application where the first page
load is server-resolved (no flicker, SEO-friendly) and subsequent client-side interactions such as
identify, consent, and profile reset re-resolve entries immediately without a page refresh.

If instant post-identify reactivity is not required and you prefer the simpler mental model where
the server is always the sole source of truth, use the
[SSR guide](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md) instead.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Install the packages](#1-install-the-packages)
- [2. Create the Node SDK singleton and a cached page helper](#2-create-the-node-sdk-singleton-and-a-cached-page-helper)
- [3. Set up the anonymous ID cookie in proxy](#3-set-up-the-anonymous-id-cookie-in-proxy)
- [4. Resolve entries on the server for first paint](#4-resolve-entries-on-the-server-for-first-paint)
  - [Add data attributes for client-side tracking](#add-data-attributes-for-client-side-tracking)
- [5. Seed the React Web SDK with server-resolved state](#5-seed-the-react-web-sdk-with-server-resolved-state)
  - [Pass defaults from the server layout](#pass-defaults-from-the-server-layout)
- [6. Re-resolve entries client-side after hydration](#6-re-resolve-entries-client-side-after-hydration)
- [7. Handle consent and identify from client components](#7-handle-consent-and-identify-from-client-components)
- [Forward optimization context to third-party analytics](#forward-optimization-context-to-third-party-analytics)
- [Understand when personalization updates](#understand-when-personalization-updates)
- [Known gap: redundant Experience API call on hydration](#known-gap-redundant-experience-api-call-on-hydration)
- [Choosing between SSR and hybrid patterns per route](#choosing-between-ssr-and-hybrid-patterns-per-route)
- [The server and client SDK boundary](#the-server-and-client-sdk-boundary)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The hybrid SSR + CSR takeover pattern uses the same two packages as the SSR pattern, but gives the
React Web SDK a more active role after hydration:

- `@contentful/optimization-node` — stateless, server-side. Resolves entry variants before the HTML
  response leaves the server. Also used to seed initial optimization state into `OptimizationRoot`.
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

What it does not give you (compared to the SSR pattern):

- Simplified mental model. There are now two resolution paths — the server path for first paint and
  the client path for subsequent interactions. Bugs that appear only after hydration can be harder
  to reproduce.
- A fully server-authoritative content model. After hydration, the client SDK decides what to render
  based on its own state. The server and client can briefly disagree if the client SDK has not yet
  finished its initial API call.

## The integration flow

| Concern                    | First paint (server)                              | After hydration (client)                         |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Profile resolution         | Proxy + Server Component (Node SDK)               | React Web SDK (automatic on init)                |
| Entry resolution           | `sdk.resolveOptimizedEntry()` in Server Component | `OptimizedEntry` with `liveUpdates={true}`       |
| Entry fetching             | Server-side from Contentful                       | Client-side from Contentful (for new routes)     |
| Page tracking              | N/A                                               | `NextAppAutoPageTracker` fires on route change   |
| Interaction tracking       | N/A (data attributes rendered server-side)        | `trackEntryInteraction` observes elements        |
| Consent / identify / reset | N/A                                               | React Web SDK — triggers immediate re-resolution |

In practice, the integration follows this sequence:

1. Create one Node SDK instance shared across Server Components and proxy.
2. Use Next.js proxy to maintain the anonymous ID cookie when application policy permits profile
   continuity.
3. In the server layout, bind request-scoped consent with `sdk.forRequest()`; the examples below use
   accepted consent for a default-on policy and pass the result as `defaults` into
   `OptimizationRoot`.
4. In Server Component pages, use `sdk.resolveOptimizedEntry()` for first-paint content.
5. In Client Component pages or components, use `OptimizedEntry` with `liveUpdates={true}` for
   reactive content.
6. Import the React Web SDK's Next-compatible client entrypoints directly in your layout.
7. Use Client Components for consent, identify, and any interactive SDK controls.

The hybrid reference implementation in this repository shows that pattern in a working application:

- [`implementations/nextjs-sdk_hybrid`](../../implementations/nextjs-sdk_hybrid/README.md)

## 1. Install the packages

```sh
pnpm add @contentful/optimization-node @contentful/optimization-react-web
```

## 2. Create the Node SDK singleton and a cached page helper

Create the SDK once at module level, then wrap the consent-allowed request-bound page call in
React's `cache()` function so that multiple Server Components on the same request share a single API
call:

```ts
// lib/optimization-server.ts
import ContentfulOptimization from '@contentful/optimization-node'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'

export const APP_LOCALE = 'en-US'

const sdk = new ContentfulOptimization({
  clientId: process.env.CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
  environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  api: {
    experienceBaseUrl: process.env.CONTENTFUL_EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: process.env.CONTENTFUL_INSIGHTS_API_BASE_URL,
  },
  locale: APP_LOCALE,
  app: {
    name: 'my-next-app',
    version: '1.0.0',
  },
  logLevel: 'error',
})

const getOptimizationData = cache(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const appLocale = APP_LOCALE

  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined
  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale: appLocale,
    eventContext: {
      locale: appLocale,
      userAgent: headerStore.get('user-agent') ?? 'next-js-server',
    },
    profile,
  })

  return requestOptimization.page()
})

export { sdk, getOptimizationData }
```

The per-call `{ locale }` request option is sent as the Experience API `locale` query parameter.
Choose the application Contentful locale from your router, i18n layer, or request policy. Pass that
same `appLocale` to Contentful CDA requests and to `sdk.forRequest({ locale: appLocale })` when
Experience API responses and events should use the same language. Merge tags that reference
localized profile fields such as `location.city` and `location.country` then resolve in a language
consistent with the rendered content.

`cache()` is a React Server Component primitive that deduplicates calls within a single render pass.
Both the layout and the page can call `getOptimizationData()` and only one default-on HTTP request
to the Experience API is made per server request. If application policy depends on user choice, read
that state before the SDK call and return `undefined` when server personalization is not permitted.

## 3. Set up the anonymous ID cookie in proxy

Proxy runs before every request and keeps the anonymous ID cookie aligned with the default-on server
`requestOptimization.page()` calls:

```ts
import { APP_LOCALE, sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next()

  const anonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined
  const appLocale = APP_LOCALE

  const url = new URL(request.url)
  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale: appLocale,
    eventContext: {
      locale: appLocale,
      userAgent: request.headers.get('user-agent') ?? 'next-js-server',
      page: {
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        referrer: request.headers.get('referer') ?? '',
        search: url.search,
        url: request.url,
      },
    },
    profile,
  })
  const data = await requestOptimization.page()

  if (requestOptimization.canPersistProfile && data?.profile.id) {
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
profile journey. Do not mark this cookie as `HttpOnly`. If application policy depends on user
choice, keep that consent state in a CMP, session, account preference, or cookie and clear
`ANONYMOUS_ID_COOKIE` when profile continuity is not permitted.

## 4. Resolve entries on the server for first paint

In Server Component pages, resolve entries the same way as the SSR pattern:

```tsx
// app/page.tsx
import { APP_LOCALE, sdk, getOptimizationData } from '@/lib/optimization-server'

export default async function Home() {
  const appLocale = APP_LOCALE
  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntriesFromContentful({ locale: appLocale }),
    getOptimizationData(),
  ])

  const resolvedEntries = baselineEntries.map((entry) => {
    const { entry: resolved } = sdk.resolveOptimizedEntry(
      entry,
      optimizationData?.selectedOptimizations,
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

Fetch server-rendered baseline entries with one application Contentful locale. Your app owns that
locale choice, whether it is a constant, a route segment, an i18n setting, or another request
policy. Pass the same `appLocale` to the Contentful CDA request and to
`forRequest({ locale: appLocale })` when localized Experience API responses and event context should
match the rendered entry. `contentful.js` `withAllLocales` and raw CDA `locale=*` return
locale-keyed maps, while the resolver expects `fields.nt_experiences` and `fields.nt_variants` to be
direct single-locale field values. See
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model.

### Add data attributes for client-side tracking

Include `data-ctfl-entry-id` on the wrapper element so the React Web SDK can register interaction
trackers after hydration. Keep the original baseline ID in application-owned metadata such as
`data-ctfl-baseline-id` when your rendering code needs it:

```tsx
<div data-ctfl-entry-id={resolvedEntry.sys.id} data-ctfl-baseline-id={baselineEntry.sys.id}>
  {resolvedEntry.fields.title}
</div>
```

`data-ctfl-baseline-id` is not used in Web SDK event payloads. When the server has selected
optimization context available, also render `data-ctfl-optimization-id`, `data-ctfl-sticky`, and
`data-ctfl-variant-index` so client-side interaction events can carry the same optimization
identifiers.

## 5. Seed the React Web SDK with server-resolved state

The key difference from the SSR pattern is passing `defaults` to `OptimizationRoot`. This seeds the
client SDK with the profile and `selectedOptimizations` the server already resolved, so React SDK
entry primitives such as `OptimizedEntry` and `useOptimizedEntry()` can render from seeded state as
soon as the SDK reaches readiness after hydration. In normal browser rendering, the React Web
provider uses layout-effect initialization so ready children can mount before the first visible
client paint.

Mount `OptimizationRoot` and `NextAppAutoPageTracker` directly in the App Router layout. The React
SDK package marks these entrypoints as client-compatible, so no local wrapper or dynamic import is
needed:

```tsx
// app/layout.tsx
import { APP_LOCALE, getOptimizationData } from '@/lib/optimization-server'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/router/next-app'
import { Suspense, type ReactNode } from 'react'

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const optimizationData = await getOptimizationData()
  const htmlLang = getHtmlLang(APP_LOCALE)
  const defaults = {
    consent: true,
    ...(optimizationData
      ? {
          profile: optimizationData.profile,
          selectedOptimizations: optimizationData.selectedOptimizations,
          changes: optimizationData.changes,
        }
      : {}),
  }

  return (
    <html lang={htmlLang}>
      <body>
        <OptimizationRoot
          clientId={process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? ''}
          environment={process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
          locale={APP_LOCALE}
          trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
          logLevel="error"
          defaults={defaults}
        >
          <Suspense>
            <NextAppAutoPageTracker />
          </Suspense>
          {children}
        </OptimizationRoot>
      </body>
    </html>
  )
}
```

Wrap `NextAppAutoPageTracker` in `<Suspense>` because it uses App Router navigation hooks. If local
diagnostics need SDK state subscriptions that are attached as soon as SDK state exists and before
the first automatically emitted `page()` event, use `OptimizationRoot`'s `onStatesReady` prop to
subscribe to `states.eventStream` or `states.blockedEventStream`.

Because `getOptimizationData()` is wrapped with `cache()`, calling it in the layout and in a page
Server Component on the same request makes only one API call to the Experience API for the
default-on accepted request policy.

## 6. Re-resolve entries client-side after hydration

Client Components that need to re-resolve entries when the profile changes should render
`OptimizedEntry` with `liveUpdates={true}`. Use the server-resolved entry as `loadingFallback` so
the hydrated output stays stable while the client SDK reaches readiness:

```tsx
// components/HybridEntry.tsx
'use client'

import { OptimizedEntry } from '@contentful/optimization-react-web'

function HybridEntry({
  baselineEntry,
  serverResolvedEntry,
}: {
  baselineEntry: ContentEntry
  serverResolvedEntry: ContentEntry
}) {
  const renderEntry = (resolvedEntry: ContentEntry) => (
    <div data-ctfl-entry-id={resolvedEntry.sys.id} data-ctfl-baseline-id={baselineEntry.sys.id}>
      <p>{resolvedEntry.fields.title}</p>
    </div>
  )

  return (
    <OptimizedEntry
      baselineEntry={baselineEntry}
      liveUpdates={true}
      loadingFallback={renderEntry(serverResolvedEntry)}
    >
      {(resolvedEntry) => renderEntry(resolvedEntry as ContentEntry)}
    </OptimizedEntry>
  )
}
```

`OptimizedEntry` with `liveUpdates={true}` continuously re-resolves when `selectedOptimizations`
changes. The implementation does not subscribe to SDK state or call resolver helpers directly.

## 7. Handle consent and identify from client components

With a default-on policy, no consent UI is required. The server examples above bind
`consent: { events: true, persistence: true }`, and the browser provider receives
`defaults={{ consent: true, ...serverResolvedState }}` so client-side page and interaction tracking
can emit immediately.

If application policy depends on user choice, keep server request consent, the anonymous ID cookie,
and browser SDK consent aligned from a Client Component that reads SDK state and exposes controls:

```tsx
// components/InteractiveControls.tsx
'use client'

import {
  useConsentState,
  useOptimizationActions,
  useProfileState,
} from '@contentful/optimization-react-web'
import { useEffect, useMemo } from 'react'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function setAppConsentCookie(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

export function InteractiveControls() {
  const { consent: setConsent, identify, reset } = useOptimizationActions()
  const consent = useConsentState()
  const profile = useProfileState()

  useEffect(() => {
    if (typeof consent === 'boolean') setAppConsentCookie(consent)
  }, [consent])

  const isIdentified = useMemo(
    () => profile !== undefined && Boolean(profile.traits.identified),
    [profile],
  )

  return (
    <div>
      <button
        onClick={() => {
          setConsent(consent !== true)
        }}
      >
        {consent === true ? 'Reject consent' : 'Accept consent'}
      </button>
      {!isIdentified ? (
        <button onClick={() => void identify({ userId: 'user-123' })}>Identify</button>
      ) : (
        <button onClick={() => reset()}>Reset profile</button>
      )}
    </div>
  )
}
```

In this pattern, unlike the SSR pattern, calling `identify()`, `consent()`, or `reset()` from
`useOptimizationActions()` immediately updates `selectedOptimizations` in the client SDK. React SDK
entry primitives using live updates then re-render with the new variant. No page refresh is
required.

The cookie write keeps the next server request aligned with the browser-side `sdk.consent()` state.
In production, replace this with the same CMP or account-preference state that drives your browser
consent UI.

## Forward optimization context to third-party analytics

Use this optional step when your Next.js app already sends events to a tag manager, customer-data
platform, or analytics destination. The Optimization SDK still sends events to Contentful. Your
application decides which approved Contentful context, if any, should also be forwarded.

| Reporting need                             | Hybrid SSR + CSR handoff                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Server-resolved first-paint attribution    | Use request-local `OptimizationData` before passing `defaults` to the client.        |
| Hydrated page, entry, and reactive updates | Register one React Web `states.eventStream` subscription with `onStatesReady`.       |
| Business event attribution                 | Add Contentful fields in the server action or Client Component handler that owns it. |
| Consent or duplicate-delivery verification | Use `states.blockedEventStream`, `messageId` dedupe, and destination debuggers.      |

Treat server and browser analytics forwarding as separate handoffs. Server-resolved attribution uses
request-local SDK data; hydrated client activity uses a live React Web subscription, not a replay
queue. If a tag or analytics library loads after hydration, buffer forwarded payloads in application
code with an explicit size, TTL, and drop policy.

For client-side activity after hydration, attach the subscription through the same
`OptimizationRoot` that receives server-resolved defaults:

```tsx
<OptimizationRoot
  clientId={process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? ''}
  environment={process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
  trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
  logLevel="error"
  defaults={defaults}
  onStatesReady={(states) => {
    const forwardedMessageIds = new Set<string>()

    const eventSubscription = states.eventStream.subscribe((event) => {
      if (!event) return
      if (forwardedMessageIds.has(event.messageId)) return
      if (!canForwardSdkEvent(event)) return

      forwardedMessageIds.add(event.messageId)

      analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
    })

    return () => eventSubscription.unsubscribe()
  }}
>
  <Suspense>
    <NextAppAutoPageTracker />
  </Suspense>
  {children}
</OptimizationRoot>
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local server mapping, React Web subscription helpers, vendor examples, consent,
identity, dedupe, and governance guidance.

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

The `defaults` prop seeds the initial state so that `OptimizedEntry` can render against
server-resolved optimization state immediately. However, the Web SDK still makes its own API call in
the background to establish a live, reactive state for subsequent profile changes.

**Impact:** There is a brief window after hydration where both server-resolved defaults and the
client's own API call may be in flight simultaneously. The `defaults` prop ensures content appears
correct during this window (no flicker), but be aware that the client API call will overwrite the
default state once it resolves.

**Mitigation:** If the Experience API call latency is a concern, test whether the `defaults` prop
fully prevents any visible content change. In most cases, because the server and client resolve
against the same profile (via the shared cookie), the API call returns the same
`selectedOptimizations` and the effective displayed content is identical.

## Choosing between SSR and hybrid patterns per route

The App Router lets you choose the strategy per-route. You can use the Node SDK for Server Component
routes and the React Web SDK for Client Component routes within the same application:

- **Server Component routes (Node SDK):** homepage, landing pages, SEO-critical content. Use
  `sdk.resolveOptimizedEntry()` for first-paint content. Best for routes where personalization
  decisions are based on stable profile traits, not real-time interactions.
- **Client Component routes (React Web SDK):** interactive dashboards, account pages, flows where
  `identify` or consent changes must be reflected immediately. Use `OptimizedEntry` with
  `liveUpdates={true}`.

Mixed-strategy applications are valid and can use a single `OptimizationRoot` in the root layout to
provide the React Web SDK to all client-component subtrees.

## The server and client SDK boundary

As with the SSR pattern, keep this boundary strict:

- Server Components import only from `@contentful/optimization-node`.
- Server Component layouts may render exported React SDK Client Components such as
  `OptimizationRoot` and `NextAppAutoPageTracker` from the SDK's Next-compatible client entrypoints.
- Application components that call React SDK hooks, actions, or entry primitives must be Client
  Components and begin with `'use client'`.

Do not call React SDK hooks or import browser-only Web SDK support modules from Server Components.
The React SDK owns the provider, state hooks, and entry re-resolution; Server Components should keep
using the Node SDK for request-scoped first-paint resolution.

## Reference implementations to compare against

- [`implementations/nextjs-sdk_hybrid`](../../implementations/nextjs-sdk_hybrid/README.md): working
  Next.js App Router application using the hybrid SSR + CSR takeover pattern.
  - [`proxy.ts`](../../implementations/nextjs-sdk_hybrid/proxy.ts): Edge Runtime cookie lifecycle
  - [`lib/optimization-server.ts`](../../implementations/nextjs-sdk_hybrid/lib/optimization-server.ts):
    Node SDK singleton with `cache()`-wrapped `getOptimizationData()`
  - [`app/layout.tsx`](../../implementations/nextjs-sdk_hybrid/app/layout.tsx): Server Component
    layout that fetches defaults and renders `OptimizationRoot` directly
  - [`app/page.tsx`](../../implementations/nextjs-sdk_hybrid/app/page.tsx): Server Component page
    resolving entries for first paint
  - [`components/HybridEntryList.tsx`](../../implementations/nextjs-sdk_hybrid/components/HybridEntryList.tsx):
    Client Component rendering `OptimizedEntry` with a server-resolved fallback and live updates
