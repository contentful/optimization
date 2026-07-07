# Integrating the Optimization Next.js SDK in a Next.js Pages Router app

Use this guide when you want a Next.js Pages Router route to personalize server-rendered HTML from
`getServerSideProps`, pass Optimization state through `pageProps`, and let the browser SDK continue
from that state after hydration.

This pattern uses `@contentful/optimization-nextjs`. The `/pages-router` factory binds app-local
client components, and `/pages-router/server` prepares serializable `pageProps` for
`getServerSideProps`. Your application still owns Contentful fetching, consent policy, identity
policy, routing, caching, and component rendering. When configured with an app-owned `contentful.js`
client, the SDK can fetch entries by ID for managed entry resolution.

If your application uses the App Router, use the
[Next.js App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
instead.

## Quick start

This quick start assumes your application policy permits accepted SDK startup. It proves one result:
the page renders with server Optimization state and the browser continues without emitting a
duplicate initial page event. If consent depends on a consent management platform (CMP), regional
rule, account preference, or user choice, keep the same structure and apply the policy-dependent
consent section before release.

1. Install the Next.js adapter package.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs
   ```

2. Bind Pages Router components once from `/pages-router`.

   **Copy this:**

   ```ts
   // lib/optimization.ts
   import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

   export const APP_LOCALE = 'en-US'

   export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
     createNextjsPagesRouterOptimization({
       clientId: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
       environment: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
       locale: APP_LOCALE,
       defaults: { consent: true, persistenceConsent: true },
       api: {
         experienceBaseUrl: process.env.NEXT_PUBLIC_CONTENTFUL_EXPERIENCE_API_BASE_URL,
         insightsBaseUrl: process.env.NEXT_PUBLIC_CONTENTFUL_INSIGHTS_API_BASE_URL,
       },
       app: {
         name: 'my-next-pages-app',
         version: '1.0.0',
       },
       logLevel: 'error',
     })
   ```

3. Create the server helper used by personalized Pages routes.

   **Copy this:**

   ```ts
   // lib/optimization-server.ts
   import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router/server'
   import type { GetServerSidePropsContext } from 'next'
   import { APP_LOCALE } from './optimization'

   const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
     clientId: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID ?? '',
     environment: process.env.NEXT_PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
     locale: APP_LOCALE,
     server: {
       consent: { events: true, persistence: true },
     },
   })

   export function getOptimizationProps(context: GetServerSidePropsContext) {
     return getServerSideOptimizationProps(context)
   }
   ```

4. Mount the bound root and Pages Router tracker once in `pages/_app.tsx`.

   **Adapt this to your use case:**

   ```tsx
   // pages/_app.tsx
   import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
   import type { NextjsPagesRouterOptimizationPageProps } from '@contentful/optimization-nextjs/pages-router/server'
   import type { AppProps } from 'next/app'

   interface OptimizationPageProps {
     readonly contentfulOptimization?: NextjsPagesRouterOptimizationPageProps
   }

   export default function App({ Component, pageProps }: AppProps<OptimizationPageProps>) {
     const optimization = pageProps.contentfulOptimization

     return (
       <OptimizationRoot
         clientDefaults={optimization?.clientDefaults}
         serverOptimizationState={optimization?.serverOptimizationState}
       >
         <NextPagesAutoPageTracker initialPageEvent={optimization?.initialPageEvent} />
         <Component {...pageProps} />
       </OptimizationRoot>
     )
   }
   ```

5. Fetch single-locale Contentful entries in `getServerSideProps`, merge the Optimization props, and
   render entries with the bound `OptimizedEntry`.

   **Adapt this to your use case:**

   ```tsx
   // pages/index.tsx
   import { OptimizedEntry } from '@/lib/optimization'
   import { getOptimizationProps } from '@/lib/optimization-server'
   import { fetchEntriesFromContentful } from '@/lib/contentful-client'
   import type { NextjsPagesRouterOptimizationProps } from '@contentful/optimization-nextjs/pages-router/server'
   import type { Entry } from 'contentful'
   import type { GetServerSideProps } from 'next'

   interface HomeProps extends NextjsPagesRouterOptimizationProps {
     readonly entries: Entry[]
   }

   export const getServerSideProps: GetServerSideProps<HomeProps> = async (context) => {
     const [entries, optimization] = await Promise.all([
       fetchEntriesFromContentful(['home-hero', 'home-offer']),
       getOptimizationProps(context),
     ])

     return { props: { ...optimization.props, entries } }
   }

   export default function Home({ entries }: HomeProps) {
     return (
       <>
         {entries.map((entry) => (
           <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
             {(resolvedEntry) => <h2>{String(resolvedEntry.fields.title ?? '')}</h2>}
           </OptimizedEntry>
         ))}
       </>
     )
   }
   ```

6. Verify the first run. The route source must contain the server-selected content or baseline
   fallback, that content must remain visible after hydration, consent state must match the request,
   and the browser must not emit a duplicate initial page event when `initialPageEvent` from the
   server helper is `skip`.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Package entry points and runtime boundary](#package-entry-points-and-runtime-boundary)
  - [App-local bound components](#app-local-bound-components)
  - [getServerSideProps state handoff](#getserversideprops-state-handoff)
  - [Contentful fetching and entry shape](#contentful-fetching-and-entry-shape)
  - [Bound root and Pages Router navigation](#bound-root-and-pages-router-navigation)
  - [Client takeover and live re-resolution](#client-takeover-and-live-re-resolution)
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

## Required setup

Use this table as the setup inventory for the full Pages Router integration:

| Setup item                                                      | Category                       | Required for quick start | Where to configure                                                                  |
| --------------------------------------------------------------- | ------------------------------ | ------------------------ | ----------------------------------------------------------------------------------- |
| Next.js Pages Router with React and React DOM peer dependencies | Required for first integration | Yes                      | Application `package.json`                                                          |
| `@contentful/optimization-nextjs` package                       | Required for first integration | Yes                      | Application package manager                                                         |
| App-local bound components from `/pages-router`                 | Required for first integration | Yes                      | `lib/optimization.ts` with `createNextjsPagesRouterOptimization()`                  |
| Optimization client ID, environment, locale, and API endpoints  | Required for first integration | Yes                      | Bound component factory and server SDK config with browser-safe environment values  |
| Server SDK helper from `/pages-router/server`                   | Required for first integration | Yes                      | `getServerSideProps` helper module                                                  |
| Contentful CDA credentials and fetch policy                     | Required for first integration | Yes                      | Application Contentful client or SDK `contentful` config                            |
| Single-locale CDA entries with resolved optimization links      | Required for first integration | Yes                      | CDA calls with one `locale` and enough `include` depth, commonly `include: 10`      |
| Bound `OptimizationRoot`                                        | Required for first integration | Yes                      | `pages/_app.tsx`                                                                    |
| Pages Router page tracker                                       | Required for first integration | Yes                      | `NextPagesAutoPageTracker` under the bound `OptimizationRoot`                       |
| Consent and persistence policy                                  | Common but policy-dependent    | Conditional              | Server helper consent, browser consent defaults, CMP, or controls                   |
| Anonymous ID cookie continuity                                  | Common but policy-dependent    | Conditional              | `getServerSideOptimizationProps()`, `ctfl-opt-aid`, and response headers            |
| Browser identify, profile state, and reset controls             | Common but policy-dependent    | No                       | Components using Next.js client hooks                                               |
| Entry interaction tracking for views, clicks, and hovers        | Common but policy-dependent    | No                       | Factory `trackEntryInteraction`, `OptimizedEntry` props, or manual browser tracking |
| Analytics or tag-manager forwarding                             | Optional                       | No                       | Factory `onStatesReady` subscription and app-owned forwarding code                  |
| Merge tag and Custom Flag rendering                             | Optional                       | No                       | `OptimizedEntry` render props, Rich Text renderers, flag readers, and live surfaces |
| Preview panel package                                           | Optional                       | No                       | Environment-gated preview attachment in non-production app environments             |
| Manual server or client SDK wiring                              | Advanced or production-only    | No                       | `/server`, `/client`, and explicit `serverOptimizationState` escape hatches         |
| Strict pre-consent allowlist, storage, queue, and cookie policy | Advanced or production-only    | No                       | Factory config, server helper consent, CMP integration, and application cleanup     |
| Personalized response caching and duplicate-event policy        | Advanced or production-only    | No                       | `getServerSideProps`, CDN rules, response headers, and tracker settings             |

Use one application Contentful locale for entries that feed SDK resolution. The SDK Experience and
event locale often uses the same string, but the SDK does not infer the CDA locale or change CDA
requests for you.

## Core integration

### Package entry points and runtime boundary

**Integration category:** Required for first integration

The Next.js adapter is a glue package. Pages Router integrations should start from `/pages-router`
for bound browser components and `/pages-router/server` for `getServerSideProps` state handoff.

| Import path                                           | Runtime                 | Responsibility                                                                                    |
| ----------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/pages-router`        | Pages Router components | Bound `OptimizationRoot`, `OptimizationProvider`, `OptimizedEntry`, and route tracker             |
| `@contentful/optimization-nextjs/pages-router/server` | `getServerSideProps`    | Server Optimization data, initial page-event ownership, and anonymous ID persistence              |
| `@contentful/optimization-nextjs/client`              | Browser components      | Router-neutral browser hooks, manual client providers, live updates helpers, and entry components |
| `@contentful/optimization-nextjs/server`              | Advanced server modules | Manual server SDK creation and direct request binding                                             |
| `@contentful/optimization-nextjs/api-schemas`         | Shared schema helpers   | API types plus structural guards                                                                  |

