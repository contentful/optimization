# React Web SDK Contract

## Purpose

Define the public, in-process contract for the React Web SDK package. This is an SDK surface
contract, not a network API contract.

## Package

- Name: `@contentful/optimization-react-web`
- Runtime targets: browser-rendered React and server-rendered React
- Dependency baseline: wraps `@contentful/optimization-web` behavior

## Public Exports

### Initialization and Context

```ts
type ReactSdkConfig = OptimizationWebConfig

interface OptimizationProviderProps {
  config: ReactSdkConfig
  children?: React.ReactNode
}

function OptimizationProvider(props: OptimizationProviderProps): React.JSX.Element
```

Behavior guarantees:

- Provider initializes a single authoritative Web SDK-backed runtime instance per provider scope.
- Missing/invalid required config results in explicit error behavior.
- Runtime behavior is supported in both browser-rendered and server-rendered React flows.

### Core Access Hook

```ts
function useOptimization(): Optimization
```

Behavior guarantees:

- Returns the active Optimization runtime instance from provider context.
- Throws actionable error if called outside provider context.

### Essential Helper Components

```ts
type HelperComponentProps = Record<string, unknown>
```

Behavior guarantees:

- Essential helper components are provided for common integration flows.
- Components must consume provider context and preserve underlying Web SDK behavior semantics.

## Capability Parity Contract

- Initial release must expose all currently supported Web SDK capabilities.
- If direct API shape differs for React ergonomics, the SDK must provide a functionally equivalent
  access path and document the mapping.
- Capability mapping documentation is mandatory for every supported capability.

## Migration Contract

- Supported migration mode is full replacement of direct Web SDK usage with React SDK usage in a
  React application.
- Mixed direct Web SDK + React SDK usage is not a supported steady-state mode.

## Testing Contract

- Runtime parity requires dedicated integration coverage for both server-rendered and
  client-rendered paths.
- API behavior simulation in tests must use MSW handler helpers exported by the `mocks` workspace
  package (declared as a dev dependency).

## Non-Functional Contract

- Bundle size and runtime performance are top priorities.
- Runtime dependencies are capped to one additional dependency unless a documented exception is
  approved.
- Observability requires standardized logs and metrics guidance; tracing is optional for initial
  release.
