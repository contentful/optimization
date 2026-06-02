# AGENTS.md

Next.js App Router SSR-primary reference implementation: Node SDK resolves personalized content on
the server, while React Web SDK handles client tracking and interactive controls.

## Rules

- App Router only; no Pages Router.
- Server Components import from `@contentful/optimization-node`, not
  `@contentful/optimization-react-web`.
- Client components (`"use client"`) import from `@contentful/optimization-react-web`, not
  `@contentful/optimization-node`.
- Use the SDK's `OptimizationRoot` directly; do not add custom provider wrappers around it.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs-ssr <script>` with
  `implementation:install`, `typecheck`, `build`, `dev`, `serve`, or `serve:stop`.

## Validate

- Run `typecheck` for local code changes.
- Run `build` for production bundling changes.
