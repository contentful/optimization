# Feature Specification: Optimization Node SDK Foundational and Shared Contracts

**Feature Branch**: `[013-node-sdk-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap Stateless Node Runtime with Node Defaults (Priority: P1)

As a Node/SSR SDK consumer, I need a Node package entry that instantiates stateless core behavior
with server-oriented event metadata defaults so events are attributed correctly without extra setup.

**Why this priority**: Node default metadata composition is the primary value of this package over
raw core usage.

**Independent Test**: Construct `ContentfulOptimization` with minimal config and verify inherited
`CoreStateless` behavior plus Node library/channel defaults.

**Acceptance Scenarios**:

1. **Given** `ContentfulOptimization` is constructed with required API config, **When**
   initialization completes, **Then** runtime behavior is inherited from `CoreStateless`.
2. **Given** no explicit `eventBuilder` overrides, **When** `ContentfulOptimization` is created,
   **Then** default event metadata uses `channel: 'server'` and Node SDK
   `library.name`/`library.version` constants.
3. **Given** top-level `app` metadata is provided, **When** `ContentfulOptimization` is created,
   **Then** `eventBuilder.app` includes that app metadata.

---

### User Story 2 - Override Node Event-Builder Defaults Safely (Priority: P1)

As a platform integrator, I need partial event-builder overrides merged with Node defaults so I can
customize metadata without redefining the full builder configuration.

**Why this priority**: Host applications often override only selected event-builder fields.

**Independent Test**: Initialize with partial `eventBuilder` values and verify deep-merge behavior,
including nested `library` fields.

**Acceptance Scenarios**:

1. **Given** partial event-builder overrides (for example custom `channel`), **When** config is
   merged, **Then** supplied fields override Node defaults.
2. **Given** partial nested `library` overrides, **When** config is merged, **Then** unspecified
   nested default fields remain intact.
3. **Given** non-event-builder options (`api`, `fetchOptions`, `environment`, etc.), **When** config
   is merged, **Then** those options are forwarded to `CoreStateless` unchanged.

---

### User Story 3 - Consume Correct Node Package Surfaces (Priority: P2)

As an SDK consumer, I need stable root and subpath exports so I can import the correct runtime,
constants, and transitive core surfaces in both ESM and CJS environments.

**Why this priority**: Package-interface correctness determines integration and upgrade ergonomics.

**Independent Test**: Import root and subpath entrypoints and verify actual exported class/types,
constants, and transitive re-exports.

**Acceptance Scenarios**:

1. **Given** imports from `@contentful/optimization-node`, **When** consumers use root exports,
   **Then** root surface provides default `ContentfulOptimization`, `OptimizationNodeConfig`, and
   Node name/version constants.
2. **Given** imports from `@contentful/optimization-node/core-sdk`, **When** consumers import from
   this subpath, **Then** full `@contentful/optimization-core` exports are available.
3. **Given** imports from `@contentful/optimization-node/constants`, **When** consumers access
   constants, **Then** Node name/version plus `ANONYMOUS_ID_COOKIE` and `ANONYMOUS_ID_KEY` are
   available.
4. **Given** build-time define replacement is absent, **When** constants are resolved, **Then** Node
   package constants fallback to `'@contentful/optimization-node'` and `'0.0.0'`.
5. **Given** package build output, **When** artifacts are emitted, **Then** ESM/CJS runtime files,
   source maps, and dual declaration files are generated for all configured entrypoints.

---

### Edge Cases

- Root package surface does not re-export the full core SDK; full core surface is under
  `@contentful/optimization-node/core-sdk`.
- Root package surface does not provide a named class export for `ContentfulOptimization`; class
  export is default-only at root.
- Omitting top-level `app` keeps `eventBuilder.app` undefined in defaults.
- Partial nested `library` overrides must not erase unspecified Node default library fields.
- The Node package remains stateless-only because `ContentfulOptimization` extends `CoreStateless`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The package MUST provide a `ContentfulOptimization` class that extends
  `CoreStateless`.
- **FR-002**: Package root (`@contentful/optimization-node`) MUST export `ContentfulOptimization` as
  the default export.
- **FR-003**: Package root MUST export `OptimizationNodeConfig` (type/interface) and
  `OPTIMIZATION_NODE_SDK_NAME`/`OPTIMIZATION_NODE_SDK_VERSION` constants.
- **FR-004**: `OptimizationNodeConfig` MUST include all `CoreStatelessConfig` fields except
  `eventBuilder`, plus top-level optional `app` and optional partial `eventBuilder` overrides that
  exclude `app`.
- **FR-005**: Node config merge MUST compose default `eventBuilder` values with `channel: 'server'`,
  `library.name = OPTIMIZATION_NODE_SDK_NAME`, and
  `library.version = OPTIMIZATION_NODE_SDK_VERSION`.
- **FR-006**: Node config merge MUST map top-level `app` into default `eventBuilder.app`.
- **FR-007**: Node config merge MUST deep-merge defaults and caller config so supplied overrides
  take precedence and unspecified defaults remain.
- **FR-008**: Non-event-builder config fields MUST be forwarded to `CoreStateless` without
  Node-specific mutation.
- **FR-009**: Root package surface MUST NOT be treated as a full re-export of
  `@contentful/optimization-core`.
- **FR-010**: `@contentful/optimization-node/core-sdk` MUST re-export the full public API of
  `@contentful/optimization-core`.
- **FR-011**: `@contentful/optimization-node/logger` MUST re-export the core logger surface (default
  and named exports).
- **FR-012**: `@contentful/optimization-node/api-client` and
  `@contentful/optimization-node/api-schemas` MUST re-export corresponding core subpath surfaces.
- **FR-013**: `OPTIMIZATION_NODE_SDK_VERSION` MUST read build-time `__OPTIMIZATION_VERSION__` when
  it is a string, otherwise default to `'0.0.0'`.
- **FR-014**: `OPTIMIZATION_NODE_SDK_NAME` MUST read build-time `__OPTIMIZATION_PACKAGE_NAME__` when
  it is a string, otherwise default to `'@contentful/optimization-node'`.
- **FR-015**: `@contentful/optimization-node/constants` MUST expose `ANONYMOUS_ID_COOKIE` and
  `ANONYMOUS_ID_KEY` via re-export from `@contentful/optimization-core/constants`.
- **FR-016**: Package exports map MUST include dual import/require entries for `.`, `./logger`,
  `./constants`, `./core-sdk`, `./api-client`, and `./api-schemas`.
- **FR-017**: Package build output MUST include bundled ESM/CJS runtime artifacts (with source maps)
  plus dual declaration artifacts (`.d.mts` and `.d.cts`) for configured entrypoints.
- **FR-018**: Inherited stateless methods (`identify`, `page`, `screen`, `track`, `trackView`,
  `trackClick`, `trackHover`, `trackFlagView`, `getFlag`, `resolveOptimizedEntry`,
  `getMergeTagValue`) MUST preserve `CoreStateless` semantics.

### Key Entities _(include if feature involves data)_

- **OptimizationNodeConfig**: Node-facing configuration contract combining core stateless options,
  top-level optional `app`, and partial `eventBuilder` overrides.
- **mergeConfig**: Internal deep-merge step that applies Node defaults before constructing
  `CoreStateless`.
- **ContentfulOptimization**: Node SDK class extending `CoreStateless` with Node defaults only.
- **Node Constants Surface**: Build-time/fallback package name/version constants plus anonymous-ID
  constants re-exported from core constants module.
- **Node Package Surfaces**: Root and subpath export contract (`core-sdk`, `logger`, `constants`,
  `api-client`, `api-schemas`).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Constructing `ContentfulOptimization` without explicit event-builder overrides yields
  server-channel metadata and Node library attribution.
- **SC-002**: Partial event-builder overrides merge correctly while preserving unspecified Node
  defaults.
- **SC-003**: Root and subpath imports expose the expected runtime/type exports without requiring
  unsupported root imports.
- **SC-004**: Clean package builds emit ESM/CJS runtime and dual declaration outputs for configured
  Node entrypoints.
