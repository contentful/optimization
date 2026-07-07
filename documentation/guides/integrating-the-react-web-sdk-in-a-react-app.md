# Integrating the Optimization React Web SDK in a React app

Use this guide when you want to add browser-side personalization and analytics to a React
application with `@contentful/optimization-react-web`.

The React Web SDK wraps `@contentful/optimization-web` with React providers, hooks, entry-rendering
components, live-update state, and router adapters. Your application still owns the Contentful
client and credentials, consent policy, identity policy, routing, and final rendering.

Use the lower-level Web SDK guide instead when your app is not React-based or when you want to own
the browser SDK lifecycle without React abstractions.

## Quick start

This path assumes your application policy permits Optimization by default. If your app requires
explicit opt-in, wire the consent section before you emit events or render personalized content.

1. Install the React Web SDK in an existing React app. Add `contentful` only if your app does not
   already have a Contentful Delivery API client.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-react-web contentful
   ```

2. Mount `OptimizationRoot` once with your app-owned `contentful.js` client, emit a page event so
   the SDK can evaluate route-based optimizations, and render one entry through `OptimizedEntry`.

   Set `PUBLIC_HERO_ENTRY_ID` to the baseline entry ID for the first optimized entry, or replace
   `HERO_ENTRY_ID` with an app-owned constant.

   **Adapt this to your use case:**

   ```tsx
   import {
     OptimizationRoot,
     OptimizedEntry,
     useOptimizationActions,
   } from '@contentful/optimization-react-web'
   import { createClient } from 'contentful'
   import { useEffect } from 'react'

   const APP_LOCALE = 'en-US'
   const HERO_ENTRY_ID = import.meta.env.PUBLIC_HERO_ENTRY_ID
   const INCLUDE_DEPTH = 10

   const contentfulClient = createClient({
     accessToken: import.meta.env.PUBLIC_CONTENTFUL_TOKEN,
     environment: import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
     space: import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID,
   })

   function HomePage() {
     const { trackPageView } = useOptimizationActions()

     useEffect(() => {
       // Emit after the provider is ready so the SDK can resolve route-based optimizations.
       void trackPageView()
     }, [trackPageView])

     return (
       <OptimizedEntry entryId={HERO_ENTRY_ID}>
         {(resolvedEntry) => (
           <article>
             <h1>{String(resolvedEntry.fields.title ?? '')}</h1>
           </article>
         )}
       </OptimizedEntry>
     )
   }

   export function App() {
     return (
       <OptimizationRoot
         clientId={import.meta.env.PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID}
         environment={import.meta.env.PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main'}
         locale={APP_LOCALE}
         contentful={{
           client: contentfulClient,
           defaultQuery: {
             // Managed fetching expects one CDA locale and resolved optimization links.
             include: INCLUDE_DEPTH,
             locale: APP_LOCALE,
           },
         }}
         // Use accepted startup consent only when your application policy permits it.
         defaults={{ consent: true }}
       >
         <HomePage />
       </OptimizationRoot>
     )
   }
   ```

3. Verify the hero renders from the selected variant when the visitor matches an optimization, or
   from the baseline entry when no optimization is selected.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Install and initialize the React provider](#install-and-initialize-the-react-provider)
  - [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff)
  - [Contentful client configuration and locale shape](#contentful-client-configuration-and-locale-shape)
  - [Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering)
  - [Page events and route tracking](#page-events-and-route-tracking)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile state, and reset](#identity-profile-state-and-reset)
- [Optional integrations](#optional-integrations)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Live updates](#live-updates)
  - [Analytics forwarding](#analytics-forwarding)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Existing SDK instance ownership](#existing-sdk-instance-ownership)
  - [Strict consent, storage, and delivery controls](#strict-consent-storage-and-delivery-controls)
  - [Runtime boundaries](#runtime-boundaries)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this table as the setup inventory for the guide:

| Setup item                                                                                | Category                       | Required for quick start | Where to configure                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `@contentful/optimization-react-web` plus app-owned React and React DOM peer dependencies | Required for first integration | Yes                      | Application package dependencies                                                               |
| Optimization client ID and environment                                                    | Required for first integration | Yes                      | `OptimizationRoot` props, usually from runtime environment variables                           |
| Experience API and Insights API endpoint overrides                                        | Common but policy-dependent    | No                       | `api` prop when using non-default production, staging, or mock endpoints                       |
| Contentful Delivery API client, space, environment, and access token                      | Required for first integration | Yes                      | Application-owned `contentful.js` client passed through `OptimizationRoot`                     |
| Contentful optimized entry ID used by the first rendered entry                            | Required for first integration | Yes                      | Runtime environment variable such as `PUBLIC_HERO_ENTRY_ID`, or an app-owned entry ID constant |
| Contentful entries with linked optimization and variant data                              | Required for first integration | Yes                      | Contentful content model and entries rendered by the app                                       |
| Single Contentful CDA locale and `include: 10` for optimized entries                      | Required for first integration | Yes                      | `contentful.defaultQuery`, per-entry `entryQuery`, or manual `getEntry()` calls                |
| `OptimizationRoot` mounted once around the React tree that uses SDK hooks                 | Required for first integration | Yes                      | React app root, layout, or router root                                                         |
| Page event emission on initial render, plus route changes for routed apps                 | Required for first integration | Yes                      | Router adapter under `OptimizationRoot`, or an app-owned `page()` effect                       |
| Entry rendering through `OptimizedEntry` or `useOptimizedEntry`                           | Required for first integration | Yes                      | React components that render Contentful entries                                                |
| Consent startup policy and user-choice wiring                                             | Common but policy-dependent    | Conditional              | `defaults`, `allowedEventTypes`, and application consent UI or CMP callbacks                   |
| Entry interaction tracking for views, clicks, and hovers                                  | Common but policy-dependent    | No                       | `trackEntryInteraction` on `OptimizationRoot` and per-entry tracking props                     |
| User identity, profile continuity, and reset policy                                       | Common but policy-dependent    | No                       | Account, session, or identity components that call `identifyUser()` and `resetUser()`          |
| Router package for an adapter such as React Router, Next.js, or TanStack Router           | Optional                       | No                       | App router dependencies and the matching `@contentful/optimization-react-web/router/*` subpath |
| Merge tag and Custom Flag rendering                                                       | Optional                       | No                       | Components that read profile-backed merge tags or flags                                        |
| Analytics forwarding destination                                                          | Optional                       | No                       | `onStatesReady` subscriptions and application-owned analytics code                             |
| Preview panel package                                                                     | Optional                       | No                       | Environment-gated dynamic import of `@contentful/optimization-web-preview-panel`               |
| Strict pre-consent event policy, cookie settings, queue policy, and CSP nonce             | Advanced or production-only    | No                       | `OptimizationRoot` config and preview-panel attach options                                     |
| Externally owned Web SDK instance                                                         | Advanced or production-only    | No                       | `OptimizationProvider sdk={...}` with `LiveUpdatesProvider`                                    |

For the preferred JavaScript path, create the `contentful.js` client in your app and pass it to
`OptimizationRoot` through `contentful: { client, defaultQuery?, cache? }`. Manual `baselineEntry`
rendering remains supported when the app fetches entries outside the SDK.

## Core integration

### Install and initialize the React provider

**Integration category:** Required for first integration

`OptimizationRoot` is the normal React entry point. It composes `OptimizationProvider` and
`LiveUpdatesProvider`, creates the underlying Web SDK instance after React commit, withholds
children until the SDK is ready, and destroys the owned SDK instance on unmount.

1. Install the package in the application that owns the React tree.
2. Mount `OptimizationRoot` once around all components that call React Web SDK hooks.
3. Pass `clientId`, `environment`, and the application locale that matches your Contentful fetches.
4. Pass `api` endpoints only when your app uses non-default Experience API or Insights API hosts.
5. Use `useOptimizationActions()` for destructurable SDK actions. Use `useOptimization()` when a
   component needs the SDK instance itself.

**Adapt this to your use case:**

```tsx
import { OptimizationRoot, useOptimizationActions } from '@contentful/optimization-react-web'
import type { ReactNode } from 'react'

function PurchaseButton() {
  // Bound action hooks are safe to destructure from React components.
  const { trackEvent } = useOptimizationActions()

  return (
    <button
      onClick={() => {
        void trackEvent({ event: 'purchase' })
      }}
      type="button"
    >
      Buy now
    </button>
  )
}

export function AppRoot({ children }: { children: ReactNode }) {
  return (
    <OptimizationRoot
      clientId={import.meta.env.PUBLIC_CONTENTFUL_OPTIMIZATION_CLIENT_ID}
      environment={import.meta.env.PUBLIC_CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main'}
      locale="en-US"
      app={{
        name: 'my-react-app',
        version: '1.0.0',
      }}
      // Override API endpoints only for non-default staging, production, or mock hosts.
      api={{
        experienceBaseUrl: import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL,
        insightsBaseUrl: import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL,
      }}
      logLevel="warn"
    >
      {children}
    </OptimizationRoot>
  )
}
```

Do not destructure methods from the object returned by `useOptimization()`. Those methods rely on
the SDK instance binding. `useOptimizationActions()` returns bound actions that are safe to
destructure, including `setConsent`, `flushEvents`, `identifyUser`, `trackPageView`, `resetUser`,
`trackScreen`, and `trackEvent`. Use `useOptimizationContext()` when a component needs
`{ sdk, error }` for diagnostics or error rendering before the SDK is available.

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy belongs to your application. The SDK stores event consent, stores separate
profile-continuity persistence consent, and blocks non-allowed event types until event consent is
accepted.

1. If policy permits Optimization by default, seed accepted consent during provider setup.
2. If policy depends on user choice, leave consent unset and call `consent(true | false)` from the
   banner, CMP callback, or account settings flow that owns the user's decision.
3. Use object-form consent only when events and durable profile continuity have different policy
   decisions.
4. Use state hooks to render consent state in React UI.

**Copy this:**

```tsx
<OptimizationRoot clientId="your-client-id" defaults={{ consent: true }}>
  <YourApp />
</OptimizationRoot>
```

**Adapt this to your use case:**

```tsx
import { useConsentState, useOptimizationActions } from '@contentful/optimization-react-web'

function ConsentControls() {
  const consentState = useConsentState()
  const { setConsent } = useOptimizationActions()

  return (
    <div>
      <span>Consent: {String(consentState)}</span>
      <button onClick={() => setConsent(true)} type="button">
        Accept
      </button>
      <button onClick={() => setConsent(false)} type="button">
        Reject
      </button>
      {/* Accept events while keeping durable profile continuity disabled. */}
      <button onClick={() => setConsent({ events: true, persistence: false })} type="button">
        Events only
      </button>
    </div>
  )
}
```

Boolean consent calls update event consent and durable profile-continuity consent together. By
default, the Web SDK permits only `identify` and `page` before consent is explicitly set. Configure
`allowedEventTypes={[]}` when your application needs strict opt-in before any Optimization event.
For the cross-SDK policy model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful client configuration and locale shape

**Integration category:** Required for first integration

The preferred React Web path uses an app-owned `contentful.js` client configured on
`OptimizationRoot`. The SDK-managed entry fetch expects the standard single-locale CDA entry shape
with direct field values, including linked optimization fields such as `fields.nt_experiences` and
`fields.nt_variants`.

1. Choose the application Contentful locale in your router, i18n layer, or app configuration.
2. Pass that locale through `contentful.defaultQuery` on `OptimizationRoot`, per-entry `entryQuery`,
   or manual CDA requests.
3. Pass the same locale to `OptimizationRoot` when Experience API responses and event context need
   to match rendered content.
4. Fetch optimized entries with `include: 10` so linked optimization and variant entries are
   resolved before React renders.
5. Do not pass `withAllLocales` or raw CDA `locale=*` responses to `OptimizedEntry`,
   `useOptimizedEntry`, or `useEntryResolver()`.

**Adapt this to your use case:**

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { createClient } from 'contentful'

const APP_LOCALE = 'en-US'
const INCLUDE_DEPTH = 10

const contentfulClient = createClient({
  accessToken: import.meta.env.PUBLIC_CONTENTFUL_TOKEN,
  environment: import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
  space: import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID,
})

export function AppRoot() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      contentful={{
        client: contentfulClient,
        // Resolve linked optimization data in one CDA locale.
        defaultQuery: { include: INCLUDE_DEPTH, locale: APP_LOCALE },
      }}
      locale={APP_LOCALE}
    >
      <YourApp />
    </OptimizationRoot>
  )
}
```

