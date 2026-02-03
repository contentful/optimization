# @contentful/optimization-react-native

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

Contentful Optimization SDK for React Native applications.

## Installation

```bash
npm install @contentful/optimization-react-native @react-native-async-storage/async-storage
```

For offline support (recommended), also install:

```bash
npm install @react-native-community/netinfo
```

## Reference Implementation

- [React Native](/implementations/react-native/README.md): Example application that displays
  personalized content, with builds targeted for both Android and iOS (TODO: update link when README
  is added)

## Quick Start

```typescript
import { createClient } from 'contentful'
import Optimization, {
  OptimizationRoot,
  ScrollProvider,
  Personalization,
  Analytics,
} from '@contentful/optimization-react-native'

// Initialize the Contentful client
const contentful = createClient({
  space: 'your-space-id',
  accessToken: 'your-access-token',
})

// Initialize the Optimization SDK
const optimization = await Optimization.create({
  clientId: 'your-client-id',
  environment: 'your-environment',
})

// Fetch a baseline entry with full includes for personalization
const heroEntry = await contentful.getEntry('hero-baseline-id', {
  include: 10, // Required to load all variant data
})

// Wrap your app with OptimizationRoot
function App() {
  return (
    <OptimizationRoot
      instance={optimization}
      previewPanel={{
        enabled: __DEV__, // Enable preview panel in development
        contentfulClient: contentful,
      }}
    >
      <ScrollProvider>
        {/* For personalized entries */}
        <Personalization baselineEntry={heroEntry}>
          {(resolvedEntry) => (
            <HeroComponent
              title={resolvedEntry.fields.title}
              image={resolvedEntry.fields.image}
            />
          )}
        </Personalization>

        {/* For non-personalized entries */}
        <Analytics entry={productEntry}>
          <ProductCard data={productEntry.fields} />
        </Analytics>
      </ScrollProvider>
    </OptimizationRoot>
  )
}
```

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
{/* No ScrollProvider needed for non-scrollable content */}
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
<OptimizationRoot
  instance={optimization}
  liveUpdates={true} // All components react to changes immediately
>
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

## Features

This SDK provides all the functionality from `@contentful/optimization-core` plus React
Native-specific features:

### React Native Specific

- **OptimizationRoot**: Recommended wrapper that combines provider with optional preview panel
- **Personalization**: Component for tracking personalized Contentful entries with variant
  resolution and configurable live updates
- **Analytics**: Component for tracking non-personalized Contentful entries
- **OptimizationProvider**: React context provider for accessing the Optimization instance
- **ScrollProvider**: Wrapper around ScrollView that enables viewport tracking
- **Preview Panel**: Built-in debugging interface for testing personalizations
- **useOptimization**: Hook to access the Optimization instance in components
- **useLiveUpdates**: Hook to access live updates configuration
- **useViewportTracking**: Hook for custom viewport tracking logic
- **AsyncStorage Integration**: Automatic persistence of state using
  `@react-native-async-storage/async-storage`
- **React Native Defaults**: Pre-configured event builders for mobile context

### Core Functionality (Re-exported)

All core SDK features are available directly from this package:

- **Analytics**: `AnalyticsStateful`, `AnalyticsStateless` - Track user events
- **Personalization**: `Personalization` class and resolvers - Deliver personalized content
- **Signals**: `batch`, `effect`, `signals` - Reactive state management
- **Logger**: `logger` - Logging utilities
- **Types**: All TypeScript types and interfaces from core and API client

### Component Tracking Examples

#### Tracking Personalized Entries

The `<Personalization />` component handles variant resolution and tracking for personalized
Contentful entries:

```typescript
import { createClient } from 'contentful'
import { Personalization } from '@contentful/optimization-react-native'

const contentful = createClient({ /* ... */ })

// Fetch baseline entry with full includes (required for personalization)
const heroEntry = await contentful.getEntry('hero-baseline-id', {
  include: 10, // Loads all linked variants and experiences
})

function MyScreen() {
  return (
    <ScrollProvider>
      <Personalization baselineEntry={heroEntry}>
        {(resolvedEntry) => (
          <View>
            <Text>{resolvedEntry.fields.title}</Text>
            <Image source={{ uri: resolvedEntry.fields.image.fields.file.url }} />
          </View>
        )}
      </Personalization>
    </ScrollProvider>
  )
}
```

