# Contributing to the iOS SDK

Use this guide when you want to work on the native iOS SDK
([`packages/ios/ContentfulOptimization`](../../packages/ios/ContentfulOptimization)) or the shared
JS bridge
([`packages/universal/optimization-js-bridge`](../../packages/universal/optimization-js-bridge)) and
validate your changes in the reference app at
[`implementations/ios-sdk/`](../../implementations/ios-sdk/). For an explanation of how the bridge
works at runtime, read
[Native mobile SDK architecture](../concepts/native-mobile-sdk-architecture.md) and
[iOS SDK bridge](../concepts/ios-sdk-bridge.md) first.

<details>
  <summary>Table of Contents</summary>

- [1. Prerequisites](#1-prerequisites)
- [2. Fresh-clone bootstrap](#2-fresh-clone-bootstrap)
- [3. How the IDE build chain wires together](#3-how-the-ide-build-chain-wires-together)
- [4. The daily edit loop](#4-the-daily-edit-loop)
- [5. Running the reference app](#5-running-the-reference-app)
- [6. Validation cheatsheet](#6-validation-cheatsheet)
- [7. Common pitfalls](#7-common-pitfalls)

</details>

## 1. Prerequisites

- The Node version pinned in [`.nvmrc`](../../.nvmrc) at the repo root. The repository's
  `engines.node` constraint lives in the root [`package.json`](../../package.json).
- `pnpm` (the pinned `packageManager` version is in the root `package.json`; install via Corepack:
  `corepack enable && corepack prepare pnpm@<pinned> --activate`).
- Xcode with an iOS Simulator runtime available.
- `xcodegen` — installable via Homebrew: `brew install xcodegen`. Required because
  `OptimizationApp.xcodeproj` is generated from
  [`implementations/ios-sdk/project.yml`](../../implementations/ios-sdk/project.yml).

## 2. Fresh-clone bootstrap

From the repository root:

```sh
pnpm install
pnpm build:pkgs
```

`pnpm build:pkgs` builds every package in the workspace, including
`@contentful/optimization-js-bridge`. Its `postbuild` script copies the freshly built
`optimization-ios-bridge.umd.js` into
`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/`, which is where the
Swift Package resource declaration in
[`Package.swift`](../../packages/ios/ContentfulOptimization/Package.swift) expects to find it.

Then generate the Xcode project and open it:

```sh
cd implementations/ios-sdk
xcodegen generate
open OptimizationApp.xcodeproj
```

`xcodegen generate` regenerates the project from `project.yml`. Run it again any time you change
`project.yml`, add a Swift file to the reference app, or move sources between targets.

## 3. How the IDE build chain wires together

The reference app references the SDK as a local Swift package:

```yaml
# implementations/ios-sdk/project.yml
packages:
  ContentfulOptimization:
    path: ../../packages/ios/ContentfulOptimization
```

Each app target lists `ContentfulOptimization` as a dependency. Because it is a `path:` package (not
a tarball from `pkgs/`), every Xcode Build of `OptimizationAppSwiftUI` or `OptimizationAppUIKit`
recompiles the SDK package from source. There is no extra "rebuild SDK" step.

For the JS bridge, each app target's scheme declares a **scheme pre-action** that invokes the bridge
build before any target — including the `ContentfulOptimization` Swift package dependency — is
compiled. A per-target `preBuildScripts` entry would fire too late, after the Swift package
dependency has already compiled against a possibly-stale UMD; scheme pre-actions are the only build
hook that runs strictly before SwiftPM resource resolution.

```yaml
# implementations/ios-sdk/project.yml (excerpt)
scheme:
  preActions:
    - name: Build JS bridge
      settingsTarget: OptimizationAppSwiftUI
      script: |
        cd "$SRCROOT/../.."
        bundle="packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js"
        if [ -f "$bundle" ] && [ -z "$(find packages/universal/optimization-js-bridge/src -type f -newer "$bundle" -print -quit)" ]; then
          echo "JS bridge bundle is up to date; skipping rebuild."
          exit 0
        fi
        pnpm --filter @contentful/optimization-js-bridge build
```

The `find -newer` guard skips the rebuild when the bundle is already newer than every source file
under the bridge's `src/` directory. Edit a `.ts` file under
`packages/universal/optimization-js-bridge/src/` and the next Xcode Build re-runs `pnpm build`,
which refreshes the UMD asset before the Swift package compiles against it.

Scheme pre-actions write their output to a system log rather than to Xcode's build log. The script
mirrors its output to `/tmp/optimization-ios-build-js-bridge.log`, so when in doubt, `cat` that file
after a build to confirm the rebuild ran (or correctly reported "up to date; skipping").

The end-state is: edit Swift in `packages/ios/...` **or** TypeScript in
`packages/universal/optimization-js-bridge/src/`, hit Cmd+B, run the simulator — both layers pick up
the change without any manual pnpm or asset-copy step.

## 4. The daily edit loop

1. Make your change in `packages/ios/ContentfulOptimization/Sources/...` (Swift) or
   `packages/universal/optimization-js-bridge/src/...` (TypeScript).
2. In Xcode, pick the `OptimizationAppSwiftUI` or `OptimizationAppUIKit` scheme and hit Build (or
   Run). The scheme pre-action regenerates the UMD only if the TS source is newer; the package
   target recompiles only if Swift sources changed.
3. Validate with the targeted test or UI flow (see § 6).

If you prefer the command line, build and run the simulator entirely from the impl directory:

```sh
cd implementations/ios-sdk
xcodebuild build -project OptimizationApp.xcodeproj \
  -scheme OptimizationAppSwiftUI \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

## 5. Running the reference app

Before launching the app or running UI tests, start the shared mock server from the repo root:

```sh
pnpm serve:mocks
```

The reference app talks to `http://localhost:8000` for both the Experience and Insights APIs.

Then hit Run on the `OptimizationAppSwiftUI` or `OptimizationAppUIKit` scheme. The app exercises
`OptimizationRoot`, `OptimizedEntry`, the preview panel, and analytics flows against the mock
server.

To run the full XCUITest suite from the command line:

```sh
xcodebuild test \
  -project OptimizationApp.xcodeproj \
  -scheme OptimizationAppSwiftUI \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

A single XCUITest class:

```sh
xcodebuild test \
  -project OptimizationApp.xcodeproj \
  -scheme OptimizationAppSwiftUI \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:OptimizationAppUITestsSwiftUI/PreviewPanelOverridesTests
```

Keep accessibility identifiers and scenario names in sync with
[`implementations/PREVIEW_PANEL_SCENARIOS.md`](../../implementations/PREVIEW_PANEL_SCENARIOS.md) so
cross-platform regressions are visible in CI diffs.

## 6. Validation cheatsheet

Repo-wide checks (run from the repo root):

| Command              | What it covers                                                              |
| -------------------- | --------------------------------------------------------------------------- |
| `pnpm lint`          | ESLint for `lib/` and `packages/` (TS sources, build configs, bridge code). |
| `pnpm typecheck`     | `tsc --noEmit` across every workspace package.                              |
| `pnpm test:unit`     | Unit tests for `lib/` and the `@contentful/*` packages.                     |
| `pnpm format:check`  | Prettier check on the entire repo.                                          |
| `pnpm size:check`    | Bundle size budgets for built artifacts.                                    |
| `pnpm docs:generate` | TypeDoc, which also picks up `documentation/**` markdown.                   |

Impl-side checks:

| Command                    | What it covers                           |
| -------------------------- | ---------------------------------------- |
| `pnpm implementation:lint` | ESLint across reference implementations. |

The root [`AGENTS.md`](../../AGENTS.md) calls out the smallest meaningful validation policy: prefer
`pnpm lint` after the first meaningful patch, broaden when the change grows or touches exports /
build tooling. For a change that only edits TypeScript bridge source,
`pnpm lint && pnpm typecheck && pnpm test:unit` is the right minimum; for a change that also touches
Swift, add a targeted `xcodebuild test` for the affected XCUITest scenario.

## 7. Common pitfalls

- **`xcodegen` not installed** — `xcodebuild` will work against an existing
  `OptimizationApp.xcodeproj`, but any change to `project.yml` (including the scheme pre-action
  edits in § 3) needs `xcodegen generate` to take effect.
- **`pnpm` not on Xcode's `PATH`** — Xcode launched from Spotlight does not always inherit the shell
  `PATH` Homebrew installed `pnpm` into. The pre-action probes `/opt/homebrew/bin`,
  `/usr/local/bin`, and `~/.local/share/pnpm`; if your `pnpm` lives elsewhere the simplest fix is
  `sudo ln -s "$(which pnpm)" /usr/local/bin/pnpm`. Restart Xcode after. Check
  `/tmp/optimization-ios-build-js-bridge.log` for the actual error.
- **Build silently uses a stale bundle (no scheme used)** — scheme pre-actions only fire when
  `xcodebuild` is invoked with `-scheme`. If you build a single target directly with
  `xcodebuild -target ContentfulOptimization`, the pre-action does not run. Always go through the
  app scheme (`-scheme OptimizationAppSwiftUI` or `-scheme OptimizationAppUIKit`).
- **Stale bridge bundle after a `git checkout` between branches** — the pre-action's freshness check
  uses mtime, not content hash. If a branch switch leaves a newer-mtime bundle paired with older
  source, the pre-action correctly skips, but the bundle may not match the source you have checked
  out. Run `pnpm --filter @contentful/optimization-js-bridge build` once to force a clean rebuild,
  or `touch packages/universal/optimization-js-bridge/src/index.ts` so the next Xcode build
  regenerates.
- **`__bridge not found after bundle evaluation`** — the iOS bundle resource is missing or empty.
  Most likely cause: a failed bridge build left an empty `dist/` and the `postbuild` copy never ran.
  Rerun `pnpm --filter @contentful/optimization-js-bridge build` and inspect the script output.
- **Simulator selection** — `-destination 'platform=iOS Simulator,name=iPhone 16'` matches whichever
  iPhone 16 the runtime offers. If your local Xcode does not have iPhone 16, substitute another
  device the simulator catalogs (`xcrun simctl list devices`).

## Related

- [Native mobile SDK architecture](../concepts/native-mobile-sdk-architecture.md)
- [iOS SDK bridge](../concepts/ios-sdk-bridge.md)
- [iOS reference implementation README](../../implementations/ios-sdk/README.md)
- [`packages/ios` README](../../packages/ios/README.md)
- [Contributing to the Android SDK](./contributing-to-the-android-sdk.md)
