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
  - [Consent](#consent)
  - [Provider and hook access](#provider-and-hook-access)
  - [Provider-managed state subscriptions](#provider-managed-state-subscriptions)
  - [OptimizedEntry](#optimizedentry)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Router page events](#router-page-events)
  - [Live updates and preview](#live-updates-and-preview)
  - [Web Components](#web-components)
- [Development harness](#development-harness)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-react-web
```

React and React DOM are application-owned peer dependencies. The SDK uses the React runtime already
installed by your app instead of installing its own copy.

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

For a single-locale app that fetches Contentful entries, pass the application locale to the SDK when
Experience API responses and events need to use the same language:

```tsx
<OptimizationRoot clientId="your-client-id" environment="main" locale="en-US">
  <YourApp />
</OptimizationRoot>
```

The provider renders on the server as well as the client. During server-side rendering it renders
children from a read-only snapshot (seeded by `serverOptimizationState` and consent/locale
defaults), then constructs and hydrates the live browser SDK after mount. Hooks and `OptimizedEntry`
work in both environments; event and tracking calls are no-ops during server rendering. See
[Server-side rendering and hydration](../../../../documentation/concepts/server-side-rendering-and-hydration.md).

## When to use this package

Use `@contentful/optimization-react-web` for React browser applications that need provider-based SDK
initialization, hooks, router page tracking, optimized entry rendering, automatic interaction
tracking, and live update semantics. Use the lower-level Web SDK directly for non-React integrations
or custom framework adapters.

## Common configuration

`OptimizationRoot` accepts most Web SDK configuration props directly and adds React-specific props
such as `liveUpdates`, `onStatesReady`, and `serverOptimizationState`. The Web SDK
`autoTrackEntryInteraction` option is exposed as the React `trackEntryInteraction` prop.

| Prop                      | Required? | Default                                       | Description                                                                                           |
| ------------------------- | --------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `clientId`                | Yes       | N/A                                           | Shared API key for Experience API and Insights API requests                                           |
| `environment`             | No        | `'main'`                                      | Contentful environment identifier                                                                     |
| `api`                     | No        | Web SDK defaults                              | Experience API and Insights API endpoint and request options                                          |
| `app`                     | No        | `undefined`                                   | Application metadata attached to outgoing event context                                               |
| `locale`                  | No        | `undefined`                                   | SDK Experience API and default event locale                                                           |
| `defaults`                | No        | `undefined`                                   | Configuration/default state such as consent or persistence consent                                    |
| `serverOptimizationState` | No        | `undefined`                                   | Server-resolved Optimization state; renders personalized state during SSR and hydrates the client SDK |
| `allowedEventTypes`       | No        | `['identify', 'page']`                        | Event types allowed before consent is explicitly set                                                  |
| `trackEntryInteraction`   | No        | `{ views: true, clicks: true, hovers: true }` | Automatic entry interaction tracking for `OptimizedEntry` elements                                    |
| `cookie`                  | No        | `{ domain: undefined, expires: 365 }`         | Anonymous ID cookie settings inherited from the Web SDK                                               |
| `liveUpdates`             | No        | `false`                                       | Whether `OptimizedEntry` components react continuously to SDK state                                   |
| `onStatesReady`           | No        | `undefined`                                   | Provider-managed app-level state subscription hook                                                    |
| `queuePolicy`             | No        | SDK defaults                                  | Flush retry behavior and offline queue bounds                                                         |
| `logLevel`                | No        | `'error'`                                     | Minimum log level for the default console sink                                                        |
| `onEventBlocked`          | No        | `undefined`                                   | Callback invoked when consent or guard logic blocks an event                                          |

Use `OptimizationProvider` directly when an application or framework adapter needs direct provider
control, including integrations that supply an SDK instance:

```tsx
<OptimizationProvider sdk={optimization}>
  <YourApp />
</OptimizationProvider>
```

Injected SDK instances render children immediately unless state setup such as `onStatesReady` or
`serverOptimizationState` is provided. When state setup is provided, the provider waits until that
setup is complete before children mount, and still leaves SDK teardown to the owner that created the
instance.

For server-to-browser state handoff, pass server-returned Optimization data through
`serverOptimizationState` on `OptimizationRoot` or `OptimizationProvider`. Keep `defaults` for
configuration or default state such as consent policy:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  defaults={{ consent: true }}
  environment="main"
  serverOptimizationState={optimizationData}
>
  <YourApp />
</OptimizationRoot>
```

For every Web SDK option that passes through this package, use the
[Web SDK README](../../web-sdk/README.md#common-configuration) and generated
[reference documentation](https://contentful.github.io/optimization).

Choose the application Contentful locale in your router, i18n layer, or app configuration. Pass that
value directly to Contentful CDA requests, and pass the same value to the provider `locale` prop
when Experience API responses and event context need to use the same language. See
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the full locale model.

For SDK instances created from provider/root configuration, changing the `locale` prop calls
`sdk.setLocale()` after initialization while the rest of the SDK config remains
initialization-scoped. Locale updates do not fetch content or refresh profile state; trigger your
app's normal `page()`, `identify()`, route loader, or CDA fetch flow when localized data needs to
change.

## Core workflows

### Consent

Consent policy remains application-owned. For default-on application policies that do not render an
end-user consent UI, seed accepted consent on `OptimizationRoot`:

```tsx
<OptimizationRoot clientId="your-client-id" defaults={{ consent: true }}>
  <YourApp />
</OptimizationRoot>
```

When application policy depends on user choice, leave `defaults.consent` unset and call `consent()`
from `useOptimizationActions()` in the relevant control:

```tsx
import { useOptimizationActions } from '@contentful/optimization-react-web'

function ConsentButton() {
  const { consent } = useOptimizationActions()
  return <button onClick={() => consent(true)}>Accept</button>
}
```

Boolean consent calls control both event emission and durable profile-continuity persistence by
default. Use `sdk.consent({ events: true, persistence: false })` when events are allowed but
continuity needs to stay session-only. For cross-SDK consent guidance, see
[Consent management in the Optimization SDK Suite](../../../../documentation/concepts/consent-management-in-the-optimization-sdk-suite.md).

### Provider and hook access

`OptimizationRoot` owns the Web SDK lifecycle. Provider-owned initialization runs after React
commit, outside render, and renders no children while the SDK is pending. In normal browser
rendering this uses a layout-effect path so ready children can mount before the first visible paint.

Use the dedicated React SDK action hooks when components need common Optimization actions:

```tsx
import { useOptimizationActions } from '@contentful/optimization-react-web'

function ProductCta() {
  const { track } = useOptimizationActions()

  return <button onClick={() => track({ event: 'purchase' })}>Buy now</button>
}
```

Use `useOptimization()` when a component needs direct access to the SDK instance itself, and prefer
`useOptimizationActions()` when a component wants destructurable action methods such as `track()`,
`identify()`, `page()`, `screen()`, `flush()`, `reset()`, or `consent()`.

Use dedicated state hooks such as `useConsentState()`, `useProfileState()`, and
`useSelectedOptimizationsState()` when components need to render current SDK state. Prefer those
hooks over subscribing to `sdk.states.*` directly from component effects.

Use `useEntryResolver()` when a component needs manual entry resolution without the `OptimizedEntry`
wrapper:

`useOptimization()` returns the SDK instance itself. Keep that instance in a variable and call
methods from it. Do not destructure SDK methods from the returned value because those methods rely
on the instance `this` binding.

```tsx
import { useOptimization } from '@contentful/optimization-react-web'

function ProductCta() {
  const optimization = useOptimization()

  return <button onClick={() => optimization.track({ event: 'purchase' })}>Buy now</button>
}
```

The direct SDK surface also exposes manual interaction calls such as `trackView()`, `trackClick()`,
`trackHover()`, and `trackFlagView()`.

```tsx
// Avoid destructuring SDK methods; this loses the instance binding.
const { track } = useOptimization()
```

```tsx
import { useEntryResolver } from '@contentful/optimization-react-web'

function HeroEntry({ baselineEntry }) {
  const { resolveEntry } = useEntryResolver()
  const resolvedEntry = resolveEntry(baselineEntry)

  return <HeroCard entry={resolvedEntry} />
}
```

Fetch Contentful entries in the app layer with one CDA locale. For localized apps, configure your
application locale and pass it directly before passing entries to `OptimizedEntry`,
`useEntryResolver()`, or `useOptimizedEntry()`. Do not pass all-locale CDA responses from
`withAllLocales` or `locale=*`; these APIs expect direct single-locale field values. See
[Entry optimization and variant resolution](https://contentful.github.io/optimization/documents/Documentation.Concepts.Entry_personalization_and_variant_resolution.html#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the broader locale model.

Use `useMergeTagResolver()` when a component needs to resolve embedded merge tag entries:

```tsx
import { useMergeTagResolver } from '@contentful/optimization-react-web'

function MergeTagText({ mergeTagEntry }) {
  const { getMergeTagValue } = useMergeTagResolver()

  return <span>{getMergeTagValue(mergeTagEntry) ?? ''}</span>
}
```

If a merge tag references localized profile fields such as `location.city` or `location.country`,
its resolved value follows the localized profile values returned by the Experience API.

### Provider-managed state subscriptions

Use `onStatesReady` when application code needs to subscribe to SDK state as part of provider
initialization. This avoids coordinating with `window.contentfulOptimization`, which might not exist
yet when application code runs or might have already emitted data by the time a later effect
subscribes.

```tsx
<OptimizationRoot
  clientId="your-client-id"
  onStatesReady={(states) => {
    const subscriptions = [
      states.eventStream.subscribe((event) => {
        if (event) devToolsPanel.logEvent(event)
      }),
      states.blockedEventStream.subscribe((blocked) => {
        if (blocked) devToolsPanel.logBlockedEvent(blocked)
      }),
    ]

    return () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe())
    }
  }}
>
  <YourApp />
</OptimizationRoot>
```

The callback receives only `sdk.states`. It runs as soon as the provider has initialized the state
surface and before children mount, so subscriptions can observe events emitted by child effects such
as router page tracking. For component-local UI state, keep using hooks and React effects under the
provider.

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
For optimized entries, the loading phase begins immediately while optimization is unresolved. If the
state is still unresolved after 5 seconds, the component reveals baseline content so loading does
not persist forever. Without a custom `loadingFallback`, the wrapper preserves layout by hiding the
baseline until that timeout elapses. The React Web guide covers those variants in context.

### Entry interaction tracking

`OptimizedEntry` emits the Web SDK's `data-ctfl-*` tracking attributes for resolved entries. The
root config observes views, clicks, and hovers by default; pass `false` for any interaction type
that your application does not want to observe:

```tsx
<OptimizationRoot clientId="your-client-id" trackEntryInteraction={{ hovers: false }}>
  <YourApp />
</OptimizationRoot>
```

Use `OptimizedEntry` props to configure Web SDK entry-tracking attributes without setting
`data-ctfl-*` metadata manually:

```tsx
<OptimizedEntry
  baselineEntry={entry}
  clickable
  hoverDurationUpdateIntervalMs={1000}
  viewDurationUpdateIntervalMs={1000}
>
  {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
</OptimizedEntry>
```

`OptimizedEntry` derives entry ID, baseline ID, optimization ID, optimization context ID, sticky
state, variant index, and duplication scope from the resolved entry state.

Use `sdk.tracking.enableElement(...)` from `useOptimization()` for manual element overrides.

### Router page events

Router adapters emit `page()` events for supported client-side routers:

| Router             | Import path                                                 | Mounting rule                                                        |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| React Router       | `@contentful/optimization-react-web/router/react-router`    | Mount under a React Router data router and inside `OptimizationRoot` |
| Next.js Pages      | `@contentful/optimization-react-web/router/next-pages`      | Mount once in `pages/_app.tsx` inside `OptimizationRoot`             |
| Next.js App Router | `@contentful/optimization-react-web/router/next-app`        | Mount in `app/layout.tsx` inside `OptimizationRoot`                  |
| TanStack Router    | `@contentful/optimization-react-web/router/tanstack-router` | Mount under the TanStack router tree and inside `OptimizationRoot`   |

For Next.js applications that need the server, client, and request-handler integration together,
prefer the [`@contentful/optimization-nextjs`](../nextjs-sdk/README.md) adapter package.

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

### Web Components

The React SDK keeps rendering React components. `OptimizedEntry` does not render through custom
elements, and this package does not import or register Web Components.

Use the optional `@contentful/optimization-web/web-components` subpath only when a non-React app or
a deliberate custom-element island needs vanilla custom elements. Framework wrappers around those
elements must assign complex DOM properties such as `baselineEntry`, `defaults`, `api`, `sdk`, and
callbacks after hydration, and listen for entry lifecycle events instead of trying to emulate React
render props. See the [Web SDK README](../../web-sdk/README.md#usage-with-web-components) for raw
custom-element and UMD usage.

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
- [Optimization Web Components](../../web-sdk/README.md#usage-with-web-components) - optional
  vanilla custom elements exposed from the Web SDK package
- [Optimization Web Preview Panel](../../preview-panel/README.md) - preview panel package for
  browser authoring workflows
- [React Web reference implementation](../../../../implementations/react-web-sdk/README.md) -
  application using providers, router tracking, optimized entries, live updates, and entry tracking
