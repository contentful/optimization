# Integrating the Optimization Next.js SDK in a Next.js App Router app

Use this guide when you want a Next.js App Router route to personalize the initial HTML with server
optimization state, then let the browser take over entry resolution after server-to-browser state
handoff when consent, identity, profile, preview, or route state changes.

This pattern uses `@contentful/optimization-nextjs`. The `/app-router` factory binds app-local
components that compose the stateless Node SDK in Server Components and the React Web SDK in Client
Components. The request handler forwards sanitized Next.js proxy or middleware request context
headers. Your application still owns Contentful fetching, consent policy, identity policy, routing,
caching, and component rendering.

If your application still uses the Pages Router, use the
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
instead.

## Quick start

This quick start assumes your application policy permits accepted SDK startup. It uses the bound
server root as the initial page-event owner so the route can render personalized HTML before browser
takeover. If consent depends on a consent management platform (CMP), regional rule, account
preference, or user choice, keep the same structure and apply the policy-dependent consent section
before release.

1. Install the Next.js adapter package.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs
   ```

2. Bind app-local SDK components once from `/app-router`. Server Components resolve this import to
   the automatic server implementation, and Client Components resolve it to client exports.

   **Copy this:**

   ```ts
   // lib/optimization.ts
   import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'

   export const APP_LOCALE = 'en-US'

   export const { proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizedEntry } =
     createNextjsAppRouterOptimization({
       clientId: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
       environment: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
       locale: APP_LOCALE,
       defaults: { consent: true, persistenceConsent: true },
       server: {
         enabled: true,
         consent: { events: true, persistence: true },
       },
       api: {
         experienceBaseUrl: process.env.NEXT_PUBLIC_CONTENTFUL_EXPERIENCE_API_BASE_URL,
         insightsBaseUrl: process.env.NEXT_PUBLIC_CONTENTFUL_INSIGHTS_API_BASE_URL,
       },
       app: {
         name: 'my-next-app',
         version: '1.0.0',
       },
       logLevel: 'error',
     })
   ```

3. Export the SDK proxy for Server Components that use the bound server path.

   **Copy this:**

   ```ts
   // proxy.ts
   export { proxy } from './lib/optimization'

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
   }
   ```

4. Mount the bound root once in the App Router layout. The SDK proxy reads request cookies and
   headers, calls the server SDK, persists the returned profile ID, and passes server optimization
   state into the browser root.

   **Adapt this to your use case:**

   ```tsx
   // app/layout.tsx
   import { NextAppAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
   import { Suspense, type ReactNode } from 'react'

   export default async function RootLayout({ children }: { children: ReactNode }) {
     return (
       <html lang="en">
         <body>
           <OptimizationRoot>
             <Suspense>
               {/* The bound server root owns the initial page event for this request. */}
               <NextAppAutoPageTracker initialPageEvent="skip" />
             </Suspense>
             {children}
           </OptimizationRoot>
         </body>
       </html>
     )
   }
   ```

5. Fetch single-locale Contentful entries in a Server Component and render first-paint content with
   the bound `OptimizedEntry`.

   **Adapt this to your use case:**

   ```tsx
   // app/page.tsx
   import { OptimizedEntry } from '@/lib/optimization'
   import { fetchEntriesFromContentful } from '@/lib/contentful-client'
   import type { Entry } from 'contentful'

   function EntryCard({ entry }: { entry: Entry }) {
     return <h2>{String(entry.fields.title ?? '')}</h2>
   }

   export default async function Home() {
     const entries = await fetchEntriesFromContentful(['home-hero', 'home-offer'])

     return (
       <>
         {entries.map((entry) => (
           <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
             {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
           </OptimizedEntry>
         ))}
       </>
     )
   }
   ```

6. Verify the first run. The route source must contain the server-selected content or baseline
   fallback, that content must remain visible after hydration, and the browser must not emit a
   duplicate initial page event when `initialPageEvent="skip"` is used with the bound server root.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Package entry points and runtime boundary](#package-entry-points-and-runtime-boundary)
  - [App-local bound components](#app-local-bound-components)
  - [Proxy request context](#proxy-request-context)
  - [Contentful fetching and entry shape](#contentful-fetching-and-entry-shape)
  - [Server first render and fallback behavior](#server-first-render-and-fallback-behavior)
  - [Bound root and server optimization state](#bound-root-and-server-optimization-state)
  - [Client takeover and live re-resolution](#client-takeover-and-live-re-resolution)
  - [Page events and App Router navigation](#page-events-and-app-router-navigation)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Consent, identity, profile, and reset](#consent-identity-profile-and-reset)
- [Optional integrations](#optional-integrations)
  - [Analytics forwarding](#analytics-forwarding)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Route-level SSR, browser takeover, and browser-owned islands](#route-level-ssr-browser-takeover-and-browser-owned-islands)
  - [Manual server and client escape hatches](#manual-server-and-client-escape-hatches)
  - [Caching and request deduplication](#caching-and-request-deduplication)
  - [Strict consent and duplicate-event controls](#strict-consent-and-duplicate-event-controls)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this table as the setup inventory for the full App Router integration:

| Setup item                                                        | Category                       | Required for quick start | Where to configure                                                                  |
| ----------------------------------------------------------------- | ------------------------------ | ------------------------ | ----------------------------------------------------------------------------------- |
| Next.js App Router with React and React DOM peer dependencies     | Required for first integration | Yes                      | Application `package.json`                                                          |
| `@contentful/optimization-nextjs` package                         | Required for first integration | Yes                      | Application package manager                                                         |
| App-local bound components from `/app-router`                     | Required for first integration | Yes                      | `lib/optimization.ts` with `createNextjsAppRouterOptimization()`                    |
| Optimization client ID, environment, locale, and API endpoints    | Required for first integration | Yes                      | Bound component factory config with browser-safe environment variables              |
| Contentful CDA credentials and app-owned fetcher                  | Required for first integration | Yes                      | Application Contentful client                                                       |
| Single-locale CDA entries with resolved optimization links        | Required for first integration | Yes                      | CDA calls with one `locale` and enough `include` depth, commonly `include: 10`      |
| Next.js proxy or middleware hook                                  | Common but policy-dependent    | Yes                      | `proxy.ts` or `middleware.ts` for request context forwarding                        |
| Bound `OptimizationRoot`                                          | Required for first integration | Yes                      | App Router layout                                                                   |
| Bound `OptimizedEntry` for server first-paint/static content      | Required for first integration | Yes                      | Server Components that render Contentful entries                                    |
| App-local or `/client` `OptimizedEntry` for live/browser surfaces | Required for first integration | No                       | Client Components that render personalized entries after browser startup            |
| App Router page tracker                                           | Required for first integration | Yes                      | `NextAppAutoPageTracker` under the bound `OptimizationRoot`                         |
| Consent and persistence policy                                    | Common but policy-dependent    | Conditional              | `server.consent`, browser consent defaults, CMP, or controls                        |
| Anonymous ID cookie continuity                                    | Common but policy-dependent    | Conditional              | Bound server state handoff, ESR persistence, and `ctfl-opt-aid`                     |
| Browser identify, profile state, and reset controls               | Common but policy-dependent    | No                       | Client Components using Next.js client hooks                                        |
| Entry interaction tracking for views, clicks, and hovers          | Common but policy-dependent    | No                       | Factory `trackEntryInteraction`, `OptimizedEntry` props, or manual browser tracking |
| Analytics or tag-manager forwarding                               | Optional                       | No                       | Factory `onStatesReady` subscription and app-owned forwarding code                  |
| Merge tag and Custom Flag rendering                               | Optional                       | No                       | `OptimizedEntry` render props, Rich Text renderers, flag readers, and live surfaces |
| Preview panel package                                             | Optional                       | No                       | Environment-gated preview attachment in non-production app environments             |
| Manual server or client SDK wiring                                | Advanced or production-only    | No                       | `/server`, `/client`, and explicit `serverOptimizationState` escape hatches         |
| Strict pre-consent allowlist, storage, queue, and cookie policy   | Advanced or production-only    | No                       | Factory config, `server.consent`, CMP integration, and application cleanup          |
| Personalized response caching and duplicate-event policy          | Advanced or production-only    | No                       | Next.js route config, CDN rules, bound component placement, and tracker settings    |

Use one application Contentful locale for entries that feed SDK resolution. The SDK Experience and
event locale often uses the same string, but the SDK does not fetch Contentful content or change CDA
requests for you.

## Core integration

### Package entry points and runtime boundary

**Integration category:** Required for first integration

The Next.js adapter is a glue package. App Router integrations should start from `/app-router` and
export app-local bound components once. Use subpaths for hooks, request handlers, schemas, ESR, or
manual escape hatches.

| Import path                                       | Runtime                                       | Responsibility                                                                                                    |
| ------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router`      | App-local binding module                      | Preferred `createNextjsAppRouterOptimization()` factory for App Router proxy plus Server and Client Components    |
| `@contentful/optimization-nextjs/client`          | Client Components                             | Router-neutral browser hooks, manual client providers, live updates helpers, and entry components                 |
| `@contentful/optimization-nextjs/server`          | Advanced server-only modules                  | Manual server SDK creation, request binding, server resolution, and SSR tracking attributes                       |
| `@contentful/optimization-nextjs/esr`             | Route handlers, edge functions, and ESR flows | Request-rendered Optimization data and explicit response persistence                                              |
| `@contentful/optimization-nextjs/request-handler` | Next.js proxy or middleware                   | Request URL capture and SDK-owned request header sanitization                                                     |
| `@contentful/optimization-nextjs/api-schemas`     | Shared schema helpers                         | API types plus structural guards such as `isMergeTagEntry`, `isRichTextDocument`, and `isResolvedContentfulEntry` |

1. Install `@contentful/optimization-nextjs` in the Next.js app.
2. Create an app-local module, commonly `lib/optimization.ts`, that calls
   `createNextjsAppRouterOptimization()`.
3. Import `OptimizationRoot`, `OptimizationProvider`, the bound `OptimizedEntry`, and route trackers
   from the app-local module in Server and Client Components.
4. Import browser hooks, and `OptimizedEntry` for per-entry `liveUpdates` or `loadingFallback`, from
   `/client` only inside Client Components marked with `'use client'`.
5. Re-export `proxy` from the app-local module in proxy or middleware code and declare the literal
   Next.js matcher config there.
6. Keep `/server` imports for manual server control when the bound App Router factory does not fit a
   route.
7. Import schema guards and API types from `/api-schemas`, not from `/client`.

**Copy this:**

```sh
pnpm add @contentful/optimization-nextjs
```

The adapter package lists Next.js, React, and React DOM as application-owned peer dependencies. It
uses the runtime that is already installed by the app.

### App-local bound components

**Integration category:** Required for first integration

Create the bound components once at module level. The `/app-router` export resolves to the automatic
server implementation for Server Components and to client exports for Client Components. The SDK
proxy creates the server SDK, reads request cookies and headers, resolves `server.consent`, calls
the server page helper, persists `ctfl-opt-aid`, and forwards server data. The bound server root and
bound server `OptimizedEntry` consume that forwarded data and pass it through
`serverOptimizationState` internally.

1. Read browser-safe Optimization client ID, environment, locale, and endpoint values in the
   app-local binding module.
2. Pass the application Experience/event locale to the SDK singleton.
3. Configure API endpoint overrides only when your app uses mocks, a proxy, or non-default hosts.
4. Set `server.enabled: true` and provide `server.consent` when the server path should own first
   paint personalization and initial page data.
5. Put application consent policy in `server.consent`; return `false` when the request is not
   allowed to personalize.
6. Configure `defaults` for the browser SDK's startup state.
7. Export the returned `proxy` from `proxy.ts` and declare the matcher as a literal Next.js config
   object for routes that use the bound server path.

**Adapt this to your use case:**

```ts
// lib/optimization.ts
import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'

export const APP_LOCALE = 'en-US'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

export const {
  proxy,
  NextAppAutoPageTracker,
  OptimizationRoot,
  OptimizationProvider,
  OptimizedEntry,
} = createNextjsAppRouterOptimization({
  clientId: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
  environment: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  locale: APP_LOCALE,
  defaults: { consent: false, persistenceConsent: false },
  server: {
    enabled: true,
    consent: ({ cookies }) =>
      cookies.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'
        ? { events: true, persistence: true }
        : false,
  },
  api: {
    experienceBaseUrl: process.env.NEXT_PUBLIC_CONTENTFUL_EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: process.env.NEXT_PUBLIC_CONTENTFUL_INSIGHTS_API_BASE_URL,
  },
  app: {
    name: 'my-next-app',
    version: '1.0.0',
  },
  logLevel: 'error',
})
```

The bound server path treats its request-local page call as the initial server page event for the
route. It caches that request data inside one React render pass, so the root and server
`OptimizedEntry` calls share the same profile, selected optimizations, and changes.

### Proxy request context

**Integration category:** Common but policy-dependent

Use the returned Next.js proxy or middleware handler to capture request context, call the Experience
API, persist the returned profile ID, and forward server data before Server Components use the bound
server root or bound server `OptimizedEntry`.

1. Export `proxy` from `proxy.ts` or `middleware.ts`.
2. Match routes whose Server Components use the bound server path.
3. Keep consent, locale, and profile policy in the app-local component factory.

**Adapt this to your use case:**

```ts
// proxy.ts
export { proxy } from './lib/optimization'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

The proxy strips incoming SDK-owned request headers, forwards sanitized request context, and
persists the Experience API returned `profile.id` as `ctfl-opt-aid` when persistence consent allows
it.

Do not mark `ctfl-opt-aid` as `HttpOnly` when the browser SDK must adopt it through browser state
handoff or an explicit server persistence flow. For deeper mechanics, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

### Contentful fetching and entry shape

**Integration category:** Required for first integration

The SDK does not fetch Contentful entries. Fetch baseline entries in the application layer with one
Contentful locale and resolved optimization links before passing them to bound server or client
entry primitives.

1. Choose the application Contentful locale in routing, i18n, request policy, or app configuration.
2. Pass that locale to CDA requests.
3. Include linked optimization entries and variant entries. The common Contentful CDA setting is
   `include: 10`.
4. Do not pass all-locale CDA responses from `contentful.js` `withAllLocales` or raw CDA `locale=*`
   into bound `OptimizedEntry`, `resolveOptimizedEntry()`, or `useOptimizedEntry()`.
5. Use the same locale as the SDK Experience/event locale when localized Experience responses and
   rendered content need to match.

**Adapt this to your use case:**

```ts
import { createClient, type Entry } from 'contentful'
import { APP_LOCALE } from './optimization'

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

Use the app-local bound `OptimizedEntry` in Server Components for first-paint or static content. The
server implementation resolves locally against request-selected optimizations and renders tracking
metadata for browser observers.

1. Fetch Contentful entries in the Server Component that owns the route content.
2. Render each baseline entry through the app-local `OptimizedEntry`.
3. Render the `resolvedEntry` from the render prop.
4. Use the render-prop `getMergeTagValue` when the same render path needs merge tags.
5. Treat denied consent, missing optimization data, unresolved links, all-locale CDA payloads, and
   API failures as baseline fallback cases.

**Adapt this to your use case:**

```tsx
// app/page.tsx
import { OptimizedEntry } from '@/lib/optimization'
import { fetchEntriesFromContentful } from '@/lib/contentful-client'
import type { Entry } from 'contentful'

function EntryCard({ entry }: { entry: Entry }) {
  return <h2>{String(entry.fields.title ?? '')}</h2>
}

export default async function Home() {
  const entries = await fetchEntriesFromContentful(['home-hero', 'home-offer'])

  return (
    <>
      {entries.map((entry) => (
        <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
          {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
        </OptimizedEntry>
      ))}
    </>
  )
}
```

The default App Router path does not need a custom takeover boundary or a manual
`resolveOptimizedEntry()` call. Use those only when an advanced route needs direct server SDK
control.

### Bound root and server optimization state

**Integration category:** Required for first integration

The app-local `OptimizationRoot` is already bound to the factory config. In Server Component layouts
it loads request Optimization data and passes that data to the browser root as
`serverOptimizationState` internally. In Client Components it uses the client implementation with
server-only config removed.

1. Mount the app-local `OptimizationRoot` once around the route subtree that shares SDK state.
2. Configure `defaults`, `onStatesReady`, `liveUpdates`, and `trackEntryInteraction` in
   `createNextjsAppRouterOptimization()`, not as per-render root props.
3. Wrap `NextAppAutoPageTracker` in `Suspense` because it uses App Router navigation hooks.
4. Use `initialPageEvent="skip"` when the bound server root owns the initial request page event.
5. Use `OptimizationProvider` from the same app-local module only when a nested provider boundary is
   needed.

**Adapt this to your use case:**

```tsx
// app/layout.tsx
import { NextAppAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import { Suspense, type ReactNode } from 'react'

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OptimizationRoot>
          <Suspense>
            <NextAppAutoPageTracker initialPageEvent="skip" />
          </Suspense>
          {children}
        </OptimizationRoot>
      </body>
    </html>
  )
}
```

Manual `serverOptimizationState` props still exist for lower-level `/client` roots, but they are an
advanced escape hatch. The bound App Router root handles state handoff for the default path.

### Client takeover and live re-resolution

**Integration category:** Required for first integration

Render browser-owned surfaces with the app-local `OptimizedEntry` when entries can inherit factory
or provider live-update settings. Use `/client` `OptimizedEntry` for client-only islands that need
per-entry `liveUpdates` or `loadingFallback`; the bound App Router entry intentionally omits those
props so Server and Client Component typings stay aligned.

1. Create Client Components for entries that need browser-side re-resolution.
2. Import `OptimizedEntry` from the app-local binding module when entries inherit factory or
   provider settings.
3. Import `OptimizedEntry` from `/client` when a client-only entry needs per-entry `liveUpdates` or
   `loadingFallback`.
4. Use factory-level `liveUpdates: true`, `LiveUpdatesProvider`, or `/client` per-entry
   `liveUpdates` for entries that must update after `identifyUser()`, `setConsent()`, `resetUser()`,
   preview changes, or selected-optimization state changes.
5. Use `/client` hooks such as `useOptimizedEntry()` or `useEntryResolver()` only when a component
   needs custom rendering control that the `OptimizedEntry` wrapper does not provide.

**Adapt this to your use case:**

```tsx
'use client'

import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { Entry } from 'contentful'

function EntryCard({ entry }: { entry: Entry }) {
  return <article>{String(entry.fields.title ?? '')}</article>
}

export function LiveEntry({ baselineEntry }: { baselineEntry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry} liveUpdates>
      {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
    </OptimizedEntry>
  )
}
```

For shared live-update controls, set `liveUpdates: true` in the component factory or wrap a subtree
in `LiveUpdatesProvider`. The App Router bound `OptimizedEntry` intentionally does not accept
per-entry live-update or loading-fallback props because the same app-local import must also
type-check for Server Components.

Verify live re-resolution only after the takeover path is working:

1. Enable `liveUpdates: true` globally or through `LiveUpdatesProvider` for entries that must react
   to browser state changes.
2. Trigger `identifyUser()`, `setConsent()`, or `resetUser()` from the Client Component that owns
   the application control.
3. Confirm affected entries re-resolve without a full page refresh and entries with `/client`
   `liveUpdates={false}` stay locked until the next render path.

### Page events and App Router navigation

**Integration category:** Required for first integration

Choose one owner for the initial route page event, then use `NextAppAutoPageTracker` for browser App
Router route changes.

1. Let the bound server root own the initial page event when `server.enabled` is `true` for the
   route subtree.
2. The context proxy does not emit page events. It only forwards request context headers for the
   bound server path.
3. Mount `NextAppAutoPageTracker` under the app-local `OptimizationRoot`.
4. Set `initialPageEvent="skip"` when the bound server path owns the same initial route event.
5. Use `initialPageEvent="emit"` when a route is browser-owned and does not use the bound server
   path for first request data.
6. Use manual `/server` helpers only when the initial server page event needs per-route payload
   control that the bound factory does not expose.

**Follow this pattern:**

```tsx
<Suspense>
  {/* Skip only when the bound server path owns this route's initial page event. */}
  <NextAppAutoPageTracker
    initialPageEvent="skip"
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

Entry interaction tracking is browser-side. Bound `OptimizedEntry` renders the metadata on the
server or client, and the browser SDK observes views, clicks, and hovers after consent permits the
detectors and event delivery.

1. Leave the default view, click, and hover interactions enabled when your consent policy permits
   them; use factory `trackEntryInteraction` only to opt out of interaction types the app must not
   observe.
2. Use `OptimizedEntry` props such as `clickable`, `trackViews`, `trackClicks`, `trackHovers`,
   `viewDurationUpdateIntervalMs`, and `hoverDurationUpdateIntervalMs` for per-entry control.
3. Use `sdk.tracking.enableElement(...)` from `useOptimization()` only for app-owned manual
   observation cases.
4. Use `getServerTrackingAttributes()` only when a route also uses manual `/server` resolution.
5. Verify consent gates. Page events can be allowed before full consent, but entry views, clicks,
   and hovers are blocked unless consent or `allowedEventTypes` permits them.

**Follow this pattern:**

```tsx
createNextjsAppRouterOptimization({
  // ...clientId, environment, locale, server, defaults
  // Opt out only when your consent policy disallows a detector.
  trackEntryInteraction: { hovers: false },
})
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

1. If policy permits accepted startup, set accepted `server.consent` and seed accepted consent in
   browser defaults.
2. If policy depends on user choice, read the choice in `server.consent` and call `setConsent()`
   from the Client Component that owns the browser decision.
3. Store the policy decision in the same CMP, account preference, session, or cookie that the server
   consent resolver can read on the next request.
4. Call `identifyUser()` from browser flows when a visitor becomes known.
5. Call `resetUser()` and clear application-owned profile cookies when withdrawal or sign-out must
   end active-session personalization.

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
  // Store app consent where server.consent can read it on the next request.
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

With factory-level, provider-level, or `/client` per-entry live updates enabled, `identifyUser()`,
`setConsent()`, and `resetUser()` can change `selectedOptimizations` in the browser SDK and
re-render affected entries without a full page refresh. For consent design details, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

## Optional integrations

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app needs to send approved Optimization context to a tag manager,
customer-data platform, warehouse, or analytics destination. The SDK still sends events to
Contentful; forwarding is application-owned.

1. Keep server and browser forwarding separate. Server-rendered attribution comes from the request
   that resolved the entry, while browser activity comes from browser state subscriptions.
2. Register browser subscriptions with factory `onStatesReady` so event observers attach before
   child effects such as route trackers emit events.
3. Dedupe forwarded events by `messageId` or destination-specific semantic keys.
4. Store forwarded message IDs in module or app state so remounts do not forward the same event
   again. If the destination must receive only future SDK events, read the current `messageId`
   before subscribing and skip that event.
5. Gate forwarding with the same consent and destination policy that controls the rest of your
   analytics stack.

**Adapt this to your use case:**

```tsx
const forwardedMessageIds = new Set<string>()

export const { proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsAppRouterOptimization({
    // ...clientId, environment, locale, server, defaults
    onStatesReady: (states) => {
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
    },
  })
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local server mapping, React Web subscription helpers, vendor examples, consent, dedupe,
and governance guidance.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags and Custom Flags when entries or components render profile-backed values that are not
entry replacements.

1. Resolve Rich Text merge tag entries with the `getMergeTagValue` function passed to
   `OptimizedEntry` render props.
2. Keep the SDK locale aligned with the rendered Contentful locale when merge tags reference
   localized profile fields such as `location.city` or `location.country`.
3. Use flag state from the browser SDK for components that need to react after browser startup.
4. Treat flag-view and merge-tag event behavior as consent-gated browser activity unless the server
   path owns the event.

**Follow this pattern:**

```tsx
import { OptimizedEntry } from '@/lib/optimization'
import type { Entry } from 'contentful'

function EntryCard({
  entry,
  getMergeTagValue,
}: {
  entry: Entry
  getMergeTagValue: (mergeTagEntry: unknown) => string | undefined
}) {
  return <span>{getMergeTagValue(entry.fields.greeting) ?? ''}</span>
}

export function EntryWithMergeTags({ entry }: { entry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolvedEntry, { getMergeTagValue }) => (
        <EntryCard entry={resolvedEntry} getMergeTagValue={getMergeTagValue} />
      )}
    </OptimizedEntry>
  )
}
```

Merge tags and entry replacement use different mechanics. Entry replacement uses
`selectedOptimizations`; merge tags read profile-backed values from current SDK state. Use
`useMergeTagResolver()` from `/client` only in Client Components that need merge tags outside an
`OptimizedEntry` render prop.

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

The App Router reference implementation exposes `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` through
Next.js config and attaches the preview panel only when that flag is `true`.

## Advanced integrations

### Route-level SSR, browser takeover, and browser-owned islands

**Integration category:** Advanced or production-only

App Router applications can mix route strategies. Choose the strategy per route instead of forcing
one rendering model across the whole app.

| Route need                                                  | Use this pattern                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Server is the only content source until the next request    | Render with bound server `OptimizedEntry` and keep browser live updates off  |
| Server first render plus browser-side reactivity            | Use bound root handoff and app-local or `/client` `OptimizedEntry`           |
| Browser-owned personalization after startup                 | Render baseline or loading UI on the server and let Client Components own it |
| Highly interactive account, dashboard, or settings surfaces | Prefer Client Components with live updates and explicit consent state        |

1. Keep SEO-sensitive content in Server Components when the content must be visible in the initial
   HTML.
2. Use Client Components for controls that call hooks, `identifyUser()`, `setConsent()`,
   `resetUser()`, live flag state, or manual browser tracking.
3. Use the same app-local `OptimizationRoot` for browser takeover subtrees that share browser SDK
   state.
4. Reuse the same Contentful locale and anonymous ID continuity rules across mixed route strategies.

The important boundary is ownership: Server Components render through the bound server
`OptimizedEntry`, and Client Components render through the app-local `OptimizedEntry` or `/client`
`OptimizedEntry` when they need per-entry browser-only props.

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use manual helpers only when the bound App Router factory cannot express a route's control needs.

1. Use `createNextjsOptimization()` and `getNextjsServerOptimizationData()` from `/server` when a
   route needs direct request SDK control, custom server page payloads, or app-owned request
   deduplication.
2. Pass `serverOptimizationState` to `/client` `OptimizationRoot` or `OptimizationProvider` only in
   manual server/client setups.
3. Use `getServerTrackingAttributes()` only with manual `resolveOptimizedEntry()` results.
4. Keep a custom takeover boundary only when the app needs staged reveal behavior that the bound
   root plus server/client `OptimizedEntry` split does not cover.

### Caching and request deduplication

**Integration category:** Advanced or production-only

Personalized server rendering is request-specific. Keep shared caches on raw Contentful payloads,
not on profile-evaluated SDK results or personalized HTML unless your cache key varies on every
personalization input.

1. Let the bound component factory's internal `cache()` deduplicate request Optimization data inside
   one React Server Component render pass.
2. Create the bound components once in an app-local module. Multiple factories can create multiple
   server page calls.
3. Avoid sharing server Optimization data across requests. It is profile-specific and tied to the
   request page event.
4. Cache raw Contentful entries by entry ID, locale, environment, and include depth when your app
   cache policy permits it.
5. Mark personalized routes dynamic or otherwise exclude them from full-route caching unless your
   deployment varies the cache on the full profile state.
6. Re-check cache rules when adding `generateStaticParams`, route segment cache settings, CDN
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

1. Use `allowedEventTypes: []` in the factory config when no SDK events can emit before consent.
2. Return `false` from `server.consent` while consent is unknown or denied.
3. Clear `ctfl-opt-aid` and application-owned consent or profile cookies when withdrawal must end
   profile continuity.
4. Use `initialPageEvent="skip"` only for a matching server page event. Use `emit` when the browser
   owns the first page event.
5. Subscribe to `states.blockedEventStream` during validation to confirm the SDK blocks the events
   your policy expects it to block.

**Adapt this to your use case:**

```ts
createNextjsAppRouterOptimization({
  // ...clientId, environment, locale
  allowedEventTypes: [],
  defaults: { consent: false, persistenceConsent: false },
  server: {
    enabled: true,
    consent: ({ cookies }) =>
      cookies.get('app-personalization-consent')?.value === 'granted'
        ? { events: true, persistence: true }
        : false,
  },
})
```

Blocked events are not replayed when consent later changes. If the current route, flag, or entry
state still qualifies after consent, the SDK can emit a fresh current-state event.

## Production checks

Run these checks before release:

- Confirm the app-local component factory uses the intended Optimization client ID, environment, API
  endpoints, locale, app metadata, and log level.
- Confirm browser-exposed `NEXT_PUBLIC_` variables contain only values that can be shipped to the
  client.
- Confirm Contentful fetches use one concrete locale and include resolved optimization entries and
  variants.
- Confirm `server.consent`, browser SDK consent, anonymous ID persistence, and CMP or account
  preference state stay aligned across first load, route navigation, opt-in, opt-out, sign-in,
  sign-out, and reset.
- Confirm the bound server path owns the initial page event and `NextAppAutoPageTracker` does not
  duplicate the first route event.
- Confirm `identifyUser()`, `setConsent()`, and `resetUser()` re-resolve only the entries that are
  configured for live updates.
- Confirm entry views, clicks, hovers, flag views, page events, business events, and forwarded
  analytics events are delivered only when policy permits them.
- Confirm baseline fallback renders when the Experience API fails, selected optimizations are
  missing, optimization links are unresolved, or CDA payloads are all-locale.
- Confirm personalized routes are not shared-cache safe unless the cache varies on every
  personalization input.
- Confirm local validation uses the reference implementation flow when you need end-to-end evidence
  for bound server-to-browser state handoff, proxy request context forwarding, entry tracking, live
  updates, page events, and offline queue behavior.

**Copy this:**

```sh
pnpm implementation:run -- nextjs-sdk_app-router typecheck
pnpm implementation:run -- nextjs-sdk_app-router lint
pnpm test:e2e:nextjs-sdk_app-router
```

## Troubleshooting

| Symptom                                                            | Likely cause                                                                                   | Check                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Entries stay on baseline                                           | Missing selected optimizations, denied consent, unresolved Contentful links, or all-locale CDA | Check `server.consent`, fetch with one `locale`, and use enough `include` depth                          |
| Two server-side page events appear for one request                 | Multiple bound factories or a manual helper also calls the server page path                    | Create bound components once and keep manual `getNextjsServerOptimizationData()` out of the route        |
| Browser sends a duplicate first page event                         | `initialPageEvent="emit"` is used after the bound server path already emitted the same route   | Use `skip` only when the bound server path owns the same initial request                                 |
| Browser does not send the first page event                         | `initialPageEvent="skip"` is used on a browser-owned route without a matching server event     | Use `emit` when the browser owns first page tracking                                                     |
| Live entries do not update after `identifyUser()` or `resetUser()` | `liveUpdates` is false in the factory or provider                                              | Set `liveUpdates: true` in the component factory or wrap the subtree in `LiveUpdatesProvider`            |
| Entry views, clicks, or hovers do not emit                         | Interaction tracking is opted out, consent blocks the event, or no profile is available        | Check factory `trackEntryInteraction`, entry props, consent state, and `states.blockedEventStream`       |
| Server and browser use different profiles                          | Cookie domain, path, readability, or consent cleanup differs between runtimes                  | Use a browser-readable `ctfl-opt-aid` with consistent path and clear it on withdrawal                    |
| Server Components fail with browser globals                        | A Client Component hook or browser-only import crossed into a server module                    | Use app-local bound component imports in Server Components and `/client` hooks only in Client Components |
| Personalized HTML appears stale                                    | Route or CDN caching is sharing profile-evaluated output                                       | Mark personalized routes dynamic or vary cache keys on the full personalization context                  |

## Reference implementations to compare against

- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md):
  Working App Router application using app-local bound components for server first paint,
  server-to-browser state handoff, client takeover, live updates, consent controls, page events,
  entry interaction tracking, preview attachment, and Playwright E2E coverage.
- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md):
  Pages Router equivalent using `getServerSideProps` state handoff.
