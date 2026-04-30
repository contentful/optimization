<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">React Web SDK Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

Reference implementation demonstrating `@contentful/optimization-react-web` usage in a React SPA.
This is the primary React Web reference implementation for customer-style usage of the official
React framework package.

> [!NOTE]
>
> This implementation is the React Web SDK counterpart to
> [`web-sdk_react`](../web-sdk_react/README.md). Where `web-sdk_react` builds its own React adapter
> layer over `@contentful/optimization-web`, this implementation uses the official
> `@contentful/optimization-react-web` framework package directly, as a customer would. There is no
> `src/optimization/` adapter directory.

## What This Demonstrates

| Feature                      | SDK Surface Used                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Provider + initialization    | `OptimizationRoot`                                                                         |
| SPA page tracking            | `ReactRouterAutoPageTracker` from `@contentful/optimization-react-web/router/react-router` |
| Entry resolution + rendering | `OptimizedEntry` (render-prop), `useOptimization().resolveEntry()`                         |
| Live updates (global)        | `OptimizationRoot liveUpdates` prop                                                        |
| Live updates (per-component) | `OptimizedEntry liveUpdates` prop                                                          |
| Live updates (locked)        | `<OptimizedEntry liveUpdates={false}>`                                                     |
| Merge tag rendering          | `useOptimization().getMergeTagValue()`                                                     |
| Nested personalization       | Nested `<OptimizedEntry>` composition                                                      |
| Consent gating               | `sdk.consent()` via `useOptimizationContext()`                                             |
| Identify / reset             | `sdk.identify()` / `sdk.reset()` via `useOptimizationContext()`                            |
| Auto view/click/hover        | `autoTrackEntryInteraction` on `OptimizationRoot` + `data-ctfl-*` attributes               |
| Manual view tracking         | `useOptimization().interactionTracking.enableElement()`                                    |
| Flag view tracking           | `sdk.states.flag('boolean').subscribe()`                                                   |
| Analytics event stream       | `sdk.states.eventStream.subscribe()`                                                       |
| Preview panel toggle UI      | `useLiveUpdates().previewPanelVisible` / `setPreviewPanelVisible()`                        |
| Offline queue / recovery     | Inherited from `@contentful/optimization-web` runtime                                      |

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

## Quick Start

Run the one-shot launcher to configure everything and start the app:

```sh
./implementations/react-web-sdk/scripts/launch-reference-app.sh
```

Or from the **implementation directory**:

```sh
pnpm launch
```

This single command will install dependencies, build SDK packages, set up `.env`, start the mock API
server, and launch the dev server. Once complete, the app is available at `http://localhost:3000`.

Use flags to skip steps on subsequent runs:

```sh
./scripts/launch-reference-app.sh --skip-build
./scripts/launch-reference-app.sh --skip-install
```

## Manual Setup

From the **repository root**:

```sh
pnpm build:pkgs
pnpm implementation:run -- react-web-sdk implementation:install
```

## Running Locally

From the **repository root**:

1. Start the development server:

```sh
pnpm implementation:run -- react-web-sdk dev
```

2. Build for production:

```sh
pnpm implementation:run -- react-web-sdk build
```

3. Run type checking:

```sh
pnpm implementation:run -- react-web-sdk typecheck
```

The equivalent implementation-directory commands are:

```sh
pnpm dev
pnpm build
pnpm typecheck
```

## Running E2E Tests

1. Run the full E2E setup and test suite from the repository root:

```sh
pnpm setup:e2e:react-web-sdk
pnpm test:e2e:react-web-sdk
```

2. Or run the Playwright flow step by step:

```sh
pnpm implementation:run -- react-web-sdk serve
```

In another terminal:

```sh
pnpm --dir implementations/react-web-sdk --ignore-workspace exec playwright test
```

When finished:

```sh
pnpm implementation:run -- react-web-sdk serve:stop
```

## Environment Variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

All variables have mock-safe defaults. To use local mock endpoints (the default), no changes are
needed. See `.env.example` for the full list.

## Project Structure

```
react-web-sdk/
├── src/
│   ├── main.tsx                        # OptimizationRoot + createBrowserRouter + ReactRouterAutoPageTracker
│   ├── App.tsx                         # Shared layout: SDK state, entry loading, nav, AnalyticsEventDisplay
│   ├── components/
│   │   ├── AnalyticsEventDisplay.tsx   # Live event stream panel (persists across routes)
│   │   └── RichTextRenderer.tsx        # Rich text + merge tag rendering
│   ├── config/
│   │   ├── entries.ts                  # Entry ID constants
│   │   └── routes.ts                   # Route path constants
│   ├── pages/
│   │   ├── HomePage.tsx                # Utility panel, live updates, entry sections
│   │   └── PageTwoPage.tsx             # Navigation + conversion tracking demo
│   ├── sections/
│   │   ├── ContentEntry.tsx            # Auto/manual tracked entry renderer
│   │   ├── LiveUpdatesExampleEntry.tsx # Live updates parity: default / locked / always-live
│   │   ├── NestedContentEntry.tsx      # Nested personalization wrapper
│   │   └── NestedContentItem.tsx       # Recursive nested entry via OptimizedEntry
│   ├── services/
│   │   └── contentfulClient.ts         # Contentful CDA client
│   ├── types/
│   │   ├── contentful.ts               # Entry type definitions
│   │   └── env.d.ts                    # import.meta.env typings
│   └── utils/
│       └── typeGuards.ts               # isRecord helper
├── e2e/                                # Playwright E2E tests (parity with web-sdk_react)
├── index.html
├── .env.example
├── package.json
├── rsbuild.config.ts
├── tsconfig.json
├── playwright.config.mjs
├── AGENTS.md
└── README.md
```

