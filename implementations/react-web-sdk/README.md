# React Web SDK Reference Implementation

Reference implementation demonstrating `@contentful/optimization-react-web` usage in a React SPA.

> This implementation is the React Web SDK counterpart to
> [`web-sdk_react`](../web-sdk_react/README.md). Where `web-sdk_react` builds its own React adapter
> layer over `@contentful/optimization-web`, this implementation uses
> `@contentful/optimization-react-web` directly -- the official React framework package -- as a
> customer would.

## What This Demonstrates

A developer integrating Contentful Optimization into a React app needs to:

1. Wrap the app in `<OptimizationRoot>` with their client config
2. Use `<OptimizedEntry>` to render personalized content
3. Drop in `<ReactRouterAutoPageTracker />` for SPA navigation events
4. Call `sdk.consent()`, `sdk.identify()`, and `sdk.reset()` from `useOptimization()`
5. Optionally attach the preview panel for live preview

This implementation covers every one of those patterns with no custom adapter code.

### Feature Coverage

| Feature                      | SDK Surface Used                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Provider + initialization    | `OptimizationRoot`                                                                         |
| Entry resolution + rendering | `OptimizedEntry` (render-prop), `useOptimizedEntry` (imperative)                           |
| Live updates (global)        | `OptimizationRoot liveUpdates` prop                                                        |
| Live updates (per-component) | `OptimizedEntry liveUpdates` prop                                                          |
| Live updates (locked)        | `OptimizedEntry` default lock-to-first behavior                                            |
| SPA page tracking            | `ReactRouterAutoPageTracker` from `@contentful/optimization-react-web/router/react-router` |
| Merge tag rendering          | `useOptimization().getMergeTagValue()`                                                     |
| Nested personalization       | Nested `<OptimizedEntry>` composition                                                      |
| Consent gating               | `useOptimization().consent()`                                                              |
| Identify / reset             | `useOptimization().identify()` / `sdk.reset()`                                             |
| Manual view tracking         | `useOptimization().interactionTracking.enableElement()`                                    |
| Click tracking (auto)        | `data-ctfl-clickable` attribute on auto-observed entries                                   |
| Hover tracking (auto)        | `data-ctfl-hover-duration-update-interval-ms` attribute                                    |
| Flag view tracking           | `sdk.states.flag()` subscription                                                           |
| Analytics event stream       | `sdk.states.eventStream` subscription                                                      |
| Preview panel                | `@contentful/optimization-web-preview-panel` lazy attach                                   |
| Offline queue / recovery     | Inherited from `@contentful/optimization-web` runtime                                      |

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

## Setup

From the **repository root**:

```bash
pnpm build:pkgs
pnpm run implementation:run -- react-web-sdk implementation:install
```

## Development

From the **repository root**:

```bash
pnpm run implementation:run -- react-web-sdk dev        # dev server
pnpm run implementation:run -- react-web-sdk build      # production build
pnpm run implementation:run -- react-web-sdk preview    # preview production build
pnpm run implementation:run -- react-web-sdk typecheck  # type check
```

Or from the **implementation directory** (`implementations/react-web-sdk`):

```bash
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
```

## Testing

### E2E Tests

```bash
# Full E2E setup + run from root
pnpm setup:e2e:react-web-sdk
pnpm test:e2e:react-web-sdk

# Or manually
pnpm run implementation:run -- react-web-sdk serve
pnpm run implementation:run -- react-web-sdk implementation:test:e2e:run
pnpm run implementation:run -- react-web-sdk serve:stop
```

## Environment Variables

Copy `.env.example` to `.env` and configure. The implementation reads from `import.meta.env` and
falls back to local mock-safe defaults.

```bash
cp .env.example .env
```

See `.env.example` for available configuration options. To use local mock endpoints, set
`PUBLIC_CONTENTFUL_CDA_HOST=localhost:8000` and `PUBLIC_CONTENTFUL_BASE_PATH=contentful`.

Preview panel attachment is gated behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`.

## Project Structure

```
react-web-sdk/
├── src/
│   ├── main.tsx                  # Entry point: OptimizationRoot + BrowserRouter
│   ├── App.tsx                   # Root component: routes, entry fetching, controls
│   ├── components/
│   │   ├── AnalyticsEventDisplay.tsx   # Event stream debug panel
│   │   └── RichTextRenderer.tsx        # Rich text + merge tag rendering
│   ├── config/
│   │   ├── entries.ts            # Entry ID constants
│   │   └── routes.ts             # Route path constants
│   ├── pages/
│   │   ├── HomePage.tsx          # Main page: entries, live updates, controls
│   │   └── PageTwoPage.tsx       # Second route: navigation + conversion demo
│   ├── sections/
│   │   ├── ContentEntry.tsx      # Auto/manual observed entry renderer
│   │   ├── LiveUpdatesExampleEntry.tsx  # Live updates parity demo
│   │   ├── NestedContentEntry.tsx       # Nested personalization wrapper
│   │   └── NestedContentItem.tsx        # Recursive nested entry renderer
│   ├── services/
│   │   └── contentfulClient.ts   # Contentful CDA client setup
│   └── types/
│       ├── contentful.ts         # Entry type definitions
│       └── env.d.ts              # Environment variable types
├── e2e/                          # Playwright E2E tests (parity with web-sdk_react)
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
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

