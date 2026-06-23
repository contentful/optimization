# AGENTS.md

Angular SPA reference implementation of `@contentful/optimization-web`. Serves the app on
`http://localhost:4200` via the Angular CLI dev server alongside the shared mock API server.

## Rules

- Do not add local adapter shims; import SDK behaviour directly from the published package surface
  when it exists.
- This implementation uses Angular CLI (`@angular/build`) and PM2-managed mock server processes.
- Use standalone components (no NgModule).
- Use modern Angular patterns: signals and `computed()` for state, `inject()` for dependency
  injection (not constructor injection), `input()` / `output()` for component I/O, `toSignal()` to
  bridge RxJS observables to templates, and `@if` / `@for` control flow syntax.
- Name files and classes after the concept only — no Angular-role suffixes anywhere. File: `home.ts`
  not `home.component.ts`. Class: `Home` not `HomeComponent`, `Optimization` not
  `OptimizationService`, `MergeTag` not `MergeTagPipe`, etc.
- Avoid unsafe type assertions (`as SomeType`). Use `isRecord()` and typed type-guard functions
  instead. The `no-unsafe-type-assertion` ESLint rule is enforced and blocks commits.
- Use explicit named types instead of `ReturnType<typeof ...>` inference. Prefer the actual type
  (e.g. `Signal<Foo>`, `ContentfulClientApi<undefined>`) over derived magic types.
- Follow the Angular style guide class member ordering: inputs → injected dependencies → private
  state → constructor (effects/setup) → protected state (template-facing computed/signals) →
  lifecycle hooks → public methods → private methods.

## Commands

```sh
pnpm implementation:run -- web-sdk_angular implementation:install
pnpm implementation:run -- web-sdk_angular serve:mocks
pnpm implementation:run -- web-sdk_angular dev
pnpm implementation:run -- web-sdk_angular build
pnpm implementation:run -- web-sdk_angular typecheck
pnpm implementation:lint
pnpm implementation:run -- web-sdk_angular implementation:test:e2e:run
pnpm test:e2e:web-sdk_angular
```

## Validate

- Run `typecheck` for TypeScript changes.
- Run `build` for production bundling changes.
- Run lint from the monorepo root with `pnpm implementation:lint`; for a targeted source-file probe,
  use `pnpm exec eslint implementations/web-sdk_angular/<path>`.
- Run shared Playwright E2E for user-visible behavior, routing, event flow, tracking, preview
  behavior, or Angular integration changes.
- The pre-commit hook runs lint and Prettier automatically — fix any errors before committing.
