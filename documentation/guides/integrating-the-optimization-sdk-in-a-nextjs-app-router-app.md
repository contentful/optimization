# Integrating the Optimization Next.js SDK in a Next.js App Router app

Use this guide to render a personalized Contentful entry on the server and keep the same result when
the browser starts. The server gives the browser a serializable snapshot of the Optimization state
used for that render; this snapshot is an **Optimization handoff**.

**New to personalization?** Here is the whole idea in four points:

- In Contentful you author **variants** of an entry and attach them to an **experience** - a rule
  that decides which visitors see which variant.
- On each request, Contentful's **Experience API** looks at the request context and picks the
  variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies - the **baseline
  fallback**. You can fetch the entry yourself or give the SDK your Contentful client and an entry
  ID; either way, the client stays yours.
- You render the returned entry with the same application components you already use.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 - Personalized first paint from one server render.** The quick start below is
  shippable when your policy allows server personalization.
- **Milestone 2 - Browser takeover and live updates.** See
  [Browser takeover and live updates](#browser-takeover-and-live-updates).

This guide uses `@contentful/optimization-nextjs/app-router/server` for Server Components and
`@contentful/optimization-nextjs/app-router/client` when an app needs bound Client Components. The
adapter binds app-local configured components and handoff helpers; your app still owns Contentful
fetching, consent policy, cache keys, and where personalized output is cached. If you use the Pages
Router, use the
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
instead.

## Quick start

This quick start assumes an App Router route already fetches a Contentful entry and renders it with
your own component. The proof is one entry whose variant appears in View Source and stays stable
after hydration. Consent is granted on the server and browser only to prove the wiring; replace it
in [Consent, identity, profile, and reset](#consent-identity-profile-and-reset).
Before starting, attach a variant to that entry through an experience that targets all visitors.
Without an authored variant, a working integration still renders the baseline and cannot prove the
personalization path.

1. Install the package and keep `contentful` app-owned.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs contentful
   ```

2. Bind one app-local server Optimization module. This binding shares one configured helper set for
   the app. Its nested `optimization.request` family initializes the active request before any
   request-bound component renders.
   `NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID` and `NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT` are reader-owned
   browser-visible config. Use the same Contentful environment for server and client binding code.
   The consent values below are a quick-start policy shortcut.

   **Adapt this to your use case:**

   ```tsx
   // lib/optimization.ts
   import { bindNextjsAppRouterServerOptimization } from '@contentful/optimization-nextjs/app-router/server'
   import { contentfulClient } from './contentful'

   export const optimization = bindNextjsAppRouterServerOptimization({
     clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
     environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
     locale: 'en-US',
     contentful: { client: contentfulClient },
     consent: {
       server: { events: true, persistence: true },
       clientDefaults: { consent: true, persistenceConsent: true },
     },
     request: { hydration: 'preserve-server' },
   })

   export const {
     NextAppAutoPageTracker: RequestNextAppAutoPageTracker,
     OptimizationRoot: RequestOptimizationRoot,
     OptimizedEntry: RequestOptimizedEntry,
   } = optimization.request
   ```

3. Forward the original request URL so the request family can initialize. Use the
   handler name for your Next.js version: Next.js 16 uses `proxy.ts` with `proxy`, and Next.js 13 to
   15 uses `middleware.ts` with `middleware`. The body is the same. If the filename or export name
   does not match the Next.js version, Next.js does not run the handler and request context is not
   forwarded. The SDK handler owns the forwarded request-header names and values.

   **Adapt this to your use case:**

   ```ts
   // Next.js 16: proxy.ts and export const proxy.
   // Next.js 13 to 15: middleware.ts and export const middleware.
   import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

   const optimizationRequestHandler = createNextjsOptimizationContextHandler()

   export const proxy = optimizationRequestHandler
   // In Next.js 13 to 15, export this as middleware instead.

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
   }
   ```

4. Wrap the request route in the nested request root. The request family reads the forwarded request
   context and shares one SDK-owned initialization across the root, entry, and tracker. Keep the
   tracker inside `Suspense` because it reads Next.js search parameters. The surrounding layout is
   illustrative context to match against, not a full file to paste over your layout.

   **Adapt this to your use case:**

   ```diff
   // app/(request)/layout.tsx
   +import { Suspense } from 'react'
   +import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'

    export default function RequestLayout({ children }: { children: React.ReactNode }) {
     return (
   -    <>{children}</>
   +    <Suspense fallback={null}>
   +      <RequestOptimizationRoot>
   +        <RequestNextAppAutoPageTracker />
   +        {children}
   +      </RequestOptimizationRoot>
   +    </Suspense>
     )
   }
   ```

5. Wrap the entry where it becomes output. A **render prop** is the function child
   `{(entry) => ...}`; it lets you render the resolved entry with your existing component.
   This shortcut assumes the baseline and every eligible variant use the `hero` content type. If a
   variant can use another content type, follow the skeleton-union and narrowing path in
   [Personalizing first paint on the server](#personalizing-first-paint-on-the-server).

   **Adapt this to your use case:**

   ```diff
   // app/(request)/page.tsx
   +import { RequestOptimizedEntry } from '@/lib/optimization'
    import { Hero } from '@/components/Hero'

    export default async function Page() {
      const hero = await getHeroEntry({ locale: 'en-US', include: 10 })

      return (
   -    <Hero entry={hero} />
   +    <RequestOptimizedEntry baselineEntry={hero}>
   +      {(resolvedHero) => <Hero entry={resolvedHero} />}
   +    </RequestOptimizedEntry>
      )
    }
   ```

6. Verify the result. In Contentful, target the experience to all visitors and give the variant a
   distinctive text value. Run the app, open View Source, and find that variant text in the raw HTML.
   Then load the page normally and confirm the same text remains after hydration.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [How the SDK fits your app](#how-the-sdk-fits-your-app)
  - [Fetching Contentful entries](#fetching-contentful-entries)
  - [Request context and the profile cookie](#request-context-and-the-profile-cookie)
  - [Personalizing first paint on the server](#personalizing-first-paint-on-the-server)
  - [The bound root and page events](#the-bound-root-and-page-events)
  - [Browser takeover and live updates](#browser-takeover-and-live-updates)
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

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- A Next.js App Router app with React Server Components, React, and React DOM already working.
- A Contentful delivery client that can fetch the baseline entries your pages render.
- Contentful space, environment, delivery token, and one concrete locale. Fetch entries with that
  locale and enough `include` depth for linked Optimization entries and variants.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. Find them in the Contentful web app under **Apps → Installed apps → Contentful
  Personalization → SDK keys**. This guide stores them in
  `NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID` and `NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT`. The client ID and
  environment are safe to expose to the browser, and both bindings must use the same values.

  The Experience and Insights API base URLs default correctly; you only set them for mocks or
  non-default hosts (see [How the SDK fits your app](#how-the-sdk-fits-your-app)).

You do not need a setup inventory up front. Everything else — the request handler, the root, entry
wrapping, consent, tracking — is introduced by the section that needs it.

> [!NOTE]
>
> Match your app's browser environment-variable convention. Next.js exposes `NEXT_PUBLIC_*` values
> to the browser; unprefixed server values stay server-only.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

The App Router server and client bindings centralize SDK configuration for route code. Define each
binding once in its own runtime-specific module. The server binding is not a request-isolation
context; its nested request family creates the request-scoped work.

| Import path                                           | Use                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router/server`   | Server binding, nested private-request components, and top-level explicit-input handoff components |
| `@contentful/optimization-nextjs/app-router/client`   | Bound App Router Client Components                                                                 |
| `@contentful/optimization-nextjs/cache-middleware`    | Public-permutation proxy and middleware rewrites                                                   |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks and per-entry browser controls                                                  |
| `@contentful/optimization-nextjs/edge`                | Edge runtime request and public permutation handoff helpers                                        |
| `@contentful/optimization-nextjs/request-handler`     | Proxy or middleware request-context forwarding and trusted forwarded server context                |
| `@contentful/optimization-nextjs/tracking-attributes` | Low-level `data-ctfl-*` attributes for analytics-only markup                                       |

The package root is not an import path. Server Components use the server binding. Create a separate
client binding only when a bound Client Component needs one; router-neutral hooks and per-entry
browser controls continue to use `/client`.

**Adapt this to your use case:** keep browser-only binding code in a Client Component module, and
match the server binding's public configuration values.

```tsx
// lib/optimization-client.ts
'use client'

import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'

export const clientOptimization = bindNextjsAppRouterClientOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
  environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
  locale: 'en-US',
})
```

The binding config separates policy from mechanism:

- `consent.server` is the app-owned server policy for the current request; configure it explicitly
  because App Router request initialization resolves omitted request consent to `false`.
- `consent.clientDefaults` seeds the browser SDK before a persisted or explicit browser decision is
  available.
- `contentful.client` is your delivery client. The SDK may call it for managed entry IDs or
  content-type/slug lookups, but it does not own your Contentful Delivery API (CDA) credentials or
  query policy.

### Fetching Contentful entries

**Integration category:** Required for first integration

There are two entry-source paths. Use the one that matches where your app already owns fetching.

- **Manual entry source:** your Server Component fetches a baseline entry and passes it as
  `baselineEntry` to `OptimizedEntry`.
- **Managed entry source:** the SDK receives `entryId` plus optional `entryQuery`, or a
  content-type/slug descriptor under `managedEntry`, and uses the configured `contentful.client`.
  Inside that descriptor, `slugField` defaults to `slug` and optional `entryQuery` carries the
  Contentful Delivery API (CDA) query.

The bound server `OptimizedEntry` used by Server Components, including the first-paint example later
in this guide, requires exactly one source. Missing or combined sources throw this exact message:

- `Bound Next.js OptimizedEntry requires exactly one source: baselineEntry, entryId, or managedEntry.`

TypeScript separately rejects an incomplete managed descriptor. Supply both `contentType` and `slug`;
do not rely on the runtime exact-source guard to validate fields inside `managedEntry`.

For a dynamic route, define the managed source once from the route parameter. `contentType`, `slug`,
`slugField`, and `entryQuery` are fixed SDK property names. Their values — including the content type
ID, slug field ID, route slug, locale, and include depth — come from your app and content model.

**Adapt this to your use case:**

```ts
// lib/page-entry-source.ts
export function getPageEntrySource(slug: string) {
  return {
    contentType: 'page',
    slug,
    slugField: 'slug',
    entryQuery: { locale: 'en-US', include: 10 },
  } as const
}
```

**Client Component source.** The next example runs in the browser. It passes the direct descriptor
from `getPageEntrySource()` under the React component's `managedEntry` prop; it is not a bound server
managed render.

**Adapt this to your use case:**

```tsx
// components/ManagedPage.tsx
'use client'

import { Hero } from '@/components/Hero'
import { clientOptimization } from '@/lib/optimization-client'
import { getPageEntrySource } from '@/lib/page-entry-source'

export function ManagedPage({ slug }: { slug: string }) {
  const entrySource = getPageEntrySource(slug)

  return (
    <clientOptimization.OptimizedEntry managedEntry={entrySource}>
      {(entry) => <Hero entry={entry} />}
    </clientOptimization.OptimizedEntry>
  )
}
```

**Adapt this to your use case:**

```tsx
// app/pages/[slug]/page.tsx
import { ManagedPage } from '@/components/ManagedPage'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return <ManagedPage slug={slug} />
}
```

For slug lookup, the SDK merges the normal managed query, then enforces `content_type`,
`fields.<slugField>`, and `limit: 2`. These are the exact failure templates:

- No match: `Contentful entry not found for content type "<contentType>" where "fields.<slugField>" equals "<slug>".`
- More than one match: `Multiple Contentful entries found for content type "<contentType>" where "fields.<slugField>" equals "<slug>".`

The angle-bracketed placeholders are replaced with the source's actual content type, effective slug
field, and slug. Both managed component paths track and resolve with the fetched entry's real
`sys.id`, not the slug.

A bound server managed render does not add its baseline to the browser handoff by itself. The
`ManagedPage` Client Component above therefore needs the route root to prefetch its source. Build
the same descriptor from the dynamic route parameter and pass it to the request root's
`prefetchManagedEntries`. Use this route layout instead of placing a second Optimization root around
the same subtree.

**Server root prefetch → handoff → Client Component reuse.** The root performs the server fetch,
adds the entry record to the handoff, and gives the browser-owned `ManagedPage` the matching baseline.

**Adapt this to your use case:**

```diff
 // app/pages/[slug]/layout.tsx
+import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'
+import { getPageEntrySource } from '@/lib/page-entry-source'
+import { Suspense } from 'react'

-export default function PageLayout({ children }: { children: React.ReactNode }) {
-  return <>{children}</>
+export default async function PageLayout({
+  children,
+  params,
+}: {
+  children: React.ReactNode
+  params: Promise<{ slug: string }>
+}) {
+  const { slug } = await params
+  const pageEntrySource = getPageEntrySource(slug)
+
+  return (
+    <Suspense fallback={null}>
+      <RequestOptimizationRoot prefetchManagedEntries={[pageEntrySource]}>
+        <RequestNextAppAutoPageTracker />
+        {children}
+      </RequestOptimizationRoot>
+    </Suspense>
+  )
 }
```

The root fetches that source on the server and merges a record into `handoff.entries`. The record
nests the normalized descriptor under `managedEntry` and retains the fetched entry's real `sys.id`
as `entryId`. During browser hydration and client rendering, `ManagedPage` reuses it because its
`contentType`, `slug`, effective `slugField`, and effective `entryQuery` values match. Changing the
locale, include depth, custom slug field, or another query value creates a different source and
therefore does not reuse this handoff entry. This flow is distinct from passing `managedEntry`
directly to the bound server component, which fetches and renders on the server but does not add its
baseline to the handoff automatically.

Keep CDA fetches single-locale. The SDK expects directly readable fields such as
`fields.nt_experiences` and `fields.nt_variants`; all-locale payloads can make variant links look
unresolved and fall back to baseline.

### Request context and the profile cookie

**Integration category:** Common but policy-dependent

Every `optimization.request` component awaits one SDK-owned initializer for the active React Server
Component request. The initializer reads Next.js headers and cookies, requires the request URL
forwarded by the Optimization handler, and derives the URL, route key, initial page payload,
hydration mode, and private-request handoff once. The app does not read those inputs or coordinate
layout and page awaits. Separate requests receive separate initialization and handoff state.

The proxy or middleware remains required because it forwards the SDK-owned request URL header. The
no-argument `createNextjsOptimizationContextHandler()` used in the quick start provides that context.
If the route also needs response-side profile-cookie persistence before Server Components render,
configure the handler with the server SDK and consent resolver, then set
`request.trustedRequestHandoff: true` in the App Router server binding. That response-capable path
can perform the page request, persist `ctfl-opt-aid` when policy allows it, and forward compact
server context. The request family accepts that context only through the explicit trusted option.

The SDK-owned anonymous profile cookie is `ctfl-opt-aid`. Your app owns any consent cookie or account
record that `consent.server` reads. Store the consent decision where both server and browser code can
read it; do not use the SDK profile cookie as your consent record.

### Personalizing first paint on the server

**Integration category:** Required for first integration

Server Components render personalized first paint through `optimization.request.OptimizedEntry`. If
no experience applies, the API has no variant, or a linked variant cannot be resolved, the render
receives the baseline entry. When policy denies the selection-producing Experience event, no
selected optimizations enter the request state; resolution without a selection also returns the
baseline.

`isEmptyVariant === true` marks the SDK renderer's no-content state. It differs from the fallback
cases above, which render the baseline entry. In the no-content state, the bound server
`OptimizedEntry` keeps its host and tracking attributes but does not invoke its render prop or emit
app content. The standalone `ServerOptimizedEntry`, imported from
`@contentful/optimization-nextjs/server`, is the lower-level renderer for server code that already
has a full resolver result and static children; it applies the same empty-content rule. An absent
empty-variant flag renders normally.

A resolved selected variant can use any Contentful content type. The request entry waits for the
same initialization as the request root, including when page work begins before its layout work.

A Contentful **entry skeleton** is a TypeScript type that names a content type ID and its fields.
Use one skeleton union, `S`, containing every possible baseline or variant content type. A bound
server `OptimizedEntry` with `baselineEntry` uses `<S, M, L>`, where `M` is the `contentful.js`
response mode and `L` is the locale type. A managed ID or slug source uses `<S, L>` because `M` is
fixed to `undefined`. When every variant shares the baseline content type, omit the generic and let
TypeScript infer that skeleton from `baselineEntry`.

**Follow this pattern:** declare the complete skeleton union in the Server Component and narrow in
the render prop, where the resolved entry becomes page markup. The guard compares the Contentful
content type ID; it does not validate fields.

```tsx
import { RequestOptimizedEntry } from '@/lib/optimization'
import { isEntryOfContentType } from '@contentful/optimization-nextjs/api-schemas'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type CtaSkeleton = EntrySkeletonType<{ label: EntryFieldTypes.Symbol }, 'cta'>
type AppEntrySkeleton = PageSkeleton | HeroSkeleton | CtaSkeleton
type AppLocale = 'en-US'

export function PersonalizedPage({ page }: { page: Entry<PageSkeleton, undefined, AppLocale> }) {
  return (
    <RequestOptimizedEntry<AppEntrySkeleton, undefined, AppLocale> baselineEntry={page}>
      {(entry) => {
        if (isEntryOfContentType<HeroSkeleton, undefined, AppLocale>(entry, 'hero')) {
          return <h1>{entry.fields.headline}</h1>
        }
        if (isEntryOfContentType<CtaSkeleton, undefined, AppLocale>(entry, 'cta')) {
          return <button type="button">{entry.fields.label}</button>
        }
        return <h1>{entry.fields.title}</h1>
      }}
    </RequestOptimizedEntry>
  )
}
```

The union is a compile-time model, not a runtime filter. Narrow at the renderer boundary before
reading content-type-specific fields. For lower-level resolver, managed-fetch, open-ended model,
and event-stream examples, see
[TypeScript content-model choices](../concepts/entry-personalization-and-variant-resolution.md#typescript-content-model-choices).

The request family reads the active Next.js request, so it makes that subtree dynamic and produces
request-specific output. Keep request-derived profile handoffs in `private-request` scope and out of
public shared caches. Use top-level explicit-input components and a public permutation handoff for
routes that must remain shareable.

### The bound root and page events

**Integration category:** Required for first integration

Use `optimization.request.OptimizationRoot` at a private request route root. It supplies the browser
provider with the initializer's handoff, hydration mode, route key, and initial page payload. The
request `NextAppAutoPageTracker` receives first-page-event ownership from the same handoff and then
tracks later client navigations. Keep it inside the Next.js-required `Suspense` boundary; that
boundary is a platform rendering requirement, not request-initialization plumbing.

The top-level `optimization.OptimizationRoot` accepts an explicit handoff, hydration,
`prefetchManagedEntries`, route key, and page payload. The top-level
`optimization.OptimizationProvider` accepts only handoff, hydration, and managed-entry prefetch
inputs. Use those content-capable components for static, public-permutation, and advanced manual
flows; use `optimization.OptimizationAnalyticsRoot` for analytics-only handoffs.
`initialPageEvent` belongs in the handoff or on a directly rendered route tracker, not on either
content-capable root.

If you pass `prefetchManagedEntries` without an explicit `handoff`, the App Router root creates
baseline `static` handoff behavior with `hydration: 'preserve-server'`, no selected optimizations,
and `initialPageEvent: 'emit'`. Use that path for baseline managed-entry warming, not
request-personalized state.

Mount one development-only observer inside the request root before validating events elsewhere in
this guide. The accepted stream holds the latest accepted event as its current value, not an event
history. The blocked stream reports events rejected by consent or event policy.

**Adapt this to your use case:**

```tsx
// components/OptimizationEventDiagnostics.tsx
'use client'

import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

export function OptimizationEventDiagnostics() {
  const { isLive, sdk } = useOptimizationContext()

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || isLive !== true || sdk === undefined) return

    const accepted = sdk.states.eventStream.subscribe((event) => {
      if (event) console.debug('Contentful Optimization event accepted', event)
    })
    const blocked = sdk.states.blockedEventStream.subscribe((event) => {
      if (event) console.debug('Contentful Optimization event blocked', event)
    })

    return () => {
      accepted.unsubscribe()
      blocked.unsubscribe()
    }
  }, [isLive, sdk])

  return null
}
```

**Adapt this to your use case:**

```diff
 // app/(request)/layout.tsx
+import { OptimizationEventDiagnostics } from '@/components/OptimizationEventDiagnostics'

 <RequestOptimizationRoot>
+  <OptimizationEventDiagnostics />
   <RequestNextAppAutoPageTracker />
   {children}
 </RequestOptimizationRoot>
```

The observer mounts in the browser after the root publishes its live SDK. Trigger a tracked page,
view, click, or hover action and inspect the browser console for the accepted or blocked record.

### Browser takeover and live updates

**Integration category:** Required for first integration

The handoff controls the first browser render over already-rendered content. `liveUpdates` controls
whether entries may re-resolve after startup when consent, identity, profile, or preview state
changes.

Use the default locked behavior for stable first paint. Turn on `liveUpdates` in the binding config
only when the participating tree must react after hydration. For per-entry browser control, use the
router-neutral `/client` `OptimizedEntry`; the bound App Router entry does not accept per-entry
`liveUpdates` or `loadingFallback`. The preview panel can force live re-resolution for authoring even
when the normal route keeps live updates off.

For a top-level explicit-input route, pass `hydration="client-only-hidden-until-ready"` to
`optimization.OptimizationRoot` or `optimization.OptimizationProvider`, or build that mode into the
handoff. For a nested private-request route, set this mode in the server binding's `request`
configuration. A fully browser-owned route instead uses the router-neutral `/client`
`OptimizationRoot` or `OptimizationProvider`.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` emits view, click, and hover tracking from the resolved entry by default. Configure
global defaults with `trackEntryInteraction` in the binding config and use per-entry props for local
opt-outs. Interaction delivery still depends on event consent and profile continuity.

Analytics-only server/static/edge markup imports `getServerTrackingAttributes()` from
`@contentful/optimization-nextjs/tracking-attributes` so the browser analytics runtime observes the
same `data-ctfl-*` contract without resolving content.

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Replace the quick-start consent shortcut with your app policy:

1. Read the app-owned consent record in `consent.server`; omitted request consent resolves to
   `false`.
2. Seed conservative browser defaults through `consent.clientDefaults`.
3. Mirror browser choices to the app-owned consent record before the next request.
4. Use `setConsent`, `identifyUser`, and `resetUser` from `/client` hooks for browser actions.

**Adapt this to your use case:**

```tsx
bindNextjsAppRouterServerOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
  environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
  consent: {
    server: ({ cookies }) =>
      cookies.get('app-consent')?.value === 'accepted'
        ? { events: true, persistence: true }
        : false,
    clientDefaults: { consent: false, persistenceConsent: false },
  },
})
```

`app-consent` is reader-owned in this example. The SDK reads only the decision you pass to it.

## Optional integrations

### Analytics forwarding

**Integration category:** Optional

Forward accepted events from `states.eventStream` after `onStatesReady` runs. Deduplicate by
`messageId`, keep vendor consent separate from Contentful event consent, and use
`states.blockedEventStream` for diagnostics instead of replay.

The runtime event stream remains model-agnostic because it can carry interactions for entries of
every content type. If you read `event.optimization?.resolvedEntry`, narrow that entry with
`isEntryOfContentType` at the point of use; resolver-specific `S` types do not flow into a
later event.

For the full pattern, use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Merge tags and Custom Flags

**Integration category:** Optional

The request-family `OptimizedEntry`, aliased as `RequestOptimizedEntry` in the quick start, also
passes `getMergeTagValue` to its render prop. Pass it to your Rich Text renderer when entries contain
SDK-owned merge-tag entries. Use `/client` hooks for browser-only Custom Flags when a route needs
reactive flag reads after hydration.

**Follow this pattern:**

```tsx
<RequestOptimizedEntry baselineEntry={article}>
  {(entry, { getMergeTagValue }) => (
    <RichText document={entry.fields.body} getMergeTagValue={getMergeTagValue} />
  )}
