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
  - ./optimization-handoff-and-cache-safe-rendering.md
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
- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  explains how the SDK resolves a manual `baselineEntry` or SDK-managed Contentful fetch with
  `contentful: { client }` to the selected entry variant, including single-locale CDA shape
  expectations, fallback behavior, framework `entryId` paths, and preview overrides.
- [Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md) -
  explains how application-owned Contentful locales differ from SDK Experience/event locales.
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md) - explains how
  `@contentful/optimization-web` detects browser entry views, clicks, and hovers; how
  `@contentful/optimization-react-web` renders tracking metadata, exposes Web SDK behavior, and
  provides router/page helpers; and how Custom Flag views, page events, and application-provided
  custom events move through consent, profile, DOM, and delivery mechanics.
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md) -
  explains what the Node SDK can track from a stateless server runtime, when browser observation is
  required, how the Web SDK can track server-generated HTML without owning optimization, and what a
  manual client-side tracking implementation must replace.
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md) -
  explains how profile identity, profile data, cookies, browser storage, and Experience API
  responses work together when Node and Web SDK runtimes share a visitor journey.
- [Optimization handoff and cache-safe rendering](./optimization-handoff-and-cache-safe-rendering.md) -
  explains how server, static, ISR, and edge-rendered Optimization state reaches the browser, how
  cache scopes work, and why request profile state must not enter public caches.
- [React Native SDK interaction tracking mechanics](./react-native-sdk-interaction-tracking-mechanics.md) -
  explains how the React Native SDK observes, gates, and emits tracking events, covering event
  types, the viewport state machine, default visibility and timing, consent gating, scroll context,
  screen tracking paths, manual tracking payloads, and the configuration resolution order.
- [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md) -
  explains how the iOS SDK runs shared optimization behavior through a native bridge, how SwiftUI
  and UIKit integrations share runtime state, and how consent, optimization, tracking, preview
  overrides, and offline delivery work
- [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md) -
  explains how the Android SDK runs shared optimization behavior through QuickJS, how Compose and
  XML Views integrations share runtime state, and how consent, optimization, tracking, preview
  overrides, and offline delivery work
