# @contentful/optimization-react-native

Contentful Optimization SDK for React Native applications.

## Installation

```bash
npm install @contentful/optimization-react-native @react-native-async-storage/async-storage
```

## Usage

```typescript
import Optimization, { logger, OptimizationProvider } from '@contentful/optimization-react-native'

// Initialize the SDK
const optimization = await Optimization.create({
  clientId: 'your-client-id',
  environment: 'your-environment',
})
```

## Features

This SDK provides all the functionality from `@contentful/optimization-core` plus React Native-specific features:

### React Native Specific

- **OptimizationProvider**: React component to wrap your app
- **AsyncStorage Integration**: Automatic persistence of state using `@react-native-async-storage/async-storage`
- **React Native Defaults**: Pre-configured event builders for mobile context

### Core Functionality (Re-exported)

All core SDK features are available directly from this package:

- **Analytics**: `AnalyticsStateful`, `AnalyticsStateless` - Track user events
- **Personalization**: `Personalization` class and resolvers - Deliver personalized content
- **Signals**: `batch`, `effect`, `signals` - Reactive state management
- **Logger**: `logger` - Logging utilities
- **Types**: All TypeScript types and interfaces from core and API client

### Example

```typescript
import Optimization, {
  logger,
  OptimizationProvider,
  type CoreConfig,
  type Profile,
} from '@contentful/optimization-react-native'

// Use logger
logger.info('App starting')

// Initialize SDK with config
const config: CoreConfig = {
  clientId: 'your-client-id',
  environment: 'main',
  logLevel: 'info',
}

const sdk = await Optimization.create(config)

// Use in React Native app
function App() {
  return (
    <OptimizationProvider>
      {/* Your app content */}
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
