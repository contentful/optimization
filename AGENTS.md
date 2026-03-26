# AGENTS.md

This file defines repository-wide rules only. For any change, read this file first, then read the
nearest `AGENTS.md` in the subtree you are editing.

## Hierarchy

- The root `AGENTS.md` owns stable repo-wide policy.
- `lib/*/AGENTS.md`, `packages/**/AGENTS.md`, and `implementations/*/AGENTS.md` own local
  instructions, commands, and gotchas.
- If local guidance conflicts with this file, follow the more specific `AGENTS.md` for that subtree.
- When adding a new workspace package or implementation, add a sibling `AGENTS.md` in the same
  change.
- Keep child `AGENTS.md` files focused on local behavior. Do not duplicate root policy unless the
  subtree has a local exception.

## Environment And Tooling

- Use the Node version from [`.nvmrc`](./.nvmrc) when possible. Repository engine constraints live
  in the root [`package.json`](./package.json).
- Use `pnpm` only. The pinned package-manager version lives in the root
  [`package.json`](./package.json).
- Prefer `pnpm <script>` over `pnpm run <script>` when both forms are equivalent.
- Prefer `rg` and `rg --files` for code search.
- `.env` files are ignored. Start from the checked-in `.env.example` where applicable, and do not
  overwrite an existing `.env` without a clear reason.
- Some implementations have additional runtime prerequisites or process-management expectations. See
  the relevant implementation `AGENTS.md` before running local app or E2E flows.

## Repository Layout

- Shared libraries and published SDK packages live under `lib/` and `packages/`.
- Reference implementations live under `implementations/`.
- Implementations consume local package tarballs from `pkgs/` after `pnpm build:pkgs` and
  implementation install steps.
- Generated outputs such as `dist/`, `coverage/`, `docs/`, `pkgs/`, `playwright-report/`, and
  `test-results/` are not the source of truth.

## Source Of Truth

Prefer editing source files and configuration:

- `src/**`
- `e2e/**`
- `__tests__/**`
- `scripts/**`
- `README.md`
- `package.json`
- `tsconfig*.json`
- `rstest.config.ts`
- `playwright.config.mjs`
- `eslint.config.ts`
- `.prettierrc`
- `.github/workflows/**`

Do not hand-edit generated or local-only artifacts unless the task is explicitly about them:

- `dist/**`
- `coverage/**`
- `docs/**`
- `pkgs/**`
- `.rslib/**`
- `.rsdoctor/**`
- `node_modules/**`
- local `.env` files

## ESLint Discipline

- Treat [`eslint.config.ts`](./eslint.config.ts) as an upfront design constraint, not a cleanup step
  after coding.
- Before editing TypeScript or TSX in an unfamiliar area, skim
  [`eslint.config.ts`](./eslint.config.ts) and nearby files to match existing idioms.
- Prefer code that naturally satisfies the rules over later suppression or churn.
- For isolated lint findings, start with the smallest AST-local fix possible. Prefer changing the
  flagged expression, declaration, or statement before considering any surrounding refactor.
- If the first local rewrite fails, inspect the exact rule configuration and error location before
  trying broader changes.
- Do not broaden a one-line lint fix into helper rewrites, data-flow changes, or nearby refactors
  unless the minimal local options are exhausted and there is a clear semantic reason to do so.
- Match existing local patterns before introducing new ones. In this repo, that usually means:
  - prefix intentionally unused variables, parameters, caught errors, and array slots with `_`
  - avoid introducing unexplained magic numbers in production code; extract named constants when the
    value is not obviously one of the common allowed literals
  - keep strict typed-code hygiene and avoid broad `any`-style shortcuts
  - rely on Prettier and `prettier-plugin-organize-imports` for formatting and import order rather
    than manual styling
- Never add `eslint-disable`, `eslint-disable-next-line`, or `eslint-disable-line` comments unless
  the user explicitly instructs you to do so.
- If a lint fix stops being small and local, stop and reassess instead of escalating into trial-and-
  error rewrites.
- Do not copy test-only patterns into production code. Test and E2E files have targeted rule
  relaxations that do not apply elsewhere.
- If code keeps fighting the linter, stop and rewrite the approach to match repository patterns
  rather than stacking fixes.

## Validation Policy

- Run the smallest meaningful validation that matches the change.
- For TypeScript or TSX edits, run the relevant lint command early enough to influence the shape of
  the implementation, not only at the end.
- For `lib/` or `packages/` edits, prefer `pnpm lint` after the first meaningful patch and again
  before finishing if the change grew.
- For `implementations/` edits, prefer `pnpm implementation:lint` after the first meaningful patch
  and again before finishing if the change grew.
- For a single workspace package, prefer targeted `typecheck`, `test:unit`, and `build`.
- For built workspace packages, run the package `size:check` script when runtime code, published
  dependencies, bundler config, exports, or bundle shape changes.
