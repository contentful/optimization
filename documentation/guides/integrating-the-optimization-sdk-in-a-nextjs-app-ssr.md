# Integrating the Optimization Next.js SDK in a Next.js app (SSR)

Use this guide when you want to add personalization to a Next.js App Router application where the
server is the source of truth for the content shown on each request. The Next.js adapter resolves
entries in Server Components before HTML leaves the server, then hands server optimization state to
the browser SDK for page events, entry interaction tracking, consent controls, identify, and reset.

If the page must re-resolve entries immediately after a browser-side identify, consent, or reset
action, use the
[hybrid SSR + CSR takeover guide](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md)
instead.

## Quick start

This quick start proves that one server-resolved Contentful entry renders in the initial HTML as the
selected Optimization variant or the baseline fallback. It uses accepted server request consent
without profile persistence. Use this path only when your application policy permits an Optimization
server page call at first load. If consent depends on a consent management platform (CMP), account
preference, or regional rule, use the policy-dependent consent section before release.

1. Install the Next.js adapter package.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs
   ```

2. Create one server SDK singleton.

   **Copy this:**

   ```ts
   // lib/optimization-server.ts
   import { createNextjsOptimization } from '@contentful/optimization-nextjs/server'

   export const APP_LOCALE = 'en-US'

   // Keep one server SDK instance; bind request state through adapter helpers.
   export const optimization = createNextjsOptimization({
     clientId: process.env.CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
     environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
     locale: APP_LOCALE,
     logLevel: 'error',
   })
   ```

3. Fetch one Contentful entry in a Server Component, resolve it with request-local Optimization
   data, and render the resolved entry.

   In this snippet, `fetchEntryFromContentful()` is an app-owned Contentful CDA helper. It must
   return one single-locale entry with linked optimization entries and variants included. The
   `cookieStore` and `headerStore` values come from Next.js `cookies()` and `headers()`.
   `<NextjsOptimizationState>` is valid when this page renders under SDK context provided by
   `OptimizationRoot` or `OptimizationProvider`, such as a shared App Router layout. If you have not
   added that provider yet, omit the marker until you complete the client provider section.

   **Adapt this to your use case:**

   ```tsx
   // app/page.tsx
   import { APP_LOCALE, optimization } from '@/lib/optimization-server'
   import { NextjsOptimizationState } from '@contentful/optimization-nextjs/client'
   import { getNextjsServerOptimizationData } from '@contentful/optimization-nextjs/server'
   import { cookies, headers } from 'next/headers'

   export default async function Home() {
     const [cookieStore, headerStore, baselineEntry] = await Promise.all([
       cookies(),
       headers(),
       fetchEntryFromContentful({
         entryId: 'homepage-hero',
         include: 10,
         locale: APP_LOCALE,
       }),
     ])

     // Bind request state to the server page call without durable profile persistence.
     const { data: optimizationData } = await getNextjsServerOptimizationData(optimization, {
       consent: { events: true, persistence: false },
       cookies: cookieStore,
       headers: headerStore,
       locale: APP_LOCALE,
     })

     // The resolver returns the baseline entry when no selected optimization matches.
     const resolvedData = optimization.resolveOptimizedEntry(
       baselineEntry,
       optimizationData?.selectedOptimizations,
     )
     const resolvedEntry = resolvedData.entry

     return (
       <main>
         <NextjsOptimizationState data={optimizationData} />
         <h1>{String(resolvedEntry.fields.title ?? '')}</h1>
       </main>
     )
   }
   ```

4. Verify the first page load by inspecting the server-rendered HTML response or page source. The
   rendered heading must match the selected variant when `selectedOptimizations` contains a matching
   entry decision, or the baseline entry when no matching decision or Optimization data exists.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Package entry points and server singleton](#package-entry-points-and-server-singleton)
  - [Request context, consent, and anonymous ID continuity](#request-context-consent-and-anonymous-id-continuity)
  - [Server-side Contentful fetching and entry resolution](#server-side-contentful-fetching-and-entry-resolution)
  - [Client provider, state handoff, and route tracking](#client-provider-state-handoff-and-route-tracking)
  - [Consent, identity, and SSR update timing](#consent-identity-and-ssr-update-timing)
- [Optional integrations](#optional-integrations)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Analytics forwarding](#analytics-forwarding)
- [Advanced integrations](#advanced-integrations)
  - [Locale and request options](#locale-and-request-options)
  - [Caching and request deduplication](#caching-and-request-deduplication)
  - [Edge/request-rendered personalization](#edgerequest-rendered-personalization)
  - [Unsupported SSR concerns and hybrid handoff](#unsupported-ssr-concerns-and-hybrid-handoff)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this table as the setup inventory for the full SSR integration:

| Setup item                                                         | Category                       | Required for quick start | Where to configure                                                                   |
| ------------------------------------------------------------------ | ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------ |
| Next.js App Router with React and React DOM peer dependencies      | Required for first integration | Yes                      | Application `package.json`                                                           |
| `@contentful/optimization-nextjs` package                          | Required for first integration | Yes                      | Application package manager                                                          |
| Optimization client ID and environment                             | Required for first integration | Yes                      | Server SDK config and `OptimizationRoot` props for browser integrations              |
| Contentful CDA credentials and app-owned fetcher                   | Required for first integration | Yes                      | Application Contentful client                                                        |
| Single-locale CDA entries with resolved optimization links         | Required for first integration | Yes                      | CDA calls with `include: 10` and one `locale`                                        |
| Server Component entry resolution                                  | Required for first integration | Yes                      | App Router pages and server components                                               |
| Next.js proxy or middleware hook                                   | Common but policy-dependent    | No                       | `proxy.ts` or `middleware.ts`                                                        |
| Browser SDK context, state handoff, and route tracker              | Required for first integration | Conditional              | App Router layout and pages                                                          |
| Server request consent policy                                      | Common but policy-dependent    | Yes                      | Server calls, browser controls, CMP, or account controls                             |
| Profile persistence and anonymous ID cookie continuity             | Common but policy-dependent    | No                       | Server helper cookies, browser state handoff, ESR persistence, and `ctfl-opt-aid`    |
| Browser identify and reset controls                                | Common but policy-dependent    | No                       | Client Components using Next.js client hooks                                         |
| Experience API and Insights API endpoint overrides                 | Advanced or production-only    | No                       | SDK `api` config for mock, proxy, or regional endpoints                              |
| Entry interaction tracking                                         | Optional                       | No                       | `ServerOptimizedEntry`, `getServerTrackingAttributes()`, and `trackEntryInteraction` |
| Third-party analytics forwarding                                   | Optional                       | No                       | `OptimizationRoot` `onStatesReady` subscription and app-owned analytics code         |
| Production caching and duplicate-event policy                      | Advanced or production-only    | No                       | Next.js route config, server helper structure, and tracker settings                  |
| Client-side entry re-resolution, live updates, or preview takeover | Advanced or production-only    | No                       | Use the hybrid pattern instead of this SSR guide                                     |

The application owns Contentful fetching, locale selection, route policy, consent policy, identity
policy, and component rendering. The Next.js adapter owns SDK composition: the server entry
delegates to the stateless Node SDK, the client entry delegates to the React Web SDK, and the
request handler forwards sanitized request context headers for Server Components.

## Core integration

### Package entry points and server singleton

**Integration category:** Required for first integration

The adapter exposes runtime-specific subpaths. Keep imports on these subpaths so Server Components
do not import browser code and Client Components do not import server-only code.

| Import path                                           | Runtime                                       | Responsibility                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/server`              | Server Components and server-only modules     | SDK creation, request binding, and server entry resolution wrapper                                                |
| `@contentful/optimization-nextjs/esr`                 | Route handlers, edge functions, and ESR flows | Request-rendered Optimization data and explicit response persistence                                              |
| `@contentful/optimization-nextjs/request-handler`     | Next.js proxy or middleware                   | Request context capture and SDK-owned request header sanitization                                                 |
| `@contentful/optimization-nextjs/client`              | Client Components and browser layout children | React provider, state handoff marker, hooks, App Router page tracker, and entry interaction tracking              |
| `@contentful/optimization-nextjs/api-schemas`         | Shared schema helpers                         | API types plus structural guards such as `isMergeTagEntry`, `isRichTextDocument`, and `isResolvedContentfulEntry` |
| `@contentful/optimization-nextjs/tracking-attributes` | Shared server-rendering helpers               | Lower-level SSR `data-ctfl-*` tracking attributes                                                                 |

