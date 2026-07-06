# Integrating the Optimization Next.js SDK in a Next.js app (hybrid SSR + CSR takeover)

Use this guide when you want a Next.js App Router route to personalize the initial HTML with server
optimization state, then let the browser take over entry resolution after server-to-browser state
handoff when consent, identity, profile, preview, or route state changes.

This pattern uses `@contentful/optimization-nextjs`. The server entry composes the stateless Node
SDK, the client entry composes the React Web SDK, and the request handler forwards sanitized Next.js
proxy or middleware request context headers. Your application still owns Contentful fetching,
consent policy, identity policy, routing, caching, and component rendering.

If browser-side actions do not need to change visible content until the next request, use the
[Next.js SSR guide](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md) instead.

## Quick start

This quick start assumes your application policy permits accepted SDK startup. It uses the Server
Component helper as the only initial page-event owner so the route can render personalized HTML
before browser takeover. If consent depends on a consent management platform (CMP), regional rule,
account preference, or user choice, keep the same structure and apply the policy-dependent consent
section before release.

1. Install the Next.js adapter package.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs
   ```

2. Create one server SDK singleton and a cached request helper that returns server optimization
   state for the current request. The Next.js proxy or middleware captures request context for this
   helper.

   **Copy this:**

   ```ts
   // lib/optimization-server.ts
   import {
     createNextjsOptimization,
     getNextjsServerOptimizationData,
   } from '@contentful/optimization-nextjs/server'
   import { cookies, headers } from 'next/headers'
   import { cache } from 'react'

   export const APP_LOCALE = 'en-US'

   // Keep one server SDK instance; bind request state through adapter helpers.
   export const optimization = createNextjsOptimization({
     clientId: process.env.CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
     environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
     locale: APP_LOCALE,
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

   export const getOptimizationData = cache(async () => {
     const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

     // Accepted startup allows the server page call and returns profile data for browser handoff.
     const { data } = await getNextjsServerOptimizationData(optimization, {
       consent: { events: true, persistence: true },
       cookies: cookieStore,
       headers: headerStore,
       locale: APP_LOCALE,
     })

     return data
   })
   ```

3. Create a Client Component boundary that renders server content outside the SDK context, then
   reveals the browser takeover island after browser SDK state is ready.

   **Adapt this to your use case:**

   ```tsx
   // components/HybridTakeoverBoundary.tsx
   'use client'

   import {
     NextAppAutoPageTracker,
     OptimizationRoot,
     type NextAppAutoPageTrackerProps,
     type OptimizationRootProps,
   } from '@contentful/optimization-nextjs/client'
   import { Suspense, useState, type ReactNode } from 'react'

   export function HybridTakeoverBoundary({
     children,
     defaults,
     initialPageEvent,
     locale,
     serverContent,
     serverOptimizationState,
   }: {
     children: ReactNode
     defaults: OptimizationRootProps['defaults']
     initialPageEvent: NextAppAutoPageTrackerProps['initialPageEvent']
     locale: string
     serverContent: ReactNode
     serverOptimizationState: OptimizationRootProps['serverOptimizationState']
   }) {
     const [takeoverReady, setTakeoverReady] = useState(false)

     return (
       <>
         <div hidden={takeoverReady}>{serverContent}</div>
         <OptimizationRoot
           clientId={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? ''}
           environment={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main'}
           locale={locale}
           defaults={defaults}
           serverOptimizationState={serverOptimizationState}
           logLevel="error"
           onStatesReady={() => {
             // Reveal browser takeover only after browser SDK state is ready.
             setTakeoverReady(true)
           }}
         >
           <Suspense>
             {/* Skip only when this route's server helper emitted the initial page event. */}
             <NextAppAutoPageTracker initialPageEvent={initialPageEvent} />
           </Suspense>
           <div hidden={!takeoverReady}>{children}</div>
         </OptimizationRoot>
       </>
     )
   }
   ```

4. Fetch single-locale Contentful entries in a Server Component, resolve the initial HTML with the
   server data, and pass both baseline and server-resolved data to the takeover island.

   **Adapt this to your use case:**

   ```tsx
   // app/page.tsx
   import { HybridEntryList } from '@/components/HybridEntryList'
   import { HybridTakeoverBoundary } from '@/components/HybridTakeoverBoundary'
   import { fetchEntriesFromContentful } from '@/lib/contentful-client'
   import { APP_LOCALE, getOptimizationData, optimization } from '@/lib/optimization-server'
   import type { Entry } from 'contentful'

   function EntryCard({ entry }: { entry: Entry }) {
     return <h2>{String(entry.fields.title ?? '')}</h2>
   }

   function ServerEntryList({ entries }: { entries: Entry[] }) {
     return (
       <>
         {entries.map((entry) => (
           <EntryCard key={entry.sys.id} entry={entry} />
         ))}
       </>
     )
   }

   export default async function Home() {
     const [baselineEntries, optimizationData] = await Promise.all([
       fetchEntriesFromContentful(['home-hero', 'home-offer']),
       getOptimizationData(),
     ])

     // Resolve locally against request-selected optimizations, with baseline fallback.
     const serverResolvedData = baselineEntries.map((baselineEntry) =>
       optimization.resolveOptimizedEntry(baselineEntry, optimizationData?.selectedOptimizations),
     )
     const serverEntries = serverResolvedData.map(({ entry }) => entry)
     const defaults = { consent: true }

     return (
       <HybridTakeoverBoundary
         defaults={defaults}
         initialPageEvent={optimizationData ? 'skip' : 'emit'}
         locale={APP_LOCALE}
         serverContent={<ServerEntryList entries={serverEntries} />}
         serverOptimizationState={optimizationData}
       >
         <HybridEntryList
           baselineEntries={baselineEntries}
           serverResolvedData={serverResolvedData}
         />
       </HybridTakeoverBoundary>
     )
   }
   ```

5. Render the browser takeover entries through `OptimizedEntry`. Use the server-resolved entry as
   the loading fallback so takeover content matches the initial HTML while the browser SDK becomes
   ready.

   **Adapt this to your use case:**

   ```tsx
   // components/HybridEntryList.tsx
   'use client'

   import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
   import type { Entry } from 'contentful'

   function EntryCard({ entry }: { entry: Entry }) {
     return <h2>{String(entry.fields.title ?? '')}</h2>
   }

   export function HybridEntryList({
     baselineEntries,
     serverResolvedData,
   }: {
     baselineEntries: Entry[]
     serverResolvedData: { entry: Entry }[]
   }) {
     return (
       <>
         {baselineEntries.map((baselineEntry, index) => {
           const serverEntry = serverResolvedData[index]?.entry ?? baselineEntry

           // loadingFallback matches the server-selected content during browser takeover.
           return (
             <OptimizedEntry
               key={baselineEntry.sys.id}
               baselineEntry={baselineEntry}
               loadingFallback={<EntryCard entry={serverEntry} />}
             >
               {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
             </OptimizedEntry>
           )
         })}
       </>
     )
   }
   ```

6. Verify the first run. The route source must contain the server-selected content or baseline
   fallback, that content must remain visible after browser takeover, and the browser must not emit
   a duplicate initial page event when `initialPageEvent="skip"` is used with server optimization
   state.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Package entry points and runtime boundary](#package-entry-points-and-runtime-boundary)
  - [Server SDK and request helper](#server-sdk-and-request-helper)
  - [Proxy request context](#proxy-request-context)
  - [Contentful fetching and entry shape](#contentful-fetching-and-entry-shape)
  - [Server first render and fallback behavior](#server-first-render-and-fallback-behavior)
  - [Browser root and server optimization state](#browser-root-and-server-optimization-state)
  - [Client takeover and live re-resolution](#client-takeover-and-live-re-resolution)
  - [Page events and App Router navigation](#page-events-and-app-router-navigation)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Consent, identity, profile, and reset](#consent-identity-profile-and-reset)
- [Optional integrations](#optional-integrations)
  - [Analytics forwarding](#analytics-forwarding)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Route-level SSR, hybrid, and browser-owned islands](#route-level-ssr-hybrid-and-browser-owned-islands)
  - [Caching and request deduplication](#caching-and-request-deduplication)
  - [Strict consent and duplicate-event controls](#strict-consent-and-duplicate-event-controls)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this table as the setup inventory for the full hybrid integration:

| Setup item                                                      | Category                       | Required for quick start | Where to configure                                                                   |
| --------------------------------------------------------------- | ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------ |
| Next.js App Router with React and React DOM peer dependencies   | Required for first integration | Yes                      | Application `package.json`                                                           |
| `@contentful/optimization-nextjs` package                       | Required for first integration | Yes                      | Application package manager                                                          |
| Optimization client ID and environment                          | Required for first integration | Yes                      | Server SDK config and client takeover `OptimizationRoot` props                       |
| Server-only and browser-exposed environment variables           | Required for first integration | Yes                      | Runtime environment, including `NEXT_PUBLIC_` variables for browser config           |
| Contentful CDA credentials and app-owned fetcher                | Required for first integration | Yes                      | Application Contentful client                                                        |
| Single-locale CDA entries with resolved optimization links      | Required for first integration | Yes                      | CDA calls with one `locale` and enough `include` depth, commonly `include: 10`       |
| Server request helper for Optimization data                     | Required for first integration | Yes                      | Server-only page-event owner using `getNextjsServerOptimizationData()` and `cache()` |
| Next.js proxy or middleware hook                                | Common but policy-dependent    | No                       | `proxy.ts` or `middleware.ts` for server helpers that need request context           |
| Browser takeover boundary with `OptimizationRoot`               | Required for first integration | Yes                      | Client boundary around takeover content, not around server-rendered initial HTML     |
| Server-resolved entry data or baseline fallback                 | Required for first integration | Yes                      | Server Components before passing entries to browser takeover components              |
| Client takeover with `OptimizedEntry` or `useOptimizedEntry()`  | Required for first integration | Yes                      | Client Components that render personalized entries after state handoff               |
| App Router page tracker                                         | Required for first integration | Yes                      | `NextAppAutoPageTracker` under `OptimizationRoot`                                    |
| Consent and persistence policy                                  | Common but policy-dependent    | Conditional              | Server calls, browser consent defaults, CMP, or controls                             |
| Anonymous ID cookie continuity                                  | Common but policy-dependent    | Conditional              | Server helper cookies, browser state handoff, ESR persistence, and `ctfl-opt-aid`    |
| Browser identify, profile state, and reset controls             | Common but policy-dependent    | No                       | Client Components using Next.js client hooks                                         |
| Entry interaction tracking for views, clicks, and hovers        | Common but policy-dependent    | No                       | `trackEntryInteraction`, `OptimizedEntry` props, or server tracking attributes       |
| Analytics or tag-manager forwarding                             | Optional                       | No                       | `OptimizationRoot` `onStatesReady` subscription and app-owned forwarding code        |
| Merge tag and Custom Flag rendering                             | Optional                       | No                       | Rich Text renderers, flag readers, and live-update components                        |
| Preview panel package                                           | Optional                       | No                       | Environment-gated preview attachment in non-production app environments              |
| Strict pre-consent allowlist, storage, queue, and cookie policy | Advanced or production-only    | No                       | SDK config, server helper consent, CMP integration, and application cleanup          |
| Personalized response caching and duplicate-event policy        | Advanced or production-only    | No                       | Next.js route config, CDN rules, server helper structure, and tracker settings       |

Use one application Contentful locale for entries that feed SDK resolution. The SDK Experience and
event locale often uses the same string, but the SDK does not fetch Contentful content or change CDA
requests for you.

## Core integration

### Package entry points and runtime boundary

**Integration category:** Required for first integration

The Next.js adapter is a glue package. Keep application imports on the adapter subpaths instead of
importing lower-level Node, Web, or React Web packages directly.

| Import path                                       | Runtime                                       | Responsibility                                                                                                    |
| ------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/server`          | Server Components and server-only modules     | Server SDK creation, request binding, server resolution, server-owned page calls, and SSR tracking attributes     |
| `@contentful/optimization-nextjs/esr`             | Route handlers, edge functions, and ESR flows | Request-rendered Optimization data and explicit response persistence                                              |
| `@contentful/optimization-nextjs/request-handler` | Next.js proxy or middleware                   | Request URL capture and SDK-owned request header sanitization                                                     |
| `@contentful/optimization-nextjs/client`          | Client Components and takeover islands        | React provider, hooks, entry primitives, live updates, and Next.js page route tracker                             |
| `@contentful/optimization-nextjs/api-schemas`     | Shared schema helpers                         | API types plus structural guards such as `isMergeTagEntry`, `isRichTextDocument`, and `isResolvedContentfulEntry` |

1. Install `@contentful/optimization-nextjs` in the Next.js app.
2. Import server helpers only from the `/server` subpath in server-only modules and Server
   Components.
3. Import `OptimizationRoot`, hooks, `OptimizedEntry`, and router trackers only from the `/client`
   subpath in Client Components or layouts rendering Client Components.
4. Import `createNextjsOptimizationContextHandler()` only from the `/request-handler` subpath in
   proxy or middleware code.
5. Import schema guards and API types from the `/api-schemas` subpath, not from `/client`.
6. Keep Client Components that call SDK hooks marked with `'use client'`.

**Copy this:**

```sh
pnpm add @contentful/optimization-nextjs
```

The adapter package lists Next.js, React, and React DOM as application-owned peer dependencies. It
uses the runtime that is already installed by the app.

### Server SDK and request helper

**Integration category:** Required for first integration

Create the Next.js server SDK once at module level, then bind request-specific cookies, headers,
consent, locale, and profile through request helpers. Use the proxy or middleware context helper so
Server Components can derive page context from forwarded request context headers.

1. Read the Optimization client ID and environment from server-only runtime configuration.
2. Pass the application Experience/event locale to the SDK singleton.
3. Configure API endpoint overrides only when your app uses mocks, a proxy, or non-default hosts.
4. Wrap `getNextjsServerOptimizationData()` in React `cache()` when more than one Server Component
   in the same render pass needs the same request-local Optimization data.
5. Add the request-context proxy or middleware helper for routes that call the server helper.
6. Return `undefined` instead of calling the SDK when application policy does not permit server
   personalization for the request.

**Adapt this to your use case:**

```ts
// lib/optimization-server.ts
import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

export const APP_LOCALE = 'en-US'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

// Keep one server SDK instance; bind request state through adapter helpers.
export const optimization = createNextjsOptimization({
  clientId: process.env.CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
  environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  locale: APP_LOCALE,
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

export const getOptimizationData = cache(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value

  if (appConsent === 'denied') return undefined

  // Accepted startup allows the server page call and returns profile data for browser handoff.
  const { data } = await getNextjsServerOptimizationData(optimization, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: APP_LOCALE,
  })

  return data
})
```

`getNextjsServerOptimizationData()` calls `page()` through the request-bound Node SDK and returns
the profile, selected optimizations, and changes for that request. Treat that call as the initial
server page event for the route. The request-scoped `locale` is sent to the Experience API and used
as the default event context locale. In Server Components, pass `headers()` so the SDK can derive
page context from the request URL captured by the Next.js proxy or middleware helper.

### Proxy request context

**Integration category:** Common but policy-dependent

Use a Next.js proxy or middleware handler to capture request context before Server Components call
`getNextjsServerOptimizationData()`.

1. Export the context handler from `proxy.ts` or `middleware.ts`.
2. Match routes whose Server Components call `getNextjsServerOptimizationData()`.
3. Keep consent, locale, and profile policy in the Server Component helper call.

**Adapt this to your use case:**

```ts
// proxy.ts
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

The context handler strips incoming SDK-owned request headers and forwards sanitized request context
headers including the SDK-owned request URL header for the server SDK helper.

Do not mark `ctfl-opt-aid` as `HttpOnly` when the browser SDK must adopt it through browser state
handoff or an explicit server persistence flow. For deeper mechanics, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

### Contentful fetching and entry shape

**Integration category:** Required for first integration

The SDK does not fetch Contentful entries. Fetch baseline entries in the application layer with one
Contentful locale and resolved optimization links before passing them to the server resolver or
client entry primitives.

1. Choose the application Contentful locale in routing, i18n, request policy, or app configuration.
2. Pass that locale to CDA requests.
3. Include linked optimization entries and variant entries. The common Contentful CDA setting is
   `include: 10`.
4. Do not pass all-locale CDA responses from `contentful.js` `withAllLocales` or raw CDA `locale=*`
   into `resolveOptimizedEntry()`, `OptimizedEntry`, or `useOptimizedEntry()`.
5. Use the same locale as the SDK Experience/event locale when localized Experience responses and
   rendered content need to match.

**Adapt this to your use case:**

```ts
import { createClient, type Entry } from 'contentful'
import { APP_LOCALE } from './optimization-server'

const contentfulClient = createClient({
  accessToken: process.env.CONTENTFUL_DELIVERY_TOKEN ?? '',
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
  space: process.env.CONTENTFUL_SPACE_ID ?? '',
})

export function getContentfulClient() {
  return contentfulClient
}

export async function fetchEntriesFromContentful(entryIds: readonly string[]): Promise<Entry[]> {
  const entries = await Promise.all(
    entryIds.map((entryId) =>
      getContentfulClient().getEntry(entryId, {
        // Entry resolution expects linked optimization data in one locale.
        include: 10,
        locale: APP_LOCALE,
      }),
    ),
  )

  return entries
}
```

Single-locale entries expose optimization fields as direct field values, such as
`fields.nt_experiences` and `fields.nt_variants`. All-locale responses use locale-keyed field maps
and fall back to baseline rendering. For the resolver contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Server first render and fallback behavior

**Integration category:** Required for first integration

Use the server SDK result for the content decision that starts the route. The resolver is local and
synchronous: it joins the current `selectedOptimizations` with optimization links already present in
the Contentful payload.

1. Fetch Contentful entries and request Optimization data in the same Server Component render.
2. Call `optimization.resolveOptimizedEntry()` for each baseline entry.
3. Render the resolved entry outside an owned `OptimizationRoot` boundary when the initial HTML must
   contain personalized content.
4. Treat missing optimization data, unresolved links, all-locale CDA payloads, and API failures as
   baseline fallback cases.

**Adapt this to your use case:**

```tsx
// app/page.tsx
import { HybridEntryList } from '@/components/HybridEntryList'
import { HybridTakeoverBoundary } from '@/components/HybridTakeoverBoundary'
import { fetchEntriesFromContentful } from '@/lib/contentful-client'
import { APP_LOCALE, getOptimizationData, optimization } from '@/lib/optimization-server'
import type { Entry } from 'contentful'

function ServerEntryList({ entries }: { entries: Entry[] }) {
  return (
    <>
      {entries.map((entry) => (
        <h2 key={entry.sys.id}>{String(entry.fields.title ?? '')}</h2>
      ))}
    </>
  )
}

export default async function Home() {
  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntriesFromContentful(['home-hero', 'home-offer']),
    getOptimizationData(),
  ])

  // Resolve locally against request-selected optimizations, with baseline fallback.
  const serverResolvedData = baselineEntries.map((baselineEntry) =>
    optimization.resolveOptimizedEntry(baselineEntry, optimizationData?.selectedOptimizations),
  )
  const serverEntries = serverResolvedData.map(({ entry }) => entry)
  const defaults = { consent: true }

  return (
    <HybridTakeoverBoundary
      defaults={defaults}
      initialPageEvent={optimizationData ? 'skip' : 'emit'}
      locale={APP_LOCALE}
      serverContent={<ServerEntryList entries={serverEntries} />}
      serverOptimizationState={optimizationData}
    >
      <HybridEntryList baselineEntries={baselineEntries} serverResolvedData={serverResolvedData} />
    </HybridTakeoverBoundary>
  )
}
```

When a route renders entry HTML without client takeover, wrap the resolved entry with
`ServerOptimizedEntry` from the server entrypoint so the browser interaction tracker can read the
same `data-ctfl-*` metadata after browser startup.

**Follow this pattern:**

```tsx
import { ServerOptimizedEntry } from '@contentful/optimization-nextjs/server'

function ServerRenderedEntry({ baselineEntry, resolvedData }: ServerRenderedEntryProps) {
  return (
    // Render data-ctfl-* attributes for browser entry-interaction tracking.
    <ServerOptimizedEntry baselineEntry={baselineEntry} resolvedData={resolvedData}>
      <h2>{String(resolvedData.entry.fields.title ?? '')}</h2>
    </ServerOptimizedEntry>
  )
}
```

### Browser root and server optimization state

**Integration category:** Required for first integration

The SDK context comes from `OptimizationRoot` or `OptimizationProvider` through the React Web layer.
The browser SDK can initialize after the first server render, so the takeover island can return
`null` until SDK state is ready. When initial HTML personalization is required, render the
server-resolved content outside that provider boundary and pass server-returned Optimization data as
`serverOptimizationState` to the takeover island.

1. Pass server-returned profile, selected optimizations, and changes through
   `serverOptimizationState` on `OptimizationRoot` or `OptimizationProvider`.
2. Keep `defaults` for configuration or default state such as consent policy.
3. Render server-resolved entry HTML outside `OptimizationRoot`.
4. Mount `OptimizationRoot` around the Client Components that take over after state handoff.
5. Pass browser-exposed values such as `NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID` into the
   client provider.
6. Include `defaults.consent: true` only when application policy permits accepted browser startup.
7. Wrap `NextAppAutoPageTracker` in `Suspense` because it uses App Router navigation hooks.

**Adapt this to your use case:**

```tsx
'use client'

import {
  NextAppAutoPageTracker,
  OptimizationRoot,
  type NextAppAutoPageTrackerProps,
  type OptimizationRootProps,
} from '@contentful/optimization-nextjs/client'
import { Suspense, useState, type ReactNode } from 'react'

export function HybridTakeoverBoundary({
  children,
  defaults,
  initialPageEvent,
  locale,
  serverContent,
  serverOptimizationState,
}: {
  children: ReactNode
  defaults: OptimizationRootProps['defaults']
  initialPageEvent: NextAppAutoPageTrackerProps['initialPageEvent']
  locale: string
  serverContent: ReactNode
  serverOptimizationState: OptimizationRootProps['serverOptimizationState']
}) {
  const [takeoverReady, setTakeoverReady] = useState(false)

  return (
    <>
      <div hidden={takeoverReady}>{serverContent}</div>
      <OptimizationRoot
        clientId={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? ''}
        environment={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main'}
        locale={locale}
        defaults={defaults}
        serverOptimizationState={serverOptimizationState}
        onStatesReady={() => {
          // Provider children mount only after the browser SDK exists.
          setTakeoverReady(true)
        }}
      >
        <Suspense>
          <NextAppAutoPageTracker initialPageEvent={initialPageEvent} />
        </Suspense>
        <div hidden={!takeoverReady}>{children}</div>
      </OptimizationRoot>
    </>
  )
}
```

If a route only needs server-seeded browser takeover, and does not need personalized initial HTML,
it can render takeover content directly under `OptimizationRoot` with a loading fallback. That path
does not make a server-personalized HTML promise. The hybrid path in this guide renders the initial
content outside the provider, then lets browser-side `identify()`, `reset()`, `track()`, route page
events, and live updates call the APIs after browser startup.

### Client takeover and live re-resolution

**Integration category:** Required for first integration

Render takeover content with React Web entry primitives from the Next.js client entrypoint.
`liveUpdates` defaults to `false`, so set it globally on `OptimizationRoot` or per `OptimizedEntry`
when visible content must react to profile changes.

1. Create Client Components for entries that need browser-side re-resolution.
2. Pass the baseline Contentful entry into `OptimizedEntry`.
3. Pass `liveUpdates={true}` for entries that must update after `identify()`, `consent()`,
   `reset()`, preview changes, or selected-optimization state changes.
4. Use the server-resolved entry as `loadingFallback` when you need the first rendered content to
   stay stable while the browser SDK becomes ready.
5. Use `useOptimizedEntry()` or `useEntryResolver()` only when a component needs custom rendering
   control that the `OptimizedEntry` wrapper does not provide.

**Adapt this to your use case:**

```tsx
'use client'

import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { Entry } from 'contentful'

function EntryCard({ entry }: { entry: Entry }) {
  return <article>{String(entry.fields.title ?? '')}</article>
}

export function HybridEntry({
  baselineEntry,
  serverResolvedEntry,
}: {
  baselineEntry: Entry
  serverResolvedEntry: Entry
}) {
  // liveUpdates keeps this entry reactive after identify, consent, reset, or preview changes.
  // loadingFallback preserves server-selected content while the browser SDK initializes.
  return (
    <OptimizedEntry
      baselineEntry={baselineEntry}
      liveUpdates={true}
      loadingFallback={<EntryCard entry={serverResolvedEntry} />}
    >
      {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
    </OptimizedEntry>
  )
}
```

For shared live-update controls, set `liveUpdates={true}` on `OptimizationRoot` or wrap a subtree in
`LiveUpdatesProvider`. Per-entry `liveUpdates={true}` or `liveUpdates={false}` overrides the global
setting for that component.

Verify live re-resolution only after the takeover path is working:

1. Enable `liveUpdates={true}` globally or on the entries that must react to browser state changes.
2. Trigger `identify()`, `consent()`, or `reset()` from the Client Component that owns the
   application control.
3. Confirm affected entries re-resolve without a full page refresh and entries with
   `liveUpdates={false}` stay locked until the next render path.

### Page events and App Router navigation

**Integration category:** Required for first integration

Choose one server owner for the initial route page event, then use `NextAppAutoPageTracker` for
browser App Router route changes.

1. Use `getNextjsServerOptimizationData()` as the owner when the route needs returned
   `selectedOptimizations` for personalized initial HTML.
2. The context proxy does not emit page events. It only forwards request context headers for the
   server helper.
3. Mount `NextAppAutoPageTracker` under `OptimizationRoot`.
4. Set `initialPageEvent="skip"` only when the server helper already emitted a page event for the
   same initial route.
5. Use `initialPageEvent="emit"` when the server did not request Optimization data, such as denied
   consent, browser-owned islands, or routes where the server helper returned `undefined`.
6. Use `pagePayload` on the server helper when your initial route event needs app-specific
   properties.

**Follow this pattern:**

```tsx
<Suspense>
  {/* Skip only when the selected server owner emitted this route's initial page event. */}
  <NextAppAutoPageTracker
    initialPageEvent={optimizationData ? 'skip' : 'emit'}
    getPagePayload={({ pathname }) => ({
      properties: {
        routeGroup: pathname.startsWith('/account') ? 'account' : 'public',
      },
    })}
  />
</Suspense>
```

The tracker deduplicates consecutive route keys, including Strict Mode double-effect invocations,
but it does not replace application policy. Use the `skip` mode only for a matching server page
event.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Entry interaction tracking is browser-side. The server or React component renders metadata, and the
browser SDK observes views, clicks, and hovers after consent permits the detectors and event
delivery.

1. Leave the default view, click, and hover interactions enabled when your consent policy permits
   them; use `trackEntryInteraction` only to opt out of interaction types the app must not observe.
2. Use `OptimizedEntry` props such as `clickable`, `trackViews`, `trackClicks`, `trackHovers`,
   `viewDurationUpdateIntervalMs`, and `hoverDurationUpdateIntervalMs` for per-entry control.
3. Use `ServerOptimizedEntry` for server-rendered entries that need the same tracking metadata.
4. Use `sdk.tracking.enableElement(...)` from `useOptimization()` only for app-owned manual
   observation cases.
5. Verify consent gates. Page events can be allowed before full consent, but entry views, clicks,
   and hovers are blocked unless consent or `allowedEventTypes` permits them.

**Follow this pattern:**

```tsx
<OptimizationRoot
  clientId={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? ''}
  // Opt out only when your consent policy disallows a detector.
  trackEntryInteraction={{ hovers: false }}
>
  {children}
</OptimizationRoot>
```

**Follow this pattern:**

```tsx
<OptimizedEntry baselineEntry={entry} clickable hoverDurationUpdateIntervalMs={1000}>
  {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
</OptimizedEntry>
```

The tracking payload uses the resolved entry ID, not the baseline entry ID. For deeper mechanics,
see [Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Consent, identity, and profile continuity are application policy decisions. The SDK provides the
runtime controls, but your application owns the consent record, privacy notice, CMP integration,
identity source, and server cookie cleanup.

1. If policy permits accepted startup, bind accepted consent on the server and seed accepted consent
   in browser consent defaults.
2. If policy depends on user choice, read the choice before server SDK calls and call `consent()`
   from the Client Component that owns the browser decision.
3. Store the policy decision in the same CMP, account preference, session, or cookie that the server
   helper can read on the next request.
4. Call `identify()` from browser flows when a visitor becomes known.
5. Call `reset()` and clear application-owned profile cookies when withdrawal or sign-out must end
   active-session personalization.

**Adapt this to your use case:**

```tsx
'use client'

import {
  useConsentState,
  useOptimizationActions,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import { useEffect, useMemo } from 'react'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function setAppConsentCookie(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  // Store app consent where the server helper can read it on the next request.
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

export function PersonalizationControls() {
  const { setConsent, identifyUser, resetUser } = useOptimizationActions()
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
      <button onClick={() => setConsent(consent !== true)} type="button">
        {consent === true ? 'Reject consent' : 'Accept consent'}
      </button>
      {!isIdentified ? (
        <button
          onClick={() => {
            void identifyUser({ userId: 'user-123', traits: { identified: true } })
          }}
          type="button"
        >
          Identify
        </button>
      ) : (
        <button onClick={() => resetUser()} type="button">
          Reset profile
        </button>
      )}
    </div>
  )
}
```

With `liveUpdates={true}`, `identifyUser()`, `setConsent()`, and `resetUser()` can change
`selectedOptimizations` in the browser SDK and re-render affected entries without a full page
refresh. For consent design details, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

## Optional integrations

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app needs to send approved Optimization context to a tag manager,
customer-data platform, warehouse, or analytics destination. The SDK still sends events to
Contentful; forwarding is application-owned.

1. Keep server and browser forwarding separate. Server-resolved attribution comes from the
   request-local result, while browser activity comes from browser state subscriptions.
2. Register browser subscriptions with `onStatesReady` so event observers attach before child
   effects such as route trackers emit events.
3. Dedupe forwarded events by `messageId` or destination-specific semantic keys.
4. Store forwarded message IDs in module or app state so remounts do not forward the same event
   again. If the destination must receive only future SDK events, read the current `messageId`
   before subscribing and skip that event.
5. Gate forwarding with the same consent and destination policy that controls the rest of your
   analytics stack.

**Adapt this to your use case:**

```tsx
const forwardedMessageIds = new Set<string>()

<OptimizationRoot
  clientId={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? ''}
  onStatesReady={(states) => {
    // Subscribe before child effects, such as route trackers, emit events.
    const initialMessageId = states.eventStream.current?.messageId

    const eventSubscription = states.eventStream.subscribe((event) => {
      if (!event) return
      if (forwardedMessageIds.has(event.messageId)) return
      if (event.messageId === initialMessageId) {
        forwardedMessageIds.add(event.messageId)
        return
      }
      if (!canForwardSdkEvent(event)) return

      forwardedMessageIds.add(event.messageId)
      analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
    })

    const blockedSubscription = states.blockedEventStream.subscribe((blockedEvent) => {
      if (blockedEvent) diagnostics.recordBlockedOptimizationEvent(blockedEvent)
    })

    return () => {
      eventSubscription.unsubscribe()
      blockedSubscription.unsubscribe()
    }
  }}
>
  {children}
</OptimizationRoot>
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local server mapping, React Web subscription helpers, vendor examples, consent, dedupe,
and governance guidance.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags and Custom Flags when entries or components render profile-backed values that are not
entry replacements.

1. Resolve Rich Text merge tag entries during rendering with SDK merge-tag helpers exposed through
   the Next.js client entrypoint or server entrypoint.
2. Keep the SDK locale aligned with the rendered Contentful locale when merge tags reference
   localized profile fields such as `location.city` or `location.country`.
3. Use flag state from the browser SDK for components that need to react after browser startup.
4. Treat flag-view and merge-tag event behavior as consent-gated browser activity unless the server
   path owns the event.

**Follow this pattern:**

```tsx
'use client'

import { useMergeTagResolver } from '@contentful/optimization-nextjs/client'

function MergeTagText({ mergeTagEntry }: { mergeTagEntry: unknown }) {
  const { getMergeTagValue } = useMergeTagResolver()

  // Resolve against the current browser profile state.
  return <span>{getMergeTagValue(mergeTagEntry) ?? ''}</span>
}
```

Merge tags and entry replacement use different mechanics. Entry replacement uses
`selectedOptimizations`; merge tags read profile-backed values from current SDK state.

### Preview panel

**Integration category:** Optional

Use the preview panel where authors or engineers need to inspect variant behavior. Keep production
loading explicit and gate attachment behind an application-owned flag.

1. Add the preview panel package only when your app needs browser authoring tooling.
2. Attach the panel from a Client Component under `OptimizationRoot`.
3. Wait until the browser SDK is ready before attaching the panel.
4. Pass an app-owned Contentful client or pre-fetched preview entries to the attach function.
5. Enable it only when an approved app environment sets `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`
   to `true`.
6. Verify preview behavior with live updates because the preview panel forces optimized entries to
   react to preview state.

**Follow this pattern:**

```tsx
'use client'

import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

export function PreviewPanelAttachment({ nonce }: { nonce?: string }) {
  const { isReady } = useOptimizationContext()
  const previewPanelEnabled = process.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

  useEffect(() => {
    // Keep authoring tooling opt-in.
    if (!previewPanelEnabled) return
    if (!isReady) return

    void Promise.all([
      import('@contentful/optimization-web-preview-panel'),
      import('@/lib/contentful-client'),
    ])
      .then(async ([{ default: attachOptimizationPreviewPanel }, { getContentfulClient }]) => {
        await attachOptimizationPreviewPanel({
          contentful: getContentfulClient(),
          nonce,
        })
      })
      .catch(() => undefined)
  }, [isReady, nonce, previewPanelEnabled])

  return null
}
```

The preview panel package has no attachment side effects. A dynamic import only loads the attach
function; the application must call `attachOptimizationPreviewPanel(...)` with a Contentful client
or `entries: { audiences, experiences }` for preview definitions that the app already loaded.
`entries` takes precedence over `contentful`, so the panel does not fetch through the Contentful
client when both are provided.

The hybrid reference implementation exposes `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` through
Next.js config and attaches the preview panel only when that flag is `true`.

## Advanced integrations

### Route-level SSR, hybrid, and browser-owned islands

**Integration category:** Advanced or production-only

App Router applications can mix route strategies. Choose the strategy per route instead of forcing
one rendering model across the whole app.

| Route need                                                  | Use this pattern                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Server is the only content source until the next request    | Use the SSR guide and render with server helpers only                     |
| Server first render plus browser-side reactivity            | Use this hybrid guide with server optimization state and `OptimizedEntry` |
| Browser-owned personalization after startup                 | Render baseline or loading UI on the server and let the browser own it    |
| Highly interactive account, dashboard, or settings surfaces | Prefer Client Components with live updates and explicit consent state     |

1. Keep SEO-sensitive content in Server Components when the content must be visible in the initial
   HTML.
2. Use Client Components for controls that call hooks, `identify()`, `consent()`, `reset()`, live
   flag state, or manual browser tracking.
3. Use the same `OptimizationRoot` for browser takeover subtrees that share browser SDK state.
4. Reuse the same Contentful locale and anonymous ID continuity rules across mixed route strategies.

The important boundary is ownership: server routes render from request-local Optimization data, and
browser takeover components render from browser SDK state seeded by server optimization state and
updated by later browser events.

### Caching and request deduplication

**Integration category:** Advanced or production-only

Personalized server rendering is request-specific. Keep shared caches on raw Contentful payloads,
not on profile-evaluated SDK results or personalized HTML unless your cache key varies on every
personalization input.

1. Use `cache()` to deduplicate `getNextjsServerOptimizationData()` inside one React Server
   Component render pass.
2. Avoid sharing the result of `getNextjsServerOptimizationData()` across requests. It emits a page
   event and returns profile-specific data.
3. Cache raw Contentful entries by entry ID, locale, environment, and include depth when your app
   cache policy permits it.
4. Mark personalized routes dynamic or otherwise exclude them from full-route caching unless your
   deployment varies the cache on the full profile state.
5. Re-check cache rules when adding `generateStaticParams`, route segment cache settings, CDN
   caching, or reverse proxy caching.

**Copy this:**

```ts
// app/layout.tsx or app/page.tsx
export const dynamic = 'force-dynamic'
```

The exact Next.js cache policy belongs to the application. The SDK does not mark routes dynamic for
you.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

Strict consent and duplicate-event controls are production policy work. Configure them only after
your privacy, analytics, and platform owners agree on the event posture.

1. Use `allowedEventTypes: []` when no SDK events can emit before consent.
2. Return denied consent from the selected server owner and skip server Optimization requests while
   consent is unknown or denied.
3. Clear `ctfl-opt-aid` and application-owned consent or profile cookies when withdrawal must end
   profile continuity.
4. Use `initialPageEvent="skip"` only for a matching server page event. Use `emit` when the browser
   owns the first page event.
5. Subscribe to `states.blockedEventStream` during validation to confirm the SDK blocks the events
   your policy expects it to block.

**Adapt this to your use case:**

```ts
export async function getOptimizationData() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const granted = cookieStore.get('app-personalization-consent')?.value === 'granted'

  if (!granted) return undefined

  return await getNextjsServerOptimizationData(optimization, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: APP_LOCALE,
  })
}
```

Blocked events are not replayed when consent later changes. If the current route, flag, or entry
state still qualifies after consent, the SDK can emit a fresh current-state event.

## Production checks

Run these checks before release:

- Confirm the server SDK uses the intended Optimization client ID, environment, API endpoints,
  locale, app metadata, and log level.
- Confirm browser-exposed `NEXT_PUBLIC_` variables contain only values that can be shipped to the
  client.
- Confirm Contentful fetches use one concrete locale and include resolved optimization entries and
  variants.
- Confirm server request consent, browser SDK consent, anonymous ID persistence, and CMP or account
  preference state stay aligned across first load, route navigation, opt-in, opt-out, sign-in,
  sign-out, and reset.
- Confirm exactly one server owner emits the initial page event and `NextAppAutoPageTracker` does
  not duplicate the first route event.
- Confirm `identify()`, `consent()`, and `reset()` re-resolve only the entries that are configured
  for live updates.
- Confirm entry views, clicks, hovers, flag views, page events, business events, and forwarded
  analytics events are delivered only when policy permits them.
- Confirm baseline fallback renders when the Experience API fails, selected optimizations are
  missing, optimization links are unresolved, or CDA payloads are all-locale.
- Confirm personalized routes are not shared-cache safe unless the cache varies on every
  personalization input.
- Confirm local validation uses the reference implementation flow when you need end-to-end evidence
  for server-to-browser state handoff, proxy request context forwarding, entry tracking, live
  updates, page events, and offline queue behavior.

**Copy this:**

```sh
pnpm implementation:run -- nextjs-sdk_hybrid typecheck
pnpm implementation:run -- nextjs-sdk_hybrid lint
pnpm test:e2e:nextjs-sdk_hybrid
```

## Troubleshooting

| Symptom                                                    | Likely cause                                                                                   | Check                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Entries stay on baseline                                   | Missing selected optimizations, denied consent, unresolved Contentful links, or all-locale CDA | Inspect `selectedOptimizations`, fetch with one `locale`, and use enough `include` depth               |
| Two server-side page events appear for one request         | A route calls `getNextjsServerOptimizationData()` more than once without request deduplication | Wrap the server helper in `cache()` and reuse the helper result inside one render pass                 |
| Browser sends a duplicate first page event                 | `initialPageEvent="emit"` is used after the server already emitted the same route event        | Use `skip` only when the selected server owner emitted a page event for the same initial request       |
| Browser does not send the first page event                 | `initialPageEvent="skip"` is used when the server skipped Optimization                         | Use `emit` when consent is denied, server data is unavailable, or the browser owns first page tracking |
| Live entries do not update after `identify()` or `reset()` | `liveUpdates` is false globally and on the entry                                               | Set `liveUpdates={true}` on the entry or on `OptimizationRoot`                                         |
| Entry views, clicks, or hovers do not emit                 | Interaction tracking is opted out, consent blocks the event, or no profile is available        | Check `trackEntryInteraction`, entry props, consent state, and `states.blockedEventStream`             |
| Server and browser use different profiles                  | Cookie domain, path, readability, or consent cleanup differs between runtimes                  | Use a browser-readable `ctfl-opt-aid` with consistent path and clear it on withdrawal                  |
| Server Components fail with browser globals                | A Client Component hook or browser-only import crossed into a server module                    | Keep server imports on `/server` and browser imports on `/client`                                      |
| Personalized HTML appears stale                            | Route or CDN caching is sharing profile-evaluated output                                       | Mark personalized routes dynamic or vary cache keys on the full personalization context                |

## Reference implementations to compare against

- [Next.js SDK hybrid reference implementation](../../implementations/nextjs-sdk_hybrid/README.md):
  Working App Router application using `@contentful/optimization-nextjs` for server request data,
  server-to-browser state handoff, client takeover, live updates, consent controls, page events,
  entry interaction tracking, preview attachment, and Playwright E2E coverage.
