# AGENTS.md

Platform-agnostic packages under `packages/universal/`.

## Boundaries

- `api-schemas` owns runtime schemas, inferred types, and schema helpers. Treat schema edits as API
  contract changes; prefer additive changes unless the task changes the contract.
- `api-client` owns Experience API and Insights API transport. Keep request/response handling
  aligned with `@contentful/optimization-api-schemas`.
- `core-sdk` owns platform-agnostic optimization business logic. Shared behavior belongs there, not
  in platform SDK packages.
- Universal packages must not assume browser, Node, React, React Native, Swift, Android, or other
  platform runtimes.

## Validate

- Schema changes: validate downstream `api-client` and `core-sdk`.
- API client lifecycle, retry, event transport, or error handling changes: validate `core-sdk` or an
  affected implementation.
- Core exported types, state, event flow, or shared optimization logic changes: validate affected
  platform SDKs or reference implementations.