1. Create the server SDK once at module level with `createNextjsOptimization()`.
2. Pass shared values such as `clientId`, `environment`, `locale`, endpoint overrides, app metadata,
   and `logLevel` into that singleton.
3. Reuse the same singleton from Server Components and explicit custom server or ESR code that emits
   SDK events. The context handler does not need the SDK singleton.
4. Do not create a new server SDK instance per request. Bind request-specific consent, cookies,
   headers, locale, profile, and page context through adapter helpers instead.

### Request context, consent, and anonymous ID continuity

**Integration category:** Common but policy-dependent

The request handler captures request context for Server Components. It strips incoming SDK-owned
headers, forwards sanitized request context headers including the SDK-owned request URL header, and
leaves consent, page calls, and cookie persistence to the server helper or to an explicit
request-rendered ESR flow.

1. Export `createNextjsOptimizationContextHandler()` from `proxy.ts` or `middleware.ts` for routes
   whose Server Components call `getNextjsServerOptimizationData()`.
2. Read application consent from a request-scoped source such as a CMP cookie, account preference,
   or session before calling the server helper.
3. Pass `cookies()`, `headers()`, `consent`, and `locale` to `getNextjsServerOptimizationData()`.
4. Leave `ctfl-opt-aid` browser-readable when browser state handoff must continue the same profile.
   Do not mark it `HttpOnly`.
