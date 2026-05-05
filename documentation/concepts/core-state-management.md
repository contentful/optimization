---
title: Core state management
---

# Core state management

Use this document to understand how `CoreStateful` stores its internal state, why that state is
protected from outside interference, and which surface the SDK explicitly provides for consumers to
observe and influence state. Every mechanism described here is grounded in SDK source so you can
reason about runtime behavior with confidence.

The companion guides — for example,
[Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
— cover installation and setup. Come here when you need to understand _why_ state works the way it
does, or when you want to extend behavior through the consumer-facing channels the SDK provides.

<details>
  <summary>Table of Contents</summary>

- [How Core stores state](#how-core-stores-state)
  - [Signals as the storage medium](#signals-as-the-storage-medium)
  - [The signal catalog](#the-signal-catalog)
  - [One instance per runtime](#one-instance-per-runtime)
- [How state changes](#how-state-changes)
  - [Entry points for state mutation](#entry-points-for-state-mutation)
  - [How the Experience API drives state](#how-the-experience-api-drives-state)
  - [Consent gating](#consent-gating)
- [What consumers receive: the `states` surface](#what-consumers-receive-the-states-surface)
  - [The `Observable` contract](#the-observable-contract)
  - [Available observables](#available-observables)
  - [Why observables, not direct signal access](#why-observables-not-direct-signal-access)
- [Consumer-facing state features](#consumer-facing-state-features)
  - [Reacting to profile changes](#reacting-to-profile-changes)
  - [Reacting to optimization variant changes](#reacting-to-optimization-variant-changes)
  - [Reading a Custom Flag value reactively](#reading-a-custom-flag-value-reactively)
  - [Diagnosing blocked events](#diagnosing-blocked-events)
  - [Auditing all emitted events](#auditing-all-emitted-events)
  - [Providing consent](#providing-consent)
  - [Resetting state](#resetting-state)
- [Extending Core: interceptors](#extending-core-interceptors)
  - [Event interceptors](#event-interceptors)
  - [State interceptors](#state-interceptors)
  - [When to use interceptors](#when-to-use-interceptors)
- [What not to do: direct signal mutation](#what-not-to-do-direct-signal-mutation)

</details>

## How Core stores state

### Signals as the storage medium

`CoreStateful` stores all runtime state in [Preact Signals](https://github.com/preactjs/signals) — a
lightweight reactive primitive that pushes value changes to dependent effects and computed values
automatically. Signals live at module scope inside `core-sdk`, which means all code sharing the same
JavaScript module graph reads the same values.

`CoreStateful` wraps each signal with the `Observable` adapter before exposing it on the `states`
property. Consumers see observables, not signals. The distinction matters: observables deep-clone
every emitted value before delivering it, so consumer-side mutations never reach the internal
signal.

### The signal catalog

`CoreStateful` maintains the following signals:

| Signal                  | Type                                            | Description                                                                                                               |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `consent`               | `boolean \| undefined`                          | Whether the user has granted or denied tracking consent. `undefined` means the value has not yet been set.                |
| `profile`               | `Profile \| undefined`                          | The active user profile returned by the Experience API, including ID, traits, and location.                               |
| `selectedOptimizations` | `SelectedOptimizationArray \| undefined`        | The set of variant selections returned by the Experience API for the current profile.                                     |
| `changes`               | `ChangeArray \| undefined`                      | The optimization change payload returned by the Experience API, used to resolve Custom Flag values and optimized entries. |
| `canOptimize`           | `boolean`                                       | A computed signal derived from `selectedOptimizations`. `true` when variant data is available.                            |
| `event`                 | `InsightsEvent \| ExperienceEvent \| undefined` | The most recent event emitted to either API.                                                                              |
| `blockedEvent`          | `BlockedEvent \| undefined`                     | Metadata about the most recent event that was blocked by a consent or runtime guard.                                      |
| `online`                | `boolean \| undefined`                          | Runtime network connectivity, used by the queue flush logic. Defaults to `true`.                                          |
| `previewPanelAttached`  | `boolean`                                       | Whether the Contentful preview panel bridge has been registered.                                                          |
| `previewPanelOpen`      | `boolean`                                       | Whether the preview panel UI is currently open.                                                                           |

### One instance per runtime

`CoreStateful` enforces a single-instance constraint for each JavaScript runtime using a
`globalThis`-based lock. Constructing a second instance before `destroy()` is called on the first
throws an error:

```
Stateful Optimization SDK already initialized (CoreStateful#1). Only one stateful instance is supported per runtime.
```

Because all signals are module-scoped, allowing multiple instances would cause them to interfere
with each other's state. Call `destroy()` before re-initializing — for example, during hot-module
replacement or test teardown.

## How state changes

### Entry points for state mutation

Internal signals are private. Only `CoreStateful` and its queue infrastructure write to them, and
only in response to specific method calls. The complete set of public entry points is:

| Method                   | What it affects                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `consent(accept)`        | Sets the `consent` signal.                                                                           |
| `identify(payload)`      | Sends an Experience event; updates `profile`, `selectedOptimizations`, and `changes` on response.    |
| `page(payload)`          | Sends an Experience event; same response-driven updates.                                             |
| `screen(payload)`        | Sends an Experience event; same response-driven updates.                                             |
| `track(payload)`         | Sends an Experience event; same response-driven updates.                                             |
| `trackView(payload)`     | Sends an Insights event; optionally sends an Experience event for view-triggered optimization.       |
| `trackClick(payload)`    | Sends an Insights event.                                                                             |
| `trackHover(payload)`    | Sends an Insights event.                                                                             |
| `trackFlagView(payload)` | Sends an Insights event recording a Custom Flag observation.                                         |
| `reset()`                | Clears `blockedEvent`, `event`, `changes`, `profile`, and `selectedOptimizations` in a single batch. |
| `flush()`                | Triggers immediate queue flushes without writing to any signal directly.                             |
| `destroy()`              | Flushes both queues and releases the singleton lock.                                                 |

There is no setter, patch method, or object reference that lets a consumer write directly to a
signal. State only changes through the methods above.

### How the Experience API drives state

When `identify`, `page`, `screen`, `track`, or `trackView` sends an Experience event and the API
responds, `ExperienceQueue` calls `updateOutputSignals()`. That method runs the response through any
registered state interceptors and then writes to `profile`, `selectedOptimizations`, and `changes`
in a single reactive batch:

```
Consumer calls sdk.page()
  → CoreStatefulEventEmitter builds event
  → ExperienceQueue sends to Experience API
  → API returns OptimizationData { profile, selectedOptimizations, changes }
  → State interceptors run (in insertion order)
  → batch(() => { profileSignal, selectedOptimizationsSignal, changesSignal }) all update at once
  → Observables emit deep-cloned snapshots to all active subscribers
```

Batching the writes means downstream effects and computed signals see a consistent snapshot — there
is no intermediate state where `profile` has updated but `selectedOptimizations` has not.

### Consent gating

Every event method is guarded by `@guardedBy`, a decorator that checks `hasConsent(methodName)`
before allowing the call to proceed. When consent is `false` or `undefined`, the method is blocked,
a `BlockedEvent` record is written to the `blockedEvent` signal, and the configured `onEventBlocked`
callback is invoked.

By default, `identify`, `page`, and `screen` are exempt from consent gating (they are in
`allowedEventTypes`). All other event methods are gated. This default list can be changed via the
`allowedEventTypes` configuration option.

Calling `consent(true)` unblocks all gated events going forward. It does not replay events that were
blocked before consent was granted.

## What consumers receive: the `states` surface

### The `Observable` contract

Every entry on `sdk.states` is an `Observable<T>` with three members:

- **`current`** — Returns a deep-cloned snapshot of the current signal value. Reading it does not
  establish a reactive subscription.
- **`subscribe(next)`** — Registers a callback that is called immediately with the current value and
  again whenever the underlying signal changes. Returns a `Subscription` with an `unsubscribe`
  method.
- **`subscribeOnce(next)`** — Registers a callback that fires exactly once when the first
  non-nullish value is available, then automatically unsubscribes. Useful for one-time
  initialization that must wait for data to arrive.

All values delivered through `current`, `subscribe`, and `subscribeOnce` are deep-cloned before
reaching your code. Mutating a received value does not affect internal signal state.

### Available observables

| Observable                     | Type                                                        | Description                                                                                      |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `states.consent`               | `Observable<boolean \| undefined>`                          | Current consent value.                                                                           |
| `states.profile`               | `Observable<Profile \| undefined>`                          | Active user profile.                                                                             |
| `states.selectedOptimizations` | `Observable<SelectedOptimizationArray \| undefined>`        | Active variant selections.                                                                       |
| `states.changes`               | `Observable<ChangeArray \| undefined>`                      | Latest optimization change payload.                                                              |
| `states.canOptimize`           | `Observable<boolean>`                                       | `true` when variant data is available.                                                           |
| `states.eventStream`           | `Observable<InsightsEvent \| ExperienceEvent \| undefined>` | Most recently emitted event.                                                                     |
| `states.blockedEventStream`    | `Observable<BlockedEvent \| undefined>`                     | Most recently blocked event.                                                                     |
| `states.previewPanelAttached`  | `Observable<boolean>`                                       | Whether the preview panel bridge is registered.                                                  |
| `states.previewPanelOpen`      | `Observable<boolean>`                                       | Whether the preview panel is open.                                                               |
| `states.flag(name)`            | `Observable<Json>`                                          | Per-flag observable that emits the flag value and automatically tracks a flag view via Insights. |

### Why observables, not direct signal access

`core-sdk` exports the raw `signals` object and the `signalFns` helper bundle, so you can
technically construct your own effects that read signal values directly. We recommend against doing
this in application code for several reasons:

- **No isolation.** Signals emit their actual internal value. If your code mutates the object you
  receive, that mutation leaks back into the shared signal and can corrupt state for every other
  subscriber in the runtime.
- **No tracking side effects.** `states.flag(name)` does more than read a value — it emits a flag
  view event to Insights so that flag observations are recorded. Reading the signal directly skips
  that reporting.
- **Coupling to internals.** Signal names and shapes are implementation details. The `states`
  surface is the stable, versioned API; signals are not.

Use `states.*` observables in application code. Reserve `signals` and `signalFns` for SDK layers
building on top of `CoreStateful` — for example, a framework integration that needs to bridge
signals into a React context or synchronize them with local storage.

## Consumer-facing state features

### Reacting to profile changes

Subscribe to `states.profile` to be notified whenever the active profile changes. This is useful for
syncing profile data into your own application state or updating UI that depends on identity.

```ts
const subscription = sdk.states.profile.subscribe((profile) => {
  if (profile) {
    analytics.identify(profile.id, profile.traits)
  }
})

// Later, when the component unmounts or the SDK is no longer needed:
subscription.unsubscribe()
```

`subscribe` emits the current value immediately upon registration, so you do not need a separate
call to read the initial state.

### Reacting to optimization variant changes

Subscribe to `states.selectedOptimizations` to respond when the set of active variants changes:

```ts
sdk.states.selectedOptimizations.subscribe((variants) => {
  if (variants) {
    applyLayoutVariant(variants)
  }
})
```

Use `states.canOptimize` when you only need to know whether variant data exists, without inspecting
the variants themselves:

```ts
sdk.states.canOptimize.subscribe((ready) => {
  setOptimizationReady(ready)
})
```

If you need to act only once — for example, to set an initial variant before rendering — use
`subscribeOnce`:

```ts
sdk.states.selectedOptimizations.subscribeOnce((variants) => {
  renderInitialLayout(variants)
})
```

`subscribeOnce` skips `null` and `undefined` and delivers the first non-nullish value, then
unsubscribes automatically.

### Reading a Custom Flag value reactively

`states.flag(name)` returns an `Observable<Json>` that emits the resolved Custom Flag value whenever
`changes` updates. Every read and subscription automatically emits a flag view event through
Insights, so flag exposure is tracked without any extra calls on your part:

```ts
const darkModeSubscription = sdk.states.flag('dark-mode').subscribe((value) => {
  document.body.classList.toggle('dark', value === true)
})
```

Both `states.flag` and `getFlag` deduplicate flag view events using deep equality, so repeated reads
of the same resolved value emit only one tracking event. The key difference is reactivity:
`states.flag` pushes updates to subscribers when the underlying value changes, while `getFlag`
requires the caller to poll.

### Diagnosing blocked events

Subscribe to `states.blockedEventStream` to receive details about any event that a consent or
runtime guard prevented from being sent:

```ts
sdk.states.blockedEventStream.subscribe((blocked) => {
  if (!blocked) return

  console.warn(`${blocked.method} was blocked (reason: ${blocked.reason})`)
})
```

This is particularly useful during integration testing and consent-flow debugging. The `reason`
field indicates whether the block came from consent gating or another runtime guard.

You can also handle blocks at construction time using the `onEventBlocked` config option:

```ts
const sdk = new ContentfulOptimization({
  clientId: 'my-client-id',
  onEventBlocked: (blocked) => {
    logger.warn('Optimization event blocked', blocked)
  },
})
```

`onEventBlocked` and `states.blockedEventStream` carry the same information. Use
`states.blockedEventStream` when you need to subscribe and unsubscribe dynamically; use
`onEventBlocked` when you want a single, always-on handler configured at startup.

### Auditing all emitted events

`states.eventStream` emits a snapshot of every event that passes through the SDK, whether it goes to
the Experience API or the Insights API:

```ts
sdk.states.eventStream.subscribe((event) => {
  if (event) {
    devToolsPanel.logEvent(event)
  }
})
```

This is useful for building debugging overlays, integration tests that assert on emitted payloads,
or custom telemetry pipelines that operate alongside the SDK's own delivery.

### Providing consent

Consent is a precondition for most event emission. Set it with the `consent` method:

```ts
// Grant consent (e.g., after the user accepts your cookie banner)
sdk.consent(true)

// Revoke consent
sdk.consent(false)
```

React to the current consent value through `states.consent`:

```ts
sdk.states.consent.subscribe((value) => {
  updateConsentBadge(value)
})
```

The SDK does not provide a consent UI. Consent policy — when to ask, what to display, how to store
the user's choice — belongs to your application. The SDK exposes `consent()` to receive the decision
and `states.consent` to let your application reflect it.

### Resetting state

`reset()` clears `profile`, `selectedOptimizations`, `changes`, `event`, and `blockedEvent` in a
single batch. Use it when a user signs out and you want to discard all identity and optimization
state:

```ts
function handleSignOut() {
  sdk.reset()
  // sdk.states.profile.current is now undefined
  // sdk.states.selectedOptimizations.current is now undefined
}
```

`reset()` does not affect consent. Consent state survives a reset and persists across sessions in
SDKs that write to storage (for example, the Web SDK, which stores consent in `localStorage`).

## Extending Core: interceptors

### Event interceptors

`CoreBase` exposes an `interceptors.event` `InterceptorManager` that lets you transform or inspect
every event before it is validated and sent. An interceptor is a function that receives a
`Readonly<InsightsEvent | ExperienceEvent>` and returns a (possibly async) event of the same type:

```ts
const interceptorId = sdk.interceptors.event.add(async (event) => {
  // Return a new object — do not mutate the readonly input
  return {
    ...event,
    context: {
      ...event.context,
      app: { version: APP_VERSION },
    },
  }
})

// Remove the interceptor when it is no longer needed:
sdk.interceptors.event.remove(interceptorId)
```

Interceptors run in the order they were added. Each interceptor receives the output of the previous
one. The chain is snapshotted at invocation time, so adding or removing interceptors while an event
is in flight does not affect that event.

> [!NOTE]
>
> The `value` parameter is typed `Readonly<T>`. Return a new or safely updated object rather than
> mutating the input. Mutating the parameter produces undefined behavior because the input is shared
> across the chain.

### State interceptors

`interceptors.state` applies the same mechanism to `OptimizationData` responses from the Experience
API before they are written to the `profile`, `selectedOptimizations`, and `changes` signals:

```ts
sdk.interceptors.state.add((data) => {
  // Normalize all trait keys to lowercase
  const traits = Object.fromEntries(
    Object.entries(data.profile?.traits ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return {
    ...data,
    profile: data.profile ? { ...data.profile, traits } : data.profile,
  }
})
```

State interceptors run after the API responds but before the batch signal write, so every subscriber
sees the transformed values.

### When to use interceptors

Interceptors are the right tool when you need to:

- Enrich every outgoing event with shared context (device info, app version, session ID).
- Filter or redact fields in events before they leave the device.
- Transform incoming optimization state to match your application's data conventions.
- Instrument event delivery for testing or observability without modifying application code.

Interceptors are not appropriate for conditionally suppressing events based on business logic. If
you need to decide whether an event fires at all, that decision belongs in application code before
the SDK method is called.

## What not to do: direct signal mutation

`core-sdk` exports the `signals` bundle, which gives you a reference to every internal signal.
Writing to a signal directly — `signals.profile.value = newProfile` — bypasses every layer that
makes state changes safe and coherent:

- No consent check. A direct write fires even when consent is `false`.
- No interceptors. Event and state interceptors are skipped entirely.
- No queue coordination. The queues hold their own pending state; a direct signal write does not
  flush or reconcile the queue.
- No batch guarantee. Writing multiple signals outside a `batch()` call can trigger intermediate
  reactive states that subscribers see before all changes are applied.
- No deep cloning. Subscribers receive a reference to the exact object you wrote. If you mutate that
  object later, all current subscribers' references are silently corrupted.

If you find yourself wanting to write to a signal directly, consider whether one of the patterns
above — a method call, a state interceptor, or a `defaults` configuration value — achieves the same
goal through the supported surface.

The `signals` and `signalFns` exports are intended for SDK layers that extend `CoreStateful` (such
as the Web SDK or the React Native SDK) and for first-party preview tooling. They are not part of
the application consumer API.