When the locale changes after provider initialization, `OptimizationRoot` calls
`optimization.setLocale(nextLocale)`. That updates SDK Experience API and event locale state. Your
application still needs to refetch Contentful entries, call `page()` or `identify()` again when
needed, and rerender localized content. For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` resolves a Contentful entry against selected optimization state and renders either
the selected variant or the baseline entry.

1. Use `entryId` for SDK-managed fetching when `OptimizationRoot` has `contentful: { client }`.
2. Use `entryQuery` for per-entry query overrides such as a route-specific locale.
3. Use `errorFallback` and `onEntryError` for managed CDA failures.
4. Pass `baselineEntry` when the app fetches entries outside the SDK.
5. Use a render prop when the rendered UI depends on the resolved entry.
6. Use `loadingFallback` when you want temporary custom loading UI while optimization state is
   unresolved.
7. Use `useOptimizedEntry()` only when a component needs direct access to loading, presentation
   readiness, or selected-optimization metadata.

Replace `reportContentfulEntryError` in the example with your app-owned logging or monitoring
function.

**Adapt this to your use case:**

```tsx
<OptimizedEntry
  entryId="hero-entry"
  entryQuery={{ locale: APP_LOCALE }}
  errorFallback={() => <HeroFallback />}
  loadingFallback={() => <HeroSkeleton />}
  onEntryError={(error) => reportContentfulEntryError(error)}