5. Use `persistNextjsAnonymousId()` only from custom server code that owns the outgoing response.

**Adapt this to your use case:**

```ts
// proxy.ts
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()
```

For deeper consent mechanics, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Server-side Contentful fetching and entry resolution

**Integration category:** Required for first integration

The SDK does not fetch Contentful entries. Your application fetches the baseline entries, including
linked optimization entries and variants, then passes the baseline entry and request-local
`selectedOptimizations` into `resolveOptimizedEntry()`.

1. Fetch Contentful entries with one application Contentful locale.
2. Use enough include depth for `nt_experiences`, their configuration, and `nt_variants`; the
   reference implementation uses `include: 10`.
3. Call `getNextjsServerOptimizationData()` with the same request cookies, headers, consent, and
   locale policy that apply to the rendered response.
4. Pass `optimizationData?.selectedOptimizations` to `optimization.resolveOptimizedEntry()`.
5. Render the returned `entry`. If no optimization data or matching variant is available, the
   resolver returns the baseline entry.

In this example, `cookieStore` and `headerStore` are the values returned by Next.js `cookies()` and
`headers()`. `fetchEntriesFromContentful()` is an app-owned CDA helper that must return
single-locale entries with linked optimization entries and variants included.

**Adapt this to your use case:**

```tsx
const appConsent = cookieStore.get('app-personalization-consent')?.value === 'granted'

const [baselineEntries, optimizationData] = await Promise.all([
  fetchEntriesFromContentful({ include: 10, locale: APP_LOCALE }),
  // Only request Optimization data when app policy permits profile-producing calls.
  appConsent
    ? getNextjsServerOptimizationData(optimization, {
        consent: { events: true, persistence: true },
        cookies: cookieStore,
        headers: headerStore,
        locale: APP_LOCALE,
      }).then(({ data }) => data)
    : undefined,
])

const resolvedEntries = baselineEntries.map((entry) =>
  // The resolver returns the baseline entry when no selected optimization matches.
  optimization.resolveOptimizedEntry(entry, optimizationData?.selectedOptimizations),
)
```

