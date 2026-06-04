---
title: Concepts
children:
  - ./core-state-management.md
  - ./consent-management-in-the-optimization-sdk-suite.md
  - ./entry-personalization-and-variant-resolution.md
  - ./locale-handling-in-the-optimization-sdk-suite.md
  - ./interaction-tracking-in-web-sdks.md
  - ./interaction-tracking-in-node-and-stateless-environments.md
  - ./profile-synchronization-between-client-and-server.md
  - ./react-native-sdk-interaction-tracking-mechanics.md
  - ./ios-sdk-runtime-and-interaction-mechanics.md
  - ./android-sdk-runtime-and-interaction-mechanics.md
---

# Concepts

Start here when you need to understand how SDK features work, why they behave a certain way, or how
the implementation makes runtime decisions. Concepts complement package README files and guides;
they are not the first stop for installation or setup commands.

## Available concepts

- [Core state management](./core-state-management.md) - explains how `CoreStateful` stores internal
  state using signals, why that state is protected from outside interference, and which
  consumer-facing surfaces — observables, interceptors, and lifecycle methods — are the correct way
  to observe and influence state.
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md) -
  explains how SDK consent state, event allow-lists, blocked-event diagnostics, persistence, and
  application-owned CMP policy work together to support consent-aware integrations.
- [Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  explains how the SDK resolves a Contentful baseline entry to the selected entry variant, including
  data model expectations, fallback behavior, resolution paths, and preview overrides.
- [Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md) -
  explains how Contentful locales, `contentful.js` locale response shapes, Experience API locale
  options, SDK-assisted locale resolution, and runtime-specific locale sources work together.
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md) - explains how
  `@contentful/optimization-web` and `@contentful/optimization-react-web` detect browser entry
  views, clicks, hovers, Custom Flag views, page events, and custom events, including consent,
  profile, DOM, and delivery mechanics.
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md) -
  explains what the Node SDK can track from a stateless server runtime, when browser observation is
  required, how the Web SDK can track server-generated HTML without owning personalization, and what
  a manual client-side tracking implementation must replace.
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md) -
  explains how profile identity, profile data, cookies, browser storage, and Experience API
  responses work together when Node and Web SDK runtimes share a visitor journey.
- [React Native SDK Interaction Tracking Mechanics](./react-native-sdk-interaction-tracking-mechanics.md) -
  explains how the React Native SDK observes, gates, and emits tracking events, covering event
  types, the viewport state machine, default visibility and timing, consent gating, scroll context,
  screen tracking paths, and the configuration resolution order
- [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md) -
  explains how the iOS SDK runs shared optimization behavior through a native bridge, how SwiftUI
  and UIKit integrations share runtime state, and how consent, personalization, tracking, preview
  overrides, and offline delivery work
- [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md) -
  explains how the Android SDK runs shared optimization behavior through QuickJS, how Compose and
  XML Views integrations share runtime state, and how consent, personalization, tracking, preview
  overrides, and offline delivery work