>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</OptimizedEntry>
```

For manual fetching, keep passing the app-fetched baseline entry:

**Adapt this to your use case:**

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'
import type { Entry } from 'contentful'

function HeroSection({ baselineEntry }: { baselineEntry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry} loadingFallback={() => <p>Loading...</p>}>
      {(resolvedEntry) => (
        <article>
          <h1>{String(resolvedEntry.fields.title ?? '')}</h1>
          <p>{String(resolvedEntry.fields.description ?? '')}</p>
        </article>
      )}
    </OptimizedEntry>
  )
}
```

`OptimizedEntry` wraps content in a layout-neutral `div` with `display: contents` by default. Use
the `as` prop when the wrapper must be another element, such as `span`. `OptimizedEntry` can also
receive direct React node children when the markup does not need to read the resolved entry. In that
case, the wrapper still resolves entry metadata and emits tracking attributes after loading
completes.

With a custom `loadingFallback`, `OptimizedEntry` renders that fallback while optimization state is
unresolved, then reveals baseline content if resolution is still unavailable after 5 seconds.
Without a custom fallback, `OptimizedEntry` uses the baseline render output as a hidden
loading-layout target during the same unresolved window, then reveals it after the same timeout.

For optimized entries, unresolved means the SDK has not received a successful or failed Experience
API outcome and selected optimizations are not available. Entries without optimization references
render after SDK initialization.