1. Install `@contentful/optimization-nextjs` in the Next.js app.
2. Create an app-local module that calls `createNextjsPagesRouterOptimization()`.
3. Create a server-only helper with `createNextjsPagesRouterOptimization()` from
   `/pages-router/server`.
4. Import `OptimizationRoot`, `OptimizationProvider`, `OptimizedEntry`, and
   `NextPagesAutoPageTracker` from the app-local module.
5. Import browser hooks from `/client` only inside browser components.
6. Keep `/server` imports for manual server control when the Pages Router helper does not fit a
   route.

### App-local bound components

**Integration category:** Required for first integration

Create the bound components once at module level. Pages Router bound components use the React Web
runtime and accept server state from `pageProps`.

1. Read browser-safe Optimization client ID, environment, locale, and endpoint values in the
   app-local binding module.
2. Pass the application Experience/event locale to the SDK.
3. Configure API endpoint overrides only when your app uses mocks, a proxy, or non-default hosts.
4. Configure `defaults` for the browser SDK startup state.
5. Configure `trackEntryInteraction`, `onStatesReady`, and `liveUpdates` in the bound factory when
   the behavior applies to the full app.

### getServerSideProps state handoff

**Integration category:** Required for first integration

Use the config-bound `getServerSideOptimizationProps()` helper in every server-personalized Pages
route. It builds request context from the Pages Router context, calls the server SDK, writes or
clears the anonymous ID cookie on the response, and returns serializable
`props.contentfulOptimization`.

