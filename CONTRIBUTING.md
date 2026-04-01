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

This document explains how to set up the repository, how packages and reference implementations fit
together, which validation to run for common kinds of changes, and which local hooks and CI
behaviors to expect.

Many subtrees also contain local `AGENTS.md` files. They are written for agent tooling, but they
also serve as concise local runbooks for humans. When you begin working in a package,
implementation, or `lib/` workspace, read the nearest `AGENTS.md` for subtree-specific commands and
gotchas.

**Working on your first Pull Request?** You can learn how from this extensive
[list of resources for people who are new to contributing to Open Source](https://github.com/freeCodeCamp/how-to-contribute-to-open-source).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Setup](#setup)
- [Repository Map](#repository-map)
- [Common Commands](#common-commands)
- [Common Workflows](#common-workflows)
  - [Change a Workspace Package](#change-a-workspace-package)
  - [Change an Implementation](#change-an-implementation)
  - [Run E2E for One Implementation](#run-e2e-for-one-implementation)
  - [Implementation Helper Usage](#implementation-helper-usage)
- [Validation Matrix](#validation-matrix)
- [Code Style and Local Hooks](#code-style-and-local-hooks)
- [Documentation](#documentation)
- [Local Troubleshooting](#local-troubleshooting)
- [Troubleshooting CI Issues](#troubleshooting-ci-issues)
  - [E2E Coverage and Environment](#e2e-coverage-and-environment)
  - [License Check Failure](#license-check-failure)

<!-- mtoc-end -->
</details>

## Setup

The following software is required or strongly recommended for day-to-day development:

- [Node.js](https://nodejs.org/) (use [`.nvmrc`](./.nvmrc) when possible; the minimum supported
  version is `20.19.0`)
- [pnpm](https://pnpm.io/installation) (the pinned version is recorded in the root
  [`package.json`](./package.json))
- [`jq`](https://jqlang.org/) for the local `pre-push` hook
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or any Docker-compatible
  container manager when working on `implementations/web-sdk`
- An Android emulator when running React Native Detox flows in `implementations/react-native-sdk`

> [!NOTE]
>
> Browser and implementation-specific E2E flows also require Playwright browser binaries. The
> targeted `pnpm setup:e2e:<implementation>` wrappers install them for you.

After cloning the repository:

```sh
nvm use
pnpm install
pnpm version:node
pnpm version:pnpm
```

`pnpm install` also installs the local Husky hooks used during commit and push.

## Repository Map

| Path                 | Purpose                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `lib/`               | Internal shared tooling and mock services, such as `build-tools` and `mocks`        |
| `packages/`          | Workspace packages, including the published SDKs and framework layers               |
| `implementations/`   | Reference applications used for integration testing, local demos, and E2E coverage  |
| `pkgs/`              | Generated tarballs created by `pnpm build:pkgs`; implementations install from these |
| `docs/`              | Generated TypeDoc output                                                            |
| `dist/`, `coverage/` | Generated build and test artifacts inside individual workspaces                     |

The most important repository-specific mechanic is this:

- Package changes do not automatically flow into reference implementations.
- If an implementation consumes a package you changed, rebuild tarballs with `pnpm build:pkgs` and
  reinstall that implementation before trusting local results.
- The targeted `pnpm setup:e2e:<implementation>` wrappers do this refresh for you as part of E2E
  setup.

## Common Commands

The root [`package.json`](./package.json) contains more scripts than are listed below. These are the
ones most contributors need regularly.

| Command                                           | When to use it                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm lint`                                       | Lint `lib/` and `packages/` workspaces                                         |
| `pnpm implementation:lint`                        | Lint `implementations/`                                                        |
| `pnpm implementation:install`                     | Refresh all implementations after rebuilding package tarballs                  |
| `pnpm typecheck`                                  | Type-check all workspaces                                                      |
| `pnpm implementation:typecheck`                   | Type-check all implementations                                                 |
| `pnpm test:unit`                                  | Run unit tests across workspace packages                                       |
| `pnpm build`                                      | Build all `@contentful/*` packages                                             |
| `pnpm build:pkgs`                                 | Build packages and create implementation-consumable tarballs in `pkgs/`        |
| `pnpm size:check`                                 | Validate bundle-size budgets for all built packages                            |
| `pnpm size:report`                                | Report bundle sizes without failing on budgets                                 |
| `pnpm docs:generate`                              | Generate TypeDoc output                                                        |
| `pnpm format:check`                               | Check repository formatting                                                    |
| `pnpm setup:e2e:<implementation>`                 | Prepare one implementation for E2E, including package refresh and local setup  |
| `pnpm test:e2e:<implementation>`                  | Run one implementation's full E2E flow                                         |
| `pnpm implementation:run -- <implementation> ...` | Run a specific helper action or package-local script inside one implementation |
| `pnpm playwright:install`                         | Install Playwright browsers across implementations                             |
| `pnpm playwright:install-deps`                    | Install Playwright system dependencies on Linux                                |
| `pnpm serve:mocks`                                | Run the shared mock services used by local flows                               |

Most workspaces also define targeted local scripts such as `dev`, `build`, `test:unit`, and
`size:check`. Prefer targeted validation in the affected package or implementation instead of
running the whole repository when the change is narrow.

Before running `pnpm implementation:lint` across the repository, run `pnpm implementation:install`
so the reference implementations have current local package tarballs installed.

## Common Workflows

### Change a Workspace Package

1. Read the nearest package or `lib/` `AGENTS.md`.
2. Make your change in the package source, tests, docs, or local harness.
3. Run targeted validation in that workspace.
4. If the package is consumed by an implementation you want to verify, rebuild tarballs and
   reinstall the implementation before running local integration or E2E checks.

Example:

```sh
pnpm lint
pnpm --filter @contentful/optimization-web typecheck
pnpm --filter @contentful/optimization-web test:unit
pnpm --filter @contentful/optimization-web build
pnpm --filter @contentful/optimization-web size:check

pnpm build:pkgs
pnpm implementation:run -- web-sdk implementation:install
```

If your next step is E2E rather than a narrow manual reinstall, prefer the targeted wrapper:

```sh
pnpm setup:e2e:web-sdk
pnpm test:e2e:web-sdk
```

### Change an Implementation

1. Read the nearest implementation `AGENTS.md`.
2. If your change depends on freshly built local packages, run `pnpm build:pkgs` and reinstall the
   implementation first.
3. Run targeted implementation validation.
4. Run the implementation's E2E flow for user-visible or integration-heavy changes.

Example:

```sh
pnpm implementation:run -- web-sdk_react typecheck
pnpm implementation:run -- web-sdk_react build
pnpm implementation:run -- web-sdk_react implementation:test:e2e:run
```

### Run E2E for One Implementation

1. Create a local `.env` from the implementation's `.env.example` if the implementation expects one
   and you do not already have it.
2. Run the targeted setup wrapper.
3. Run the targeted E2E wrapper.

Example:

```sh
cp implementations/web-sdk/.env.example implementations/web-sdk/.env
pnpm setup:e2e:web-sdk
pnpm test:e2e:web-sdk
```

Environment notes:

- `web-sdk` requires Docker because the app is served via nginx.
- Browser implementations require Playwright browser binaries.
- `react-native-sdk` requires an Android emulator for Detox flows.
- Several implementations use PM2-managed processes for local serving; stop only the relevant
  implementation process rather than doing broad PM2 cleanup.

### Implementation Helper Usage

`implementation:run` is the shared helper used by the implementation scripts listed above.

Run a helper action for all implementations:

```sh
pnpm implementation:run -- --all -- <action> [args...]
```

Run a helper action for one implementation:

```sh
pnpm implementation:run -- <implementation> <action> [args...]
```

- `<implementation>` is a folder name under `implementations/` (for example: `web-sdk`,
  `web-sdk_react`, `node-sdk`, `node-sdk+web-sdk`, `react-native-sdk`)
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
pnpm implementation:run -- --all -- implementation:install

# Run the implementation-level E2E command for all implementations
pnpm implementation:run -- --all -- implementation:test:e2e:run

# Run one implementation's local script
pnpm implementation:run -- web-sdk test:e2e:ui

# Pass arguments through to the underlying E2E script
pnpm implementation:run -- node-sdk implementation:test:e2e:run -- --grep "homepage"
```

Prefer the root wrapper scripts when they already match what you want to do. For example:

- `pnpm implementation:install`
- `pnpm setup:e2e:<implementation>`
- `pnpm test:e2e:<implementation>`

## Validation Matrix

Use the smallest meaningful validation set for the change.

| Change type                                                 | Usually run                                                                                     | Notes                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Docs-only or markdown-only                                  | `pnpm format:check`                                                                             | Also run `pnpm docs:generate` if public API docs or linked markdown changed           |
| Package or `lib/` TypeScript change                         | Targeted `lint`, `typecheck`, `test:unit`, and `build`                                          | Prefer `pnpm --filter <workspace> ...` when the change is narrow                      |
| Built package runtime, export, dependency, or bundle change | Targeted `size:check` or root `pnpm size:check`                                                 | Bundle-size checks are currently a contributor-run validation, not a dedicated CI job |
| Package change used by an implementation                    | `pnpm build:pkgs`, then reinstall the affected implementation                                   | Use `pnpm setup:e2e:<implementation>` if E2E is your next step                        |
| Implementation code change                                  | `pnpm implementation:lint`, targeted implementation `typecheck`, and implementation-local tests | Some implementations have no meaningful unit tests; E2E matters more there            |
| Shared build or packaging change                            | Broaden validation to downstream packages and at least one affected implementation              | Examples: `lib/build-tools`, package exports, tarball/install flow                    |
| User-visible integration or runtime behavior change         | Targeted implementation E2E                                                                     | Choose the implementation that exercises the changed surface                          |

When in doubt, start targeted and broaden only if the change crosses package or implementation
boundaries.

## Code Style and Local Hooks

This project uses [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) to enforce
coding and formatting conventions. It may be useful to enable related editor plugins to have a
smoother experience when working on Optimization SDKs.

Please review the following files to familiarize yourself with current configurations:

- [eslint.config.ts](./eslint.config.ts)
- [.prettierrc](./.prettierrc)
- [.markdownlint.yaml](./.markdownlint.yaml)
- [.lintstagedrc.yaml](./.lintstagedrc.yaml)

Local Git hooks installed by Husky:

- `pre-commit` runs `lint-staged` on staged files.
- `prepare-commit-msg` opens a Commitizen prompt when you do not supply a commit message and you are
  not amending `HEAD`.
- `pre-push` runs targeted type checks and unit tests for changed workspaces and implementations.

Practical implications:

- If you change TypeScript in a workspace package, expect targeted typecheck and unit-test work to
  happen again on push.
- If you change an implementation, expect targeted implementation typecheck and implementation
  `test:unit` work to run on push.
- Fix hook failures rather than bypassing them unless you have an explicit reviewed reason to skip
  them.

## Documentation

Code is documented using TSDoc, and reference documentation is generated using TypeDoc and published
automatically with each new version.

- authored supporting docs belong in `documentation/`, while `docs/` remains generated output
- `pnpm docs:generate` generates documentation from TSDoc code comments, package README files, and
  markdown files under `documentation/`
- `pnpm docs:watch` watches for file updates and rebuilds documentation output; useful while writing
  and updating documentation

When changing public SDK behavior in this pre-release alpha period, update the same pull request to
keep these artifacts aligned:

- TSDoc/JSDoc comments near changed API surfaces
- package READMEs that document those surfaces
- package-local development harnesses or example flows when they are meant to demonstrate the
  changed behavior
- any replacement design, architecture, or specification artifacts that the repository adds for the
  changed area

`documentation/` contains source markdown that TypeDoc publishes. `docs/` is generated output. Do
not hand-edit generated TypeDoc output.

## Local Troubleshooting

- An implementation is not reflecting your latest package change: run `pnpm build:pkgs`, then
  reinstall the affected implementation with
  `pnpm implementation:run -- <implementation> implementation:install`.
- Playwright reports a missing browser: run `pnpm playwright:install`, or use the targeted
  `pnpm setup:e2e:<implementation>` wrapper.
- Playwright system dependencies are missing on Linux: run `pnpm playwright:install-deps`.
- `implementations/web-sdk` fails to serve locally: confirm Docker is running.
- React Native Detox cannot attach to a device: confirm an Android emulator is already running.
- An implementation behaves differently from expected local settings: compare its local `.env` with
  its checked-in `.env.example`.
- A local port such as `3000`, `8000`, or `8081` is already in use: stop only the relevant local
  process or implementation `serve` flow rather than using broad PM2 cleanup.

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

The path filters do not watch only implementation directories. Shared package and root changes can
also trigger implementation E2E. At a high level:

| E2E job                    | Also watches shared surfaces                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e_node_ssr_only`        | `lib/**`, `packages/node/node-sdk/**`, universal packages, root package/workflow files                                                                  |
| `e2e_node_ssr_web_vanilla` | `lib/**`, `packages/node/node-sdk/**`, `packages/web/web-sdk/**`, `packages/web/preview-panel/**`, shared root files                                    |
| `e2e_web`                  | `lib/**`, `packages/web/web-sdk/**`, `packages/web/preview-panel/**`, universal packages, shared root files                                             |
| `e2e_web_react`            | `lib/**`, `packages/web/web-sdk/**`, `packages/web/preview-panel/**`, universal packages, shared root files                                             |
| `e2e_react_web_sdk`        | `lib/**`, `packages/web/frameworks/react-web-sdk/**`, `packages/web/web-sdk/**`, `packages/web/preview-panel/**`, universal packages, shared root files |
| `e2e_react_native_android` | `lib/**`, `packages/react-native-sdk/**`, universal packages, shared root files                                                                         |

See [`.github/workflows/main-pipeline.yaml`](./.github/workflows/main-pipeline.yaml) for the exact
authoritative filter list.

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
