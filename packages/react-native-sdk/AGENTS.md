# AGENTS.md

Owns the React Native SDK and package-local development harness.

## Rules

- Keep reusable React Native SDK logic here, not in `implementations/react-native-sdk`.
- `dev/` is a maintained harness, not the published SDK surface.
- Keep `dev/` current for SDK behavior, initialization, preview behavior, navigation behavior,
  configuration, and developer-facing flows.
- Preserve optional peer dependency behavior unless the task explicitly changes it.

## Commands

- `pnpm --filter @contentful/optimization-react-native <script>` with `typecheck`, `test:unit`,
  `build`, `size:check`, `size:report`, `dev:test`, `dev:start`, `dev:android`, or `dev:ios`.
- Downstream Android Detox after SDK runtime changes: `pnpm build:pkgs`, then
  `pnpm implementation:run -- react-native-sdk implementation:install`, then
  `pnpm implementation:run -- react-native-sdk test:e2e:android:full -- --test-file <file>`.
- The React Native implementation's `test` script is not an E2E substitute; use
  `test:e2e:android:full` for local Detox validation.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
- Run `dev:test` for harness behavior changes.
- Validate `dev/` or `implementations/react-native-sdk` when SDK flows, runtime tracking, storage,
  navigation, offline behavior, or preview behavior changes.
