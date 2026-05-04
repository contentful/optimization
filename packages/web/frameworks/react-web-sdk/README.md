<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization React Web SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Optimization React Web SDK provides React providers, hooks, router adapters, and entry-rendering
primitives on top of the [Optimization Web SDK](../../web-sdk/README.md). Use it when a React
browser application must not manage the lower-level Web SDK instance, state subscriptions, entry
resolution, and route tracking by hand.

If you are integrating a React application, start with [Getting Started](#getting-started), then use
[Integrating the Optimization React Web SDK in a React app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-web-sdk-in-a-react-app.html)
for the step-by-step flow. This README keeps the package orientation and common setup options close
at hand; generated [reference documentation](https://contentful.github.io/optimization) remains the
source of truth for exported API signatures.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [When to use this package](#when-to-use-this-package)
- [Common configuration](#common-configuration)
- [Core workflows](#core-workflows)
  - [Provider and hook access](#provider-and-hook-access)
  - [OptimizedEntry](#optimizedentry)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Router page events](#router-page-events)
  - [Live updates and preview](#live-updates-and-preview)
- [Development harness](#development-harness)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-react-web
```

Mount `OptimizationRoot` once near the root of your React application:

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'

function App() {
  return (
    <OptimizationRoot clientId="your-client-id" environment="main">
      <YourApp />
    </OptimizationRoot>
  )
}
```

## When to use this package

Use `@contentful/optimization-react-web` for React browser applications that need provider-based SDK
initialization, hooks, router page tracking, optimized entry rendering, automatic interaction
tracking, and live update semantics. Use the lower-level Web SDK directly for non-React integrations
or custom framework adapters.

## Common configuration

`OptimizationRoot` accepts the Web SDK configuration props directly and adds a React-specific
`liveUpdates` prop.

| Prop                        | Required? | Default                                          | Description                                                         |
| --------------------------- | --------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `clientId`                  | Yes       | N/A                                              | Shared API key for Experience API and Insights API requests         |
| `environment`               | No        | `'main'`                                         | Contentful environment identifier                                   |
| `api`                       | No        | Web SDK defaults                                 | Experience API and Insights API endpoint and request options        |
| `app`                       | No        | `undefined`                                      | Application metadata attached to outgoing event context             |
| `defaults`                  | No        | `undefined`                                      | Initial state, commonly including consent or profile values         |
| `allowedEventTypes`         | No        | `['identify', 'page']`                           | Event types allowed before consent is explicitly set                |
| `autoTrackEntryInteraction` | No        | `{ views: false, clicks: false, hovers: false }` | Automatic entry interaction tracking inherited from the Web SDK     |
| `cookie`                    | No        | `{ domain: undefined, expires: 365 }`            | Anonymous ID cookie settings inherited from the Web SDK             |
| `liveUpdates`               | No        | `false`                                          | Whether `OptimizedEntry` components react continuously to SDK state |
| `queuePolicy`               | No        | SDK defaults                                     | Flush retry behavior and offline queue bounds                       |
| `logLevel`                  | No        | `'error'`                                        | Minimum log level for the default console sink                      |
| `onEventBlocked`            | No        | `undefined`                                      | Callback invoked when consent or guard logic blocks an event        |

Use `OptimizationProvider` directly only when an application or framework adapter must own a
pre-built SDK instance:

```tsx
<OptimizationProvider sdk={optimization}>
  <YourApp />
</OptimizationProvider>
```

For every Web SDK option that passes through this package, use the
[Web SDK README](../../web-sdk/README.md#common-configuration) and generated
[reference documentation](https://contentful.github.io/optimization).

## Core workflows

### Provider and hook access

`OptimizationRoot` creates and tears down the Web SDK instance. Use `useOptimization()` when a
component needs direct access to the instance:

```tsx
import { useOptimization } from '@contentful/optimization-react-web'

function ConsentButton() {
  const { sdk } = useOptimization()
  return <button onClick={() => sdk?.consent(true)}>Accept</button>
}
```

### OptimizedEntry

`OptimizedEntry` resolves a baseline Contentful entry and renders either the selected variant or the
baseline entry:

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'

function HeroEntry({ baselineEntry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry}>
      {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
    </OptimizedEntry>
  )
}
```

Use `loadingFallback`, direct children, wrapper props, and nested composition patterns when needed.
The React Web guide covers those variants in context.

### Entry interaction tracking

`OptimizedEntry` emits the Web SDK's `data-ctfl-*` tracking attributes for resolved entries. Enable
automatic tracking in the root config when views, clicks, or hovers must be detected by the Web SDK:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  autoTrackEntryInteraction={{ views: true, clicks: true, hovers: false }}
>
  <YourApp />
</OptimizationRoot>
```

Use `sdk.tracking.enableElement(...)` from `useOptimization()` for manual element overrides.

### Router page events

Router adapters emit `page()` events for supported client-side routers:

| Router             | Import path                                                 | Mounting rule                                                        |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| React Router       | `@contentful/optimization-react-web/router/react-router`    | Mount under a React Router data router and inside `OptimizationRoot` |
| Next.js Pages      | `@contentful/optimization-react-web/router/next-pages`      | Mount once in `pages/_app.tsx` inside `OptimizationRoot`             |
| Next.js App Router | `@contentful/optimization-react-web/router/next-app`        | Mount in a client provider used by `app/layout.tsx`                  |
| TanStack Router    | `@contentful/optimization-react-web/router/tanstack-router` | Mount under the TanStack router tree and inside `OptimizationRoot`   |

All adapters support static and dynamic page payload enrichment. See the
[React Web integration guide](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-web-sdk-in-a-react-app.html#5-emit-page-events-with-supported-router-adapters)
for router-specific examples.

### Live updates and preview

`liveUpdates` defaults to `false`, so optimized entries lock to the first resolved value. Set
`liveUpdates` globally or per `OptimizedEntry` when entries must react to profile, flag, or preview
changes:

```tsx
<OptimizationRoot clientId="your-client-id" liveUpdates={true}>
  <OptimizedEntry baselineEntry={entry} liveUpdates={false}>
    {(resolvedEntry) => <Card entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

The browser preview panel is provided by
[`@contentful/optimization-web-preview-panel`](../../preview-panel/README.md). When the panel is
open, live updates are forced on for all `OptimizedEntry` components so authors can inspect variant
changes immediately.

## Development harness

The package-local development harness runs from `packages/web/frameworks/react-web-sdk/dev/`. Launch
it from the repo root:

```sh
pnpm --filter @contentful/optimization-react-web dev:launch
```

Use the harness for package development. Use the reference implementation for end-to-end integration
behavior.

## Related

- [Integrating the Optimization React Web SDK in a React app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-web-sdk-in-a-react-app.html) -
  step-by-step React integration guide
- [Optimization Web SDK](../../web-sdk/README.md) - lower-level browser SDK wrapped by this package
- [Optimization Web Preview Panel](../../preview-panel/README.md) - preview panel package for
  browser authoring workflows
- [React Web reference implementation](../../../../implementations/react-web-sdk/README.md) -
  application using providers, router tracking, optimized entries, live updates, and entry tracking
