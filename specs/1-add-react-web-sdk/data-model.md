# Data Model: React Web SDK

## Entity: ReactSdkConfig

- Purpose: Consumer-provided configuration used to initialize React SDK behavior.
- Fields:
  - `clientId` (string, required): Optimization client identifier.
  - `environment` (string, optional, default `main`): Environment slug.
  - `defaults` (object, optional): Initial consent/profile/personalization state seeds.
  - `analytics` (object, optional): Analytics behavior configuration inherited from Web SDK.
  - `personalization` (object, optional): Personalization behavior configuration inherited from Web
    SDK.
  - `fetchOptions` (object, optional): Request timeout/retry configuration inherited from Web SDK.
- Validation rules:
  - `clientId` must be non-empty.
  - Unsupported fields are rejected or ignored according to Web SDK parity behavior.

## Entity: ReactOptimizationInstance

- Purpose: Runtime wrapper around the underlying Web SDK instance.
- Fields:
  - `webInstance` (Optimization): Single authoritative Web SDK runtime instance.
  - `runtimeMode` (enum: `browser` | `server`): Runtime path selected at initialization.
  - `status` (enum: `uninitialized` | `ready` | `error` | `destroyed`): Lifecycle state.
- Validation rules:
  - Exactly one active instance per provider scope.
  - Access before `ready` state triggers explicit error behavior.

## Entity: OptimizationProviderContext

- Purpose: React Context payload used by hooks/components.
- Fields:
  - `instance` (ReactOptimizationInstance, required)
  - `isReady` (boolean, required)
  - `lastError` (Error | null, optional)
- Validation rules:
  - Hooks must throw actionable error if context is absent.
  - Context value identity should remain stable to prevent unnecessary rerenders.

## Entity: CapabilityMapping

- Purpose: Canonical mapping of Web SDK capabilities to React-facing APIs.
- Fields:
  - `capabilityName` (string, required)
  - `reactAccessPath` (string, required)
  - `parityStatus` (enum: `full` | `equivalent`)
  - `notes` (string, optional)
- Validation rules:
  - Every supported Web SDK capability must have exactly one mapping entry.
  - `equivalent` status requires explicit notes and documentation link.

## Entity: ObservabilitySignal

- Purpose: Defines required logs/metrics emitted or documented for operations.
- Fields:
  - `signalType` (enum: `log` | `metric`)
  - `name` (string)
  - `trigger` (string)
  - `sensitivity` (enum: `safe` | `restricted`)
- Validation rules:
  - Restricted signals must not contain profile identifiers or sensitive payload contents.

## Relationships

- `OptimizationProviderContext` owns one `ReactOptimizationInstance`.
- `ReactOptimizationInstance` consumes one `ReactSdkConfig`.
- `CapabilityMapping` references behaviors exposed through `ReactOptimizationInstance`.
- `ObservabilitySignal` events are emitted/documented by lifecycle transitions of
  `ReactOptimizationInstance`.

## State Transitions

`ReactOptimizationInstance.status`:

1. `uninitialized` -> `ready` on successful provider initialization.
2. `uninitialized` -> `error` on invalid config or runtime initialization failure.
3. `ready` -> `error` on unrecoverable runtime failure.
4. `ready` -> `destroyed` on provider teardown/unmount.
5. `error` -> `destroyed` on explicit cleanup.

## Scale and Volume Assumptions

- High-frequency UI rendering requires low-overhead context/hook subscriptions.
- Event generation volume follows existing Web SDK traffic assumptions.
- No new durable storage model introduced by React adapter layer.
