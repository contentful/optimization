# Integrating the Optimization Next.js SDK in a Next.js App Router app

Use this guide to add Contentful personalization to a Next.js App Router site you already have. By
the end of the quick start, one piece of content will be personalized per visitor in the
server-rendered HTML — no flash of default content, no rewrite of how your app fetches or renders.

**New to personalization?** Here is the whole idea in four sentences:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- When a page is requested, Contentful's **Experience API** looks at the current visitor and picks
  the variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- Your app already fetches Contentful entries and turns them into components. The SDK's only job is
  to sit at that hand-off and give you the resolved variant instead of the original — or the
  original entry when no variant applies, which is the **baseline fallback**.
- You render whatever the SDK hands back exactly as you render entries today.

That is enough to start. You do not need to understand audiences, traffic allocation, or events yet;
this guide introduces each idea at the point you need it.

You will get there in two milestones:

- **Milestone 1 — personalized first paint (the quick start below).** A visitor sees their variant
  in the server HTML. This is complete and shippable on its own.
- **Milestone 2 — browser takeover (opt-in, later).** Content re-personalizes live when consent,
  identity, or profile changes, without a page reload. See
  [Browser takeover and live updates](#browser-takeover-and-live-updates).

This guide uses `@contentful/optimization-nextjs`. The `/app-router` factory gives you app-local
components that do the right thing in both Server and Client Components. Your app keeps ownership of
Contentful fetching, consent policy, identity, routing, caching, and rendering.

If your app uses the Pages Router, use the
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
instead.

## Quick start

Most App Router + Contentful sites share one shape: you fetch a **page** entry, and render its
sections through a renderer that maps each section's content type to a component. This quick start
assumes that shape and shows the changes as **diffs against your existing files** — you are adding a
few lines, not replacing your app. The diffs are illustrative, not literal patches: find the
equivalent lines in your own files rather than expecting them to apply cleanly. If your app is
shaped differently (a flat list of entries, or one entry per route), the wrap is the same; see
[Personalizing first paint on the server](#personalizing-first-paint-on-the-server).

It proves one result: **one section renders its personalized variant in the server HTML.** It
assumes your app may personalize on startup. If personalization must wait for consent, keep this
structure and add the [Consent, identity, profile, and reset](#consent-identity-profile-and-reset)
step before you ship.

1. Install the adapter package.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs
   ```

2. Create one module that binds the SDK to your config. You do this once and import from it
   everywhere. Put it at a path your app's import alias understands (for example `src/lib/`), and
   use the same environment-variable convention your app already uses for Contentful.

   **Adapt this to your use case:** replace the placeholder values and the import path; the config
   keys are explained in [How the SDK fits your app](#how-the-sdk-fits-your-app).

   ```ts
   // src/lib/optimization.ts
   import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'

   export const APP_LOCALE = 'en-US'

   export const { proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizedEntry } =
     createNextjsAppRouterOptimization({
       clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
       environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
       locale: APP_LOCALE,
       // consent: allowed to personalize and send events for this visitor.
       // persistenceConsent: allowed to store a profile-id cookie so results stay consistent.
       defaults: { consent: true, persistenceConsent: true },
       server: {
         enabled: true, // resolve variants on the server, for first paint
         consent: { events: true, persistence: true },
       },
       app: { name: 'my-next-app', version: '1.0.0' },
     })
   ```

3. Add the request handler so the SDK runs before your pages render. Next.js executes this file on
   every matching request; the SDK's `proxy` reads the visitor's cookies, asks the Experience API
   who they are, and stores that identity (an anonymous **profile** id) in the `ctfl-opt-aid` cookie
   so the same visitor gets consistent variants next time. You are only mounting it — not writing
   that logic.

   **Copy this:**

   ```ts
   // proxy.ts — at your Next.js app root (use middleware.ts on Next.js versions that still use it)
   export { proxy } from './src/lib/optimization'

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
   }
   ```

4. Wrap your layout in `OptimizationRoot`, and drop the page tracker inside it. **Keep everything
   your layout already renders** — header, footer, providers, fonts, styles. You are adding a
   wrapper, not replacing the file. Put the root around your whole app (chrome included) so that
   header, footer, or announcement content can be personalized later too.

   **Adapt this to your use case:** the diff shows the additions against a typical layout; place the
   root to enclose everything you render inside `<body>`.

   ```tsx
   // app/layout.tsx
   +import { NextAppAutoPageTracker, OptimizationRoot } from '@/src/lib/optimization'
   +import { Suspense } from 'react'

    export default async function RootLayout({ children }: { children: React.ReactNode }) {
      const settings = await getSiteSettings() // your existing code stays
      return (
        <html lang="en">
          <body>
   +        <OptimizationRoot>
   +          {/* "skip": the server already reported this page view — don't report it twice. */}
   +          <Suspense>
   +            <NextAppAutoPageTracker initialPageEvent="skip" />
   +          </Suspense>
              <Header settings={settings} />
              {children}
              <Footer settings={settings} />
   +        </OptimizationRoot>
          </body>
        </html>
      )
    }
   ```

5. Find the one place your app turns a Contentful entry into a component — for a sectioned site,
   that is the `.map` inside your section renderer — and wrap it in `OptimizedEntry`. This single
   change is the whole integration: keep your fetch and your components as they are.

   **Adapt this to your use case:** wrap the return line inside your existing renderer; keep your
   null-handling exactly as it is.

   ```tsx
   // components/SectionRenderer.tsx
   +import { OptimizedEntry } from '@/src/lib/optimization'
   // SectionEntry is your existing section type — the union your components already accept.

    export function SectionRenderer({ sections }) {
      return sections?.map((entry) => {
        const Component = entry ? sectionMap[entry.sys.contentType.sys.id] : undefined
        if (!entry || !Component) return null // your existing guard stays
   -    return <Component key={entry.sys.id} entry={entry} />
   +    return (
   +      <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
   +        {/* Render prop hands back a base `Entry`; cast to your section type.
   +            If your type is narrowed (e.g. withoutUnresolvableLinks), use `as unknown as SectionEntry`. */}
   +        {(resolved) => <Component entry={resolved as SectionEntry} />}
   +      </OptimizedEntry>
   +    )
      })
    }
   ```

6. Verify the one result. In Contentful, author a variant on a section that appears on your home
   page and attach it to an experience — for a first test, target **all visitors** so you match it
   automatically. Load the page, **View Source** (or disable JavaScript), and search the raw HTML
   for the variant's text. It must be present in the server HTML and stay on screen after the page
   hydrates. If you see the original content instead, work through
   [Troubleshooting](#troubleshooting).

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

- **A Next.js App Router app** with React and React DOM installed, and its own Contentful fetching
  already working.
- **Contentful delivery credentials** — space ID, delivery token, and environment.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant the integration still runs, but every visitor sees the baseline, so you cannot
  tell personalization from a bug. For your first test, an experience that targets all visitors is
  the easiest to verify because you match it automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The Experience and Insights API base URLs default correctly; you only set them for mocks
  or non-default hosts (see [How the SDK fits your app](#how-the-sdk-fits-your-app)).

You do not need a setup inventory up front. Everything else — the request handler, the root, entry
wrapping, consent, tracking — is introduced by the section that needs it.

> [!NOTE]
>
> This guide uses `NEXT_PUBLIC_`-prefixed environment variables because Next.js only exposes
> variables with that prefix to browser code. Use whatever prefix your app already uses for its
> other browser-visible Contentful variables, and keep it consistent.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

The Next.js adapter is a thin layer between three things you already have or control: your
Contentful data, Contentful's Experience API, and your React components. You configure it once, and
it hands you components that behave correctly on the server and in the browser.

The only import path you need to start is `/app-router`. It resolves automatically: in a Server
Component the returned components render personalized HTML on the server; in a Client Component the
same imports use the browser runtime. You reach for the other subpaths only later.

| Import path                                   | Use it for                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router`  | The factory returning your bound `OptimizationRoot`, `OptimizedEntry`, tracker, and `proxy` |
| `@contentful/optimization-nextjs/client`      | Browser-only hooks and per-entry live-update controls, inside `'use client'` components     |
| `@contentful/optimization-nextjs/server`      | Manual server SDK control, for advanced routes only                                         |
| `@contentful/optimization-nextjs/api-schemas` | Type guards such as `isMergeTagEntry` and `isResolvedContentfulEntry`                       |

The config you pass to `createNextjsAppRouterOptimization()` breaks down like this:

1. `clientId` and `environment` identify your Optimization project. Read them from browser-safe env
   variables.
2. `locale` is the one locale the SDK uses for Experience and event context. Use the same locale you
   pass to Contentful.
3. `api` overrides the Experience and Insights endpoints. Set these only for a mock, a proxy, or
   non-default hosts; omit them otherwise.
4. `defaults` is the browser SDK's starting state: `consent` (may personalize and send events) and
   `persistenceConsent` (may store the profile-id cookie).
5. `server.enabled: true` turns on server-side first paint. `server.consent` decides, per request,
   whether the server may personalize; return `false` to fall back to baseline.
6. `app` is your app's name and version, sent as metadata.

**Adapt this to your use case:** a config with a real, per-request consent check instead of
always-on startup.

```ts
// src/lib/optimization.ts
import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'

export const APP_LOCALE = 'en-US'

const CONSENT_COOKIE = 'app-personalization-consent'

export const { proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsAppRouterOptimization({
    clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
    environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
    locale: APP_LOCALE,
    defaults: { consent: false, persistenceConsent: false },
    server: {
      enabled: true,
      // Personalize only when your app has recorded consent for this visitor.
      consent: ({ cookies }) =>
        cookies.get(CONSENT_COOKIE)?.value === 'granted'
          ? { events: true, persistence: true }
          : false,
    },
    app: { name: 'my-next-app', version: '1.0.0' },
  })
```

Create these bound components exactly once. The bound server path caches its request data within a
single render pass, so the root and every `OptimizedEntry` in that request share one profile and one
set of decisions.

### Fetching Contentful entries

**Integration category:** Required for first integration

The SDK does not fetch Contentful for you. This is the boundary: **you fetch, the SDK resolves.**
Keep your existing client and fetchers; the SDK only needs entries to arrive in a shape it can
resolve.

1. Fetch with one concrete Contentful locale. Do not use `withAllLocales` or raw CDA `locale=*` —
   all-locale payloads use locale-keyed field maps the resolver cannot read, so entries fall back to
   baseline.
2. Use an `include` depth deep enough to resolve the whole tree — the page, its sections, and the
   linked variant entries. `include: 10` is the common setting and is what most section-composed
   sites already use.
3. If you use `.withoutUnresolvableLinks` (common for deeply-linked pages), keep it; it does not
   interfere with variant resolution as long as the variant entries are published and within your
   include depth.
4. Use the same locale for Contentful and for the SDK when localized Experience responses and
   rendered content must line up.

Your existing fetch usually needs **no change** — most section-composed sites already fetch a page
by slug with a generous include depth and a single locale. A single-locale entry exposes its
optimization fields directly, such as `fields.nt_experiences` and `fields.nt_variants` (the `nt_`
prefix is how personalization links appear on an entry).

For the resolver contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Request context and the profile cookie

**Integration category:** Common but policy-dependent

Server-side personalization must know _who_ the visitor is before your page renders. That is what
the request handler from quick-start step 3 does. On each matching request it reads the visitor's
cookies, calls the Experience API, and — when persistence consent allows — writes the returned
profile id to the `ctfl-opt-aid` cookie so the same visitor stays consistent on later requests.

1. Re-export `proxy` from `proxy.ts` (or `middleware.ts` on older Next.js versions) at your app root
   and declare the `matcher` so it runs on routes that use server personalization.
2. Keep consent, locale, and profile policy in your `optimization.ts` factory, not here. This file
   only mounts the handler.
3. Do not mark `ctfl-opt-aid` as `HttpOnly` — the browser SDK must read it to keep the same profile
   after takeover.

**Copy this:**

```ts
// proxy.ts
export { proxy } from './src/lib/optimization'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

For how server and browser stay on the same profile, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

### Personalizing first paint on the server

**Integration category:** Required for first integration

This is where personalization actually happens. In a Server Component, `OptimizedEntry` resolves the
entry against the request's decisions and renders the variant — or the baseline entry — straight
into the HTML. No JavaScript is required for the visitor to see personalized content.

The rule never changes: **wherever a Contentful entry becomes a component, wrap it in
`OptimizedEntry` and render whatever the render prop hands back.** Two facts hold everywhere:

- The render prop's first argument is the resolved entry, typed as a base `contentful` `Entry`. If
  your component expects a narrower type, cast it — `resolved as YourSectionType`. This mirrors the
  reference implementation, which casts the render-prop entry to its own content type. When your
  type is narrowed with a chain modifier (for example the `WITHOUT_UNRESOLVABLE_LINKS` type from
  `.withoutUnresolvableLinks`), TypeScript may reject the direct cast; use
  `resolved as unknown as YourSectionType` in that case.
- When consent is denied, no variant applies, links are unresolved, or the payload was all-locale,
  the render prop simply receives the baseline entry. Your UI never breaks; it falls back to default
  content.

How the wrap looks depends on your app's shape.

#### A page composed of sections (most marketing sites)

Your page fetches a `page` entry and walks `fields.sections` through a renderer that maps each
section's content-type id to a component. That renderer is the single hand-off point — wrap there
once and every section on every page becomes personalizable.

**Adapt this to your use case:** wrap only the return line, keeping your null-handling and types.

```tsx
// components/SectionRenderer.tsx — your existing renderer, with the wrap added
import { OptimizedEntry } from '@/src/lib/optimization'
import { sectionMap } from './sectionMap'
import type { SectionEntry } from '@/src/lib/content-model'

export function SectionRenderer({ sections }: { sections?: (SectionEntry | undefined)[] }) {
  if (!sections?.length) return null
  return (
    <>
      {sections.map((entry) => {
        const Component = entry ? sectionMap[entry.sys.contentType.sys.id] : undefined
        if (!entry || !Component) return null
        return (
          <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
            {/* resolved is a base Entry; cast to the section union your components expect. */}
            {(resolved) => <Component entry={resolved as SectionEntry} />}
          </OptimizedEntry>
        )
      })}
    </>
  )
}
```

#### A flat list, or one entry per route

If a route fetches entries directly and renders them without a section registry, wrap each entry
where you render it. The wrap and the cast are identical.

**Adapt this to your use case:**

```tsx
// app/page.tsx
import { OptimizedEntry } from '@/src/lib/optimization'

export default async function Home() {
  const entries = await getHomeEntries() // your existing fetch, unchanged

  return entries.map((entry) => (
    <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
      {(resolved) => <YourCard entry={resolved as YourEntryType} />}
    </OptimizedEntry>
  ))
}
```

The default App Router path needs no manual `resolveOptimizedEntry()` call and no custom takeover
boundary. Reach for those only in [advanced routes](#manual-server-and-client-escape-hatches).

### The bound root and page events

**Integration category:** Required for first integration

`OptimizationRoot` is the provider that carries personalization state through your tree and hands
the server's decisions to the browser. `NextAppAutoPageTracker` reports **page events** — a signal
that a page was viewed — as the visitor navigates.

1. Mount `OptimizationRoot` once, around the subtree that shares personalization state — usually the
   whole app, inside your existing root layout.
2. Configure behavior (`defaults`, `trackEntryInteraction`, `onStatesReady`, `liveUpdates`) in the
   factory, not as per-render props on the root.
3. Wrap `NextAppAutoPageTracker` in `Suspense` because it reads App Router navigation hooks.
4. Choose one owner for the first page event. When the server personalized the page it already
   reported that view, so pass `initialPageEvent="skip"` to stop the browser reporting a duplicate.
   Use `"emit"` for browser-owned routes that did not use the server path. If startup is
   consent-gated, make it conditional — `skip` when the server owned a consented event, `emit`
   otherwise.

**Adapt this to your use case:** attaching route-aware properties to page events.

```tsx
<Suspense>
  <NextAppAutoPageTracker
    initialPageEvent="skip" // skip only when the server owns this route's first page event
    getPagePayload={({ pathname }) => ({
      properties: { routeGroup: pathname.startsWith('/account') ? 'account' : 'public' },
    })}
  />
</Suspense>
```

The tracker deduplicates consecutive route keys, including React Strict Mode's double effects, but
it does not replace your page-event policy. Use `skip` only when there is a matching server page
event.

### Browser takeover and live updates

**Integration category:** Required for first integration

This is Milestone 2. First paint is already complete and shippable; add this only when some content
must re-personalize _after_ the page loads — for example, when a visitor accepts consent, signs in,
or is identified, and entries should update without a reload.

Live updates are opt-in because most content is fixed for the life of a request. Turn them on where
they matter:

1. For a broad default, set `liveUpdates: true` in the factory, or wrap a subtree in
   `LiveUpdatesProvider`.
2. For a single client-only entry, import `OptimizedEntry` from `/client` and pass `liveUpdates`.
   The bound `/app-router` `OptimizedEntry` deliberately omits per-entry `liveUpdates` and
   `loadingFallback` props so the same import type-checks in both Server and Client Components.
3. Use `/client` hooks such as `useOptimizedEntry()` only when you need rendering control the
   wrapper does not offer.

**Adapt this to your use case:** a client-only entry that re-resolves on profile changes.

```tsx
'use client'

import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { Entry } from 'contentful'

export function LiveEntry({ baselineEntry }: { baselineEntry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry} liveUpdates>
      {(resolved) => <article>{String(resolved.fields.title ?? '')}</article>}
    </OptimizedEntry>
  )
}
```

To verify takeover, enable live updates, then trigger `identifyUser()`, `setConsent()`, or
`resetUser()` from a Client Component (see the next sections). Confirm that live entries re-resolve
without a full reload and that entries with `liveUpdates={false}` stay put until the next render.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Interaction tracking — views, clicks, and hovers on entries — is a browser behavior.
`OptimizedEntry` renders the metadata the browser SDK needs, and the SDK observes interactions once
consent permits. It is on by default when you use `OptimizedEntry`, so you rarely configure anything
to get started.

1. Leave the defaults on when your consent policy allows them. Use factory `trackEntryInteraction`
   only to opt out of an interaction type you must not observe.
2. Use `OptimizedEntry` props such as `clickable`, `trackViews`, `trackClicks`, and `trackHovers`
   for per-entry control.
3. Page events can be allowed before full consent, but entry views, clicks, and hovers stay blocked
   until consent or `allowedEventTypes` permits them.

**Follow this pattern:** opting out of one detector globally.

```tsx
createNextjsAppRouterOptimization({
  // ...clientId, environment, locale, server, defaults
  trackEntryInteraction: { hovers: false }, // opt out only where policy requires it
})
```

Tracking uses the _resolved_ entry id, not the baseline id. For mechanics, see
[Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Consent, identity, and profile continuity are your application's decisions. The SDK gives you the
runtime controls; your app owns the consent record, the privacy notice, the CMP, the identity
source, and cookie cleanup.

1. If policy permits accepted startup, set accepted `server.consent` and seed accepted consent in
   browser `defaults`.
2. If policy depends on user choice, read the choice in `server.consent` and call `setConsent()`
   from the Client Component that owns the decision.
3. Store the decision where `server.consent` can read it next request — the same CMP, account
   preference, or cookie.
4. Call `identifyUser()` when a visitor becomes known, and `resetUser()` (plus clearing your own
   profile cookies) on sign-out or withdrawal.

**Adapt this to your use case:** a client control panel wired to the SDK actions.

```tsx
'use client'

import {
  useConsentState,
  useOptimizationActions,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

const CONSENT_COOKIE = 'app-personalization-consent'

function persistConsent(consented: boolean): void {
  // Store where server.consent can read it on the next request.
  document.cookie = `${CONSENT_COOKIE}=${consented ? 'granted' : 'denied'}; Path=/; SameSite=Lax`
}

export function PersonalizationControls() {
  const { setConsent, identifyUser, resetUser } = useOptimizationActions()
  const consent = useConsentState()
  const profile = useProfileState()
  const isIdentified = Boolean(profile?.traits.identified)

  useEffect(() => {
    if (typeof consent === 'boolean') persistConsent(consent)
  }, [consent])

  return (
    <div>
      <button onClick={() => setConsent(consent !== true)} type="button">
        {consent === true ? 'Reject consent' : 'Accept consent'}
      </button>
      {isIdentified ? (
        <button onClick={() => resetUser()} type="button">
          Reset profile
        </button>
      ) : (
        <button
          onClick={() => void identifyUser({ userId: 'user-123', traits: { identified: true } })}
          type="button"
        >
          Identify
        </button>
      )}
    </div>
  )
}
```

With live updates enabled, `identifyUser()`, `setConsent()`, and `resetUser()` can change the
selected variants in the browser and re-render affected entries without a reload. For consent
design, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

## Optional integrations

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app needs to send approved Optimization context to a tag manager,
customer-data platform, warehouse, or analytics destination. The SDK still sends its own events to
Contentful; forwarding is application-owned.

1. Keep server and browser forwarding separate. Server-rendered attribution comes from the request
   that resolved the entry; browser activity comes from browser state subscriptions.
2. Register browser subscriptions with factory `onStatesReady` so observers attach before child
   effects such as route trackers emit events.
3. Dedupe forwarded events by `messageId` or a destination-specific key.
4. Store forwarded message ids in module or app state so remounts do not forward the same event
   again. To receive only future events, read the current `messageId` before subscribing and skip
   it.
5. Gate forwarding with the same consent and destination policy that governs the rest of your
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

See
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local server mapping, subscription helpers, vendor examples, consent, dedupe, and
governance guidance.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags and Custom Flags when entries or components render profile-backed values that are not
entry replacements.

1. Resolve Rich Text merge tag entries with the `getMergeTagValue` function passed to the
   `OptimizedEntry` render prop.
2. Keep the SDK locale aligned with the rendered Contentful locale when merge tags reference
   localized profile fields such as `location.city` or `location.country`.
3. Use flag state from the browser SDK for components that must react after browser startup.
4. Treat flag-view and merge-tag events as consent-gated browser activity unless the server path
   owns the event.

**Follow this pattern:**

```tsx
import { OptimizedEntry } from '@/src/lib/optimization'
import type { Entry } from 'contentful'

export function EntryWithMergeTags({ entry }: { entry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolved, { getMergeTagValue }) => (
        <span>{getMergeTagValue(resolved.fields.greeting) ?? ''}</span>
      )}
    </OptimizedEntry>
  )
}
```

Merge tags and entry replacement use different mechanics. Entry replacement swaps the whole entry
for its variant; merge tags read profile-backed values from current SDK state. Use
`useMergeTagResolver()` from `/client` only in Client Components that need merge tags outside an
`OptimizedEntry` render prop.

### Preview panel

**Integration category:** Optional

Use the preview panel where authors or engineers need to inspect variant behavior — including
forcing a specific variant to verify a targeted experience. Keep production loading explicit and
gate attachment behind an application-owned flag.

1. Add the preview panel package only when your app needs browser authoring tooling.
2. Attach the panel from a Client Component under `OptimizationRoot`.
3. Wait until the browser SDK is ready before attaching.
4. Pass an app-owned Contentful client or pre-fetched preview entries to the attach function.
5. Enable it only when an approved environment sets `NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`
   to `true`.
6. Verify with live updates, because the preview panel forces optimized entries to react to preview
   state.

**Follow this pattern:**

```tsx
'use client'

