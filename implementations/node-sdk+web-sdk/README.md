<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Node SDK SSR + Web SDK Vanilla JS Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

This is a reference implementation using both the
[Optimization Node SDK](../../packages/node/node-sdk/README.md) and
[Optimization Web SDK](../../packages/web/web-sdk/README.md), and is part of the
[Contentful Optimization SDK Suite](../../README.md).

On the server side, the stateless Node SDK is created once at module load and each request passes
its request-scoped options directly to stateless event methods.

The goal of this reference implementation is to illustrate the usage of cookie-based communication
in both the Node and Web SDKs, which is an important component of many server-side/client-side
hybrid SSR and ESR solutions.

> [!NOTE]
>
> This hybrid architecture allows more cache flexibility when personalization is deferred to browser
> code. If the server embeds personalized output or profile-derived values, treat that response as
> personalized and avoid shared caching unless you vary on all relevant inputs.

## What this demonstrates

Use this implementation when you need a hybrid SSR/browser example. It demonstrates a stateless Node
SDK server flow, a stateful Web SDK browser flow, cookie-based profile continuity between them, and
local mock API usage for end-to-end validation.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

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
   pnpm implementation:run -- node-sdk+web-sdk implementation:install
   ```

4. Configure the environment in a `.env` file in `implementations/node-sdk+web-sdk` based on the
   `.env.example` included file. The file is pre-populated with values that are valid only against
   the mock server implementation. To test the implementation against a live server environment, see
   the [mocks package](../../lib/mocks/README.md) for information on how to set up Contentful space
   with test data.

## Running locally

Run these commands from the monorepo root.

1. Start servers:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk serve
   ```

2. Stop servers:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk serve:stop
   ```

3. Run E2E:

   ```sh
   pnpm test:e2e:node-sdk+web-sdk
   ```

The application can be accessed via Web browser at `http://localhost:3000`. See
`implementations/node-sdk+web-sdk/package.json` for lower-level local commands.

## Running E2E tests

E2E tests are run using Playwright.

1. Install implementation dependencies, browser binaries, and system dependencies:

   ```sh
   pnpm setup:e2e:node-sdk+web-sdk
   ```

2. Run the E2E test suite:

   ```sh
   pnpm test:e2e:node-sdk+web-sdk
   ```

   The tests can alternatively be run using Playwright's GUI:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk test:e2e:ui
   ```

## Related

- [@contentful/optimization-node](../../packages/node/node-sdk/README.md) - Node SDK package
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
- [Node SSR Only](../node-sdk/README.md) - Server-only reference implementation
- [Web Vanilla](../web-sdk/README.md) - Browser-only reference implementation