Do not pass all-locale CDA payloads from `contentful.js` `withAllLocales` or raw CDA `locale=*`.
Those payloads contain locale-keyed field maps, while the entry resolver expects direct
single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`. For the resolver
contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Client provider, state handoff, and route tracking

**Integration category:** Required for first integration

SSR content rendering does not need browser JavaScript, but page tracking, entry interactions,
consent controls, identify, and reset run in the browser through the Next.js client entry.

1. Render `OptimizationRoot` in the App Router layout.
2. Pass browser-safe configuration to `OptimizationRoot`. If a Client Component reads environment
   variables directly, use `NEXT_PUBLIC_` variables. A Server Component layout can also read
   server-side config and pass the values as props intentionally.
3. Use `serverOptimizationState={optimizationData}` on `OptimizationRoot` or `OptimizationProvider`
   when that provider or root receives the server data directly. When a shared layout owns the SDK
   context and cannot receive page data, render
   `<NextjsOptimizationState data={optimizationData} />` under that context near the server-rendered
   optimized content.
4. Wrap `NextAppAutoPageTracker` in `Suspense` because it uses App Router navigation hooks.
5. Set `initialPageEvent="skip"` when the server already emitted the page event for the initial
   route. Leave route changes enabled so client-side navigation continues to emit page events.

**Adapt this to your use case:**

```tsx
<OptimizationRoot
  clientId={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? ''}
  environment={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main'}
  // Accepted browser startup enables route events.
  defaults={{ consent: true }}
  locale={APP_LOCALE}
  logLevel="error"
>
  <Suspense>
    {/* Skip only when the server already emitted the first page event. */}
    <NextAppAutoPageTracker initialPageEvent="skip" />
  </Suspense>
  {children}
</OptimizationRoot>
```

For policy-dependent consent, derive the initial tracker behavior from the same source that the
server used:

**Adapt this to your use case:**

```tsx
const appConsent = cookieStore.get('app-personalization-consent')?.value === 'granted'

<OptimizationRoot
  clientId={optimizationConfig.clientId}
  environment={optimizationConfig.environment}
  // Seed browser consent only from the same policy source used by the server.
  defaults={appConsent ? { consent: true } : undefined}
  locale={APP_LOCALE}
>
  <Suspense>
    {/* Emit from the browser when the server skipped Optimization for this request. */}
    <NextAppAutoPageTracker initialPageEvent={appConsent ? 'skip' : 'emit'} />
  </Suspense>
  {children}
</OptimizationRoot>
```

### Consent, identity, and SSR update timing

**Integration category:** Common but policy-dependent

Client actions can update SDK consent and the Optimization profile, but they do not replace content
already rendered by the server. The next server request, route navigation, or browser refresh reads
the updated profile state and resolves entries again.

1. Store the application consent record outside the SDK, such as in a CMP, preference service,
   session, or consent cookie.
2. Call `consent(true)`, `consent(false)`, or object-form consent from a Client Component after the
   user or application policy changes.
3. Call `identify()` only when your identity policy permits profile mutation.
4. Call `reset()` and clear application-owned cookies when withdrawal must end active profile
   continuity.
5. Tell product and QA teams that SSR content changes on the next server request, not during the
   current browser page.

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
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

export function OptimizationControls() {
  const { consent: setConsent, identify, reset } = useOptimizationActions()
  const consent = useConsentState()
  const profile = useProfileState()

  useEffect(() => {
    // Keep the next server request aligned with browser SDK consent.
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
      {isIdentified ? (
        <button onClick={() => reset()} type="button">
          Reset profile
        </button>
      ) : (
        <button
          onClick={() => void identify({ userId: 'user-123', traits: { identified: true } })}
          type="button"
        >
          Identify
        </button>
      )}
    </div>
  )
}
```

## Optional integrations

### Entry interaction tracking

**Integration category:** Optional

The browser client can automatically observe server-rendered entry wrappers when the markup contains
the `data-ctfl-*` tracking attributes. Use `ServerOptimizedEntry` to render those attributes from
the same baseline entry and resolved data used for SSR content.

1. Wrap server-rendered entry content with `ServerOptimizedEntry`.
2. Pass the original baseline entry and the full `ResolvedData` returned by
   `resolveOptimizedEntry()`.
3. Use `getServerTrackingAttributes()` from `@contentful/optimization-nextjs/tracking-attributes`
   when an existing server-rendered element or design-system component must own the wrapper markup.
4. Use `trackEntryInteraction` on `OptimizationRoot` only to opt out of interaction types the app
   must not observe.
5. Use `clickable`, `trackViews`, `trackClicks`, `trackHovers`, and duration interval props only
   when an entry needs per-element tracking behavior.

**Adapt this to your use case:**

```tsx
<ServerOptimizedEntry
  as="article"
  // Use the same baseline entry and resolved data that produced the SSR content.
  baselineEntry={baselineEntry}
  clickable
  hoverDurationUpdateIntervalMs={1000}
  resolvedData={resolvedData}
>
  <h2>{resolvedData.entry.fields.title}</h2>
</ServerOptimizedEntry>
```

Use the lower-level helper when the wrapper element comes from your component library. The component
must forward the `data-ctfl-*` attributes to the DOM element that the browser SDK observes:

**Adapt this to your use case:**

```tsx
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'

const trackingAttributes = getServerTrackingAttributes(baselineEntry, resolvedData, {
  clickable: true,
})

return (
  <ArticleCard {...trackingAttributes}>
    <h2>{resolvedData.entry.fields.title}</h2>
  </ArticleCard>
)
```

Automatic interaction tracking is still gated by browser-side SDK consent. If consent is denied or
unset and the interaction type is not allow-listed, automatic detectors may stay stopped and no
per-element blocked payload may appear. Blocked-event diagnostics are exposed through browser SDK
state only for SDK calls that reach Core.

Browser-side Insights interactions also need an active browser profile signal. When
`initialPageEvent="skip"` prevents the browser from emitting the first-route `page()`, rely on one
of these paths before depending on non-sticky entry views, clicks, hovers, or flag views: server
optimization state handed to the browser, a persisted browser profile loaded under persistence
consent, or a later browser Experience call such as `page()`, `identify()`, `track()`, or sticky
`trackView()`. A readable `ctfl-opt-aid` cookie alone does not populate the current browser profile
signal. Sticky `trackView()` can bootstrap through Experience before sending its paired Insights
event.

### Analytics forwarding

**Integration category:** Optional

Forwarding Optimization context to a tag manager, customer-data platform, or analytics destination
is application-owned. The Optimization SDK still sends its own events to Contentful; forwarding
copies only the fields your governance policy allows.

1. Subscribe once through `OptimizationRoot` `onStatesReady` so the subscription exists before child
   route trackers emit events.
2. Read browser activity from `states.eventStream`.
3. Deduplicate exact event records with `messageId` so current snapshots, subscriber remounts,
   retries, or duplicate browser deliveries do not resend the same SDK event record.
4. Store forwarded message IDs in module or app state so remounts do not forward the same event
   again. If the destination must receive only future SDK events, read the current `messageId`
   before subscribing and skip that event.
5. Add semantic exposure dedupe when the destination wants one exposure for a sticky view or view
   lifecycle. Use fields such as `viewId`, `componentId`, `experienceId`, and `variantIndex`.
6. Use `states.blockedEventStream` and destination debuggers to verify consent behavior.

In this example, `analytics` is your destination client, `canForwardSdkEvent()` enforces your
governance and consent allow-list, `shouldForwardContentfulEvent()` applies destination-specific
semantic dedupe, and `pickContentfulEventProperties()` maps only the approved SDK fields for that
destination.

**Adapt this to your use case:**

```tsx
const forwardedMessageIds = new Set<string>()

<OptimizationRoot
  clientId={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? ''}
  environment={process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main'}
  // Attach subscriptions before child route trackers and interaction observers emit.
  onStatesReady={(states) => {
    const initialMessageId = states.eventStream.current?.messageId

    const subscription = states.eventStream.subscribe((event) => {
      if (!event) return
      // Message IDs prevent duplicate forwarding to app-owned destinations.
      if (forwardedMessageIds.has(event.messageId)) return
      if (event.messageId === initialMessageId) {
        forwardedMessageIds.add(event.messageId)
        return
      }
      if (!canForwardSdkEvent(event)) return

      forwardedMessageIds.add(event.messageId)
      if (!shouldForwardContentfulEvent(event)) return

      analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
    })

    return () => subscription.unsubscribe()
  }}
>
  {children}
</OptimizationRoot>
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for server mapping, browser subscription helpers, vendor examples, consent, identity, dedupe, and
governance guidance.

## Advanced integrations

### Locale and request options

**Integration category:** Advanced or production-only

Most apps use the same `appLocale` for Contentful CDA requests, the Next.js server helper, and the
browser provider. The SDK does not choose Contentful locales or modify CDA requests for you.

1. Choose the application Contentful locale from routing, i18n, account, or request policy.
2. Pass that locale to Contentful CDA requests.
3. Pass the same locale to `getNextjsServerOptimizationData({ locale })` when Experience API
   responses and event context must match the rendered content language.
4. Pass the same locale to `OptimizationRoot` so browser route events use the same locale.
5. Use `experienceOptions` and `insightsOptions` only for lower-level request overrides such as
   preflight, custom beacon handling, IP overrides, or endpoint-specific options.

For the broader locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Caching and request deduplication

**Integration category:** Advanced or production-only

Personalized SSR creates request-local data. Cache raw Contentful delivery payloads in the
application layer, but do not cache profile-evaluated SDK results across visitors.

1. Treat `getNextjsServerOptimizationData()` and request-bound `page()` results as non-cacheable
   across requests because they perform side effects and return profile-specific data.
2. Cache raw Contentful entries only by safe content keys such as entry ID, environment, include
   depth, and application Contentful locale.
3. Disable or vary Next.js full-route caching for personalized routes.
4. Deduplicate repeated server helper calls inside one render pass with an app-owned cached helper
   when multiple Server Components need the same request-local optimization data.
5. Use `initialPageEvent="skip"` for the first browser route when a server page call already emitted
   the initial page event.

**Follow this pattern:**

```ts
// app/personalized-page/page.tsx
// Personalized routes must not reuse profile-evaluated HTML across visitors.
export const dynamic = 'force-dynamic'
```

### Edge/request-rendered personalization

**Integration category:** Advanced or production-only

Use ESR when a route handler, edge function, or other request-rendered surface owns the incoming
`Request` and outgoing `Response`. Do not use ESR for the default App Router Server Component path
when `cookies()`, `headers()`, `getNextjsServerOptimizationData()`, and `NextjsOptimizationState`
fit the route.

1. Import `getNextjsEsrOptimizationData()` from `@contentful/optimization-nextjs/esr`.
2. Pass the incoming `Request` or `NextRequest`, request consent, locale, and optional page payload.
3. Render the response from the returned `data`.
4. Call `persist(response)` after creating the response when persistence consent permits profile
   continuity.
5. Treat the response as request-specific. Do not share-cache HTML that depends on returned
   Optimization data unless the cache varies on every personalization input.

**Adapt this to your use case:**

```ts
import { getNextjsEsrOptimizationData } from '@contentful/optimization-nextjs/esr'

export async function GET(request: Request) {
  const esr = await getNextjsEsrOptimizationData(optimization, {
    consent: { events: true, persistence: true },
    locale: APP_LOCALE,
    request,
  })

  const response = new Response(renderHtml(esr.data), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })

  esr.persist(response)

  return response
}
```

### Unsupported SSR concerns and hybrid handoff

**Integration category:** Advanced or production-only

The SSR pattern intentionally keeps entry resolution on the server. These concerns are not part of
this guide's runtime pattern:

- Browser-side `OptimizedEntry` re-resolution after identify, consent, or reset.
- `liveUpdates` for continuously changing optimized entries.
- Preview-panel takeover that forces client-side variant changes.
- SPA-only pages where the browser owns every entry decision after initial load.

Use the hybrid guide when any of those concerns are product requirements. Keep SSR routes for pages
where first-paint stability, SEO-friendly HTML, and a server-authoritative content decision matter
more than immediate browser-side content changes.

## Production checks

Before releasing a Next.js SSR integration, verify these checks:

- **Credentials and runtime configuration** - Server SDK config, browser provider config, endpoint
  overrides, environment IDs, and app metadata point to the intended environment.
- **Consent behavior** - Default-on startup is backed by application policy, or Server Components,
  browser controls, and cookies all read the same consent source.
- **Event delivery** - Initial server page events, browser route page events, entry interactions,
  identify, reset, and blocked-event diagnostics behave as expected for accepted and denied consent.
  Automatic detectors can remain stopped for denied or unset consent and might not produce a
  per-element blocked payload. Use `blockedEventStream` and `onEventBlocked` for direct SDK calls
  that reach Core and are blocked by consent or `allowedEventTypes`.
- **Content fallback behavior** - Missing optimization data, unmatched selected optimizations,
  unresolved Contentful links, all-locale CDA payloads, and API failures render baseline content.
- **Duplicate tracking prevention** - The initial browser route uses `initialPageEvent="skip"` when
  the server already emitted the page event, the app does not mount multiple page trackers for the
  same route tree, exact analytics records are deduplicated by `messageId`, and sticky-view
  exposures use semantic dedupe when the destination wants one exposure.
- **Privacy and governance** - The `ctfl-opt-aid` cookie is written only when persistence consent
  permits it, is cleared on withdrawal when required, and is forwarded to third parties only through
  approved app-owned mapping.
- **Local validation** - Compare against the SSR reference implementation, run its typecheck and
  lint commands when changing the app pattern, and use its Playwright flows for SSR first paint,
  consent gating, route events, and entry interaction tracking.

## Troubleshooting

| Symptom                                                      | Likely cause                                                                                      | Check                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The page always renders baseline content                     | No optimization data, missing consent, all-locale CDA payloads, or unresolved optimization links  | Confirm the server helper returned `selectedOptimizations`, fetch with one `locale`, and use `include: 10` |
| The browser emits a duplicate first page event               | The initial page tracker emitted after a server page call                                         | Set `initialPageEvent="skip"` when the server already emitted the initial page event                       |
| Entry view, click, or hover events do not appear             | Missing `data-ctfl-*` attributes, opted-out `trackEntryInteraction`, or denied browser consent    | Render `ServerOptimizedEntry`, inspect opt-out settings, and inspect blocked-event state                   |
| A Server Component fails with browser globals or hook errors | A server file imported the Next.js client entry or React SDK hooks                                | Move hook usage to a Client Component with `'use client'` and keep server files on the server entry        |
| Identify works but content does not change immediately       | Expected SSR behavior                                                                             | Navigate or refresh so the next server request resolves entries with the updated profile                   |
| Anonymous profile continuity is lost                         | The anonymous ID cookie is absent, `HttpOnly`, denied by persistence consent, or cleared on reset | Inspect `ctfl-opt-aid`, server or ESR persistence, browser consent state, and withdrawal logic             |

## Reference implementations to compare against

- [`implementations/nextjs-sdk_ssr`](../../implementations/nextjs-sdk_ssr/README.md) - Working
  Next.js App Router SSR application using `@contentful/optimization-nextjs/server`,
  `@contentful/optimization-nextjs/request-handler`, and `@contentful/optimization-nextjs/client`.
  Use it to compare proxy request context forwarding, server entry resolution,
  `ServerOptimizedEntry`, App Router layout tracking, and browser controls.
