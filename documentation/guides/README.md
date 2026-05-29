---
title: Guides
children:
  - ./choosing-the-right-sdk.md
  - ./integrating-the-node-sdk-in-a-node-app.md
  - ./integrating-the-web-sdk-in-a-web-app.md
  - ./integrating-the-react-web-sdk-in-a-react-app.md
  - ./integrating-the-react-native-sdk-in-a-react-native-app.md
  - ./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md
  - ./integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md
  - ./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md
  - ./contributing-to-the-ios-sdk.md
  - ./contributing-to-the-android-sdk.md
---

# Guides

Start here when you need package selection guidance or step-by-step SDK implementation instructions.
If you only need package-level API summaries, use the linked package README from the root package
inventory instead.

## Start here

- [Choosing the right SDK](./choosing-the-right-sdk.md) - pick the narrowest published package layer
  for a browser, React, Node, or React Native application

## Integration guides

- [Integrating the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md) -
  step-by-step server-side integration guidance using Express-style examples and the Node reference
  implementations
- [Integrating the Optimization Web SDK in a web app](./integrating-the-web-sdk-in-a-web-app.md) -
  step-by-step browser-side integration guidance covering singleton SDK setup, consent, page events,
  entry resolution, merge tags, flags, tracking, and hybrid SSR cookie continuity
- [Integrating the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md) -
  step-by-step client-side integration guidance covering providers, consent, entry personalization,
  interaction tracking, live updates, router adapters, and preview panel setup
- [Integrating the Optimization React Native SDK in a React Native app](./integrating-the-react-native-sdk-in-a-react-native-app.md) -
  step-by-step React Native / Expo integration guidance covering setup, consent, personalization and
  interaction tracking, screen tracking, live updates, and the in-app preview panel
- [Integrating the Optimization SDK in a Next.js app (SSR-primary)](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md) -
  step-by-step Next.js App Router guidance for the SSR-primary pattern where the Node SDK resolves
  entries server-side and the React Web SDK handles client-side tracking and interactive controls
- [Integrating the Optimization SDK in a Next.js app (hybrid SSR + CSR takeover)](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md) -
  step-by-step Next.js App Router guidance for the hybrid pattern where first paint is
  server-resolved and the React Web SDK takes over for instant client-side reactivity after
  hydration

## Supplemental guides

- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) -
  guidance for forwarding Contentful optimization context to analytics, tag-management,
  customer-data, and product-analytics systems

## Contributor guides

- [Contributing to the iOS SDK](./contributing-to-the-ios-sdk.md) - fresh-clone bootstrap through a
  debuggable change in Xcode, including how the reference impl rebuilds the SDK package and the JS
  bridge automatically on Build
- [Contributing to the Android SDK](./contributing-to-the-android-sdk.md) - fresh-clone bootstrap
  through a debuggable change in Android Studio, including how the composite-build SDK module and
  the `buildJsBridge` Gradle task keep both Kotlin and TypeScript layers in sync on every build

## Supplemental guides

- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) -
  guidance for forwarding Contentful optimization context to analytics, tag-management,
  customer-data, and product-analytics systems
