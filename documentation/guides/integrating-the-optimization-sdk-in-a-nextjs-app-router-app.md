# Integrating the Optimization Next.js SDK in a Next.js App Router app

Use this guide to render a personalized Contentful entry on the server and keep the same result when
the browser starts. The server gives the browser a plain-data snapshot of the selected variants and
browser startup settings used for that render. This snapshot is an **Optimization handoff**.

**New to personalization?** Here is the whole idea in four points:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- On each request, Contentful's **Experience API** looks at the request context and picks the
  variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies—the **baseline
  fallback**. You can fetch the entry yourself or give the SDK your Contentful client and an entry
  ID; either way, the client stays yours.
- You render the returned entry with the same application components you already use.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — Personalized first paint from one server render.** The quick start below is
  shippable when your policy allows server personalization.
- **Milestone 2 — Browser takeover and live updates.** See
  [Browser takeover and live updates](#browser-takeover-and-live-updates).

This guide uses `@contentful/optimization-nextjs/app-router/server` for Server Components and
`@contentful/optimization-nextjs/app-router/client` when an app needs bound Client Components. The
adapter binds app-local configured components and handoff helpers; your app still owns Contentful
client credentials and query policy, the choice between app-owned and SDK-managed entry fetching,
consent policy, and any keys or policy for your application's rendered-output caches. The SDK owns
its managed-entry cache and request synchronization. If you use the Pages Router, use the
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

2. Add the Optimization project values to your app's browser-visible environment file. Find the
   client ID and environment in the Contentful web app under **Apps → Installed apps → Contentful
   Personalization → SDK keys**. The variable names and `.env.local` placement below are
   app-owned; keep the `NEXT_PUBLIC_` prefix because the browser binding needs these values.

   **Adapt this to your use case:**

   ```dotenv
   # .env.local
   NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID=your-client-id
   NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT=main
   ```

3. Bind one app-local server Optimization module. This binding shares one configured helper set for
   the app. Its nested `optimization.request` family initializes the active request before any
   request-bound component renders.
   Use the same Contentful environment for server and client binding code. The consent values below
   are a quick-start policy shortcut: `server.events` and `clientDefaults.consent` allow
   personalization events, while `server.persistence` and
   `clientDefaults.persistenceConsent` allow the SDK-owned anonymous ID to persist. The
   `preserve-server` hydration mode tells the browser to keep the server-rendered result while its
   live runtime starts.

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

4. Forward the original request URL so the request family can initialize. Use the
   handler name for your Next.js version: Next.js 16 uses `proxy.ts` with `proxy`, and Next.js 13 to
   15 uses `middleware.ts` with `middleware`. The body is the same. If the filename or export name
   does not match the Next.js version, Next.js does not run the handler and request context is not
   forwarded. The SDK handler owns the forwarded request-header names and values.
   The matcher paths below are app-owned and cover the participating route families in the
   maintained App Router shape. Keep the matcher narrow when your route names differ.

   **Adapt this to your use case:**

   ```ts
   // Next.js 16: proxy.ts and export const proxy.
   // Next.js 13 to 15: middleware.ts and export const middleware.
   import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

   const optimizationRequestHandler = createNextjsOptimizationContextHandler()

   export const proxy = optimizationRequestHandler
   // In Next.js 13 to 15, export this as middleware instead.

   export const config = {
     matcher: [
       '/',
       '/page-two',
       '/hidden-until-ready',
       '/static-shell-private-slot',
       '/selection-handoff/:path*',
       '/analytics-only/:path*',
     ],
   }
   ```

5. Split your shell into three responsibilities before adding the request root:
   - `AppShellChrome` renders request-independent navigation and keeps normal Next.js `Link`
     prefetch enabled.
   - `AppShellBody` contains UI that reads the Optimization provider.
   - `PersonalizedContentFallback` gives the private region a labeled loading state without hiding
     the public navigation.

   These names are app-owned. Map the responsibilities onto your existing shell rather than adding
   a second shell.

   **Adapt this to your use case:**

   ```tsx
   // components/AppShell.tsx
   import Link from 'next/link'
   import type { ReactNode } from 'react'

   export function AppShellChrome({ children }: { children: ReactNode }) {
     return (
       <main>
         <nav aria-label="Main">
           <Link href="/">Home</Link>
         </nav>
         {children}
       </main>
     )
   }

   export function AppShellBody({ children }: { children: ReactNode }) {
     return <section aria-label="Personalized page content">{children}</section>
   }

   export function PersonalizedContentFallback() {
     return (
       <section aria-busy="true" aria-live="polite">
         <p>Loading personalized page content…</p>
       </section>
     )
   }
   ```

6. Wrap the request-dependent part of the route in the nested request root. Keep public,
   request-independent chrome outside both the root and `Suspense`. Put the page tracker and every
   component that reads the Optimization provider inside the root. The meaningful fallback keeps
   public navigation available while private content loads. On Next.js 15 and later with Cache
   Components, `connection()` marks the private slot as request-time work; keep its import and call at
   that boundary so the public shell remains separate from visitor-specific rendering. On Next.js 13
   to 14, omit the import and call because that API is unavailable. The surrounding layout is
   illustrative context to match against, not a full file to paste over your layout.

   **Adapt this to your use case:**

   ```diff
   // app/(request)/layout.tsx
   +import {
   +  AppShellBody,
   +  AppShellChrome,
   +  PersonalizedContentFallback,
   +} from '@/components/AppShell'
   +// Next.js 15+ with Cache Components. Omit this import on Next.js 13 to 14.
   +import { connection } from 'next/server'
   +import { Suspense } from 'react'
   +import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'

   +async function PrivateRequestSlot({ children }: { children: React.ReactNode }) {
   +  // Next.js 15+ with Cache Components. Omit this call on Next.js 13 to 14.
   +  await connection()
   +
   +  return (
   +    <RequestOptimizationRoot>
   +      <RequestNextAppAutoPageTracker />
   +      <AppShellBody>{children}</AppShellBody>
   +    </RequestOptimizationRoot>
   +  )
   +}
   +
    export default function RequestLayout({ children }: { children: React.ReactNode }) {
     return (
   -    <AppShell>{children}</AppShell>
   +    <AppShellChrome>
   +      <Suspense fallback={<PersonalizedContentFallback />}>
   +        <PrivateRequestSlot>{children}</PrivateRequestSlot>
   +      </Suspense>
   +    </AppShellChrome>
     )
   }
   ```

7. Wrap the entry where it becomes output. A **render prop** is the function child
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

8. Verify the result. In Contentful, target the experience to all visitors and give the variant a
   distinctive text value. Run the app, open View Source, and find that variant text in the raw HTML.
   Then load the page normally and confirm the same text remains after hydration.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [How the SDK fits your app](#how-the-sdk-fits-your-app)
  - [Choose who owns entry fetching](#choose-who-owns-entry-fetching)
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
binding once in its own runtime-specific module. A binding creates reusable configured components;
the nested `optimization.request` family keeps each visitor request's work and state separate.

The quick start uses only the server binding and request handler. The remaining paths support the
advanced route strategies taught later:

| Import path                                           | Use                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router/server`   | Server binding; its nested `request` components personalize per visitor. Top-level roots accept app-supplied handoffs; the entry consumes its documented props and stored handoff state, while the tracker consumes its documented event-ownership prop |
| `@contentful/optimization-nextjs/app-router/client`   | A configured component family for Client Components                                                                                                                                                                                                     |
| `@contentful/optimization-nextjs/cache-middleware`    | Rewrites routes for app-defined personalization choices that are safe to share publicly                                                                                                                                                                 |
| `@contentful/optimization-nextjs/client`              | Browser hooks, providers, and entry controls                                                                                                                                                                                                            |
| `@contentful/optimization-nextjs/edge`                | Request and handoff helpers for the Edge runtime                                                                                                                                                                                                        |
| `@contentful/optimization-nextjs/request-handler`     | Forwards the request URL and, in advanced trusted flows, compact server context                                                                                                                                                                         |
| `@contentful/optimization-nextjs/tracking-attributes` | Adds tracking attributes when the browser tracks server-rendered markup without re-resolving it                                                                                                                                                         |

The package root is not an import path. Server Components use the server binding. A **bound Client
Component** uses components created by the client binding rather than importing a router-neutral
component directly. Create that separate binding only when a bound Client Component needs one;
router-neutral hooks and per-entry browser controls continue to use `/client`.

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

As an optional client-only path, add `initialExperience` when the request root must finish returned
identity or custom Experience work before its first browser-owned page decision. Keep the callback
in this `'use client'` module. Here, **identity** means the visitor ID and traits your application is
allowed to send; the full lifecycle is covered in
[Consent, identity, profile, and reset](#consent-identity-profile-and-reset).

The callback runs once during a retained root lifetime, which starts when that request root mounts
in the browser and ends when it unmounts. A real remount starts another lifetime. The SDK-provided
`InitialExperienceClient` exposes methods that stay bound when destructured: `identify` supplies
visitor identity, `screen` records a screen-view Experience event, and `track` sends an app-named
custom Experience event.

Return one value that represents all startup operations. A JavaScript `Promise` represents work
that finishes later; a **thenable** is a Promise-like object with a `.then()` method. An `async`
callback returns one Promise automatically, and every operation you `await` becomes part of that
returned work.

**Adapt this to your use case:** extend the client binding above. `app-user-id` and `client_ready`
are app-owned identifiers in this example; replace them with the browser identity store and custom
event name your app owns.

```diff
 // lib/optimization-client.ts
 'use client'

-import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'
+import {
+  bindNextjsAppRouterClientOptimization,
+  type InitialExperienceOptions,
+} from '@contentful/optimization-nextjs/app-router/client'

+const APP_USER_ID_KEY = 'app-user-id'
+const CLIENT_READY_EVENT = 'client_ready'
+
+const initialExperience = {
+  run: async ({ identify, track }) => {
+    const userId = window.localStorage.getItem(APP_USER_ID_KEY)
+    if (userId !== null) await identify({ userId })
+    await track({ event: CLIENT_READY_EVENT })
+  },
+  onError: (error) => console.warn('Initial Optimization work failed.', error),
+} satisfies InitialExperienceOptions
+
 export const clientOptimization = bindNextjsAppRouterClientOptimization({
   clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
   environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
   locale: 'en-US',
+  initialExperience,
 })
+
+export const {
+  RequestOptimizationRoot: ClientRequestOptimizationRoot,
+} = clientOptimization
```

The callback-present client binding exposes two content roots for different owners:

- `clientOptimization.OptimizationRoot` is for direct Client Component composition. It requires an
  explicit `routeKey` and lazy `buildPagePayload`. It does not accept `initialPagePayload`, the
  eager page data object computed before later route changes.
- `ClientRequestOptimizationRoot` is the `RequestOptimizationRoot` component for the server
  binding's request family. It accepts only serializable request-root values: children, defaults,
  the content handoff, and hydration mode. It derives the live route and lazy page payload in the
  client, so callers do not pass route or page-payload props.

Inject the second component into the existing server binding. The component reference replaces the
default browser root only for `optimization.request`; it does not wrap or create a second root.

**Adapt this to your use case:** complete this server binding and layout continuation as one change.
Add the request-root composition argument, stop exporting and importing the normal request tracker,
and remove its JSX before you run the callback-enabled route. Keep the existing server config and
other request-family exports.

```diff
 // lib/optimization.ts
 import { bindNextjsAppRouterServerOptimization } from '@contentful/optimization-nextjs/app-router/server'
+import { ClientRequestOptimizationRoot } from './optimization-client'
 import { contentfulClient } from './contentful'

 export const optimization = bindNextjsAppRouterServerOptimization({
   // your existing server config
-})
+}, {
+  request: { OptimizationRoot: ClientRequestOptimizationRoot },
+})

 export const {
-  NextAppAutoPageTracker: RequestNextAppAutoPageTracker,
   OptimizationRoot: RequestOptimizationRoot,
   OptimizedEntry: RequestOptimizedEntry,
 } = optimization.request
```

**Adapt this to your use case:** continue immediately in the request layout. The surrounding layout
remains app-owned context; remove both the tracker import and its JSX.

```diff
 // app/(request)/layout.tsx
-import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'
+import { RequestOptimizationRoot } from '@/lib/optimization'

 <RequestOptimizationRoot>
-  <RequestNextAppAutoPageTracker />
   <AppShellBody>{children}</AppShellBody>
 </RequestOptimizationRoot>
```

The first server-binder parameter has an `initialExperience?: never` boundary: TypeScript rejects a
callback value on that parameter. A callback-present client config variable is not assignable there;
the second parameter receives the Client Component reference instead. The server request authority
still supplies only resolved handoff, hydration, defaults, and children. The callback and lazy
payload builder stay in the client module and never cross React Flight, the Server Component payload
sent to the browser, as server config or serialized request-root data. The serialized handoff shape
is unchanged.

The watchdog timeout uses 3,000 ms when `maxWaitMs` is omitted and accepts any positive finite
value. A value of `0`, a negative number, `NaN`, `Infinity`, or `-Infinity` synchronously throws
`TypeError('initialExperience.maxWaitMs must be a positive finite number.')` before the provider,
callback, page, `onError`, or watchdog runs. The client binder does not forward the callback to its
bound `OptimizationProvider` or `OptimizationAnalyticsRoot`, and a standalone
`OptimizationProvider` with an injected SDK does not accept it.

The binding config separates policy from mechanism:

- `consent.server` is the app-owned server policy for the current request; configure it explicitly
  because App Router request initialization resolves omitted request consent to `false`.
- `consent.clientDefaults` seeds the browser SDK before a persisted or explicit browser decision is
  available.
- `contentful.client` is your delivery client. The SDK may call it for managed entry IDs or
  content-type/slug lookups, but it does not own your Contentful Delivery API (CDA) credentials or
  query policy.

### Choose who owns entry fetching

**Integration category:** Required for first integration

Choose one of these supported workflows for each entry:

- **App-owned fetching:** Keep your existing fetcher, query, and cache, then pass its result as
  `baselineEntry`. This fits apps that already coordinate Contentful data with other page data.
- **SDK-managed fetching:** Give the binding your `contentful.js` client, then identify the entry by
  `entryId` or by a `managedEntry` descriptor. This fits entries whose Contentful Delivery API (CDA)
  work can be owned by the Optimization SDK.

App-owned fetching is the quick-start workflow. The app fetches first, and the request entry resolves
that baseline with the request's experience-and-variant choices.

**Adapt this to your use case:**

```tsx
import { RequestOptimizedEntry } from '@/lib/optimization'
import { contentfulClient } from '@/lib/contentful'

export async function AppOwnedHero({ entryId }: { entryId: string }) {
  const baselineEntry = await contentfulClient.getEntry(entryId, {
    include: 10,
    locale: 'en-US',
  })

  return (
    <RequestOptimizedEntry baselineEntry={baselineEntry}>
      {(entry) => <h1>{String(entry.fields.headline)}</h1>}
    </RequestOptimizedEntry>
  )
}
```

For a content-type-and-slug lookup, pass the object under the fixed `managedEntry` prop. The
`contentType`, `slug`, optional `slugField`, and optional `entryQuery` property names are SDK-defined;
their values come from your route and content model. `slugField` defaults to `slug`.

**Adapt this to your use case:**

```tsx
import { RequestOptimizedEntry } from '@/lib/optimization'

export function ManagedHeroBySlug({ slug }: { slug: string }) {
  const managedEntry = {
    contentType: 'hero',
    slug,
    entryQuery: { include: 10, locale: 'en-US' },
  } as const

  return (
    <RequestOptimizedEntry managedEntry={managedEntry}>
      {(entry) => <h1>{String(entry.fields.headline)}</h1>}
    </RequestOptimizedEntry>
  )
}
```

The SDK-managed ID workflow below shows the deltas to the existing quick-start binding and private
slot. The binding supplies the app-owned client, the request root prefetches the baseline into the
browser handoff, and the request entry resolves that same ID for server output. `entryId` is an
app-owned Contentful entry ID. Edit the existing binding and root; do not create a second binding or
nest another root around an already-bound subtree. The server-only `CONTENTFUL_HERO_ENTRY_ID` name
and value in this example are app-owned. The diff shows normal tracker mode. If you already enabled
the callback request-root composition, keep `RequestNextAppAutoPageTracker` omitted while applying
the managed-entry changes.

**Adapt this to your use case:**

```diff
 // lib/optimization.ts - the existing binding
 import { contentfulClient } from './contentful'

 export const optimization = bindNextjsAppRouterServerOptimization({
   // Keep the existing client ID, environment, locale, and consent.
   contentful: { client: contentfulClient },
 })

 // app/(request)/layout.tsx - the existing private slot
+import { RequestOptimizedEntry } from '@/lib/optimization'

-async function PrivateRequestSlot({ children }: { children: React.ReactNode }) {
+async function PrivateRequestSlot({
+  children,
+  entryId,
+}: {
+  children: React.ReactNode
+  entryId: string
+}) {
   // Next.js 15+ with Cache Components. Omit this call and its import on Next.js 13 to 14.
   await connection()

   return (
-    <RequestOptimizationRoot>
+    <RequestOptimizationRoot prefetchManagedEntries={[entryId]}>
       <RequestNextAppAutoPageTracker />
+      <RequestOptimizedEntry entryId={entryId}>
+        {(entry) => <h1>{String(entry.fields.headline)}</h1>}
+      </RequestOptimizedEntry>
       <AppShellBody>{children}</AppShellBody>
     </RequestOptimizationRoot>
   )
 }

 export default function RequestLayout({ children }: { children: React.ReactNode }) {
+  const entryId = process.env.CONTENTFUL_HERO_ENTRY_ID!
   return (
     <AppShellChrome>
       <Suspense fallback={<PersonalizedContentFallback />}>
-        <PrivateRequestSlot>{children}</PrivateRequestSlot>
+        <PrivateRequestSlot entryId={entryId}>{children}</PrivateRequestSlot>
       </Suspense>
     </AppShellChrome>
   )
 }
```

Mount this private slot under the public chrome and `Suspense` composition from the quick start.

For SDK-managed entries, the SDK starts baseline fetching or root prefetch alongside request
initialization. A request entry waits for its baseline and request's experience-and-variant choices
before resolving.
A request root waits for its prefetch and request handoff before merging the fetched entries once.
Both paths use the SDK's managed cache and in-flight deduplication. Do not add a duplicate await,
request cache, or performance option around these components. App-owned CDA fetches remain
app-owned work, so they do not receive this direct request/CDA overlap.

Both workflows require one concrete locale and enough `include` depth for the linked experience and
variant entries. All-locale CDA payloads can make those links look unresolved and fall back to the
baseline.

### Request context and the profile cookie

**Integration category:** Common but policy-dependent

Every `optimization.request` component uses one SDK-owned initializer for the active React Server
Component request. The initializer reads Next.js headers and cookies, requires the request URL
forwarded by the Optimization handler, and derives these values once:

- The **route key**, the current route identity used to prevent duplicate page tracking.
- The **initial page payload**, the page properties attached to the first page event.
- The **hydration mode**, the browser startup rule that preserves or hides server content.
- The **private-request handoff**, the experience-and-variant choices and startup data for this
  visitor's request.

The app does not read those inputs or coordinate layout and page awaits. Separate requests receive
separate initialization and handoff state.

Use the no-argument `createNextjsOptimizationContextHandler()` from the quick start for the default
forwarding-only path. It sanitizes SDK-owned forwarded context and supplies the request URL header;
the request family performs request evaluation. Keep the matcher narrow to the routes that use
Optimization request context.

Trusted response-capable request persistence is an advanced opt-in for routes whose proxy or
middleware must perform the page request and persist the SDK-owned anonymous ID cookie before Server
Components render. See
[Manual server and client escape hatches](#manual-server-and-client-escape-hatches).

The SDK-owned anonymous ID cookie is `ctfl-opt-aid`. It stores the identifier that connects browser
and server activity. A **profile** is the Experience API's current visitor ID, traits, audiences, and
session state; the cookie is not that full profile, selected state, or consent record. Your app owns
any consent cookie or account record that `consent.server` reads. Store the consent decision where
both server and browser code can read it; do not use the SDK anonymous ID cookie as your consent
record.

### Personalizing first paint on the server

**Integration category:** Required for first integration

Server Components render personalized first paint through `optimization.request.OptimizedEntry`. If
no experience applies, the API has no variant, or a linked variant cannot be resolved, the render
receives the baseline entry. When policy denies the selection-producing Experience API request, no
**selected optimizations** enter the request state. Selected optimizations are the
experience-and-variant choices returned by an accepted page, identify, or custom Experience event.
Resolution without a selection also returns the baseline.

`isEmptyVariant === true` marks the SDK renderer's no-content state. It differs from the fallback
cases above, which render the baseline entry. In the no-content state, the bound server
`OptimizedEntry` keeps its host and tracking attributes but does not invoke its render prop or emit
app content. The standalone `ServerOptimizedEntry`, imported from
`@contentful/optimization-nextjs/server`, is the lower-level renderer for server code that already
has a full resolver result and static children; it applies the same empty-content rule. An absent
empty-variant flag renders normally.

A resolved selected variant can use any Contentful content type. The request entry waits for the
same initialization as the request root, including when page work begins before its layout work. For
an SDK-managed source, baseline fetching starts alongside that initialization. Resolution remains
behind both the baseline and selected request state, so the entry never resolves against partial
request data.

A Contentful **entry skeleton** is a TypeScript type that names a content type ID and its fields.
Use one skeleton union, `S`, containing every possible baseline or variant content type. A bound
server `OptimizedEntry` with `baselineEntry` uses `<S, M, L>`, where `M` is the `contentful.js`
response-shape modifier carried by the entry type and `L` is the locale type. A managed ID or slug
source uses `<S, L>` because its response-shape modifier is fixed to `undefined`. When every variant
shares the baseline content type, omit the generic and let TypeScript infer that skeleton from
`baselineEntry`.

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

The request family reads the active Next.js request, so Next.js renders that subtree for each request
instead of reusing one public static result. Keep that visitor-specific output out of public shared
caches. For shareable static or public-permutation routes, use the advanced route strategies in
[Route-level SSR, browser takeover, and browser-owned islands](#route-level-ssr-browser-takeover-and-browser-owned-islands).

### The bound root and page events

**Integration category:** Required for first integration

Use `optimization.request.OptimizationRoot` at a private request route root. It gives the browser
provider the server snapshot and browser startup mode. In normal tracker mode, the request
`NextAppAutoPageTracker` also
learns whether the server accepted the initial page-view event: it skips a duplicate when the server
owns that event, then tracks later client navigations. The request family builds the route key and
page payload, so the app does not pass either one. Keep the tracker inside the Next.js-required
`Suspense` boundary; that boundary is a platform rendering requirement, not request-initialization
plumbing.

Keep request-independent public chrome outside both `Suspense` and the request root. Put the tracker,
provider-dependent shell body, and all other SDK-dependent UI inside the root. Use a meaningful
fallback for the private slot so the public navigation and page context remain available while it
loads. Keep Next.js `Link` prefetch enabled; the narrow handler matcher limits request-context work
to participating routes.

For the callback-enabled request-family composition from
[How the SDK fits your app](#how-the-sdk-fits-your-app), the injected
`ClientRequestOptimizationRoot` replaces the default browser root. It derives the current route key
and lazy page payload in the client through the SDK's non-emitting `useNextAppAutoPageInputs` hook.
The atomic setup above removes `RequestNextAppAutoPageTracker`; the injected root is the sole page
owner.

The root waits for the callback's returned work or watchdog, reads the latest route and lazy payload
builder, and then makes the direct page attempt described below. Only after that attempt finishes
does it start built-in route-change emission.

A **direct page attempt** means the root calls the page-event API itself once before automatic route
tracking starts. The root's **page emitter** is its built-in route-change logic, not a tracker
component you mount. After the direct attempt finishes, its initial `skip` mark records the attempted
route as handled without sending another event. A later route change makes the emitter send its
normal page event. If the page call returns `{ accepted: false }`, the SDK finished the call but did
not admit that page event locally; the sequence still advances without an immediate same-route
retry.

A callback throw, returned-work rejection, or watchdog expiry is reported to `onError` when you
supply it, and the root still attempts the page. The watchdog stops waiting but does not cancel the
callback or a request it already sent. Fire-and-forget work that the callback does not return can
finish after the page. The root reads the latest route immediately before the direct attempt;
navigation after that attempt begins is not canceled or reordered against it.

> [!NOTE]
>
> If callback and page work remain pending when an entry reaches its existing five-second fallback
> deadline, the entry can reveal baseline content. With live updates disabled, that first visible
> content stays frozen even if startup later selects a variant. Enable
> [Browser takeover and live updates](#browser-takeover-and-live-updates) only when a late
> replacement is intended.

Use `OptimizationEventDiagnostics`, defined below, for a development-only ordering check. Set the
example identity first with `localStorage.setItem('app-user-id', 'guide-user')`, reload the
callback-enabled route, and inspect `Contentful Optimization event accepted` and
`Contentful Optimization event blocked` messages. The identify and `client_ready` results must
appear, as accepted or blocked calls, before at most one initial browser `page` result. Follow a
normal Next.js `Link` once and confirm one later `page` result. An initial browser page before
callback completion or two initial page results usually means a request tracker is still mounted.
The diagnostic proves local SDK admission or blocking, not API delivery.

This composition changes only the server binder's request family. Top-level explicit,
static/public-permutation, and analytics roots do not consult the injected request root. The normal
no-callback request path keeps `RequestNextAppAutoPageTracker`. Direct Web and Node integrations keep
this ordering in application code by awaiting identity or custom-event work before calling their
existing page-event API.

Advanced explicit-input routes can pass an app-created handoff and browser startup mode to the
top-level `optimization.OptimizationRoot` or `optimization.OptimizationProvider`. The root can also
take an app-created route key and initial page payload. `initialPageEvent` is the handoff field that
tells a browser tracker to `skip` a server-owned first page event or `emit` a browser-owned one. See
[Manual server and client escape hatches](#manual-server-and-client-escape-hatches) before using
these inputs. Use `optimization.OptimizationAnalyticsRoot` for analytics-only handoffs.

If you pass `prefetchManagedEntries` without an explicit `handoff`, the App Router root creates
baseline `static` handoff behavior with `hydration: 'preserve-server'`, no selected optimizations,
and `initialPageEvent: 'emit'`. Use that path for baseline managed-entry warming, not
request-personalized state.

Mount one development-only observer inside the request root before validating events elsewhere in
this guide. The accepted stream holds the most recent accepted event as its current value, not an event
history. The blocked stream reports events rejected by consent or event policy.

The mounting diff below shows normal tracker mode. On a callback-enabled request root, mount the
diagnostic in the same position but keep `RequestNextAppAutoPageTracker` omitted.

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
   {/* Normal tracker mode only. Omit this component in callback mode. */}
   <RequestNextAppAutoPageTracker />
   {children}
 </RequestOptimizationRoot>
```

The observer mounts in the browser after the root publishes its live SDK. Its accepted stream is a
local signal that the browser SDK admitted an event; it does not prove that a server event ran or
that either API received an event. Use three separate checks:

- **Server render:** Use the quick-start View Source check to prove that the selected variant reached
  the raw server HTML.
- **Browser admission:** Trigger a tracked action and inspect the browser console for
  `Contentful Optimization event accepted` or `Contentful Optimization event blocked`.
- **Duplicate page prevention:** Clear the browser console and reload the route. Hydration must not
  log a browser `page` event when the server accepted the first page event. Follow a normal Next.js
  `Link` to another participating route and confirm one browser `page` event appears for that
  navigation.

To verify API delivery rather than local admission, inspect your server's outbound Experience API
telemetry for the initial request and your browser Network panel for browser-owned events. The
browser observer cannot see the completed server call.

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

For one observable live-update check, author an experience whose audience requires the trait
`plan = "pro"`. Give its variant distinctive **Pro** text and leave the baseline with distinctive
**Control** text. `HeroEntry` below is your app's existing single-locale Contentful entry type. The
request root owns the live browser SDK; this Client Component consumes that provider and opts this
entry into re-resolution.

**Adapt this to your use case:**

```tsx
// components/LiveHero.tsx
'use client'

import type { HeroEntry } from '@/lib/contentful'
import { OptimizedEntry, useOptimizationActions } from '@contentful/optimization-nextjs/client'

export function LiveHero({ baselineEntry }: { baselineEntry: HeroEntry }) {
  const { identifyUser, resetUser } = useOptimizationActions()

  return (
    <section>
      <OptimizedEntry baselineEntry={baselineEntry} liveUpdates>
        {(entry) => <output data-testid="live-hero-text">{String(entry.fields.headline)}</output>}
      </OptimizedEntry>
      <button
        onClick={() => void identifyUser({ userId: 'guide-pro-user', traits: { plan: 'pro' } })}
        type="button"
      >
        Identify as Pro
      </button>
      <button onClick={resetUser} type="button">
        Reset visitor
      </button>
    </section>
  )
}
```

Mount `LiveHero` under the existing `RequestOptimizationRoot`. Load the route as an anonymous
visitor and confirm **Control** appears. Click **Identify as Pro** and confirm the same output changes
to **Pro** without a reload. Click **Reset visitor** and confirm it returns to **Control**. These
changes belong to the browser runtime; the server-rendered first paint remains the request's locked
snapshot.

For a top-level explicit-input route, pass `hydration="client-only-hidden-until-ready"` to
`optimization.OptimizationRoot` or `optimization.OptimizationProvider`, or build that mode into the
handoff. For a nested private-request route, set this mode in the server binding's `request`
configuration. A fully browser-owned route instead uses the router-neutral `/client`
`OptimizationRoot` or `OptimizationProvider`.

Hidden-until-ready hydration is independent of the private-slot composition. Use it only when the
content itself must remain hidden until the browser runtime is ready; it is not needed to keep public
chrome outside a request boundary.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` emits view, click, and hover tracking from the resolved entry by default. Configure
global defaults with `trackEntryInteraction` in the binding config and use per-entry props for local
opt-outs. Interaction delivery still depends on event consent and profile continuity.

The binding-level object controls the three interaction kinds for every entry. `clickable` marks one
entry wrapper as a click target; `trackViews`, `trackClicks`, and `trackHovers` override the matching
setting for one entry.

**Adapt this to your use case:**

```diff
 // lib/optimization.ts - existing binding
 export const optimization = bindNextjsAppRouterServerOptimization({
   // Existing project, Contentful, and consent config.
+  trackEntryInteraction: { views: true, clicks: true, hovers: true },
 })

 // Existing entry renderer
-<RequestOptimizedEntry baselineEntry={hero}>
+<RequestOptimizedEntry baselineEntry={hero} clickable>
   {(entry) => <Hero entry={entry} />}
 </RequestOptimizedEntry>
```

Keep the development observer from [The bound root and page events](#the-bound-root-and-page-events)
mounted. Scroll the entry into view, hover over its wrapper, and click it. The browser console must
show locally accepted `component`, `component_hover`, and `component_click` event types, or a blocked
record that names the denied method. This check proves local browser admission, not API receipt.

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

`setConsent(true)` or `setConsent(false)` sets both event consent and persistence consent to the same
value. Use the object form, `setConsent({ events, persistence })`, when those two decisions differ.

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

Mount one app-owned control inside `RequestOptimizationRoot` so the browser action path updates the
same record that `consent.server` reads on the next request. This minimal example uses a
browser-readable cookie; replace `writeAppConsent` with your consent-management platform or server
endpoint when that system owns the record.

**Adapt this to your use case:**

```tsx
// components/OptimizationVisitorControls.tsx
'use client'

import {
  useConsentState,
  useOptimizationActions,
  useProfileState,
} from '@contentful/optimization-nextjs/client'

function writeAppConsent(value: 'accepted' | 'denied') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `app-consent=${value}; Path=/; SameSite=Lax; Max-Age=31536000${secure}`
}

export function OptimizationVisitorControls() {
  const consent = useConsentState()
  const profile = useProfileState()
  const { identifyUser, resetUser, setConsent } = useOptimizationActions()

  function accept() {
    writeAppConsent('accepted')
    setConsent(true)
  }

  function withdraw() {
    writeAppConsent('denied')
    setConsent(false)
    resetUser()
  }

  return (
    <section aria-label="Personalization controls">
      <output>Consent: {String(consent)}</output>
      <output>Visitor: {profile?.id ?? 'anonymous'}</output>
      <button onClick={accept} type="button">
        Allow personalization
      </button>
      <button
        onClick={() => void identifyUser({ userId: 'account-id', traits: { plan: 'pro' } })}
        type="button"
      >
        Identify signed-in visitor
      </button>
      <button onClick={resetUser} type="button">
        Reset Optimization visitor
      </button>
      <button onClick={withdraw} type="button">
        Withdraw consent and reset
      </button>
    </section>
  )
}
```

Your app owns the `app-consent` record, account mapping, and any consent-management cleanup. The SDK
owns its profile state, selected optimizations, local continuity, and `ctfl-opt-aid` cookie.
`setConsent(false)` clears SDK durable storage but leaves the active in-memory profile, so withdrawal
also calls `resetUser()`. Resetting alone preserves consent and does not erase your app's record.

## Optional integrations

Looking for the optional initial Experience path? Because it changes request-root and first-page
ownership, its atomic setup starts in [How the SDK fits your app](#how-the-sdk-fits-your-app), and
its behavior and verification continue in
[The bound root and page events](#the-bound-root-and-page-events).

### Analytics forwarding

**Integration category:** Optional

`onStatesReady` is the binding callback that receives the live browser SDK's observable state
surface before child auto-page effects run. `states.eventStream` exposes the most recent locally accepted
event and later accepted events; it is not a durable history. Each event's `messageId` is its unique
delivery identifier. The optional `event.optimization` field is stream-only attribution, and its
`resolvedEntry` is the Contentful entry selected for that interaction. Its `sys.id` is that selected
entry's ID, which the example passes downstream as `resolvedEntryId`.

The runtime event stream remains model-agnostic because it can carry interactions for entries of
every content type. If you read `event.optimization?.resolvedEntry`, narrow that entry with
`isEntryOfContentType` at the point of use; resolver-specific `S` types do not flow into a
later event.

The following seam gates forwarding on a separate app-owned analytics consent record, deduplicates
the current-value stream by `messageId`, unsubscribes on root teardown, and contains vendor failures.
Replace the cookie and endpoint with your analytics platform's policy and transport.

**Adapt this to your use case:**

```ts
// lib/optimization-event-forwarding.ts
import type { OnStatesReady } from '@contentful/optimization-nextjs/client'

function hasAnalyticsConsent() {
  return document.cookie.split('; ').includes('analytics-consent=accepted')
}

async function forwardToAnalytics(event: {
  messageId: string
  type: string
  resolvedEntryId?: string
}) {
  const response = await fetch('/api/analytics-events', {
    body: JSON.stringify(event),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Analytics forwarding failed: ${response.status}`)
}

export const forwardOptimizationEvents: OnStatesReady = (states) => {
  const forwardedMessageIds = new Set<string>()
  const subscription = states.eventStream.subscribe((event) => {
    if (!event || !hasAnalyticsConsent() || forwardedMessageIds.has(event.messageId)) return
    forwardedMessageIds.add(event.messageId)

    void forwardToAnalytics({
      messageId: event.messageId,
      type: event.type,
      resolvedEntryId: event.optimization?.resolvedEntry.sys.id,
    }).catch((error: unknown) => {
      console.warn('Optimization analytics forwarding failed', error)
    })
  })

  return () => {
    subscription.unsubscribe()
    forwardedMessageIds.clear()
  }
}
```

Add `onStatesReady: forwardOptimizationEvents` to the existing binding that owns the participating
browser root. Do not create a second binding or provider for forwarding. Keep
`states.blockedEventStream` for diagnostics; blocked calls are not events to replay.

**Adapt this to your use case:**

```diff
 // lib/optimization.ts - existing binding
+import { forwardOptimizationEvents } from './optimization-event-forwarding'

 export const optimization = bindNextjsAppRouterServerOptimization({
   // Existing project, Contentful, and consent config.
+  onStatesReady: forwardOptimizationEvents,
 })
```

For the full pattern, use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Merge tags and Custom Flags

**Integration category:** Optional

A **merge tag** is an SDK-authored embedded entry whose selector reads one value from the current
visitor profile and falls back to its authored fallback text. Your app owns the Rich Text renderer
and must extract the embedded target before asking the SDK to resolve it. The request-family
`OptimizedEntry` supplies `getMergeTagValue` as the second render-prop argument.

`ArticleEntry` below is your app's existing entry type.

**Adapt this to your use case:**

```tsx
// components/RichText.tsx
import { isMergeTagEntry, type MergeTagEntry } from '@contentful/optimization-nextjs/api-schemas'
import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import { INLINES, type Document } from '@contentful/rich-text-types'

type GetMergeTagValue = (entry: MergeTagEntry) => string | undefined

export function RichText({
  document,
  getMergeTagValue,
}: {
  document: Document
  getMergeTagValue: GetMergeTagValue
}) {
  return documentToReactComponents(document, {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node) => {
        const target: unknown = node.data.target
        return isMergeTagEntry(target) ? (getMergeTagValue(target) ?? '') : ''
      },
    },
  })
}
```

Pass the resolver from the request entry into that renderer.

**Adapt this to your use case:**

```tsx
// components/PersonalizedArticle.tsx
import { RichText } from '@/components/RichText'
import type { ArticleEntry } from '@/lib/contentful'
import { RequestOptimizedEntry } from '@/lib/optimization'

export function PersonalizedArticle({ article }: { article: ArticleEntry }) {
  return (
    <RequestOptimizedEntry baselineEntry={article}>
      {(entry, { getMergeTagValue }) => (
        <RichText document={entry.fields.body} getMergeTagValue={getMergeTagValue} />
      )}
    </RequestOptimizedEntry>
  )
}
```

In a Client Component that already sits under an Optimization provider,
`useMergeTagResolver()` supplies the same resolver without an entry render prop.

**Adapt this to your use case:**

```tsx
'use client'

import { useMergeTagResolver } from '@contentful/optimization-nextjs/client'
import type { Document } from '@contentful/rich-text-types'
import { RichText } from '@/components/RichText'

export function LiveRichText({ document }: { document: Document }) {
  const { getMergeTagValue } = useMergeTagResolver()
  return <RichText document={document} getMergeTagValue={getMergeTagValue} />
}
```

A **Custom Flag** is an authored name/value change rather than a replacement entry. The flag name is
chosen in your Contentful Personalization experience. The SDK's `states.flag(name)` observable emits
its current value immediately and later values after accepted profile or preview changes.

**Adapt this to your use case:**

```tsx
// components/CheckoutFlag.tsx
'use client'

import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect, useState } from 'react'

export function CheckoutFlag() {
  const { sdk } = useOptimizationContext()
  const [value, setValue] = useState<unknown>()

  useEffect(() => {
    if (!sdk) return
    const subscription = sdk.states.flag('checkout-banner').subscribe(setValue)
    return () => subscription.unsubscribe()
  }, [sdk])

  return <output data-testid="checkout-banner-flag">{String(value ?? 'unset')}</output>
}
```

Author `checkout-banner` with two distinguishable values, mount this component under the existing
request root, then change the matching visitor state or force a value in the preview panel. Confirm
the output changes. See [Contentful personalization authoring](https://www.contentful.com/developers/docs/personalization/)
and [Custom Flags authoring](https://www.contentful.com/help/personalization/experiences/custom-flags/).

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

The mounting diff below shows normal tracker mode. On a callback-enabled request root, add the panel
but keep `RequestNextAppAutoPageTracker` omitted.

**Adapt this to your use case:**

```diff
 // app/(request)/layout.tsx
+import { OptimizationPreviewPanel } from '@/components/OptimizationPreviewPanel'

 <RequestOptimizationRoot>
+  <OptimizationPreviewPanel />
   {/* Normal tracker mode only. Omit this component in callback mode. */}
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

For request-personalized routes, prefer a private-slot composition. Keep public navigation and other
request-independent chrome outside the request root and `Suspense`. Give the private slot a meaningful
fallback, then place the provider-dependent shell body and every SDK-dependent component inside the
request root. In a Next.js 15 or later app that uses Cache Components, put revalidation policy in the
cached component with `use cache`, `cacheLife()`, and `cacheTag()`. Call `connection()` inside the
private slot to keep that boundary on the request-time side of the composition. In Next.js 13 to 14,
omit the `connection()` import and call because that API is unavailable. The request family creates
its visitor-specific `private-request` handoff automatically; the app does not pass that cache scope
to the nested request root.

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
import { AppShellChrome, PersonalizedContentFallback } from '@/components/AppShell'
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
    <AppShellChrome>
      <CachedMarketingShell />
      <Suspense fallback={<PersonalizedContentFallback />}>
        <PrivateRequestSlot />
      </Suspense>
    </AppShellChrome>
  )
}
```

This private-slot example shows normal tracker mode. If the server binding injects
`ClientRequestOptimizationRoot`, remove `RequestNextAppAutoPageTracker` from both this import and the
JSX, as in the atomic callback setup.

**Follow this pattern:**

```tsx
// app/static-shell-private-slot/PrivateRequestSlot.tsx
import { AppShellBody } from '@/components/AppShell'
import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'
// Next.js 15+ with Cache Components. Omit this import on Next.js 13 to 14.
import { connection } from 'next/server'

export async function PrivateRequestSlot() {
  // Next.js 15+ with Cache Components. Omit this call on Next.js 13 to 14.
  await connection()

  return (
    <RequestOptimizationRoot>
      <RequestNextAppAutoPageTracker />
      <AppShellBody>
        <PersonalizedPrivateContent />
      </AppShellBody>
    </RequestOptimizationRoot>
  )
}
```

`AppShellChrome`, `AppShellBody`, `PersonalizedContentFallback`, `StaticMarketingShell`, and
`PersonalizedPrivateContent` are app-owned components in this pattern. `AppShellChrome` can contain
normal Next.js `Link` components with their default prefetch behavior. The
`static-marketing-shell` cache tag is app-owned. Cache Components do not use route-level
`export const revalidate`; put ISR-style revalidation on the cached component or data function
instead.

If your app is not using Cache Components, do not copy the partial private-slot seam above. Use the
complete
[SSG baseline with browser-owned personalization](./rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md#ssg-baseline-with-browser-owned-personalization)
recipe instead.

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

The response-capable handler is also an advanced opt-in. Configure
`createNextjsOptimizationContextHandler(...)` with a server SDK and consent resolver, then set
`request.trustedRequestHandoff: true` on the App Router binding. That pair allows the request family
to trust compact server context forwarded by the handler. Keep the no-argument forwarding-only
handler for ordinary request-family routes.

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

`private-request` handoffs include one visitor's request state and must not be stored in a shared
public cache. `public-permutation` handoffs are for app-owned segments, campaigns, markets, or other
choices that are safe to share. Their main inputs are:

- `selectedOptimizations`: The app-supplied list of experience-and-variant choices to render.
- `changes`: The app-supplied Custom Flag name/value changes to hydrate.
- `permutationKey`: An app-owned stable name for the public segment or campaign.
- `cacheVersion`: An optional app-owned version token that changes the generated cache identity when
  the rendered rules change.

Pass those values, plus the locale and rendered entry IDs, to
`createPublicPermutationHandoff()`. The helper serializes the supplied state and creates public
cache metadata; it does not discover a segment or derive selected optimizations from a route,
cookie, header, locale, or cache key. Because `changes` are handoff state rather than part of the
generated cache-key fingerprint, rotate `cacheVersion` when rendered Custom Flag values change.
`static` handoffs are for baseline or build-time output that does not depend on a request profile.
Do not create public or static handoffs from request-derived profile state.

Use the supplemental rendering guide for static generation, App Router Cache Components, Pages
Router ISR, Edge runtime, and analytics-only recipes. Use the handoff concept when reviewing
whether a route can be public, public-permutation, static, or private-request cached.

Within one React Server Component request, every `optimization.request` wrapper shares one
SDK-owned initialization. Managed entries use the SDK's managed cache and in-flight deduplication.
Their baseline fetch or root prefetch starts alongside request initialization. A request entry waits
for its baseline and selected request state before resolving; a request root waits for prefetch and
request state before merging the fetched entries into the handoff once. Separate requests remain
isolated. These responsibilities are different from caching rendered output. Do not add an app-owned
React request cache, request shell, duplicate layout/page await, or performance setting around the
request family.

Validate visitor isolation with two browser profiles whose consent or identity selects different
authored text. Use View Source in each profile and confirm profile A receives only variant A while
profile B receives only variant B. Reload both profiles and repeat the check. A value crossing
between profiles means visitor-specific HTML entered a shared output cache; it is not an SDK managed
entry-cache hit.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

When no Optimization event may emit before explicit consent, configure a strict event policy and
return `false` from `consent.server` until your app-owned consent record is accepted. In normal mode,
the request tracker receives first-page-event ownership from its handoff. In callback mode, mount no
request tracker; the root owns the direct attempt and later routes. For top-level explicit handoff
flows, use `initialPageEvent="skip"` only when a server or edge helper already accepted the same
route's first page event. Use blocked-event diagnostics to verify denied events are dropped at the
SDK boundary.

`allowedEventTypes` is the binding's pre-consent event allow-list. An empty list makes every event
require accepted event consent.

**Adapt this to your use case:**

```diff
 // lib/optimization.ts - existing binding
 export const optimization = bindNextjsAppRouterServerOptimization({
   // Existing project and Contentful config.
+  allowedEventTypes: [],
   consent: {
     server: ({ cookies }) => cookies.get('app-consent')?.value === 'accepted',
     clientDefaults: { consent: false, persistenceConsent: false },
   },
 })
```

Keep `OptimizationEventDiagnostics` before the selected page owner. In normal mode, that means
before `RequestNextAppAutoPageTracker`; in callback mode, the diagnostic stays inside the root and
no tracker is mounted. Clear the `app-consent` cookie, reload, and confirm the browser console reports
a blocked record whose `reason` is `consent` and whose `method` is `page`. Click
**Allow personalization** in the control shown earlier, then follow a normal Next.js `Link` to
another participating route. Confirm that the navigation produces one locally accepted `page`
event. In normal mode, the handoff tells the tracker to skip a server-owned duplicate. In callback
mode, the root's initial non-emitting mark prevents a same-route retry.

Consent withdrawal has separate owners: record denial in your app or consent-management platform,
call `setConsent(false)` to stop and clear SDK durable event storage, and call `resetUser()` to clear
the active SDK profile and selected optimizations. The SDK does not erase the app-owned consent or
account record.

## Production checks

- Confirm server and browser config use the intended Contentful space, environment, locale, and
  Optimization client ID.
- Confirm `consent.server`, browser consent defaults, and app-owned consent storage agree.
- Confirm `ctfl-opt-aid` is browser-readable where server and browser profile continuity is needed.
- Confirm locally accepted server and browser events arrive at the intended Experience or Insights
  API destination; the browser diagnostic alone is not delivery evidence.
- Confirm first-page ownership matches one mode. In normal mode, the request tracker skips a
  server-owned first event and emits later routes. In callback mode, no request tracker is mounted
  and the root's direct attempt plus built-in emitter do not duplicate the initial route.
- Confirm baseline fallback is acceptable when no variant applies or Contentful links are
  unresolved.
- Confirm request-personalized output is never stored in a public shared cache.
- Run your app's existing typecheck, lint, production build, and browser E2E scripts. Script names
  are app-owned; use the commands already declared in your app's `package.json`.
- Compare the result with the maintained App Router reference implementation's
  [local run instructions](../../implementations/nextjs-sdk_app-router/README.md#running-locally) and
  [E2E instructions](../../implementations/nextjs-sdk_app-router/README.md#running-e2e-tests).

The following commands run the reference implementation from this monorepo; they are not commands
to copy into an unrelated application.

**Reference excerpt:**

```sh
pnpm setup:e2e:nextjs-sdk_app_router
pnpm test:e2e:nextjs-sdk_app_router
```

## Troubleshooting

| Symptom                                                         | Likely cause                                                                                                             | Check                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entries stay on baseline                                        | No matching variant, no selections after a blocked Experience event, unresolved variant links, or all-locale CDA payload | Target all visitors for the first test, read accepted or blocked events, and fetch one locale with enough `include` depth                                                                                                                                      |
| A heterogeneous render cannot read content-type-specific fields | The skeleton union omits a possible content type, or the entry was not narrowed before rendering                         | Include every baseline and variant skeleton in `S`, then narrow with `isEntryOfContentType`                                                                                                                                                                    |
| Variant appears in the browser but not View Source              | The route is browser-owned rather than request-family or public-permutation rendered                                     | Use `optimization.request` for private request rendering, or use a top-level public permutation handoff before rendering                                                                                                                                       |
| Request components report a missing forwarded request URL       | The handler filename or export name does not match the Next.js version, or the handler is absent                         | Configure the SDK request handler; use `proxy.ts` with `proxy` on Next.js 16, or `middleware.ts` with `middleware` on Next.js 13 to 15                                                                                                                         |
| Duplicate first page events                                     | Normal mode has conflicting tracker ownership, or callback mode still mounts a request tracker                           | In normal mode, give the tracker the handoff's `initialPageEvent`; in callback mode, remove the request tracker and let the root own initial and later pages                                                                                                   |
| Live entries do not change after identify or reset              | The entry is locked to the handoff and live updates are off                                                              | Set `liveUpdates: true` on the App Router binding or use `/client` `LiveUpdatesProvider` for a browser subtree; for one entry, use router-neutral `/client` `OptimizedEntry liveUpdates` because bound App Router entries have no per-entry `liveUpdates` prop |
| Personalized HTML is cached for the wrong visitor               | Request handoff output entered a public cache                                                                            | Use `private-request` for request state and public permutation handoffs only for app-owned selected permutations                                                                                                                                               |

## Reference implementations to compare against

- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
- [Next.js SDK App Router Edge runtime reference implementation](../../implementations/nextjs-sdk_app-router_edge-runtime/README.md)
- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
