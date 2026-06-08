# AGENTS.md

Angular SPA reference implementation skeleton. Serves a Hello World page via the Angular CLI dev
server alongside the shared mock API server.

## Rules

- Read [`REQUIREMENTS.md`](./REQUIREMENTS.md) before making any changes — it is the source of truth
  for what this implementation must do and how it must be structured.
- This is a scaffold — no SDK integration yet. Add SDK behavior when the public Angular surface is
  ready.
- Do not add local adapter shims; import SDK behavior directly from the published package surface
  when it exists.
- This implementation uses Angular CLI (`@angular/build`) and PM2-managed mock server processes.
- Use standalone components (no NgModule).

## Commands

- `pnpm implementation:run -- angular-web-sdk <script>` with `implementation:install`, `typecheck`,
  `build`, `dev`, or `serve:mocks`.

## Validate

- Run `typecheck` for local TypeScript changes.
- Run `build` for production bundling changes.
