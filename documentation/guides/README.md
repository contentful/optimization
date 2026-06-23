---
title: Guides
children:
  - ./choosing-the-right-sdk.md
  - ./integrating-the-node-sdk-in-a-node-app.md
  - ./integrating-the-web-sdk-in-a-web-app.md
  - ./integrating-the-react-web-sdk-in-a-react-app.md
  - ./integrating-the-react-native-sdk-in-a-react-native-app.md
  - ./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md
  - ./integrating-the-optimization-ios-sdk-in-a-uikit-app.md
  - ./integrating-the-optimization-android-sdk-in-a-compose-app.md
  - ./integrating-the-optimization-android-sdk-in-a-views-app.md
  - ./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md
  - ./integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md
  - ./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md
---

# Guides

Start here when you need package selection guidance or step-by-step SDK implementation instructions.
If you only need package-level API summaries, use the linked package README from the root package
inventory instead.

## Start here

- [Choosing the right SDK](./choosing-the-right-sdk.md) - pick the narrowest published package layer
  for a browser, React, Next.js, Node, React Native, native iOS, or native Android application

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
- [Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md) -
  step-by-step SwiftUI integration guidance covering setup, consent, entry personalization,
  interaction tracking, screen tracking, live updates, and the in-app preview panel
- [Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md) -
  step-by-step UIKit integration guidance covering direct client setup, consent, manual entry
  personalization, interaction tracking, screen tracking, live updates, and the in-app preview panel
- [Integrating the Optimization Android SDK in a Jetpack Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md) -
  step-by-step Compose integration guidance covering setup, consent, entry personalization,
  interaction tracking, screen tracking, live updates, and the in-app preview panel
- [Integrating the Optimization Android SDK in an XML Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md) -
  step-by-step XML Views integration guidance covering `OptimizationManager`, consent, entry
  personalization, interaction tracking, screen tracking, live updates, and the in-app preview panel
- [Integrating the Optimization SDK in a Next.js app (SSR)](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md) -
  step-by-step Next.js App Router guidance for the SSR pattern using the Next.js adapter package
- [Integrating the Optimization SDK in a Next.js app (hybrid SSR + CSR takeover)](./integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md) -
  step-by-step Next.js App Router guidance for the hybrid pattern where first paint is
  server-resolved and the adapter's client entry takes over for instant client-side reactivity after
  hydration

## Supplemental guides

- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) -
  guidance for forwarding Contentful optimization context to analytics, tag-management,
  customer-data, and product-analytics systems
