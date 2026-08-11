# AGENTS.md

Owns the platform-agnostic optimization core used by all platform SDKs.

## Rules

- Prefer shared fixes here when a problem affects more than one platform SDK.
- Keep `src/bridge-support/` preview-only. Preview is allowed to use this bridge because it must
  synthesize local override state through controlled access to writable Core signals and
  interceptors that consumers must not mutate directly. Do not add handoff, hydration, lifecycle,
  request-authority, or other general inter-SDK coordination to the bridge; expose a
  purpose-specific public Core operation that preserves Core invariants instead.
- `src/preview-support/` has additional guidance for preview-panel support.

## Commands

- `pnpm --filter @contentful/optimization-core <script>` with `typecheck`, `test:unit`, `build`, or
  `size:check` or `size:report`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
