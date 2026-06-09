<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Angular Web SDK Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation of `@contentful/optimization-web` for Angular applications. Demonstrates
all SDK integration patterns — entry resolution, auto and manual tracking, consent, identify/reset,
live updates, nested entries, rich text with merge tags, feature flags, analytics event display, and
the preview panel.

## What this demonstrates

- SDK initialisation as a singleton Angular service
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

See [`REQUIREMENTS.md`](./REQUIREMENTS.md) for full feature specs and visual verification steps.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

## Quick start

From the **repository root**:

```sh
pnpm build:pkgs
pnpm implementation:run -- angular-web-sdk implementation:install
pnpm implementation:run -- angular-web-sdk serve:mocks
pnpm implementation:run -- angular-web-sdk dev
```

The app is available at `http://localhost:4200`. The mock server must be running for entry data and
variant resolution to work.

## Running locally

From the **repository root**:

```sh
pnpm implementation:run -- angular-web-sdk dev
pnpm implementation:run -- angular-web-sdk build
pnpm implementation:run -- angular-web-sdk typecheck
```

Or from the **implementation directory**:

```sh
pnpm dev
pnpm build
pnpm typecheck
```

## Environment variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

## Related

- [web-sdk_react](../web-sdk_react/README.md) — React Web SDK reference implementation
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) — Web SDK
