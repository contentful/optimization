<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="./contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization SDK Suite</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](./CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

## Introduction

A [pnpm](https://pnpm.io/) monorepo hosting a Suite of SDKs that implement functionality for
Contentful's [Personalization](https://www.contentful.com/developers/docs/personalization/) and
[Analytics](https://www.contentful.com/developers/docs/analytics/overview/) products.

**What is Contentful?**

Contentful provides content infrastructure for digital teams to power websites, apps, and devices.
Unlike a CMS, Contentful was built to integrate with the modern software stack. It offers a central
hub for structured content, powerful management and delivery APIs, and a customizable web app that
enables developers and content creators to ship their products faster.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Optimization SDKs](#optimization-sdks)
- [Reference Implementations](#reference-implementations)
- [Universal Libraries](#universal-libraries)
- [Shared Internal Libraries](#shared-internal-libraries)
- [Get Involved](#get-involved)
- [License](#license)
- [Code of Conduct](#code-of-conduct)

<!-- mtoc-end -->
</details>

## Optimization SDKs

Optimization SDKs are organized in a hierarchy based on platform, environment, and optionally,
framework. Each SDK builds on top of the common SDK for its platform, environment, and so on, to
ensure functionality is reasonably shared and consistent.

- [Optimization Core SDK](./universal/core/README.md)
  - iOS
    - iOS Swift SDK (TBD)
  - Android
    - Android Kotlin SDK (TBD)
    - Android Java SDK (TBD)
  - _JavaScript_
    - [Node SDK](/platforms/javascript/node/README.md)
      - Nest.js SDK (TBD)
    - [React Native SDK](/platforms/javascript/react-native/README.md)
    - [Web SDK](/platforms/javascript/web/README.md)
      - Angular SDK (TBD)
      - React SDK (TBD)
      - Svelte SDK (TBD)
      - Vue SDK (TBD)

> [!NOTE]
>
> The JavaScript platform includes React Native, which could be considered a JavaScript development
> environment for native platforms.

## Reference Implementations

The SDK Suite's reference implementations are intended to serve the following purposes:

- E2E testing of critical SDK functionality
- Clear and simple documentation of common SDK use cases with absolutely no extraneous content or
  functionality

> [!WARNING]
>
> Reference implementations may share some similarities with projects commonly labeled examples,
> demos, or playgrounds, but are more sparse and strictly maintained

## Universal Libraries

These libraries may be used independently of other libraries and SDKs in the Optimization SDK Suite.
They are relied upon by all SDKs, with their exported values and functionality exposed throughout
the SDK hierarchy.

- [API Client Library](./universal/api-client/README.md) for the Experience & Insights APIs
- [API Schemas Library](./universal/api-schemas/README.md) maintains Zod validation schemas and
  TypeScript types for working with Experience API request and response payloads

## Shared Internal Libraries

Libraries that are shared internally among Optimization SDKs, and are not currently published, are
located within the `/lib` folder in the project root.

- [Logger](/lib/logger/README.md) is a simple logging abstraction utility
- [Mocks](/lib/mocks/README.md) supplies testing fixtures and data, as well as mock server
  implementations used in both unit and end to end tests throughout the SDK suite

## Get Involved

We appreciate any help on our repositories. For more details about how to contribute see our
[CONTRIBUTING](https://github.com/contentful/contentful.js/blob/master/CONTRIBUTING.md) document.

## License

This repository is published under the [MIT](LICENSE) license.

## Code of Conduct

We want to provide a safe, inclusive, welcoming, and harassment-free space and experience for all
participants, regardless of gender identity and expression, sexual orientation, disability, physical
appearance, socioeconomic status, body size, ethnicity, nationality, level of experience, age,
religion (or lack thereof), or other identity markers.

[Read our full Code of Conduct](https://www.contentful.com/developers/code-of-conduct/).
