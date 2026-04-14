---
title: Guides
children:
  - ./choosing-the-right-sdk.md
  - ./integrating-the-node-sdk-in-a-node-app.md
  - ./integrating-the-web-sdk-in-a-web-app.md
  - ./integrating-the-react-web-sdk-in-a-react-app.md
  - ./integrating-the-ios-sdk-fundamentals.md
  - ./integrating-the-ios-sdk-in-a-swiftui-app.md
  - ./integrating-the-ios-sdk-in-a-uikit-app.md
  - ./integrating-the-react-native-sdk-in-a-react-native-app.md
---

# Guides

Start here when you need higher-level guidance about package selection, layering, or how the SDKs
are intended to be used.

## Available Guides

- [Choosing the Right SDK](./choosing-the-right-sdk.md): pick the narrowest published package layer
  for a browser, React, Node, or React Native application
- [Integrating the Optimization Node SDK in a Node App](./integrating-the-node-sdk-in-a-node-app.md):
  step-by-step server-side integration guidance using Express-style examples and the Node reference
  implementations
- [Integrating the Optimization Web SDK in a Web App](./integrating-the-web-sdk-in-a-web-app.md):
  step-by-step browser-side integration guidance covering singleton SDK setup, consent, page events,
  entry resolution, merge tags, flags, tracking, and hybrid SSR cookie continuity
- [Integrating the Optimization React Web SDK in a React App](./integrating-the-react-web-sdk-in-a-react-app.md):
  step-by-step client-side integration guidance covering providers, consent, entry personalization,
  interaction tracking, live updates, router adapters, and preview panel setup  
- [Integrating the Optimization React Native SDK in a React Native App](./integrating-the-react-native-sdk-in-a-react-native-app.md):
  step-by-step React Native / Expo integration guidance covering OptimizationRoot setup, consent,
  OptimizedEntry personalization and interaction tracking, live updates, screen tracking, and the
  in-app preview panel — referenced against the Colorful-Team-Org demo
- [iOS SDK Fundamentals](./integrating-the-ios-sdk-fundamentals.md): shared reference for the iOS
  SDK covering installation, configuration, consent, reactive state, the tracking model, live
  updates, and the preview panel — read this before the UI-framework-specific guides
- [Integrating the Optimization iOS SDK in a SwiftUI App](./integrating-the-ios-sdk-in-a-swiftui-app.md):
  step-by-step SwiftUI integration using `OptimizationRoot`, `OptimizedEntry`,
  `OptimizationScrollView`, `.trackScreen(name:)`, and `PreviewPanelOverlay`
- [Integrating the Optimization iOS SDK in a UIKit App](./integrating-the-ios-sdk-in-a-uikit-app.md):
  step-by-step UIKit integration using `OptimizationClient` directly in `SceneDelegate`, manual
  `personalizeEntry` / `trackView` / `trackClick` calls, and `PreviewPanelViewController`