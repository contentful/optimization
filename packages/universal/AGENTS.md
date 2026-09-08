# AGENTS.md

Platform-agnostic packages under `packages/universal/`.

## Boundaries

- `api-client` owns Experience API and Insights API transport plus their runtime schemas, inferred
  types, validation helpers, and schema helpers.
- `core-sdk` owns platform-agnostic optimization business logic and Contentful CDA schemas. Its
  `./api-schemas` entry point aggregates CDA and API Client schema exports for downstream SDKs.
- `api-schemas` is the deprecated compatibility facade that re-exports API Client and Core schema
  surfaces; it does not own schemas.
- Universal packages must not assume browser, Node, React, React Native, Swift, Android, or other
  platform runtimes.

## Validate

- API Client schema changes: validate Core and affected downstream SDKs.
- Core CDA schema or aggregate pass-through changes: validate affected downstream SDKs.
- Compatibility facade changes: validate API Client and Core before the facade.
- API client lifecycle, retry, event transport, or error handling changes: validate `core-sdk` or an
  affected implementation.
- Core exported types, state, event flow, or shared optimization logic changes: validate affected
  platform SDKs or reference implementations.
