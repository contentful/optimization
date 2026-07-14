<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="./contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Contributing</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](./CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

We appreciate community contributions in the form of issues and pull requests.

Use this guide when you change SDK packages, reference implementations, documentation, release
configuration, or repository tooling. It covers setup, the normal development flow, validation, pull
request expectations, and common troubleshooting.

Many subtrees include a local `AGENTS.md`. These files are written for agent tooling, but they also
serve as concise local runbooks for humans. Read the nearest `AGENTS.md` before working in a
package, implementation, or `lib/` workspace.

**Working on your first pull request?** See this
[list of resources for people who are new to contributing to open source](https://github.com/freeCodeCamp/how-to-contribute-to-open-source).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Setup](#setup)
- [Repository map](#repository-map)
- [Development flow](#development-flow)
  - [Package changes](#package-changes)
  - [Implementation changes](#implementation-changes)
  - [E2E changes](#e2e-changes)
- [Commands](#commands)
  - [Implementation helper](#implementation-helper)
- [Validation](#validation)
- [Pull requests and releases](#pull-requests-and-releases)
  - [Commit scopes](#commit-scopes)
  - [Release impact](#release-impact)
  - [Contributor checklist](#contributor-checklist)
  - [Maintainer checklist](#maintainer-checklist)
- [Documentation](#documentation)
  - [Guides and the knowledge base (authoring pipeline)](#guides-and-the-knowledge-base-authoring-pipeline)
  - [README depth and render targets](#readme-depth-and-render-targets)
- [Local troubleshooting](#local-troubleshooting)
- [CI troubleshooting](#ci-troubleshooting)
  - [E2E jobs](#e2e-jobs)
  - [License checks](#license-checks)

<!-- mtoc-end -->
</details>

## Before you start

- Use `pnpm` for repository commands.
- Use the Node.js version from [`.nvmrc`](./.nvmrc). The pnpm workspace engine setting mirrors
  `.nvmrc`.
- Use the pnpm version pinned in the root [`package.json`](./package.json).
- Change source-of-truth files, not generated output. Authored docs live in `documentation/`;
  generated TypeDoc output lives in `docs/`.
- Treat reference implementations as maintained product artifacts, not disposable examples.
- Do not hand-edit `dist/`, `coverage/`, `docs/`, `pkgs/`, `.rslib/`, `.rsdoctor/`, `node_modules/`,
  or local `.env` files unless the task explicitly targets them.

## Setup

Install the day-to-day prerequisites:

- [Node.js](https://nodejs.org/) through `nvm` or another tool that respects `.nvmrc`.
- [pnpm](https://pnpm.io/installation), using the version pinned in `package.json`.
- [`jq`](https://jqlang.org/) for the local `pre-push` hook.
- Playwright browser binaries for browser-based E2E. The targeted `setup:e2e` wrappers install them
  for browser implementations.
- Native toolchains only when working on those surfaces: Android Studio or an Android emulator for
  Android and React Native flows, and Xcode, XcodeGen, and an iOS simulator for iOS flows.

After cloning the repository, run:

```sh
nvm use
pnpm install
pnpm version:node
pnpm version:pnpm
```

`pnpm install` also installs the local Husky hooks used during commit and push.

## Repository map

| Path                 | Purpose                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `lib/`               | Internal shared tooling and mock services, such as `build-tools` and `mocks`        |
| `packages/`          | Workspace packages, including published SDKs and framework layers                   |
| `packages/android/`  | Pre-release Android library                                                         |
| `packages/ios/`      | Pre-release Swift package                                                           |
| `implementations/`   | Reference apps used for integration testing, validation evidence, and E2E coverage  |
| `documentation/`     | Authored guides and concepts published with TypeDoc                                 |
| `docs/`              | Generated TypeDoc output                                                            |
| `pkgs/`              | Generated tarballs created by `pnpm build:pkgs`; implementations install from these |
| `dist/`, `coverage/` | Generated build and test artifacts inside individual workspaces                     |
| `.github/workflows/` | CI, release, publish, and title-check workflows                                     |

The main repository-specific mechanic is package refresh:

- Package changes do not automatically flow into reference implementations.
- To test an implementation after changing a package, run `pnpm build:pkgs`, then reinstall the
  affected implementation.
- The targeted `pnpm setup:e2e:<implementation>` wrappers perform that refresh for E2E flows that
  consume local tarballs.

## Development flow

1. Read the root `AGENTS.md`, then the nearest child `AGENTS.md` for the files you plan to edit.
2. Make the narrow source-of-truth change in the package, implementation, docs, or tooling layer
   that owns the behavior.
3. Run the smallest meaningful validation for the changed surface.
4. If a package change is consumed by an implementation, rebuild tarballs and reinstall that
   implementation before trusting local integration or E2E results.
5. Include the validation commands and any release impact in the pull request description.

### Package changes

Run root lint plus targeted package checks when the change is narrow:

```sh
pnpm lint
pnpm --filter @contentful/optimization-web typecheck
pnpm --filter @contentful/optimization-web test:unit
pnpm --filter @contentful/optimization-web build
pnpm --filter @contentful/optimization-web size:check
```

If an implementation consumes the changed package, refresh it before testing:

```sh
pnpm build:pkgs
pnpm implementation:run -- web-sdk implementation:install
```

When E2E is the next step, use the targeted wrapper:

```sh
pnpm setup:e2e:web-sdk
pnpm test:e2e:web-sdk
```

Broaden validation for public exports, shared runtime behavior, generated artifacts, mocks,
packaging, or behavior used by multiple SDKs.

### Implementation changes

Run the implementation checks that match the changed app:

```sh
pnpm implementation:lint
pnpm implementation:run -- web-sdk_react typecheck
pnpm implementation:run -- web-sdk_react build
pnpm implementation:run -- web-sdk_react implementation:test:e2e:run
```

If the implementation depends on freshly built local packages, run `pnpm build:pkgs` and reinstall
the implementation first.

### E2E changes

Use root wrappers when they exist:

```sh
pnpm setup:e2e:<implementation>
pnpm test:e2e:<implementation>
```

The root wrappers cover `node-sdk`, `node-sdk+web-sdk`, `web-sdk`, `web-sdk_react`,
`web-sdk_angular`, `react-web-sdk`, `nextjs-sdk_app-router`, `nextjs-sdk_pages-router`,
`react-native-sdk`, and `ios-sdk`.

Native Android uses implementation-local runners from the root:

```sh
pnpm implementation:run -- android-sdk test:e2e:compose
pnpm implementation:run -- android-sdk test:e2e:views
pnpm implementation:run -- android-sdk test:e2e
```

The Android, iOS, and React Native runners start or verify the required local services, devices, or
simulators where practical. Report the runner's concrete preflight failure if setup does not
complete.

## Commands

The root [`package.json`](./package.json) contains the full script list. These commands cover most
contributor workflows:

| Command                                           | When to use it                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm lint`                                       | Lint `lib/` and `packages/` workspaces                                  |
| `pnpm implementation:lint`                        | Lint `implementations/`                                                 |
| `pnpm typecheck`                                  | Type-check `lib/` and `packages/` workspaces                            |
| `pnpm implementation:typecheck`                   | Type-check all implementations                                          |
| `pnpm test:unit`                                  | Run unit tests across `lib/` and `packages/`                            |
| `pnpm build`                                      | Build all `@contentful/*` packages                                      |
| `pnpm build:pkgs`                                 | Build packages and create implementation-consumable tarballs in `pkgs/` |
| `pnpm implementation:install`                     | Rebuild tarballs and refresh every implementation                       |
| `pnpm size:check`                                 | Validate bundle-size budgets for all built packages                     |
| `pnpm size:report`                                | Report bundle sizes without failing on budgets                          |
| `pnpm docs:generate`                              | Generate TypeDoc output                                                 |
| `pnpm format:check`                               | Check repository formatting                                             |
| `pnpm setup:e2e:<implementation>`                 | Prepare one implementation for E2E                                      |
| `pnpm test:e2e:<implementation>`                  | Run one implementation's full E2E flow                                  |
| `pnpm implementation:run -- <implementation> ...` | Run a helper action or local script inside one implementation           |
| `pnpm ios:test`                                   | Build the JS bridge and run Swift package tests                         |
| `pnpm playwright:install`                         | Install Playwright browsers across implementations                      |
| `pnpm playwright:install-deps`                    | Install Playwright system dependencies on Linux                         |
| `pnpm serve:mocks`                                | Run the shared mock services used by local flows                        |

Prefer targeted workspace commands when the change is narrow. Use aggregate commands when shared
behavior, exports, packaging, mocks, or generated artifacts cross workspace boundaries.

### Implementation helper

`implementation:run` runs helper actions or implementation-local scripts from the repository root:

```sh
pnpm implementation:run -- --all -- <action> [args...]
pnpm implementation:run -- <implementation> <action> [args...]
```

`<implementation>` is a folder under `implementations/`, such as `web-sdk`, `web-sdk_react`,
`react-web-sdk`, `node-sdk`, `node-sdk+web-sdk`, `nextjs-sdk_app-router`, `nextjs-sdk_pages-router`,
`react-native-sdk`, `android-sdk`, or `ios-sdk`.

Common helper actions include:

- `implementation:install`
- `implementation:build:run`
- `implementation:test:unit:run`
- `implementation:playwright:install`
- `implementation:playwright:install-deps`
- `implementation:setup:e2e`
- `implementation:test:e2e:run`

You can also pass an implementation-local script name, such as `serve`, `build`, `typecheck`,
`test:e2e:ui`, `test:e2e:compose`, or `test:e2e:ios:build:release`.

Examples:

```sh
pnpm implementation:run -- --all -- implementation:install
pnpm implementation:run -- web-sdk test:e2e:ui
pnpm implementation:run -- android-sdk test:e2e:compose -- --flow preview-panel
pnpm implementation:run -- node-sdk implementation:test:e2e:run -- --grep "homepage"
```

## Validation

Use the smallest meaningful validation set for the change:

| Change type                                                 | Usually run                                                                                     | Notes                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Docs-only or Markdown-only                                  | `pnpm format:check`                                                                             | Also run `pnpm docs:generate` if public API docs or linked Markdown changed |
| Package or `lib/` TypeScript change                         | Root `pnpm lint`, targeted `typecheck`, `test:unit`, and `build`                                | Prefer `pnpm --filter <workspace> ...` when the change is narrow            |
| Built package runtime, export, dependency, or bundle change | Targeted `size:check` or root `pnpm size:check`                                                 | Bundle-size checks validate evidence; budget changes need maintainer review |
| Package change used by an implementation                    | `pnpm build:pkgs`, then reinstall the affected implementation                                   | Use `pnpm setup:e2e:<implementation>` when E2E is the next step             |
| Implementation code change                                  | `pnpm implementation:lint`, targeted implementation `typecheck`, and implementation-local tests | Some implementations rely more on E2E than unit tests                       |
| Native Android change                                       | Build both apps and run targeted Maestro                                                        | Use `test:e2e:compose`, `test:e2e:views`, or both when parity matters       |
| Native iOS change                                           | Targeted XCUITest or `pnpm test:e2e:ios-sdk`                                                    | Use `IOS_ONLY_TESTING` for focused release-run suites                       |
| Shared build or packaging change                            | Broaden validation to downstream packages and at least one affected implementation              | Examples: `lib/build-tools`, package exports, tarball/install flow          |
| User-visible integration or runtime behavior change         | Targeted implementation E2E                                                                     | Choose the implementation that exercises the changed surface                |

When an upstream package build fails, stop downstream validation. Stale downstream artifacts are not
evidence.

## Pull requests and releases

This repository squash-merges pull requests. The pull request title becomes the commit header on
`main`, so the title must be a scoped Conventional Commit header. Release Please reads commits on
`main`, opens one shared release PR, and creates package-specific tags and GitHub releases after
that release PR merges.

Release tags use package components:

| Artifact family | Release tag example                  | Publish target                                               |
| --------------- | ------------------------------------ | ------------------------------------------------------------ |
| NPM packages    | `optimization-web-v1.3.1`            | GitHub Packages                                              |
| Android         | `optimization-android-v1.1.0-beta.0` | Maven Central                                                |
| Swift           | `optimization-swift-v1.1.0-beta.0`   | `contentful/optimization.swift` with SPM tag `v1.1.0-beta.0` |

### Commit scopes

Commitlint requires one of these scopes:

```text
android, api-client, api-schemas, bridge, build-tools, ci, core, deps,
docs, implementations, nextjs, node, publish, react-native, react-web,
repo, swift, test, web, web-preview-panel
```

Use the package or runtime scope for user-facing behavior. Use shared scopes such as `repo`, `ci`,
`docs`, `test`, `deps`, `build-tools`, `implementations`, or `publish` for maintenance-only work.

### Release impact

| Change intent                            | Pull request title pattern                      | Release effect                                          |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Bug fix or runtime correction            | `fix(core): handle empty profile state`         | Patch release for affected package paths                |
| Performance fix                          | `perf(web): reduce client bundle work`          | Patch release for affected package paths                |
| Feature                                  | `feat(web): support managed CDA client`         | Minor release for affected package paths                |
| Breaking change                          | `feat(web)!: remove legacy optimized entry API` | Major release for affected package paths                |
| Docs, tests, CI, or internal maintenance | `docs(nextjs): clarify app router setup`        | No package release unless paired with a breaking marker |

For breaking changes, include a footer in the pull request description and squash commit body:

```text
BREAKING CHANGE: OptimizedEntry no longer accepts the legacy field shape.
```

Dependency updates follow the same rule as other changes. Use `fix(scope): ...` when a dependency
change affects published runtime behavior. Use `chore(deps): ...` for maintenance-only dependency
work.

Release Please assigns releases by changed package paths and workspace dependency updates. Android
and Swift are configured as beta prerelease packages. The native bridge impact plugin also
synthesizes Android and Swift patch releases from releasable shared runtime commits that touch
`packages/universal/api-schemas`, `packages/universal/api-client`, `packages/universal/core-sdk`, or
`packages/universal/optimization-js-bridge`. When a change affects multiple packages, use the scope
that best describes the user-facing change and list the affected packages in the pull request
description.

### Contributor checklist

1. Keep the pull request focused on one coherent release intent.
2. Use `pnpm commit`, plain `git commit`, or a manual Conventional Commit message.
3. Set the pull request title to the Conventional Commit header that must land on `main`.
4. Run the validation listed in this document plus any local validation from the nearest
   `AGENTS.md`.
5. Include validation commands and release impact in the pull request description.
6. Update the title before merge if review changes the release impact.

Ask a maintainer before changing release policy, release budgets, publish workflows, or exact first
semantic versions. For an exact first semantic version, the maintainer must use a temporary
per-package `release-as` override before the release PR is created.

### Maintainer checklist

1. Review the change, validation evidence, and nearest `AGENTS.md` requirements.
2. Check that the pull request title is the Conventional Commit header that must land on `main`.
3. For breaking changes, keep the `BREAKING CHANGE:` footer in the squash commit body.
4. Squash-merge after required checks pass.
5. Let the `Release Please` workflow run on `main`.
6. Review the shared release PR named `chore(repo): release packages`.
7. Confirm the release PR updates the expected package versions, changelogs, internal workspace
   dependency ranges, Android `VERSION`, and Swift `VERSION` files.
8. Merge the release PR when the release contents are correct.
9. Monitor package-specific GitHub releases and publish workflows:
   - NPM publish uses GitHub Packages only and skips package versions that already exist.
   - Android publish runs only for `optimization-android-v*` tags.
   - Swift publish runs only for `optimization-swift-v*` tags and pushes `v<version>` to
     `contentful/optimization.swift`.

Run `pnpm release:self-check` before changing Release Please config, native release synthesis, or
NPM target resolution.

## Documentation

Follow [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for human-authored prose.

Code reference documentation is generated with TypeDoc:

- Authored supporting docs belong in `documentation/`.
- Generated TypeDoc output belongs in `docs/`; do not hand-edit it.
- `pnpm docs:generate` generates documentation from TSDoc comments, package README files, and
  Markdown files under `documentation/`.
- `pnpm docs:watch` watches for file updates and rebuilds generated docs while writing.

### Guides and the knowledge base (authoring pipeline)

The guides under `documentation/guides/` are not hand-maintained in isolation — they are composed by
an agent-driven pipeline with three source-of-truth layers, so a source change propagates instead of
being re-derived by hand:

1. **Knowledge base** (`documentation/internal/sdk-knowledge/`, internal, not published) — verified
   SDK _behavioral_ facts, each carrying a machine-checked `source:` pointer into `packages/**/src`.
   Interface (signatures, prop shapes) is read directly from the types, not stored here.
2. **Recipes and fragments** (`documentation/authoring/`, writer-owned, not published) — the editorial
   structure: one recipe per guide archetype and the reusable prose fragments they compose. This is
   where a technical writer shapes wording, tone, and sequence.
3. **Guides** (`documentation/guides/`, published) — reader-facing prose, composed from the KB facts
   and the recipes.

Four slash commands drive it; pick by what changed:

| Command          | Use when                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `/author-guide`  | a new SDK with no knowledge-base file yet (bootstrap; reads source once)                           |
| `/refresh-docs`  | SDK source changed — re-verify only affected facts, recompose affected guides                      |
| `/iterate-guide` | editorial-only change (phrasing, tone, sequence, a recipe/fragment) — no source read, no fact work |
| `/review-guide`  | the final pass before shipping — newcomer + technical-foundation review, then gate                 |

`pnpm knowledge:check` validates the knowledge base (every `source:` pointer resolves, templates
conform, `feeds-guides` links are valid) and runs in CI on knowledge-base and `packages/**/src`
changes. For how the system works, start at
[`documentation/authoring/README.md`](./documentation/authoring/README.md) (recipes and fragments)
and [`documentation/internal/sdk-knowledge/README.md`](./documentation/internal/sdk-knowledge/README.md)
(the knowledge base and its pointer grammar).

### README depth and render targets

When public SDK behavior changes, keep the related documentation aligned in the same pull request:

- TSDoc or JSDoc comments near changed API surfaces.
- Package READMEs that document those surfaces.
- Package-local harnesses or reference implementation flows that demonstrate the behavior.
- Guides, concepts, architecture notes, or specifications that explain the changed area.

READMEs are orientation surfaces. Keep package READMEs focused on purpose, installation, minimal
setup, common options, critical caveats, and links to guides, reference implementations, and
generated API reference. Keep reference implementation READMEs procedural.

Package README links must work in GitHub source browsing, generated TypeDoc project documents, and
npm README rendering. Use canonical generated-doc URLs for shared header navigation and verify
repo-relative links before relying on package README publish rewriting.

## Local troubleshooting

| Symptom                                                  | What to do                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| An implementation does not reflect a package change      | Run `pnpm build:pkgs`, then `pnpm implementation:run -- <implementation> implementation:install`.                                              |
| Playwright reports a missing browser                     | Run `pnpm playwright:install`, or use the targeted `pnpm setup:e2e:<implementation>` wrapper.                                                  |
| Playwright system dependencies are missing on Linux      | Run `pnpm playwright:install-deps`.                                                                                                            |
| `implementations/web-sdk` fails to serve locally         | Check `implementations/web-sdk/.env` against `.env.example` and confirm port `3000` is free.                                                   |
| React Native Detox cannot attach to a device             | Run the documented Detox runner; it can launch the configured emulator. Report the runner's actual failure if setup does not complete.         |
| Android Maestro has no visible device before startup     | Run the documented Android runner; it resolves or launches the pinned emulator when possible.                                                  |
| iOS XCUITest cannot find a simulator                     | Run the local iOS runner or root wrapper and report the concrete Xcode, simulator, XcodeGen, or signing preflight error.                       |
| An implementation uses unexpected local settings         | Compare its local `.env` with its checked-in `.env.example`.                                                                                   |
| A port such as `3000`, `8000`, or `8081` is already used | Stop only the relevant local process or implementation `serve` flow instead of using broad PM2 cleanup.                                        |
| Commitlint rejects a commit or pull request title        | Add a supported scope. Example: use `fix(core): handle empty profile state`, not `fix: handle empty profile state`.                            |
| The pull request has the wrong release impact            | Update the title before merge. For breaking changes, add `!` after the scope and include a `BREAKING CHANGE:` footer in the pull request body. |

## CI troubleshooting

`Main Pipeline` runs implementation E2E jobs when path filters request them for pull requests and
pushes to `main`.

This is intentional CI policy:

- E2E execution is path-filtered to reduce CI runtime and cost.
- CI E2E uses local mock services and checked-in `.env.example` values.
- Production or live-server E2E is manual verification when needed.
- E2E setup does not depend on repository secrets, so fork pull requests follow the same checked-in
  setup path.

### E2E jobs

The path filters also watch shared package and root files that can affect the implementation:

| Workflow filter               | Job family                              | Also watches shared surfaces                                 |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `e2e_node_sdk`                | `e2e-node-sdk`                          | `lib/**`, `packages/node/**`, `packages/universal/**`        |
| `e2e_node_sdk_web_sdk`        | `e2e-node-sdk-web-sdk`                  | Node, Web, Universal, and shared root files                  |
| `e2e_web_sdk`                 | `e2e-web-sdk`                           | `lib/**`, `packages/web/**`, `packages/universal/**`         |
| `e2e_web_sdk_react`           | `e2e-web-sdk_react`                     | `lib/**`, `packages/web/**`, `packages/universal/**`         |
| `e2e_web_sdk_angular`         | `e2e-web-sdk_angular`                   | `lib/**`, Node, Web, Universal, and shared root files        |
| `e2e_react_web_sdk`           | `e2e-react-web-sdk`                     | `lib/**`, `packages/web/**`, `packages/universal/**`         |
| `e2e_nextjs_sdk_app_router`   | `e2e-nextjs-sdk-app-router`             | Node, Web, Universal, and shared root files                  |
| `e2e_nextjs_sdk_pages_router` | `e2e-nextjs-sdk-pages-router`           | Node, Web, Universal, and shared root files                  |
| `e2e_react_native_android`    | React Native Android build and E2E jobs | `packages/react-native-sdk/**`, Universal, and shared files  |
| `e2e_android`                 | Android SDK build and Maestro jobs      | `lib/mocks/**`, `packages/android/**`, Universal, root files |
| `e2e_ios`                     | iOS SDK build and XCUITest jobs         | `lib/mocks/**`, `packages/ios/**`, Universal, root files     |

See [`.github/workflows/main-pipeline.yaml`](./.github/workflows/main-pipeline.yaml) for the exact
authoritative filter list.

Skipping an implementation E2E job because its filter did not match is expected behavior. If a
change needs to trigger an implementation E2E job but does not match the current filters, update the
path filters in `.github/workflows/main-pipeline.yaml` in the same pull request.

### License checks

Run `license-checker` locally:

```sh
pnpx license-checker --summary
pnpx license-checker > licenses.txt
```

If the license for a package has a spelling or formatting difference from an existing entry in the
`license-check` GitHub workflow allow list, update the list and submit the change via pull request.
Otherwise, create an issue for further guidance from the maintainers.
