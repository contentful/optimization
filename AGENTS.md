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
  [`package.json`](./package.json). `.nvmrc` is the runtime source of truth; `nodeVersion` in
  [`pnpm-workspace.yaml`](./pnpm-workspace.yaml) mirrors it for pnpm engine checks.
- Do not add `useNodeVersion` or `devEngines.runtime` unless the repository intentionally changes
  Node runtime management away from the current NVM-based workflow.
- When `.nvmrc` and `nodeVersion` drift, suggest updating `nodeVersion`. Whenever `pnpm-lock.yaml`
  changes, verify `.nvmrc` and `nodeVersion` still match.
- Use `pnpm` only; prefer `pnpm <script>` when equivalent. Prefer `rg`/`rg --files` for search.
- Never write absolute filesystem paths into Git-tracked documentation or agent instructions. Use
  paths relative to the repository root, or workspace-relative paths when referring to another
  checkout. Platform-required runtime paths belong only in executable configuration or scripts.
- Edit source of truth for normal source, docs, config, and test changes: `src/**`, `e2e/**`,
  `__tests__/**`, `scripts/**`, `documentation/**`, `README.md`, `package.json`, `tsconfig*.json`,
  `rstest.config.ts`, `playwright.config.mjs`, `eslint.config.ts`, `.prettierrc`, and
  `.github/workflows/**`.
- Bundle-size budget values inside `package.json` are release policy, not ordinary source config.
  The `Bundle size` policy controls whether they may be changed.
- Treat `dist/**`, `coverage/**`, `docs/**`, `pkgs/**`, `.rslib/**`, `.rsdoctor/**`,
  `node_modules/**`, and local `.env` files as generated or local-only unless the task explicitly
  targets them.
- Never manually edit generated external API mock or MSW data. Change the external source or the
  documented generator, then regenerate the output.
- Never add synthetic scenarios to generated external API mock or MSW data. Put a narrowly scoped
  scenario in the consuming test's owned fixture or handler when that test can own it honestly; if
  an integration requires external generated data that does not exist, stop and report the missing
  source scenario instead of fabricating it in generated output.
- Start env setup from `.env.example`; do not overwrite an existing `.env` casually.
- Implementations consume local package tarballs from `pkgs/` after `pnpm build:pkgs` plus the
  implementation install step.

## Reference implementations

- Treat `implementations/**` as first-class product artifacts: maintained SDK integration contracts,
  customer-facing evidence, and required validation targets for the SDK surfaces they exercise.
- Treat broken, stale, incomplete, or needlessly reduced reference implementations as SDK-suite
  quality issues unless evidence shows the affected behavior is no longer supported.
- Do not treat reference implementations as optional demos, disposable samples, or places to reduce
  behavior for convenience. When public SDK behavior changes, identify affected reference
  implementations before concluding validation.

## Pull request planning and pragmatic review

- Define a pull request boundary as one independently mergeable, repository-consistent state that
  passes every CI job triggered by its changed paths. An architecture phase, package boundary, or
  ownership boundary is not automatically a valid pull request boundary.
- Before proposing or delegating a multi-PR plan, inspect
  `.github/workflows/main-pipeline.yaml`, especially its path filters and job prerequisites. Produce
  a CI-impact matrix mapping each PR's changed paths to triggered jobs, downstream packages and
  maintained implementations, source/docs/test updates, and validation commands.
- Every intermediate PR must be CI green, mergeable, independently publishable, and useful if a
  later planned PR never ships. A stacked PR may depend on an already merged and publishable
  predecessor, but it must not depend on an unmerged sibling or atomic multi-PR release.
- When a package API, export graph, shared runtime contract, or user-visible behavior changes,
  include every required downstream update in the same PR: adapters and pass-throughs, maintained
  reference implementations, package and implementation READMEs, SDK knowledge or guides, shared
  fixtures, focused tests, and relevant E2E specifications.
- A valid PR may span packages, platforms, documentation areas, and implementations when they form
  the smallest vertical slice that leaves the repository consistent and CI green. Do not add a
  compatibility shim merely to make an incomplete slice pass.
- Split work only when the earlier PR remains complete and green without the later PR. Do not put
  required downstream documentation or reference-consumer repairs into a follow-up.
- Repository CI builds all packages, enforces bundle sizes, packs local SDK tarballs, installs and
  lints maintained implementations for package/source changes, validates SDK knowledge and guides
  for package source, and runs path-filtered Web/native E2E for affected implementation families.
  Plan local validation and PR scope against those actual jobs rather than package ownership alone.
