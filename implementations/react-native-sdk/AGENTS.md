# AGENTS.md

React Native reference implementation for `@contentful/optimization-react-native`.

## Rules

- Keep reusable SDK behavior in `packages/react-native-sdk`.
- React Native plus Detox flows are heavier than the web and Node implementations.
- Prefer the one-shot Android Detox runner for local E2E. It creates `.env` from `.env.example`,
  starts mocks and Metro, builds through Detox, runs tests, writes logs, and cleans up its own child
  processes.
- A missing `adb devices` entry before the Detox runner starts is not proof that RN E2E cannot run
  on this machine; Detox can launch the configured emulator during the test run. Report the runner's
  actual failure if setup does not complete.
- For Metro port `8081` conflicts, use `pnpm implementation:run -- react-native-sdk start:clean` or
  stop only the conflicting local process.

## Commands

- Install local package tarballs after package changes:
  `pnpm implementation:run -- react-native-sdk implementation:install`
- Typecheck: `pnpm implementation:run -- react-native-sdk typecheck`
- Lint: `pnpm implementation:run -- react-native-sdk lint`
- Full local Android Detox flow: `pnpm implementation:run -- react-native-sdk test:e2e:android:full`
- Target one Android Detox file:
  `pnpm implementation:run -- react-native-sdk test:e2e:android:full -- --test-file e2e/<file>.test.js`
- Target one Android Detox test name:
  `pnpm implementation:run -- react-native-sdk test:e2e:android:full -- -t "<name pattern>"`
- Build/run split when reusing artifacts:
  `pnpm implementation:run -- react-native-sdk test:e2e:android:build` then
  `pnpm implementation:run -- react-native-sdk test:e2e:android:run -- e2e/<file>.test.js`
- `test` is plain Jest for app-level tests, not the Detox E2E path. If it fails in setup before
  reaching app assertions, do not use that result to claim RN E2E cannot run locally.

## Validate

- Run `typecheck` for local changes.
- Run `test` only for relevant app-level Jest changes after confirming the Jest setup is the target.
- Run Android Detox for runtime tracking, offline behavior, navigation, or end-to-end UX changes.