#### Tracking Non-Personalized Entries

The `<Analytics />` component tracks views of standard Contentful entries:

```typescript
import { Analytics } from '@contentful/optimization-react-native'

const productEntry = await contentful.getEntry('product-123')

function ProductScreen() {
  return (
    <ScrollProvider>
      <Analytics entry={productEntry}>
        <ProductCard
          name={productEntry.fields.name}
          price={productEntry.fields.price}
          image={productEntry.fields.image}
        />
      </Analytics>
    </ScrollProvider>
  )
}
```

#### Custom Tracking Thresholds

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

// In a component
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

### Complete Example

```typescript
import React, { useEffect, useState } from 'react'
import { View, Text, Image } from 'react-native'
import { createClient } from 'contentful'
import type { Entry } from 'contentful'
import Optimization, {
  logger,
  OptimizationRoot,
  ScrollProvider,
  Personalization,
  Analytics,
  type CoreConfig,
} from '@contentful/optimization-react-native'

// Initialize Contentful client
const contentful = createClient({
  space: 'your-space-id',
  accessToken: 'your-access-token',
})

// Use logger
logger.info('App starting')

// Optimization SDK config
const config: CoreConfig = {
  clientId: 'your-client-id',
  environment: 'main',
  logLevel: 'info',
}

function App() {
  const [optimization, setOptimization] = useState<Optimization | null>(null)
  const [heroEntry, setHeroEntry] = useState<Entry | null>(null)
  const [productEntry, setProductEntry] = useState<Entry | null>(null)

  useEffect(() => {
    // Initialize SDK and fetch entries
    Promise.all([
      Optimization.create(config),
      contentful.getEntry('hero-baseline-id', { include: 10 }),
      contentful.getEntry('product-123'),
    ]).then(([opt, hero, product]) => {
      setOptimization(opt)
      setHeroEntry(hero)
      setProductEntry(product)
    })
  }, [])

  if (!optimization || !heroEntry || !productEntry) {
    return <Text>Loading...</Text>
  }

  return (
    <OptimizationRoot
      instance={optimization}
      previewPanel={{
        enabled: __DEV__,
        contentfulClient: contentful,
      }}
    >
      <ScrollProvider>
        <View>
          {/* Personalized hero section */}
          <Personalization baselineEntry={heroEntry}>
            {(resolvedEntry) => (
              <View>
                <Text>{resolvedEntry.fields.title}</Text>
                <Text>{resolvedEntry.fields.description}</Text>
              </View>
            )}
          </Personalization>

          {/* Non-personalized product */}
          <Analytics entry={productEntry}>
            <View>
              <Text>{productEntry.fields.name}</Text>
              <Text>${productEntry.fields.price}</Text>
            </View>
          </Analytics>
        </View>
      </ScrollProvider>
    </OptimizationRoot>
  )
}
```

## React Native-Specific Defaults

The SDK automatically configures:

- **Channel**: `'mobile'`
- **Library**: `'Optimization React Native SDK'`
- **Storage**: AsyncStorage for persisting changes, consent, profile, and personalizations
- **Event Builders**: Mobile-optimized locale, page properties, and user agent detection

## Offline Support

The SDK automatically detects network connectivity changes and handles events appropriately when the
device goes offline. To enable this feature, install the optional peer dependency:

```bash
npm install @react-native-community/netinfo
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

### Polyfills

The SDK includes automatic polyfills for React Native to support modern JavaScript features:

- **Iterator Helpers (ES2025)**: Polyfilled using `es-iterator-helpers` to support methods like
  `.toArray()`, `.filter()`, `.map()` on iterators
- **`crypto.randomUUID()`**: Polyfilled using `react-native-uuid` to ensure the universal
  EventBuilder works seamlessly
- **`crypto.getRandomValues()`**: Polyfilled using `react-native-get-random-values` for secure
  random number generation

These polyfills are imported automatically when you use the SDK - no additional setup required by
your app.
