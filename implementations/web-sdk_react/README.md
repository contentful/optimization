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
> tooling. If you're creating your own browser-rendered React application, you can use any
> client-side build tool you prefer (Vite, Create React App, etc.); the direct Web SDK adapter
> patterns demonstrated here apply to browser React apps. For Next.js apps, use
> `@contentful/optimization-nextjs` with the
> [Next.js SDK README](../../packages/web/frameworks/nextjs-sdk/README.md),
> [App Router reference](../nextjs-sdk_app-router/README.md), or
> [Pages Router reference](../nextjs-sdk_pages-router/README.md) instead.

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

## CDA locale handling

The adapter defines one `APP_LOCALE`, passes it as the Web SDK top-level `locale`, and passes it
directly to Contentful CDA `getEntry()` calls. Do not use `contentful.js` `withAllLocales` or raw
CDA `locale=*` for entries passed to the adapter resolver; SDK entry resolution expects direct
single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

This reference uses the supported manual path: application code fetches single-locale Contentful
entries and passes them to SDK entry resolution. For JavaScript integrations with an
application-owned `contentful.js` client, we recommend configuring the SDK with
`contentful: { client: contentfulClient }` and using managed fetching (`fetchOptimizedEntry()`,
`entryId`, and optional `entryQuery` where supported). Keep the manual `baselineEntry` /
`resolveOptimizedEntry()` path when the application must own fetching, caching, or response shaping.

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

From the **repository root**:

1. Install pnpm packages:

```sh
pnpm install
```

2. Build SDK packages, which is required for local development:

```sh
pnpm build:pkgs
```

3. Install implementation dependencies:

```sh
pnpm implementation:run -- web-sdk_react implementation:install
```

4. Create the local `.env` file if it does not already exist:

```sh
test -f implementations/web-sdk_react/.env || cp implementations/web-sdk_react/.env.example implementations/web-sdk_react/.env
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

2. Or run the shared Playwright flow step by step:

```sh
pnpm implementation:run -- web-sdk_react serve
```

In another terminal:

```sh
IMPLEMENTATION=web-sdk_react pnpm --dir lib/e2e-web test
```

When finished:

```sh
pnpm implementation:run -- web-sdk_react serve:stop
```

This implementation uses the shared Playwright suite from
[`lib/e2e-web`](../../lib/e2e-web/README.md). The implementation sets `IMPLEMENTATION=web-sdk_react`
when invoking that suite.

3. Use Playwright UI or the report viewer when needed:

```sh
pnpm implementation:run -- web-sdk_react test:e2e:ui
pnpm implementation:run -- web-sdk_react test:e2e:report
```

## Environment variables

The setup step creates the local `.env` file if needed:

```sh
test -f implementations/web-sdk_react/.env || cp implementations/web-sdk_react/.env.example implementations/web-sdk_react/.env
```

See `.env.example` for the Contentful and Optimization API values used by the local mock setup. The
Optimization SDK client has mock-safe defaults for its client ID, environment, and API base URLs,
but Contentful entry loading requires the Contentful env vars from `.env.example`. To use local mock
Contentful endpoints, set `PUBLIC_CONTENTFUL_CDA_HOST=localhost:8000` and
`PUBLIC_CONTENTFUL_BASE_PATH=contentful`.

Preview panel attachment is controlled at build time by `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`.
Set it to `true` before starting or building the app for development demos that need preview panel
behavior.

## Project structure

```
web-sdk_react/
├── src/
│   ├── main.tsx              # Application entry point
│   ├── App.tsx               # Root component
│   ├── optimization/         # SDK React adapter
│   │   ├── OptimizationProvider.tsx
│   │   ├── hooks/
│   │   └── liveUpdates/
│   ├── components/           # Shared UI components
│   ├── pages/                # Route pages
│   ├── sections/             # Entry rendering sections
│   ├── services/             # Contentful client setup
│   └── types/                # Local Contentful and env types
├── index.html                # HTML template
├── rsbuild.config.ts         # Rsbuild configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## Adapter touchpoints

This implementation demonstrates a local React adapter over `@contentful/optimization-web`. Use the
[@contentful/optimization-web package README](../../packages/web/web-sdk/README.md) for API-level
Web SDK workflows, and compare against the
[React Web SDK reference implementation](../react-web-sdk/README.md) for the preferred official
React package integration.

Implementation-specific touchpoints:

- `src/optimization/OptimizationProvider.tsx` owns Web SDK lifecycle and provider state.
- `src/optimization/hooks/` exposes local hooks for SDK access, entry resolution, and analytics
  actions.
- `src/optimization/liveUpdates/` owns preview-panel-aware live update context.
- `src/sections/` renders optimized Contentful entries and wires entry tracking attributes.
- `src/components/` contains shared UI components for rich text, controls, and tracking display.

## Related

- [React Web SDK reference implementation](../react-web-sdk/README.md) - Primary React
  implementation using the official React SDK package
- [React Native reference implementation](../react-native-sdk/README.md) - React Native reference
  implementation
- [Web SDK Vanilla JS reference implementation](../web-sdk/README.md) - Vanilla JavaScript reference
  implementation
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
