# AGENTS.md

This file defines repository-wide rules only. For any change, read this file first, then read each
applicable child `AGENTS.md` from outermost to nearest in the subtree you are editing.

## Hierarchy

- The root `AGENTS.md` owns stable repo-wide policy.
- `packages/AGENTS.md` and `implementations/AGENTS.md` own shared policy for all packages and
  reference implementations.
- `lib/*/AGENTS.md`, `packages/**/AGENTS.md`, and `implementations/*/AGENTS.md` own more specific
  local instructions, commands, and gotchas.
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
- `documentation/**`
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
- When linting or formatting is likely needed, prefer the smallest fix-enabled command that matches
  the edited area first, then confirm with a check-only command if needed. Avoid the pattern of
  running a pure check, then rerunning the same tool again only to apply obvious auto-fixes.
- For TypeScript or TSX edits, run the relevant lint command early enough to influence the shape of
  the implementation, not only at the end.
- For `lib/` or `packages/` edits, prefer `pnpm lint` after the first meaningful patch and again
  before finishing if the change grew.
- For `implementations/` edits, prefer `pnpm implementation:lint` after the first meaningful patch
  and again before finishing if the change grew.
- For cross-cutting changes, broaden validation to affected downstream packages or implementations.
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
- If a lint or format command fails with findings that the tool can auto-fix, prefer a targeted
  fix-enabled rerun over repeated check-only runs, then revalidate once.
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

## Docs, Specs, And CI

- Authored supporting docs live in `documentation/`; generated TypeDoc output lives in `docs/`.
- If the repository later adds any replacement design, architecture, or specification artifacts for
  the changed area, keep them aligned in the same change.
- `docs/` is generated by TypeDoc and is gitignored.
- Implementation E2E in `.github/workflows/main-pipeline.yaml` is intentionally path-filtered. If a
  change should alter E2E coverage, update the workflow and keep it aligned with
  [CONTRIBUTING.md](./CONTRIBUTING.md).

## README And Markdown Standards

- Treat README files as maintained source-of-truth orientation for humans. Keep them aligned with
  package exports, implementation scripts, local `.env.example` files, and authored documentation in
  the same change as behavior or workflow updates.
- Preserve the README family already used by the target directory:
  - root, published package, and reference implementation READMEs use the centered Contentful logo
    header, `Contentful Personalization & Analytics` title, subtype `<h3>`, navigation links, and
    pre-release warning.
  - `documentation/**/README.md` files are navigation indexes with frontmatter.
  - placeholder and internal-only README files may use a plain Markdown `#` title plus explicit
    status or internal-use admonitions.
- Use title case for Markdown headings, preserving official product, package, API, component, hook,
  and file casing.
- Lead with reader intent and scope: what to use, when to use it, and what belongs elsewhere. Prefer
  concrete implementation guidance over marketing language.
- Keep terminology consistent: "Optimization SDK Suite", "Personalization", "Analytics", "Experience
  API", "Insights API", "reference implementation", and exact package names such as
  `@contentful/optimization-web`.
- Use fenced code blocks with language tags (`sh`, `ts`, `tsx`, `json`, `html`) and prefer `pnpm`
  commands. Do not introduce npm, yarn, or undocumented global-tool instructions.
- Use GitHub admonitions intentionally: warning/caution for pre-release, internal, destructive, or
  unsafe flows; important for required contracts; note for helpful context that is not required.
- Match README depth to the README category, not to the amount of available detail:
  - application-facing package READMEs orient the integrator, preserve common setup options, and
    link to authored guides or generated reference docs for deep workflows and exhaustive API
    details
  - lower-level package READMEs orient SDK maintainers and package authors, explain the layer's
    role, and avoid application-integration tutorial depth
  - reference implementation READMEs stay procedural and point readers to the code being
    demonstrated instead of duplicating package API tutorials
  - internal and placeholder READMEs stay short, explicit, and status-oriented
- Move step-by-step implementation material into `documentation/guides/` when an existing guide is
  the right home; create a new guide only when no existing guide covers that reader goal. Use
  generated TypeDoc reference for exhaustive signatures, method catalogs, callback payload shapes,
  and exported type details.
- Before changing README navigation or cross-document links, account for every render target that
  consumes that README: GitHub source browsing, TypeDoc project documents, and npmjs package README
  rendering for published packages.
- Keep relative links pointed at source-of-truth files in this repository when the README is only
  consumed in-repo or by TypeDoc, or when the package README publish rewrite flow is known to
  rewrite that link for npm. Use stable absolute URLs for links that must work unchanged across
  GitHub, TypeDoc, and npm.
- Link to generated reference docs for API reference and shared README header navigation that needs
  to work in all render targets, not as a replacement for source README guidance.
- When a README has a collapsible table of contents, preserve the exact `<!-- mtoc-start -->` and
  `<!-- mtoc-end -->` markers and keep entries synchronized with headings.
- For Markdown edits, run Prettier on touched files when practical and at least run
  `git diff --check` before finishing.

## Safety Rules

- Never overwrite or delete ignored local files just to get a clean run.
- Do not run destructive Contentful scripts unless explicitly asked.
- Do not use broad cleanup commands such as `pm2 delete all` unless explicitly asked.
- Do not assume full cross-platform E2E is required for every change.

## Preferred Workflow

1. Read the root `AGENTS.md`.
2. Read each applicable child `AGENTS.md` from outermost to nearest in the subtree you will edit.
3. Make the narrowest source-of-truth change in the correct layer.
4. Run the smallest meaningful validation set.
5. Broaden validation only when exports, build tooling, mocks, or shared behavior changed.
6. Summarize what changed, what was verified, what was skipped, and any follow-up risk.
