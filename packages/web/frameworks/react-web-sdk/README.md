# React Web SDK

React Web SDK package for `@contentful/optimization-react-web`.

## Status

Core root/provider primitives and React-facing APIs are implemented.

- `OptimizationProvider` + `useOptimization()` context behavior
- `useOptimizationContext()` readiness/error access
- `LiveUpdatesProvider` + `useLiveUpdates()` global live updates context
- `OptimizationRoot` provider composition and defaults
- `useOptimizedEntry()` imperative personalization resolution
- `OptimizedEntry` entry resolution, lock/live-update behavior, loading fallback, and data-attribute
  mapping

## Purpose

`@contentful/optimization-react-web` is intended to become the React framework layer on top of
`@contentful/optimization-web`.

## Development

From repository root:

```sh
pnpm --filter @contentful/optimization-react-web build
pnpm --filter @contentful/optimization-react-web typecheck
pnpm --filter @contentful/optimization-react-web test:unit
pnpm --filter @contentful/optimization-react-web dev
```

From this package directory:

```sh
pnpm build
pnpm typecheck
pnpm test:unit
pnpm dev
```

## Current Contents

- package metadata and dual module exports
- `rslib`/`rsbuild`/`rstest`/TypeScript baseline aligned with Web SDK patterns
- core provider/root/context primitives in `src/`
- `Personalization` component with loading-state support and Web SDK data-attribute tracking
- scaffold dev dashboard harness in `dev/` for consent, identify/reset, state, events, and entries

## Usage

### Initialization

Pass configuration props directly to `OptimizationRoot` (recommended) or `OptimizationProvider`. The
SDK is initialized internally by the provider. `OptimizationProvider` can also receive a prebuilt
`sdk` instance when ownership needs to stay outside React.

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'

function App() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      analytics={{ baseUrl: 'https://ingest.insights.ninetailed.co/' }}
      personalization={{ baseUrl: 'https://experience.ninetailed.co/' }}
      liveUpdates={true}
    >
      <YourApp />
    </OptimizationRoot>
  )
}
```

Available config props:

| Prop                        | Type                                | Required | Description                                      |
| --------------------------- | ----------------------------------- | -------- | ------------------------------------------------ |
| `clientId`                  | `string`                            | Yes      | Your Contentful Optimization client identifier   |
| `environment`               | `string`                            | No       | Contentful environment (defaults to `'main'`)    |
| `analytics`                 | `CoreStatefulAnalyticsConfig`       | No       | Analytics/Insights API configuration             |
| `personalization`           | `CoreStatefulPersonalizationConfig` | No       | Personalization/Experience API configuration     |
| `app`                       | `App`                               | No       | Application metadata for events                  |
| `autoTrackEntryInteraction` | `AutoTrackEntryInteractionOptions`  | No       | Automatic entry interaction tracking options     |
| `logLevel`                  | `LogLevels`                         | No       | Minimum log level for console output             |
| `liveUpdates`               | `boolean`                           | No       | Enable global live updates (defaults to `false`) |

### Provider Composition

`OptimizationRoot` composition order:

1. `OptimizationProvider` (outermost)
2. `LiveUpdatesProvider`
3. application children

### Hooks

- `useOptimization()` returns the initialized `ContentfulOptimization` instance.
- `useOptimizationContext()` returns `{ sdk, isReady, error }` without requiring readiness.
- `useOptimizedEntry({ baselineEntry, liveUpdates })` returns resolved entry data and
  personalization state for imperative consumers.
- `useOptimization()` throws if used outside `OptimizationProvider`.
- `useOptimization()` also throws if the provider exists but the SDK is not ready.
- `useLiveUpdates()` throws if used outside `LiveUpdatesProvider`.

### Automatic Page Events

Router adapters are published as isolated subpath exports so applications can import only the router
they use.

The Next.js Pages Router adapter:

```tsx
import type { AppProps } from 'next/app'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextPagesAutoPageTracker } from '@contentful/optimization-react-web/router/next-pages'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      analytics={{ baseUrl: 'https://ingest.insights.ninetailed.co/' }}
      personalization={{ baseUrl: 'https://experience.ninetailed.co/' }}
    >
      <NextPagesAutoPageTracker />
      <Component {...pageProps} />
    </OptimizationRoot>
  )
}
```

Mount `NextPagesAutoPageTracker` once inside your provider tree, typically in `pages/_app.tsx`. The
adapter waits for `router.isReady`, emits on the first eligible render, emits on route changes, and
suppresses duplicate consecutive `router.asPath` values.

#### Page Payload Enrichment

Automatic page events can be enriched with static and dynamic payloads before calling
`optimization.page(...)`.

```tsx
<NextPagesAutoPageTracker
  pagePayload={{
    properties: {
      appSection: 'storefront',
    },
  }}
  getPagePayload={({ context, isInitialEmission }) => ({
    locale: isInitialEmission ? 'en-US' : undefined,
    properties: {
      path: context.asPath,
      routePattern: context.pathname,
      slug: Array.isArray(context.query.slug) ? context.query.slug.join('/') : context.query.slug,
    },
  })}