- For every plan file intended to represent one PR, state prerequisites, complete
  cross-repository scope, changed public contracts, affected maintained implementations,
  documentation/knowledge updates, triggered CI jobs, dependency-ordered local validation, and an
  exit criterion that the PR can merge without an unmerged follow-up.
- Keep implementation and review within the stated commit/PR purpose and acceptance criteria.
  Review the diff that exists, not a larger product or architecture that could also be built.
- Do not require additional scope, a different design, generalized machinery, or a major refactor
  unless a concrete supported failure in the current diff cannot be addressed locally.
- Respect explicit, documented trade-offs. A blocking finding must identify the in-scope behavior
  that fails, the relevant source or test evidence, and why the accepted trade-off does not cover
  it. Label worthwhile out-of-purpose ideas as non-blocking follow-ups.
- If the PR cannot be green and independently publishable within its purpose, stop and rescope it
  instead of borrowing code, tests, or cleanup from a future PR.

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
- Maintained E2E coverage may be incomplete for a focused behavior. After running the documented
  relevant runner and only the prerequisites the agent is authorized to execute, focused unit tests
  plus a documented logical inference are acceptable when no maintained E2E scenario exercises the
  behavior or the runner is unavailable for a concrete environment reason.
- The inference must name the missing E2E scenario, the attempted command or absence of a maintained
  runner, the focused passing evidence, the source path that connects that evidence to the supported
  behavior, and the remaining uncertainty. Never report E2E as passed when it did not run.
- This inference rule never waives a task or PR plan that explicitly names an E2E runner as a
  release gate. If that required runner is unavailable or cannot pass because its required
  environment is unavailable, report the exact command and setup state as a blocker; unit evidence
  and inference may explain confidence but cannot satisfy the gate.
- When setup or provisioning is explicitly owned by the user or CI, do not invoke it automatically.
  Run the normal E2E runner only after that setup is confirmed; if it is not ready, report the
  missing prerequisite and required runner as blocked.
- Do not broaden product scope, add synthetic generated mock/MSW scenarios, or create mock-owned
  tests merely to manufacture E2E coverage. Reviewers should accept proportionate unit evidence and
  a sound inference only when no explicit release gate requires the missing runner and they cannot
  identify a concrete unsupported integration failure.
- If no local lint script exists, use the nearest aggregate command: `pnpm lint` for `lib/` or
  `packages/`; `pnpm implementation:lint` for `implementations/`.
- Prefer `pnpm format:fix` from the repository root for Prettier-covered files. Run it before manual
  formatting changes and before final format validation.
- Do not manually edit whitespace, wrapping, quote style, import ordering, or Markdown formatting
  that Prettier can produce. If formatting is the only issue, let Prettier fix it.
- Use targeted Prettier only when repo-wide formatting is blocked or would modify unrelated dirty
  worktree changes; report that fallback.
- Use `git diff --check` only for files not covered by Prettier or especially whitespace-sensitive
  files such as shell scripts, Gradle files, patch files, or mixed generated-adjacent text.
- Validate package and implementation changes in dependency order: source package typecheck/tests,
  source package build, `pnpm build:pkgs` when implementations consume it, implementation install,
  then downstream checks.
- Treat package build outputs as shared mutable state across all SDKs. Never manually run `build`,
  `clean`, `build:pkgs`, implementation install, `size:report`, `size:check`, or any command that
  reads, writes, removes, or packages generated artifacts in parallel with another package command
  that can touch the same package or an upstream/downstream package in its dependency graph.
- `size:report` and `size:check` read generated package output and may depend on emitted chunks from
  upstream packages. Serialize them with any build, clean, package, or size command for the package
  being measured and every upstream or downstream SDK that can consume its output.
- Do not manually parallelize validation for packages with dependency edges between them. Prefer the
  aggregate workspace command, such as `pnpm build`, `pnpm build:pkgs`, or `pnpm size:check`, when
  the full graph is involved because pnpm can schedule workspace dependencies. When running narrowed
  package commands yourself, run each dependency level to completion before starting dependents.
- Manual parallel commands are only appropriate for read-only inspection or checks that are
  demonstrably independent and do not clean, rebuild, package, install, or measure generated package
  artifacts.
- For native, React Native, or E2E validation, use the implementation-specific runner documented in
  the nearest `AGENTS.md`, package scripts, or README before deciding the test cannot run locally.
  Missing attached devices, simulators, emulators, mock servers, or Metro are setup states; many
  local runners start or resolve them themselves.
- Do not substitute a generic `test` script for Playwright, Detox, Maestro, or XCUITest E2E. If a
  generic test command fails before reaching the intended E2E runner, classify it as that command's
  failure and try the documented E2E command instead.
