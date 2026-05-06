# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

These instructions apply to platform-agnostic packages under `packages/universal/`.

## Layer boundaries

- `api-schemas` owns runtime schemas, inferred types, and schema helpers. Treat schema edits as API
  contract changes and prefer additive, backward-compatible changes unless the task explicitly
  changes the contract.
- `api-client` owns Contentful Experience API and Insights API transport concerns. Keep request and
  response handling aligned with `@contentful/optimization-api-schemas`.
- `core-sdk` owns platform-agnostic optimization business logic. Shared optimization behavior
  belongs there, not in platform SDK packages.
- Keep universal packages free of browser, Node, React, React Native, Swift, Android, or other
  platform-specific runtime assumptions.

## Usually validate

- If public schemas or schema helpers change, validate at least `api-client` and `core-sdk`
  downstream.
- If request lifecycle, retries, event transport, or error handling changes in `api-client`, broaden
  validation to `core-sdk` or an affected implementation.
- If exported core types, state management, event flow, or shared optimization logic changes,
  validate affected platform SDKs or reference implementations.
