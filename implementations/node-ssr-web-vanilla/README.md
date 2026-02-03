<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Node SSR + Web Vanilla Reference Implementation</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

This is a reference implementation using both the
[Optimization Node SDK](/platforms/javascript/node/README.md) and
[Optimization Web SDK](/platforms/javascript/web/README.md), and is part of the
[Contentful Optimization SDK Suite](/README.md).

The goal of this reference implementation is to illustrate the usage of cookie-based communication
in both the Node and Web SDKs, which is an important component of many server-side/client-side
hybrid SSR and ESR solutions.

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

3. Configure the environment in a `.env` file in `implementations/node-ssr-web-vanilla` based on the
   `.env.example` included file. The file is pre-populated with values that are valid only against
   the mock server implementation. To test the implementation against a live server environment, see
   the [mocks package](/lib/mocks/README.md) for information on how to set up Contentful space with
   test data.
4. Start the mock API and application servers:

   ```sh
   pnpm --filter @implementations/node-ssr-web-vanilla serve
   ```

5. The application can be accessed via Web browser at `http://localhost:3000`

6. Stop the mock API and application servers:

   ```sh
   pnpm --filter @implementations/node-ssr-web-vanilla serve:stop
   ```

See `implementations/node-ssr-web-vanilla/package.json` for more commands.

## Running E2E Tests

E2E tests are run using Playwright.

1. Install Playwright dependencies:

   ```sh
   pnpm --filter @implementation/node-ssr-web-vanilla exec playwright install --with-deps
   ```

2. Run the E2E test suite:

   ```sh
   pnpm --filter @implementation/node-ssr-web-vanilla test:e2e
   ```

   The tests can alternatively be run using Playwright's GUI:

   ```sh
   pnpm --filter @implementation/node-ssr-web-vanilla test:e2e:ui
   ```