## SDK Integration Patterns

### Provider Setup

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'
import { useState } from 'react'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

function RootLayout() {
  const [liveUpdates, setLiveUpdates] = useState(false)

  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      api={{
        insightsBaseUrl: 'https://ingest.insights.ninetailed.co/',
        experienceBaseUrl: 'https://experience.ninetailed.co/',
      }}
      autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      liveUpdates={liveUpdates}
    >
      <ReactRouterAutoPageTracker />
      <Outlet context={{ onToggleLiveUpdates: () => setLiveUpdates((v) => !v) }} />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'page-two', element: <PageTwoPage /> },
        ],
      },
    ],
  },
])
```

### Rendering Optimized Content

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'

function HeroSection({ entry }) {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolvedEntry) => <p>{resolvedEntry.fields.text}</p>}
    </OptimizedEntry>
  )
}
```

### Live Updates

```tsx
// Global: controlled via OptimizationRoot prop (lifted state in parent)
<OptimizationRoot liveUpdates={globalLiveUpdates} ...>

// Per-component: always live regardless of global setting
<OptimizedEntry baselineEntry={entry} liveUpdates={true}>
  {(resolved) => <Card entry={resolved} />}
</OptimizedEntry>

// Per-component: locked to first resolved value
<OptimizedEntry baselineEntry={entry} liveUpdates={false}>
  {(resolved) => <Card entry={resolved} />}
</OptimizedEntry>
```

### Consent, Identify, Reset

```tsx
import { useOptimizationContext } from '@contentful/optimization-react-web'

function Controls() {
  const { sdk } = useOptimizationContext()

  return (
    <>
      <button onClick={() => sdk.consent(true)}>Accept</button>
      <button onClick={() => void sdk.identify({ userId: 'u1', traits: { identified: true } })}>
        Identify
      </button>
      <button onClick={() => sdk.reset()}>Reset</button>
    </>
  )
}
```

### Manual Interaction Tracking

```tsx
import { useOptimization } from '@contentful/optimization-react-web'
import { useEffect, useRef } from 'react'

function ManuallyTrackedEntry({ entry }) {
  const { interactionTracking, resolveEntry } = useOptimization()
  const ref = useRef(null)
  const resolved = resolveEntry(entry)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    interactionTracking.enableElement('views', el, { data: { entryId: resolved.sys.id } })
    return () => interactionTracking.clearElement('views', el)
  }, [resolved.sys.id, interactionTracking])

  return <div ref={ref}>{String(resolved.fields.text)}</div>
}
```

### Auto Tracking Attributes

For entries tracked via `autoTrackEntryInteraction`, apply `data-ctfl-*` attributes directly on the
visible content element inside the render prop:

```tsx
<OptimizedEntry baselineEntry={entry}>
  {(resolvedEntry) => (
    <div
      data-ctfl-entry-id={resolvedEntry.sys.id}
      data-ctfl-baseline-id={entry.sys.id}
      data-ctfl-hover-duration-update-interval-ms="1000"
      data-ctfl-clickable="true" // mark as click target
    >
      {String(resolvedEntry.fields.text)}
    </div>
  )}
</OptimizedEntry>
```

> The `OptimizationRoot` `autoTrackEntryInteraction` prop activates automatic view, click, and hover
> tracking for any DOM element that has `data-ctfl-entry-id`. The SDK's MutationObserver registers
> elements as they appear in the DOM after consent is given.

## Migration from web-sdk_react

| `web-sdk_react` Local Code                            | `react-web-sdk` Equivalent                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `src/optimization/createOptimization.ts`              | Config props on `OptimizationRoot`                                    |
| `src/optimization/OptimizationProvider.tsx`           | `OptimizationRoot` / `OptimizationProvider`                           |
| `src/optimization/hooks/useOptimization.ts`           | `useOptimization()` / `useOptimizationContext()`                      |
| `src/optimization/hooks/useOptimizationResolver.ts`   | `useOptimization().resolveEntry()` / `resolveEntryData()`             |
| `src/optimization/hooks/useOptimizationState.ts`      | Direct `sdk.states.*` subscriptions via `useOptimizationContext()`    |
| `src/optimization/hooks/useAnalytics.ts`              | `sdk.trackView()` / `sdk.trackClick()` via `useOptimizationContext()` |
| `src/optimization/liveUpdates/LiveUpdatesContext.tsx` | `useLiveUpdates()` from `@contentful/optimization-react-web`          |
| Manual `sdk.page()` in `useEffect`                    | `ReactRouterAutoPageTracker`                                          |
| Manual `selectedOptimizations` lock logic             | `<OptimizedEntry liveUpdates={false}>`                                |

**What stays the same:** `contentfulClient.ts`, entry/route config, type definitions,
`RichTextRenderer`, E2E test files, page/section component structure.

**Key architectural difference:** `App.tsx` acts as a persistent layout (contains
`AnalyticsEventDisplay` that stays mounted across route changes). Pages are route children that
receive state via `useOutletContext`.

## Related

- [web-sdk_react](../web-sdk_react/README.md) - adapter-based reference using
  `@contentful/optimization-web`
- [web-sdk](../web-sdk/README.md) - vanilla JavaScript reference
- [@contentful/optimization-react-web](../../packages/web/frameworks/react-web-sdk/README.md) -
  React Web SDK
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK
