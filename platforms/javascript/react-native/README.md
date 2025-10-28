# @contentful/optimization-react-native

Contentful Optimization SDK for React Native applications.

## Installation

```bash
npm install @contentful/optimization-react-native @react-native-async-storage/async-storage
```

## Quick Start

```typescript
import { createClient } from 'contentful'
import Optimization, {
  OptimizationProvider,
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

// Wrap your app with the providers
function App() {
  return (
    <OptimizationProvider instance={optimization}>
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
    </OptimizationProvider>
  )
}
```

## Component Tracking

**Important:** When we refer to "component tracking," we're talking about tracking **Contentful entry components** (content entries in your CMS), NOT React Native UI components. The term "component" comes from Contentful's terminology for personalized content entries.

The SDK provides two semantic components for tracking different types of Contentful entries:

### `<Personalization />` - For Personalized Entries

Use this component to track Contentful entries that can be personalized (have `nt_experiences` field). It automatically:

- Resolves the correct variant based on user profile and active personalizations
- Provides the resolved entry via render prop
- Tracks component views when visibility and time thresholds are met

### `<Analytics />` - For Non-Personalized Entries

Use this component to track standard Contentful entries you want analytics on (products, articles, etc.). It:

- Tracks any Contentful entry without personalization
- Uses a simple children pattern (no render prop needed)
- Same visibility and time tracking as `<Personalization />`

Both components track when an entry:

- Is at least **80% visible** in the viewport (configurable via `threshold` prop)
- Has been viewed for **2000ms** (2 seconds, configurable via `viewTimeMs` prop)
- Has not already been tracked (deduplication handled by Core)

## Features

This SDK provides all the functionality from `@contentful/optimization-core` plus React Native-specific features:

### React Native Specific

- **Personalization**: Component for tracking personalized Contentful entries with variant resolution
- **Analytics**: Component for tracking non-personalized Contentful entries
- **OptimizationProvider**: React context provider for accessing the Optimization instance
- **ScrollProvider**: Wrapper around ScrollView that enables viewport tracking
- **useOptimization**: Hook to access the Optimization instance in components
- **useViewportTracking**: Hook for custom viewport tracking logic
- **AsyncStorage Integration**: Automatic persistence of state using `@react-native-async-storage/async-storage`
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

The `<Personalization />` component handles variant resolution and tracking for personalized Contentful entries:

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
- Works with ScrollView via `ScrollProvider`
- Default: 80% visible for 2000ms (both configurable)
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
  OptimizationProvider,
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
    <OptimizationProvider instance={optimization}>
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
    </OptimizationProvider>
  )
}
```

## React Native-Specific Defaults

The SDK automatically configures:

- **Channel**: `'react-native'`
- **Library**: `'Optimization React Native API'`
- **Storage**: AsyncStorage for persisting changes, consent, profile, and personalizations
- **Event Builders**: Mobile-optimized locale, page properties, and user agent detection
- **Crypto Polyfill**: Automatically polyfills `crypto.randomUUID()` using `react-native-uuid` and `react-native-get-random-values`

### Polyfills

The SDK includes automatic polyfills for React Native to support modern JavaScript features:

- **Iterator Helpers (ES2025)**: Polyfilled using `es-iterator-helpers` to support methods like `.toArray()`, `.filter()`, `.map()` on iterators
- **`crypto.randomUUID()`**: Polyfilled using `react-native-uuid` to ensure the universal EventBuilder works seamlessly
- **`crypto.getRandomValues()`**: Polyfilled using `react-native-get-random-values` for secure random number generation

These polyfills are imported automatically when you use the SDK - no additional setup required by your app.