**Adapt this to your use case:**

```tsx
import { useOptimizedEntry } from '@contentful/optimization-react-web'
import type { Entry } from 'contentful'

function DebuggableHero({ baselineEntry }: { baselineEntry: Entry }) {
  const { entry, isLoading, selectedOptimization } = useOptimizedEntry({
    baselineEntry,
    // React to profile or preview changes instead of locking to the first resolved value.
    liveUpdates: true,
  })

  if (isLoading) return <p>Loading...</p>

  return (
    <article data-variant-index={selectedOptimization?.variantIndex}>
      <h1>{String(entry.fields.title ?? '')}</h1>
    </article>
  )
}
```

Nested optimized entries are supported when each nested wrapper has a different baseline entry ID.
The SDK blocks a nested `OptimizedEntry` that repeats the same baseline entry ID as an ancestor to
avoid duplicate resolution loops. For deeper mechanics, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md).

### Page events and route tracking

**Integration category:** Required for first integration

The SDK needs page events to evaluate the route-like experience the visitor is viewing. React Web
provides router adapters for common client-side routers and
`useOptimizationActions().trackPageView()` for manual emission.

1. Mount one page tracker inside `OptimizationRoot` and inside the router context it reads.
2. Use the adapter that matches your router.
3. Use `pagePayload` for static event fields and `getPagePayload` for fields derived from the route
   context.
4. For applications without a supported router, call `page()` from an app-owned route-change effect.

| Router               | Import path                                                 | Mounting rule                                                          |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| React Router         | `@contentful/optimization-react-web/router/react-router`    | Mount under a React Router data router that supports `useMatches()`    |
| Next.js Pages Router | `@contentful/optimization-react-web/router/next-pages`      | Mount once in `pages/_app.tsx`; the adapter waits for `router.isReady` |
| Next.js App Router   | `@contentful/optimization-react-web/router/next-app`        | Mount in a `'use client'` provider under the App Router tree           |
| TanStack Router      | `@contentful/optimization-react-web/router/tanstack-router` | Mount under the TanStack router tree                                   |

**Adapt this to your use case:**

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

