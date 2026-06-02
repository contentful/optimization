# AGENTS.md

Owns cross-platform preview-panel support: override management, preview models, Contentful entry
mapping, fetch helpers, signals, and the `./preview-support` entry point.

## Rules

- Contentful content-model knowledge (`nt_audience`, `nt_experience`, `nt_config`, ...) belongs
  here; keep the rest of `core-sdk` free of schema knowledge.
- Keep public APIs stable for the React Native SDK re-export and the iOS JSC bridge.
- Keep override behavior aligned with preview-panel scenario contracts and platform wrappers.

## Validate

- Run `@contentful/optimization-core` unit tests for preview-support changes.
- Revalidate React Native preview behavior and the iOS JSC bridge for public API, exported type, or
  override-semantic changes.
