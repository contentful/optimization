# Integrating the Optimization Next.js SDK in a Next.js Pages Router app

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
       clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
       environment: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
       locale: 'en-US',
       consent: {
         clientDefaults: { consent: true, persistenceConsent: true },
       },
     })
   ```

3. Bind the server helper for `getServerSideProps`. The server entry point is separate from the
   browser-facing module and returns a browser `handoff`. This binding configures the server helper
   set; it is not a per-request isolation context.

   **Adapt this to your use case:**

   ```ts
   // lib/optimization-server.ts
   import { bindNextjsPagesRouterServerOptimization } from '@contentful/optimization-nextjs/pages-router/server'
   import type { GetServerSidePropsContext } from 'next'

   const { createRequestHandoff } = bindNextjsPagesRouterServerOptimization({
     clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
     environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
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

4. Mount the bound root once in `_app.tsx`. The handoff carries the server's page-event decision;
   the separate route tracker skips the initial event and tracks later navigations.

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
   +      <NextPagesAutoPageTracker initialPageEvent="skip" />
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

Pages Router integrations have an explicit client/server split:

| Import path                                           | Use                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/pages-router`        | Browser-facing binding for `_app.tsx`, route tracker, roots, and `OptimizedEntry` |
| `@contentful/optimization-nextjs/pages-router/server` | Server helper for `getServerSideProps` request handoff                            |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks and lower-level React roots                                    |
| `@contentful/optimization-nextjs/tracking-attributes` | Low-level `data-ctfl-*` attributes for analytics-only markup                      |

Use the server entrypoint only from server files. Use the browser-facing module for `_app.tsx` and
components.

### Fetching Contentful entries

**Integration category:** Required for first integration

Manual entry source is the usual Pages Router path: `getServerSideProps` fetches a baseline entry and
passes it through props, then the page renders it through `OptimizedEntry`.

Managed entry source is also available when the route knows IDs. Pass `prefetchManagedEntries` to
`createRequestHandoff()` in `getServerSideProps`; the helper puts the baseline snapshots in
`handoff.entries` so the browser can preserve managed entries without a Contentful round trip.

**Follow this pattern:**

```ts
const contentfulOptimization = {
  handoff: await createRequestHandoff(context, {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { path: context.resolvedUrl } },
    prefetchManagedEntries: [{ entryId: 'hero-entry-id', entryQuery: { locale: 'en-US' } }],
  }),
}
```

### The getServerSideProps request handoff and the profile cookie

**Integration category:** Required for first integration

`createRequestHandoff(context, options)` reads the Pages Router request, evaluates
`consent.server`, calls the request page event, persists the SDK-owned anonymous profile cookie on
the response when appropriate, and returns a serializable browser `handoff`.

The SDK-owned anonymous profile cookie is `ctfl-opt-aid`. Your app owns any consent cookie or account
record that `consent.server` reads. Pages Router server work happens in `getServerSideProps`; there
is no middleware or proxy requirement for the Pages Router path.

### The bound root and page events

**Integration category:** Required for first integration

The bound `OptimizationProvider` handles the content SDK context, handoff, hydration mode, and
managed-entry prefetch for a subtree. Use the bound `OptimizationRoot` in `_app.tsx` because it adds
initial page-event wiring. Pass `routeKey` and `buildPagePayload` so the root can follow the
handoff's `initialPageEvent` instruction; those props do not belong on `OptimizationProvider`. The
separate `NextPagesAutoPageTracker` should skip the initial event when the request helper already
accepted it, then track later client navigations.

### Personalizing entries

**Integration category:** Required for first integration

`OptimizedEntry` receives either a `baselineEntry` fetched by your page or an `entryId` managed by
the SDK's configured Contentful client. Its render prop receives the resolved entry. If no
experience applies, consent is denied, the API has no variant, or a linked variant cannot be
resolved, the render receives the baseline entry.

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

1. Read the app-owned consent record in the server helper's `consent.server`.
2. Seed conservative browser defaults through `consent.clientDefaults`.
3. Mirror browser choices to the app-owned consent record before the next request.
4. Use `setConsent`, `identifyUser`, and `resetUser` from `/client` hooks for browser actions.

**Adapt this to your use case:**

```ts
bindNextjsPagesRouterServerOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
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

| Route strategy                       | First paint owner       | Browser content behavior                                    | Cache scope                       |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------- | --------------------------------- |
| `getServerSideProps` request handoff | Server request          | Preserves server output; optional live updates              | `private-request`                 |
| Browser-only route                   | Browser SDK             | Resolves after hydration                                    | Static page shell                 |
| Analytics-only markup                | Server or static markup | Tracks page and interactions only; no content re-resolution | Matches the rendered markup owner |

Pages Router static generation does not have request context. Use `createHandoffFromSelections()`
from the browser-facing binding only when your application supplies customer-owned selected
optimizations for a static or ISR permutation.

For complete static, ISR, edge rendering, and analytics-only recipes, use
[Rendering personalized Next.js routes with static, ISR, and edge handoffs](./rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md).
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

### Caching and request policy

**Integration category:** Advanced or production-only

`private-request` handoffs include request-specific state and must not be stored in a shared public
cache. Catch Experience API failures according to your app's policy; many apps return baseline props
when personalization is unavailable.

Use the handoff concept to review why request profile state must stay out of public caches, and use
the supplemental rendering guide for static and ISR selection handoff patterns.

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

When no Optimization event may emit before explicit consent, configure a strict event policy and
return `false` from `consent.server` until your app-owned consent record is accepted. Use
`initialPageEvent="skip"` only when the request helper already accepted the same route's first page
event. Use blocked-event diagnostics to verify denied events are dropped at the SDK boundary.

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

| Symptom                                            | Likely cause                                                                                                    | Check                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Entries stay on baseline                           | Missing handoff props, no matching variant, denied consent, unresolved variant links, or all-locale CDA payload | Target all visitors for the first test, pass `contentfulOptimization.handoff` into `_app.tsx`, and fetch one locale with enough `include` depth |
| Page returns 500 instead of baseline               | The request handoff call threw and the page did not catch it                                                    | Wrap the personalization helper according to your fallback policy                                                                               |
| Duplicate first page events                        | Both the handoff root and route tracker emitted the initial route                                               | Use the handoff's `initialPageEvent` for the root and set the separate tracker to skip the initial event when the server accepted it            |
| Live entries do not change after identify or reset | The entry is locked to the handoff and live updates are off                                                     | Enable live updates for the route or entry, or open the preview panel in an allowed environment                                                 |
| Personalized HTML is cached for the wrong visitor  | Request handoff output entered a public cache                                                                   | Keep request handoff pages private and use customer-owned selection handoff only for explicit static permutations                               |

## Reference implementations to compare against

- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