function RootLayout() {
  return (
    <OptimizationRoot clientId="your-client-id">
      {/* Keep one tracker per router tree to avoid duplicate route page events. */}
      <ReactRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ProductsPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
```

Router adapters emit on the first eligible render and on route-key changes. The Web SDK deduplicates
identical consecutive route keys, including React Strict Mode remounts. Next.js Pages and Next.js
App adapters also accept `initialPageEvent="skip"` for integrations where a server-side path already
emitted the first page event.

**Follow this pattern:**

```tsx
<ReactRouterAutoPageTracker
  pagePayload={{
    properties: {
      appSection: 'storefront',
    },
  }}
  getPagePayload={({ context, isInitialEmission }) => ({
    // Later payload layers override router-derived values on key conflicts.
    locale: isInitialEmission ? 'en-US' : undefined,
    properties: {
      path: context.url,
      pathname: context.pathname,
    },
  })}
/>
```

Router-derived payload, static `pagePayload`, and dynamic `getPagePayload` are deep-merged in that
order. Later values win on key conflicts.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` emits the Web SDK's `data-ctfl-*` attributes on resolved content. The Web SDK can
then track entry views, clicks, and hovers automatically.

1. Leave the default view, click, and hover interactions enabled when your consent policy permits
   them; use `trackEntryInteraction` only to opt out of interaction types the app must not observe.
2. Use `clickable`, `trackViews`, `trackClicks`, `trackHovers`, and duration props when one entry
   needs per-component behavior.
3. Use `sdk.tracking.enableElement()` only when the DOM structure does not fit automatic
   observation.
4. Avoid tracking loading fallbacks as content exposure. `OptimizedEntry` omits resolved tracking
   attributes while the loading fallback is shown.

**Adapt this to your use case:**

```tsx
<OptimizationRoot clientId="your-client-id" trackEntryInteraction={{ hovers: false }}>
  <OptimizedEntry
    baselineEntry={entry}
    clickable
    hoverDurationUpdateIntervalMs={1000}
    viewDurationUpdateIntervalMs={1000}
  >
    {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

When `trackEntryInteraction` is omitted, the React provider enables view, click, and hover tracking.
The wrapper attributes include baseline entry ID, resolved entry ID, variant index, optimization ID
when a variant is selected, sticky state, duplication scope when present, and a generated
optimization context ID used by follow-up events.

For manual element tracking, resolve entry metadata with `useOptimizedEntry()`. `useEntryResolver()`
is a direct resolver helper and does not rerender the component when selected optimizations change.

**Adapt this to your use case:**

```tsx
import { useOptimization, useOptimizedEntry } from '@contentful/optimization-react-web'
import type { Entry } from 'contentful'
import { useEffect, useRef } from 'react'

function ManuallyTrackedEntry({ baselineEntry }: { baselineEntry: Entry }) {
  const sdk = useOptimization()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const {
    entry,
    isLoading,
    resolvedData: { optimizationContextId },
    selectedOptimization,
  } = useOptimizedEntry({
    baselineEntry,
    // Subscribe to SDK state so manual tracking uses current variant metadata.
    liveUpdates: true,
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element || isLoading) return

    sdk.tracking.enableElement('views', element, {
      // Explicit data is used when automatic data-ctfl-* attributes are not on this element.
      data: {
        entryId: entry.sys.id,
        optimizationContextId,
        optimizationId: selectedOptimization?.experienceId,
        sticky: selectedOptimization?.sticky,
        variantIndex: selectedOptimization?.variantIndex,
      },
    })

    return () => {
      // Clear the override so recycled DOM nodes do not keep stale entry data.
      sdk.tracking.clearElement('views', element)
    }
  }, [
    entry.sys.id,
    isLoading,
    optimizationContextId,
    sdk.tracking,
    selectedOptimization?.experienceId,
    selectedOptimization?.sticky,
    selectedOptimization?.variantIndex,
  ])

  if (isLoading) return null

  return <div ref={containerRef}>{String(entry.fields.title ?? '')}</div>
}
```

For detector behavior, data attributes, and duplicate-delivery concerns, see
[Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

### Identity, profile state, and reset

**Integration category:** Common but policy-dependent

Identify a visitor only when your application knows the user or has policy-approved traits to send.
Reset profile state when the active visitor changes, logs out, or must no longer share the previous
profile state.

1. Call `identifyUser()` from the account, session, or profile event that owns the identity
   decision.
2. Render SDK state with dedicated hooks such as `useProfileState()` and
   `useSelectedOptimizationsState()`.
3. Call `resetUser()` when identity changes require clearing profile, selected optimizations,
   changes, and route dedupe state. Consent state is preserved.
4. Re-emit `trackPageView()` or `identifyUser()` after reset when the app needs fresh optimization
   state.

**Adapt this to your use case:**

```tsx
import {
  useOptimizationActions,
  useProfileState,
  useSelectedOptimizationsState,
} from '@contentful/optimization-react-web'

function AccountState() {
  const { identifyUser, resetUser } = useOptimizationActions()
  const profile = useProfileState()
  const selectedOptimizations = useSelectedOptimizationsState()

  return (
    <div>
      <span>Profile: {profile?.id ?? 'anonymous'}</span>
      <span>Optimizations: {selectedOptimizations?.length ?? 0}</span>
      <button
        onClick={() => {
          void identifyUser({ userId: 'user-123', traits: { plan: 'pro' } })
        }}
        type="button"
      >
        Identify
      </button>
      <button onClick={() => resetUser()} type="button">
        Reset
      </button>
    </div>
  )
}
```

For cross-runtime identity behavior, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

## Optional integrations

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags when Contentful Rich Text contains embedded personalization fields. Use Custom Flags
when application UI branches on a named flag rather than an optimized entry.

1. For optimized entry content, read `getMergeTagValue` from the `OptimizedEntry` render context and
   pass it into your app-owned Rich Text renderer.
2. Use `useMergeTagResolver()` only when a component resolves merge tags outside an `OptimizedEntry`
   render prop.
3. Use `optimization.getFlag(name)` only for direct reads, such as event handlers or render paths
   that don't need to update when the flag changes.
4. Subscribe to `optimization.states.flag(name)` when React UI must rerender after profile, route,
   or preview changes update the flag value.
5. Treat flag reads as analytics exposure. In the stateful Web runtime, reading a flag can emit
   flag-view tracking when consent allows it.

**Adapt this to your use case:**

```tsx
import {
  OptimizedEntry,
  type OptimizedEntryRenderContext,
  useMergeTagResolver,
  useOptimization,
} from '@contentful/optimization-react-web'
import type { Entry } from 'contentful'
import { useEffect, useState } from 'react'

type GetMergeTagValue = OptimizedEntryRenderContext['getMergeTagValue']

function RichTextRenderer({
  getMergeTagValue,
  mergeTagEntry,
}: {
  getMergeTagValue: GetMergeTagValue
  mergeTagEntry: Entry
}) {
  // Call this from the Rich Text embedded-entry renderer that visits merge-tag entries.
  return <span>{getMergeTagValue(mergeTagEntry) ?? ''}</span>
}

function PersonalizedEntry({
  baselineEntry,
  mergeTagEntry,
}: {
  baselineEntry: Entry
  mergeTagEntry: Entry
}) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry}>
      {(resolvedEntry, { getMergeTagValue }) => (
        <article>
          <h1>{String(resolvedEntry.fields.title ?? '')}</h1>
          <RichTextRenderer getMergeTagValue={getMergeTagValue} mergeTagEntry={mergeTagEntry} />
        </article>
      )}
    </OptimizedEntry>
  )
}