import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

export function PreviewPanelAttachment({ nonce }: { nonce?: string }) {
  const { isReady } = useOptimizationContext()
  const enabled = process.env.NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

  useEffect(() => {
    if (!enabled || !isReady) return // keep authoring tooling opt-in and post-ready

    void Promise.all([
      import('@contentful/optimization-web-preview-panel'),
      import('@/src/lib/contentful'),
    ])
      .then(async ([{ default: attachOptimizationPreviewPanel }, { client }]) => {
        await attachOptimizationPreviewPanel({ contentful: client, nonce })
      })
      .catch(() => undefined)
  }, [isReady, nonce, enabled])

  return null
}
```

A dynamic import only loads the attach function; your app must call
`attachOptimizationPreviewPanel(...)` with a Contentful client, or with
`entries: { audiences, experiences }` when you already loaded the preview definitions. `entries`
takes precedence over `contentful`.

## Advanced integrations

### Route-level SSR, browser takeover, and browser-owned islands

**Integration category:** Advanced or production-only

App Router apps can mix strategies. Choose one per route instead of forcing a single model across
the whole app.

| Route need                                                  | Use this pattern                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Server is the only content source until the next request    | Bound server `OptimizedEntry`, browser live updates off                      |
| Server first render plus browser-side reactivity            | Bound root handoff plus app-local or `/client` `OptimizedEntry`              |
| Browser-owned personalization after startup                 | Render baseline or loading UI on the server and let Client Components own it |
| Highly interactive account, dashboard, or settings surfaces | Client Components with live updates and explicit consent state               |

1. Keep SEO-sensitive content in Server Components so it appears in the initial HTML.
2. Use Client Components for controls that call hooks, `identifyUser()`, `setConsent()`,
   `resetUser()`, live flag state, or manual tracking.
3. Reuse the same `OptimizationRoot` for takeover subtrees that share browser state.
4. Reuse the same Contentful locale and anonymous-id continuity across strategies.

The boundary that matters is ownership: Server Components render through the bound server
`OptimizedEntry`; Client Components render through the app-local or `/client` `OptimizedEntry` when
they need browser-only props.

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use manual helpers only when the bound App Router factory cannot express a route's needs.

1. Use `createNextjsOptimization()` and `getNextjsServerOptimizationData()` from `/server` for
   direct request SDK control, custom server page payloads, or app-owned request deduplication.
2. Pass `serverOptimizationState` to a `/client` `OptimizationRoot` or `OptimizationProvider` only
   in manual server/client setups.
3. Use `getServerTrackingAttributes()` only with manual `resolveOptimizedEntry()` results.
4. Keep a custom takeover boundary only for staged-reveal behavior the bound split does not cover.

### Caching and request deduplication

**Integration category:** Advanced or production-only

Personalized server rendering is request-specific. Keep shared caches on raw Contentful payloads,
not on profile-evaluated results or personalized HTML, unless your cache key varies on every
personalization input.

1. Let the bound factory's internal `cache()` deduplicate request data within one render pass.
2. Create the bound components once. Multiple factories create multiple server page calls.
3. Do not share server Optimization data across requests; it is profile-specific.
4. Cache raw Contentful entries by entry id, locale, environment, and include depth when your policy
   permits.
5. Mark personalized routes dynamic unless your deployment varies the cache on the full profile
   state.

**Copy this:**

```ts
// app/layout.tsx or app/page.tsx
export const dynamic = 'force-dynamic'
```

The exact Next.js cache policy is yours. The SDK does not mark routes dynamic for you.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

Strict consent and duplicate-event controls are production policy work. Configure them only after
your privacy, analytics, and platform owners agree on the event posture.

1. Use `allowedEventTypes: []` when no SDK events can emit before consent.
2. Return `false` from `server.consent` while consent is unknown or denied.
3. Clear `ctfl-opt-aid` and your own consent or profile cookies when withdrawal must end profile
   continuity.
4. Use `initialPageEvent="skip"` only for a matching server page event; use `emit` when the browser
   owns the first page view.
5. Subscribe to `states.blockedEventStream` during validation to confirm the SDK blocks what your
   policy expects.

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

- Confirm the factory uses the intended client id, environment, API endpoints, locale, app metadata,
  and log level.
- Confirm browser-exposed environment variables contain only values safe to ship to the client.
- Confirm Contentful fetches use one concrete locale and include resolved optimization entries and
  variants.
- Confirm `server.consent`, browser consent, anonymous-id persistence, and CMP or account state stay
  aligned across first load, navigation, opt-in, opt-out, sign-in, sign-out, and reset.
- Confirm the server path owns the initial page event and `NextAppAutoPageTracker` does not
  duplicate it.
- Confirm `identifyUser()`, `setConsent()`, and `resetUser()` re-resolve only the entries configured
  for live updates.
- Confirm entry views, clicks, hovers, flag views, page events, business events, and forwarded
  analytics events deliver only when policy permits them.
- Confirm baseline fallback renders when the Experience API fails, variants are missing, links are
  unresolved, or CDA payloads are all-locale.
- Confirm personalized routes are not shared-cache safe unless the cache varies on every
  personalization input.
- Confirm end-to-end evidence for server-to-browser handoff, request context, entry tracking, live
  updates, and page events using the reference implementation flow.

**Copy this:**

```sh
pnpm implementation:run -- nextjs-sdk_app-router typecheck
pnpm implementation:run -- nextjs-sdk_app-router lint
pnpm test:e2e:nextjs-sdk_app-router
```

## Troubleshooting

| Symptom                                                            | Likely cause                                                                            | Check                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Entries stay on baseline                                           | No variant applies, denied consent, unresolved Contentful links, or all-locale CDA      | Author a variant that targets you, check `server.consent`, fetch one `locale` with enough `include`                |
| The variant never appears even though it is authored               | Your test visitor does not match the experience's audience                              | Target all visitors for a first test, or force the variant with the preview panel                                  |
| `<Component entry={resolved} />` shows a type error                | The render prop returns a base `Entry`, wider than your component's type                | Cast it: `resolved as YourSectionType`; if the type is modifier-narrowed, `resolved as unknown as YourSectionType` |
| Two server-side page events appear for one request                 | Multiple bound factories, or a manual helper also calls the server page path            | Create bound components once and keep manual `getNextjsServerOptimizationData()` out of the route                  |
| Browser sends a duplicate first page event                         | `initialPageEvent="emit"` used after the server path already emitted the same route     | Use `skip` only when the server path owns the same initial request                                                 |
| Browser does not send the first page event                         | `initialPageEvent="skip"` used on a browser-owned route without a matching server event | Use `emit` when the browser owns first page tracking                                                               |
| Live entries do not update after `identifyUser()` or `resetUser()` | `liveUpdates` is off in the factory and provider                                        | Set `liveUpdates: true` in the factory or wrap the subtree in `LiveUpdatesProvider`                                |
| Entry views, clicks, or hovers do not emit                         | Interaction tracking is opted out, consent blocks the event, or no profile is available | Check factory `trackEntryInteraction`, entry props, consent state, and `states.blockedEventStream`                 |
| Server and browser use different profiles                          | Cookie domain, path, readability, or consent cleanup differs between runtimes           | Use a browser-readable `ctfl-opt-aid` with a consistent path and clear it on withdrawal                            |
| Server Components fail with browser globals                        | A Client Component hook or browser-only import crossed into a server module             | Use bound imports in Server Components and `/client` hooks only in Client Components                               |
| Personalized HTML appears stale                                    | Route or CDN caching is sharing profile-evaluated output                                | Mark personalized routes dynamic or vary cache keys on the full personalization context                            |

## Reference implementations to compare against

- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md):
  Working App Router application using app-local bound components for server first paint,
  server-to-browser state handoff, client takeover, live updates, consent controls, page events,
  entry interaction tracking, preview attachment, and Playwright E2E coverage.
- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md):
  Pages Router equivalent using `getServerSideProps` state handoff.
