<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Web SDK Vanilla JS Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

This is a reference implementation for the
[Optimization Web SDK](../../packages/web/web-sdk/README.md) and is part of the
[Contentful Optimization SDK Suite](../../README.md).

## What this demonstrates

Use this implementation when you need the smallest browser example for the Web SDK without a
framework layer. It demonstrates a static HTML integration, Web Components entry rendering, local
mock API usage, Web SDK asset copying, and Playwright coverage for browser-side optimization,
tracking, live updates, consent gating, and offline recovery behavior.

## CDA locale handling

The static app uses `en-US` as its application locale for both the Web SDK top-level `locale` and
Contentful CDA `getEntry()` calls. Do not use `withAllLocales` or `locale=*`; SDK entry resolution
expects direct single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run all steps from the monorepo root.

1. Install pnpm packages:

   ```sh
   pnpm install
   ```

2. Build the local package tarballs consumed by implementations:

   ```sh
   pnpm build:pkgs
   ```

3. Install this implementation so its local `@contentful/*` dependencies resolve from `pkgs/`:

   ```sh
   pnpm implementation:run -- web-sdk implementation:install
   ```

4. Create the local `.env` file if it does not already exist:

   ```sh
   test -f implementations/web-sdk/.env || cp implementations/web-sdk/.env.example implementations/web-sdk/.env
   ```

   The `.env.example` values are valid only against the mock server implementation. To test the
   implementation against a live server environment, see the
   [mocks package](../../lib/mocks/README.md) for information on how to set up Contentful space with
   test data.

## Running locally

Run these commands from the monorepo root.

1. Start servers:

   ```sh
   pnpm implementation:run -- web-sdk serve
   ```

2. Stop servers:

   ```sh
   pnpm implementation:run -- web-sdk serve:stop
   ```

3. Run E2E:

   ```sh
   pnpm test:e2e:web-sdk
   ```

The application can be accessed via Web browser at `http://localhost:3000`. See
`implementations/web-sdk/package.json` for lower-level local commands. The local server is a
lightweight Node.js HTTP server that reads `.env` or `.env.example`, injects those values into the
HTML, and serves `public/`; PM2 manages the `serve` and `serve:stop` processes.

## Running E2E tests

E2E tests are run using Playwright.

1. Install implementation dependencies:

   ```sh
   pnpm setup:e2e:web-sdk
   ```

2. Install the shared Playwright browser binaries and system dependencies used by `lib/e2e-web`:

   ```sh
   pnpm --dir lib/e2e-web setup:e2e
   ```

3. Run the E2E test suite:

   ```sh
   pnpm test:e2e:web-sdk
   ```

   The tests can alternatively be run using Playwright's GUI:

   ```sh
   pnpm implementation:run -- web-sdk test:e2e:ui
   ```

## Related

- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
- [Web SDK React Adapter reference implementation](../web-sdk_react/README.md) - Adapter-based React
  reference implementation built on the Web SDK
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
