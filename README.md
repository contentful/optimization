# Contentful Optimization SDK Suite

The Optimization SDK suite implements functionality for Contentful's Personalization and Analytics products.

## Optimization Core Library

The [Optimization Core SDK](./platforms/javascript/core/README.md) includes the following general features:

- API adapters
- Universal logic and utilities
- Abstract classes and building blocks for platform- and framework-specific integrations

The Core SDK is written in Typescript and compiled to Javascript

## Javascript Platform

The Optimization SDK suite supports three Javascript environments:

- [Node](./platforms/javascript/node/README.md) (TBC)
- [Web](./platforms/javascript/web/README.md) (TBC)
- React Native (TBC)

Mobile applications that heavily utilize Web technologies, such as those built using Tauri or Ionic, may be able to use the Web Optimization SDK.

### Frameworks

Framework-specific SDKs will be provided for the following popular frameworks:

- Angular (TBC)
- NestJS (TBC)
- React (TBC)
- Svelte (TBC)
- Vue (TBC)

There may also be SDKs provided for various meta-frameworks and/or hybrid frameworks, such as:

- Meteor (TBC)
- Next.js (TBC)
- Nuxt (TBC)
- SvelteKit (TBC)

Not every framework or architecture can be directly supported by a dedicated SDK. However, we will attempt to cover other integration possibilities via documentation.

## Native Platforms

The Optimization SDK suite will support the following native platforms:

- Android (TBC)
- iOS (TBC)

SDKs for platforms that are not Javascript-based may utilize Core within a Javascript context, to avoid duplication of logic.

## Reference Implementations

At least one reference implementation is provided for each of the suite's SDKs. These implementations are primarily intended to be used as documentation and for automated E2E testing. As such, there may be multiple reference implementations to cover various common application architecture possibilities where the differences are significant to the integration of the relevant SDK(s).

## Additional Documentation

Lower-level SDK documentation may be found at [https://contentful.github.io/optimization](https://contentful.github.io/optimization)