1. Create the server helper once with `createNextjsPagesRouterOptimization()`.
2. Put application consent policy in the helper's `server.consent`.
3. In `getServerSideProps`, call the returned helper with the route context.
4. Return the helper's `props` merged into the page props.
5. Keep `clientDefaults` and `initialPageEvent` from the helper unless the route intentionally
   changes request consent or page-event ownership.

### Contentful fetching and entry shape

**Integration category:** Required for first integration

This quick start fetches baseline entries in the application layer with one Contentful locale and
resolved optimization links before passing them to bound entry primitives. For managed entry
fetching, configure the SDK with `contentful: { client }` and pass `entryId` plus an optional
`entryQuery` to supported entry helpers.

1. Choose the application Contentful locale in routing, i18n, request policy, or app configuration.
2. Pass that locale to CDA requests.
3. Include linked optimization entries and variant entries. The common Contentful CDA setting is
   `include: 10`.
4. Do not pass all-locale CDA responses from `contentful.js` `withAllLocales` or raw CDA `locale=*`
   into bound `OptimizedEntry`, `resolveOptimizedEntry()`, or `useOptimizedEntry()`.
5. Use the same locale as the SDK Experience/event locale when localized Experience responses and
   rendered content need to match.

### Bound root and Pages Router navigation

**Integration category:** Required for first integration

Mount the app-local `OptimizationRoot` once in `pages/_app.tsx` and pass the request-specific
defaults and server state from `pageProps.contentfulOptimization`. Mount `NextPagesAutoPageTracker`
under that root.

1. Read `pageProps.contentfulOptimization` in `pages/_app.tsx`.
2. Pass `clientDefaults` and `serverOptimizationState` to the bound `OptimizationRoot`.
3. Pass `initialPageEvent` to `NextPagesAutoPageTracker`.
4. Let the server helper return `skip` when the server already owns a consented initial page event.
5. Use `OptimizationProvider` from the same app-local module only when a nested provider boundary is
   needed.

### Client takeover and live re-resolution

**Integration category:** Required for first integration

Render browser-owned or live-update surfaces with the same app-local `OptimizedEntry`. `liveUpdates`
defaults to `false`, so set it in the factory config, a `LiveUpdatesProvider`, or per
`OptimizedEntry` when visible content must react to profile changes.