/>
```

- `pagePayload` is included in every auto-emitted page event.
- `getPagePayload` runs once per emitted page event with route-aware context.
- Static and dynamic payloads are merged before `optimization.page(...)` is called.
- When the same field exists in both payloads, the dynamic payload wins.
- This feature is implemented through page payload composition only; no interceptor setup is
  required or documented for it.

The package `dev/` harness remains an rsbuild React app and now mounts the React Router adapter for
interactive local verification. Other router adapters are still covered primarily through unit tests
and the integration examples above.

The Next.js App Router adapter:

```tsx
'use client'

import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/router/next-app'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      analytics={{ baseUrl: 'https://ingest.insights.ninetailed.co/' }}
      personalization={{ baseUrl: 'https://experience.ninetailed.co/' }}
    >
      <NextAppAutoPageTracker />
      {children}
    </OptimizationRoot>
  )
}
```

Mount `NextAppAutoPageTracker` once in a client component inside your App Router provider tree,
typically via a `providers.tsx` wrapper used by `app/layout.tsx`. The adapter emits on the first
eligible render and on `pathname + search` changes.

```tsx
<NextAppAutoPageTracker
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
      search: context.search,
    },
  })}
/>
```

App Router payload enrichment follows the same payload-composition behavior as the Pages Router
adapter and does not use interceptors.

The React Router adapter:

```tsx
import { Outlet } from 'react-router-dom'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'

export function AppLayout() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      analytics={{ baseUrl: 'https://ingest.insights.ninetailed.co/' }}
      personalization={{ baseUrl: 'https://experience.ninetailed.co/' }}
    >
      <ReactRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}
```

Mount `ReactRouterAutoPageTracker` once inside the `react-router-dom` router tree and inside the
optimization provider tree, typically in your root layout route. The adapter emits on the first
render and on `pathname + search + hash` changes.

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
      hash: context.hash,
      matchCount: context.matches.length,
      path: context.url,
      pathname: context.pathname,
    },
  })}
/>
```

React Router payload enrichment uses the same page-payload composition behavior and does not use
interceptors.

The TanStack Router adapter:

```tsx
import { Outlet } from '@tanstack/react-router'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { TanStackRouterAutoPageTracker } from '@contentful/optimization-react-web/router/tanstack-router'

export function RootLayout() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      analytics={{ baseUrl: 'https://ingest.insights.ninetailed.co/' }}
      personalization={{ baseUrl: 'https://experience.ninetailed.co/' }}
    >
      <TanStackRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}
```

Mount `TanStackRouterAutoPageTracker` once inside the TanStack router tree and inside the
optimization provider tree, typically in your root route component. The adapter emits on the first
render and on TanStack Router `location.href` changes.

```tsx
<TanStackRouterAutoPageTracker
  pagePayload={{
    properties: {
      appSection: 'storefront',
    },
  }}
  getPagePayload={({ context, isInitialEmission }) => ({
    locale: isInitialEmission ? 'en-US' : undefined,
    properties: {
      hash: context.hash,
      matchCount: context.matches.length,
      path: context.url,
      pathname: context.pathname,
      search: context.search,
    },
  })}
/>
```

TanStack Router payload enrichment also uses page-payload composition only and does not require
interceptors.

