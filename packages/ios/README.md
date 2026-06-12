<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization iOS SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Optimization iOS SDK is a pre-release Swift Package for native iOS applications. It is part of
the [Contentful Optimization SDK Suite](../../README.md) and runs shared optimization behavior
through the local JavaScriptCore bridge while Swift code owns native app concerns such as
persistence, networking, lifecycle handling, SwiftUI views, and preview-panel UI.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Current status](#current-status)
- [When to use this package](#when-to-use-this-package)
- [Package layout](#package-layout)
- [Releasing](#releasing)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Current status

- The native Swift package exists under [`ContentfulOptimization`](./ContentfulOptimization/).
- The shared JavaScriptCore adapter package lives under
  [`optimization-js-bridge`](../universal/optimization-js-bridge/README.md) and compiles the bridge
  bundle consumed by Swift.
- The native [iOS reference app](../../implementations/ios-sdk/README.md) validates current bridge
  and preview-panel behavior against the shared mock API.
- `OptimizationConfig.locale` is the SDK Experience API and default event locale. Runtime locale
  changes use `OptimizationClient.setLocale(_:)`. Explicit invalid locale values throw.
- Applications own Contentful CDA locale selection. Pass the application locale directly to CDA
  fetches that feed SDK entry resolution. Do not pass all-locale CDA responses from `withAllLocales`
  or `locale=*`; see
  [Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
  For the broader locale model, see
  [Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md).
- This surface is alpha implementation work. Treat the API, setup flow, and bridge contract as
  subject to change until a stable native iOS SDK release is declared.

## When to use this package

Use this directory when working on the native iOS SDK, SwiftUI integration, JavaScriptCore bridge
handoff, preview-panel behavior, or cross-platform native validation. Application teams that need a
stable mobile integration can start with the JavaScript
[`@contentful/optimization-react-native`](../react-native-sdk/README.md) package.

## Package layout

- [`ContentfulOptimization/`](./ContentfulOptimization/) - Swift Package source, public Swift API,
  native runtime, resources, and tests
- [`optimization-js-bridge/`](../universal/optimization-js-bridge/README.md) - shared internal
  TypeScript bridge compiled into the JavaScriptCore UMD bundle consumed by the Swift Package
- [`CODE_MAP.md`](./CODE_MAP.md) - architecture map for the current native iOS implementation

## Releasing

The Swift Package is published to a separate distribution repository,
[`contentful/optimization.swift`](https://github.com/contentful/optimization.swift), so consumers
can add it by URL (`from: "x.y.z"`) without cloning the monorepo. Publishing is automated by
[`publish-spm.yaml`](../../.github/workflows/publish-spm.yaml): on each `v*` release it builds the
JS bridge (stamping the version into the UMD), assembles the package payload, and pushes a commit
and tag to the distribution repo.

The distribution repo is generated output, like an npm `dist/`: nobody pushes to it by hand. The UMD
bundle is no longer committed to the monorepo — it is built on demand (and gitignored). Build it
locally before `swift build`/`swift test` with `pnpm run ios:bridge`, or use the convenience scripts
`pnpm run ios:build` and `pnpm run ios:test` from the repo root.

## Related

- [iOS SDK code map](./CODE_MAP.md) - Maintainer architecture map for the native iOS package
- [Consent management in the Optimization SDK Suite](../../documentation/concepts/consent-management-in-the-optimization-sdk-suite.md) -
  Cross-SDK consent policy guidance
- [Native bridge architecture](../universal/optimization-js-bridge/BRIDGE_ARCHITECTURE.md) - Shared
  bridge runtime and build notes
- [iOS reference app](../../implementations/ios-sdk/README.md) - Native app and XCUITest surface for
  bridge and preview-panel validation
- [React Native SDK](../react-native-sdk/README.md) - Current stable mobile-facing JavaScript SDK
- [Core SDK](../universal/core-sdk/README.md) - Shared optimization foundation used through the
  bridge
