<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Optimization React Native SDK</h1>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Optimization React Native SDK implements functionality specific to React Native applications,
based on the [Optimization Core Library](../universal/core-sdk/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](../../README.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Reference Implementation](#reference-implementation)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [Analytics Options](#analytics-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
  - [Personalization Options](#personalization-options)
- [Entry Tracking](#entry-tracking)
  - [`<OptimizedEntry />`](#optimizedentry-)
  - [With vs Without OptimizationScrollProvider](#with-vs-without-optimizationscrollprovider)
    - [With OptimizationScrollProvider (Recommended for Scrollable Content)](#with-optimizationscrollprovider-recommended-for-scrollable-content)
    - [Without OptimizationScrollProvider (For Non-Scrollable Content)](#without-optimizationscrollprovider-for-non-scrollable-content)
  - [Custom Tracking Thresholds](#custom-tracking-thresholds)
  - [Manual Analytics Tracking](#manual-analytics-tracking)
  - [`useInteractionTracking`](#useinteractiontracking)
  - [`useTapTracking`](#usetaptracking)
- [Screen Tracking](#screen-tracking)
  - [`useScreenTracking`](#usescreentracking)
  - [`useScreenTrackingCallback`](#usescreentrackingcallback)
  - [`OptimizationNavigationContainer`](#optimizationnavigationcontainer)
- [OptimizationRoot](#optimizationroot)
  - [Preview Panel](#preview-panel)
- [Live Updates Behavior](#live-updates-behavior)
  - [Default Behavior (Recommended)](#default-behavior-recommended)
  - [Enabling Live Updates](#enabling-live-updates)
    - [1. Preview Panel (Automatic)](#1-preview-panel-automatic)
    - [2. Global Setting via OptimizationRoot](#2-global-setting-via-optimizationroot)
    - [3. Per-Component Override](#3-per-component-override)
  - [Priority Order](#priority-order)
  - [`useLiveUpdates`](#useliveupdates)
- [React Native-Specific Defaults](#react-native-specific-defaults)
  - [Persistence Behavior](#persistence-behavior)
- [Offline Support](#offline-support)
  - [How It Works](#how-it-works)
- [Polyfills](#polyfills)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-react-native @react-native-async-storage/async-storage
```

For offline support (recommended), also install:

```sh
pnpm install @react-native-community/netinfo
```

Import the Optimization React Native SDK; both CJS and ESM module systems are supported, ESM
preferred:

```ts
import { ContentfulOptimization } from '@contentful/optimization-react-native'
```

Configure and initialize the Optimization React Native SDK:

```ts
const optimization = await ContentfulOptimization.create({
  clientId: 'your-client-id',
  environment: 'main',
})
```

## Reference Implementation

- [React Native](../../implementations/react-native-sdk/README.md): Example application that
  displays optimized content, with builds targeted for both Android and iOS

## Configuration

The SDK communicates with two APIs: the **Experience API** (for personalization and variant
resolution) and the **Insights API** (for analytics event ingestion).

### Top-level Configuration Options

| Option              | Required? | Default                       | Description                                                  |
| ------------------- | --------- | ----------------------------- | ------------------------------------------------------------ |
| `allowedEventTypes` | No        | `['identify', 'screen']`      | Allow-listed event types permitted when consent is not set   |
| `analytics`         | No        | See "Analytics Options"       | Configuration specific to the Analytics/Insights API         |
| `clientId`          | Yes       | N/A                           | The Optimization client identifier                           |
| `defaults`          | No        | `undefined`                   | Set of default state values applied on initialization        |
| `environment`       | No        | `'main'`                      | The environment identifier                                   |
| `eventBuilder`      | No        | See "Event Builder Options"   | Event builder configuration (channel/library metadata, etc.) |
| `fetchOptions`      | No        | See "Fetch Options"           | Configuration for Fetch timeout and retry functionality      |
| `getAnonymousId`    | No        | `undefined`                   | Function used to obtain an anonymous user identifier         |
| `logLevel`          | No        | `'error'`                     | Minimum log level for the default console sink               |
| `onEventBlocked`    | No        | `undefined`                   | Callback invoked when an event call is blocked by guards     |
| `personalization`   | No        | See "Personalization Options" | Configuration specific to the Personalization/Experience API |

Configuration method signatures:

- `getAnonymousId`: `() => string | undefined`

### Analytics Options

| Option          | Required? | Default                                    | Description                                                              |
| --------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `baseUrl`       | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                            |
| `beaconHandler` | No        | `undefined`                                | Handler used to enqueue events via the Beacon API or a similar mechanism |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`

### Event Builder Options

Event builder options should only be supplied when building an SDK on top of the Optimization React
Native SDK or any of its descendant SDKs.

| Option              | Required? | Default                                                               | Description                                                                        |
| ------------------- | --------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `app`               | No        | `undefined`                                                           | The application definition used to attribute events to a specific consumer app     |
| `channel`           | No        | `'mobile'`                                                            | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library`           | No        | `{ name: '@contentful/optimization-react-native', version: '0.0.0' }` | The client library metadata that is attached to all events                         |
| `getLocale`         | No        | Built-in locale resolution                                            | Function used to resolve the locale for outgoing events                            |
| `getPageProperties` | No        | Built-in page properties resolution                                   | Function that returns the current page properties                                  |
| `getUserAgent`      | No        | Built-in user agent resolution                                        | Function used to obtain the current user agent string when applicable              |

The `channel` option may contain one of the following values:

- `web`
- `mobile`
- `server`

Configuration method signatures:

- `getLocale`: `() => string | undefined`
- `getPageProperties`:

  ```ts
  () => {
    path: string,
    query: Record<string, string>,
    referrer: string,
    search: string,
    title?: string,
    url: string
  }
  ```

- `getUserAgent`: `() => string | undefined`

### Fetch Options

Fetch options allow for configuration of a Fetch API-compatible fetch method and the retry/timeout
logic integrated into the Optimization API Client. Specify the `fetchMethod` when the host
application environment does not offer a `fetch` method that is compatible with the standard Fetch
API in its global scope.

| Option             | Required? | Default     | Description                                                           |
| ------------------ | --------- | ----------- | --------------------------------------------------------------------- |
| `fetchMethod`      | No        | `undefined` | Signature of a fetch method used by the API clients                   |
| `intervalTimeout`  | No        | `0`         | Delay (in milliseconds) between retry attempts                        |
| `onFailedAttempt`  | No        | `undefined` | Callback invoked whenever a retry attempt fails                       |
| `onRequestTimeout` | No        | `undefined` | Callback invoked when a request exceeds the configured timeout        |
| `requestTimeout`   | No        | `3000`      | Maximum time (in milliseconds) to wait for a response before aborting |
| `retries`          | No        | `1`         | Maximum number of retry attempts                                      |

Configuration method signatures:

- `fetchMethod`: `(url: string | URL, init: RequestInit) => Promise<Response>`
- `onFailedAttempt` and `onRequestTimeout`: `(options: FetchMethodCallbackOptions) => void`

### Personalization Options

| Option            | Required? | Default                               | Description                                                         |
| ----------------- | --------- | ------------------------------------- | ------------------------------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                                     |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Enabled features which the API may use for each request             |
| `ip`              | No        | `undefined`                           | IP address to override the API behavior for IP analysis             |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used to translate `location.city` and `location.country`     |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints in plain text                  |
| `preflight`       | No        | `false`                               | Instructs the API to aggregate a new profile state but not store it |

> [!IMPORTANT]
>
> Call `ContentfulOptimization.create(...)` once per app runtime and share the returned instance. In
> tests or hot-reload workflows, call `destroy()` before creating a replacement instance.

## Entry Tracking

Entry tracking refers to tracking **Contentful entries** (content entries in your CMS) for analytics
purposes — views, taps, and variant resolution — not React Native UI components.

### `<OptimizedEntry />`

A unified component that handles both optimized and non-optimized Contentful entries. It
automatically:

- Detects whether the entry is optimized (has `nt_experiences` field)
- Resolves the correct variant for optimized entries based on user profile
- Passes non-optimized entries through unchanged
- Tracks entry views when visibility and time thresholds are met
- Tracks taps when enabled

`children` accepts either a **render prop** `(resolvedEntry) => ReactNode` for accessing the
resolved entry, or **static children** `ReactNode` for tracking-only use cases:

```tsx
{
  /* Render prop — receives the resolved entry (variant or baseline) */
}
;<OptimizedEntry entry={optimizedEntry}>
  {(resolvedEntry) => <HeroComponent data={resolvedEntry.fields} />}
</OptimizedEntry>

{
  /* Static children — tracking only, no variant resolution needed */
}
;<OptimizedEntry entry={productEntry}>
  <ProductCard data={productEntry.fields} />
</OptimizedEntry>
```

The component tracks when an entry:

- Is at least **80% visible** in the viewport (configurable via `threshold` prop)
- Has been viewed for **2000ms** (2 seconds, configurable via `viewTimeMs` prop)

### With vs Without OptimizationScrollProvider

The tracking component works in two modes:

#### With OptimizationScrollProvider (Recommended for Scrollable Content)

When used inside a `<OptimizationScrollProvider>`, tracking uses the actual scroll position and
viewport dimensions:

```tsx
<OptimizationScrollProvider>
  <OptimizedEntry entry={optimizedEntry}>
    {(resolvedEntry) => <HeroComponent data={resolvedEntry} />}
  </OptimizedEntry>
  <OptimizedEntry entry={productEntry}>
    <ProductCard data={productEntry.fields} />
  </OptimizedEntry>
</OptimizationScrollProvider>
```

**Benefits:**

- Accurate viewport tracking as user scrolls
- Works for content that appears below the fold
- Triggers when component scrolls into view

#### Without OptimizationScrollProvider (For Non-Scrollable Content)

When used without `<OptimizationScrollProvider>`, tracking uses screen dimensions instead:

```tsx
<OptimizedEntry entry={entry}>
  {(resolvedEntry) => <FullScreenHero data={resolvedEntry} />}
</OptimizedEntry>

<OptimizedEntry entry={bannerEntry}>
  <Banner data={bannerEntry.fields} />
</OptimizedEntry>
```

**Note:** In this mode, `scrollY` is always `0` and viewport height equals the screen height. This
is ideal for:

- Full-screen components
- Non-scrollable layouts
- Content that's always visible when the screen loads

### Custom Tracking Thresholds

`<OptimizedEntry />` supports customizable visibility and time thresholds:

```typescript
{/* Optimized entry with custom thresholds */}
<OptimizedEntry
  entry={entry}
  viewTimeMs={3000}      // Track after 3 seconds of visibility
  threshold={0.9}        // Require 90% visibility
>
  {(resolvedEntry) => <YourComponent data={resolvedEntry.fields} />}
</OptimizedEntry>

{/* Non-optimized entry with custom thresholds */}
<OptimizedEntry
  entry={entry}
  viewTimeMs={1500}      // Track after 1.5 seconds
  threshold={0.5}        // Require 50% visibility
>
  <YourComponent />
</OptimizedEntry>
```

**Key Features:**

- The initial view event fires once per component mount; periodic duration updates continue while
  visible
- Works with or without `OptimizationScrollProvider` (automatically adapts)
- Default: 80% visible for 2000ms (both configurable)
- Tracking fires even if user never scrolls (checks on initial layout)
- Render prop pattern provides the resolved entry; static children work for tracking only

### Manual Analytics Tracking

For cases outside the `<OptimizedEntry />` component pattern — such as custom screens or
non-Contentful content — you can manually track events using the analytics API:

```typescript
import { useOptimization } from '@contentful/optimization-react-native'

function MyComponent() {
  const optimization = useOptimization()

  const trackManually = async () => {
    await optimization.trackView({
      componentId: 'my-component',
      experienceId: 'exp-456',
      variantIndex: 0,
    })
  }

  return <Button onPress={trackManually} title="Track" />
}
```

### `useInteractionTracking`

Returns the resolved interaction tracking configuration from the nearest
`InteractionTrackingProvider` (set up by `OptimizationRoot`). Use this to check whether view or tap
tracking is globally enabled:

```tsx
import { useInteractionTracking } from '@contentful/optimization-react-native'

function DebugOverlay() {
  const { views, taps } = useInteractionTracking()
  return (
    <Text>
      Views: {String(views)}, Taps: {String(taps)}
    </Text>
  )
}
```

### `useTapTracking`

Low-level hook that detects taps on a View via raw touch events and emits `component_click`
analytics events. `<OptimizedEntry />` uses this internally, but you can use it directly for custom
tracking layouts:

```tsx
import { useTapTracking } from '@contentful/optimization-react-native'

function TrackedEntry({ entry }: { entry: Entry }) {
  const { onTouchStart, onTouchEnd } = useTapTracking({
    entry,
    enabled: true,
  })

  return (
    <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Text>{entry.fields.title}</Text>
    </View>
  )
}
```

## Screen Tracking

### `useScreenTracking`

Hook for tracking screen views. By default, tracks the screen automatically when the component
mounts. Set `trackOnMount: false` to disable automatic tracking and use the returned `trackScreen`
function for manual control.

```tsx
import { useScreenTracking } from '@contentful/optimization-react-native'

// Automatic tracking on mount (default)
function HomeScreen() {
  useScreenTracking({ name: 'Home' })
  return <View>...</View>
}

// Manual tracking
function DetailsScreen() {
  const { trackScreen } = useScreenTracking({
    name: 'Details',
    trackOnMount: false,
  })

  useEffect(() => {
    if (dataLoaded) {
      trackScreen()
    }
  }, [dataLoaded])

  return <View>...</View>
}
```

### `useScreenTrackingCallback`

Returns a stable callback to track screen views with dynamic names. Use this when screen names are
not known at render time (e.g., from navigation state):

```tsx
import { useScreenTrackingCallback } from '@contentful/optimization-react-native'

function DynamicScreen({ screenName }: { screenName: string }) {
  const trackScreenView = useScreenTrackingCallback()

  useEffect(() => {
    trackScreenView(screenName, { source: 'deep-link' })
  }, [screenName])

  return <View>...</View>
}
```

### `OptimizationNavigationContainer`

Wraps React Navigation's `NavigationContainer` to automatically track screen views when the active
route changes. Uses a render prop pattern so navigation props are spread onto the
`NavigationContainer` without requiring a direct dependency on `@react-navigation/native`:

```tsx
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import {
  OptimizationNavigationContainer,
  OptimizationProvider,
} from '@contentful/optimization-react-native'

const Stack = createNativeStackNavigator()

function App() {
  return (
    <OptimizationProvider instance={optimization}>
      <OptimizationNavigationContainer>
        {(navigationProps) => (
          <NavigationContainer {...navigationProps}>
            <Stack.Navigator>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Details" component={DetailsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </OptimizationNavigationContainer>
    </OptimizationProvider>
  )
}
```

| Prop            | Required? | Default | Description                                                       |
| --------------- | --------- | ------- | ----------------------------------------------------------------- |
| `children`      | Yes       | N/A     | Render prop receiving `ref`, `onReady`, and `onStateChange`       |
| `onStateChange` | No        | N/A     | Called when navigation state changes, after screen tracking fires |
| `onReady`       | No        | N/A     | Called when navigation container is ready, after initial tracking |
| `includeParams` | No        | `false` | Whether to include route params in screen event properties        |

## OptimizationRoot

`OptimizationRoot` is the recommended way to set up the SDK. It combines `OptimizationProvider` with
optional preview panel functionality:

```tsx
import { OptimizationRoot, OptimizationScrollProvider } from '@contentful/optimization-react-native'
import { createClient } from 'contentful'

const contentfulClient = createClient({
  space: 'your-space-id',
  accessToken: 'your-access-token',
})

function App() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="your-environment"
      previewPanel={{
        enabled: __DEV__, // Only show in development
        contentfulClient: contentfulClient,
      }}
    >
      <OptimizationScrollProvider>{/* Your app content */}</OptimizationScrollProvider>
    </OptimizationRoot>
  )
}
```

`OptimizationRoot` also accepts a `trackEntryInteraction` prop to control global view and tap
tracking for all `<OptimizedEntry />` components. By default, view tracking is enabled and tap
tracking is disabled:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  environment="your-environment"
  trackEntryInteraction={{ views: true, taps: true }}
>
  {/* All OptimizedEntry components will track both views and taps */}
</OptimizationRoot>
```

Individual `<OptimizedEntry />` components can override the global setting via their `trackViews`
and `trackTaps` props.

### Preview Panel

When `previewPanel.enabled` is `true`, a floating action button appears that opens the preview
panel. The panel allows developers to:

- Browse and override audience membership
- Select specific variants for experiences
- View current profile information
- Test optimizations without modifying actual user data

> [!IMPORTANT]
>
> The React Native preview panel is intentionally tightly coupled to Core preview internals. It uses
> symbol-keyed `registerPreviewPanel(...)` bridge access, direct signal updates, and state
> interceptors by design to apply immediate local overrides and keep preview behavior aligned with
> the Web preview panel.

```tsx
<OptimizationRoot
  clientId="your-client-id"
  environment="your-environment"
  previewPanel={{
    enabled: true,
    contentfulClient: contentfulClient,
    fabPosition: { bottom: 50, right: 20 }, // Optional: customize button position
    showHeader: true, // Optional: show header in panel
    onVisibilityChange: (isVisible) => {
      console.log('Preview panel visible:', isVisible)
    },
  }}
>
  {/* ... */}
</OptimizationRoot>
```

## Live Updates Behavior

By default, `<OptimizedEntry />` components **lock to the first variant they receive**. This
prevents UI "flashing" when user actions (like identifying or taking actions that change audience
membership) cause them to qualify for different optimizations mid-session.

### Default Behavior (Recommended)

```tsx
// User sees Variant A on initial load
<OptimizedEntry entry={heroEntry}>
  {(resolvedEntry) => <Hero data={resolvedEntry.fields} />}
</OptimizedEntry>

// Even if the user later qualifies for Variant B (e.g., after identify()),
// they continue to see Variant A until the component unmounts
```

This provides a stable user experience where content doesn't unexpectedly change while the user is
viewing it.

### Enabling Live Updates

There are three ways to enable live updates (immediate reactions to personalization changes):

#### 1. Preview Panel (Automatic)

When the preview panel is open, **all** `<OptimizedEntry />` components automatically enable live
updates. This allows developers to test different variants without refreshing the screen:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  environment="your-environment"
  previewPanel={{ enabled: true, contentfulClient }}
>
  {/* All OptimizedEntry components will live-update when panel is open */}
</OptimizationRoot>
```

#### 2. Global Setting via OptimizationRoot

Enable live updates for all `<OptimizedEntry />` components in your app:

```tsx
<OptimizationRoot clientId="your-client-id" environment="your-environment" liveUpdates={true}>
  {/* ... */}
</OptimizationRoot>
```

#### 3. Per-Component Override

Enable or disable live updates for specific components:

```tsx
// This component will always react to changes immediately
<OptimizedEntry entry={dashboardEntry} liveUpdates={true}>
  {(resolvedEntry) => <Dashboard data={resolvedEntry.fields} />}
</OptimizedEntry>

// This component locks to first variant, even if global liveUpdates is true
<OptimizedEntry entry={heroEntry} liveUpdates={false}>
  {(resolvedEntry) => <Hero data={resolvedEntry.fields} />}
</OptimizedEntry>
```

### Priority Order

The live updates setting is determined for a particular `<OptimizedEntry/>` component in this order
(highest to lowest priority):

1. **Preview panel open** - Always enables live updates (cannot be overridden)
2. **Component `liveUpdates` prop** - Per-component override
3. **`OptimizationRoot` `liveUpdates` prop** - Global setting
4. **Default** - Lock to first variant (`false`)

| Preview Panel | Global Setting | Component Prop | Result           |
| ------------- | -------------- | -------------- | ---------------- |
| Open          | any            | any            | Live updates ON  |
| Closed        | `true`         | `undefined`    | Live updates ON  |
| Closed        | `false`        | `true`         | Live updates ON  |
| Closed        | `true`         | `false`        | Live updates OFF |
| Closed        | `false`        | `undefined`    | Live updates OFF |

### `useLiveUpdates`

The `useLiveUpdates` hook provides read access to the live updates state from the nearest
`LiveUpdatesProvider`. Use it to check the current global live updates setting or preview panel
visibility:

```tsx
import { useLiveUpdates } from '@contentful/optimization-react-native'

function MyComponent() {
  const liveUpdates = useLiveUpdates()
  const isLive = liveUpdates?.globalLiveUpdates ?? false
  return <Text>{isLive ? 'Live' : 'Locked'}</Text>
}
```

## React Native-Specific Defaults

The SDK automatically configures:

- **Channel**: `'mobile'`
- **Library**: `'@contentful/optimization-react-native'`
- **Storage**: AsyncStorage for persisting changes, consent, profile, and selected optimizations
- **Event Builders**: Mobile-optimized locale, page properties, and user agent detection

### Persistence Behavior

AsyncStorage persistence is best-effort. If AsyncStorage write/remove calls fail, the SDK keeps
running with in-memory state and retries persistence on future writes.

Structured cached values (`changes`, `profile`, `selectedOptimizations`) are schema-validated on
load and access. Malformed JSON or schema-invalid values are automatically removed from in-memory
cache and AsyncStorage.

## Offline Support

The SDK automatically detects network connectivity changes and handles events appropriately when the
device goes offline. To enable this feature, install the optional peer dependency:

```sh
pnpm install @react-native-community/netinfo
```

Once installed, the SDK will:

- **Queue events** when the device is offline
- **Automatically flush** queued events when connectivity is restored
- **Flush events** when the app goes to background (to prevent data loss)

No additional configuration is required - the SDK handles everything automatically.

### How It Works

The SDK uses `@react-native-community/netinfo` to monitor network state changes. It prioritizes
`isInternetReachable` (actual internet connectivity) over `isConnected` (network interface
availability) for accurate detection.

| Platform | Native API Used       |
| -------- | --------------------- |
| iOS      | `NWPathMonitor`       |
| Android  | `ConnectivityManager` |

If `@react-native-community/netinfo` is not installed, the SDK will log a warning and continue
without offline detection. Events will still work normally when online.

## Polyfills

The SDK includes automatic polyfills for React Native to support modern JavaScript features:

- **Iterator Helpers (ES2025)**: Polyfilled using `es-iterator-helpers` to support methods like
  `.toArray()`, `.filter()`, `.map()` on iterators
- **`crypto.randomUUID()`**: Polyfilled using `react-native-uuid` to ensure the universal
  EventBuilder works seamlessly
- **`crypto.getRandomValues()`**: Polyfilled using `react-native-get-random-values` for secure
  random number generation

These polyfills are imported automatically when you use the SDK - no additional setup required by
your app.
