# Choosing the right SDK

Use this guide when you need to select the Optimization SDK package or native package that matches
an application runtime before following an integration guide.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Recommendation](#recommendation)
- [Decision table](#decision-table)
- [Alternatives](#alternatives)
- [Follow-up guides](#follow-up-guides)

<!-- mtoc-end -->
</details>

## Recommendation

Choose the highest-level SDK that matches the app runtime. Framework and native SDKs own the
runtime-specific setup around providers, hooks, screen or route tracking, persistence, preview
tooling, and platform defaults. Use lower-level packages only when you are building SDK layers,
tooling, tests, or first-party integrations that need shared SDK primitives or raw API access.

For mixed server and browser applications, use the adapter when one exists. Next.js App Router apps
use `@contentful/optimization-nextjs/app-router`; it provides `createNextjsAppRouterOptimization()`,
an automatic factory that returns app-local bound `OptimizationRoot`, `OptimizationProvider`,
`OptimizedEntry`, and route trackers for Server and Client Components. Next.js Pages Router apps use
`@contentful/optimization-nextjs/pages-router` plus
`@contentful/optimization-nextjs/pages-router/server` for `getServerSideProps`. The Next.js package
root is intentionally not an import path; use `/client`, `/server`, `/request-handler`, `/esr`, and
`/tracking-attributes` subpaths for lower-level control. Non-Next.js server-rendered apps can
combine `@contentful/optimization-node` on the server with `@contentful/optimization-web` or
`@contentful/optimization-react-web` in the browser.

Angular, Vue, Svelte, Web Components, and custom browser framework apps use
`@contentful/optimization-web`. Nest.js and other Node server frameworks use
`@contentful/optimization-node` unless the app is a Next.js App Router or Pages Router app covered
by the Next.js adapter.

For JavaScript SDKs, we recommend the consumer-owned `contentful.js` path when the app already uses
that client. Create the delivery client in your app, pass it to the Optimization SDK as
`contentful: { client, defaultQuery?, cache? }`, then fetch optimized entries by entry ID through
SDK helpers or framework entry props. When a route knows several IDs, managed prefetch can batch
uncached entries through `getEntries()` on that client, split into 100-ID chunks for large fetches.
Manual baseline-entry fetching plus `resolveOptimizedEntry()` remains supported when the app needs
full delivery control or a non-`contentful.js` flow.

For custom JavaScript runtimes or framework adapters where no official package fits, use Core plus
the `@contentful/optimization-core/entry-source` subpath for managed `baselineEntry | entryId`
lifecycle. Keep using the highest-level SDK when one fits; Core does not provide rendering,
runtime-specific tracking, consent UI, or framework integration.

For mobile apps, choose `@contentful/optimization-react-native` when the mobile app is built with
JavaScript or TypeScript in React Native. Choose the native iOS or Android SDK only for
platform-native apps that can accept alpha native API and setup changes.

> [!WARNING]
>
> Public package READMEs mark the Optimization SDK Suite as pre-release alpha. Plan for breaking
> changes while adopting these packages.

## Decision table

Use this table to choose the primary package and the next integration guide:

| Reader need                                                                                                | Choose                                                                            | Why                                                                                                                                                                                                                             | Next guide                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Nest.js app, Node server, server function, or SSR layer outside the Next.js adapter                        | `@contentful/optimization-node`                                                   | It provides stateless, request-scoped profile evaluation, event emission, managed Contentful entry fetching and prefetching, entry resolution, and caching guidance for Node runtimes.                                          | [Integrating the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md)                                           |
| Angular, Vue, Svelte, Web Components, non-React browser app, or custom browser framework app               | `@contentful/optimization-web`                                                    | It owns browser consent state, anonymous ID persistence, managed Contentful entry fetching and prefetching, automatic entry interaction tracking, browser event delivery, and Web Components.                                   | [Integrating the Optimization Web SDK in a web app](./integrating-the-web-sdk-in-a-web-app.md)                                               |
| React browser app outside Next.js integration                                                              | `@contentful/optimization-react-web`                                              | It wraps the Web SDK with React providers, hooks, router page tracking, optimized entry rendering by entry ID, interaction tracking, and live update semantics.                                                                 | [Integrating the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md)                               |
| Next.js App Router app with server-personalized first paint and browser re-resolution after hydration      | `@contentful/optimization-nextjs/app-router`                                      | Its `/app-router` bound `OptimizationRoot`, `OptimizedEntry`, and route tracker keep personalized initial HTML before the browser SDK owns reactive entry resolution, live updates, route events, and preview-panel attachment. | [Integrating the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)     |
| Next.js Pages Router app with `getServerSideProps` personalization                                         | `@contentful/optimization-nextjs/pages-router` plus `/pages-router/server`        | Its `/pages-router` components and `/pages-router/server` helper pass server Optimization state through `pageProps` and avoid duplicate initial page events.                                                                    | [Integrating the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md) |
| Custom JavaScript runtime or framework adapter where no official SDK fits                                  | `@contentful/optimization-core` plus `@contentful/optimization-core/entry-source` | Core provides shared state and resolution primitives. The entry-source subpath manages baseline-entry or entry-ID source lifecycle while the adapter owns rendering, tracking, and runtime policy.                              | [Building a custom JavaScript Optimization adapter](./building-a-custom-javascript-optimization-adapter.md)                                  |
| React Native app                                                                                           | `@contentful/optimization-react-native`                                           | It provides a stateful JavaScript mobile runtime with React providers, hooks, `OptimizedEntry`, screen tracking, optional offline-aware delivery, and preview-panel support.                                                    | [Integrating the Optimization React Native SDK in a React Native app](./integrating-the-react-native-sdk-in-a-react-native-app.md)           |
| Native iOS app built with SwiftUI that accepts alpha native API and setup changes                          | `ContentfulOptimization` Swift Package                                            | It provides native Swift APIs, SwiftUI helpers, persistence, networking, lifecycle handling, screen tracking, entry rendering, and preview-panel UI.                                                                            | [Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)                          |
| Native iOS app built with UIKit or direct client ownership that accepts alpha native API and setup changes | `ContentfulOptimization` Swift Package                                            | It exposes the same native iOS runtime through direct client APIs and UIKit-compatible preview, screen tracking, and entry-rendering patterns.                                                                                  | [Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md)                              |
| Native Android app built with Jetpack Compose that accepts alpha native API and setup changes              | `com.contentful.java:optimization-android`                                        | The Android AAR includes the stateful Kotlin client, Compose UI helpers, screen tracking, entry optimization, preview controls, and offline event delivery.                                                                     | [Integrating the Optimization Android SDK in a Jetpack Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md)          |
| Native Android app built with Android Views or XML layouts that accepts alpha native API and setup changes | `com.contentful.java:optimization-android`                                        | The same Android AAR includes Android Views helpers such as `OptimizationManager`, `OptimizedEntryView`, `ScreenTracker`, preview controls, and the stateful client.                                                            | [Integrating the Optimization Android SDK in an Android Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md)             |

## Alternatives

- **Browser preview panel** - Add `@contentful/optimization-web-preview-panel` to a Web SDK or React
  Web SDK integration when the browser app needs author preview overrides. It attaches to a Web SDK
  instance and reads definitions from an existing Contentful client or pre-fetched audience and
  experience entries; it is not a standalone SDK.
- **Core SDK** - Use `@contentful/optimization-core` when building or maintaining an SDK layer that
  needs the shared state machine, event builders, queues, resolvers, interceptors, or preview
  support. Use `@contentful/optimization-core/entry-source` only when building an adapter that must
  manage `baselineEntry | entryId` source lifecycle before resolution. Application integrations
  start with a platform SDK.
- **API client** - Use `@contentful/optimization-api-client` when building SDK layers, tooling,
  tests, or first-party integrations that need direct Experience API or Insights API transport
  without SDK state, consent handling, event builders, entry resolution, tracking, or platform
  defaults.
- **API schemas** - Use `@contentful/optimization-api-schemas` when you need shared runtime
  validation schemas or inferred TypeScript types for Contentful CDA, Experience API, and Insights
  API payloads.
- **Native JavaScript bridge** - `@contentful/optimization-js-bridge` is internal bridge
  infrastructure for the native iOS and Android SDKs. Native applications use the
  `ContentfulOptimization` Swift Package or `com.contentful.java:optimization-android` instead.

## Follow-up guides

After choosing the package, follow the matching guide:

| Runtime or task                         | Guide                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node servers and server-side rendering  | [Integrating the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md)                                                          |
| Browser apps without React              | [Integrating the Optimization Web SDK in a web app](./integrating-the-web-sdk-in-a-web-app.md)                                                              |
| React browser apps                      | [Integrating the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md)                                              |
| Next.js App Router apps                 | [Integrating the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)                    |
| Next.js Pages Router apps               | [Integrating the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)                |
| Custom JavaScript adapter               | [Building a custom JavaScript Optimization adapter](./building-a-custom-javascript-optimization-adapter.md)                                                 |
| React Native apps                       | [Integrating the Optimization React Native SDK in a React Native app](./integrating-the-react-native-sdk-in-a-react-native-app.md)                          |
| iOS SwiftUI apps                        | [Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)                                         |
| iOS UIKit apps                          | [Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md)                                             |
| Android Jetpack Compose apps            | [Integrating the Optimization Android SDK in a Jetpack Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md)                         |
| Android Views apps                      | [Integrating the Optimization Android SDK in an Android Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md)                            |
| Analytics and tag-management forwarding | [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) |
