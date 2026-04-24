# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns the cross-platform preview-panel toolkit: override management, preview-model
building, and Contentful entry mapping. It is consumed by platform-specific preview surfaces (React
Native hooks, the iOS JS bridge, and eventually the web preview panel UI).

## Key Paths

- `src/PreviewOverrideManager.ts` — state-interceptor-based override manager
- `src/buildPreviewModel.ts` — audience/experience DTO builder
- `src/entryMappers.ts`, `src/contentfulFetch.ts` — Contentful schema → definitions
- `src/index.ts` — public surface

## Local Rules

- Keep this package platform-agnostic. No browser, Node, or React Native assumptions.
- Depend on `@contentful/optimization-api-client` for shared types and the logger, not on
  `@contentful/optimization-core`. The relationship is one-way: preview consumes core types via
  structural interfaces (`StateInterceptorRegistry`) where possible, not via a runtime dependency on
  the core package.
- Contentful content-model knowledge (`nt_audience`, `nt_experience`, `nt_config`, …) lives here,
  not in core.

## Commands

- `pnpm --filter @contentful/optimization-preview typecheck`
- `pnpm --filter @contentful/optimization-preview test:unit`
- `pnpm --filter @contentful/optimization-preview build`
- `pnpm --filter @contentful/optimization-preview size:check`

## Usually Validate

- Run `typecheck`, `test:unit`, and `build`.
- When changing the public surface or override semantics, re-validate the iOS JSC bridge
  (`packages/ios/ios-jsc-bridge`) and the React Native SDK (`packages/react-native-sdk`).
