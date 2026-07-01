<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Web SDK + Angular Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation demonstrating `@contentful/optimization-web` usage in an Angular
application. It uses Angular services and standalone components directly with the Web SDK, without
an Angular-specific SDK adapter.

## What this demonstrates

- SDK initialization as a singleton Angular service
- Page tracking on every route change via the Angular router
- Entry resolution with variant/baseline display
- Auto-tracking via `data-ctfl-*` DOM attributes
- Manual tracking via `sdk.tracking.enableElement`
- Click scenarios: direct, descendant, ancestor
- Consent gating
- Identify and reset with session persistence
- Live updates: global toggle and per-entry override
- Preview panel forced-live mode
- Nested entries with recursive resolution
- Rich text rendering with inline merge tags
- Feature flag subscription with auto-emitted view events
- Analytics event display with heartbeat deduplication
- Multi-route navigation with conversion tracking

## CDA locale handling

This app configures one locale in `app.config.ts`, passes it as the Web SDK top-level `locale`, and
passes it directly to Contentful CDA `getEntry()` calls through `ContentfulClient`. Do not use
`contentful.js` `withAllLocales` or raw CDA `locale=*` for entries passed to SDK resolution; SDK
entry resolution expects direct single-locale fields such as `fields.nt_experiences` and
`fields.nt_variants`. See
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

From the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- web-sdk_angular implementation:install
test -f implementations/web-sdk_angular/.env || cp implementations/web-sdk_angular/.env.example implementations/web-sdk_angular/.env
```

The `.env.example` values are mock-safe defaults. To use local mock Contentful endpoints, keep
`PUBLIC_CONTENTFUL_CDA_HOST=localhost:8000` and `PUBLIC_CONTENTFUL_BASE_PATH=contentful`.

## Running locally

From the monorepo root:

1. Start the mock API server:

   ```sh
   pnpm implementation:run -- web-sdk_angular serve:mocks
   ```

2. In another terminal, start the Angular development server:

   ```sh
   pnpm implementation:run -- web-sdk_angular dev
   ```

The app is available at `http://localhost:4200`.

When finished, stop the PM2-managed mock server:

```sh
pnpm implementation:run -- web-sdk_angular serve:mocks:stop
```

Other local commands from the monorepo root:

```sh
pnpm implementation:run -- web-sdk_angular build
pnpm implementation:run -- web-sdk_angular typecheck
```

The equivalent implementation-directory commands are:

```sh
pnpm dev
pnpm build
pnpm typecheck
```

The `dev`, `build`, and `typecheck` scripts generate `src/environments/environment.ts` from `.env`
or `.env.example` before running Angular or TypeScript tooling.

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:web-sdk_angular
pnpm test:e2e:web-sdk_angular
```

This implementation uses the shared Playwright suite from
[`lib/e2e-web`](../../lib/e2e-web/README.md). The implementation sets
`IMPLEMENTATION=web-sdk_angular` and `APP_PORT=4200` when invoking the shared suite.

Use Playwright UI or the report viewer when needed:

```sh
pnpm implementation:run -- web-sdk_angular test:e2e:ui
pnpm implementation:run -- web-sdk_angular test:e2e:report
```

## Environment variables

The setup step creates the local `.env` file if needed:

```sh
test -f implementations/web-sdk_angular/.env || cp implementations/web-sdk_angular/.env.example implementations/web-sdk_angular/.env
```

The app generates `src/environments/environment.ts` from `.env` or `.env.example` before `dev`,
`build`, and `typecheck` run. Preview panel attachment is gated behind
`PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`; set it to `true` for development demos that need preview
panel behavior.

## Code orientation

| File or area                            | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `src/app/app.config.ts`                 | Angular providers and SDK configuration                      |
| `src/app/services/optimization.ts`      | Web SDK singleton, consent, state, and event-stream glue     |
| `src/app/services/contentful-client.ts` | Single-locale Contentful CDA reads                           |
| `src/app/components/entry-card/`        | Optimized entry display and automatic/manual tracking markup |
| `src/app/components/control-panel/`     | Consent, identify, reset, live updates, and preview controls |
| `src/app/components/tracking-log/`      | Analytics event stream display                               |
| `src/app/pages/`                        | Home and page-two route demonstrations                       |

## Related

- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
- [Web SDK Vanilla JS reference implementation](../web-sdk/README.md) - Static browser integration
  for the Web SDK
- [Web SDK React Adapter reference implementation](../web-sdk_react/README.md) - React adapter built
  directly on top of the Web SDK
- [Shared web E2E suite](../../lib/e2e-web/README.md) - Playwright suite shared by CSR web
  implementations