</RequestOptimizedEntry>
```

### Preview panel

**Integration category:** Optional

Attach `@contentful/optimization-web-preview-panel` only in development, preview, or staging
environments. The panel needs the live browser SDK and a Contentful client or pre-fetched audience
and experience entries. Keep the environment gate app-owned; do not ship editor tooling to ordinary
production visitors.

**Copy this:**

```sh
pnpm add @contentful/optimization-web-preview-panel
```

The example below uses `NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` as an app-owned environment
gate and `contentfulClient` as an app-owned browser-safe Contentful client. Wait for `isLive` before
attaching; its earlier SDK value is the read-only handoff snapshot. The owned browser root registers
the live SDK that the panel uses by default.

**Adapt this to your use case:**

```tsx
// components/OptimizationPreviewPanel.tsx
'use client'

import { contentfulClient } from '@/lib/contentful-client'
import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

export function OptimizationPreviewPanel() {
  const { error, isLive, sdk } = useOptimizationContext()
  const enabled = process.env.NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

  useEffect(() => {
    if (!enabled || isLive !== true || sdk === undefined) return

    void import('@contentful/optimization-web-preview-panel')
      .then(({ default: attachOptimizationPreviewPanel }) =>
        attachOptimizationPreviewPanel({ contentful: contentfulClient }),
      )
      .catch((previewError: unknown) => {
        console.warn('Contentful Optimization preview panel failed to attach', previewError)
      })
  }, [enabled, isLive, sdk])

  if (!enabled) return null
  if (error) return <p role="alert">Optimization preview failed to initialize.</p>

  return (
    <output>{isLive ? 'Optimization preview ready' : 'Optimization preview initializing'}</output>
  )
}
```

Mount the panel inside the same request root as the content it previews.

**Adapt this to your use case:**

```diff
 // app/(request)/layout.tsx
