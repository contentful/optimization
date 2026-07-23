---
title: Guides
children:
  - ./choosing-the-right-sdk.md
  - ./integrating-the-node-sdk-in-a-node-app.md
  - ./integrating-the-web-sdk-in-a-web-app.md
  - ./integrating-the-react-web-sdk-in-a-react-app.md
  - ./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md
  - ./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md
  - ./migrating-experience-js-contentful-model-to-optimization.md
  - ./migrating-experience-js-to-the-web-sdk.md
  - ./migrating-experience-js-react-to-react-web.md
  - ./choosing-a-nextjs-migration-path-from-experience-js.md
  - ./migrating-experience-js-next-to-nextjs-app-router.md
  - ./migrating-experience-js-next-to-nextjs-pages-router.md
  - ./migrating-experience-js-node-ssr-and-esr.md
  - ./migrating-experience-js-plugins-and-preview.md
  - ./integrating-the-react-native-sdk-in-a-react-native-app.md
  - ./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md
  - ./integrating-the-optimization-ios-sdk-in-a-uikit-app.md
  - ./integrating-the-optimization-android-sdk-in-a-compose-app.md
  - ./integrating-the-optimization-android-sdk-in-a-views-app.md
  - ./building-a-custom-javascript-optimization-adapter.md
  - ./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md
---

# Guides

Use this index to pick the guide that matches your SDK runtime. Start with package selection when
you are unsure which SDK layer belongs in your app.

## Start here

- [Choosing the right SDK](./choosing-the-right-sdk.md) - Choose the SDK package and runtime layer
  for your app.

## Integration guides

Server and web SDK guides are listed before native and mobile SDK guides.

### Server and web SDKs

| Guide                                                                                             | Runtime or app type                                                                                   | Package                              |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| [Node SDK](./integrating-the-node-sdk-in-a-node-app.md)                                           | Node server, custom SSR server, or server-side function                                               | `@contentful/optimization-node`      |
| [Web SDK](./integrating-the-web-sdk-in-a-web-app.md)                                              | Browser app, static site, multi-page app, SPA, Angular app, or custom frontend runtime                | `@contentful/optimization-web`       |
| [React Web SDK](./integrating-the-react-web-sdk-in-a-react-app.md)                                | React browser app                                                                                     | `@contentful/optimization-react-web` |
| [Next.js SDK in App Router](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)     | Next.js App Router app with server-personalized first paint and browser re-resolution after hydration | `@contentful/optimization-nextjs`    |
| [Next.js SDK in Pages Router](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md) | Next.js Pages Router app with `getServerSideProps` personalization and state handoff                  | `@contentful/optimization-nextjs`    |

### Native and mobile SDKs

Native and mobile SDK guides route to beta SDK surfaces.

| Guide                                                                                            | Runtime or app type                                        | Package                                    |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------ |
| [React Native SDK](./integrating-the-react-native-sdk-in-a-react-native-app.md)                  | React Native or Expo mobile app                            | `@contentful/optimization-react-native`    |
| [iOS SDK in SwiftUI](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)                 | Native iOS app built with SwiftUI                          | `ContentfulOptimization` Swift Package     |
| [iOS SDK in UIKit](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md)                     | Native iOS app built with UIKit                            | `ContentfulOptimization` Swift Package     |
| [Android SDK in Jetpack Compose](./integrating-the-optimization-android-sdk-in-a-compose-app.md) | Native Android app built with Jetpack Compose              | `com.contentful.java:optimization-android` |
| [Android SDK in Android Views](./integrating-the-optimization-android-sdk-in-a-views-app.md)     | Native Android app built with Android Views or XML layouts | `com.contentful.java:optimization-android` |

## experience.js migration guides

Use these guides when an app already uses `@ninetailed/experience.js` packages and you are replacing
that integration with the Optimization SDK Suite. Start with the Contentful model guide when legacy
`nt_*` fields or mapper utilities feed personalized rendering.

| Guide                                                                                       | Legacy integration type                                                | Target path                                                   |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Contentful model migration](./migrating-experience-js-contentful-model-to-optimization.md) | Legacy Ninetailed-authored entries, `nt_*` fields, mapper utilities    | Optimization-authored experiences and target entry resolution |
| [Web SDK migration](./migrating-experience-js-to-the-web-sdk.md)                            | Plain browser, static site, SPA, Angular, or custom JavaScript runtime | `@contentful/optimization-web`                                |
| [React Web migration](./migrating-experience-js-react-to-react-web.md)                      | React provider, hook, component, or flag surfaces                      | `@contentful/optimization-react-web`                          |
| [Next.js migration path choice](./choosing-a-nextjs-migration-path-from-experience-js.md)   | Legacy Next.js, SSR plugin, ESR, or manual hybrid wiring               | App Router, Pages Router, or manual Node/Web path             |
| [Next.js App Router migration](./migrating-experience-js-next-to-nextjs-app-router.md)      | Next.js app moving to App Router                                       | `@contentful/optimization-nextjs/app-router`                  |
| [Next.js Pages Router migration](./migrating-experience-js-next-to-nextjs-pages-router.md)  | Pages Router app with legacy SSR/plugin wiring                         | `@contentful/optimization-nextjs/pages-router`                |
| [Node, SSR, and ESR migration](./migrating-experience-js-node-ssr-and-esr.md)               | Server API-client, SSR, ESR, or manual handoff code                    | Node SDK, framework SDK, or manual Node/Web hybrid            |
| [Plugins and preview migration](./migrating-experience-js-plugins-and-preview.md)           | Legacy privacy, analytics, insights, or preview plugins                | Target consent, event streams, forwarding, and preview panel  |

## Supplemental guides

- [Building a custom JavaScript Optimization adapter](./building-a-custom-javascript-optimization-adapter.md) -
  Build a low-level adapter only when no official SDK package fits your JavaScript runtime or
  framework.
- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) -
  Forward optimization context to analytics, tag-management, customer-data, or product-analytics
  tools after SDK integration.
