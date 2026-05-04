# Choosing the right SDK

Use this guide to choose the narrowest package layer that matches the runtime you are building for.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime-first selection](#runtime-first-selection)
  - [Browser applications](#browser-applications)
  - [React applications on the web](#react-applications-on-the-web)
  - [Node servers and server-side rendering](#node-servers-and-server-side-rendering)
  - [React Native applications](#react-native-applications)
- [Lower-level building blocks](#lower-level-building-blocks)
  - [`@contentful/optimization-core`](#contentfuloptimization-core)
  - [`@contentful/optimization-api-client`](#contentfuloptimization-api-client)
  - [`@contentful/optimization-api-schemas`](#contentfuloptimization-api-schemas)
- [Common package combinations](#common-package-combinations)

<!-- mtoc-end -->
</details>

## Runtime-first selection

### Browser applications

Choose `@contentful/optimization-web` when the application runs in the browser and needs stateful,
client-side optimization behavior such as consent handling, event delivery, and automatic entry
interaction tracking.

Add `@contentful/optimization-web-preview-panel` when the same browser runtime also needs local
preview tooling for optimization overrides.

### React applications on the web

Choose `@contentful/optimization-react-web` when the application is already built with React and
benefits from provider composition, hooks, `OptimizedEntry`, and router-specific automatic page
tracking.

This package sits on top of `@contentful/optimization-web`, so React applications generally use the
React layer as their application-facing entry point and rely on the Web SDK transitively.

### Node servers and server-side rendering

Choose `@contentful/optimization-node` when optimization decisions are resolved in a stateless Node
environment such as a server, an SSR layer, or a server-side function.

The Node SDK intentionally avoids runtime-managed state. Consent, identity persistence, and other
long-lived user concerns must remain in the host application or an upstream platform layer.

### React Native applications

Choose `@contentful/optimization-react-native` for React Native applications that need stateful
optimization behavior on mobile, including offline-aware event handling and React Native-specific
tracking utilities.

## Lower-level building blocks

Choose one of the lower layers only when the environment SDKs are too opinionated for the use case
or when you are building a new SDK layer inside this repository.

### `@contentful/optimization-core`

Use Core when building another SDK layer or when you need the shared optimization domain logic
without committing to a specific runtime integration surface.

- `CoreStateful` is the basis for browser and mobile-style runtimes.
- `CoreStateless` is the basis for server-side runtimes.

### `@contentful/optimization-api-client`

Use the API client when the goal is direct Experience API and Insights API access without the higher
level state, tracking, or entry-resolution behavior exposed by the SDK layers.

### `@contentful/optimization-api-schemas`

Use the schema package when you only need runtime validation and inferred TypeScript types for the
Optimization APIs and Contentful entry-shape helpers.

## Common package combinations

- Browser application with author preview: `@contentful/optimization-web` and
  `@contentful/optimization-web-preview-panel`
- React browser application: `@contentful/optimization-react-web`
- Server-rendered application with browser follow-up tracking: `@contentful/optimization-node` on
  the server and `@contentful/optimization-web` in the browser
- Custom internal SDK layer: `@contentful/optimization-core`, optionally with
  `@contentful/optimization-api-client` and `@contentful/optimization-api-schemas`
