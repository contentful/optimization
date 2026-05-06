---
title: Concepts
children:
  - ./core-state-management.md
  - ./entry-personalization-and-variant-resolution.md
  - ./profile-synchronization-between-client-and-server.md
  - ./react-native-sdk-interaction-tracking-mechanics.md
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
- [Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  explains how the SDK resolves a Contentful baseline entry to the selected entry variant, including
  data model expectations, fallback behavior, resolution paths, and preview overrides.
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md) -
  explains how profile identity, profile data, cookies, browser storage, and Experience API
  responses work together when Node and Web SDK runtimes share a visitor journey.
- [React Native SDK Interaction Tracking Mechanics](./react-native-sdk-interaction-tracking-mechanics.md) -
  explains how the React Native SDK observes, gates, and emits tracking events, covering event
  types, the viewport state machine, default thresholds, consent gating, scroll context, screen
  tracking paths, and the configuration resolution order
