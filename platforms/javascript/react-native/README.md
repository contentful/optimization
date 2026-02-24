<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization React Native SDK</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

The Optimization React Native SDK implements functionality specific to React Native applications,
based on the [Optimization Core Library](/universal/core/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](/README.md).

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
- [Component Tracking](#component-tracking)
  - [`<Personalization />` - For Personalized Entries](#personalization----for-personalized-entries)
  - [`<Analytics />` - For Non-Personalized Entries](#analytics----for-non-personalized-entries)
  - [ScrollView vs Non-ScrollView Usage](#scrollview-vs-non-scrollview-usage)
  - [Custom Tracking Thresholds](#custom-tracking-thresholds)
  - [Manual Analytics Tracking](#manual-analytics-tracking)
- [OptimizationRoot](#optimizationroot)
  - [Preview Panel](#preview-panel)
- [Live Updates Behavior](#live-updates-behavior)
  - [Default Behavior (Recommended)](#default-behavior-recommended)
  - [Enabling Live Updates](#enabling-live-updates)
  - [Priority Order](#priority-order)
- [React Native-Specific Defaults](#react-native-specific-defaults)
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

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import Optimization from '@contentful/optimization-react-native'
```

Configure and initialize the Optimization React Native SDK:

```ts
const optimization = await Optimization.create({
  clientId: 'your-client-id',
  environment: 'main',
})
```

## Reference Implementation

- [React Native](/implementations/react-native/README.md): Example application that displays
  personalized content, with builds targeted for both Android and iOS

## Configuration

### Top-level Configuration Options

| Option                     | Required? | Default                       | Description                                                       |
| -------------------------- | --------- | ----------------------------- | ----------------------------------------------------------------- |
| `allowedEventTypes`        | No        | `['identify', 'page']`        | Allow-listed event types permitted when consent is not set        |
| `analytics`                | No        | See "Analytics Options"       | Configuration specific to the Analytics/Insights API              |
| `clientId`                 | Yes       | N/A                           | The Optimization API key                                          |
| `defaults`                 | No        | `undefined`                   | Set of default state values applied on initialization             |
| `environment`              | No        | `'main'`                      | The environment identifier                                        |
| `eventBuilder`             | No        | See "Event Builder Options"   | Event builder configuration (channel/library metadata, etc.)      |
| `fetchOptions`             | No        | See "Fetch Options"           | Configuration for Fetch timeout and retry functionality           |
| `getAnonymousId`           | No        | `undefined`                   | Function used to obtain an anonymous user identifier              |
| `logLevel`                 | No        | `'error'`                     | Minimum log level for the default console sink                    |
| `personalization`          | No        | See "Personalization Options" | Configuration specific to the Personalization/Experience API      |
| `preventedComponentEvents` | No        | `undefined`                   | Initial duplication prevention configuration for component events |

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
Native SDK or any of its descendent SDKs.

| Option              | Required? | Default                                                               | Description                                                                        |
| ------------------- | --------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `app`               | No        | `undefined`                                                           | The application definition used to attribute events to a specific consumer app     |
| `channel`           | No        | `'mobile'`                                                            | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library`           | No        | `{ name: 'Optimization React Native SDK', version: '<pkg version>' }` | The client library metadata that is attached to all events                         |
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

## Component Tracking

**Important:** When we refer to "component tracking," we're talking about tracking **Contentful
entry components** (content entries in your CMS), NOT React Native UI components. The term
"component" comes from Contentful's terminology for personalized content entries.

The SDK provides two semantic components for tracking different types of Contentful entries:

### `<Personalization />` - For Personalized Entries

Use this component to track Contentful entries that can be personalized (have `nt_experiences`
field). It automatically:

- Resolves the correct variant based on user profile and active personalizations
- Provides the resolved entry via render prop
- Tracks component views when visibility and time thresholds are met

### `<Analytics />` - For Non-Personalized Entries

Use this component to track standard Contentful entries you want analytics on (articles, etc.). It:

- Tracks any Contentful entry without personalization
- Uses a simple children pattern (no render prop needed)
- Same visibility and time tracking as `<Personalization />`

Both components track when an entry:

- Is at least **80% visible** in the viewport (configurable via `threshold` prop)
- Has been viewed for **2000ms** (2 seconds, configurable via `viewTimeMs` prop)
- Has not already been tracked (deduplication handled by Core)

### ScrollView vs Non-ScrollView Usage

The tracking components work in two modes:

#### Inside ScrollView (Recommended for Scrollable Content)

When used inside a `<ScrollProvider>`, tracking uses the actual scroll position and viewport
dimensions:

```tsx
<ScrollProvider>
  <Personalization baselineEntry={entry}>
    {(resolvedEntry) => <HeroComponent data={resolvedEntry} />}
  </Personalization>
  <Analytics entry={productEntry}>
    <ProductCard data={productEntry.fields} />
  </Analytics>
</ScrollProvider>
```

**Benefits:**

- Accurate viewport tracking as user scrolls
- Works for content that appears below the fold
- Triggers when component scrolls into view

#### Outside ScrollView (For Non-Scrollable Content)

When used without `<ScrollProvider>`, tracking uses screen dimensions instead:

```tsx
<Personalization baselineEntry={entry}>
  {(resolvedEntry) => <FullScreenHero data={resolvedEntry} />}
</Personalization>

<Analytics entry={bannerEntry}>
  <Banner data={bannerEntry.fields} />
</Analytics>
```

**Note:** In this mode, `scrollY` is always `0` and viewport height equals the screen height. This
is ideal for:

- Full-screen components
- Non-scrollable layouts
- Content that's always visible when the screen loads

### Custom Tracking Thresholds

Both components support customizable visibility and time thresholds:

```typescript
<Personalization
  baselineEntry={entry}
  viewTimeMs={3000}      // Track after 3 seconds of visibility
  threshold={0.9}        // Require 90% visibility
>
  {(resolvedEntry) => <YourComponent data={resolvedEntry.fields} />}
</Personalization>

<Analytics
  entry={entry}
  viewTimeMs={1500}      // Track after 1.5 seconds
  threshold={0.5}        // Require 50% visibility
>
  <YourComponent />
</Analytics>
```

**Key Features:**

- Tracks only once per component instance
- Works with or without `ScrollProvider` (automatically adapts)
- Default: 80% visible for 2000ms (both configurable)
- Tracking fires even if user never scrolls (checks on initial layout)
- `<Personalization />` uses render prop pattern to provide resolved entry
- `<Analytics />` uses standard children pattern

### Manual Analytics Tracking

You can also manually track events using the analytics API:

```typescript
import Optimization, { useOptimization } from '@contentful/optimization-react-native'

function MyComponent() {
  const optimization = useOptimization()

  const trackManually = async () => {
    await optimization.analytics.trackComponentView({
      componentId: 'my-component',
      experienceId: 'exp-456',
      variantIndex: 0,
    })
  }

  return <Button onPress={trackManually} title="Track" />
}
```

## OptimizationRoot

`OptimizationRoot` is the recommended way to set up the SDK. It combines `OptimizationProvider` with
optional preview panel functionality:

```tsx
import Optimization, {
  OptimizationRoot,
  ScrollProvider,
} from '@contentful/optimization-react-native'
import { createClient } from 'contentful'

const contentfulClient = createClient({
  space: 'your-space-id',
  accessToken: 'your-access-token',
})

const optimization = await Optimization.create({
  clientId: 'your-client-id',
  environment: 'your-environment',
})

function App() {
  return (
    <OptimizationRoot
      instance={optimization}
      previewPanel={{
        enabled: __DEV__, // Only show in development
        contentfulClient: contentfulClient,
      }}
    >
      <ScrollProvider>{/* Your app content */}</ScrollProvider>
    </OptimizationRoot>
  )
}
```

### Preview Panel

When `previewPanel.enabled` is `true`, a floating action button appears that opens the preview
panel. The panel allows developers to:

- Browse and override audience membership
- Select specific variants for experiences
- View current profile information
- Test personalizations without modifying actual user data

```tsx
<OptimizationRoot
  instance={optimization}
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

By default, `<Personalization />` components **lock to the first variant they receive**. This
prevents UI "flashing" when user actions (like identifying or taking actions that change audience
membership) cause them to qualify for different personalizations mid-session.

### Default Behavior (Recommended)

```tsx
// User sees Variant A on initial load
<Personalization baselineEntry={heroEntry}>
  {(resolvedEntry) => <Hero data={resolvedEntry.fields} />}
</Personalization>

// Even if the user later qualifies for Variant B (e.g., after identify()),
// they continue to see Variant A until the component unmounts
```

This provides a stable user experience where content doesn't unexpectedly change while the user is
viewing it.

### Enabling Live Updates

There are three ways to enable live updates (immediate reactions to personalization changes):

#### 1. Preview Panel (Automatic)

When the preview panel is open, **all** `<Personalization />` components automatically enable live
updates. This allows developers to test different variants without refreshing the screen:

```tsx
<OptimizationRoot instance={optimization} previewPanel={{ enabled: true, contentfulClient }}>
  {/* All Personalization components will live-update when panel is open */}
</OptimizationRoot>
```

#### 2. Global Setting via OptimizationRoot

Enable live updates for all `<Personalization />` components in your app:

```tsx
<OptimizationRoot instance={optimization} liveUpdates={true}>
  {/* ... */}
</OptimizationRoot>
```

#### 3. Per-Component Override

Enable or disable live updates for specific components:

```tsx
// This component will always react to changes immediately
<Personalization baselineEntry={dashboardEntry} liveUpdates={true}>
  {(resolvedEntry) => <Dashboard data={resolvedEntry.fields} />}
</Personalization>

// This component locks to first variant, even if global liveUpdates is true
<Personalization baselineEntry={heroEntry} liveUpdates={false}>
  {(resolvedEntry) => <Hero data={resolvedEntry.fields} />}
</Personalization>
```

### Priority Order

The live updates setting is determined for a particular `<Personalization/>` component in this order
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

## React Native-Specific Defaults

The SDK automatically configures:

- **Channel**: `'mobile'`
- **Library**: `'Optimization React Native SDK'`
- **Storage**: AsyncStorage for persisting changes, consent, profile, and personalizations
- **Event Builders**: Mobile-optimized locale, page properties, and user agent detection

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
