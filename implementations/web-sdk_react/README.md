<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Web SDK React Adapter Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation demonstrating `@contentful/optimization-web` usage in a React web
application with a local adapter layer.

> [!NOTE]
>
> For customer React applications that use the official React framework package, start with the
> [React Web SDK reference implementation](../react-web-sdk/README.md). This implementation remains
> useful when you need to understand how a React adapter can be built directly on top of the Web
> SDK.

> [!NOTE]
>
> This implementation uses [Rsbuild](https://rsbuild.dev/) for consistency with the SDK build
> tooling. If you're creating your own React application, you can use any build tool you prefer
> (Vite, Create React App, Next.js, etc.); the SDK integration patterns demonstrated here work the
> same way.

## What this demonstrates

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

1. Build SDK packages, which is required for local development:

```sh
pnpm build:pkgs
```

2. Install implementation dependencies:

```sh
pnpm implementation:run -- web-sdk_react implementation:install
```

## Running locally

From the **repository root**:

1. Start the development server:

```sh
pnpm implementation:run -- web-sdk_react dev
```

2. Build for production:

```sh
pnpm implementation:run -- web-sdk_react build
```

3. Preview the production build:

```sh
pnpm implementation:run -- web-sdk_react preview
```

4. Run type checking:

```sh
pnpm implementation:run -- web-sdk_react typecheck
```

The equivalent implementation-directory commands are:

```sh
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
```

## Running E2E tests

1. Run the full E2E setup and test suite from the repository root:

```sh
pnpm setup:e2e:web-sdk_react
pnpm test:e2e:web-sdk_react
```

2. Or run the Playwright flow step by step:

```sh
pnpm implementation:run -- web-sdk_react serve
```

In another terminal:

```sh
pnpm --dir implementations/web-sdk_react --ignore-workspace exec playwright test
```

When finished:

```sh
pnpm implementation:run -- web-sdk_react serve:stop
```

3. Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- web-sdk_react test:e2e:ui
pnpm implementation:run -- web-sdk_react test:e2e:codegen
```

## Environment variables

Copy `.env.example` to `.env` and configure:

```sh
cp .env.example .env
```

See `.env.example` for available configuration options. The implementation reads from
`import.meta.env` directly and falls back to local mock-safe defaults, so it can run without extra
env wiring. To use local mock Contentful endpoints, set `PUBLIC_CONTENTFUL_CDA_HOST=localhost:8000`
and `PUBLIC_CONTENTFUL_BASE_PATH=contentful`.

Preview panel attachment is gated behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`. Set it to
`true` for development demos that need preview panel behavior.

## Project structure

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

## SDK integration patterns

This implementation demonstrates how to build a React adapter for `@contentful/optimization-web`.
Key patterns include:

### Provider setup

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

### Using hooks

```tsx
import { useOptimizationResolver, useOptimization } from './optimization'

function MyComponent() {
  const { sdk, isReady } = useOptimization()
  const { resolveEntry } = useOptimizationResolver()
  const resolved = resolveEntry(baseEntry)

  // ...
}
```

### Analytics tracking

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

- [React Web SDK reference implementation](../react-web-sdk/README.md) - Primary React
  implementation using the official React SDK package
- [React Native Implementation](../react-native-sdk/README.md) - Reference implementation for React
  Native
- [Web Vanilla Implementation](../web-sdk/README.md) - Reference implementation for vanilla
  JavaScript
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
