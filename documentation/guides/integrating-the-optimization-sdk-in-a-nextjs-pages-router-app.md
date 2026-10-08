---
fern:
  navTitle: Integrate the Optimization Next.js SDK in a Next.js Pages app
  slug: integrate-the-optimization-sdk-in-a-nextjs-pages-router-app
  section: Guides
  description: >-
    This guide helps you render personalized Contentful entries in `getServerSideProps` for a
    Next.js Pages Router app, then hydrate the browser from the same Optimization handoff.
---

# Integrate the Optimization Next.js SDK in a Next.js Pages Router app

Use this guide to render Contentful entries with personalized `getServerSideProps` first paint in a
Next.js Pages Router app, then hydrate the browser from the same Optimization handoff.

**New to personalization?** Here is the whole idea in four points:

- In Contentful you author **variants** of an entry and attach them to an **experience** - a rule
  that decides which visitors see which variant.
- When a page is requested, Contentful's **Experience API** looks at the request context and picks
  the variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies - the **baseline
  fallback**. You can fetch the entry yourself or give the SDK your Contentful client and an entry
  ID; either way, the client stays yours.
- You render the returned entry with the same application components you already use.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 - Server-resolved first paint and matching hydration.** The quick start below is
  shippable when your policy allows server personalization.
