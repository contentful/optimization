# AGENTS.md

Repository-wide baseline. Child files add local constraints; the nearest child file wins.

## Hierarchy

- Read this file, then each child `AGENTS.md` from the repository root to the edited path.
- Root owns stable repo policy. `packages/AGENTS.md` and `implementations/AGENTS.md` own shared
  package or implementation policy. Deeper files own local boundaries, commands, and gotchas.
- Add a sibling `AGENTS.md` when adding a workspace package or reference implementation.
- Do not repeat parent policy in child files unless the subtree has a real exception.

## Tools and source files

- Use the Node version in [`.nvmrc`](./.nvmrc) and the pnpm version pinned in
  [`package.json`](./package.json).
- Use `pnpm` only; prefer `pnpm <script>` when equivalent. Prefer `rg`/`rg --files` for search.
- Edit source of truth: `src/**`, `e2e/**`, `__tests__/**`, `scripts/**`, `documentation/**`,
  `README.md`, `package.json`, `tsconfig*.json`, `rstest.config.ts`, `playwright.config.mjs`,
  `eslint.config.ts`, `.prettierrc`, and `.github/workflows/**`.
- Treat `dist/**`, `coverage/**`, `docs/**`, `pkgs/**`, `.rslib/**`, `.rsdoctor/**`,
  `node_modules/**`, and local `.env` files as generated or local-only unless the task explicitly
  targets them.
- Start env setup from `.env.example`; do not overwrite an existing `.env` casually.
- Implementations consume local package tarballs from `pkgs/` after `pnpm build:pkgs` plus the
  implementation install step.

## Code discipline

- Treat [`eslint.config.ts`](./eslint.config.ts) as an upfront design constraint.
- Match nearby idioms before adding abstractions. Common repo idioms: `_` for intentional unused
  bindings, named constants for non-obvious magic values, strict typed code, and Prettier-organized
  imports.
- Write new JavaScript/Node tooling as TypeScript whenever the repo toolchain can run it; do not add
  `.js` or `.mjs` scripts when a `.ts` script is practical.
- Make lint fixes AST-local where possible. If a local rewrite keeps failing, inspect the exact rule
  and choose a pattern the repo already uses.
- Never add `eslint-disable`, `eslint-disable-next-line`, or `eslint-disable-line` unless the user
  explicitly asks.
- Do not copy test-only lint relaxations into production code.

## Validation

- Run the smallest meaningful validation for the change. For TypeScript, TSX, JavaScript, package,
  implementation, or shared tooling edits, include lint before claiming validation is complete.
- If no local lint script exists, use the nearest aggregate command: `pnpm lint` for `lib/` or
  `packages/`; `pnpm implementation:lint` for `implementations/`.
- Run Prettier on touched Markdown or expected-format files. Use `git diff --check` only when
  touched files are not fully covered by Prettier or are especially whitespace-sensitive, such as
  shell scripts, Gradle files, patch files, or mixed generated-adjacent text.
- Validate package and implementation changes in dependency order: source package typecheck/tests,
  source package build, `pnpm build:pkgs` when implementations consume it, implementation install,
  then downstream checks.
- For native, React Native, or E2E validation, use the implementation-specific runner documented in
  the nearest `AGENTS.md`, package scripts, or README before deciding the test cannot run locally.
  Missing attached devices, simulators, emulators, mock servers, or Metro are setup states; many
  local runners start or resolve them themselves.
- Do not substitute a generic `test` script for Playwright, Detox, Maestro, or XCUITest E2E. If a
  generic test command fails before reaching the intended E2E runner, classify it as that command's
  failure and try the documented E2E command instead.
- When an upstream package changes, run bundle-size validation for every downstream published
  package that can bundle or re-export it, not only the package edited directly. If the affected
  downstream set is uncertain, run the aggregate `pnpm size:check`.
- Stop downstream validation when an upstream package build fails; stale downstream artifacts are
  not evidence.
- After public exports, entry graphs, shared types, or bundled runtime paths change in an Rslib
  package, run its `clean` script before trusting output. Rslib `clean` scripts must remove
  package-local `./node_modules/.cache/rspack`.
- Broaden checks for exported APIs, shared runtime behavior, generated artifacts, mocks, or behavior
  used by multiple SDKs or implementations.
- If you skip a relevant check, state exactly what was skipped and why.

High-signal commands:

- `pnpm lint`
- `pnpm implementation:lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm build:pkgs`
- `pnpm size:check`
- `pnpm size:report`
- `pnpm format:check`
- `pnpm docs:generate`

Native and E2E examples; narrow with test-file, suite, scheme, or flow arguments when possible:

- React Native Android Detox:
  `pnpm implementation:run -- react-native-sdk test:e2e:android:full -- --test-file <file>`
- Android Maestro Compose:
  `pnpm implementation:run -- android-sdk test:e2e:compose -- --flow <suite>`
