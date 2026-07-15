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
| Entry resolution + rendering | `OptimizedEntry` render prop                                                               |
| Live updates (global)        | `OptimizationRoot liveUpdates` prop                                                        |
| Live updates (per-component) | `OptimizedEntry liveUpdates` prop                                                          |
| Live updates (locked)        | `<OptimizedEntry liveUpdates={false}>`                                                     |
| Merge tag rendering          | `OptimizedEntry` render context `getMergeTagValue`                                         |
| Nested personalization       | Nested `<OptimizedEntry>` composition                                                      |
| Consent gating               | `sdk.consent()` via `useOptimizationContext()`                                             |
| Identify / reset             | `sdk.identify()` / `sdk.reset()` via `useOptimizationContext()`                            |
| Auto view/click/hover        | Default `OptimizationRoot` observers + `OptimizedEntry` tracking props                     |
| Manual view tracking         | `<OptimizedEntry trackViews={false}>` + `sdk.tracking.enableElement()`                     |
| Flag view tracking           | `sdk.states.flag('boolean').subscribe()`                                                   |
| Analytics event stream       | `sdk.states.eventStream.subscribe()`                                                       |
| Preview panel attachment     | Env-gated `attachOptimizationPreviewPanel()` call                                          |
| Offline queue / recovery     | Inherited from `@contentful/optimization-web` runtime                                      |

## CDA locale handling

This app defines one `APP_LOCALE`, passes it through the provider `locale` prop, and passes it
directly to Contentful CDA entry fetches. Do not use `contentful.js` `withAllLocales` or raw CDA
`locale=*` for entries passed to `OptimizedEntry`; SDK entry resolution expects direct single-locale
fields such as `fields.nt_experiences` and `fields.nt_variants`. See
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

```sh
pnpm install
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

1. Install the shared Playwright browsers/system dependencies, then run this implementation's E2E
   wrapper from the repository root:

```sh
pnpm --dir lib/e2e-web setup:e2e
pnpm test:e2e:react-web-sdk
```

2. Or run the shared Playwright flow step by step:

```sh
pnpm implementation:run -- react-web-sdk serve
```

In another terminal:

```sh
IMPLEMENTATION=react-web-sdk pnpm --dir lib/e2e-web test
```

When finished:

```sh
pnpm implementation:run -- react-web-sdk serve:stop
```

This implementation uses the shared Playwright suite from
[`lib/e2e-web`](../../lib/e2e-web/README.md). The implementation sets `IMPLEMENTATION=react-web-sdk`
when invoking that suite.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- react-web-sdk test:e2e:ui
pnpm implementation:run -- react-web-sdk test:e2e:codegen
```

## Environment variables

The setup step creates the local `.env` file if needed:

```sh
test -f implementations/react-web-sdk/.env || cp implementations/react-web-sdk/.env.example implementations/react-web-sdk/.env
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
│   │   ├── ControlPanel.tsx            # Consent, identify, reset, and conversion controls
│   │   └── RichTextRenderer.tsx        # Rich text + getMergeTagValue merge tags
│   ├── config/
│   │   └── locale.ts                   # Application Contentful locale
│   ├── contentful-generated.d.ts       # Generated Contentful entry skeleton types
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
├── index.html
├── .env.example
├── package.json
├── rsbuild.config.ts
├── tsconfig.json
├── AGENTS.md
└── README.md
```

## Integration touchpoints

This implementation uses the official React Web SDK package directly. Keep API-level usage details
in the
[@contentful/optimization-react-web package README](../../packages/web/frameworks/react-web-sdk/README.md).

Implementation-specific touchpoints:

- `src/main.tsx` mounts `OptimizationRoot`, `ReactRouterAutoPageTracker`, route configuration, and
  preview-panel attachment.
- `src/sections/ContentEntry.tsx` demonstrates automatic tracking props, manual view tracking, and
  passing `OptimizedEntry` render-context `getMergeTagValue` into rich text rendering.
- `src/sections/LiveUpdatesExampleEntry.tsx` compares default, locked, and always-live entry
  resolution.
- `src/components/RichTextRenderer.tsx` renders rich text merge tags with the `getMergeTagValue`
  prop from the `OptimizedEntry` render context.
- `src/components/ControlPanel.tsx` demonstrates consent, identify, reset, and conversion actions.

## Code orientation

| File or area                               | Purpose                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `src/main.tsx`                             | Configures `OptimizationRoot` and `ReactRouterAutoPageTracker` |
| `src/App.tsx`                              | Subscribes to provider state and renders route-level controls  |
| `src/sections/ContentEntry.tsx`            | Passes `OptimizedEntry` context into tracked rich text entries |
| `src/sections/LiveUpdatesExampleEntry.tsx` | Demonstrates locked and live entry resolution                  |
| `src/components/RichTextRenderer.tsx`      | Consumes `getMergeTagValue` for rich text merge tag rendering  |
| `src/components/AnalyticsEventDisplay.tsx` | Displays event stream output from `sdk.states.eventStream`     |
| Manual `selectedOptimizations` lock logic  | `<OptimizedEntry liveUpdates={false}>`                         |

**What stays the same in this reference path:** `contentfulClient.ts`, locale config, type
definitions, `RichTextRenderer`, E2E test files, page/section component structure.

**Key architectural difference:** `App.tsx` acts as a persistent layout (contains
`AnalyticsEventDisplay` that stays mounted across route changes). Pages are route children that
receive state via `useOutletContext`.

## Related

- [Web SDK React Adapter reference implementation](../web-sdk_react/README.md) - Adapter-based
  reference using `@contentful/optimization-web`
- [Web SDK Vanilla JS reference implementation](../web-sdk/README.md) - Vanilla JavaScript reference
  implementation
- [@contentful/optimization-react-web](../../packages/web/frameworks/react-web-sdk/README.md) -
  React Web SDK package
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