function AppLayout() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      environment="main"
      api={{
        insightsBaseUrl: 'https://ingest.insights.ninetailed.co/',
        experienceBaseUrl: 'https://experience.ninetailed.co/',
      }}
      autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      liveUpdates={false}
    >
      <ReactRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'page-two', element: <PageTwoPage /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}
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

### Live Updates Control

```tsx
// Global: set on OptimizationRoot
<OptimizationRoot liveUpdates={globalLiveUpdates} ...>

// Per-component: always live
<OptimizedEntry baselineEntry={entry} liveUpdates={true}>
  {(resolved) => <Card entry={resolved} />}
</OptimizedEntry>

// Per-component: locked to first value
<OptimizedEntry baselineEntry={entry} liveUpdates={false}>
  {(resolved) => <Card entry={resolved} />}
</OptimizedEntry>
```

### Consent, Identify, Reset

```tsx
import { useOptimization } from '@contentful/optimization-react-web'

function Controls() {
  const { consent, identify, sdk } = useOptimization()

  return (
    <>
      <button onClick={() => consent(true)}>Accept</button>
      <button onClick={() => void identify({ userId: 'user-1', traits: { identified: true } })}>
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

function ManuallyTrackedEntry({ entry }) {
  const { interactionTracking } = useOptimization()
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    interactionTracking.enableElement('views', ref.current, {
      data: { entryId: entry.sys.id },
    })
    return () => interactionTracking.clearElement('views', ref.current)
  }, [entry.sys.id, interactionTracking])

  return <div ref={ref}>{entry.fields.text}</div>
}
```

## Migration From web-sdk_react

This table maps what `web-sdk_react` builds by hand to what `@contentful/optimization-react-web`
provides out of the box:

| `web-sdk_react` Local Code                            | `react-web-sdk` Equivalent                                  |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `src/optimization/createOptimization.ts`              | Config props on `OptimizationRoot`                          |
| `src/optimization/OptimizationProvider.tsx`           | `OptimizationProvider` / `OptimizationRoot`                 |
| `src/optimization/hooks/useOptimization.ts`           | `useOptimization()` / `useOptimizationContext()`            |
| `src/optimization/hooks/useOptimizationResolver.ts`   | `useOptimizedEntry()` / `useOptimization().resolveEntry()`  |
| `src/optimization/hooks/useOptimizationState.ts`      | Direct `sdk.states.*` subscriptions via `useOptimization()` |
| `src/optimization/hooks/useAnalytics.ts`              | `useOptimization().track()` / `sdk.trackView()`             |
| `src/optimization/liveUpdates/LiveUpdatesContext.tsx` | `LiveUpdatesProvider` + `useLiveUpdates()`                  |
| Manual `sdk.page()` in `useEffect`                    | `ReactRouterAutoPageTracker`                                |
| Manual `data-ctfl-*` attribute wiring                 | Automatic via `OptimizedEntry` wrapper                      |
| Manual `selectedOptimizations` lock logic             | Built into `useOptimizedEntry` / `OptimizedEntry`           |

**What stays the same:** `contentfulClient.ts`, entry config, route config, type definitions,
`AnalyticsEventDisplay`, `RichTextRenderer`, E2E tests, page/section component structure.

## Implementation Phases

### Phase 1: Scaffold + Provider + Routing

Set up the project shell and replace the hand-rolled provider/routing layer with SDK primitives.

**Files to create:**

- `package.json`, `tsconfig.json`, `rsbuild.config.ts`, `index.html`, `.env.example`, `.npmrc`
- `AGENTS.md`
- `src/main.tsx` -- `OptimizationRoot` + `createBrowserRouter` + `ReactRouterAutoPageTracker`
- `src/App.tsx` -- routes, nav, entry fetching (no manual `sdk.page()`)
- `src/config/entries.ts`, `src/config/routes.ts` -- copy from `web-sdk_react`
- `src/services/contentfulClient.ts` -- copy from `web-sdk_react`
- `src/types/contentful.ts`, `src/types/env.d.ts` -- copy from `web-sdk_react`

**Key changes from `web-sdk_react`:**

- No `src/optimization/` directory at all
- `main.tsx` uses `<OptimizationRoot clientId=... environment=... api=...>` instead of
  `<OptimizationProvider>` + manual singleton
- Routing uses `createBrowserRouter` + `RouterProvider` (required by `ReactRouterAutoPageTracker`)
  instead of `<BrowserRouter>` + `<Routes>`
- Page events handled automatically by `ReactRouterAutoPageTracker` -- remove the manual
  `sdk.page()` effect from `App.tsx`

**Validate:** `typecheck`, `build`, `dev` server starts.

### Phase 2: Entry Rendering With OptimizedEntry

Replace manual resolution + data-attribute wiring with `<OptimizedEntry>`.

