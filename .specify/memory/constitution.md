<!--
Sync Impact Report
- Version change: 0.0.0 -> 1.0.0
- Modified principles:
  - None (initial adoption)
- Added sections:
  - Core Principles
  - Engineering Standards
  - Delivery Workflow
  - Governance
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: .specify/templates/commands/constitution.md
- Follow-up TODOs:
  - None
-->

# Optimization SDK Suite Constitution

**Version**: 1.0.0 **Ratified**: 2026-02-12 **Last Amended**: 2026-02-12

## Core Principles

### 1. Type-Safe Public Contracts

All externally consumable APIs and SDK entry points MUST provide stable, typed contracts. Changes to
public types, schemas, request payloads, or response payloads MUST include explicit compatibility
analysis and migration notes before release.

Rationale: SDK consumers depend on predictable interfaces and safe upgrades.

### 2. Test-Gated Reliability

Every change that affects behavior MUST include automated tests at the correct level (unit,
integration, or end-to-end). A change MUST NOT merge unless all required lint, typecheck, and test
pipelines pass for affected packages.

Rationale: this suite supports multiple platforms and regressions are expensive to recover.

### 3. Cross-SDK Consistency

Shared behaviors, naming, error semantics, and payload shapes MUST remain aligned across platform
SDKs unless a documented platform constraint prevents it. Any intentional divergence MUST be
documented in the relevant package README and implementation notes.

Rationale: consistent semantics reduce integration friction and support burden.

### 4. Security and Privacy by Default

Code handling credentials, user identifiers, tracking data, or network payloads MUST minimize data
collection, avoid sensitive logging, and enforce least-privilege configuration. Security-relevant
changes MUST include explicit threat and privacy impact notes in the specification.

Rationale: optimization and analytics workflows process sensitive operational data.

### 5. Documentation Is a Release Artifact

Changes to public behavior, configuration, or onboarding flows MUST update the corresponding docs in
the same change set. A feature is incomplete until documentation and examples are updated.

Rationale: accurate docs are required for safe adoption and supportability.

## Engineering Standards

- Monorepo contributions MUST keep `pnpm` workspace integrity and package boundaries intact.
- New dependencies SHOULD be justified in the spec with maintenance and security implications.
- Generated or derived artifacts MUST be reproducible from committed sources and scripts.
- Code reviews MUST check constitutional compliance explicitly, not only code style.

## Delivery Workflow

1. Write or update a spec that includes API contract impact, test strategy, security/privacy notes,
   and documentation updates.
2. Create an implementation plan with a Constitution Check that validates all five principles.
3. Execute tasks in slices that preserve build, lint, typecheck, and tests in green state.
4. Publish changes with semantic versioning aligned to compatibility impact.

## Governance

- Amendment process: propose constitution changes in a pull request that explains rationale, impact,
  and migration expectations; at least one maintainer approval is required before merge.
- Versioning policy:
  - MAJOR for backward-incompatible governance or principle redefinition/removal.
  - MINOR for new principles/sections or materially expanded mandatory guidance.
  - PATCH for clarifications, wording improvements, and non-semantic refinements.
- Compliance review: every spec, plan, and task list MUST include and pass a constitution alignment
  check before implementation begins and again before release.

This constitution overrides conflicting process guidance in local templates or working notes.
