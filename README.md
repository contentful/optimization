<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="./contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization SDK Suite</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](./CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

## Introduction

A [pnpm](https://pnpm.io/) monorepo hosting a suite of SDKs, supporting libraries, and reference
implementations for Contentful
[Personalization](https://www.contentful.com/developers/docs/personalization/) and
[Analytics](https://www.contentful.com/developers/docs/analytics/overview/) products.

**What is Contentful?**

Contentful provides content infrastructure for digital teams to power websites, apps, and devices.
Unlike a CMS, Contentful was built to integrate with the modern software stack. It offers a central
hub for structured content, powerful management and delivery APIs, and a customizable web app that
enables developers and content creators to ship their products faster.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Choosing a Package](#choosing-a-package)
- [Published Packages](#published-packages)
- [Planned SDKs](#planned-sdks)
- [Reference Implementations](#reference-implementations)
- [Repository Layout](#repository-layout)
- [Get Involved](#get-involved)
- [License](#license)
- [Code of Conduct](#code-of-conduct)

<!-- mtoc-end -->
</details>

## Choosing a Package

If you are deciding which SDK or library belongs in your application, start with
[Choosing the Right SDK](./documentation/guides/choosing-the-right-sdk.md).

For additional narrative documentation, see the [Guides](./documentation/README.md) section.

Package README files listed below are package-level overviews. Generated
[reference documentation](https://contentful.github.io/optimization) remains the source of truth for
exported API signatures.

## Published Packages

The published package surface is intentionally layered. The table below is a package inventory and
high-level role summary.

| Package                                      | Kind                  | Runtime          | Role                                                               | Package README                                                     |
| -------------------------------------------- | --------------------- | ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `@contentful/optimization-web`               | Environment SDK       | Browser          | Stateful browser SDK for optimization, tracking, and consent       | [Web SDK](./packages/web/web-sdk/README.md)                        |
| `@contentful/optimization-react-web`         | Framework SDK         | React on the web | React integration layer on top of the Web SDK                      | [React Web SDK](./packages/web/frameworks/react-web-sdk/README.md) |
| `@contentful/optimization-node`              | Environment SDK       | Node.js          | Stateless Node SDK for server-side and SSR integrations            | [Node SDK](./packages/node/node-sdk/README.md)                     |
| `@contentful/optimization-react-native`      | Environment SDK       | React Native     | React Native SDK for mobile applications                           | [React Native SDK](./packages/react-native-sdk/README.md)          |
| `@contentful/optimization-web-preview-panel` | Tooling package       | Browser          | Preview tooling package for existing Web SDK instances             | [Web Preview Panel](./packages/web/preview-panel/README.md)        |
| `@contentful/optimization-core`              | Shared SDK foundation | Runtime-agnostic | Shared optimization foundation for runtime adapters and SDK layers | [Core SDK](./packages/universal/core-sdk/README.md)                |
| `@contentful/optimization-api-client`        | Universal library     | Runtime-agnostic | Direct Experience API and Insights API client library              | [API Client](./packages/universal/api-client/README.md)            |
| `@contentful/optimization-api-schemas`       | Universal library     | Runtime-agnostic | Validation schemas and inferred API/content types library          | [API Schemas](./packages/universal/api-schemas/README.md)          |

General selection rules:

- Most application code should start with an environment SDK or framework SDK.
- `@contentful/optimization-core` is the shared foundation for runtime adapters and SDK layering.
- `@contentful/optimization-api-client` and `@contentful/optimization-api-schemas` are lower-level
  building blocks.

## Planned SDKs

These packages or layers are planned, but are not currently published from this repository:

- iOS Swift SDK
- Android Kotlin SDK
- Android Java SDK
- Nest.js SDK
- Angular SDK
- Svelte SDK
- Vue SDK

## Reference Implementations

Reference implementations exist to exercise critical flows end to end and to document common usage
patterns with intentionally minimal application code.

- [Web Vanilla](./implementations/web-sdk/README.md): static browser integration for the Web SDK
- [React Web](./implementations/web-sdk_react/README.md): React-based browser integration
- [Node SSR Only](./implementations/node-sdk/README.md): server-rendered integration using the Node
  SDK
- [Node SSR + Web Vanilla](./implementations/node-sdk+web-sdk/README.md): split server/browser flow
  using Node and Web SDKs together
- [React Native](./implementations/react-native-sdk/README.md): mobile application integration for
  Android and iOS targets

## Repository Layout

- `packages/`: published SDKs and supporting libraries
- `implementations/`: reference applications used for examples and E2E coverage
- `lib/`: shared internal workspace packages such as mocks and build tooling
- `documentation/`: authored supporting documentation published alongside TypeDoc
- `docs/`: generated TypeDoc output; not source of truth

## Get Involved

We appreciate any help on our repositories. For more details about how to contribute see our
[CONTRIBUTING](./CONTRIBUTING.md) document.

## License

This repository is published under the [MIT](LICENSE) license.

## Code of Conduct

We want to provide a safe, inclusive, welcoming, and harassment-free space and experience for all
participants, regardless of gender identity and expression, sexual orientation, disability, physical
appearance, socioeconomic status, body size, ethnicity, nationality, level of experience, age,
religion (or lack thereof), or other identity markers.

[Read our full Code of Conduct](https://www.contentful.com/developers/code-of-conduct/).