**Files to create:**

- `src/sections/ContentEntry.tsx` -- uses `<OptimizedEntry>` for auto-observed entries, keeps manual
  tracking via `useOptimization().interactionTracking` for manual-observed entries
- `src/sections/NestedContentEntry.tsx` -- nested `<OptimizedEntry>` composition
- `src/sections/NestedContentItem.tsx` -- recursive nested entry renderer using `<OptimizedEntry>`
- `src/components/RichTextRenderer.tsx` -- copy from `web-sdk_react`, use
  `useOptimization().getMergeTagValue()` instead of `useOptimizationResolver()`

**Key changes from `web-sdk_react`:**

- Auto-observed entries: `<OptimizedEntry>` handles resolution, `data-ctfl-*` attributes, and
  loading state automatically -- no manual attribute computation
- Click scenarios: `data-ctfl-clickable` still applied manually on the relevant element/wrapper
  since it is not entry-level tracking data
- Manual-observed entries: still use `useOptimization()` to get the SDK and call
  `interactionTracking.enableElement()`/`clearElement()` since manual tracking is inherently
  imperative
- Nested entries: use nested `<OptimizedEntry>` components -- the SDK handles nesting guards and
  deduplication

**Validate:** `typecheck`, `build`, `dev` shows resolved entries.

### Phase 3: Live Updates + Preview Panel

Wire up global and per-component live updates using SDK primitives.

**Files to create:**

- `src/sections/LiveUpdatesExampleEntry.tsx` -- three parity examples using `<OptimizedEntry>` with
  `liveUpdates` prop variations (omitted / `true` / `false`)
- `src/pages/HomePage.tsx` -- utilities panel, live updates section, entry sections
- Preview panel attachment logic (lazy import of `@contentful/optimization-web-preview-panel`)

**Key changes from `web-sdk_react`:**

- The manual lock-to-first `selectedOptimizations` logic in `LiveUpdatesExampleEntry` is replaced by
  `<OptimizedEntry liveUpdates={false}>` (locks automatically) and
  `<OptimizedEntry liveUpdates={true}>` (always live)
- Global live updates controlled via `OptimizationRoot liveUpdates` prop -- no custom
  `LiveUpdatesContext` needed
- `useLiveUpdates()` from the SDK replaces the local `useLiveUpdates()` export
- Preview panel toggle: use `useLiveUpdates().previewPanelVisible` and
  `useLiveUpdates().setPreviewPanelVisible` for UI state

**Validate:** `typecheck`, `build`, dev server live updates toggle works.

### Phase 4: Analytics, Consent, Page Two

Complete remaining behavioral features.

**Files to create:**

- `src/components/AnalyticsEventDisplay.tsx` -- copy from `web-sdk_react`, use `useOptimization()`
  to access `sdk.states.eventStream`
- `src/pages/PageTwoPage.tsx` -- manual `trackView` calls via `useOptimization()`, entry rendering
- `src/contentful-generated.d.ts` -- copy from `web-sdk_react`

**Key changes from `web-sdk_react`:**

- `useAnalytics()` hook is removed; call `sdk.trackView()` directly via `useOptimization()`
- Flag subscription uses `sdk.states.flag('boolean')` directly via `useOptimization()`
- Consent/identify/reset use `useOptimization()` API directly

**Validate:** `typecheck`, `build`, full dev walkthrough of consent + identify + page navigation.

### Phase 5: E2E Tests + Root Script Wiring

Copy E2E suite, add root scripts, validate parity.

**Files to create/update:**

- `playwright.config.mjs` -- copy from `web-sdk_react`
- `e2e/*.spec.ts` -- copy all 9 test files from `web-sdk_react`
- Root `package.json` -- add `implementation:react-web-sdk`, `setup:e2e:react-web-sdk`,
  `test:e2e:react-web-sdk` scripts

**Key changes from `web-sdk_react`:**

- E2E tests should require zero changes if the DOM structure and `data-testid` attributes match
- If `<OptimizedEntry>` wrapper introduces an extra `<div style="display:contents">`, verify test
  selectors still work and adjust if needed
- Playwright config is identical (same port, same project matrix)

**Validate:** `pnpm setup:e2e:react-web-sdk && pnpm test:e2e:react-web-sdk` -- all 9 specs pass.

### Phase 6: Cleanup + Final Review

- Remove any temporary migration code or TODO comments
- Verify no `src/optimization/` directory exists (all SDK usage is direct imports)
- Verify `web-sdk_react` is unchanged and still passes its own E2E suite
- Verify implementation appears in `pnpm run implementation:run -- --all` listing
- Update root `CONTRIBUTING.md` or pipeline config if needed for CI coverage

## Related

- [Web React Implementation (web-sdk_react)](../web-sdk_react/) -- adapter-based reference using
  `@contentful/optimization-web` directly
- [Web Vanilla Implementation (web-sdk)](../web-sdk/) -- vanilla JavaScript reference
- [@contentful/optimization-react-web](../../packages/web/frameworks/react-web-sdk/README.md) --
  React Web SDK package
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) -- Web SDK package
