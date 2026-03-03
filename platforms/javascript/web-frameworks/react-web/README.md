# React Web SDK

React Web SDK package for `@contentful/optimization-react-web`.

## Status

Core root/provider primitives are implemented.

- `OptimizationProvider` + `useOptimization()` context behavior
- `LiveUpdatesProvider` + `useLiveUpdates()` global live updates context
- `OptimizationRoot` provider composition and defaults

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
- `useLiveUpdates()` returns the live updates context or `null` outside `LiveUpdatesProvider`.

### Live Updates Resolution Semantics

Consumers should resolve live updates behavior with:

```ts
const isLiveUpdatesEnabled = componentLiveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false
```

This gives:

- component-level `liveUpdates` prop override first
- then root-level `liveUpdates`
- then default `false`

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
