<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Web SDK React Reference Implementation</h3>

<div align="center">

[Readme](./README.md) · [Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

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
- Optimization resolution and variant rendering
- Rich Text rendering via `@contentful/rich-text-react-renderer`
- Analytics event tracking
- Live updates behavior
- SPA navigation tracking with React Router v7
- Offline queue/recovery handling

The live updates section demonstrates the same parity scenarios directly in-page (default, forced
on, and locked), while keeping the main entry rendering flow customer-oriented.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

## Setup

From the **repository root**:

```bash
# Build SDK packages (required for local development)
pnpm build:pkgs

# Install implementation dependencies
pnpm run implementation:run -- web-sdk_react implementation:install
```

## Development

From the **repository root**:

```bash
# Start development server
pnpm run implementation:web-sdk_react dev

# Build for production
pnpm run implementation:web-sdk_react build

# Preview production build
pnpm run implementation:web-sdk_react preview

# Type checking
pnpm run implementation:web-sdk_react typecheck
```

Or from the **implementation directory** (`implementations/web-sdk_react`):

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
pnpm run implementation:web-sdk_react serve

# In terminal 2: run Playwright tests
pnpm run implementation:web-sdk_react test:e2e

# Interactive Playwright UI
pnpm run implementation:web-sdk_react test:e2e:ui

# Generate tests with Playwright codegen
pnpm run implementation:web-sdk_react test:e2e:codegen
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

Preview panel attachment is gated behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`. Set it to
`true` for development demos that need preview panel behavior.

## Project Structure

```
web-sdk_react/
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
import { useOptimizationResolver, useOptimization } from './optimization'

function MyComponent() {
  const { sdk, isReady } = useOptimization()
  const { resolveEntry } = useOptimizationResolver()
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

- [React Native Implementation](../react-native-sdk/) - Reference implementation for React Native
- [Web Vanilla Implementation](../web-sdk/) - Reference implementation for vanilla JavaScript
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
