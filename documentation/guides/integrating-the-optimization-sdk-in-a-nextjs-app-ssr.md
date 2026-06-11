# Integrating the Optimization SDK in a Next.js app (SSR-primary)

Use this guide when you want to add personalization to a Next.js App Router application where the
server is the single source of truth for which variant to show. The Node SDK resolves entries
server-side before HTML leaves the server. The React Web SDK hydrates on the client for analytics
tracking and interactive controls such as consent and identify.

If you need instant client-side reactivity after identify or consent — for example, showing a
personalized welcome message without a page refresh — use the
[Hybrid SSR + CSR takeover guide](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md)
instead.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Install the packages](#1-install-the-packages)
- [2. Create the Node SDK singleton](#2-create-the-node-sdk-singleton)
- [3. Set up the anonymous ID cookie in middleware](#3-set-up-the-anonymous-id-cookie-in-middleware)
- [4. Resolve entries in a Server Component](#4-resolve-entries-in-a-server-component)
  - [Add data attributes for client-side tracking](#add-data-attributes-for-client-side-tracking)
- [5. Load the React Web SDK on the client only](#5-load-the-react-web-sdk-on-the-client-only)
  - [Why `ssr: false` is required](#why-ssr-false-is-required)
  - [Add the page tracker](#add-the-page-tracker)
- [6. Mount the client provider in your layout](#6-mount-the-client-provider-in-your-layout)
- [7. Handle consent and identify from client components](#7-handle-consent-and-identify-from-client-components)
- [Forward optimization context to third-party analytics](#forward-optimization-context-to-third-party-analytics)
- [Understand when personalization updates](#understand-when-personalization-updates)
- [Caching considerations](#caching-considerations)
- [The server and client SDK boundary](#the-server-and-client-sdk-boundary)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The SSR-primary pattern uses two packages together:

- `@contentful/optimization-node` — stateless, server-side. Runs in Server Components, middleware,
  and Edge Runtime. Resolves which entry variant to render before the HTML response leaves the
  server.
- `@contentful/optimization-react-web` — stateful, browser-side. Initializes after hydration and
  handles page view tracking, entry interaction tracking, consent, and identify. It never resolves
  entry variants in this pattern.

What this setup gives you:

- No flicker. Personalized content is in the initial HTML. No loading states or client-side variant
  swaps.
- SEO-friendly rendering. The search engine sees the resolved personalized content.
- Minimal client JavaScript. Content rendering requires no client-side JavaScript. Only tracking and
  interactive controls require hydration.
- No Next.js-specific SDK wrapper. The Node SDK works in Server Components and Edge Runtime
  middleware out of the box. The React Web SDK works in Client Components. No additional framework
  glue is required.

What it does not give you:

- Instant content updates after client-side actions. When the user accepts consent, identifies, or
  resets their profile, the displayed content does not change until the next server request. Client
  actions update the Optimization profile server-side, but the rendered HTML is a snapshot of the
  profile state at request time.

## The integration flow

| Concern                             | Where it runs             | SDK used                                 |
| ----------------------------------- | ------------------------- | ---------------------------------------- |
| Anonymous ID cookie lifecycle       | Middleware (Edge Runtime) | Node SDK                                 |
| Profile resolution and variant pick | Server Component          | Node SDK (`requestOptimization.page()`)  |
| Entry variant resolution            | Server Component          | Node SDK (`sdk.resolveOptimizedEntry()`) |
| HTML rendering                      | Server Component          | None (plain React)                       |
| Page view tracking                  | Client (after hydration)  | React Web SDK (`NextAppAutoPageTracker`) |
| Entry interaction tracking          | Client (after hydration)  | React Web SDK (`trackEntryInteraction`)  |
| Consent management                  | Client (after hydration)  | React Web SDK (`sdk.consent()`)          |
| User identification                 | Client (after hydration)  | React Web SDK (`sdk.identify()`)         |

In practice, the integration follows this sequence:

1. Create one Node SDK instance shared across Server Components and middleware.
2. Use Next.js middleware to maintain the anonymous ID cookie when application policy permits
   profile continuity.
3. In Server Components, bind request-scoped consent with `sdk.forRequest()`; the examples below use
   accepted consent for a default-on policy.
4. Load the React Web SDK with `next/dynamic` and `ssr: false` so it only runs in the browser.
5. Mount the React Web SDK provider and page tracker in a `'use client'` wrapper in your layout.
6. Use Client Components for consent, identify, and any interactive SDK controls.

The SSR-primary reference implementation in this repository shows that pattern in a working
application:

- [`implementations/react-web-sdk+node-sdk_nextjs-ssr`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/README.md)

## 1. Install the packages

```sh
pnpm add @contentful/optimization-node @contentful/optimization-react-web
```

## 2. Create the Node SDK singleton

Create the SDK once at module level. It is stateless and safe to share across all requests.

```ts
// lib/optimization-server.ts
import ContentfulOptimization from '@contentful/optimization-node'

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

export { sdk }
```

Do not create a new instance per request. The Node SDK is designed to be a process-level singleton.
Use `forRequest()` to bind request-scoped consent, locale, user agent, profile, page URL, and
Experience API request options before calling event methods.

The per-call `{ locale }` request option is sent as the Experience API `locale` query parameter.
Choose the application Contentful locale from your router, i18n layer, or request policy. Pass that
same `appLocale` to Contentful CDA requests and to `sdk.forRequest({ locale: appLocale })` when
Experience API responses and events should use the same language. Merge tags that reference
localized profile fields such as `location.city` and `location.country` then resolve in a language
consistent with the rendered content.

## 3. Set up the anonymous ID cookie in middleware

Next.js middleware runs on the Edge Runtime before every request reaches a Server Component. Use it
to ensure the anonymous ID cookie exists and is populated before the Server Component tries to read
it.

```ts
import { APP_LOCALE, sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest): Promise<NextResponse> {
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

The `ANONYMOUS_ID_COOKIE` constant is the shared cookie name used by both the Node SDK and the React
Web SDK. Using the same name means that after hydration, the Web SDK reads the same anonymous ID
from `document.cookie` and continues the same profile journey the server started.

Do not mark this cookie as `HttpOnly`. The Web SDK reads it from the browser. The example uses a
default-on policy, so middleware binds accepted event and persistence consent before calling
`requestOptimization.page()`. If application policy depends on user choice, read that state before
the SDK call and clear the shared anonymous ID cookie when profile continuity is not permitted.

## 4. Resolve entries in a Server Component

Inside a Server Component, read the anonymous ID cookie and bind accepted consent for the default-on
request policy:

```tsx
import { APP_LOCALE, sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { cookies, headers } from 'next/headers'

export default async function Home() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const appLocale = APP_LOCALE

  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntriesFromContentful({ locale: appLocale }),
    sdk
      .forRequest({
        consent: { events: true, persistence: true },
        locale: appLocale,
        eventContext: {
          locale: appLocale,
          userAgent: headerStore.get('user-agent') ?? 'next-js-server',
        },
        profile,
      })
      .page(),
  ])

  const resolvedEntries = baselineEntries.map((entry) => {
    const { entry: resolved } = optimizationData
      ? sdk.resolveOptimizedEntry(entry, optimizationData.selectedOptimizations)
      : { entry }
    return resolved
  })

  return (
    <main>
      {resolvedEntries.map((entry) => (
        <EntryCard key={entry.sys.id} entry={entry} />
      ))}
    </main>
  )
}
```

Fetch Contentful entries with `include: 10` so that linked optimization data (such as
`nt_experiences`) is included in the response. The Node SDK needs those nested fields to evaluate
variants.

Also fetch entries with one CDA locale. Your app owns that locale choice, whether it is a constant,
a route segment, an i18n setting, or another request policy. Pass the same `appLocale` to the
Contentful CDA request and to `forRequest({ locale: appLocale })` when localized Experience API
responses and event context should match the rendered entry. All-locale responses from
`contentful.js` `withAllLocales` or raw CDA `locale=*` contain locale-keyed maps, while the resolver
expects `fields.nt_experiences` and `fields.nt_variants` to be direct single-locale field values.
See
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model.

`resolveOptimizedEntry` is synchronous. It picks the correct variant from the resolved entry based
on `selectedOptimizations` returned by `requestOptimization.page()`. If no optimization applies, it
returns the baseline entry unchanged.

### Add data attributes for client-side tracking

After hydration, the React Web SDK's `trackEntryInteraction` option uses a `MutationObserver` to
find elements with specific `data-ctfl-*` attributes and register interaction trackers (views,
clicks, hovers) against them. For automatic tracking to work on server-rendered entries, add
`data-ctfl-entry-id` to the wrapper element:

```tsx
function ServerRenderedEntry({
  baselineEntry,
  resolvedEntry,
}: {
  baselineEntry: ContentEntry
  resolvedEntry: ContentEntry
}) {
  return (
    <div data-ctfl-entry-id={resolvedEntry.sys.id} data-ctfl-baseline-id={baselineEntry.sys.id}>
      <p>{resolvedEntry.fields.title}</p>
    </div>
  )
}
```

`data-ctfl-entry-id` is the resolved (possibly variant) entry ID and is required for automatic
interaction tracking. `data-ctfl-baseline-id` is application-owned metadata for keeping the original
baseline entry ID available to your rendering code; the Web SDK does not include it in event
payloads. When the server has selected optimization context available, also render
`data-ctfl-optimization-id`, `data-ctfl-sticky`, and `data-ctfl-variant-index` so client-side
interaction events can carry the same optimization identifiers.

## 5. Load the React Web SDK on the client only

The React Web SDK depends on browser APIs (`localStorage`, `document.cookie`,
`IntersectionObserver`). These APIs are not available during server rendering in Next.js. Importing
the package in a Server Component causes a runtime error.

Use `next/dynamic` with `ssr: false` to prevent the SDK from loading during server rendering:

```tsx
// components/ClientProviderWrapper.tsx
'use client'

import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'

const OptimizationRoot = dynamic(
  () =>
    import('@contentful/optimization-react-web').then((mod) => ({
      default: mod.OptimizationRoot,
    })),
  { ssr: false },
)
```

The `'use client'` directive is required. `next/dynamic` is a Client Component feature, and the
import of `@contentful/optimization-react-web` must not reach Server Component module graph
resolution.

### Why `ssr: false` is required

Next.js tries to pre-render Client Components on the server (a technique sometimes called
server-side rendering of client components). Without `ssr: false`, Next.js attempts to render
`OptimizationRoot` on the server and fails because the package accesses browser globals at import
time.

`ssr: false` tells Next.js to skip server rendering for `OptimizationRoot` entirely. The SDK
initializes only after JavaScript loads in the browser. Provider-owned initialization still happens
outside React render and gates children until readiness; in normal browser rendering it uses
layout-effect scheduling so ready children can mount before first visible client paint.

### Add the page tracker

Mount `NextAppAutoPageTracker` inside `OptimizationRoot` to emit `page()` events automatically
whenever the App Router pathname changes:

```tsx
const NextAppAutoPageTracker = dynamic(
  () =>
    import('@contentful/optimization-react-web/router/next-app').then((mod) => ({
      default: mod.NextAppAutoPageTracker,
    })),
  { ssr: false },
)
```

Wrap the tracker in `<Suspense>` to prevent it from blocking the initial render. If local
diagnostics need SDK state subscriptions that are attached as soon as SDK state exists and before
the first automatically emitted `page()` event, use `OptimizationRoot`'s `onStatesReady` prop to
subscribe to `states.eventStream` or `states.blockedEventStream`.

## 6. Mount the client provider in your layout

Assemble the client wrapper component and use it in `app/layout.tsx`:

```tsx
// components/ClientProviderWrapper.tsx
'use client'

import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'

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

export function ClientProviderWrapper({
  children,
  appLocale,
}: {
  children: ReactNode
  appLocale: string
}) {
  return (
    <OptimizationRoot
      clientId={process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? ''}
      environment={process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
      defaults={{ consent: true }}
      locale={appLocale}
      trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      logLevel="error"
    >
      <Suspense>
        <NextAppAutoPageTracker />
      </Suspense>
      {children}
    </OptimizationRoot>
  )
}
```

```tsx
// app/layout.tsx
import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { APP_LOCALE } from '@/lib/optimization-server'

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const htmlLang = getHtmlLang(APP_LOCALE)

  return (
    <html lang={htmlLang}>
      <body>
        <ClientProviderWrapper appLocale={APP_LOCALE}>{children}</ClientProviderWrapper>
      </body>
    </html>
  )
}
```

`layout.tsx` itself is a Server Component. `ClientProviderWrapper` is a Client Component, which is
correct — React's composition model allows a Server Component to render a Client Component as a
child.

Environment variables exposed to client code in Next.js must use the `NEXT_PUBLIC_` prefix. The Node
SDK on the server reads variables without that prefix. Keep them separate in your `.env` file:

```sh
# Used by the Node SDK (server only)
CONTENTFUL_OPTIMIZATION_CLIENT_ID="your-client-id"
CONTENTFUL_OPTIMIZATION_ENVIRONMENT="main"

# Used by the React Web SDK (exposed to the browser)
NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID="your-client-id"
NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT="main"
```

## 7. Handle consent and identify from client components

With a default-on policy, no consent UI is required. The server examples above bind
`consent: { events: true, persistence: true }`, and the browser provider seeds
`defaults={{ consent: true }}` so client-side page and interaction tracking can emit immediately.

If application policy depends on user choice, keep server request consent, the anonymous ID cookie,
and browser SDK consent aligned from a Client Component that subscribes to SDK state and exposes the
controls:

```tsx
// components/InteractiveControls.tsx
'use client'

import { useOptimizationContext } from '@contentful/optimization-react-web'
import { useEffect, useState } from 'react'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function setAppConsentCookie(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

export function InteractiveControls() {
  const { sdk, isReady } = useOptimizationContext()
  const [consent, setConsent] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!sdk || !isReady) return

    const sub = sdk.states.consent.subscribe((value) => {
      setConsent(value)
      if (typeof value === 'boolean') setAppConsentCookie(value)
    })

    return () => sub.unsubscribe()
  }, [sdk, isReady])

  if (!sdk || !isReady) return null

  return (
    <div>
      <button
        onClick={() => {
          sdk.consent(consent !== true)
        }}
      >
        {consent === true ? 'Reject consent' : 'Accept consent'}
      </button>
      <button onClick={() => sdk.identify({ userId: 'user-123' })}>Identify</button>
      <button onClick={() => sdk.reset()}>Reset profile</button>
    </div>
  )
}
```

`InteractiveControls` can be mounted inside a Server Component page — React allows Client Components
to be children of Server Components.

The cookie write keeps the next server request aligned with the browser-side `sdk.consent()` state.
In production, replace this with the same CMP or account-preference state that drives your browser
consent UI.

Client actions update the Optimization profile via the Experience API, but they do not re-render the
server-resolved content on the current page. The updated profile is reflected on the next server
request (navigation or browser refresh).

## Forward optimization context to third-party analytics

Use this optional step when your Next.js app already sends events to a tag manager, customer-data
platform, or analytics destination. The Optimization SDK still sends events to Contentful. Your
application decides which approved Contentful context, if any, should also be forwarded.

| Reporting need                             | SSR-primary handoff                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Server-rendered first-paint attribution    | Use request-local `OptimizationData` and `selectedOptimization` in the Server Component. |
| Hydrated page and entry interaction events | Register one React Web `states.eventStream` subscription from `onStatesReady`.           |
| Business event attribution                 | Add Contentful fields in the server action or Client Component handler that owns it.     |
| Consent or duplicate-delivery verification | Use `states.blockedEventStream`, `messageId` dedupe, and destination debuggers.          |

Treat server and browser analytics forwarding as separate handoffs. Server-rendered attribution uses
request-local SDK data; hydrated client activity uses a live React Web subscription, not a replay
queue. If a tag or analytics library loads after hydration, buffer forwarded payloads in application
code with an explicit size, TTL, and drop policy.

For hydrated activity, add the subscription to the client provider wrapper that already mounts
`OptimizationRoot`:

```tsx
<OptimizationRoot
  clientId={process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? ''}
  environment={process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
  trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
  logLevel="error"
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

| User action                 | Effect on displayed content             | When personalization updates |
| --------------------------- | --------------------------------------- | ---------------------------- |
| First page load (anonymous) | Baseline or variant per profile         | Immediate (server-resolved)  |
| Accept or reject consent    | No change to content                    | Next server request          |
| Identify (`sdk.identify()`) | No change to content                    | Next server request          |
| Navigate to another page    | New server-resolved content             | Immediate (new SSR)          |
| Browser refresh             | Server re-resolves with updated profile | Immediate (new SSR)          |

The key insight is that client actions update the profile server-side through the Experience API,
but the rendered HTML is a snapshot of the profile state at the time of the server request. The next
request reflects the updated profile.

This behavior is intentional: the server is the sole source of truth for what content to show. The
client never re-resolves entries in this pattern.

## Caching considerations

The personalization loop makes certain pieces of your response non-cacheable at the CDN or reverse
proxy layer:

- The result of `requestOptimization.page()` must not be cached and reused across requests. It
  performs a server-side effect and returns profile state for the current visitor.
- Resolved entry HTML (the output of `resolveOptimizedEntry()`) is only cache-safe if you vary the
  cache on both the baseline entry version and a fingerprint of `selectedOptimizations`. In
  practice, most teams treat server-rendered personalized responses as uncacheable.
- Raw Contentful delivery responses (baseline entries before resolution) are broadly cache-safe and
  can be cached by entry ID, locale, include depth, and environment.

If your deployment uses Next.js full-route caching or `generateStaticParams`, personalized routes
must be excluded from those caches or must vary on the full profile state.

## The server and client SDK boundary

Keep this boundary strict throughout the application:

- Server Components import only from `@contentful/optimization-node`.
- Client Components (`'use client'`) import only from `@contentful/optimization-react-web`.

Mixing them causes runtime errors or bundling failures. The most common mistake is importing a React
Web SDK hook at the top of a file that is later resolved as a Server Component. If you see an error
about browser globals in a server context, trace the import chain back to a file missing the
`'use client'` directive.

A practical rule: any file that imports from `@contentful/optimization-react-web` must begin with
`'use client'`, or it must only be imported by files that do.

## Reference implementations to compare against

- [`implementations/react-web-sdk+node-sdk_nextjs-ssr`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/README.md):
  working Next.js App Router application using the SSR-primary pattern. The server resolves all
  entries, the client handles tracking and interactive controls only.
  - [`middleware.ts`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/middleware.ts): Edge
    Runtime cookie lifecycle
  - [`lib/optimization-server.ts`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/lib/optimization-server.ts):
    Node SDK singleton
  - [`app/page.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/app/page.tsx): Server
    Component fetching entries and resolving variants
  - [`components/ClientProviderWrapper.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/components/ClientProviderWrapper.tsx):
    dynamic React Web SDK provider
  - [`components/InteractiveControls.tsx`](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/components/InteractiveControls.tsx):
    Client Component for consent, identify, and reset