1. Pass baseline entries through page props or fetch them in browser-owned components.
2. Import `OptimizedEntry` from the app-local binding module.
3. Pass `liveUpdates={true}` for entries that must update after `identifyUser()`, `setConsent()`,
   `resetUser()`, preview changes, or selected-optimization state changes.
4. Use `/client` hooks such as `useOptimizedEntry()` or `useEntryResolver()` only when a component
   needs custom rendering control that the `OptimizedEntry` wrapper does not provide.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Entry interaction tracking is browser-side. Bound `OptimizedEntry` renders the metadata, and the
browser SDK observes views, clicks, and hovers after consent permits the detectors and event
delivery.

1. Leave the default view, click, and hover interactions enabled when your consent policy permits
   them; use factory `trackEntryInteraction` only to opt out of interaction types the app must not
   observe.
2. Use `OptimizedEntry` props such as `clickable`, `trackViews`, `trackClicks`, `trackHovers`,
   `viewDurationUpdateIntervalMs`, and `hoverDurationUpdateIntervalMs` for per-entry control.
3. Use `sdk.tracking.enableElement(...)` from `useOptimization()` only for app-owned manual
   observation cases.
4. Verify consent gates. Page events can be allowed before full consent, but entry views, clicks,
   and hovers are blocked unless consent or `allowedEventTypes` permits them.

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Consent, identity, and profile continuity are application policy decisions. The SDK provides the
runtime controls, but your application owns the consent record, privacy notice, CMP integration,
identity source, and server cookie cleanup.

1. If policy permits accepted startup, pass accepted consent to the Pages Router server helper and
   seed accepted consent in browser defaults.
2. If policy depends on user choice, read the choice in `getServerSideProps` and call `setConsent()`
   from the browser component that owns the decision.
3. Store the policy decision in the same CMP, account preference, session, or cookie that
   `getServerSideProps` can read on the next request.
4. Call `identifyUser()` from browser flows when a visitor becomes known.
5. Call `resetUser()` and clear application-owned profile cookies when withdrawal or sign-out must
   end active-session personalization.

## Optional integrations

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app needs to send approved Optimization context to a tag manager,
customer-data platform, warehouse, or analytics destination.

1. Register browser subscriptions with factory `onStatesReady` so event observers attach before
   child effects such as route trackers emit events.
2. Dedupe forwarded events by `messageId` or destination-specific semantic keys.
3. Gate forwarding with the same consent and destination policy that controls the rest of your
   analytics stack.
