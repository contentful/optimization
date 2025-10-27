# @contentful/optimization-react-native

Contentful Optimization SDK for React Native applications.

## Installation

```bash
npm install @contentful/optimization-react-native @react-native-async-storage/async-storage
```

## Quick Start

```typescript
import Optimization, {
  OptimizationProvider,
  ScrollProvider,
  OptimizationTrackedView,
} from '@contentful/optimization-react-native'

// Initialize the SDK
const optimization = await Optimization.create({
  clientId: 'your-client-id',
  environment: 'your-environment',
})

// Wrap your app with the provider
function App() {
  return (
    <OptimizationProvider instance={optimization}>
      <ScrollProvider>
        <OptimizationTrackedView
          componentId="hero-banner"
          experienceId="exp-123"
          variantIndex={0}
        >
          <YourPersonalizedContent />
        </OptimizationTrackedView>
      </ScrollProvider>
    </OptimizationProvider>
  )
}
```

## Features

This SDK provides all the functionality from `@contentful/optimization-core` plus React Native-specific features:

### React Native Specific

- **OptimizationProvider**: React context provider for accessing the Optimization instance
- **OptimizationTrackedView**: Automatically track component views when they enter the viewport
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

### Viewport Tracking

The SDK provides automatic viewport tracking for personalized components. When a tracked component becomes fully visible in the viewport, it automatically sends a component view event.

```typescript
import {
  OptimizationProvider,
  ScrollProvider,
  OptimizationTrackedView,
} from '@contentful/optimization-react-native'

function MyScreen() {
  return (
    <OptimizationProvider instance={optimizationInstance}>
      <ScrollProvider>
        <OptimizationTrackedView
          componentId="hero-banner"
          experienceId="exp-123"
          variantIndex={0}
        >
          <HeroBanner />
        </OptimizationTrackedView>

        <OptimizationTrackedView
          componentId="product-card"
          variantIndex={1}
        >
          <ProductCard />
        </OptimizationTrackedView>
      </ScrollProvider>
    </OptimizationProvider>
  )
}
```

**Key Features:**

- Tracks only once per component (when it first becomes fully visible)
- Works with ScrollView via `ScrollProvider`
- Requires component to be 100% visible by default
- Configurable visibility threshold via `threshold` prop (0.0 to 1.0)

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
import { View, Text } from 'react-native'
import Optimization, {
  logger,
  OptimizationProvider,
  ScrollProvider,
  OptimizationTrackedView,
  type CoreConfig,
} from '@contentful/optimization-react-native'

// Use logger
logger.info('App starting')

// Initialize SDK
const config: CoreConfig = {
  clientId: 'your-client-id',
  environment: 'main',
  logLevel: 'info',
}

function App() {
  const [optimization, setOptimization] = useState<Optimization | null>(null)

  useEffect(() => {
    Optimization.create(config).then(setOptimization)
  }, [])

  if (!optimization) {
    return <Text>Loading...</Text>
  }

  return (
    <OptimizationProvider instance={optimization}>
      <ScrollProvider>
        <View>
          <OptimizationTrackedView
            componentId="header"
            variantIndex={0}
          >
            <Text>Personalized Header</Text>
          </OptimizationTrackedView>
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