- Android Maestro Views: `pnpm implementation:run -- android-sdk test:e2e:views -- --flow <suite>`
- iOS Swift package: `pnpm ios:test`
- iOS XCUITest build: `pnpm implementation:run -- ios-sdk test:e2e:ios:build:release`
- iOS XCUITest run: `IOS_SCHEME=SwiftUI pnpm implementation:run -- ios-sdk test:e2e:ios:run:release`

## Failure handling

- Classify failures before retrying or editing: command/PATH, missing setup, permission/sandbox,
  long-running process, transient external service, stale local state or process conflict, source
  defect, or unknown.
- Retry the same failing command at most once after a targeted fix or probe. For missing commands,
  prefer repo scripts or `pnpm exec`; do not install globals unless asked.
- For missing documented prerequisites, run the prerequisite once, then retry once. Common
  prerequisites include `pnpm install`, `pnpm build:pkgs`, implementation installs, `.env` from
  `.env.example`, and implementation-specific setup.
- For native and React Native E2E, a failed preflight or absent device is not enough to say local
  testing is impossible. Run the local runner that performs setup, or report the exact missing
  prerequisite and the command that exposed it.
- For permission, sandbox, or network-blocking symptoms, request escalation on the next attempt
  instead of working around the sandbox.
- Treat expected servers, watchers, mock servers, preview servers, emulators, and similar commands
  as long-running; poll or inspect logs instead of restarting them.
- For stale state, clean only the artifacts or processes created by the failed flow. Do not delete
  local `.env` files, ignored outputs, or broad process groups.
- Own validation failures surfaced by current or recent Codex work. Inspect status, diffs,
  APIs/artifacts, and skipped checks; then fix the root cause in the right layer or report a
  concrete blocker.
- If a downstream implementation reports stale SDK types or runtime behavior, verify upstream build,
  `pnpm build:pkgs`, and implementation install before adding local shims or casts.
- If Rslib/Rspack reports an internal dependency-graph panic, classify stale persistent cache first:
  run the affected package `clean` script once, confirm it removes `node_modules/.cache/rspack`,
  then retry the build once.
- After two failed attempts with the same strategy, stop and report the command, failure class,
  relevant stderr, what was tried, and the smallest next action.

## Bundle size

- Before bundle-size investigation or changes, inspect `git status --short` and run the relevant
  `size:check` or `size:report` against the actual worktree.
- For upstream package changes, treat downstream bundle-size checks as required validation. Run the
  smallest complete downstream set when it is clear, or `pnpm size:check` when the dependency impact
  crosses package families or is uncertain.
- On failure, report the command, package or bundle, budget, actual size, and delta.
- Do not change budgets, bundle entries, aliases, chunks, exports, or source shape solely for bundle
  size unless the user approves that work.
- Unapplied proposals must be labeled `UNAPPLIED PROPOSAL`, printed in chat, and not written into
  the project tree.
- After approved bundle-size source changes, validate the touched package with typecheck, relevant
  tests, build when emitted output/declarations are affected, and `size:check`.

## Docs and README

- Follow [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for human-authored prose. Authored docs live in
  `documentation/`; generated TypeDoc output lives in `docs/`.
- Preserve existing README families: repo/package/reference implementation headers, navigation, and
  pre-release warnings; documentation indexes; short status READMEs for placeholders or
  internal-only surfaces.
- Use sentence-case Markdown headings, official product/API casing, fenced code blocks with language
  tags, and `pnpm` commands.
- Keep package READMEs orientation-first, implementation READMEs procedural, and lower-level package
  READMEs maintainer-oriented. Generated docs own exhaustive signatures and exported type detail.
- Move deep implementation guidance into `documentation/guides/` when an existing guide fits; create
  a new guide only for a distinct reader goal.
- Account for every README render target before changing links: GitHub, TypeDoc project docs, and
  npm package README rendering.
- Preserve `<!-- mtoc-start -->` and `<!-- mtoc-end -->` markers and keep TOCs synchronized.

## Safety and resume

- Never overwrite or delete ignored local files just to get a clean run.
- Do not run destructive Contentful scripts unless explicitly asked.
- Do not use broad cleanup commands such as `pm2 delete all` unless explicitly asked.
- Do not manually terminate processes without explicit user permission in the current turn. This
  includes `kill`, `pkill`, `killall`, `xargs kill`, emulator termination, container termination,
  and similar process-stop commands. If a validation, server, installer, emulator, or watcher is
  running and the user says to skip, pause, or change direction, ask whether to let it finish or
  terminate it; do not infer termination permission.
- Repository scripts may clean up their own child processes only as part of the documented command
  the user asked to run. Do not replace that with manual process termination unless the user
  explicitly approves it.
- Do not assume full cross-platform E2E is required for every change.
- After compaction, interruption, or a long-running resume, reread the latest user request, inspect
  `git status` and relevant diffs, then continue only with the current request.

## Preferred workflow

1. Read the applicable `AGENTS.md` chain.
2. Make the narrowest source-of-truth change in the correct layer.
3. Run the smallest meaningful validation.
4. Broaden validation only when shared behavior, exports, generated artifacts, mocks, or downstream
   consumers are affected.
5. Summarize changes, validation, skipped checks, and residual risk.
