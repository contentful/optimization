# iOS SPM Publishing Plan

## 1. Goal

A consumer adds the SDK with one line, same as Firebase or Stripe:

```swift
.package(url: "https://github.com/contentful/optimization.swift.git", from: "0.1.0")
```

No subdirectory tricks, no `pnpm install`, no local checkouts. They point at the URL and it builds.

**Not in scope:** CocoaPods (iOS 15+, no existing users, not worth the Podspec upkeep). A SwiftPM  
registry (Apple ships no first-party one; third-party registries are worse than a public repo).  
Replacing JavaScriptCore (separate effort). We don't care about cocoapods, it's deprecated.

## 2. Current state

- SDK source: `packages/ios/ContentfulOptimization/` in the `contentful/optimization` monorepo.
- `Package.swift`: swift-tools 5.9, iOS 15 / macOS 12, one library target linking `JavaScriptCore`,
  one test target. It declares two resources: `Resources/optimization-ios-bridge.umd.js` and
  `Resources/polyfills`.
- The JS bridge UMD (84 KB) is **committed** at
  `Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`. It is built by
  `@contentful/optimization-js-bridge` (`pnpm build` → `postbuild` copies it into the iOS Resources
  dir and the Android assets dir) and hand-committed whenever the bridge source changes.
- The polyfills at `Resources/polyfills/*.js` are **hand-authored source**, not build output (the
  postbuild only copies the UMD). They stay in the monorepo.
- `rslib.config.ts` stamps `__OPTIMIZATION_VERSION__` from `process.env.RELEASE_VERSION` at build
  time, so a release build produces a correctly-versioned bundle.
- npm releases are tag-driven: a GitHub Release with a `v`_ tag triggers `publish-npm.yaml`, which
  checks out the tag, installs, bumps versions, runs `pnpm build` with `RELEASE_VERSION`, and
  publishes all `@contentful/optimization-_` packages.
- There is no iOS publishing workflow yet.

**The constraint.** SwiftPM clones the whole repo and expects `Package.swift` at the root. There is
no syntax for a subdirectory inside a remote repo, and Apple has not shipped one (SE-0444 is
unrelated). So the package must live at the root of _some_ repo.

## 3. Approach

**A release workflow builds the package in CI and pushes the built result to a separate distribution
repo, `contentful/optimization.swift`. Like npm: we don't commit `dist/`, the release action builds
it and publishes it.**

Each release, the workflow clones `optimization.swift`, builds the bridge, copies the Swift sources
plus the freshly-built UMD into the clone, commits, tags, and pushes. The distribution repo always
holds a complete, pre-built package at its root, so consumers point at the URL and it just builds.

We rejected `git subtree split` (the original plan) because it copies a subdirectory _verbatim_. It
can only publish bytes that already exist in the monorepo, so it requires keeping the built UMD
committed — which is exactly what we want to stop doing. Building in CI removes the committed
artifact and makes a stale bridge structurally impossible: the UMD is rebuilt on every release.

We also rejected a root `Package.swift` in the monorepo (forces consumers to clone hundreds of MB of
unrelated packages) and an XCFramework binary target (adds macOS-runner cost, hides source, doesn't
fit a source-level SwiftUI API).

The repo name follows Contentful convention: `contentful/contentful.swift`,
`contentful/rich-text-renderer.swift`.

## 4. Implementation steps

Owner key: **SDK** = Optimization SDK team, **CI** = release engineering.

### Step 1 — Create the distribution repo and its push credential (one-time)

1. The repo `https://github.com/contentful/optimization.swift` already exists. The workflow
   populates everything in it, so it needs no README/LICENSE committed by hand.
2. Provision the push credential. Someone with **admin** on `optimization.swift` runs
   `scripts/setup-spm-mirror-credential.sh`. It generates an SSH keypair, registers the public key
   on the mirror as a writable deploy key, and stores the private key as the `SPM_MIRROR_DEPLOY_KEY`
   Actions secret on `contentful/optimization` — exactly what the Step 4 workflow reads. (Admin is
   required because deploy-key management needs it; `MAINTAIN` is not enough.)
3. Treat `main` as generated: humans don't push to it. The deploy key in step 2 is the only
   non-admin write path, and it's used only by the workflow.

### Step 2 — Add consumer-facing files to the package dir (SDK)

These must live inside `packages/ios/ContentfulOptimization/` so they land in the distribution repo:

