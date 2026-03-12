# React Web SDK

React Web SDK package for `@contentful/optimization-react-web`.

## Status

Core root/provider primitives and the `Personalization` component are implemented.

- `OptimizationProvider` + `useOptimization()` context behavior
- `LiveUpdatesProvider` + `useLiveUpdates()` global live updates context
- `OptimizationRoot` provider composition and defaults
- `Personalization` entry resolution, lock/live-update behavior, loading fallback, and
  data-attribute mapping

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
SDK is initialized internally by the provider.

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'

function App() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      analytics={{ baseUrl: 'https://insights.contentful.com/' }}
      personalization={{ baseUrl: 'https://experience.contentful.com/' }}
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

- `useOptimization()` returns the current SDK instance.
- `useOptimization()` throws if used outside `OptimizationProvider`.
- `useLiveUpdates()` throws if used outside `LiveUpdatesProvider`.

### Personalization Component

```tsx
import { Personalization } from '@contentful/optimization-react-web'
;<Personalization baselineEntry={baselineEntry}>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</Personalization>
```

`Personalization` behavior:

- Default mode locks to the first non-`undefined` personalization state.
- `liveUpdates={true}` enables continuous updates as personalization state changes.
- If `liveUpdates` is omitted, global root `liveUpdates` is used.
- If both are omitted, live updates default to `false`.
- Consumer content supports render-prop (`(resolvedEntry) => ReactNode`) or direct `ReactNode`.
- Wrapper element is configurable with `as: 'div' | 'span'` (defaults to `div`).
- Wrapper style uses `display: contents` to remain layout-neutral as much as possible.
- Lifecycle mode is configurable with `lifecycleMode: 'spa' | 'hybrid-ssr-spa'` (defaults to
  `'spa'`).

#### Loading Fallback

When `loadingFallback` is provided, it is rendered while readiness is unresolved.

```tsx
<Personalization
  baselineEntry={baselineEntry}
  loadingFallback={() => <Skeleton label="Loading personalized content" />}
>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</Personalization>
```

- If a baseline entry is personalizable and unresolved, loading UI is rendered by default.
- If the entry is not personalizable, baseline/resolved content is rendered directly.
- During loading, a concrete layout-target element is rendered (`data-ctfl-loading-layout-target`)
  so loading visibility/layout behavior remains targetable even when wrapper uses
  `display: contents`.
- In `hybrid-ssr-spa` mode, unresolved loading is rendered invisibly (`visibility: hidden`) to
  preserve layout space before content is ready.

#### Nested Composition

Nested personalizations are supported by explicit composition:

```tsx
<Personalization baselineEntry={parentEntry}>
  {(resolvedParent) => (
    <ParentSection entry={resolvedParent}>
      <Personalization baselineEntry={childEntry}>
        {(resolvedChild) => <ChildSection entry={resolvedChild} />}
      </Personalization>
    </ParentSection>
  )}
</Personalization>
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
`Optimization` runtime can exist at a time (attached to `window.optimization`). Attempting to
initialize a second runtime will throw an error.

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
