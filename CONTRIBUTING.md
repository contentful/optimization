<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="./contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Contributing</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](./CONTRIBUTING.md)

</div>

We appreciate any community contributions to this project, whether in the form of issues or pull
requests.

This document outlines what we'd like you to follow in terms of commit messages and code style.

It also explains what to do in case you want to set up the project locally and run tests.

**Working on your first Pull Request?** You can learn how from this extensive
[list of resources for people who are new to contributing to Open Source](https://github.com/freeCodeCamp/how-to-contribute-to-open-source).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Setup](#setup)
- [Package Scripts](#package-scripts)
  - [Implementation Helper Usage](#implementation-helper-usage)
- [Code Style](#code-style)
- [Documentation](#documentation)
- [Troubleshooting CI Issues](#troubleshooting-ci-issues)
  - [E2E Coverage and Environment](#e2e-coverage-and-environment)
  - [License Check Failure](#license-check-failure)

<!-- mtoc-end -->
</details>

## Setup

The following software is required for testing and maintaining Optimization SDK Suite packages:

- [Node.js](https://nodejs.org/) (minimum `20.19.0`; `24.13.0` recommended to match `.nvmrc`)
- [pnpm](https://pnpm.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or any Docker-compatible
  container manager

> [!NOTE]
>
> Docker is currently only used to run E2E tests, specifically for the Web Vanilla reference
> implementation

## Package Scripts

The following root `package.json` scripts may be run directly during day-to-day development. Scripts
not listed here are lifecycle hooks, CI-focused variants, packaging/compliance helpers, or internal
wrappers used by these commands.

| Command                                | Description                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm build:pkgs`                      | Builds packages, then creates tarballs for all `@contentful/*` packages in `pkgs/`. |
| `pnpm build`                           | Builds the logger and all `@contentful/*` packages.                                 |
| `pnpm clean`                           | Removes build artifacts across all workspaces.                                      |
| `pnpm docs:generate`                   | Generates TypeDoc output from code and linked markdown docs.                        |
| `pnpm docs:watch`                      | Watches files and rebuilds TypeDoc output during documentation work.                |
| `pnpm format:check`                    | Checks repository formatting with Prettier.                                         |
| `pnpm format:fix`                      | Applies Prettier formatting changes across the repository.                          |
| `pnpm implementation:install`          | Runs implementation-specific install steps across all reference apps.               |
| `pnpm implementation:node-sdk`         | Runs the implementation helper for the Node SSR Only reference app.                 |
| `pnpm implementation:node-sdk+web-sdk` | Runs the implementation helper for the Node SSR + Web Vanilla reference app.        |
| `pnpm implementation:react-native-sdk` | Runs the implementation helper for the React Native reference app.                  |
| `pnpm implementation:web-sdk_react`    | Runs the implementation helper for the Web React reference app.                     |
| `pnpm implementation:web-sdk`          | Runs the implementation helper for the Web Vanilla reference app.                   |
| `pnpm implementation:run`              | Runs the shared implementation script runner with custom arguments.                 |
| `pnpm implementation:lint`             | Runs ESLint checks across `implementations/`.                                       |
| `pnpm implementation:lint:fix`         | Runs ESLint with autofix across `implementations/`.                                 |
| `pnpm lint`                            | Runs ESLint checks for workspace packages (`lib`, `packages`).                      |
| `pnpm lint:fix`                        | Runs ESLint and automatically applies fixable issues.                               |
| `pnpm playwright:install-deps`         | Installs Playwright system dependencies across implementations.                     |
| `pnpm playwright:install`              | Installs Playwright browser binaries across implementations.                        |
| `pnpm pm2:delete:all`                  | Removes all PM2-managed local processes from PM2.                                   |
| `pnpm pm2:list`                        | Shows PM2-managed local processes used by reference implementations.                |
| `pnpm pm2:logs`                        | Streams logs for PM2-managed local processes.                                       |
| `pnpm pm2:stop:all`                    | Stops all PM2-managed local processes.                                              |
| `pnpm serve:mocks`                     | Starts the shared mock services used by local testing flows.                        |
| `pnpm setup:e2e`                       | Prepares all reference implementations and browser dependencies for E2E tests.      |
| `pnpm setup:e2e:web-sdk_react`         | Prepares the Web React implementation for E2E tests.                                |
| `pnpm test:e2e:node-sdk`               | Runs E2E tests for the Node SSR Only reference implementation.                      |
| `pnpm test:e2e:node-sdk+web-sdk`       | Runs E2E tests for the Node SSR + Web Vanilla reference implementation.             |
| `pnpm test:e2e:react-native-sdk`       | Runs E2E tests for the React Native reference implementation.                       |
| `pnpm test:e2e:web-sdk_react`          | Runs E2E tests for the Web React reference implementation.                          |
| `pnpm test:e2e:web-sdk`                | Runs E2E tests for the Web Vanilla reference implementation.                        |
| `pnpm test:e2e`                        | Runs end-to-end tests across all reference implementations.                         |
| `pnpm test:unit`                       | Runs unit tests for all `@contentful/*` packages.                                   |
| `pnpm typecheck`                       | Runs TypeScript type checks across all workspaces.                                  |
| `pnpm version:node`                    | Prints the local Node.js version.                                                   |
| `pnpm version:pnpm`                    | Prints the local pnpm version.                                                      |

> [!NOTE]
>
> Before running `pnpm implementation:lint` or `pnpm implementation:lint:fix`, run
> `pnpm implementation:install` to avoid linter warnings in reference implementation packages.

### Implementation Helper Usage

`implementation:run` is the shared helper used by the implementation scripts listed above.

Run a helper action for all implementations:

```sh
pnpm run implementation:run -- --all <action> [args...]
```

Run a helper action for one implementation:

```sh
pnpm run implementation:run -- <implementation> <action> [args...]
```

- `<implementation>` is a folder name under `implementations/` (for example: `web-sdk`, `node-sdk`,
  `node-sdk+web-sdk`, `react-native-sdk`)
- `<action>` can be one of these helper actions:
- `implementation:install`
- `implementation:build:run`
- `implementation:test:unit:run`
- `implementation:playwright:install`
- `implementation:playwright:install-deps`
- `implementation:setup:e2e`
- `implementation:test:e2e:run`
- `<action>` can also be any implementation-local script name (for example: `serve`, `serve:stop`,
  `test:e2e:ui`)
- `[args...]` are forwarded to the target script/action (when supported by that action/script)

Examples:

```sh
# Install dependencies for every implementation
pnpm run implementation:run -- --all implementation:install

# Run the implementation-level E2E command for all implementations
pnpm run implementation:run -- --all implementation:test:e2e:run

# Run one implementation's local script
pnpm run implementation:run -- web-sdk test:e2e:ui

# Pass arguments through to the underlying E2E script
pnpm run implementation:run -- node-sdk implementation:test:e2e:run -- --grep "homepage"
```

## Code Style

This project uses [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) to enforce
coding and formatting conventions. It may be useful to enable related editor plugins to have a
smoother experience when working on Optimization SDKs.

Please review the following files to familiarize yourself with current configurations:

- [eslint.config.ts](./eslint.config.ts)
- [.prettierrc](./.prettierrc)
- [.markdownlint.yaml](./.markdownlint.yaml)

## Documentation

Code is documented using TSDoc, and reference documentation is generated using TypeDoc and published
automatically with each new version.

- `pnpm docs:generate` generates documentation from TSDoc code comments, as well as README and other
  linked markdown files
- `pnpm docs:watch` watches for file updates and rebuilds documentation output; useful while writing
  and updating documentation

When changing public SDK behavior in this pre-release alpha period, update the same pull request to
keep these artifacts aligned:

- TSDoc/JSDoc comments near changed API surfaces
- package READMEs that document those surfaces
- SpecKit artifacts under `specs/**` and `.specify/research/**`

## Troubleshooting CI Issues

### E2E Coverage and Environment

`Main Pipeline` runs implementation E2E jobs when path filters request them for both:

- pull requests
- pushes to `main`

This is an intentional CI policy:

- E2E execution is path-filtered to reduce CI runtime and cost.
- CI E2E runs against local mock services via checked-in `.env.example` values to keep runs
  deterministic and stable.
- Production/live-server E2E is a manual verification step when needed; it is intentionally not part
  of default CI.

This mapping is deliberate and authoritative:

| E2E job                    | Path filter scope (plus shared SDK paths)                             |
| -------------------------- | --------------------------------------------------------------------- |
| `e2e_node_ssr_only`        | `implementations/node-sdk/**`                                         |
| `e2e_node_ssr_web_vanilla` | `implementations/node-sdk+web-sdk/**`                                 |
| `e2e_web`                  | `implementations/web-sdk/**`                                          |
| `e2e_web_react`            | `implementations/web-sdk_react/**`                                    |
| `e2e_react_native_android` | `implementations/react-native-sdk/**`, `packages/react-native-sdk/**` |

Skipping an implementation E2E job because its filter did not match is expected behavior, not a CI
coverage defect.

If a change should trigger an implementation E2E job but does not match the current filters, update
the path filters in `.github/workflows/main-pipeline.yaml` in the same pull request.

E2E setup does not depend on repository secrets. Each implementation creates `.env` from its own
checked-in `.env.example` file in CI, which keeps fork PR behavior aligned with internal PRs.

### License Check Failure

Run `license-checker` locally:

```sh
pnpx license-checker --summary
pnpx license-checker > licenses.txt
```

If the license for a package merely has a spelling or formatting difference from an existing entry
in the `license-check` GitHub workflow allow list, update the list and submit the change via pull
request. Otherwise, create an issue to receive further guidance from the maintainers.