- **Milestone 2 - Opt-in browser re-personalization after hydration.** See
  [Browser takeover and live updates](#browser-takeover-and-live-updates).

This guide uses `@contentful/optimization-nextjs/pages-router` in browser-facing files and
`@contentful/optimization-nextjs/pages-router/server` in `getServerSideProps` helpers. The adapter
binds app-local configured components and a request handoff helper; your app still owns Contentful
fetching, consent policy, and response caching. If you use the App Router, use the
[Next.js App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
instead.

## Quick start

This quick start assumes a Pages Router page already fetches a Contentful entry in
`getServerSideProps` and renders it with your own component. The proof is one entry whose variant
appears in View Source and stays stable after hydration. Consent is granted only to prove the wiring;
replace it in [Consent, identity, profile, and reset](#consent-identity-profile-and-reset).

1. Install the package and keep `contentful` app-owned.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs contentful
   ```

2. Bind the browser-facing module for `_app.tsx` and page components. This binding shares one
   configured helper set for the app; it is not a per-route or per-visitor isolation context.

   **Adapt this to your use case:**

   ```tsx
   // lib/optimization.ts
   import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

   export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
     bindNextjsPagesRouterOptimization({
       spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
       environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'master',
       locale: 'en-US',
       consent: {
         clientDefaults: { consent: true, persistenceConsent: true },
       },
     })
   ```

3. Bind the server helper for `getServerSideProps`. The server entry point is separate from the
   browser-facing module and returns a browser `handoff`. This binding configures the server helper
   set; it is not a per-request isolation context. The quick start keeps entry fetching in
   `getServerSideProps`; managed fetching is introduced later.

   **Adapt this to your use case:**

   ```ts
   // lib/optimization-server.ts
   import { bindNextjsPagesRouterServerOptimization } from '@contentful/optimization-nextjs/pages-router/server'
   import type { GetServerSidePropsContext } from 'next'

   const { createRequestHandoff } = bindNextjsPagesRouterServerOptimization({
     spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
     environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
     locale: 'en-US',
     consent: {
       server: { events: true, persistence: true },
     },
   })

   export async function getContentfulOptimization(context: GetServerSidePropsContext) {
     const routeKey = context.resolvedUrl || context.req.url || '/'

     return {
       handoff: await createRequestHandoff(context, {
         cache: { scope: 'private-request' },
         hydration: 'preserve-server',
         pagePayload: { properties: { path: routeKey } },
       }),
     }
   }
   ```

4. Mount the bound root once in `_app.tsx` and pass the same handoff to the route tracker. The
   tracker gives the Web SDK the current route and prepared events together. A matching replay is
   admitted as one batch; without replay, the tracker emits an ordinary page event.

   **Adapt this to your use case:**

   ```diff
   // pages/_app.tsx
   +import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
    import type { AppProps } from 'next/app'
   +import { useRouter } from 'next/router'

    export default function App({ Component, pageProps }: AppProps) {
   +  const router = useRouter()
   +  const routeKey = router.asPath || router.pathname
   +  const handoff = pageProps.contentfulOptimization?.handoff

      return (
   -    <Component {...pageProps} />
   +    <OptimizationRoot
   +      buildPagePayload={() => ({ properties: { path: routeKey } })}
   +      handoff={handoff}
   +      routeKey={routeKey}
   +    >
   +      <NextPagesAutoPageTracker handoff={handoff} />
   +      <Component {...pageProps} />
   +    </OptimizationRoot>
      )
    }
   ```

5. Merge the Optimization handoff with your page props.

   **Adapt this to your use case:**

   ```diff
   // pages/index.tsx
   +import { getContentfulOptimization } from '@/lib/optimization-server'

    export async function getServerSideProps(context) {
      const hero = await getHeroEntry({ locale: 'en-US', include: 10 })
   +  const contentfulOptimization = await getContentfulOptimization(context)

      return {
        props: {
   +      contentfulOptimization,
          hero,
        },
      }
    }
   ```

6. Wrap the entry renderer. A **render prop** is the function child `{(entry) => ...}`; it lets you
   render the resolved entry with your existing component.
   This shortcut assumes the baseline and every eligible variant use the `hero` content type. If a
   variant can use another content type, follow the skeleton-union and narrowing path in
   [Personalizing entries](#personalizing-entries).

   **Adapt this to your use case:**

   ```diff
   // pages/index.tsx
   +import { OptimizedEntry } from '@/lib/optimization'
    import { Hero } from '@/components/Hero'

    export default function HomePage({ hero }) {
      return (
   -    <Hero entry={hero} />
   +    <OptimizedEntry baselineEntry={hero}>
   +      {(resolvedHero) => <Hero entry={resolvedHero} />}
   +    </OptimizedEntry>
      )
    }
   ```

7. Verify the result. In Contentful, target the experience to all visitors and give the variant a
   distinctive text value. Run the app, open View Source, and find that variant text in the raw HTML.
   Then load the page normally and confirm the same text remains after hydration.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [How the SDK fits your app](#how-the-sdk-fits-your-app)
  - [Fetching Contentful entries](#fetching-contentful-entries)
  - [The getServerSideProps request handoff and the profile cookie](#the-getserversideprops-request-handoff-and-the-profile-cookie)
  - [The bound root and page events](#the-bound-root-and-page-events)
  - [Personalizing entries](#personalizing-entries)
  - [Browser takeover and live updates](#browser-takeover-and-live-updates)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Consent, identity, profile, and reset](#consent-identity-profile-and-reset)
- [Optional integrations](#optional-integrations)
  - [Analytics forwarding](#analytics-forwarding)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Mixed route strategies](#mixed-route-strategies)
  - [Manual server and client escape hatches](#manual-server-and-client-escape-hatches)
  - [Caching and request policy](#caching-and-request-policy)
  - [Strict consent and duplicate-event controls](#strict-consent-and-duplicate-event-controls)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- A Next.js Pages Router app with `getServerSideProps` on pages that need server-personalized first
  paint.
- A Contentful delivery client that can fetch the baseline entries your pages render.
- Contentful space, environment, delivery token, and one concrete locale. Fetch entries with that
  locale and enough `include` depth for linked Optimization entries and variants.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Contentful space values** — space ID and environment, from your Contentful space
  settings. Find them in the Contentful web app under **Apps → Installed apps → Contentful
  Personalization → SDK keys**. The space ID and environment are safe to expose to the browser.

  The Experience and Insights API base URLs default correctly; you only set them for mocks or
  non-default hosts (see [How the SDK fits your app](#how-the-sdk-fits-your-app)).

You do not need a setup inventory up front. Everything else — the server helper, the root, entry
wrapping, consent, tracking — is introduced by the section that needs it.

> [!NOTE]
>
> Match your app's browser environment-variable convention. Next.js exposes `NEXT_PUBLIC_*` values
> to the browser; unprefixed server values stay server-only.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

Pages Router integrations have an explicit client/server split:

| Import path                                           | Use                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-nextjs/pages-router`        | Browser-facing binding for `_app.tsx`, route tracker, roots, `OptimizedEntry`, and selection helpers         |
| `@contentful/optimization-nextjs/pages-router/server` | Server helper for `getServerSideProps` request handoff, public permutation handoff, and selection resolution |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks and lower-level React roots                                                               |
| `@contentful/optimization-nextjs/tracking-attributes` | Low-level `data-ctfl-*` attributes for analytics-only markup                                                 |

Use the server entrypoint only from server files. Use the browser-facing module for `_app.tsx` and
components.

### Fetching Contentful entries

**Integration category:** Required for first integration

Manual entry source is the usual Pages Router path: `getServerSideProps` fetches a baseline entry and
passes it through props, then the page renders it through `OptimizedEntry`.

Managed entry source is also available when the route knows an entry ID or a content type and slug.
Pass `prefetchManagedEntries` to `createRequestHandoff()` in `getServerSideProps`; the helper puts
the baseline snapshots in `handoff.entries` so the browser can preserve managed entries without a
Contentful Delivery API (CDA) round trip. Server prefetch accepts a direct descriptor shaped as
`{ contentType, slug, slugField?, entryQuery? }`; `OptimizedEntry` receives that descriptor under
`managedEntry`. `slugField` defaults to `slug`.

Managed fetching needs the app-owned Contentful client in both bindings: the server binding uses it
for prefetch, and the browser binding uses it if a managed source must fetch after hydration. It also
extends the app-owned `getContentfulOptimization` wrapper with the descriptors for the current page.

**Adapt this to your use case:** add managed fetching only if a page passes an ID or descriptor to
`OptimizedEntry`. Keep `contentfulClient` in your existing Contentful module.

```diff
 // lib/optimization.ts
 import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'
+import { contentfulClient } from './contentful'

 bindNextjsPagesRouterOptimization({
   spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
+  contentful: { client: contentfulClient },
   // your existing config
 })

 // lib/optimization-server.ts
-import { bindNextjsPagesRouterServerOptimization } from '@contentful/optimization-nextjs/pages-router/server'
+import {
+  bindNextjsPagesRouterServerOptimization,
+  type ManagedEntryDescriptor,
+} from '@contentful/optimization-nextjs/pages-router/server'
+import { contentfulClient } from './contentful'

 bindNextjsPagesRouterServerOptimization({
   spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
+  contentful: { client: contentfulClient },
   // your existing config
 })

-export async function getContentfulOptimization(context: GetServerSidePropsContext) {
+export async function getContentfulOptimization(
+  context: GetServerSidePropsContext,
+  prefetchManagedEntries: readonly ManagedEntryDescriptor[] = [],
+) {
   const routeKey = context.resolvedUrl || context.req.url || '/'

   return {
     handoff: await createRequestHandoff(context, {
       cache: { scope: 'private-request' },
       hydration: 'preserve-server',
       pagePayload: { properties: { path: routeKey } },
+      prefetchManagedEntries,
     }),
   }
 }
```

For a dynamic route, define the source once from the route parameter. `contentType`, `slug`,
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

export type PageEntrySource = ReturnType<typeof getPageEntrySource>
```

Use that same object for server prefetch and browser rendering:

**Adapt this to your use case:**

```tsx
// pages/[slug].tsx
import { Hero } from '@/components/Hero'
import { OptimizedEntry } from '@/lib/optimization'
import { getContentfulOptimization } from '@/lib/optimization-server'
import { getPageEntrySource, type PageEntrySource } from '@/lib/page-entry-source'
import type { GetServerSidePropsContext } from 'next'

type PageProps = {
  entrySource: PageEntrySource
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const routeSlug = context.params?.slug
  if (typeof routeSlug !== 'string') return { notFound: true }

  const entrySource = getPageEntrySource(routeSlug)

  return {
    props: {
      contentfulOptimization: await getContentfulOptimization(context, [entrySource]),
      entrySource,
    },
  }
}

export default function Page({ entrySource }: PageProps) {
  return (
    <OptimizedEntry managedEntry={entrySource}>{(entry) => <Hero entry={entry} />}</OptimizedEntry>
  )
}
```

Slug lookup merges the normal managed query, then enforces `content_type`,
`fields.<slugField>`, and `limit: 2`. These are the exact failure templates:

- No match: `Contentful entry not found for content type "<contentType>" where "fields.<slugField>" equals "<slug>".`
- More than one match: `Multiple Contentful entries found for content type "<contentType>" where "fields.<slugField>" equals "<slug>".`

The angle-bracketed placeholders are replaced with the source's actual content type, effective slug
field, and slug. The handoff nests the normalized descriptor under `managedEntry`, retains the
fetched entry's real `sys.id` as `entryId`, and lets the browser render reuse it when `contentType`,
`slug`, the effective `slugField`, and effective `entryQuery` values match. Changing the locale,
include depth, custom slug field, or another query value creates a different source and therefore
does not reuse this handoff entry. Resolution metadata and interaction tracking use the real ID, not
the slug.

### The getServerSideProps request handoff and the profile cookie

**Integration category:** Required for first integration

`createRequestHandoff(context, options)` reads the Pages Router request, evaluates
`consent.server`, prepares the initial page event, and previews it through the Experience API. The
preview supplies selections for server rendering without committing the event. The helper returns a
serializable browser `handoff` containing the prepared replay. The browser admits the matching
replay to the existing Experience queue; its `accepted` result means queue admission, not completed
HTTP delivery. A recoverable Experience preview failure leaves baseline selections and retains
valid prepared events for browser commitment. If the helper, entry prefetch, or rendering throws for
another reason, your `getServerSideProps` error handling decides whether to return baseline or a
500 response. A page blocked by the effective event gate or invalid input produces no replay.
Configure `consent.server` explicitly. If it is omitted, Pages Router request consent resolves to
`false`.

The returned handoff also carries browser defaults derived from the resolved server consent. When
`_app.tsx` passes that handoff to the bound root, those handoff defaults override matching
`consent.clientDefaults` axes for the first browser runtime; `clientDefaults` remains the fallback
for routes without a request handoff.

The SDK-owned anonymous profile cookie is `ctfl-opt-aid`. It stores an Experience API-issued ID, not
an ID invented by the SDK. When persistence consent permits it and an existing or preview-issued ID
is known, the helper appends a browser-readable cookie to the response. An ID can be absent after a
failed first preview; the browser can establish one when it commits the replay. Your app owns any
consent cookie or account record that `consent.server` reads. Pages Router server work happens in `getServerSideProps`; there
is no middleware or proxy requirement for the Pages Router path.

### The bound root and page events

**Integration category:** Required for first integration

The bound `OptimizationProvider` handles the content SDK context, handoff, hydration mode, and
managed-entry prefetch for a subtree. Use the bound `OptimizationRoot` in `_app.tsx` for content and
the `NextPagesAutoPageTracker` for route events. Pass the same `handoff` to both. The tracker sends
the handoff with the current route to the Web SDK, which admits a matching prepared replay instead
of an ordinary first page. A missing or mismatched replay uses ordinary page tracking. Keep
`routeKey` and a lazy `buildPagePayload` on the root when its binding requires them; those props do
not belong on `OptimizationProvider`.

Campaign inputs follow page-event ownership. The `pagePayload` passed to `createRequestHandoff`
shapes the prepared first page event. The root's `buildPagePayload` shapes a browser event that the root
owns; in `beforeInitialPage` mode, it supplies both the direct attempt and later route emissions. In
normal tracker mode, `NextPagesAutoPageTracker` instead derives `page.url` from the current router URL
for later navigations. For either payload seam, `campaign` is an optional top-level object with
`name`, `source`, `medium`, `term`, and `content` fields, while `url` is nested under the optional
`properties` object. When those inputs are absent, the server request, browser page provider, or
router tracker supplies `page.url` for the event it owns.

For each event, the SDK chooses one whole campaign source in order: top-level `campaign`, then a
`properties.url` containing at least one supported UTM parameter, then `page.url`. An explicit empty
`campaign: {}` suppresses URL inference and produces empty attribution. Once a source is chosen,
missing fields are not filled from a lower-priority URL. The chosen URL maps into
`context.campaign`: `utm_campaign` becomes `name`, `utm_source` becomes `source`, `utm_medium`
becomes `medium`, `utm_term` becomes `term`, and `utm_content` becomes `content`. `page.referrer`
remains page metadata, but it is not a campaign source.

For a paired server route, put identity and custom Experience inputs that must precede the page
in the server helper's `initialEvents` option. The SDK prepares them in order, followed by the page,
and previews the batch for the server render. The browser commits the prepared replay through the
handoff. Use only identity and event values your app's consent policy permits on the server.

**Adapt this to your use case:** if your request has an app-owned event to evaluate before the page,
add it to the existing `getContentfulOptimization()` helper. `server_render` is an app-owned event
name; replace it with one your application actually uses.

```diff
 // lib/optimization-server.ts
 handoff: await createRequestHandoff(context, {
   cache: { scope: 'private-request' },
   hydration: 'preserve-server',
+  initialEvents: [{ type: 'track', event: 'server_render' }],
   pagePayload: { properties: { path: routeKey } },
 }),
```

The browser binder also accepts `beforeInitialPage` for an owned content root. Use this on a
browser-only route with no `getServerSideProps` handoff, such as `/browser-only` below. The
**initial page decision** is the root's first direct browser page attempt after callback work. A
root receiving a prepared replay follows the normal handoff queue path and does not run the
callback. Keep `initialEvents` above for work that must participate in server evaluation.

**Adapt this to your use case:** add the callback to the existing browser binding. `app-user-id`
and `client_ready` are app-owned; replace them with your identity store and custom event name. The
`async` callback returns one Promise that includes both awaited operations. The SDK's
`identify`, `screen`, and `track` delegates are safe to destructure; `screen` records a screen view.
The development observer logs local accepted or blocked results and cleans up both subscriptions.

```diff
 // lib/optimization.ts
-import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'
+import {
+  bindNextjsPagesRouterOptimization,
+  type BeforeInitialPageOptions,
+} from '@contentful/optimization-nextjs/pages-router'

-export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
+const beforeInitialPage = {
+  run: async ({ identify, track }) => {
+    const userId = window.localStorage.getItem('app-user-id')
+    if (userId !== null) await identify({ userId })
+    await track({ event: 'client_ready' })
+  },
+  onError: (error) => console.warn('Before-initial-page work failed.', error),
+} satisfies BeforeInitialPageOptions
+
+export const { OptimizationRoot, OptimizedEntry } =
   bindNextjsPagesRouterOptimization({
     spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
     environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'master',
     locale: 'en-US',
+    beforeInitialPage,
+    onStatesReady: (states) => {
+      if (process.env.NODE_ENV !== 'development') return
+      const accepted = states.eventStream.subscribe((event) => {
+        if (event) console.debug('Contentful Optimization event accepted', event)
+      })
+      const blocked = states.blockedEventStream.subscribe((event) => {
+        if (event) console.debug('Contentful Optimization event blocked', event)
+      })
+      return () => {
+        accepted.unsubscribe()
+        blocked.unsubscribe()
+      }
+    },
   })
```

The bound root requires `routeKey` and lazy `buildPagePayload`; the quick-start `_app.tsx` already
supplies both. It rejects eager `initialPagePayload`. Remove the separate tracker from `_app.tsx` in
the same edit, because this root owns the first and later browser pages. Routes with a prepared
handoff still commit replay through the root's normal handoff path and bypass the callback.

**Adapt this to your use case:** keep the same root and page component in `_app.tsx`.

```diff
 // pages/_app.tsx
-import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
+import { OptimizationRoot } from '@/lib/optimization'

 <OptimizationRoot
   buildPagePayload={() => ({ properties: { path: routeKey } })}
   handoff={handoff}
   routeKey={routeKey}
 >
-  <NextPagesAutoPageTracker handoff={handoff} />
   <Component {...pageProps} />
 </OptimizationRoot>
```

**Adapt this to your use case:** add a browser-only page outside your `getServerSideProps` route.
It receives no request handoff through page props, so the callback runs on first load.

```tsx
// pages/browser-only.tsx
import Link from 'next/link'

export default function BrowserOnlyPage() {
  return (
    <main>
      <p>Browser-only route</p>
      <Link href="/browser-only?view=next">Next view</Link>
    </main>
  )
}
```

The callback runs after the live owned runtime exists and once per retained `_app` root lifetime; a
real remount starts another lifetime. Return a Promise or **thenable** (an object with `.then()`)
for all work the root must await. It waits for that work or its watchdog, then reads the latest
route and lazy payload for one direct page attempt. After the attempt settles, its built-in page
emitter records an initial non-emitting `skip` mark for the attempted route, then emits for later
routes. `{ accepted: false }` means the page was not admitted locally; the root still advances
without an immediate same-route retry.

The watchdog waits 3,000 ms by default; `maxWaitMs` must be positive and finite. A callback throw,
rejected returned work, or watchdog expiry reaches `onError`, then the root continues to the page
while mounted on the same live runtime. The watchdog does not cancel work already started. A route
change during an in-flight direct attempt neither cancels it nor starts another; a route observed
only during that interval is not emitted, and a change after readiness emits normally. Work the
callback starts without returning can finish after the page.

> [!NOTE]
>
> If callback and page work remain pending when an entry reaches its five-second fallback deadline,
> baseline content can become visible. With live updates off, that visible content stays frozen.
> Enable [Browser takeover and live updates](#browser-takeover-and-live-updates) if late replacement
> is intended.

For a development check, run `/browser-only` and set the example identity with
`localStorage.setItem('app-user-id', 'guide-user')`, then reload. The accepted or blocked `identify`
and `client_ready` results must appear before at most one initial `page` result. Click **Next view**
after readiness and confirm one later page result. The observer proves local admission or blocking, not
HTTP delivery. Two initial page results usually mean a separate tracker remains mounted. Remove
the observer after checking. The Pages server binder does not accept, run, or serialize this
browser-only callback into page props; its provider and analytics root also omit it.

### Personalizing entries

**Integration category:** Required for first integration

`OptimizedEntry` receives a `baselineEntry` fetched by your page, a managed `entryId` plus optional
`entryQuery`, or a content-type/slug descriptor under `managedEntry`. The descriptor can also set
`slugField` and `entryQuery`. Its render prop receives the resolved entry. If no
experience applies, the selection-producing event is blocked by the effective event gate, the API has no variant, or a linked variant cannot be
resolved, the render receives the baseline entry.

`isEmptyVariant === true` marks the SDK renderer's no-content state. It differs from the fallback
cases above, which render the baseline entry. In the no-content state, `OptimizedEntry` keeps its
host and tracking attributes but does not invoke or render app content. The standalone
`ServerOptimizedEntry`, imported from `@contentful/optimization-nextjs/server`, is the lower-level
renderer for server code that already has a full resolver result and static children; it keeps its
server-rendered host and tracking attributes while omitting those children. An absent empty-variant
flag renders normally.

A resolved selected variant can use any Contentful content type.

A Contentful **entry skeleton** is a TypeScript type that names a content type ID and its fields.
Use one skeleton union, `S`, containing every possible baseline or variant content type. The bound
`OptimizedEntry` with `baselineEntry` uses `<S, M, L>`, where `M` is the `contentful.js` response
mode and `L` is the locale type. A managed ID or slug source uses `<S, L>` because `M` is fixed to
`undefined`. When every variant shares the baseline content type, omit the generic and let
TypeScript infer that skeleton from `baselineEntry`.

**Follow this pattern:** declare the complete skeleton union in the page renderer and narrow in the
render prop, where the resolved entry becomes page markup. The guard compares the Contentful
content type ID; it does not validate fields.

```tsx
import { OptimizedEntry } from '@/lib/optimization'
import { isEntryOfContentType } from '@contentful/optimization-nextjs/api-schemas'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type CtaSkeleton = EntrySkeletonType<{ label: EntryFieldTypes.Symbol }, 'cta'>
type AppEntrySkeleton = PageSkeleton | HeroSkeleton | CtaSkeleton
type AppLocale = 'en-US'

export function PersonalizedPage({ page }: { page: Entry<PageSkeleton, undefined, AppLocale> }) {
  return (
    <OptimizedEntry<AppEntrySkeleton, undefined, AppLocale> baselineEntry={page}>
      {(entry) => {
        if (isEntryOfContentType<HeroSkeleton, undefined, AppLocale>(entry, 'hero')) {
          return <h1>{entry.fields.headline}</h1>
        }
        if (isEntryOfContentType<CtaSkeleton, undefined, AppLocale>(entry, 'cta')) {
          return <button type="button">{entry.fields.label}</button>
        }
        return <h1>{entry.fields.title}</h1>
      }}
    </OptimizedEntry>
  )
}
```

The union is a compile-time model, not a runtime filter. Narrow at the renderer boundary before
reading content-type-specific fields. For lower-level resolver, managed-fetch, open-ended model,
and event-stream examples, see
[TypeScript content-model choices](../concepts/entry-personalization-and-variant-resolution.md#typescript-content-model-choices).

Avoid nesting two `OptimizedEntry` wrappers for the same baseline entry. Put the wrapper at the point
where the app turns the entry into output.

### Browser takeover and live updates

**Integration category:** Common but policy-dependent

The handoff controls the first browser render over server HTML. `liveUpdates` controls whether
entries may re-resolve after startup when consent, identity, profile, or preview state changes.

Keep the default locked behavior for stable first paint. Turn on `liveUpdates` in the binding config
or on a specific entry only when visible content should react after hydration.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` emits view, click, and hover tracking from the resolved entry by default. Configure
global defaults with `trackEntryInteraction` in the browser-facing binding config and use per-entry props
for local opt-outs. Interaction delivery still depends on event consent and profile continuity.

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Replace the quick-start consent shortcut with your app policy:

1. Read the app-owned consent record in the server helper's `consent.server`; omitted request
   consent resolves to `false`.
2. Seed conservative browser defaults through `consent.clientDefaults` for routes without a request
   handoff.
3. Mirror browser choices to the app-owned consent record before the next request.
4. Use `setConsent`, `identifyUser`, and `resetUser` from `/client` hooks for browser actions.

For request-handoff routes, defaults derived from the resolved `consent.server` decision travel in
the handoff and take precedence over matching `consent.clientDefaults` axes. Keep the two policies
aligned so hydration starts from the same consent decision the server used.

**Adapt this to your use case:**

```ts
bindNextjsPagesRouterServerOptimization({
  spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
  consent: {
    server: ({ cookies }) =>
      cookies.get('app-consent')?.value === 'accepted'
        ? { events: true, persistence: true }
        : false,
  },
})
```

`app-consent` is reader-owned in this example. The SDK reads only the decision you pass to it.

## Optional integrations

Looking for optional before-initial-page work? Because it changes first-page ownership, its
setup and verification live in
[The bound root and page events](#the-bound-root-and-page-events).

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
[Forward Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Merge tags and Custom Flags

**Integration category:** Optional

The `OptimizedEntry` render prop also receives `getMergeTagValue`. Pass it to your Rich Text
renderer when entries contain SDK-owned merge-tag entries. Use `/client` hooks for browser-only
Custom Flags when a page needs reactive flag reads after hydration.

**Follow this pattern:**

```tsx
<OptimizedEntry baselineEntry={article}>
  {(entry, { getMergeTagValue }) => (
    <RichText document={entry.fields.body} getMergeTagValue={getMergeTagValue} />
  )}
</OptimizedEntry>
```

### Preview panel

**Integration category:** Optional

Attach `@contentful/optimization-web-preview-panel` only in development, preview, or staging
environments. The panel needs the live browser SDK and a Contentful client or pre-fetched audience
and experience entries. Keep the environment gate app-owned; do not ship editor tooling to ordinary
production visitors.

## Advanced integrations

### Mixed route strategies

**Integration category:** Advanced or production-only

Choose route ownership deliberately:

| Route strategy                       | First paint owner               | Browser content behavior                                    | Cache scope                             |
| ------------------------------------ | ------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `getServerSideProps` request handoff | Server request                  | Preserves server output; optional live updates              | `private-request`                       |
| Static or ISR public permutation     | Static props chosen by app code | Preserves selected output; optional live updates            | `public-permutation` with SDK-built key |
| Browser-only route                   | Browser SDK                     | Resolves after hydration                                    | Static page shell                       |
| Analytics-only markup                | Server or static markup         | Tracks page and interactions only; no content re-resolution | Matches the rendered markup owner       |

Pages Router static generation does not have request context. Use
`createPublicPermutationHandoff()` only when your application supplies app-owned selected
optimizations for a static or ISR permutation. The helper serializes those selections and cache
metadata; it does not discover public permutations or derive selected optimizations from route,
cookie, header, locale, or cache-key inputs. The maintained reference route uses a finite
`getStaticPaths()` registry with `fallback: false`; `fallback: 'blocking'` is a later option for
larger registries after you define how uncached public permutations are approved.

Each `resolveEntriesForSelections()` item includes optional `isEmptyVariant`. When it is `true`, the
item retains the baseline `entry` for tracking context, but direct page output must omit consumer
content.

**Follow this pattern:** return `null` for the empty result and branch on that value in the page.
`Hero` is your app-owned renderer; the page never passes `null` to `OptimizedEntry` as a
`baselineEntry`.

```tsx
import type { InferGetStaticPropsType } from 'next'

type SegmentPageProps = InferGetStaticPropsType<typeof getStaticProps>

export default function SegmentPage({ hero }: SegmentPageProps) {
  if (hero === null) return null
  return <Hero entry={hero} />
}

export async function getStaticPaths() {
  const segments = await getPublicSegments()

  return {
    fallback: false,
    paths: segments.map((segment) => ({ params: { segment: segment.slug } })),
  }
}

export async function getStaticProps({ params }) {
  const segment = await getPublicSegment(params.segment)
  const hero = await getHeroEntry({ locale: segment.locale, include: 10 })
  const [resolvedHero] = resolveEntriesForSelections({
    entries: [hero],
    selectedOptimizations: segment.selectedOptimizations,
  })

  return {
    props: {
      contentfulOptimization: {
        handoff: createPublicPermutationHandoff({
          permutationKey: segment.slug,
          cacheVersion: segment.cacheVersion,
          locale: segment.locale,
          entryIds: segment.baselineEntryIds,
          selectedOptimizations: segment.selectedOptimizations,
          changes: segment.changes,
          hydration: 'preserve-server',
        }),
      },
      hero: resolvedHero.isEmptyVariant ? null : resolvedHero.entry,
    },
    revalidate: 60,
  }
}
```

The page treats a `null` `hero` prop as no consumer output. The handoff still carries the selected
optimization state needed by the browser runtime.

For complete static, ISR, edge rendering, and analytics-only recipes, use
[Render personalized Next.js routes with static, ISR, and edge handoffs](./rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md).
For the mechanics behind handoff state and cache scopes, use
[Optimization handoff and cache-safe rendering](../concepts/optimization-handoff-and-cache-safe-rendering.md).

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use lower-level subpaths only when the bound Pages Router path cannot express the route. The main
escape hatches are `/server` for direct Node request control with
`configureNextjsServerOptimization(...)`, `/client` for router-neutral React roots and hooks, and
`/tracking-attributes` for manually rendered analytics-only markup.
`configureNextjsServerOptimization(...)` configures a stateless server runtime; it is not a
request-isolation context. Manual flows still pass `handoff` to a React root.

Lower-level resolver calls keep selections as the optional second positional argument:
`resolveOptimizedEntry(entry, selectedOptimizations)`. Managed fetch calls accept an ID or a
source object shaped as `{ contentType, slug, slugField?, entryQuery? }`. The ID overload receives
its query in `FetchOptimizedEntryOptions`; the slug source object carries `entryQuery` itself.
`ServerOptimizedEntry<TElement, S, M, L>` places the element type first, followed by the complete
skeleton union, response mode, and locale.

When lower-level code renders a resolver result directly, `isEmptyVariant === true` marks the SDK
renderer's no-content state; check it before rendering `entry`. The result retains the baseline
entry and selection context for tracking even when consumer output is empty.

### Caching and request policy

**Integration category:** Advanced or production-only

`private-request` handoffs include request-specific state and must not be stored in a shared public
cache. A recoverable Experience preview failure already returns a handoff with baseline selections
and valid prepared replay. Catch other thrown handoff, entry-prefetch, or render failures according
to your app's policy; many apps return baseline props for those errors.

Use the handoff concept to review why request profile state must stay out of public caches, and use
the supplemental rendering guide for static and ISR public permutation handoff patterns.

**Follow this pattern:**

```ts
export async function getServerSideProps(context) {
  const hero = await getHeroEntry()

  try {
    return {
      props: {
        contentfulOptimization: await getContentfulOptimization(context),
        hero,
      },
    }
  } catch {
    return { props: { hero } }
  }
}
```

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

When no Optimization event may emit before explicit consent, configure
`allowedEventTypes: []` in both the server and browser bindings, and return `false` from
`consent.server` until your app-owned consent record is accepted. The default allow-list can admit a
page before consent. In
normal mode, pass the same handoff to the root and tracker. In `beforeInitialPage` mode, mount no
tracker; the root handles replay or a direct browser page. Use blocked-event diagnostics to verify
denied events are dropped at the SDK boundary.

## Production checks

- Confirm server and browser config use the intended Contentful space, environment, locale, and
  Contentful space ID.
- Confirm `consent.server`, request handoff defaults, browser consent defaults, and app-owned
  consent storage agree.
- Confirm `ctfl-opt-aid` is browser-readable where server and browser profile continuity is needed.
- Confirm raw server HTML reflects the preview result, and check the browser Network panel for the
  prepared Experience batch after hydration. Local acceptance does not prove HTTP delivery.
- Temporarily add the app-owned `server_render` track event to `initialEvents` as shown above, grant
  event consent, and reload. In the browser Network panel, the prepared `track` and `page` must
  appear in one Experience batch with no additional ordinary first page. A page-only request points
  to missing or mismatched replay. Remove the diagnostic event afterward.
- In normal mode, confirm the tracker admits one prepared first-route batch without a second
  ordinary page, then tracks later routes. In `beforeInitialPage` mode, confirm a paired replay
  bypasses the callback; on `/browser-only`, confirm callback results precede one direct page.
- Confirm baseline fallback is acceptable when no variant applies or Contentful links are
  unresolved.
- Confirm request-personalized output is never stored in a public shared cache.
- Run the maintained reference implementation or your app's equivalent typecheck, lint, build, and
  browser E2E checks.

## Troubleshooting

| Symptom                                                         | Likely cause                                                                                                                                                                          | Check                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Entries stay on baseline                                        | Missing handoff props, no matching variant, a selection-producing event blocked by effective policy, recoverable preview failure, unresolved variant links, or all-locale CDA payload | Target all visitors, pass the handoff into `_app.tsx`, inspect server preview diagnostics, and fetch one locale with enough `include` depth |
| A heterogeneous render cannot read content-type-specific fields | The skeleton union omits a possible content type, or the entry was not narrowed before rendering                                                                                      | Include every baseline and variant skeleton in `S`, then narrow with `isEntryOfContentType`                                                 |
| Page returns 500 instead of baseline                            | The request handoff call threw and the page did not catch it                                                                                                                          | Wrap the personalization helper according to your fallback policy                                                                           |
| Duplicate first page events                                     | Normal mode lacks the same handoff on root and tracker, a `beforeInitialPage` root also mounts a tracker, or app code emits an extra page                                             | Pass one handoff to root and tracker in normal mode; remove the tracker in `beforeInitialPage` mode and avoid manual first-page calls       |
| Live entries do not change after identify or reset              | The entry is locked to the handoff and live updates are off                                                                                                                           | Enable live updates for the route or entry, or open the preview panel in an allowed environment                                             |
| Personalized HTML is cached for the wrong visitor               | Request handoff output entered a public cache                                                                                                                                         | Keep request handoff pages private and use public permutation handoff only for explicit static or ISR permutations                          |

## Reference implementations to compare against

- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
