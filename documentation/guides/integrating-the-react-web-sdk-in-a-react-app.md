# Integrating the Optimization React Web SDK in a React app

Use this guide when you want to add personalization and analytics to a React web application using
`@contentful/optimization-react-web`.

The React Web SDK wraps `@contentful/optimization-web` with React-specific providers, hooks,
components, and router adapters so React applications can integrate optimization without managing
SDK lifecycle and DOM wiring manually.

Use the lower-level Web SDK guide instead when your application is not React-based or when you want
to own the browser SDK integration without React abstractions.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Install and initialize with OptimizationRoot](#1-install-and-initialize-with-optimizationroot)
  - [Access the SDK instance with hooks](#access-the-sdk-instance-with-hooks)
  - [Provide a pre-built SDK instance when needed](#provide-a-pre-built-sdk-instance-when-needed)
- [2. Handle consent in React](#2-handle-consent-in-react)
  - [Reading consent state](#reading-consent-state)
  - [Updating consent](#updating-consent)
  - [Revoking consent](#revoking-consent)
  - [Consent-gated rendering](#consent-gated-rendering)
- [3. Personalize entries with OptimizedEntry](#3-personalize-entries-with-optimizedentry)
  - [Basic usage](#basic-usage)
  - [Loading fallback](#loading-fallback)
  - [Direct ReactNode children](#direct-reactnode-children)
  - [Wrapper element](#wrapper-element)
  - [Nested composition](#nested-composition)
  - [Imperative hook alternative](#imperative-hook-alternative)
- [4. Track entry interactions from React](#4-track-entry-interactions-from-react)
  - [Automatic tracking via OptimizedEntry](#automatic-tracking-via-optimizedentry)
  - [Manual tracking via the tracking API](#manual-tracking-via-the-tracking-api)
- [5. Emit page events with supported router adapters](#5-emit-page-events-with-supported-router-adapters)
  - [React router](#react-router)
  - [Next.js pages router](#nextjs-pages-router)
  - [Next.js app router](#nextjs-app-router)
  - [TanStack router](#tanstack-router)
  - [Page payload enrichment](#page-payload-enrichment)
- [Live updates](#live-updates)
  - [Global live updates](#global-live-updates)
  - [Per-component live updates](#per-component-live-updates)
  - [Preview panel override](#preview-panel-override)
  - [Resolution priority](#resolution-priority)
- [Preview panel](#preview-panel)
  - [Attaching the preview panel](#attaching-the-preview-panel)
  - [Content security policy support](#content-security-policy-support)
  - [Preview panel and live updates](#preview-panel-and-live-updates)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The React Web SDK is the React-specific package in the Optimization SDK Suite. It lets consumers:

- initialize and own a browser SDK instance through `OptimizationRoot` or explicit providers
- personalize Contentful entries with `OptimizedEntry` and `useOptimizedEntry`
- read consent, profile, flags, and selected optimizations from React-friendly hooks and state
- enable automatic entry interaction tracking without hand-authoring all `data-ctfl-*` attributes
- emit page events automatically through supported router adapters
- opt into live updates and attach the preview panel for authoring workflows
- fall back to the underlying Web SDK instance when lower-level control is needed

The React Web SDK is still browser-side and stateful because it sits on top of
`@contentful/optimization-web`. Your application still fetches Contentful entries, decides how
consent works, decides when a user becomes known, and controls where personalized content renders.

## The integration flow

In practice, most React integrations follow this high-level sequence:

1. Wrap the app with `OptimizationRoot` or `OptimizationProvider` + `LiveUpdatesProvider`.
2. Read the SDK through hooks such as `useOptimization()` or `useOptimizationContext()`.
3. Handle consent in application UI before enabling broader event collection.
4. Render personalized entries with `OptimizedEntry` or `useOptimizedEntry`.
5. Enable automatic or manual entry interaction tracking where needed.
6. Add a router adapter so `page()` events follow client-side navigation.

Optional additions include live updates when entries need to continuously react to optimization
state changes, and the preview panel when the application needs authoring or preview overrides.

The React-focused reference implementations in this repository show those patterns in working
applications:

- [React Web SDK reference](../../implementations/react-web-sdk/README.md)
- [Custom React Adapter Over Web SDK](../../implementations/web-sdk_react/README.md)

## 1. Install and initialize with OptimizationRoot

Install the React Web SDK:

```sh
pnpm add @contentful/optimization-react-web
```

Wrap your application tree with `OptimizationRoot`. This is the recommended entry point that
composes the `OptimizationProvider` and `LiveUpdatesProvider` internally:

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'

function App() {
  return (
    <OptimizationRoot clientId="your-client-id">
      <YourApp />
    </OptimizationRoot>
  )
}
```

That is the minimum viable setup. `OptimizationRoot` initializes the underlying Web SDK instance,
manages its lifecycle across React re-renders and StrictMode, and destroys the instance on unmount.

Available configuration props:

| Prop                        | Type                               | Required | Default   | Description                                    |
| --------------------------- | ---------------------------------- | -------- | --------- | ---------------------------------------------- |
| `clientId`                  | `string`                           | Yes      | N/A       | Your Contentful Optimization client identifier |
| `environment`               | `string`                           | No       | `'main'`  | Contentful environment                         |
| `api`                       | `CoreApiConfig`                    | No       | See below | Experience API and Insights API configuration  |
| `app`                       | `App`                              | No       | —         | Application metadata attached to events        |
| `autoTrackEntryInteraction` | `AutoTrackEntryInteractionOptions` | No       | —         | Automatic entry interaction tracking options   |
| `logLevel`                  | `LogLevels`                        | No       | `'error'` | Minimum log level for console output           |
| `liveUpdates`               | `boolean`                          | No       | `false`   | Enable global live updates                     |

A more complete initialization with explicit API endpoints and interaction tracking:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  environment="main"
  api={{
    insightsBaseUrl: 'https://ingest.insights.ninetailed.co/',
    experienceBaseUrl: 'https://experience.ninetailed.co/',
  }}
  autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
  logLevel="warn"
  app={{
    name: 'my-react-app',
    version: '1.0.0',
  }}
  liveUpdates={false}
>
  <YourApp />
</OptimizationRoot>
```

### Access the SDK instance with hooks

Inside the provider tree, use hooks to interact with the SDK:

- `useOptimization()` returns the initialized SDK surface. It throws if the provider is missing or
  the SDK is not ready.
- `useOptimizationContext()` returns `{ sdk, isReady, error }` without requiring readiness, which is
  useful for conditional rendering during initialization.

```tsx
import { useOptimization, useOptimizationContext } from '@contentful/optimization-react-web'

function MyComponent() {
  const { consent, identify, page, track, getFlag, resolveEntry } = useOptimization()
  // SDK is guaranteed to be ready here
}

function ConditionalComponent() {
  const { sdk, isReady, error } = useOptimizationContext()

  if (error) return <p>SDK failed: {error.message}</p>
  if (!isReady) return <p>Loading...</p>

  return <p>SDK ready</p>
}
```

### Provide a pre-built SDK instance when needed

If you need to manage the SDK instance outside of React, pass it directly via the `sdk` prop on
`OptimizationProvider` instead of using config props:

```tsx
import { OptimizationProvider, LiveUpdatesProvider } from '@contentful/optimization-react-web'
import ContentfulOptimization from '@contentful/optimization-web'

const optimization = new ContentfulOptimization({ clientId: 'your-client-id' })

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

When using the `sdk` prop, the provider does not own the instance lifecycle, so it will not call
`destroy()` on unmount.

## 2. Handle consent in React

The SDK gates certain event types behind a consent state. By default, only `identify` and `page`
events are allowed before consent is explicitly set. All other event types are blocked until the
user accepts or rejects consent.

### Reading consent state

Subscribe to consent state changes using the SDK's `states` observable:

```tsx
import { useOptimizationContext } from '@contentful/optimization-react-web'
import { useEffect, useState } from 'react'

function ConsentStatus() {
  const { sdk, isReady } = useOptimizationContext()
  const [consent, setConsent] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!sdk || !isReady) return

    const sub = sdk.states.consent.subscribe((value) => {
      setConsent(value)
    })

    return () => sub.unsubscribe()
  }, [sdk, isReady])

  return <p>Consent: {String(consent)}</p>
}
```

### Updating consent

Call `consent()` to accept or reject:

```tsx
import { useOptimization } from '@contentful/optimization-react-web'

function ConsentBanner() {
  const { consent } = useOptimization()

  return (
    <div>
      <p>We use cookies for personalization.</p>
      <button onClick={() => consent(true)}>Accept</button>
      <button onClick={() => consent(false)}>Reject</button>
    </div>
  )
}
```

When consent is accepted (`true`), all event types are permitted and any auto-enabled entry
interaction trackers are started. When consent is rejected (`false`), auto-enabled interaction
trackers are disabled and non-allowed event types are blocked.

### Revoking consent

To revoke consent after it was previously accepted:

```tsx
function RevokeConsent() {
  const { consent } = useOptimization()

  const handleRevoke = () => {
    consent(false)
  }

  return <button onClick={handleRevoke}>Revoke Consent</button>
}
```

### Consent-gated rendering

A common pattern is to gate personalization features on consent:

```tsx
function PersonalizedSection({ entry }) {
  const { sdk, isReady } = useOptimizationContext()
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    if (!sdk || !isReady) return

    const sub = sdk.states.consent.subscribe((value) => {
      setHasConsent(value === true)
    })

    return () => sub.unsubscribe()
  }, [sdk, isReady])

  if (!hasConsent) {
    return <BaselineContent entry={entry} />
  }

  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolved) => <PersonalizedContent entry={resolved} />}
    </OptimizedEntry>
  )
}
```

## 3. Personalize entries with OptimizedEntry

`OptimizedEntry` resolves a baseline Contentful entry to an optimized variant using the current
optimization state and renders the result.

### Basic usage

Pass a baseline entry fetched from Contentful (with `include: 10` to resolve linked optimization
data) and a render prop that receives the resolved entry:

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'

function HeroSection({ baselineEntry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry}>
      {(resolvedEntry) => (
        <div>
          <h1>{resolvedEntry.fields.title}</h1>
          <p>{resolvedEntry.fields.description}</p>
        </div>
      )}
    </OptimizedEntry>
  )
}
```

The component automatically determines readiness:

- entries with optimization references (`nt_experiences`) render when `canOptimize` is `true`
- entries without optimization references render after the SDK is initialized

By default, `OptimizedEntry` locks to the first non-`undefined` optimization state it receives. This
means that once an entry resolves to a variant, it stays locked to that variant for the lifetime of
the component (unless live updates are enabled).

### Loading fallback

When `loadingFallback` is provided, it renders while optimization state is unresolved:

```tsx
<OptimizedEntry
  baselineEntry={baselineEntry}
  loadingFallback={() => <Skeleton label="Loading personalized content" />}
>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</OptimizedEntry>
```

When no `loadingFallback` is provided, a default loading UI wraps the baseline content until
optimization readiness is available. Entries without optimization references skip loading and render
directly.

### Direct ReactNode children

`OptimizedEntry` also accepts direct `ReactNode` children when you do not need to read the resolved
entry:

```tsx
<OptimizedEntry baselineEntry={baselineEntry}>
  <StaticContent />
</OptimizedEntry>
```

In this case, the component still resolves the entry and emits tracking data attributes on the
wrapper, but the child content does not change based on the resolved variant.

### Wrapper element

The wrapper element defaults to `div` with `display: contents` to remain layout-neutral. Use the
`as` prop to change it:

```tsx
<OptimizedEntry baselineEntry={baselineEntry} as="span">
  {(resolvedEntry) => <InlineContent entry={resolvedEntry} />}
</OptimizedEntry>
```

### Nested composition

Nested optimized entries are supported through explicit composition:

```tsx
<OptimizedEntry baselineEntry={parentEntry}>
  {(resolvedParent) => (
    <ParentSection entry={resolvedParent}>
      <OptimizedEntry baselineEntry={childEntry}>
        {(resolvedChild) => <ChildSection entry={resolvedChild} />}
      </OptimizedEntry>
    </ParentSection>
  )}
</OptimizedEntry>
```

Nesting guard: nested wrappers with the same baseline entry ID as an ancestor are invalid and are
blocked at runtime. Nested wrappers with different baseline entry IDs remain supported.

### Imperative hook alternative

When you need more control, use `useOptimizedEntry` directly:

```tsx
import { useOptimizedEntry } from '@contentful/optimization-react-web'

function CustomEntry({ baselineEntry }) {
  const { entry, isLoading, isReady, canOptimize, resolvedData } = useOptimizedEntry({
    baselineEntry,
    liveUpdates: true,
  })

  if (isLoading) return <Skeleton />

  return (
    <div>
      <h1>{entry.fields.title}</h1>
      {resolvedData.selectedOptimization && (
        <span>Variant: {resolvedData.selectedOptimization.variantIndex}</span>
      )}
    </div>
  )
}
```

`useOptimizedEntry` returns:

| Property                | Type                                     | Description                                             |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `entry`                 | `Entry`                                  | The resolved entry (variant or baseline)                |
| `isLoading`             | `boolean`                                | `true` while optimization readiness is unresolved       |
| `isReady`               | `boolean`                                | `true` when the SDK is initialized                      |
| `canOptimize`           | `boolean`                                | `true` when selected optimizations are available        |
| `selectedOptimization`  | `SelectedOptimization \| undefined`      | The matched optimization for this entry, if any         |
| `resolvedData`          | `ResolvedData<EntrySkeletonType>`        | Full resolution result including entry and optimization |
| `selectedOptimizations` | `SelectedOptimizationArray \| undefined` | The locked (or live) selected optimizations snapshot    |

## 4. Track entry interactions from React

`OptimizedEntry` emits data attributes on its wrapper element that the Web SDK uses for automatic
entry interaction tracking (views, clicks, and hovers).

### Automatic tracking via OptimizedEntry

When resolved content renders, the wrapper element receives:

- `data-ctfl-entry-id` — always present
- `data-ctfl-optimization-id` — present when the entry is optimized
- `data-ctfl-sticky` — present when the optimization specifies stickiness
- `data-ctfl-variant-index` — present when the entry is optimized
- `data-ctfl-duplication-scope` — present when the optimization specifies a duplication scope

To make the Web SDK automatically track interactions with these attributed elements, enable
auto-tracking at initialization:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
>
  <YourApp />
</OptimizationRoot>
```

With this setup, any `OptimizedEntry` that renders resolved content will be automatically detected
and tracked for entry views, clicks, and hovers without additional code.

When `loadingFallback` is shown, resolved-content tracking attributes are not emitted, so loading
states are not tracked.

### Manual tracking via the tracking API

For entries that are not rendered through `OptimizedEntry`, use the `interactionTracking` API from
`useOptimization()`:

```tsx
import { useOptimization } from '@contentful/optimization-react-web'
import { useEffect, useRef } from 'react'

function ManuallyTrackedEntry({ entry }) {
  const { interactionTracking, resolveEntry, resolveEntryData } = useOptimization()
  const containerRef = useRef(null)
  const resolvedEntry = resolveEntry(entry)
  const { selectedOptimization } = resolveEntryData(entry)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    interactionTracking.enableElement('views', element, {
      data: {
        entryId: resolvedEntry.sys.id,
        optimizationId: selectedOptimization?.experienceId,
        sticky: selectedOptimization?.sticky,
        variantIndex: selectedOptimization?.variantIndex,
      },
    })

    return () => {
      interactionTracking.clearElement('views', element)
    }
  }, [interactionTracking, resolvedEntry.sys.id, selectedOptimization])

  return (
    <div ref={containerRef}>
      <p>{resolvedEntry.fields.text}</p>
    </div>
  )
}
```

Available interaction tracking methods:

| Method                                       | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `enableElement(interaction, element, opts?)` | Force-enable tracking for an element             |
| `disableElement(interaction, element)`       | Force-disable tracking for an element            |
| `clearElement(interaction, element)`         | Remove a manual override; fall back to automatic |

Supported `interaction` values: `'views'`, `'clicks'`, `'hovers'`.

## 5. Emit page events with supported router adapters

The React Web SDK ships router-specific auto page trackers as isolated subpath exports. Each adapter
automatically emits `page()` events when the route changes, so you do not need to call `page()`
manually.

Mount the appropriate adapter once inside your provider tree.

### React router

Requires `react-router-dom` >= 6.4 with a data router (`createBrowserRouter` + `RouterProvider`).
The adapter depends on `useMatches()`, so it does not work with a plain `BrowserRouter`.

```tsx
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'

function RootLayout() {
  return (
    <OptimizationRoot clientId="your-client-id">
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
      { path: 'about', element: <AboutPage /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}
```

Emits on first render and on `pathname + search + hash` changes.

### Next.js pages router

```tsx
import type { AppProps } from 'next/app'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextPagesAutoPageTracker } from '@contentful/optimization-react-web/router/next-pages'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <OptimizationRoot clientId="your-client-id">
      <NextPagesAutoPageTracker />
      <Component {...pageProps} />
    </OptimizationRoot>
  )
}
```

Mount once in `pages/_app.tsx`. The adapter waits for `router.isReady`, emits on the first eligible
render and on route changes, and suppresses duplicate consecutive `router.asPath` values.

### Next.js app router

```tsx
'use client'

import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/router/next-app'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OptimizationRoot clientId="your-client-id">
      <NextAppAutoPageTracker />
      {children}
    </OptimizationRoot>
  )
}
```

Mount in a `'use client'` component inside your App Router provider tree, typically via a
`providers.tsx` wrapper used by `app/layout.tsx`. Emits on first render and on `pathname + search`
changes.

### TanStack router

```tsx
import { Outlet } from '@tanstack/react-router'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { TanStackRouterAutoPageTracker } from '@contentful/optimization-react-web/router/tanstack-router'

function RootLayout() {
  return (
    <OptimizationRoot clientId="your-client-id">
      <TanStackRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}
```

Mount inside the TanStack router tree and inside the optimization provider tree, typically in your
root route component. Emits on first render and on TanStack Router `location.href` changes.

### Page payload enrichment

All router adapters support static and dynamic page payload enrichment:

```tsx
<ReactRouterAutoPageTracker
  pagePayload={{
    properties: {
      appSection: 'storefront',
    },
  }}
  getPagePayload={({ context, isInitialEmission }) => ({
    locale: isInitialEmission ? 'en-US' : undefined,
    properties: {
      path: context.url,
      pathname: context.pathname,
    },
  })}
/>
```

- `pagePayload` is included in every auto-emitted page event (static).
- `getPagePayload` runs once per emitted page event with route-aware context (dynamic).
- Static and dynamic payloads are deep-merged. When the same field exists in both, the dynamic
  payload wins.

The `context` shape varies by adapter:

| Adapter         | Context fields                                                                   |
| --------------- | -------------------------------------------------------------------------------- |
| React Router    | `hash`, `location`, `matches`, `pathname`, `routeKey`, `search`, `url`           |
| Next.js Pages   | `asPath`, `pathname`, `query`, `routeKey`, `router`                              |
| Next.js App     | `pathname`, `routeKey`, `router`, `search`, `searchParams`, `url`                |
| TanStack Router | `hash`, `location`, `matches`, `pathname`, `routeKey`, `router`, `search`, `url` |

## Live updates

Live updates control whether `OptimizedEntry` (and `useOptimizedEntry`) continuously reacts to
optimization state changes or locks to the first resolved state.

### Global live updates

Set `liveUpdates` on `OptimizationRoot` to enable live updates for all `OptimizedEntry` components
that do not specify their own `liveUpdates` prop:

```tsx
function App() {
  const [globalLiveUpdates, setGlobalLiveUpdates] = useState(false)

  return (
    <OptimizationRoot clientId="your-client-id" liveUpdates={globalLiveUpdates}>
      <button onClick={() => setGlobalLiveUpdates((prev) => !prev)}>
        Toggle Live Updates: {globalLiveUpdates ? 'ON' : 'OFF'}
      </button>
      <YourApp />
    </OptimizationRoot>
  )
}
```

### Per-component live updates

Override the global setting on individual `OptimizedEntry` components:

```tsx
<OptimizedEntry baselineEntry={entry} liveUpdates={true}>
  {(resolved) => <AlwaysLiveContent entry={resolved} />}
</OptimizedEntry>

<OptimizedEntry baselineEntry={entry} liveUpdates={false}>
  {(resolved) => <LockedContent entry={resolved} />}
</OptimizedEntry>

<OptimizedEntry baselineEntry={entry}>
  {(resolved) => <InheritsGlobalSetting entry={resolved} />}
</OptimizedEntry>
```

### Preview panel override

When the preview panel is open, live updates are forced on for all `OptimizedEntry` components
regardless of their `liveUpdates` prop or the global setting. This allows the preview panel to apply
variant overrides in real time.

### Resolution priority

The effective live updates state is resolved in this order:

1. If the preview panel is open → live updates are **on**
2. If the component has an explicit `liveUpdates` prop → that value is used
3. If neither → the global `liveUpdates` from `OptimizationRoot` is used
4. If nothing is set → live updates default to **off** (locked to first resolved state)

```tsx
import { useLiveUpdates } from '@contentful/optimization-react-web'

function LiveUpdatesStatus() {
  const { globalLiveUpdates, previewPanelVisible } = useLiveUpdates()

  return (
    <div>
      <p>Global live updates: {globalLiveUpdates ? 'ON' : 'OFF'}</p>
      <p>Preview panel visible: {previewPanelVisible ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

## Preview panel

The preview panel is a Web Component-based micro-frontend that lets content authors override
optimization variant selections locally without modifying production state. It is distributed as a
separate package.

### Attaching the preview panel

Install the preview panel package:

```sh
pnpm add @contentful/optimization-web-preview-panel
```

Import and attach it after the SDK is initialized. The preview panel requires both a Contentful
client (for fetching audience and optimization entries) and the SDK instance:

```tsx
import { useOptimizationContext } from '@contentful/optimization-react-web'
import { useEffect } from 'react'
import { createClient } from 'contentful'

const contentfulClient = createClient({
  accessToken: 'your-delivery-token',
  environment: 'main',
  space: 'your-space-id',
})

function PreviewPanelLoader() {
  const { sdk, isReady } = useOptimizationContext()

  useEffect(() => {
    if (!sdk || !isReady) return

    void import('@contentful/optimization-web-preview-panel').then(
      ({ default: attachOptimizationPreviewPanel }) => {
        attachOptimizationPreviewPanel({
          contentful:
            contentfulClient.withAllLocales.withoutLinkResolution.withoutUnresolvableLinks,
          optimization: sdk,
          nonce: undefined,
        }).catch((error) => {
          if (error.message?.includes('already been attached')) return
          console.error(error)
        })
      },
    )
  }, [sdk, isReady])

  return null
}
```

Mount `PreviewPanelLoader` inside your provider tree. The panel appends itself to `document.body`
and renders a toggle button to open and close the drawer.

The preview panel is intentionally tightly coupled to Web SDK internals. It uses symbol-keyed
preview bridges and state interceptors to read and mutate internal state for local preview
overrides. This coupling is deliberate and required for preview behavior parity.

### Content security policy support

In environments with strict CSP policies, pass a nonce:

```tsx
attachOptimizationPreviewPanel({
  contentful: contentfulClient.withAllLocales.withoutLinkResolution.withoutUnresolvableLinks,
  optimization: sdk,
  nonce: 'your-csp-nonce',
})
```

Alternatively, set the nonce on `window` before attaching:

```ts
window.litNonce = nonce
```

### Preview panel and live updates

When the preview panel is open, the `LiveUpdatesProvider` detects the `previewPanelOpen` state from
the SDK and forces live updates on for all `OptimizedEntry` components. This allows variant
selections made in the preview panel to be reflected immediately in the rendered content.

The `useLiveUpdates()` hook exposes the `previewPanelVisible` state:

```tsx
import { useLiveUpdates } from '@contentful/optimization-react-web'

function DebugPanel() {
  const { previewPanelVisible } = useLiveUpdates()

  return <p>Preview panel: {previewPanelVisible ? 'Open' : 'Closed'}</p>
}
```

## Reference implementations to compare against

Two reference implementations demonstrate these patterns in working applications:

- [`implementations/react-web-sdk`](../../implementations/react-web-sdk/README.md): uses
  `@contentful/optimization-react-web` directly with `OptimizationRoot`, `OptimizedEntry`, and
  `ReactRouterAutoPageTracker`
- [`implementations/web-sdk_react`](../../implementations/web-sdk_react/README.md): builds a custom
  React adapter layer on top of `@contentful/optimization-web` for applications that need full
  control over the integration