+import { OptimizationPreviewPanel } from '@/components/OptimizationPreviewPanel'

 <RequestOptimizationRoot>
+  <OptimizationPreviewPanel />
   <RequestNextAppAutoPageTracker />
   {children}
 </RequestOptimizationRoot>
```

In a non-production environment, enable the gate, load the route, and wait for **Optimization
preview ready**. Open the panel, force the authored variant, and confirm that the rendered entry
changes. If attachment fails, the browser console shows the error. When the app already fetched the
panel's audience and experience entries, pass `entries` instead of `contentful`.

## Advanced integrations

### Route-level SSR, browser takeover, and browser-owned islands

**Integration category:** Advanced or production-only

Choose one ownership model per route:

| Route strategy                 | First paint owner                                                             | Browser content behavior                                    | Cache scope                             |
| ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Nested request components      | Server request                                                                | Preserves server output; optional live updates              | `private-request`                       |
| Public permutation handoff     | Static generation, Cache Components, or Edge runtime route chosen by app code | Preserves selected output; optional live updates            | `public-permutation` with SDK-built key |
| Analytics-only handoff         | Server, static, or Edge runtime markup                                        | Tracks page and interactions only; no content re-resolution | Matches the rendered markup owner       |
| Client-only hidden-until-ready | Browser SDK                                                                   | Hides baseline until ready or timeout                       | Static page shell                       |

For a static shell with a request-personalized section, keep the shell free of request-family
components. In a Next.js app that uses Cache Components, put the
revalidation policy in the cached component with `use cache`, `cacheLife()`, and `cacheTag()`.
Then place the private section under `Suspense` and call `connection()` inside that private slot
before reading request data. The slot must use `private-request` cache scope because it renders for
one visitor.

**Adapt this to your use case:**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

**Follow this pattern:**

```tsx
// app/static-shell-private-slot/page.tsx
import { cacheLife, cacheTag } from 'next/cache'
import { Suspense } from 'react'
import { PrivateRequestSlot } from './PrivateRequestSlot'

