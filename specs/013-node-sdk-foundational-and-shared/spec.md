# Feature Specification: Optimization Node SDK Foundational and Shared Contracts

**Feature Branch**: `[013-node-sdk-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap a Stateless Node Runtime with Server Metadata (Priority: P1)

As a Node/SSR SDK consumer, I need a Node-focused SDK entry point that initializes the stateless
core with server-safe defaults so event metadata is correct without extra setup.

**Why this priority**: Correct bootstrap defaults are the primary value added by the Node package
over raw core usage.

**Independent Test**: Construct `Optimization` with minimal config and verify inherited stateless
runtime behavior plus Node default event metadata (`channel`, `library`).

**Acceptance Scenarios**:

1. **Given** `Optimization` is constructed with required API config, **When** initialization
   completes, **Then** the runtime behaves as `CoreStateless` with no behavior overrides.
2. **Given** no explicit `eventBuilder` configuration, **When** `Optimization` is created, **Then**
   event metadata defaults to `channel: 'server'` and Node SDK `library` name/version constants.
3. **Given** top-level `app` metadata is provided, **When** `Optimization` is created, **Then** the
   app metadata is available to the event builder context.

---

### User Story 2 - Override Node Event-Builder Defaults Safely (Priority: P1)

As a platform integrator, I need partial event-builder overrides so I can customize metadata while
keeping sensible Node defaults for unspecified values.

**Why this priority**: Custom host applications often need channel/library overrides without
redefining full event-builder config.

**Independent Test**: Initialize with partial `eventBuilder` values and verify deep-merge behavior
against Node defaults, including nested `library` object fields.

**Acceptance Scenarios**:

1. **Given** partial event-builder overrides (for example custom `channel`), **When** config is
   merged, **Then** supplied fields override Node defaults.
2. **Given** partial nested `library` overrides, **When** config is merged, **Then** unspecified
   nested defaults remain intact.
3. **Given** non-event-builder options (`analytics`, `personalization`, `fetchOptions`, etc.),
   **When** config is merged, **Then** those options are forwarded unchanged to core/API setup.

---

### User Story 3 - Consume Node SDK as a Stable Package Surface (Priority: P2)

As an SDK consumer, I need one Node package entry that exports core APIs plus Node constants in both
ESM and CJS-compatible form so integration and upgrades stay predictable.

**Why this priority**: Packaging and export stability determines install/import ergonomics in mixed
Node ecosystems.

**Independent Test**: Import from package root in both module systems and verify availability of
default class, named exports, shared constants, and generated type/runtime artifacts.

**Acceptance Scenarios**:

1. **Given** imports from `@contentful/optimization-node`, **When** consumers use root exports,
   **Then** core public exports remain available alongside Node-specific exports.
2. **Given** Node global constants are imported, **When** build-time define replacements are absent,
   **Then** constants fall back to deterministic default literals.
3. **Given** a package build, **When** artifacts are emitted, **Then** ESM/CJS runtime files and
   dual declaration files are produced for import/require entry points.

---

### Edge Cases

- If build-time constant replacement is unavailable, SDK name/version constants must still resolve
  to fallback values (`@contentful/optimization-node`, `0.0.0`).
- Omitting top-level `app` must not inject app metadata into built events.
- Providing no `eventBuilder` options must still produce server-channel events with Node SDK library
  attribution.
- Partial nested `library` overrides must not erase unspecified default `library` fields.
- The Node package must remain stateless-only and must not introduce stateful runtime requirements.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The package MUST provide an `Optimization` class that extends `CoreStateless`.
- **FR-002**: `OptimizationNodeConfig` MUST include all `CoreStatelessConfig` options except
  `eventBuilder`, and MUST add top-level optional `app` plus optional partial `eventBuilder`
  overrides.
- **FR-003**: The Node SDK MUST build default event-builder config with `channel: 'server'`,
  `library.name = OPTIMIZATION_NODE_SDK_NAME`, and
  `library.version = OPTIMIZATION_NODE_SDK_VERSION`.
- **FR-004**: The Node SDK MUST map top-level `app` config into default `eventBuilder.app`.
- **FR-005**: The Node SDK MUST deep-merge caller configuration with Node defaults before calling
  `CoreStateless`.
- **FR-006**: Provided `eventBuilder` overrides MUST take precedence over Node defaults for supplied
  fields.
- **FR-007**: Unspecified event-builder fields MUST retain Node defaults after merge.
- **FR-008**: Non-event-builder configuration fields MUST be forwarded to `CoreStateless` without
  Node-specific mutation.
- **FR-009**: The package root MUST re-export the full public API of
  `@contentful/optimization-core`.
- **FR-010**: The package root MUST export `Optimization` as both the default export and a named
  export.
- **FR-011**: The package root MUST export `OPTIMIZATION_NODE_SDK_NAME` and
  `OPTIMIZATION_NODE_SDK_VERSION`.
- **FR-012**: `OPTIMIZATION_NODE_SDK_VERSION` MUST read build-time `__OPTIMIZATION_VERSION__` when
  it is a string, otherwise default to `'0.0.0'`.
- **FR-013**: `OPTIMIZATION_NODE_SDK_NAME` MUST read build-time `__OPTIMIZATION_PACKAGE_NAME__` when
  it is a string, otherwise default to `'@contentful/optimization-node'`.
- **FR-014**: The Node package MUST re-export `ANONYMOUS_ID_COOKIE` from
  `@contentful/optimization-core` via its global constants module.
- **FR-015**: Package build output MUST include bundled ESM and CJS runtime artifacts in `dist`
  (including source maps).
- **FR-016**: Package build output MUST include dual type declaration artifacts for import and
  require consumers (`.d.mts` and `.d.cts`).
- **FR-017**: Inherited stateless methods (`identify`, `page`, `screen`, `track`, `trackView`,
  `trackFlagView`, `getCustomFlag`, `personalizeEntry`, `getMergeTagValue`) MUST preserve
  `CoreStateless` semantics.

### Key Entities _(include if feature involves data)_

- **OptimizationNodeConfig**: Node-facing configuration contract that accepts core stateless
  options, optional top-level `app`, and partial `eventBuilder` overrides.
- **mergeConfig**: Internal composition step that applies Node defaults and merges caller overrides
  before constructing `CoreStateless`.
- **Optimization**: Node SDK class extending `CoreStateless` with Node defaults only.
- **Node SDK Constants**: Build-time/fallback metadata constants for package name/version and shared
  anonymous-ID cookie export.
- **Package Surface**: Root export contract combining all core exports with Node-specific additions.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Constructing `Optimization` without explicit event-builder options yields
  server-channel metadata and Node library attribution.
- **SC-002**: Partial event-builder overrides are merged correctly, preserving unspecified default
  fields.
- **SC-003**: Package root imports expose core APIs, Node constants, and `Optimization`
  default/named exports without type errors.
- **SC-004**: A clean package build emits `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.mts`,
  and `dist/index.d.cts`.