- When an upstream package changes, validate every downstream published package that can bundle or
  re-export it. If the downstream set is uncertain, run a full aggregate `pnpm build`, then
  aggregate `pnpm size:report`. Aggregate `pnpm size:check` can exit on the first budget failure, so
  it is enforcement—not evidence that every later package budget was evaluated.
- Stop downstream validation only when an upstream package build fails. A budget failure after a
  successful build must not stop report-only measurement of the remaining affected packages.
- After public exports, entry graphs, shared types, or bundled runtime paths change in an Rslib
  package, run its `clean` script before trusting output. Rslib `clean` scripts must remove
  package-local `./node_modules/.cache/rspack`.
- Broaden checks for exported APIs, shared runtime behavior, generated artifacts, or behavior used
  by multiple SDKs or implementations.
- If you skip a relevant check, state exactly what was skipped and why.

### Mocks validation exception

This exception overrides every general validation instruction in this repository:

- Mocks are unpublished internal test infrastructure, not independent validation targets.
- Never add, run, require, or cite tests whose subject is mock behavior as validation evidence. This
  includes mock-owned unit tests and mock-specific E2E tests.
- Validate a mock change only incidentally through the narrowest consuming package or reference
  implementation test that specifically relies on it. Successful consumer use is sufficient.
- A mock change alone never justifies broader validation. If no consumer needs the behavior, do not
  add it.

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
- Android SDK unit tests: `pnpm android:test`
- iOS Swift package: `pnpm ios:test`
- iOS XCUITest build: `pnpm implementation:run -- ios-sdk test:e2e:ios:build:release`
- iOS XCUITest run: `IOS_SCHEME=SwiftUI pnpm implementation:run -- ios-sdk test:e2e:ios:run:release`
- Web Playwright: `pnpm test:e2e:<implementation> <file-or-filter>`; omit the file/filter only when
  the full suite is warranted. These specific root scripts are setup-free. If consumed SDK
  packages changed, first run `pnpm build:pkgs` once and
  `pnpm implementation:<implementation> implementation:install`; skip that refresh when installed
  dependencies are already current.

For routine local Web Playwright validation, do not run root `pnpm setup:e2e`,
`pnpm setup:e2e:<implementation>`, or aggregate `pnpm test:e2e` automatically. Setup commands
install dependencies or browser prerequisites and remain explicit user/CI-owned operations. Use a
setup or Playwright install command only when its prerequisite is confirmed missing or the user
explicitly requests it.

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
  concrete blocker. Bundle-size failures follow the `Bundle size` policy before source edits.
- If a downstream implementation reports stale SDK types or runtime behavior, verify upstream build,
  `pnpm build:pkgs`, and implementation install before adding local shims or casts.
- If Rslib/Rspack reports an internal dependency-graph panic, classify stale persistent cache first:
  run the affected package `clean` script once, confirm it removes `node_modules/.cache/rspack`,
  then retry the build once.
- After two failed attempts with the same strategy, stop and report the command, failure class,
  relevant stderr, what was tried, and the smallest next action.

## Bundle size

- Before bundle-size investigation or changes, inspect `git status --short`. Build the complete
  affected graph first, then run aggregate `pnpm size:report` when a shared or upstream change can
  affect multiple published packages. Use `size:check` after classification, safe remediation, or
  an approved budget change to enforce the resulting budgets; never use its first failure as the
  complete downstream size inventory.
- Treat bundle-size checks as validation evidence. A budget failure is not approval to rewrite
  source code, remove behavior, or change budget policy.
- Classify a budget failure before editing as a current-change regression, pre-existing budget
  drift, build or measurement issue, dependency/import mistake, intentional feature cost, or
  unknown.
- Use `size:report`, generated analyzer output, or the package's existing build artifacts to
  identify concrete contributors before changing code. Do not guess at size causes.
- For upstream package changes, treat downstream bundle-size validation as required. Run the
  smallest complete downstream report and enforcement set when it is clear. When the dependency
  impact crosses package families or is uncertain, use aggregate `pnpm size:report` for the complete
  inventory, then `pnpm size:check` after classification.
- On failure, report the command, package or bundle, budget, actual size, and delta.
- Allowed remediation is limited to confirmed current-change regressions, dependency/import
  mistakes, and measurement issues. Every remediation must preserve maintainability: do not make
  code harder to read, type, test, debug, or change just to reduce bytes. Prefer fixes such as
  removing unused imports or dependencies, fixing accidental heavy import paths, restoring
  tree-shaking, reusing existing helpers instead of duplicating code, or correcting build
  measurement.