function StandalonePersonalizedRichText({ mergeTagEntry }: { mergeTagEntry: Entry }) {
  const { getMergeTagValue } = useMergeTagResolver()

  return <span>{getMergeTagValue(mergeTagEntry) ?? ''}</span>
}

function DirectFlaggedBanner() {
  const optimization = useOptimization()
  // Direct reads are nonreactive; this component does not subscribe to later flag changes.
  const showBanner = optimization.getFlag('seasonal-banner') === true

  return showBanner ? <SeasonalBanner /> : null
}

function ReactiveFlaggedBanner() {
  const optimization = useOptimization()
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const seasonalBannerFlag = optimization.states.flag('seasonal-banner')
    const subscription = seasonalBannerFlag.subscribe((value) => {
      setShowBanner(value === true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [optimization])

  return showBanner ? <SeasonalBanner /> : null
}
```

Merge tag values follow the localized profile fields returned by the Experience API. Keep the SDK
locale aligned with the Contentful entry locale when the rendered language matters.

### Live updates

**Integration category:** Optional

Live updates control whether `OptimizedEntry` and `useOptimizedEntry()` keep reacting to SDK state
changes or lock to the first resolved selected-optimization state.

1. Leave `liveUpdates` unset for the default locked behavior.
2. Set `liveUpdates` on `OptimizationRoot` when all entries that inherit the global setting need to
   update as profile or preview state changes.
3. Set `liveUpdates` on a specific `OptimizedEntry` when that entry needs a different behavior.
4. Expect the preview panel to force live updates while it is open.

**Follow this pattern:**

```tsx
<OptimizationRoot clientId="your-client-id" liveUpdates={globalLiveUpdates}>
  <OptimizedEntry baselineEntry={entry}>
    {(resolvedEntry) => <InheritsGlobalSetting entry={resolvedEntry} />}
  </OptimizedEntry>

  <OptimizedEntry baselineEntry={entry} liveUpdates={true}>
    {(resolvedEntry) => <AlwaysLive entry={resolvedEntry} />}
  </OptimizedEntry>

  <OptimizedEntry baselineEntry={entry} liveUpdates={false}>
    {(resolvedEntry) => <LockedAfterFirstResolution entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

The effective order is preview panel open, component `liveUpdates` prop, root `liveUpdates` prop,
then the default locked behavior.

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app already sends approved events to a tag manager, customer-data
platform, or analytics destination. The Optimization SDK still sends events to Contentful.

1. Subscribe to `states.eventStream` in `onStatesReady` so router adapters and child effects cannot
   emit before the forwarding subscriber exists.
2. Filter the event fields your governance policy permits.
3. Deduplicate exact event records by `messageId` before forwarding so current snapshots, subscriber
   remounts, retries, or duplicate browser deliveries do not resend the same SDK event record.
4. Store forwarded message IDs in module or app state so remounts do not forward the same event
   again. If the destination must receive only future SDK events, read the current `messageId`
   before subscribing and skip that event.
5. Add semantic exposure dedupe when the destination wants one exposure for a sticky view or view
   lifecycle. Use fields such as `viewId`, `componentId`, `experienceId`, and `variantIndex`.
6. Subscribe to `states.blockedEventStream` when you need diagnostics for events blocked by consent
   or `allowedEventTypes`.

In this example, `canForwardSdkEvent()` enforces your governance and consent allow-list,
`shouldForwardContentfulEvent()` applies destination-specific semantic dedupe, and
`pickContentfulEventProperties()` maps only approved fields.

**Follow this pattern:**

```tsx
const forwardedMessageIds = new Set<string>()

<OptimizationRoot
  clientId="your-client-id"
  onStatesReady={(states) => {
    // Register before children mount so router and child events can be observed.
    const initialMessageId = states.eventStream.current?.messageId

    const eventSubscription = states.eventStream.subscribe((event) => {
      if (!event) return
      // Deduplicate locally before forwarding to external destinations.
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

    return () => eventSubscription.unsubscribe()
  }}
>
  <ReactRouterAutoPageTracker />
  <YourApp />
</OptimizationRoot>
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for vendor mappings, consent boundaries, helper functions, and dedupe guidance.

### Preview panel

**Integration category:** Optional

The preview panel is a separate browser package for authoring and staging workflows. It appends a
Lit-based panel to `document.body`, reads preview definitions from a Contentful client or
pre-fetched entries, and talks to the Web SDK through the browser preview bridge.

1. Install `@contentful/optimization-web-preview-panel`.
2. Gate the dynamic import behind an environment variable so production bundles can remove it.
3. Attach the panel after the Web SDK instance exists and either a Contentful client or pre-fetched
   preview entries are available. `onStatesReady` is a good React Web setup point.
4. Pass a CSP nonce when strict Content Security Policy rules require one.

**Adapt this to your use case:**

```tsx
import { createScopedLogger } from '@contentful/optimization-react-web/logger'
import { OptimizationRoot } from '@contentful/optimization-react-web'

const previewPanelLogger = createScopedLogger('PreviewPanel')

function attachPreviewPanel(): void {
  // Keep preview code behind an environment gate so production bundles can remove it.
  if (import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'true') return

  void import('@contentful/optimization-web-preview-panel')
    .then(async ({ default: attachOptimizationPreviewPanel }) => {
      await attachOptimizationPreviewPanel({
        contentful: contentfulClient,
        nonce: import.meta.env.PUBLIC_CSP_NONCE,
      })
    })
    .catch((error: unknown) => {
      previewPanelLogger.warn('Failed to attach the preview panel.', error)
    })
}

export function App() {
  return (
    // onStatesReady runs after the SDK exists and before child effects can emit events.
    <OptimizationRoot clientId="your-client-id" onStatesReady={attachPreviewPanel}>
      <YourApp />
    </OptimizationRoot>
  )
}
```

By default, the attach function uses `window.contentfulOptimization`, which the Web SDK-owned
provider instance creates in the browser. If your app injects an SDK instance that is not available
through that singleton, pass `optimization` to `attachOptimizationPreviewPanel(...)`.

If your app already loads preview definitions through GraphQL, a loader, SSR handoff, tag-filtered
queries, or a proxy API, pass `entries: { audiences, experiences }` instead of `contentful`.
`audiences` and `experiences` can be Contentful-style entry collections or arrays of Contentful
entries. When `entries` is provided, the preview panel does not fetch through `contentful`.

## Advanced integrations

### Existing SDK instance ownership

**Integration category:** Advanced or production-only

Use `OptimizationProvider` directly when an application or framework adapter must create and own the
Web SDK instance outside React.

1. Create the Web SDK instance outside the provider.
2. Pass it through `OptimizationProvider sdk={optimization}`.
3. Wrap children with `LiveUpdatesProvider` if components use `OptimizedEntry`, `useOptimizedEntry`,
   or `useLiveUpdates`.
4. Destroy the injected SDK instance in the owner that created it. The provider does not call
   `destroy()` for injected instances.

**Adapt this to your use case:**

```tsx
import ContentfulOptimization from '@contentful/optimization-web'
import { LiveUpdatesProvider, OptimizationProvider } from '@contentful/optimization-react-web'

const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  environment: 'main',
})

function App() {
  return (
    <OptimizationProvider sdk={optimization}>
      <LiveUpdatesProvider>
        <YourApp />
      </LiveUpdatesProvider>
    </OptimizationProvider>
  )
}
```

Injected SDK children render immediately only when no provider-managed state setup is needed. When
`onStatesReady` or `serverOptimizationState` is provided, the provider waits for that setup before
children mount.

### Strict consent, storage, and delivery controls

**Integration category:** Advanced or production-only

Use these controls when legal, infrastructure, or production reliability requirements need behavior
beyond the default setup.

1. Set `allowedEventTypes={[]}` when no Optimization event can emit before explicit consent.
2. Use `cookie` when the anonymous ID cookie needs a specific domain or expiration.
3. Use `queuePolicy` when the default retry and offline queue behavior does not match application
   limits.
4. Use `onEventBlocked` and `states.blockedEventStream` for diagnostics when consent or
   `allowedEventTypes` block events.
5. Use event return values, SDK logs, queue callbacks, detector state, or app-owned diagnostics for
   other guard or suppression cases.
6. Pass preview-panel `nonce` or set `window.litNonce` before attaching the panel when CSP requires
   nonced styles.

**Follow this pattern:**

```tsx
<OptimizationRoot
  clientId="your-client-id"
  // Blocks all Optimization events before explicit consent is accepted.
  allowedEventTypes={[]}
  cookie={{
    domain: '.example.com',
    expires: 180,
  }}
  queuePolicy={{
    offlineMaxEvents: 100,
  }}
  onEventBlocked={(event) => {
    diagnostics.logBlockedOptimizationEvent(event)
  }}
>
  <YourApp />
</OptimizationRoot>
```

The Web SDK stores consent and, when persistence consent permits it, profile continuity state in
browser storage. If storage writes fail, the SDK continues with in-memory state.

### Runtime boundaries

**Integration category:** Advanced or production-only

React Web is a browser-side React package. Classify these concerns before adding extra packages or
custom adapters:

- Server-side personalization, request cookie handling, and SSR-to-browser takeover belong in the
  Next.js App Router or Pages Router guides, not in this React Web-only guide.
- Direct Web Components are part of `@contentful/optimization-web`, not the React Web rendering
  surface. React components can use `OptimizedEntry` instead of custom elements.
- The React Web SDK does not replace your Contentful CDA client, router, consent UI, identity
  system, or analytics destination.
- The preview panel is intended for authoring, development, and staging workflows. Gate it from
  production bundles unless your release policy explicitly allows it.

## Production checks

Before releasing a React Web SDK integration, verify these checks:

- Credentials and runtime configuration: `clientId`, environment, Contentful space, Contentful
  access token, CDA host, Experience API URL, Insights API URL, and locale all point to the intended
  environment.
- Consent behavior: default-on or opt-in behavior matches application policy, `allowedEventTypes`
  matches the pre-consent posture, and consent revocation blocks non-allowed events.
- Event delivery: first page event, route-change page event, identify event, and any enabled view,
  click, hover, flag, or custom tracking event appear in the expected SDK event stream or
  destination debugger.
- Content fallback behavior: entries without optimization references render baseline content,
  optimized entries stop showing loading fallback after presentation readiness or the 5-second
  baseline reveal, and all-locale CDA responses are not passed to entry resolvers.
- Duplicate tracking prevention: one page tracker is mounted per router tree, Strict Mode remounts
  do not duplicate page events, analytics forwarding deduplicates exact records by `messageId`,
  sticky-view exposure forwarding uses semantic dedupe when the destination wants one exposure, and
  manual element tracking clears overrides on unmount.
- Privacy and governance: forwarded analytics fields are approved, durable profile continuity uses
  policy-approved consent, reset runs when identity changes, and preview panel code is environment
  gated.
- Local validation path: run your app's typecheck, build, and route or interaction smoke tests. In
  this repository, the React Web reference implementation uses these checks.

For typecheck and production-build validation:

**Copy this:**

```sh
pnpm implementation:run -- react-web-sdk typecheck
pnpm implementation:run -- react-web-sdk build
```

For route or interaction smoke coverage:

**Copy this:**

```sh
pnpm test:e2e:react-web-sdk
```

## Troubleshooting

| Symptom                                                       | Likely cause                                                                                                                                                                         | Fix                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `useOptimization must be used within an OptimizationProvider` | A hook is rendering outside `OptimizationRoot` or `OptimizationProvider`                                                                                                             | Move the provider above that component tree                                                                   |
| `ContentfulOptimization is already initialized`               | The app created more than one owned Web SDK instance in the same browser runtime                                                                                                     | Keep one `OptimizationRoot`, or inject a single shared SDK instance                                           |
| `OptimizedEntry` renders baseline content only                | No page or identify event has produced selected optimizations, consent blocks the event, the entry has no optimization references, or the Contentful response uses all-locale fields | Verify consent, page event emission, entry links, `include: 10`, and single-locale CDA fetches                |
| Automatic view, click, or hover events are missing            | Consent is not accepted, the interaction is opted out, the element is still in loading fallback, or the DOM target lacks the resolved attributes                                     | Check `trackEntryInteraction`, per-entry tracking props, consent state, and rendered `data-ctfl-*` attributes |
| Router page events fire more than expected                    | More than one tracker is mounted for the same router tree or manual `page()` calls duplicate adapter emissions                                                                       | Keep one adapter per router tree and centralize manual page emission                                          |
| Preview panel does not attach                                 | The package is not installed, the environment gate is false, the attach function runs before the Web SDK exists, or no singleton is available for an injected SDK                    | Attach from `onStatesReady`, verify the gate, and pass `optimization` when using an injected SDK instance     |

## Reference implementations to compare against

- [React Web SDK reference implementation](../../implementations/react-web-sdk/README.md) - Uses
  `OptimizationRoot`, `ReactRouterAutoPageTracker`, `OptimizedEntry`, live updates, merge tags,
  automatic and manual entry tracking, event-stream display, and environment-gated preview panel
  attachment.
- [Custom React Adapter Over Web SDK](../../implementations/web-sdk_react/README.md) - Builds a
  custom adapter on top of `@contentful/optimization-web` for comparison when an application needs
  full control instead of the official React Web SDK surface.
