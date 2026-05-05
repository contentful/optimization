# Contentful Optimization SDK suite testing support library & server

> [!WARNING]
>
> This is an internal-only package that is not intended for publishing outside this monorepo

The testing support library offers the following features:

- Management of Contentful test space data
- Fetching of Contentful test entry data
- MSW handlers for the Experience API and Insights API
- Mock server based on the MSW handlers

> [!NOTE]
>
> In order to manage test data in a Contentful space, a `.contentfulrc.json` file must be
> appropriately configured in `lib/mocks` based upon the supplied `.contentfulrc.example.json` file.

## When to use this package

Use this package for local test data, unit-test MSW handlers, and the mock API server consumed by
reference implementations. It is an internal monorepo support package, not a public SDK dependency.

## Using mocks in unit tests

Ensure you have `msw` installed in your package:

```sh
pnpm add -D msw
```

Add the following code to your unit test setup script (commonly in `test/setup.ts`):

```ts
import { experienceApiHandlers, insightsApiHandlers } from 'mocks'
import { setupServer } from 'msw/node'

export const server = setupServer(
  ...experienceApiHandlers.getHandlers(),
  ...insightsApiHandlers.getHandlers(),
)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => {
  server.close()
})

// reset going both ways, for extra safety!
beforeEach(() => {
  server.resetHandlers()
})
afterEach(() => {
  server.resetHandlers()
})
```

With this setup, any calls to _supported_ Experience/Insights endpoints will be handled by the MSW
handlers. MSW must additionally ensure that any _unsupported_ endpoints are captured and logged with
warnings.

> [!WARNING]
>
> MSW will similarly block any non-related calls to other APIs or networked services, so it is
> highly encouraged to review [MSW's documentation](https://mswjs.io/docs/).

## Using mocks in local dev & E2E tests

Use this command to run a mock server instance:

```sh
pnpm serve:mocks
```

From inside package-focused workflows, the equivalent package command is
`pnpm --filter mocks serve`.

The server runs in a process attached to the current terminal. When a detached process is needed,
prefer implementation `serve` and `serve:stop` scripts because they use scoped PM2 process names.
For example, `pnpm implementation:run -- web-sdk serve` starts both the Web implementation and a
named mock-server process, and `pnpm implementation:run -- web-sdk serve:stop` stops only that
implementation's processes.

## Updating local mocks & fixtures

To fetch space configuration data (Content Types, etc.) and entries in a given space, use the
following command:

```sh
pnpm --filter mocks fetch:ctfl
```

Space data will be placed within `lib/mocks/src/contentful/data/space/ctfl-space-data.json`. Entries
will be placed in the `lib/mocks/src/contentful/data/entries` directory, with a file for each entry
named according to its entry ID.

> [!WARNING]
>
> Do not commit updated Contentful space data or entry files to the repository without first
> consulting the repository maintainers

## Setting up a new Contentful test space

Ensure your `.contentfulrc.json` file contains data for the new Contentful space. Then, run the
following command:

```sh
pnpm --filter mocks upload:ctfl:space
```

Automatic upload of entry data is not yet directly supported by this package.
