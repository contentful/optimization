# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Next.js CSR reference implementation. It uses `@contentful/optimization-react-web`
exclusively — the React SDK handles all entry resolution, event tracking, consent, and identify in
the browser. No Node SDK, no server-side resolution, no middleware.

This represents a customer setup where:

- Next.js is used as an app framework but personalization is fully client-side
- The server renders an HTML shell; all optimization logic runs in the browser
- The React SDK singleton manages state, API calls, and entry resolution

## Key Paths

- `app/` — Next.js App Router
- `lib/` — SDK config, Contentful client
- `components/` — ClientProviderWrapper
- `.env.example`

## Local Rules

- Next.js App Router only. No Pages Router.
- No Node SDK imports anywhere in this implementation.
- No middleware — this is a pure CSR pattern.
- Use the SDK's `OptimizationRoot` directly — no custom provider wrappers around it.
- If you changed a consumed package, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- react-web-sdk_nextjs implementation:install`
- `pnpm implementation:run -- react-web-sdk_nextjs typecheck`
- `pnpm implementation:run -- react-web-sdk_nextjs build`
- `pnpm implementation:run -- react-web-sdk_nextjs dev`
- `pnpm implementation:run -- react-web-sdk_nextjs serve`
- `pnpm implementation:run -- react-web-sdk_nextjs serve:stop`

## Usually Validate

- Run `typecheck` for local code changes.
- Run `build` when changing production bundling behavior.
