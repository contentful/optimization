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
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation demonstrating `@contentful/optimization-react-web` usage in a React SPA.
This is the primary React Web reference implementation for customer-style usage of the official
React framework package.

> [!NOTE]
>
> This implementation is the React Web SDK counterpart to
> [`web-sdk_react`](../web-sdk_react/README.md). Where `web-sdk_react` builds its own React adapter
> layer over `@contentful/optimization-web`, this implementation uses the official
> `@contentful/optimization-react-web` framework package directly to match customer integration
> code. There is no `src/optimization/` adapter directory.

## What this demonstrates

| Feature                      | SDK surface used                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Provider + initialization    | `OptimizationRoot`                                                                         |
| SPA page tracking            | `ReactRouterAutoPageTracker` from `@contentful/optimization-react-web/router/react-router` |
| Entry resolution + rendering | `OptimizedEntry` (render-prop), `useEntryResolver().resolveEntry()`                        |
| Live updates (global)        | `OptimizationRoot liveUpdates` prop                                                        |
| Live updates (per-component) | `OptimizedEntry liveUpdates` prop                                                          |
| Live updates (locked)        | `<OptimizedEntry liveUpdates={false}>`                                                     |
| Merge tag rendering          | `useMergeTagResolver().getMergeTagValue()`                                                 |
| Nested personalization       | Nested `<OptimizedEntry>` composition                                                      |
| Consent gating               | `sdk.consent()` via `useOptimizationContext()`                                             |
| Identify / reset             | `sdk.identify()` / `sdk.reset()` via `useOptimizationContext()`                            |
| Auto view/click/hover        | `trackEntryInteraction` on `OptimizationRoot` + `data-ctfl-*` attributes                   |
| Manual view tracking         | `useOptimization().tracking.enableElement()`                                               |
| Flag view tracking           | `sdk.states.flag('boolean').subscribe()`                                                   |
| Analytics event stream       | `sdk.states.eventStream.subscribe()`                                                       |
| Preview panel attachment     | Env-gated `attachOptimizationPreviewPanel()` call                                          |
| Offline queue / recovery     | Inherited from `@contentful/optimization-web` runtime                                      |

## CDA locale handling

This app defines one `APP_LOCALE`, passes it through the provider `locale` prop, and passes it
directly to Contentful CDA entry fetches. Do not use `contentful.js` `withAllLocales` or raw CDA
`locale=*` for entries passed to `OptimizedEntry` or `useEntryResolver()`; SDK entry resolution
expects direct single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

## Setup

From the **repository root**:

```sh
pnpm build:pkgs
pnpm implementation:run -- react-web-sdk implementation:install
test -f implementations/react-web-sdk/.env || cp implementations/react-web-sdk/.env.example implementations/react-web-sdk/.env
```

## Running locally

From the **repository root**:

1. Start the mock API server:

```sh
pnpm serve:mocks
```

2. In another terminal, start the development server:

```sh
pnpm implementation:run -- react-web-sdk dev
```

3. Build for production:

```sh
pnpm implementation:run -- react-web-sdk build
```

4. Run type checking:

```sh
pnpm implementation:run -- react-web-sdk typecheck
```

The equivalent implementation-directory commands are:

```sh
pnpm dev
pnpm build
pnpm typecheck
```

## Running E2E tests

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

## Environment variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

All variables have mock-safe defaults. To use local mock endpoints (the default), no changes are
needed. `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL="true"` attaches the browser preview panel for
local and staging development runs. See `.env.example` for the full list.

## Project structure

```
react-web-sdk/
├── src/
│   ├── main.tsx                        # OptimizationRoot, preview panel attachment, createBrowserRouter
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

## SDK integration patterns

### Provider setup

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
      trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
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

### Rendering optimized content

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

### Live updates

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

### Consent, identify, reset

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

### Manual interaction tracking

```tsx
import { useEntryResolver, useOptimization } from '@contentful/optimization-react-web'
import { useEffect, useRef } from 'react'

function ManuallyTrackedEntry({ entry }) {
  const sdk = useOptimization()
  const { resolveEntry } = useEntryResolver()
  const ref = useRef(null)
  const resolved = resolveEntry(entry)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    sdk.tracking.enableElement('views', el, { data: { entryId: resolved.sys.id } })
    return () => sdk.tracking.clearElement('views', el)
  }, [resolved.sys.id, sdk.tracking])

  return <div ref={ref}>{String(resolved.fields.text)}</div>
}
```

### Auto tracking attributes

For entries tracked via `trackEntryInteraction`, apply `data-ctfl-*` attributes directly on the
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

> [!NOTE]
>
> The `OptimizationRoot` `trackEntryInteraction` prop activates automatic view, click, and hover
> tracking for any DOM element that has `data-ctfl-entry-id`. The SDK's MutationObserver registers
> elements as they appear in the DOM after consent is given.

## Code orientation

| File or area                               | Purpose                                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `src/main.tsx`                             | Configures `OptimizationRoot` and `ReactRouterAutoPageTracker`    |
| `src/App.tsx`                              | Subscribes to provider state and renders route-level controls     |
| `src/sections/ContentEntry.tsx`            | Demonstrates `OptimizedEntry`, `useEntryResolver()`, and tracking |
| `src/sections/LiveUpdatesExampleEntry.tsx` | Demonstrates locked and live entry resolution                     |
| `src/components/RichTextRenderer.tsx`      | Demonstrates merge tag rendering with `useMergeTagResolver()`     |
| `src/components/AnalyticsEventDisplay.tsx` | Displays event stream output from `sdk.states.eventStream`        |
| Manual `selectedOptimizations` lock logic  | `<OptimizedEntry liveUpdates={false}>`                            |

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