4. Use
   [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
   for vendor examples, consent, dedupe, and governance guidance.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags and Custom Flags when entries or components render profile-backed values that are not
entry replacements.

1. Resolve Rich Text merge tag entries with the `getMergeTagValue` function passed to
   `OptimizedEntry` render props.
2. Keep the SDK locale aligned with the rendered Contentful locale when merge tags reference
   localized profile fields.
3. Use flag state from the browser SDK for components that need to react after browser startup.
4. Treat flag-view and merge-tag event behavior as consent-gated browser activity unless a server
   path owns the event.

### Preview panel

**Integration category:** Optional

Use the preview panel where authors or engineers need to inspect variant behavior. Keep production
loading explicit and gate attachment behind an application-owned flag.

1. Add the preview panel package only when your app needs browser authoring tooling.
2. Attach the panel from a browser component under `OptimizationRoot`.
3. Wait until the browser SDK is ready before attaching the panel.
4. Pass an app-owned Contentful client or pre-fetched preview entries to the attach function.
5. Enable it only when an approved app environment sets `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`
   to `true`.

## Advanced integrations

### Mixed route strategies

**Integration category:** Advanced or production-only

Pages Router applications can mix route strategies. Choose the strategy per page instead of forcing
one rendering model across the whole app.

| Page need                                                  | Use this pattern                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Server-personalized first paint                            | Use `getServerSideProps` with `getServerSideOptimizationProps()`                    |
| Server first render plus browser-side reactivity           | Pass server state through `pageProps` and render live entries with `OptimizedEntry` |
| Browser-owned personalization after startup                | Render baseline or loading UI on the server and let browser components own it       |
| Highly interactive account, dashboard, or settings surface | Prefer browser components with live updates and explicit consent state              |

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use manual helpers only when the Pages Router helper cannot express a route's control needs.

1. Use `createNextjsOptimization()` and `getNextjsServerOptimizationData()` from `/server` when a
   route needs direct request SDK control.
2. Pass `serverOptimizationState` to `/client` `OptimizationRoot` or `OptimizationProvider` only in
   manual server/client setups.
3. Use `getServerTrackingAttributes()` only with manual `resolveOptimizedEntry()` results.

### Caching and request policy

**Integration category:** Advanced or production-only

Personalized server rendering is request-specific. Keep shared caches on raw Contentful payloads,
not on profile-evaluated SDK results or personalized HTML unless your cache key varies on every
personalization input.

1. Avoid sharing server Optimization data across requests. It is profile-specific and tied to the
   request page event.
2. Cache raw Contentful entries by entry ID, locale, environment, and include depth when your app
   cache policy permits it.
3. Set response headers from `getServerSideProps` or the hosting layer so personalized HTML is not
   stored in shared caches unless the cache varies on the full personalization context.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

Strict consent and duplicate-event controls are production policy work. Configure them only after
your privacy, analytics, and platform owners agree on the event posture.

1. Use `allowedEventTypes: []` in the factory config when no SDK events can emit before consent.
2. Pass `false` to the Pages Router server helper while consent is unknown or denied.
3. Clear `ctfl-opt-aid` and application-owned consent or profile cookies when withdrawal must end
   profile continuity.
4. Use the server helper's `clientDefaults` and `initialPageEvent` by default. Override them only
   when the route owns consent mapping or first page tracking outside the helper.
5. Subscribe to `states.blockedEventStream` during validation to confirm the SDK blocks the events
   your policy expects it to block.

## Production checks

Run these checks before release:

- Confirm the app-local component factory and server SDK use the intended Optimization client ID,
  environment, API endpoints, locale, app metadata, and log level.
- Confirm browser-exposed `NEXT_PUBLIC_` variables contain only values that can be shipped to the
  client.
- Confirm Contentful fetches use one concrete locale and include resolved optimization entries and
  variants.
- Confirm server helper consent, browser SDK consent, anonymous ID persistence, and CMP or account
  preference state stay aligned across first load, route navigation, opt-in, opt-out, sign-in,
  sign-out, and reset.
- Confirm `NextPagesAutoPageTracker` does not duplicate the initial route event when the server
  helper owns a consented server page event.
- Confirm entry views, clicks, hovers, flag views, page events, business events, and forwarded
  analytics events are delivered only when policy permits them.
- Confirm baseline fallback renders when the Experience API fails, selected optimizations are
  missing, optimization links are unresolved, or CDA payloads are all-locale.
- Confirm personalized HTML is not shared-cache safe unless the cache varies on every
  personalization input.

**Copy this:**

```sh
pnpm implementation:run -- nextjs-sdk_pages-router typecheck
pnpm implementation:run -- nextjs-sdk_pages-router lint
pnpm test:e2e:nextjs-sdk_pages-router
```

## Troubleshooting

| Symptom                                                            | Likely cause                                                                                   | Check                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Entries stay on baseline                                           | Missing selected optimizations, denied consent, unresolved Contentful links, or all-locale CDA | Check server helper consent, fetch with one `locale`, and use enough `include` depth               |
| Browser sends a duplicate first page event                         | The tracker emits after the server helper already emitted the same route                       | Use the helper's returned `initialPageEvent` in `pages/_app.tsx`                                   |
| Browser does not send the first page event                         | `initialPageEvent="skip"` is used without a matching server event                              | Let the helper choose `initialPageEvent`, or use `emit` when the browser owns first page tracking  |
| Live entries do not update after `identifyUser()` or `resetUser()` | `liveUpdates` is false in the factory, provider, and entry                                     | Set `liveUpdates={true}` on the entry, a `LiveUpdatesProvider`, or the component factory           |
| Entry views, clicks, or hovers do not emit                         | Interaction tracking is opted out, consent blocks the event, or no profile is available        | Check factory `trackEntryInteraction`, entry props, consent state, and `states.blockedEventStream` |
| Server and browser use different profiles                          | Cookie domain, path, readability, or consent cleanup differs between runtimes                  | Use a browser-readable `ctfl-opt-aid` with consistent path and clear it on withdrawal              |
| Personalized HTML appears stale                                    | Route or CDN caching is sharing profile-evaluated output                                       | Set response headers or cache keys for the full personalization context                            |

## Reference implementations to compare against

- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md):
  Working Pages Router application using `getServerSideProps` state handoff, app-local bound
  components, client takeover, live updates, consent controls, page events, entry interaction
  tracking, preview attachment, and Playwright E2E coverage.
- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md):
  App Router equivalent using bound Server and Client Component exports.
