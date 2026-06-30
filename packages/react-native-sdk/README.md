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
  - [Consent and persistence](#consent-and-persistence)
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

For preview panel support, also install the preview-native peer dependencies:

```sh
pnpm install @react-native-clipboard/clipboard react-native-safe-area-context
```

Wrap the app with `OptimizationRoot` near the top of the component tree:

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-native'

export default function App() {
  return (
    <OptimizationRoot clientId="your-client-id" environment="main" locale="en-US">
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
  locale: 'en-US',
})
```

## When to use this package

Use `@contentful/optimization-react-native` for React Native applications that need mobile
optimization, persisted state, screen tracking, entry interaction tracking, offline behavior, and
preview-panel support. Native iOS and Android package work also exists in this monorepo for teams
that need platform-native integration surfaces.

## Common configuration

`OptimizationRoot` accepts Core stateful configuration directly, plus React Native-specific props.
Only `clientId` is required.

| Option                  | Required? | Default                       | Description                                                                       |
| ----------------------- | --------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `clientId`              | Yes       | N/A                           | Shared API key for Experience API and Insights API requests                       |
| `environment`           | No        | `'main'`                      | Contentful environment identifier                                                 |
| `api`                   | No        | See API options below         | Experience API and Insights API endpoint and request options                      |
| `locale`                | No        | `undefined`                   | SDK Experience API and default event locale                                       |
| `defaults`              | No        | `undefined`                   | Initial state, commonly including consent, persistence consent, or profile values |
| `allowedEventTypes`     | No        | `['identify', 'screen']`      | Event types allowed before consent is explicitly set                              |
| `trackEntryInteraction` | No        | `{ views: true, taps: true }` | Default view and tap tracking for `OptimizedEntry` components                     |
| `liveUpdates`           | No        | `false`                       | Whether optimized entries react continuously to SDK state changes                 |
| `onStatesReady`         | No        | `undefined`                   | Provider-managed app-level state subscription hook                                |
| `getAnonymousId`        | No        | `undefined`                   | Function used to provide an anonymous ID from application-owned identity state    |
| `queuePolicy`           | No        | SDK defaults                  | Flush retry behavior and offline queue bounds                                     |
| `logLevel`              | No        | `'error'`                     | Minimum log level for the default console sink                                    |
| `onEventBlocked`        | No        | `undefined`                   | Callback invoked when consent or guard logic blocks an event                      |

Common `api` options:

| Option              | Required? | Default                                    | Description                                      |
| ------------------- | --------- | ------------------------------------------ | ------------------------------------------------ |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                  |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                    |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Experience API features to apply to each request |
| `preflight`         | No        | `false`                                    | Aggregate a new profile state without storing it |

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

Choose the application Contentful locale in your navigation, i18n, or app configuration layer. Pass
that value directly to Contentful CDA requests, and pass the same value to SDK `locale` when
Experience API responses and event context should use the same language. See
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the full locale model.

For provider-owned SDK instances, changing the `locale` prop calls `sdk.setLocale()` after
initialization while the rest of the SDK config remains initialization-scoped. Locale updates do not
fetch content or refresh profile state; trigger your app's normal `screen()`, `identify()`, or CDA
fetch flow when localized data needs to change.

For every prop, callback payload, and exported type, use the generated
[React Native SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-react-native.html).

## Core workflows

Automatic navigation integrations use `trackCurrentScreen()` for current-screen deduplication.
Direct manual `screen()` calls remain non-deduping event emits and return accepted/data event
results.

### Provider lifecycle

`OptimizationRoot` owns async React Native SDK initialization. It renders no children while platform
state setup is pending, runs any `onStatesReady` callback, and only then renders provider children.
This matches the React Web provider contract, but React Native uses async effect scheduling because
storage and platform setup cannot be completed before paint.

When persistence consent permits durable profile continuity, SDK state from an Experience response
is published only after the corresponding AsyncStorage write for that same response snapshot has
settled or failed gracefully. AsyncStorage hydrates continuity during initialization and mirrors
changes for the next launch; after startup, `sdk.states`, entry rendering, and tracking metadata
read from in-memory SDK state. Application code can wait for `sdk.states.profile`,
`sdk.states.selectedOptimizations`, or rendered SDK-derived UI instead of adding storage-timing
delays before a relaunch-sensitive action.

### Consent and persistence

Consent policy remains application-owned. For default-on application policies that do not render an
end-user consent prompt, set `defaults: { consent: true }` on `OptimizationRoot`:

```tsx
<OptimizationRoot clientId="your-client-id" defaults={{ consent: true }}>
  <YourApp />
</OptimizationRoot>
```

When application policy depends on user choice, leave `defaults.consent` unset and call
`consent(true | false)` from the application-owned control. Boolean consent calls control both event
emission and durable profile-continuity persistence by default. Use
`consent({ events: true, persistence: false })` when events are allowed but continuity should stay
session-only.

Do not use a component effect to grant default consent for an app that has no consent prompt.
Seeding `defaults.consent` during SDK initialization applies the persistence policy before child
effects, screen tracking, or manual `identify()` calls can run.

AsyncStorage persists consent and, when persistence consent permits it, profile-continuity state
across app launches. It is not consulted for every live state read after initialization. For
cross-SDK consent guidance, see
[Consent management in the Optimization SDK Suite](../../documentation/concepts/consent-management-in-the-optimization-sdk-suite.md).

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

Use one CDA locale for entries passed to `OptimizedEntry` or `useEntryResolver()`. For localized
apps, derive the application locale from your navigation, i18n, or app configuration layer and pass
it directly to Contentful CDA requests. Do not pass all-locale CDA responses from `withAllLocales`
or `locale=*`; these APIs expect direct single-locale field values. See
[Entry personalization and variant resolution](https://contentful.github.io/optimization/documents/Documentation.Concepts.Entry_personalization_and_variant_resolution.html#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the broader locale model.

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
defaults live on `OptimizationRoot` and observe both views and taps by default. Individual
`OptimizedEntry` components can override them:

```tsx
<OptimizationRoot clientId="your-client-id" trackEntryInteraction={{ taps: false }}>
  <OptimizedEntry baselineEntry={entry} trackTaps={true}>
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
import { PreviewPanelOverlay } from '@contentful/optimization-react-native/preview'
;<OptimizationRoot clientId="your-client-id">
  <YourApp />
  {__DEV__ && <PreviewPanelOverlay contentfulClient={contentfulClient} />}
</OptimizationRoot>
```

Preview UI components and preview-specific types are exported from the preview subpath:

```tsx
import { PreviewPanelOverlay } from '@contentful/optimization-react-native/preview'
```

### Offline support

When NetInfo is installed, the SDK can queue events while the device is offline and flush them after
connectivity returns. When the app moves to the background or inactive state, the SDK also flushes
queued events and drains pending AsyncStorage persistence. Tune queue bounds and retry behavior with
`queuePolicy` when the defaults are not appropriate for your app.

## Runtime notes

- `ContentfulOptimization.create(...)` is asynchronous. Prefer `OptimizationRoot` when React needs
  to own initialization.
- View and tap tracking default to enabled.
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