- For cross-cutting changes, broaden validation to affected downstream packages or implementations.
- For package changes used by implementations, run `pnpm build:pkgs` before reinstalling or running
  implementation tests.
- For implementation-only changes, use `pnpm implementation:lint`, targeted implementation
  `typecheck`, and targeted E2E as needed.
- If you skip a relevant check because of time or environment constraints, say exactly what was not
  run and why.

High-signal repo-wide commands:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm size:check`
- `pnpm build:pkgs`
- `pnpm format:check`
- `pnpm docs:generate`

## Failure Handling And Recovery

- Do not rerun the same failing command unchanged more than once.
- Before retrying, classify the failure into one of these buckets:
  - command resolution or PATH
  - missing prerequisite or setup
  - permission or sandbox
  - expected long-running process
  - transient network or external-service failure
  - stale local state, artifact, or process conflict
  - unknown
- Prefer a small probe before a full rerun. Check the nearest `AGENTS.md`, the target
  `package.json`, and any relevant `README.md` or `CONTRIBUTING.md` section before guessing.
- If the shell reports a command as missing:
  - first prefer `pnpm <script>` or `pnpm exec <tool>` over assuming a global binary
  - check whether the command is defined in the relevant `package.json`
  - do not install new global tools to work around a missing PATH entry unless the user explicitly
    asked for that setup
  - if the tool is absent and not documented as a prerequisite, stop and report instead of
    improvising
- If a documented prerequisite is missing, run that prerequisite once, then retry the original
  command once. Common repository prerequisites include:
  - `pnpm install`
  - `pnpm build:pkgs`
  - `pnpm implementation:install`
  - a local `.env` copied from `.env.example`
  - implementation-specific setup documented in the nearest child `AGENTS.md`
- If the error suggests a permissions or sandbox problem, such as `EACCES`, `EPERM`, network
  blocking, or write denial, do not keep retrying. Request approval or escalation on the next
  attempt rather than searching for workarounds.
- If a command is supposed to stay alive, such as a dev server, watcher, mock server, preview
  server, or emulator tooling, treat continued execution as expected behavior. Poll or inspect logs
  instead of restarting it repeatedly.
- If a failure looks transient, such as a registry timeout or flaky external network call, retry at
  most once. If it fails again, stop and report the blocker.
- Before cleanup, decide whether the issue is stale state. Prefer targeted cleanup of only the
  artifacts or processes created by the failed flow. Do not delete unrelated outputs, local `.env`
  files, or use broad cleanup such as `pm2 delete all`.
- After two failed attempts with the same strategy, stop and summarize:
  - the exact command
  - the failure class
  - the relevant stderr or symptom
  - what you already tried
  - the smallest next action, user input, or approval needed

Common repo-specific failure modes:

- An implementation does not reflect a package change: run `pnpm build:pkgs`, then rerun the
  relevant `pnpm implementation:run -- <implementation> implementation:install`.
- If the goal is E2E setup rather than the narrowest possible refresh step, prefer the combined root
  wrapper `pnpm setup:e2e:<implementation>`. For a full E2E run, prefer
  `pnpm test:e2e:<implementation>`.
- Implementation-specific runtime failures such as Docker availability, Playwright browser setup,
  emulator requirements, `.env` drift, PM2 state, and local port conflicts belong in the relevant
  implementation `AGENTS.md`, not here.

## Docs, Specs, And CI

- When public SDK behavior changes, update the relevant TSDoc or JSDoc and the affected package
  `README.md` in the same change.
- If a package includes a package-local dev harness or other meaningful local dev surface, keep that
  surface relevant to the current SDK behavior and update it in the same change when the package's
  developer-facing flows, configuration, or core capabilities change.
- If the repository later adds any replacement design, architecture, or specification artifacts for
  the changed area, keep them aligned in the same change.
- `docs/` is generated by TypeDoc and is gitignored.
- Implementation E2E in `.github/workflows/main-pipeline.yaml` is intentionally path-filtered. If a
  change should alter E2E coverage, update the workflow and keep it aligned with
  [CONTRIBUTING.md](./CONTRIBUTING.md).

## Safety Rules

- Never overwrite or delete ignored local files just to get a clean run.
- Do not run destructive Contentful scripts unless explicitly asked.
- Do not use broad cleanup commands such as `pm2 delete all` unless explicitly asked.
- Do not assume full cross-platform E2E is required for every change.

## Preferred Workflow

1. Read the root `AGENTS.md`.
2. Read the nearest `AGENTS.md` in the subtree you will edit.
3. Make the narrowest source-of-truth change in the correct layer.
4. Run the smallest meaningful validation set.
5. Broaden validation only when exports, build tooling, mocks, or shared behavior changed.
6. Summarize what changed, what was verified, what was skipped, and any follow-up risk.