### Personalization Component

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'
;<OptimizedEntry baselineEntry={baselineEntry}>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</OptimizedEntry>
```

`OptimizedEntry` behavior:

- Default mode locks to the first non-`undefined` personalization state.
- `liveUpdates={true}` enables continuous updates as personalization state changes.
- If `liveUpdates` is omitted, global root `liveUpdates` is used.
- If both are omitted, live updates default to `false`.
- Consumer content supports render-prop (`(resolvedEntry) => ReactNode`) or direct `ReactNode`.
- Wrapper element is configurable with `as: 'div' | 'span'` (defaults to `div`).
- Wrapper style uses `display: contents` to remain layout-neutral as much as possible.
- Readiness is inferred automatically:
  - personalized entries render when `canPersonalize === true`
  - non-personalized entries render when the SDK instance is initialized

#### Loading Fallback

When `loadingFallback` is provided, it is rendered while readiness is unresolved.

```tsx
<OptimizedEntry
  baselineEntry={baselineEntry}
  loadingFallback={() => <Skeleton label="Loading personalized content" />}
>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</OptimizedEntry>
```

- If a baseline entry is personalizable and unresolved, loading UI is rendered by default.
- If the entry is not personalizable, baseline/resolved content is rendered directly.
- During loading, a concrete layout-target element is rendered (`data-ctfl-loading-layout-target`)
  so loading visibility/layout behavior remains targetable even when wrapper uses
  `display: contents`.
- During server rendering, unresolved loading is rendered invisibly (`visibility: hidden`) to
  preserve layout space before content is ready.

#### Nested Composition

Nested personalizations are supported by explicit composition:

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

Nesting guard behavior:

- Nested wrappers with the same baseline entry ID as an ancestor are invalid and are blocked.
- Nested wrappers with different baseline entry IDs remain supported.

#### Auto-Tracking Data Attributes

When resolved content is rendered, the wrapper emits attributes used by
`@contentful/optimization-web` automatic tracking:

- `data-ctfl-entry-id` (always present on resolved content wrapper)
- `data-ctfl-personalization-id` (when personalized)
- `data-ctfl-sticky` (when available)
- `data-ctfl-variant-index` (when personalized)
- `data-ctfl-duplication-scope` (when available)

To consume those attributes automatically, enable Web SDK auto-tracking with one of:

- `autoTrackEntryInteraction: { views: true }` during `OptimizationRoot` initialization
- `optimization.tracking.enable('views')` / equivalent runtime setup APIs when applicable

When `loadingFallback` is shown, resolved-content tracking attributes are not emitted.

### Live Updates Resolution Semantics

Consumers should resolve live updates behavior with:

```ts
const isLiveUpdatesEnabled =
  liveUpdatesContext.previewPanelVisible ||
  (componentLiveUpdates ?? liveUpdatesContext.globalLiveUpdates)
```

This gives:

- preview panel open override first
- component-level `liveUpdates` prop override first
- then root-level `liveUpdates`
- then default `false`

### SDK Initialization Contract

- Core/Web SDK initialization is synchronous; no dedicated `sdkInitialized` state is exposed.
- React provider initialization outcome is represented by instance creation success/failure.
- The async runtime path is preview panel lifecycle, already represented by preview panel state.

### Migration Notes

- `Personalization` now accepts either render-prop children or direct `ReactNode` children.
- Personalizable entries now render loading UI until personalization readiness is available.
- When no `loadingFallback` is provided, a default loading UI is rendered for unresolved
  personalizable entries.
- Nested wrappers with the same baseline entry ID are now blocked at runtime.
- Loading renders include `data-ctfl-loading-layout-target` for layout/visibility targeting.

## Singleton Behavior

The underlying `@contentful/optimization-web` SDK enforces a singleton pattern. Only one
`ContentfulOptimization` runtime can exist at a time (attached to `window.contentfulOptimization`).
Attempting to initialize a second runtime will throw an error.

When using the config-as-props pattern, the provider uses a `useRef` to ensure the instance is only
created once, even across React re-renders or StrictMode double-rendering.

## Testing

When testing components that use the Optimization providers, pass test config props:

```tsx
import { render } from '@testing-library/react'
import { OptimizationRoot } from '@contentful/optimization-react-web'

render(
  <OptimizationRoot
    clientId="test-client-id"
    environment="main"
    analytics={{ baseUrl: 'http://localhost:8000/insights/' }}
    personalization={{ baseUrl: 'http://localhost:8000/experience/' }}
  >
    <ComponentUnderTest />
  </OptimizationRoot>,
)
```
