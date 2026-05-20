<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization React Native SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Optimization React Native SDK provides a stateful mobile runtime on top of the
[Optimization Core SDK](../universal/core-sdk/README.md). It adds React providers, hooks,
`OptimizedEntry`, screen tracking, optional offline-aware event delivery, and in-app preview-panel
support for React Native applications.

If you are integrating a React Native application, start with [Getting Started](#getting-started),
then use
[Integrating the Optimization React Native SDK in a React Native app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-native-sdk-in-a-react-native-app.html)
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
  - [Provider lifecycle](#provider-lifecycle)
  - [Render optimized entries](#render-optimized-entries)
  - [Track entry interactions](#track-entry-interactions)
  - [Track screens](#track-screens)
  - [Provider-managed state subscriptions](#provider-managed-state-subscriptions)
  - [Live updates and preview](#live-updates-and-preview)
  - [Offline support](#offline-support)
- [Runtime notes](#runtime-notes)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-react-native @react-native-async-storage/async-storage
```

For offline support, also install NetInfo:

```sh
pnpm install @react-native-community/netinfo
```

Wrap the app with `OptimizationRoot` near the top of the component tree:

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-native'

export default function App() {
  return (
    <OptimizationRoot clientId="your-client-id" environment="main">
      <YourApp />
    </OptimizationRoot>
  )
}
```

For non-component ownership paths, create the SDK instance explicitly and call methods directly:

```ts
import { ContentfulOptimization } from '@contentful/optimization-react-native'

const optimization = await ContentfulOptimization.create({
  clientId: 'your-client-id',
  environment: 'main',
})
```

## When to use this package

Use `@contentful/optimization-react-native` for React Native applications that need mobile
optimization, persisted state, screen tracking, entry interaction tracking, offline behavior, and
preview-panel support. Native iOS work exists in this monorepo as pre-release Swift package work;
native Android and other framework SDKs remain planned.

## Common configuration

`OptimizationRoot` accepts Core stateful configuration directly, plus React Native-specific props.
Only `clientId` is required.

| Option                  | Required? | Default                        | Description                                                                    |
| ----------------------- | --------- | ------------------------------ | ------------------------------------------------------------------------------ |
| `clientId`              | Yes       | N/A                            | Shared API key for Experience API and Insights API requests                    |
| `environment`           | No        | `'main'`                       | Contentful environment identifier                                              |
| `api`                   | No        | See API options below          | Experience API and Insights API endpoint and request options                   |
| `defaults`              | No        | `undefined`                    | Initial state, commonly including consent or profile values                    |
| `allowedEventTypes`     | No        | `['identify', 'screen']`       | Event types allowed before consent is explicitly set                           |
| `trackEntryInteraction` | No        | `{ views: true, taps: false }` | Default view and tap tracking for `OptimizedEntry` components                  |
| `liveUpdates`           | No        | `false`                        | Whether optimized entries react continuously to SDK state changes              |
| `previewPanel`          | No        | `undefined`                    | Enables the in-app preview panel when provided with `enabled: true`            |
| `onStatesReady`         | No        | `undefined`                    | Provider-managed app-level state subscription hook                             |
| `getAnonymousId`        | No        | `undefined`                    | Function used to provide an anonymous ID from application-owned identity state |
| `queuePolicy`           | No        | SDK defaults                   | Flush retry behavior and offline queue bounds                                  |
| `logLevel`              | No        | `'error'`                      | Minimum log level for the default console sink                                 |
| `onEventBlocked`        | No        | `undefined`                    | Callback invoked when consent or guard logic blocks an event                   |

Common `api` options:

| Option              | Required? | Default                                    | Description                                                    |
| ------------------- | --------- | ------------------------------------------ | -------------------------------------------------------------- |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                                |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                  |
| `locale`            | No        | `'en-US'` (in API)                         | Locale used for Experience API location labels                 |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Experience API features to apply to each request               |
| `preflight`         | No        | `false`                                    | Aggregate a new profile state without storing it               |
| `beaconHandler`     | No        | `undefined`                                | Custom handler for enqueueing Insights API batches when needed |

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

For every prop, callback payload, and exported type, use the generated
[React Native SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-react-native.html).

## Core workflows

### Provider lifecycle

`OptimizationRoot` owns async React Native SDK initialization. It renders no children while platform
state setup is pending, runs any `onStatesReady` callback, and only then renders provider children.
This matches the React Web provider contract, but React Native uses async effect scheduling because
storage and platform setup cannot be completed before paint.

### Render optimized entries

`OptimizedEntry` resolves optimized Contentful entries and passes non-optimized entries through
unchanged:

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-native'

function HeroEntry({ entry }) {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolvedEntry) => <Hero data={resolvedEntry.fields} />}
    </OptimizedEntry>
  )
}
```

Fetch Contentful entries in your app layer. For optimized entries, request linked entries deeply
enough for the baseline and variants, commonly with `include: 10`.

Use `useEntryResolver()` when a component needs manual entry resolution without the `OptimizedEntry`
wrapper:

```tsx
import { useEntryResolver } from '@contentful/optimization-react-native'

function HeroData({ entry }) {
  const { resolveEntry } = useEntryResolver()
  const resolvedEntry = resolveEntry(entry)

  return <Hero data={resolvedEntry.fields} />
}
```

### Track entry interactions

Entry tracking records views and taps for Contentful entries, not arbitrary UI components. Global
defaults live on `OptimizationRoot`; individual `OptimizedEntry` components can override them:

```tsx
<OptimizationRoot clientId="your-client-id" trackEntryInteraction={{ views: true, taps: true }}>
  <OptimizedEntry baselineEntry={entry} trackViews={true} trackTaps={false}>
    {(resolvedEntry) => <Card entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

Wrap scrollable screens with `OptimizationScrollProvider` so view tracking uses actual scroll
position instead of only screen dimensions.

### Track screens

Use `OptimizationNavigationContainer` to emit `screen` events from React Navigation changes:

```tsx
<OptimizationNavigationContainer>
  {(navigationProps) => (
    <NavigationContainer {...navigationProps}>{/* navigators */}</NavigationContainer>
  )}
</OptimizationNavigationContainer>
```

Use `useScreenTracking()` for screen-level control and `useScreenTrackingCallback()` when names are
derived from navigation state or other dynamic data.

### Provider-managed state subscriptions

Use `onStatesReady` when application code needs SDK state subscriptions that line up with provider
initialization. The provider calls it after async SDK state setup completes and before child screen,
navigation, or entry effects can emit events.

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

The callback receives only `sdk.states`. Use regular hooks and React effects for component-local UI
state under the provider.

Use `OptimizationProvider` directly with a pre-built `sdk` only when an application or framework
adapter owns initialization. Without `onStatesReady`, children render immediately because the SDK is
already available. When `onStatesReady` is provided, the provider waits until those subscribers are
attached before children mount and runs the returned cleanup on unmount. In both cases, it does not
call `destroy()` on the injected SDK.

### Live updates and preview

`liveUpdates` controls whether `OptimizedEntry` continuously reacts to SDK state changes. The
preview panel always forces live updates on while it is open.

```tsx
<OptimizationRoot clientId="your-client-id" liveUpdates={true}>
  <OptimizedEntry baselineEntry={entry} liveUpdates={false}>
    {(resolvedEntry) => <Card entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

Enable the preview panel only in authoring or development flows and provide a Contentful client:

```tsx
<OptimizationRoot clientId="your-client-id" previewPanel={{ enabled: __DEV__, contentfulClient }}>
  <YourApp />
</OptimizationRoot>
```

### Offline support

AsyncStorage persists SDK state across app launches. When NetInfo is installed, the SDK can queue
events while the device is offline and flush them after connectivity returns. Tune queue bounds and
retry behavior with `queuePolicy` when the defaults are not appropriate for your app.

## Runtime notes

- Consent policy remains application-owned. The SDK stores consent and blocks non-allowed events
  until consent is accepted.
- `ContentfulOptimization.create(...)` is asynchronous. Prefer `OptimizationRoot` when React needs
  to own initialization.
- View tracking defaults to enabled; tap tracking defaults to disabled.
- Live updates default to disabled so entries lock to the first resolved value unless enabled
  globally, per component, or by the preview panel.
- React Native compatibility polyfills are imported automatically for Iterator Helpers,
  `crypto.randomUUID()`, and `crypto.getRandomValues()`; applications do not need additional setup
  beyond installing this SDK and its documented dependencies.
- Call `destroy()` before creating replacement instances in tests or hot-reload workflows.

## Related

- [Integrating the Optimization React Native SDK in a React Native app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-native-sdk-in-a-react-native-app.html) -
  step-by-step React Native integration guide
- [React Native SDK generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-react-native.html) -
  exported API reference
- [React Native reference implementation](../../implementations/react-native-sdk/README.md) -
  example application with optimized content, navigation tracking, live updates, preview, and E2E
  coverage
- [React Native dev dashboard](./dev/README.md) - package-local harness for development and manual
  verification
