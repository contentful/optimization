# Web React Reference Implementation

Reference implementation demonstrating `@contentful/optimization-web` usage in a React web
application.

> **Note:** This implementation uses [Rsbuild](https://rsbuild.dev/) for consistency with the SDK
> build tooling. If you're creating your own React application, you can use any build tool you
> prefer (Vite, Create React App, Next.js, etc.) — the SDK integration patterns demonstrated here
> will work the same way.

## Overview

This implementation provides a thin React adapter layer over `@contentful/optimization-web`,
demonstrating:

- `OptimizationProvider` context for SDK state management
- React hooks for SDK state subscriptions
- Personalization resolution and variant rendering
- Rich Text rendering via `@contentful/rich-text-react-renderer`
- Analytics event tracking
- Live updates behavior
- SPA navigation tracking with React Router v7
- Offline queue/recovery handling

The live updates section demonstrates the same parity scenarios directly in-page (default, forced
on, and locked), while keeping the main entry rendering flow customer-oriented.

## Prerequisites

- Node.js >= 16.20.0
- pnpm 10.x

## Setup

From the **repository root**:

```bash
# Build SDK packages (required for local development)
pnpm build:pkgs

# Install implementation dependencies
pnpm run implementation:run -- web-react implementation:install
```

## Development

From the **repository root**:

```bash
# Start development server
pnpm run implementation:web-react dev

# Build for production
pnpm run implementation:web-react build

# Preview production build
pnpm run implementation:web-react preview

# Type checking
pnpm run implementation:web-react typecheck
```

Or from the **implementation directory** (`implementations/web-react`):

```bash
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
```

## Testing

### E2E Tests

```bash
# In terminal 1: start mocks + app preview
pnpm run implementation:web-react serve

# In terminal 2: run Playwright tests
pnpm run implementation:web-react test:e2e

# Interactive Playwright UI
pnpm run implementation:web-react test:e2e:ui

# Generate tests with Playwright codegen
pnpm run implementation:web-react test:e2e:codegen
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

See `.env.example` for available configuration options. The implementation reads from
`import.meta.env` directly and falls back to local mock-safe defaults, so it can run without extra
env wiring. To use local mock Contentful endpoints, set `PUBLIC_CONTENTFUL_CDA_HOST=localhost:8000`
and `PUBLIC_CONTENTFUL_BASE_PATH=contentful`.

## Project Structure

```
web-react/
├── src/
│   ├── main.tsx              # Application entry point
│   ├── App.tsx               # Root component
│   ├── optimization/         # SDK React adapter
│   │   ├── OptimizationProvider.tsx
│   │   ├── hooks/
│   │   └── components/
│   ├── pages/                # Route pages
│   └── components/           # UI components
├── e2e/                      # Playwright E2E tests
├── public/                   # Static assets
├── index.html                # HTML template
├── rsbuild.config.ts         # Rsbuild configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## SDK Integration Patterns

This implementation demonstrates how to build a React adapter for `@contentful/optimization-web`.
Key patterns include:

### Provider Setup

```tsx
import { OptimizationProvider } from './optimization'

function App() {
  return (
    <OptimizationProvider>
      <YourApp />
    </OptimizationProvider>
  )
}
```

### Using Hooks

```tsx
import { usePersonalization, useOptimization } from './optimization'

function MyComponent() {
  const { sdk, isReady } = useOptimization()
  const { resolveEntry } = usePersonalization()
  const resolved = resolveEntry(baseEntry)

  // ...
}
```

### Analytics Tracking

```tsx
import { useAnalytics } from './optimization'

function TrackedComponent() {
  const { trackView } = useAnalytics()

  useEffect(() => {
    void trackView({ componentId: 'component-id' })
  }, [])

  // ...
}
```

## Related

- [React Native Implementation](../react-native/) - Reference implementation for React Native
- [Web Vanilla Implementation](../web-vanilla/) - Reference implementation for vanilla JavaScript
- [@contentful/optimization-web](../../../platforms/javascript/web/) - Web SDK package
