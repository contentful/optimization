# Integrating the Optimization Next.js SDK in a Next.js App Router app

Use this guide to render Contentful entries with personalized server first paint in a Next.js App
Router app, then let the browser continue from the same Optimization handoff.

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

This guide uses `@contentful/optimization-nextjs/app-router`. The adapter binds app-local
configured components and handoff helpers; your app still owns Contentful fetching, consent policy,
cache keys, and where personalized output is cached. If you use the Pages Router, use the
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
instead.

## Quick start

This quick start assumes an App Router route already fetches a Contentful entry and renders it with
your own component. The proof is one entry whose variant appears in View Source and stays stable
after hydration. Consent is granted on the server and browser only to prove the wiring; replace it
in [Consent, identity, profile, and reset](#consent-identity-profile-and-reset).

1. Install the package and keep `contentful` app-owned.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs contentful
   ```

2. Bind one app-local Optimization module. This binding shares one configured helper set for the
   app; it is not a per-route or per-request isolation context.
   `NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID` is reader-owned browser-visible config. The consent values
   below are a quick-start policy shortcut.

   **Adapt this to your use case:**

   ```tsx
   // lib/optimization.ts
   import { bindNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'
   import { contentfulClient } from './contentful'

   export const {
     NextAppAutoPageTracker,
     OptimizationRoot,
     OptimizedEntry,
     createRequestHandoff,
     createHandoffFromSelections,
     createOptimizationCacheKey,
     getServerTrackingAttributes,
     resolveEntriesForSelections,
   } = bindNextjsAppRouterOptimization({
     clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
     environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
     locale: 'en-US',
     contentful: { client: contentfulClient },
     consent: {
       server: { events: true, persistence: true },
       clientDefaults: { consent: true, persistenceConsent: true },
     },
   })
   ```

3. Forward the original request URL so the root layout can build a stable route key. `proxy.ts` is a
   Next.js file name; `x-ctfl-opt-request-url` is an SDK-owned request-context header, so use the
   exact name when forwarding the URL.

   **Copy this:**

   ```ts
   // proxy.ts
   import { NextResponse, type NextRequest } from 'next/server'

   export function proxy(request: NextRequest) {
     const requestHeaders = new Headers(request.headers)
     requestHeaders.set('x-ctfl-opt-request-url', request.url)

     return NextResponse.next({
       request: { headers: requestHeaders },
     })
   }

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
   }
   ```

4. Wrap the app in the bound root and pass the request handoff. `ctfl-opt-aid` is the SDK-owned
   anonymous profile cookie; your code reads it only through the helper inputs.

   **Adapt this to your use case:**

   ```diff
   // app/layout.tsx
   +import { cookies, headers } from 'next/headers'
   +import { Suspense } from 'react'
   +import { NextAppAutoPageTracker, OptimizationRoot, createRequestHandoff } from '@/lib/optimization'

    export default async function RootLayout({ children }: { children: React.ReactNode }) {
   +  const requestHeaders = new Headers(await headers())
   +  const requestUrl = requestHeaders.get('x-ctfl-opt-request-url') ?? 'https://example.com/'
   +  const routeKey = new URL(requestUrl).pathname
   +  const handoff = await createRequestHandoff({
   +    cache: { scope: 'private-request' },
   +    hydration: 'preserve-server',
   +    pagePayload: { properties: { path: routeKey } },
   +    request: {
   +      cookies: await cookies(),
   +      headers: requestHeaders,
   +      url: requestUrl,
   +    },
   +  })

      return (
        <html lang="en">
          <body>
   -        {children}
   +        <OptimizationRoot
   +          buildPagePayload={() => ({ properties: { path: routeKey } })}
   +          handoff={handoff}
   +          routeKey={routeKey}
   +        >
   +          <Suspense>
   +            <NextAppAutoPageTracker initialPageEvent="skip" />
   +          </Suspense>
   +          {children}
   +        </OptimizationRoot>
          </body>
        </html>
      )
    }
   ```

5. Wrap the entry where it becomes output. A **render prop** is the function child
   `{(entry) => ...}`; it lets you render the resolved entry with your existing component.

   **Adapt this to your use case:**

   ```diff
   // app/page.tsx
   +import { OptimizedEntry } from '@/lib/optimization'
    import { Hero } from '@/components/Hero'

    export default async function Page() {
      const hero = await getHeroEntry({ locale: 'en-US', include: 10 })

      return (
   -    <Hero entry={hero} />
   +    <OptimizedEntry baselineEntry={hero}>
   +      {(resolvedHero) => <Hero entry={resolvedHero} />}
   +    </OptimizedEntry>
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
  personalized-content test, target all visitors so the test request or visitor matches
  automatically.
- An Optimization client ID that is safe to expose to the browser.

> [!NOTE]
>
> Match your app's browser environment-variable convention. Next.js exposes `NEXT_PUBLIC_*` values
> to the browser; unprefixed server values stay server-only.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

The App Router binding centralizes SDK configuration for route code. Define it once and import the
returned app-local exports everywhere else. It is not an isolation context; do not call it per
route, per request, or per visitor.

| Import path                                           | Use                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router`          | App Router binding, request handoff, selection handoff, cache middleware, and server tracking helpers |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks and lower-level React roots                                                        |
| `@contentful/optimization-nextjs/edge`                | Edge runtime request and selection handoff helpers                                                    |
| `@contentful/optimization-nextjs/tracking-attributes` | Low-level `data-ctfl-*` attributes for analytics-only markup                                          |

The binding config separates policy from mechanism:

- `consent.server` is the app-owned server policy for the current request.
- `consent.clientDefaults` seeds the browser SDK before a persisted or explicit browser decision is
  available.
- `contentful.client` is your delivery client. The SDK may call it for managed entry IDs, but it
  does not own your CDA credentials or query policy.

### Fetching Contentful entries

**Integration category:** Required for first integration

There are two entry-source paths. Use the one that matches where your app already owns fetching.

- **Manual entry source:** your Server Component fetches a baseline entry and passes it as
  `baselineEntry` to `OptimizedEntry`.
- **Managed entry source:** the SDK receives `entryId` and uses the configured `contentful.client`.
  Use this when the route knows IDs and wants SDK-managed batching or cache warming.

**Follow this pattern:**

```tsx
<OptimizedEntry entryId="hero-entry-id" entryQuery={{ locale: 'en-US', include: 10 }}>
  {(entry) => <Hero entry={entry} />}
</OptimizedEntry>
```

Keep CDA fetches single-locale. The SDK expects directly readable fields such as
`fields.nt_experiences` and `fields.nt_variants`; all-locale payloads can make variant links look
unresolved and fall back to baseline.

### Request context and the profile cookie

**Integration category:** Common but policy-dependent

`createRequestHandoff()` takes explicit request input: headers, cookies, URL, cache metadata,
hydration mode, and page payload. It evaluates `consent.server`, calls the request page event, and
returns a browser handoff. The handoff includes `initialPageEvent: 'skip'` only when that server page
event was accepted.

The SDK-owned anonymous profile cookie is `ctfl-opt-aid`. Your app owns any consent cookie or account
record that `consent.server` reads. Store the consent decision where both server and browser code can
read it; do not use the SDK profile cookie as your consent record.

### Personalizing first paint on the server

**Integration category:** Required for first integration

Server Components render personalized first paint through the bound `OptimizedEntry`. If no
experience applies, consent is denied, the API has no variant, or a linked variant cannot be
resolved, the render receives the baseline entry.

Routes that read request headers or cookies are request-specific. Request-derived profile handoffs
must use `private-request` cache scope and stay out of public shared caches. Use app-owned selection
handoff for routes that should be shared.

### The bound root and page events

**Integration category:** Required for first integration

The bound `OptimizationProvider` handles the content SDK context, handoff, hydration mode, and
managed-entry prefetch for a subtree. Use the bound `OptimizationRoot` at the route root because it
adds initial page-event wiring. Pass `routeKey` and `buildPagePayload` to `OptimizationRoot` when the
browser should emit an initial page event from the root handoff; those props do not belong on
`OptimizationProvider`. In the quick start, the request helper already attempted the first page
event, so the separate `NextAppAutoPageTracker` is mounted with `initialPageEvent="skip"` and owns
later route changes.

For diagnostics, pass `onStatesReady` to the binding config. `states.eventStream` contains
accepted events; `states.blockedEventStream` contains events blocked by consent or event policy.

### Browser takeover and live updates

**Integration category:** Required for first integration

The handoff controls the first browser render over already-rendered content. `liveUpdates` controls
whether entries may re-resolve after startup when consent, identity, profile, or preview state
changes.

Use the default locked behavior for stable first paint. Turn on `liveUpdates` in the binding config,
route, or per-entry level only when visible content should react after hydration. The preview panel
can force live re-resolution for authoring even when the normal route keeps live updates off.

For static or browser-owned routes that should hide baseline until the browser SDK is ready, pass
`hydration="client-only-hidden-until-ready"` to the bound `OptimizationRoot` or
`OptimizationProvider`, or build that mode into the handoff.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` emits view, click, and hover tracking from the resolved entry by default. Configure
global defaults with `trackEntryInteraction` in the binding config and use per-entry props for local
opt-outs. Interaction delivery still depends on event consent and profile continuity.

Analytics-only server/static/edge markup should use `getServerTrackingAttributes()` so the browser
analytics runtime observes the same `data-ctfl-*` contract without resolving content.

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Replace the quick-start consent shortcut with your app policy:

1. Read the app-owned consent record in `consent.server`.
2. Seed conservative browser defaults through `consent.clientDefaults`.
3. Mirror browser choices to the app-owned consent record before the next request.
4. Use `setConsent`, `identifyUser`, and `resetUser` from `/client` hooks for browser actions.

**Adapt this to your use case:**

```tsx
bindNextjsAppRouterOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
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

For the full pattern, use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Merge tags and Custom Flags

**Integration category:** Optional

The `OptimizedEntry` render prop also receives `getMergeTagValue`. Pass it to your Rich Text
renderer when entries contain SDK-owned merge-tag entries. Use `/client` hooks for browser-only
Custom Flags when a route needs reactive flag reads after hydration.

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

### Route-level SSR, browser takeover, and browser-owned islands

**Integration category:** Advanced or production-only

Choose one ownership model per route:

| Route strategy                   | First paint owner                                   | Browser content behavior                                    | Cache scope                             |
| -------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Request handoff                  | Server request                                      | Preserves server output; optional live updates              | `private-request`                       |
| Customer-owned selection handoff | Static, ISR, or edge permutation chosen by app code | Preserves selected output; optional live updates            | `public-permutation` with app-owned key |
| Analytics-only handoff           | Server/static/edge markup                           | Tracks page and interactions only; no content re-resolution | Matches the rendered markup owner       |
| Client-only hidden-until-ready   | Browser SDK                                         | Hides baseline until ready or timeout                       | Static page shell                       |

For complete SSG, ISR, edge rendering, and analytics-only recipes, use
[Rendering personalized Next.js routes with static, ISR, and edge handoffs](./rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md).
For the mechanics behind handoff state and cache scopes, use
[Optimization handoff and cache-safe rendering](../concepts/optimization-handoff-and-cache-safe-rendering.md).

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use lower-level subpaths only when the bound App Router module cannot express the route. The main
escape hatches are:

- `/server` for direct Node request control with `configureNextjsServerOptimization(...)`. That
  helper configures a stateless server runtime; it is not a request-isolation context.
- `/client` for router-neutral React roots, providers, and hooks.
- `/tracking-attributes` for manually rendered analytics-only markup.
- `/edge` for Edge runtime handoff.

Manual flows still pass `handoff` to a React root. Do not invent a second state shape for browser
hydration.

### Caching and request deduplication

**Integration category:** Advanced or production-only

`private-request` handoffs include request-specific state and must not be stored in a shared public
cache. `public-permutation` handoffs are for app-owned segments, campaigns, markets, or other
application-defined permutations and need a cache key supplied by your app. `static` handoffs are for
baseline or build-time output that does not depend on a request profile. Do not create public or
static handoffs from request-derived profile state.

Use the supplemental rendering guide for the static, ISR, edge, and analytics-only recipes. Use the
handoff concept when reviewing whether a route can be public, public-permutation, static, or
private-request cached.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

When no Optimization event may emit before explicit consent, configure a strict event policy and
return `false` from `consent.server` until your app-owned consent record is accepted. Use
`initialPageEvent="skip"` only when a server or edge helper already accepted the same route's first
page event. Use blocked-event diagnostics to verify denied events are dropped at the SDK boundary.

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

| Symptom                                            | Likely cause                                                                             | Check                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Entries stay on baseline                           | No matching variant, denied consent, unresolved variant links, or all-locale CDA payload | Target all visitors for the first test, read accepted or blocked events, and fetch one locale with enough `include` depth            |
| Variant appears in the browser but not View Source | The route is browser-owned rather than server-handoff-owned                              | Verify the route calls `createRequestHandoff()` or uses a customer-owned selection handoff before rendering                          |
| Duplicate first page events                        | Both the handoff root and route tracker emitted the initial route                        | Use the handoff's `initialPageEvent` for the root and set the separate tracker to skip the initial event when the server accepted it |
| Live entries do not change after identify or reset | The entry is locked to the handoff and live updates are off                              | Enable live updates for the route or entry, or open the preview panel in an allowed environment                                      |
| Personalized HTML is cached for the wrong visitor  | Request handoff output entered a public cache                                            | Use `private-request` for request state and `public-permutation` only for app-owned selected permutations with explicit keys         |

## Reference implementations to compare against

- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