- Re-examine the design once when a bundle-size failure is caused by current work. Apply only
  changes that preserve behavior, public APIs, readability, type safety, testability, debuggability,
  and the package's existing architecture.
- Approval-only changes are not remediation. Do not edit `buildTools.bundleSize.gzipBudgets`, budget
  values, bundle entries, aliases, chunks, exports, dependency shape, or budget policy; do not
  remove behavior, narrow public APIs, obscure readable code, add one-off shims, or change source
  structure for bundle size unless the requester or maintainer explicitly approves that exact
  proposal.
- When reviewing an existing changeset, assume included bundle-size budget changes already have the
  required requester or maintainer approval unless the user explicitly asks to audit approval. Do not
  flag budget bumps as findings, risks, or noteworthy by themselves; only report concrete validation
  problems such as a failing size check, a budget applied to the wrong bundle, or inconsistent
  package policy.
- Do not infer bundle-size tradeoff approval from general requests such as "fix CI", "make checks
  pass", "get under budget", or an implementation request.
- Stop and surface the remaining overage when the remaining options would reduce maintainability,
  reduce functionality, change public behavior, change budget policy, or require an approval-only
  change. Also stop for pre-existing budget drift, intentional feature cost, unknown causes, or
  overages left after allowed remediation. Report the package or bundle, budget, actual size, delta,
  likely cause, safe changes already attempted, and the smallest next decision for the requester or
  maintainer.
- Unapplied proposals must be labeled `UNAPPLIED PROPOSAL`, printed in chat, and not written into
  the project tree.
- After any bundle-size source changes, including approved tradeoffs, validate the touched package
  with typecheck, relevant tests, build when emitted output/declarations are affected, and
  `size:check`.

## Docs and README

- Follow [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for human-authored prose. Authored docs live in
  `documentation/`; generated TypeDoc output lives in `site/`.
- Preserve existing README families: repo/package/reference implementation headers, navigation, and
  release-status warnings where applicable; documentation indexes; short status READMEs for placeholders or
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

## Review triage

- Before elevating an async, callback-reentrancy, or lifecycle-interleaving candidate, identify the
  documented or supported consumer pattern or maintained integration that reaches it and the
  concrete contract it violates. Mechanical composability of public callbacks alone is not
  evidence that reentrant mutation is supported.
- For coordinated runtime paths, name and trace the authority layer whose invariant allegedly
  fails—method or event acceptance, shared-state publication authority, or framework presentation
  settlement. Do not use success or acceptance in one layer as proof that another layer has
  settled, and scope a finding to the lifecycle interval where the contract is violated.

## Bito PR reviews

- Inspect every Bito finding against the current diff, source, and relevant tests. Fix valid
  in-scope issues; explain false positives or accepted trade-offs with concrete evidence.
- When authorized to reply in a Bito-started inline thread, mention `@bitoagent` or `@askbito`, state
  the resolution or evidence, explicitly ask Bito to resolve the thread, and never use
  `@bito-code-review`.
- Bito chat tags are recognized only in threads Bito started. A standalone PR comment may summarize
  the review, but do not rely on a Bito chat tag there and do not use it as a substitute for
  thread-specific replies.
- Keep replies within the PR purpose. Do not promise additional scope, redesign, generalized
  machinery, or major refactoring to satisfy a suggestion that is outside the accepted change.
- After posting replies or fixes, re-read the live PR review and thread state through the available
  GitHub tool or CLI. Confirm that each reply exists on the intended Bito thread, references the
  current diff, and is resolved or still requires action; never assume posting or resolution
  succeeded.
- If a valid thread remains unresolved, address the remaining in-scope issue and check live state
  again. If an evidenced false positive or accepted trade-off remains open after the supported
  reply, report its live state and stop rather than expanding scope or repeatedly posting.

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
- When updating a feature branch from `main`, rebase the feature branch on top of `main`. Never
  merge `main` into a feature branch. If a merge from `main` into a feature branch is started by
  mistake, abort it and restart with a rebase.
- Do not assume full cross-platform E2E is required for every change.
- After compaction, interruption, or a long-running resume, reread the latest user request, inspect
  `git status` and relevant diffs, then continue only with the current request.

## Preferred workflow

1. Read the applicable `AGENTS.md` chain.
2. Make the narrowest source-of-truth change in the correct layer.
3. Run the smallest meaningful validation.
4. Broaden validation only when shared behavior, exports, generated artifacts, or downstream
   consumers are affected. Mock changes do not independently trigger broader validation.
5. Summarize changes, validation, skipped checks, and residual risk.