async function CachedMarketingShell() {
  'use cache'
  cacheLife('minutes')
  cacheTag('static-marketing-shell')

  return <StaticMarketingShell />
}

export default function Page() {
  return (
    <main>
      <CachedMarketingShell />
      <Suspense fallback={<section aria-busy="true" />}>
        <PrivateRequestSlot />
      </Suspense>
    </main>
  )
}
```

**Follow this pattern:**

```tsx
// app/static-shell-private-slot/PrivateRequestSlot.tsx
import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'
import { connection } from 'next/server'

export async function PrivateRequestSlot() {
  await connection()

  return (
    <RequestOptimizationRoot>
      <RequestNextAppAutoPageTracker />
      <PersonalizedPrivateContent />
    </RequestOptimizationRoot>
  )
}
```

`StaticMarketingShell` and `PersonalizedPrivateContent` are app-owned components in this pattern.
Cache Components do not use route-level `export const revalidate`; put ISR-style revalidation on
the cached component or data function instead.

If your app is not using Cache Components or partial pre-rendering, keep the route as a static shell
and mount a client-owned slot that fetches a private `no-store` route handler or API route. That
private endpoint creates the `private-request` handoff and returns only the data the slot needs.
This fallback keeps the shell public-cacheable but moves the personalized content to the browser
after the private fetch completes.

For complete SSG, App Router Cache Components, Pages Router ISR, Edge runtime, and analytics-only
recipes, use
[Rendering personalized Next.js routes with static, ISR, and edge handoffs](./rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md).
For the mechanics behind handoff state and cache scopes, use
[Optimization handoff and cache-safe rendering](../concepts/optimization-handoff-and-cache-safe-rendering.md).

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use lower-level subpaths only when the bound App Router module cannot express the route. The main
escape hatches are:

- `/server` for direct Node request control with `configureNextjsServerOptimization(...)`. That
  helper configures a stateless server runtime; it is not a request-isolation context.
- The top-level `optimization.createRequestHandoff(...)` from the `/app-router/server` binding when
  advanced orchestration already owns explicit request, hydration, page payload, and handoff inputs.
- `/app-router/client` for a bound App Router Client Component family.
- `/client` for router-neutral React roots, providers, and hooks.
- `/tracking-attributes` for manually rendered analytics-only markup.
- `/edge` for Edge runtime route handlers that export `runtime = 'edge'` and avoid Node-only APIs.

Manual flows still pass `handoff` to a React root. Do not invent a second state shape for browser
hydration. Keep `createRequestHandoff()` out of the normal private-request route; the nested request
family owns that work.

Lower-level resolver calls keep selections as the optional second positional argument:
`resolveOptimizedEntry(entry, selectedOptimizations)`. Managed fetch calls accept an ID or a
source object shaped as `{ contentType, slug, slugField?, entryQuery? }`. The ID overload receives
its query in `FetchOptimizedEntryOptions`; the slug source object carries `entryQuery` itself.
`ServerOptimizedEntry<TElement, S, M, L>` places the element type first, followed by the complete
skeleton union, response mode, and locale.

When lower-level code renders a resolver result directly, `isEmptyVariant === true` marks the SDK
renderer's no-content state; check it before rendering `entry`. The result retains the baseline
entry and selection context for tracking even when consumer output is empty.

### Caching and request deduplication

**Integration category:** Advanced or production-only

`private-request` handoffs include request-specific state and must not be stored in a shared public
cache. `public-permutation` handoffs are for app-owned segments, campaigns, markets, or other
application-defined permutations; pass `permutationKey`, `cacheVersion`, locale, entry IDs,
selected optimizations, and any rendered Custom Flag `changes` to
`createPublicPermutationHandoff()` so the SDK can create the public cache metadata and hydrate the
same state. The helper serializes those application-supplied values; it does not discover public
permutations or derive selected optimizations from route, cookie, header, locale, or cache-key
inputs. Because `changes` are handoff state rather than part of the generated cache-key
fingerprint, rotate `cacheVersion` when rendered Custom Flag changes change. `static` handoffs are
for baseline or build-time output that does not depend on a request profile. Do not create public or
static handoffs from request-derived profile state.

Use the supplemental rendering guide for static generation, App Router Cache Components, Pages
Router ISR, Edge runtime, and analytics-only recipes. Use the handoff concept when reviewing
whether a route can be public, public-permutation, static, or private-request cached.

Within one React Server Component request, every `optimization.request` wrapper shares one
SDK-owned initialization. Separate requests remain isolated. This sharing is different from managed
Contentful fetch caching and from caching rendered output; do not add an app-owned React cache,
request shell, or duplicate layout/page awaits around the request family.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

When no Optimization event may emit before explicit consent, configure a strict event policy and
return `false` from `consent.server` until your app-owned consent record is accepted. The request
tracker receives first-page-event ownership from its handoff. For top-level explicit handoff flows,
use `initialPageEvent="skip"` only when a server or edge helper already accepted the same route's
first page event. Use blocked-event diagnostics to verify denied events are dropped at the SDK
boundary.

## Production checks

- Confirm server and browser config use the intended Contentful space, environment, locale, and
  Optimization client ID.
- Confirm `consent.server`, browser consent defaults, and app-owned consent storage agree.
- Confirm `ctfl-opt-aid` is browser-readable where server and browser profile continuity is needed.
- Confirm server page events are not duplicated by browser route trackers.
- Confirm baseline fallback is acceptable when no variant applies or Contentful links are
  unresolved.
- Confirm request-personalized output is never stored in a public shared cache.
- Run the maintained reference implementation or your app's equivalent typecheck, lint, build, and
  browser E2E checks.

## Troubleshooting

| Symptom                                                         | Likely cause                                                                                                             | Check                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Entries stay on baseline                                        | No matching variant, no selections after a blocked Experience event, unresolved variant links, or all-locale CDA payload | Target all visitors for the first test, read accepted or blocked events, and fetch one locale with enough `include` depth              |
| A heterogeneous render cannot read content-type-specific fields | The skeleton union omits a possible content type, or the entry was not narrowed before rendering                         | Include every baseline and variant skeleton in `S`, then narrow with `isEntryOfContentType`                                            |
| Variant appears in the browser but not View Source              | The route is browser-owned rather than request-family or public-permutation rendered                                     | Use `optimization.request` for private request rendering, or use a top-level public permutation handoff before rendering               |
| Request components report a missing forwarded request URL       | The handler filename or export name does not match the Next.js version, or the handler is absent                         | Configure the SDK request handler; use `proxy.ts` with `proxy` on Next.js 16, or `middleware.ts` with `middleware` on Next.js 13 to 15 |
| Duplicate first page events                                     | A top-level explicit root and route tracker both emitted the initial route                                               | Give the top-level tracker the handoff's `initialPageEvent`; the request-family tracker receives it automatically                      |
| Live entries do not change after identify or reset              | The entry is locked to the handoff and live updates are off                                                              | Enable live updates for the route or entry, or open the preview panel in an allowed environment                                        |
| Personalized HTML is cached for the wrong visitor               | Request handoff output entered a public cache                                                                            | Use `private-request` for request state and public permutation handoffs only for app-owned selected permutations                       |

## Reference implementations to compare against

- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
- [Next.js SDK App Router Edge runtime reference implementation](../../implementations/nextjs-sdk_app-router_edge-runtime/README.md)
- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
