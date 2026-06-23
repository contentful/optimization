# AGENTS.md

Owns cross-platform preview-panel support: override management, preview models, Contentful entry
mapping, fetch helpers, signals, and the `./preview-support` entry point.

## Rules

- Preview-specific Contentful authoring-model fetch and mapping (`nt_audience`, `nt_experience`,
  preview model construction) belongs here. Runtime optimized-entry contract handling may still live
  in core resolvers or schemas outside `preview-support`.
- Keep public APIs stable for the React Native SDK re-export and the iOS JSC bridge.
- Keep override behavior aligned with preview-panel scenario contracts and platform wrappers.

## Validate

- Run `@contentful/optimization-core` unit tests for preview-support changes.
- Revalidate React Native preview behavior and the iOS JSC bridge for public API, exported type, or
  override-semantic changes.
