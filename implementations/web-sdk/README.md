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
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

This is a reference implementation for the
[Optimization Web SDK](../../packages/web/web-sdk/README.md) and is part of the
[Contentful Optimization SDK Suite](../../README.md).

## What This Demonstrates

Use this implementation when you need the smallest browser example for the Web SDK without a
framework layer. It demonstrates a static HTML integration, local mock API usage, Web SDK asset
copying, and Playwright coverage for browser-side optimization and tracking behavior.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x
- Docker running locally for nginx-based serving

## Setup

All steps should be run from the monorepo root.

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

4. Configure the environment in a `.env` file in `implementations/web-sdk` based on the
   `.env.example` included file. The file is pre-populated with values that are valid only against
   the mock server implementation. To test the implementation against a live server environment, see
   the [mocks package](../../lib/mocks/README.md) for information on how to set up Contentful space
   with test data.

## Running Locally

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
`implementations/web-sdk/package.json` for lower-level local commands.

## Running E2E Tests

E2E tests are run using Playwright.

1. Install implementation dependencies, browser binaries, and system dependencies:

   ```sh
   pnpm setup:e2e:web-sdk
   ```

2. Run the E2E test suite:

   ```sh
   pnpm test:e2e:web-sdk
   ```

   The tests can alternatively be run using Playwright's GUI:

   ```sh
   pnpm implementation:run -- web-sdk test:e2e:ui
   ```

## Related

- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
- [Web SDK React Adapter](../web-sdk_react/README.md) - Adapter-based React example built on the Web
  SDK
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
