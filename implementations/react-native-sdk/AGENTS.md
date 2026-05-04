# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This is the React Native reference implementation for `@contentful/optimization-react-native`.

## Key Paths

- `components/`
- `screens/`
- `sections/`
- `utils/`
- `e2e/`
- `scripts/`
- `.env.example`

## Local Rules

- Keep this app focused on demonstrating SDK usage. Reusable SDK behavior belongs in
  `packages/react-native-sdk`.
- This implementation is heavier to run than the web and Node implementations because it uses React
  Native tooling plus Detox.
- Ensure an Android emulator is running before Android Detox flows.

## Common Failure Modes

- Detox cannot launch or attach to a device: confirm an Android emulator is already running before
  retrying.
- Metro or React Native tooling reports a port `8081` conflict: use
  `pnpm implementation:run -- react-native-sdk start:clean` or otherwise stop only the conflicting
  local process.

## Commands

- `pnpm implementation:run -- react-native-sdk implementation:install`
- `pnpm implementation:run -- react-native-sdk typecheck`
- `pnpm implementation:run -- react-native-sdk test`
- `pnpm implementation:run -- react-native-sdk test:e2e:android:build`
- `pnpm implementation:run -- react-native-sdk test:e2e:android:run`
- `pnpm implementation:run -- react-native-sdk test:e2e:android:full`

## Usually Validate

- Run `typecheck` for local changes.
- Run `test` for app-level Jest changes when they are relevant.
- Run Android Detox for runtime tracking, offline behavior, navigation, or end-to-end UX changes.
