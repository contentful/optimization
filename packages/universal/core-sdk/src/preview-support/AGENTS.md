# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, `packages/universal/AGENTS.md`, and
`packages/universal/core-sdk/AGENTS.md` before this file.

## Scope

This subtree owns the cross-platform preview-panel support toolkit: override management,
preview-model building, Contentful entry mapping, fetch helpers, signals, and the dedicated
`./preview-support` entry point.

## Local rules

- Contentful content-model knowledge (`nt_audience`, `nt_experience`, `nt_config`, ...) belongs
  here. Keep the rest of `core-sdk` platform-agnostic and free of Contentful schema knowledge.
- Keep public preview-support APIs stable for the React Native SDK re-export and the iOS JSC bridge.
- Keep override behavior aligned with preview-panel scenario contracts and platform wrapper
  expectations.

## Usually validate

- Run `@contentful/optimization-core` unit tests for preview-support changes.
- Re-validate React Native SDK preview behavior and the iOS JSC bridge when changing public
  preview-support behavior, exported types, or override semantics.
