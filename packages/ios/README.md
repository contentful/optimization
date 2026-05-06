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
- [Related](#related)

<!-- mtoc-end -->
</details>

## Current status

- The native Swift package exists under [`ContentfulOptimization`](./ContentfulOptimization/).
- The JavaScriptCore adapter package lives under [`ios-jsc-bridge`](./ios-jsc-bridge/README.md) and
  compiles the bridge bundle consumed by Swift.
- The native [iOS reference app](../../implementations/ios-sdk/README.md) validates current bridge
  and preview-panel behavior against the shared mock API.
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
- [`ios-jsc-bridge/`](./ios-jsc-bridge/README.md) - internal TypeScript bridge compiled into the
  JavaScriptCore UMD bundle consumed by the Swift Package
- [`CODE_MAP.md`](./CODE_MAP.md) - architecture map for the current native iOS implementation

## Related

- [iOS reference app](../../implementations/ios-sdk/README.md) - Native app and XCUITest surface for
  bridge and preview-panel validation
- [React Native SDK](../react-native-sdk/README.md) - Current stable mobile-facing JavaScript SDK
- [Core SDK](../universal/core-sdk/README.md) - Shared optimization foundation used through the
  bridge
