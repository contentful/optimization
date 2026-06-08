# AGENTS.md

Angular SPA reference implementation. Serves a reference app via the Angular CLI dev server
alongside the shared mock API server.

## Rules

- Read [`REQUIREMENTS.md`](./REQUIREMENTS.md) before making any changes — it is the source of truth
  for what this implementation must do and how it must be structured.
- Do not add local adapter shims; import SDK behavior directly from the published package surface
  when it exists.
- This implementation uses Angular CLI (`@angular/build`) and PM2-managed mock server processes.
- Use standalone components (no NgModule).
- Use modern Angular patterns: signals and `computed()` for state, `inject()` for dependency
  injection (not constructor injection), `input()` / `output()` for component I/O, `toSignal()` to
  bridge RxJS observables to templates, and `@if` / `@for` control flow syntax.
- Name files and classes after the concept only — no Angular-role suffixes anywhere. File: `home.ts`
  not `home.component.ts`. Class: `Home` not `HomeComponent`, `Optimization` not
  `OptimizationService`, `MergeTag` not `MergeTagPipe`, etc.

## Commands

- `pnpm implementation:run -- angular-web-sdk <script>` with `implementation:install`, `typecheck`,
  `build`, `dev`, or `serve:mocks`.

## Validate

- Run `typecheck` for local TypeScript changes.
- Run `build` for production bundling changes.
