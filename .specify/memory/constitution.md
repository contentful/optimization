<!--
Sync Impact Report
- Version change: N/A -> 1.0.0
- Modified principles:
  - N/A (initial adoption) -> I. Layered Composition and Dependency Direction
  - N/A (initial adoption) -> II. Contract-First API Boundaries
  - N/A (initial adoption) -> III. Consent and Data Stewardship by Default
  - N/A (initial adoption) -> IV. Cross-Layer Parity and Target Packaging
  - N/A (initial adoption) -> V. Reference Implementations as Verification Gates
- Added sections:
  - Core Principles
  - Architecture and Packaging Standards
  - Development Workflow and Quality Gates
  - Governance
- Removed sections:
  - None (initial adoption)
- Templates requiring updates:
  - pending: .specify/templates/plan-template.md (file missing)
  - pending: .specify/templates/spec-template.md (file missing)
  - pending: .specify/templates/tasks-template.md (file missing)
  - pending: .specify/templates/commands/*.md (directory missing)
- Follow-up TODOs:
  - TODO(TEMPLATE_BOOTSTRAP): Initialize .specify/templates artifacts so constitution checks are enforceable in plan/spec/tasks/commands flows.
-->

# Contentful Optimization SDK Suite Constitution

## Core Principles

### I. Layered Composition and Dependency Direction

The SDK architecture MUST follow the canonical layer order
`platform -> environment -> framework -> meta-framework` when those layers exist for a target.
Dependency flow MUST remain directional and acyclic from shared contracts upward:
`api-schemas -> api-client -> core -> platform SDK -> environment SDK -> framework SDK -> meta-framework SDK -> implementations`.
A layer may be absent for a target, but no package MAY import from any later layer. Shared logic
MUST be centralized in `universal/*` or `lib/*` and MUST NOT be duplicated across SDK packages.

Rationale: The monorepo is designed as a composable SDK hierarchy; strict dependency direction keeps
expansion safe as SDK targets and layers grow.

### II. Contract-First API Boundaries

All network-facing payloads MUST be validated through `@contentful/optimization-api-schemas` (or
schema wrappers backed by it) before use by higher layers. Any change to serialized request or
response contracts MUST include schema updates, compatibility notes, and tests for both valid and
invalid payloads.

Rationale: Experience and Insights integrations span multiple runtimes, so runtime contract
validation is required to prevent cross-SDK regressions.

### III. Consent and Data Stewardship by Default

Stateful SDK behavior MUST enforce explicit consent state transitions and MUST restrict pre-consent
event flow to an allowlist. New analytics or personalization data paths MUST document collected
fields, necessity, retention expectations, and consent interaction. No feature MAY bypass consent or
consent-aware event gating in core flows.

Rationale: Personalization and analytics correctness includes privacy and compliance behavior, not
only functional output.

### IV. Cross-Layer Parity and Target Packaging

Shared public behaviors (`identify`, `page`, `track`, personalization resolution, profile semantics,
and consent behavior) MUST remain equivalent across first-party SDKs unless a target constraint is
explicitly documented. The constitution MUST NOT assume a fixed list of SDK targets. Each published
SDK MUST ship artifact formats expected by its target ecosystem and MUST document supported runtime
and packaging expectations. JavaScript SDKs MUST ship CJS, ESM, and TypeScript declarations.

Rationale: Consumers move between targets and layers; predictable behavior and packaging reduce
integration and upgrade risk.

### V. Reference Implementations as Verification Gates

User-visible behavior changes MUST be verified by unit tests in changed workspaces and end-to-end
coverage in at least one affected reference implementation. Changes to API assumptions MUST update
`lib/mocks` fixtures and handlers in the same change set. If no suitable implementation exists for a
new layer or target, the pull request MUST include a tracked follow-up issue defining coverage.

Rationale: Reference implementations are both executable documentation and cross-layer integration
checks.

## Architecture and Packaging Standards

The repository MUST preserve these workspace responsibilities:

- `universal/*`: platform-agnostic contracts and core capabilities.
- `platforms/*`: SDK packages composed by layer order
  `platform -> environment -> framework -> meta-framework`.
- `lib/*`: shared internal tooling, mocks, and utilities.
- `implementations/*`: sparse reference applications for integration and E2E verification.

A pull request that adds, moves, or reclassifies an SDK package MUST include a layer mapping in the
PR description with package path, declared layer, and allowed upstream dependencies.

## Development Workflow and Quality Gates

A pull request that changes runtime behavior MUST pass these gates before merge:

- Build, typecheck, lint, and format checks for touched packages.
- Unit tests for touched packages.
- Relevant E2E runs for affected implementations.
- README and TSDoc updates for user-visible behavior changes.

For governance clarity, a "significant change" means any change under `universal/*`, exported SDK
public APIs, API schemas/contracts, consent/event semantics, or build/release configuration. For
significant changes, "relevant E2E" means at least one implementation that exercises each affected
environment layer and at least one cross-layer integration path.

A pull request that defers a required gate MUST include explicit maintainer approval and a bounded
follow-up issue.

## Governance

This constitution is authoritative for engineering decisions in this repository.

- Amendment process: Changes require a pull request containing the constitution diff, rationale,
  impact on dependent templates/docs/tasks, and approval from at least one repository maintainer.
- Versioning policy: Constitution versions use semantic versioning. MAJOR removes or redefines a
  principle in a backward-incompatible way. MINOR adds a principle or materially expands normative
  requirements. PATCH clarifies language without changing normative requirements.
- Compliance review expectations: Every pull request MUST include a constitution compliance section
  mapping each principle to PASS, N/A, or deferred with a linked follow-up issue.

**Version**: 1.0.0 **Ratification Date**: 2026-02-23 **Last Amended Date**: 2026-02-23
