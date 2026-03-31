<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Node SSR Only Reference Implementation</h3>

<div align="center">

[Readme](./README.md) · [Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

This is a reference implementation for the
[Optimization Node SDK](../../packages/node/node-sdk/README.md) and is part of the
[Contentful Optimization SDK Suite](../../README.md).

## Setup

All steps should be run from the monorepo root.

1. Install pnpm packages:

   ```sh
   pnpm install
   ```

2. Ensure the required packages can be built:

   ```sh
   pnpm --stream build
   ```

3. Configure the environment in a `.env` file in `implementations/node-sdk` based on the
   `.env.example` included file. The file is pre-populated with values that are valid only against
   the mock server implementation. To test the implementation against a live server environment, see
   the [mocks package](../../lib/mocks/README.md) for information on how to set up Contentful space
   with test data.
4. Start the mock API and application servers:

   ```sh
   pnpm --dir implementations/node-sdk --ignore-workspace serve
   ```

5. The application can be accessed via Web browser at `http://localhost:3000`

6. Stop the mock API and application servers:

   ```sh
   pnpm --dir implementations/node-sdk --ignore-workspace serve:stop
   ```

See `implementations/node-sdk/package.json` for more commands.

## Running From Root Scripts

You can run this implementation from the monorepo root via the root `package.json` implementation
scripts.

1. Start servers:

   ```sh
   pnpm run implementation:node-sdk -- serve
   ```

2. Stop servers:

   ```sh
   pnpm run implementation:node-sdk -- serve:stop
   ```

3. Run E2E:

   ```sh
   pnpm run implementation:node-sdk -- test:e2e
   ```

## Running E2E Tests

E2E tests are run using Playwright.

1. Install Playwright dependencies:

   ```sh
   pnpm --dir implementations/node-sdk --ignore-workspace exec playwright install --with-deps
   ```

2. Run the E2E test suite:

   ```sh
   pnpm --dir implementations/node-sdk --ignore-workspace test:e2e
   ```

   The tests can alternatively be run using Playwright's GUI:

   ```sh
   pnpm --dir implementations/node-sdk --ignore-workspace test:e2e:ui
   ```