- `README.md` — install snippet (section 6) and quick-start, adapted from `packages/ios/README.md`
  minus monorepo-internal references. Add a line: "Source lives at
  [https://github.com/contentful/optimization](https://github.com/contentful/optimization). This
  repo is generated; do not file PRs here."
- `LICENSE` — copy from the repo root.

### Step 3 — Stop committing the UMD (SDK)

1. Gitignore `Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js` (and, by
   symmetry, the Android bundle). The `postbuild` copy step stays; it now writes an ignored file.
2. Remove the committed UMD from git tracking.
3. Anyone running `swift build`/`swift test` inside the monorepo now builds the bridge first:
   `pnpm --filter @contentful/optimization-js-bridge build`. Add a script/Make target for this and
   wire it into the main-pipeline iOS job (see step 5). Same model as `dist/` for npm packages.

### Step 4 — Add the publish workflow (CI)

Create `.github/workflows/publish-spm.yaml`. It runs on `ubuntu-latest` (we don't compile Swift to
publish) and on the same trigger as npm:

```yaml
name: Publish Swift Package

permissions:
  contents: read

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: 'Existing release tag (e.g. v1.2.3)'
        required: true

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Derive release version
        run: |
          if [ "${{ github.event_name }}" = "release" ]; then
            TAG='${{ github.event.release.tag_name }}'
          else
            TAG='${{ inputs.tag }}'
          fi
          echo "RELEASE_TAG=$TAG"         >> "$GITHUB_ENV"
          echo "RELEASE_VERSION=${TAG#v}" >> "$GITHUB_ENV"

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          ref: ${{ github.event_name == 'release' && github.event.release.tag_name || inputs.tag }}

      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version-file: '.nvmrc'
          package-manager-cache: false

      - uses: pnpm/action-setup@903f9c1a6ebcba6cf41d87230be49611ac97822e # v6.0.3

      - run: pnpm install --prefer-offline --frozen-lockfile

      - name: Build the JS bridge (stamps the version into the UMD)
        run: pnpm --filter @contentful/optimization-js-bridge build
        env:
          RELEASE_VERSION: ${{ env.RELEASE_VERSION }}

      - name: Assemble the package payload
        run: |
          SRC=packages/ios/ContentfulOptimization
          DST="$RUNNER_TEMP/pkg"
          mkdir -p "$DST"
          # Swift sources, Package.swift, polyfills, README, LICENSE — but not the UMD (built below)
          rsync -a --exclude='Resources/optimization-ios-bridge.umd.js' "$SRC"/ "$DST"/
          cp packages/universal/optimization-js-bridge/dist/optimization-ios-bridge.umd.js \
             "$DST/Sources/ContentfulOptimization/Resources/"

      - name: Verify the payload is complete
        run: |
          test -f "$RUNNER_TEMP/pkg/Package.swift"
          test -f "$RUNNER_TEMP/pkg/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js"
          test -d "$RUNNER_TEMP/pkg/Sources/ContentfulOptimization/Resources/polyfills"

      - name: Set up the deploy key for SSH push
        env:
          MIRROR_DEPLOY_KEY: ${{ secrets.SPM_MIRROR_DEPLOY_KEY }}
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "$MIRROR_DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null

      - name: Commit, tag, and push to the distribution repo
        run: |
          git clone --depth 1 git@github.com:contentful/optimization.swift.git mirror
          # --delete so files removed in the monorepo also disappear from the mirror
          rsync -a --delete --exclude='.git' "$RUNNER_TEMP/pkg"/ mirror/
          cd mirror
          git add -A
          git -c user.name='contentful-ci' -c user.email='ci@contentful.com' \
              commit -m "Release $RELEASE_TAG (from contentful/optimization@${GITHUB_SHA:0:7})"
          git push origin HEAD:main
          git tag --force "$RELEASE_TAG"
          git push origin "refs/tags/$RELEASE_TAG" --force
```

Notes:

- The push credential is a **writable deploy key** on `contentful/optimization.swift` (an SSH key
  scoped to that one repo). It's provisioned by `scripts/setup-spm-mirror-credential.sh`, which adds
  the public key to the mirror and stores the private key as the `SPM_MIRROR_DEPLOY_KEY` Actions
  secret on `contentful/optimization`. A deploy key is used rather than a PAT because it can be
  created entirely from the CLI and isn't tied to a person's account.
- No `fetch-depth: 0`, no force-push on `main` — each release is a normal commit on a linear
  history, with the source SHA in the message.
- `--force` on the **tag** only, to allow re-running a release (e.g. a hotfix re-tag).
- `rsync --delete` keeps the mirror in sync when files are removed from the package.

### Step 5 — Catch breaks before they reach the mirror (SDK)

Add a job to `main-pipeline.yaml` that, on PRs touching `packages/ios/ContentfulOptimization/`** or
`packages/universal/optimization-js-bridge/**`, builds the bridge and runs `swift build`+`swift
test` from the package dir on a macOS runner. Since the UMD is no longer committed (step 3), this
job must build the bridge first.

### Step 6 — Dry run (SDK, one-time)

Run the workflow via `workflow_dispatch` against a throwaway tag (`v0.0.1-rc.0`) and a throwaway
repo (`contentful/optimization.swift-staging`). Confirm:

- The mirror contains the full package, including the freshly-built UMD and polyfills.
- `swift package resolve` from a fresh checkout works.
- Xcode's "Add Package Dependencies" resolves the tag.

Delete the staging repo once green.

### Step 7 — Cut the first release (SDK + CI)

1. Start at `0.1.0` (signals pre-1.0 / alpha, matching the README warning).
2. Create a GitHub Release with tag `v0.1.0`. This triggers both `publish-npm.yaml` and
   `publish-spm.yaml` in parallel.
3. Confirm `v0.1.0` exists in the mirror and resolves.

### Step 8 — Update the demo and docs (SDK)

- Point `contentful/optimization-ios-demo` at the SPM URL (`from: "0.1.0"`) instead of the local
  path. Verify a clean checkout builds.
- Note the release flow in `packages/ios/README.md` and
  `packages/ios/ContentfulOptimization/AGENTS.md`: releases go through `publish-spm.yaml`; the
  mirror is generated; nobody pushes to it by hand.

## 5. Versioning

- **Tag format.** Keep `v<semver>` on the monorepo. The same tag flows to npm and the Swift mirror.
- **One version line.** The Swift package and the `@contentful/optimization-`\* npm packages share a
  version. So Swift `0.3.2` always embeds the `0.3.2` bridge — they're paired by construction.
- **Pre-releases.** SwiftPM understands semver pre-release tags (`0.1.0-rc.1`). The workflow tags
  the mirror with whatever tag triggered it, so this works with no changes.
- **No stale-bridge risk.** Because the UMD is rebuilt in CI on every release (not read from a
  committed file), the published bridge always matches the tagged source.
- **Semver policy.** Pre-1.0: minor bumps may break the API, patch bumps are bugfixes. Post-1.0:
  strict semver. Keep the alpha warning until `1.0.0`.

## 6. Consumer install

In the package's `README.md`:

````markdown
## Installation

### Swift Package Manager

In `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/contentful/optimization.swift.git", from: "0.1.0"),
],
targets: [
    .target(
        name: "MyApp",
        dependencies: [
            .product(name: "ContentfulOptimization", package: "optimization.swift"),
        ]
    ),
],
```
````

Or in Xcode: **File > Add Package Dependencies…** and paste
`https://github.com/contentful/optimization.swift`.

Requires iOS 15 / macOS 12 or later.

```

### Repos that change

- `contentful/optimization-ios-demo`: swap its local `path:` dependency for the SPM URL (step 8).
- Any internal app consuming the SDK by local checkout: same swap.
- `contentful/optimization`: no change to `packages/` editing flow; only the gitignore change, the
new workflow, README, and LICENSE are added.

## 7. Open questions

1. **macOS support is declared but unproven.** `Package.swift` lists `.macOS(.v12)` but the polyfills
  may behave differently there. Confirm whether macOS is really supported before the first release —
   dropping it later is a breaking change.
2. **Runtime version string.** There is no `Version.swift` today, so support can't read the SDK
  version at runtime. Decide whether to add one (the workflow could generate it during assembly from
   `RELEASE_VERSION`) now or later.
3. **Coupled tags.** A `v`* tag now means both an npm release and a Swift release. To ship a
  Swift-only fix we'd need a separate `ios-v*` namespace. Keep them coupled until there's a concrete
   need to split.

## References

- Contentful Swift naming: [https://github.com/contentful/contentful.swift](https://github.com/contentful/contentful.swift),
[https://github.com/contentful/rich-text-renderer.swift](https://github.com/contentful/rich-text-renderer.swift).
- SwiftPM remote-subdirectory limitation: no shipped Swift-evolution proposal as of May 2026
(SE-0444, "member import visibility", is unrelated despite the similar name).

```
