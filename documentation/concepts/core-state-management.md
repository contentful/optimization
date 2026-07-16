---
title: Core state management
---

# Core state management

Use this document to understand how `CoreStateful` stores runtime state, which state each SDK
surface exposes, and which supported paths can change or observe that state. The details here help
you reason about personalization readiness, consent, locale, persistence, diagnostics, and teardown
without reaching into internal signals.

For installation and setup, start with the [Optimization SDK guides](../guides/README.md). Use this
concept document when you need to understand _why_ state works the way it does, or when you want to
extend behavior through the consumer-facing channels the SDK provides.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime applicability](#runtime-applicability)
- [State mental model](#state-mental-model)
  - [Key state definitions](#key-state-definitions)
  - [Signals and observables](#signals-and-observables)
- [State constraints](#state-constraints)
  - [One instance per runtime](#one-instance-per-runtime)
  - [Consent gating](#consent-gating)
  - [Locale boundaries](#locale-boundaries)
  - [Defaults, storage, offline, and preview state](#defaults-storage-offline-and-preview-state)
- [How Core stores state](#how-core-stores-state)
  - [State groups](#state-groups)
  - [Public observation surface](#public-observation-surface)
  - [Observable snapshot behavior](#observable-snapshot-behavior)
  - [Why observables, not direct signal access](#why-observables-not-direct-signal-access)
- [How state changes](#how-state-changes)
  - [Main state-changing paths](#main-state-changing-paths)
  - [How the Experience API drives state](#how-the-experience-api-drives-state)
  - [Runtime-specific persistence](#runtime-specific-persistence)
  - [Reset, teardown, and consent withdrawal](#reset-teardown-and-consent-withdrawal)
- [Consumer-facing state features](#consumer-facing-state-features)
  - [Reacting to profile changes](#reacting-to-profile-changes)
  - [Reacting to optimization variant changes](#reacting-to-optimization-variant-changes)
  - [Reading a Custom Flag value reactively](#reading-a-custom-flag-value-reactively)
  - [Providing consent](#providing-consent)
  - [Provider-managed framework subscriptions](#provider-managed-framework-subscriptions)
- [Diagnostics](#diagnostics)
  - [Diagnosing blocked events](#diagnosing-blocked-events)
  - [Auditing all emitted events](#auditing-all-emitted-events)
- [Extending Core: interceptors](#extending-core-interceptors)
  - [Event interceptors](#event-interceptors)
  - [State interceptors](#state-interceptors)
  - [When to use interceptors](#when-to-use-interceptors)
- [What not to do: direct signal mutation](#what-not-to-do-direct-signal-mutation)
- [Related docs](#related-docs)

<!-- mtoc-end -->
</details>

## Runtime applicability

`CoreStateful` powers browser, React, React Native, iOS, and Android stateful SDKs. Node and other
stateless environments use `CoreStateless`, which has request-bound state instead of a shared
`states` surface.

| Runtime                                                                                                             | State surface                                                                                                                                            | Runtime boundary                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web, `@contentful/optimization-web`                                                                                 | `sdk.states.*`, `sdk.locale`, and `sdk.setLocale()`                                                                                                      | Owns browser memory state, `localStorage`, the `ctfl-opt-aid` cookie, automatic page and entry interaction state, and browser queues.                          |
| React Web, `@contentful/optimization-react-web`                                                                     | Web SDK state through `OptimizationProvider`, `OptimizationRoot`, `onStatesReady`, hooks, and the provider `locale` prop                                 | Wraps a Web SDK instance. Provider-owned instances update locale through `sdk.setLocale()` when the `locale` prop changes.                                     |
| React Native, `@contentful/optimization-react-native`                                                               | `sdk.states.*`, `OptimizationProvider`, `OptimizationRoot`, `onStatesReady`, `sdk.locale`, and `sdk.setLocale()`                                         | Owns a stateful Core instance plus AsyncStorage persistence and screen/app-state/network coordination.                                                         |
| iOS, `ContentfulOptimization` Swift package                                                                         | `OptimizationClient.state`, `locale`, `selectedOptimizations`, `optimizationPossible`, `experienceRequestState`, `eventStream`, and `blockedEventStream` | Runs stateful Core inside the JavaScriptCore bridge. Swift exposes bridge snapshots through `@Published` properties and Combine publishers.                    |
| Android, Maven `com.contentful.java:optimization-android` with the `com.contentful.optimization.*` Kotlin namespace | `OptimizationClient.state`, `locale`, `selectedOptimizations`, `optimizationPossible`, `experienceRequestState`, `eventStream`, and `blockedEventStream` | Runs stateful Core inside the QuickJS bridge. Kotlin exposes bridge snapshots through `StateFlow` and `SharedFlow`.                                            |
| Node and stateless Core, `@contentful/optimization-node`                                                            | `forRequest({ consent, locale, profile })`, request return values, and `request.profile`                                                                 | No `CoreStateful.states`, no shared profile-continuity store, and no browser or native interaction observation. The host application binds and persists state. |

Stateful SDKs share the same Core concepts, but the public names differ by runtime. Use `sdk.states`
in JavaScript stateful runtimes, React provider callbacks when a framework owns the SDK lifecycle,
Swift or Kotlin published state in native runtimes, and request objects in Node/stateless runtimes.

## State mental model

### Key state definitions

**Locale state** is the SDK Experience API and event locale. It is not a Contentful Delivery API
locale policy and changing it does not by itself refetch localized entries for your application. In
stateful JavaScript runtimes, `locale` is available as `sdk.locale` and `sdk.states.locale`;
`setLocale()` updates the state signal, future Experience API requests, and default event context.
JavaScript managed fetching can use this value only as a fallback `getEntry()` query locale when no
Contentful query locale is provided. Request-bound Node clients use `forRequest({ locale })` as that
fallback for managed Contentful entry fetching. React providers can update provider-owned SDK
instances from their `locale` prop. iOS and Android expose the same value as native `locale` state
from the bridge. Node and stateless runtimes bind locale per request with `forRequest({ locale })`.

**`experienceRequestState`** tells you what happened to the most recent Experience API request. It
starts as `{ status: 'idle' }`, changes to `{ status: 'pending' }` when a request starts, changes to
`{ status: 'success' }` when response state is published, and changes to
`{ status: 'failed', reason: 'timeout' | 'api-error' }` when the request fails. Use it when an app
needs to render a baseline entry after a personalization request times out or fails.

**`optimizationPossible`** tells you whether the current consent and allow-list configuration can
produce optimization data. It is about permission and configuration, not about data already being
available. `states.optimizationPossible` can be `true` before `states.selectedOptimizations`
contains variants. Use `states.canOptimize` when you need to know whether variant selection data is
available for entry resolution.

**Selected optimization state** is the current Experience API selection array used by stateful entry
resolution. In stateful JavaScript runtimes, `resolveOptimizedEntry(entry)` uses
`states.selectedOptimizations.current` when explicit selections are omitted. In stateful Core and
Web runtimes, `fetchOptimizedEntry(entryId)` follows the same default.

### Signals and observables

`CoreStateful` stores runtime state in [Preact Signals](https://github.com/preactjs/signals), a
reactive primitive that pushes value changes to dependent effects and computed values. Signals live
at module scope inside `core-sdk`, so all code sharing the same JavaScript module graph reads the
same signal values.

`CoreStateful` exposes consumer state through `Observable` adapters on the `states` property.
Consumers receive observables, not writable signals. Most observables deep-clone emitted values
before delivering them so consumer-side mutation cannot reach internal signal state. The high-volume
`eventStream` observable returns the SDK event object by reference for performance because event
payloads can include large Contentful entry graphs. Treat event payloads as read-only.

## State constraints

### One instance per runtime

`CoreStateful` enforces a single-instance constraint for each JavaScript runtime using a
`globalThis`-based lock. Constructing a second instance before `destroy()` is called on the first
throws an error:

```text
Stateful Optimization SDK already initialized (CoreStateful#1). Only one stateful instance is supported per runtime.
```

Because signals are module-scoped, multiple instances can interfere with each other's state. Call
`destroy()` before reinitializing during hot-module replacement or test teardown.

Native iOS and Android SDKs host one Core instance inside their bridge. React Native also enforces a
single active `ContentfulOptimization` instance. Node/stateless SDKs do not use the stateful
singleton because every event call is bound to a request object.

### Consent gating

Consent is a precondition for most event emission. The send path checks `hasConsent(methodName)`
inside Experience and Insights send methods before a queue accepts an event. When consent is `false`
or `undefined` and the event type is not allow-listed, the event is blocked, a `BlockedEvent` record
is written to `blockedEvent`, and the configured `onEventBlocked` callback is invoked in stateful
Core. Node and stateless request clients do not expose `blockedEvent` or `blockedEventStream`; they
invoke `onEventBlocked` only.

Core defaults `allowedEventTypes` to `[]`, so Core itself fails closed before consent. Platform SDKs
set runtime defaults for event types that are valid in that runtime. Web and Node use
`identify`/`page` by default, while mobile runtimes use `identify`/`screen`. You can change the list
with the `allowedEventTypes` configuration option.

Calling `consent(true)` unblocks gated events going forward and grants durable profile-continuity
persistence consent. Calling `consent({ events: true, persistence: false })` allows event emission
while keeping profile continuity session-only. Blocked events are not replayed after consent is
granted. Current-state SDK surfaces, such as automatic page or screen trackers and active flag
subscriptions, can emit a fresh event after consent when the same page, screen, or flag value is
still current and has not already produced an accepted event.

### Locale boundaries

The SDK locale affects default Experience API requests and event context. It does not modify your
Contentful client, router, native localization, or server i18n state. Fetch Contentful entries with
the application-owned CDA locale, and pass SDK locale separately when Experience API responses and
events need that locale. JavaScript managed fetching can use SDK locale only as the fallback
Contentful `getEntry()` query locale when `contentful.defaultQuery` and the per-call query omit
`locale`.

`setLocale(locale)` validates and normalizes explicit locale values. Invalid explicit values throw
without changing locale state. In stateful SDKs, changing locale affects future requests and events;
it does not automatically refetch profile state, selected optimizations, or localized Contentful
entries.

### Defaults, storage, offline, and preview state

Stateful SDKs can seed Core with `defaults.consent`, `defaults.persistenceConsent`,
`defaults.profile`, `defaults.selectedOptimizations`, and `defaults.changes`. Runtime adapters also
load persisted consent and, when persistence consent is `true`, profile-continuity data from their
platform storage before creating Core state. Explicit configured defaults take precedence over
persisted continuity values.

Storage availability is runtime-specific and best-effort. If browser, native, or React Native
storage is unavailable or a write fails, live Core state can continue in memory while durable
continuity is limited or cleared by the runtime storage path.

Offline state is represented by the `online` signal. It affects queue flushing and retry behavior;
it does not turn in-memory Core state into durable storage. Preview state is represented by
`previewPanelAttached`, `previewPanelOpen`, and preview override tooling that consumes first-party
signal access. Application code uses documented preview SDK surfaces instead of mutating preview
signals directly.

## How Core stores state

### State groups

Core state is memory-backed and signal-driven. The individual signal names matter mostly to SDK
layers. Application integrators usually need to understand these groups:

| Group                                  | What Core stores                                                                                                | Why it matters                                                                                                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Consent and persistence**            | Event consent and durable profile-continuity consent                                                            | Controls whether events can leave the runtime and whether profile-continuity data can be stored across sessions.                                                                                       |
| **Locale and request context**         | The SDK locale used by future Experience API requests and event context                                         | Keeps SDK requests aligned with the application locale without changing your Contentful client, router, or native localization state.                                                                  |
| **Experience response state**          | The active profile, selected optimizations, optimization changes, and the most recent Experience request status | Drives optimized entry resolution, Custom Flag values, readiness checks, and fail-open rendering decisions.                                                                                            |
| **Diagnostics streams**                | The most recent accepted SDK event and, in stateful Core, the most recent blocked event                         | Gives tests, debug panels, and integration diagnostics a way to observe what the SDK attempted to send.                                                                                                |
| **Preview and internal runtime state** | Preview-panel attachment and open state, online state, and registered entry-resolution context                  | Coordinates first-party preview tooling, queue behavior, and optimized-entry interaction metadata. Application code uses documented SDK and preview surfaces instead of writing these values directly. |
| **Derived readiness state**            | Computed values such as `canOptimize` and instance-level `optimizationPossible`                                 | Separates "variant data is available" from "current consent or allow-list settings can produce optimization data."                                                                                     |

`canOptimize` is derived from selected optimization data. `optimizationPossible` is different: each
`CoreStateful` instance computes it from that instance's consent state and allow-list configuration.
The exported module-level `signals` bundle does not contain `optimizationPossible`.

### Public observation surface

Every entry on `sdk.states` is an `Observable<T>` with `current`, `subscribe(next)`, and
`subscribeOnce(next)`. The observable surface maps the state groups to stable consumer names:

- **Consent and locale** - `states.consent`, `states.persistenceConsent`, and `states.locale`.
- **Experience response and readiness** - `states.profile`, `states.selectedOptimizations`,
  `states.canOptimize`, `states.optimizationPossible`, `states.experienceRequestState`, and
  `states.flag(name)`.
- **Diagnostics** - `states.eventStream` and, in stateful runtimes, `states.blockedEventStream`.
- **Preview visibility** - `states.previewPanelAttached` and `states.previewPanelOpen`.

Native SDKs do not expose `Observable<T>` directly. The iOS and Android bridges subscribe to the
same underlying Core state and republish snapshots through native state containers. Node and other
stateless runtimes do not expose `sdk.states`; request clients return data and update
`request.profile` for the current request.

### Observable snapshot behavior

The `Observable` contract has three members:

- **`current`** - Returns a snapshot of the current value. Reading it does not establish a reactive
  subscription.
- **`subscribe(next)`** - Registers a callback that is called immediately with the current value and
  again whenever the underlying source changes. Returns a `Subscription` with an `unsubscribe`
  method.
- **`subscribeOnce(next)`** - Registers a callback that fires exactly once when the first
  non-nullish value is available, then automatically unsubscribes. This is useful for one-time
  initialization that must wait for data to arrive.

Most values delivered through `current`, `subscribe`, and `subscribeOnce` are deep-cloned before
reaching your code. Mutating a received `profile`, `selectedOptimizations`, `changes`, locale,
consent, blocked-event, or flag value does not affect internal signal state.

`states.eventStream` is the exception. It returns a non-cloned reference to the SDK event object.
This avoids cloning large Contentful entry graphs that can be attached to optimized entry
interaction events. Core does not freeze that object for you, so treat event-stream payloads as
read-only and clone them before adding diagnostics or forwarding annotations.

### Why observables, not direct signal access

`core-sdk` exports the raw `signals` object and the `signalFns` helper bundle for SDK layers and
first-party preview tooling. Application code must not use those exports to read or write runtime
state directly for several reasons:

- **No isolation** - Signals expose their actual internal value. If your code mutates the object you
  receive, that mutation leaks back into the shared signal and can corrupt state for every other
  subscriber in the runtime.
- **No tracking side effects** - `states.flag(name)` does more than read a value. It attempts to
  emit flag view events to Insights so accepted flag observations are recorded. Reading the signal
  directly skips that reporting path.
- **Coupling to internals** - Signal names and shapes are implementation details. The `states`
  surface is the stable, versioned API for application consumers; signals are not.
- **Missing instance context** - `states.optimizationPossible` depends on the active `CoreStateful`
  instance's allow-list configuration. It is not available from the exported module-level `signals`
  bundle.

Use `states.*` observables in application code. Reserve `signals` and `signalFns` for SDK layers
building on top of `CoreStateful`, such as framework integrations, native bridges, and first-party
preview tooling.

## How state changes

### Main state-changing paths

Internal signals are implementation details. Application code must use supported consumer surfaces
instead of writing signal values directly. Think about state changes as a few flows:

- **Initialization** - Defaults and runtime storage seed consent, persistence consent, profile
  continuity, selected optimizations, changes, and locale before application code observes state.
- **Application decisions** - `consent(accept)` updates event and persistence consent.
  `setLocale(locale)` updates SDK locale state for future Experience API requests and event context.
- **Experience-producing events** - `identify`, `page`, `screen`, `track`, and sticky `trackView`
  send an Experience API request when consent or the allow-list permits it. A successful response
  publishes profile, selected optimizations, changes, and request status in one state batch.
- **SDK-managed entry fetching** - `fetchContentfulEntry(entryId)` and
  `fetchOptimizedEntry(entryId)` call the configured consumer-owned `contentful.js` client. They do
  not publish profile, selected optimizations, changes, or diagnostics events. Resolution reads
  current selected optimization state only when options omit explicit selections.
- **Insights and diagnostics events** - `trackView`, `trackClick`, `trackHover`, and `trackFlagView`
  can update `eventStream` when the event is accepted. Sticky `trackView` also uses the Experience
  path before sending its paired Insights event.
- **Flag reads** - `getFlag(name)` and `states.flag(name)` resolve from the current optimization
  changes. They can also attempt a deduped flag-view event for the delivered value.
- **Cleanup** - `reset()` clears volatile optimization, event, request, and entry-resolution context
  state. `destroy()` starts forced queue flushes, tears down runtime resources, and releases the
  singleton lock.

Flag reads only produce accepted flag-view delivery when event consent is `true` or
`allowedEventTypes` permits `flag` or `component`, and an active Optimization profile ID exists.
Reads before either condition is true do not update the accepted flag-view dedupe signature.

The SDK-managed Contentful entry cache is separate from optimization state. It caches CDA entries
returned by the configured `contentful.js` client and does not store profile or selected
optimization data. Use `clearContentfulEntryCache()` when application locale, preview mode,
environment, or cache policy changes make those cached entries invalid.

The package also exports raw `signals` and `signalFns` references for SDK layers and first-party
preview tooling. Those exports are not application consumer APIs. Application code must treat them
as read-only implementation details and use the methods, observables, defaults, and interceptors
described in this document.

### How the Experience API drives state

When `identify`, `page`, `screen`, `track`, or sticky `trackView` sends an Experience event,
`ExperienceQueue` manages request state and response publication:

```text
Consumer calls sdk.page()
  -> CoreStatefulEventEmitter builds event
  -> ExperienceQueue runs event interceptors, validates the event, and updates eventStream
  -> experienceRequestState becomes { status: 'pending' }
  -> ExperienceQueue sends to Experience API
  -> API returns OptimizationData { profile, selectedOptimizations, changes }
  -> State interceptors run in insertion order
  -> batch(() => {
       profile, selectedOptimizations, changes, experienceRequestState: { status: 'success' }
     }) updates changed values
  -> Exposed observables emit snapshots; flag observables re-resolve from changes
```

If the request fails, `experienceRequestState` becomes `{ status: 'failed', reason: 'timeout' }` for
request aborts or `{ status: 'failed', reason: 'api-error' }` for API and parsing failures.

Batching the success writes means downstream effects and computed signals see a consistent snapshot.
There is no intermediate state where `experienceRequestState` is `success` but `canOptimize` has not
reflected the same response.

### Runtime-specific persistence

Core state is memory-backed. Platform storage is read during initialization to seed continuity, and
live state reads use in-memory signals or native bridge snapshots. Persistence behavior differs by
runtime:

| Runtime                | Persistence path                                                                                                                                                                                                  | Publication consequence                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stateful Core          | `interceptors.state` runs before Experience response data is written to `profile`, `selectedOptimizations`, `changes`, and `experienceRequestState`.                                                              | SDK layers can await storage or transform `OptimizationData` before Core publishes response state. Core itself does not write platform storage.                   |
| React Native           | The SDK registers a state interceptor that writes Experience `OptimizationData` to AsyncStorage when persistence consent is `true`, or clears continuity when false.                                              | Experience response state is published after the interceptor completes. Consent and reset persistence use separate AsyncStorage paths.                            |
| Web                    | The SDK uses signal `effect()` handlers to mirror consent, persistence consent, profile, changes, selected optimizations, and anonymous ID to `localStorage` and cookies.                                         | Web persistence runs from signal effects after state changes. Browser storage failures are swallowed, so live state can continue as session-only.                 |
| iOS and Android native | The JS bridge uses signal effects to push Core snapshots to Swift or Kotlin. Native handlers write consent and profile-continuity values to `UserDefaults` or SharedPreferences according to persistence consent. | Native public state is republished from bridge snapshots. Native storage is platform-owned, and the JS bridge remains the source for live Core state transitions. |
| Node/stateless         | The SDK has no shared state store. `forRequest()` binds consent, locale, and profile for one request.                                                                                                             | The host application decides whether and where to persist returned profile continuity.                                                                            |

When durable persistence consent is `false` or unset, profile-continuity values are not loaded for
initial state and are not written as durable continuity for responses. The SDK can still publish
allowed in-memory state for the active runtime.

### Reset, teardown, and consent withdrawal

`reset()` clears volatile Core state in one batch: `blockedEvent`, `event`, `changes`, `profile`,
`selectedOptimizations`, and `experienceRequestState` back to `{ status: 'idle' }`. It also clears
registered optimization contexts created by `resolveOptimizedEntry()`, so later interaction calls
cannot reuse stale entry-resolution metadata.

Runtime adapters add their own reset behavior:

- Web resets current-page and entry-interaction trackers, clears the anonymous ID cookie, clears
  LocalStore profile-continuity caches, and then calls Core `reset()`.
- React Native resets current-screen tracking, starts AsyncStorage profile-continuity cleanup, and
  then calls Core `reset()`.
- Native iOS and Android bridge reset clears preview overrides, current-screen or sticky-view
  tracking state in the bridge, and Core `reset()`. Native wrappers also clear platform
  profile-continuity storage on their public `reset()` paths.

`reset()` does not change consent values. Use it for sign-out, account switching, test teardown, or
discarding the active optimization profile while preserving the application's consent decision.

`destroy()` is teardown, not a privacy reset. Core marks the instance destroyed, clears registered
optimization contexts, starts forced queue flushes, logs flush failures, clears the Insights
periodic timer, and releases the singleton lock. `destroy()` returns `void`; it does not await queue
flush completion. Web, React Native, iOS, and Android adapters also remove listeners, bridge
subscriptions, or native resources that they own. Destroying an SDK instance does not clear durable
user state by itself.

Calling `consent(false)` with a boolean sets both event consent and persistence consent to `false`.
Core clears queued Experience and Insights events when event consent becomes `false`. Platform
storage paths can also clear durable profile continuity because persistence consent becomes `false`:
Web clears LocalStore continuity and anonymous ID cookies, React Native clears AsyncStorage
continuity, and iOS/Android clear native profile-continuity storage from bridge state updates.

Calling `consent({ events: false })` clears queued events without changing persistence consent.
Calling `consent({ persistence: false })` keeps event consent unchanged but clears or prevents
durable continuity through runtime storage paths. Pick the shape that matches your application
policy.

## Consumer-facing state features

The TypeScript examples in this section use JavaScript stateful SDK surfaces. Web and React Native
SDK instances expose them as `sdk.states`, while React Web and React Native provider roots pass the
same observable state surface to `onStatesReady`. Node and stateless runtimes do not expose
`sdk.states`; they bind state per request with `forRequest()`. Native iOS and Android expose
equivalent state through `OptimizationClient.state`, event streams, and runtime-specific flag
helpers. When using `onStatesReady`, replace `sdk.states` with the `states` callback parameter. Use
the runtime guides in [Related docs](#related-docs) for exact Swift and Kotlin call shapes.

### Reacting to profile changes

Subscribe to `states.profile` to be notified whenever the active Optimization profile changes. This
is useful for readiness checks, diagnostics, or SDK-adjacent UI that depends on profile
availability.

Web and React Native TypeScript SDK instance:

```ts
const subscription = sdk.states.profile.subscribe((profile) => {
  setOptimizationProfileReady(profile !== undefined)
})

// Later, when the component unmounts or the SDK is no longer needed:
subscription.unsubscribe()
```

`subscribe` emits the current value immediately upon registration, so you do not need a separate
call to read the initial state. Use your application user ID for third-party analytics identity
calls. Do not pass the Optimization profile ID to a vendor `identify()` call as the known-user ID.

### Reacting to optimization variant changes

Subscribe to `states.selectedOptimizations` to respond when the set of active variants changes:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.selectedOptimizations.subscribe((variants) => {
  if (variants) {
    applyLayoutVariant(variants)
  }
})
```

Use `states.canOptimize` when you only need to know whether variant data exists, without inspecting
the variants themselves:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.canOptimize.subscribe((ready) => {
  setOptimizationReady(ready)
})
```

Use `states.optimizationPossible` when you need to know whether the current consent and allow-list
configuration can ever produce optimization data:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.optimizationPossible.subscribe((possible) => {
  setCanRequestOptimization(possible)
})
```

If you need to act once, for example to set an initial variant before rendering, use
`subscribeOnce`:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.selectedOptimizations.subscribeOnce((variants) => {
  renderInitialLayout(variants)
})
```

`subscribeOnce` skips `null` and `undefined` and delivers the first non-nullish value, then
unsubscribes automatically.

### Reading a Custom Flag value reactively

`states.flag(name)` returns an `Observable<Json>` that resolves the Custom Flag value from the
internal `changes` signal. The observable emits when the resolved value changes:

Web and React Native TypeScript SDK instance:

```ts
const darkModeSubscription = sdk.states.flag('dark-mode').subscribe((value) => {
  setDarkModeEnabled(value === true)
})
```

`states.flag(name).subscribe()` suppresses duplicate emitted values using deep equality and attempts
to emit a flag view event for each delivered value. `states.flag(name).current` represents a direct
read, and `getFlag(name)` is nonreactive. Accepted flag-view delivery requires consent or allow-list
permission plus an active Optimization profile ID. When either condition is missing, the read still
returns the flag value but does not emit an accepted flag-view event.

All flag-view paths deduplicate accepted flag-view signatures, so repeated reads of the same value
for the same active profile do not emit duplicate flag-view events. A read blocked before consent or
skipped before profile state exists does not count as accepted, so the current flag value can still
produce a fresh flag-view event after the missing condition is satisfied.

If you forward Custom Flag values to a third-party analytics destination, use the same flag read or
render path that your application already owns. Adding a `states.flag(name)` subscription only for
third-party forwarding can create an additional Contentful flag-view observation when delivery
conditions are met.

Native equivalents: iOS uses `client.getFlag(_:)` and `client.flagPublisher(_:)`; Android uses
`client.getFlag(name)` and `client.observeFlag(name)`.

### Providing consent

Consent is a precondition for most event emission. Set it with the `consent` method:

Web and React Native TypeScript SDK instance; React Web uses `useOptimizationActions().setConsent`
with the same arguments:

```ts
// Grant consent after application policy allows SDK event emission.
sdk.consent(true)

// Allow events but keep durable profile continuity disabled.
sdk.consent({ events: true, persistence: false })

// Revoke event and persistence consent.
sdk.consent(false)
```

React to the current consent value through `states.consent`:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.consent.subscribe((value) => {
  updateConsentBadge(value)
})
```

The SDK does not provide a consent UI. Consent policy, including when to ask, what to display, and
how to store any user choice, belongs to your application. If application policy permits SDK
activity by default, stateful SDKs can start from `defaults.consent: true` instead of rendering an
end-user consent UI. The SDK exposes `consent()` to receive runtime changes and `states.consent` to
let your application reflect them. Use `states.persistenceConsent` when the application needs to
reflect whether durable profile-continuity storage is allowed separately from event emission.

### Provider-managed framework subscriptions

React Web and React Native provider roots accept `onStatesReady` for app-level subscribers that need
provider coordination instead of application code polling or waiting for an SDK instance. This
addresses both common timing problems: the SDK state surface might not exist yet when application
code tries to subscribe, or the SDK might already have existed long enough for initial router,
screen, or blocked-event data to be missed. The callback receives only the `states` surface and can
return a cleanup function:

React Web and React Native TSX provider root:

```tsx
<OptimizationRoot
  clientId="my-client-id"
  onStatesReady={(states) => {
    const subscription = states.eventStream.subscribe((event) => {
      if (event) devToolsPanel.logEvent(event)
    })

    return () => {
      subscription.unsubscribe()
    }
  }}
>
  <App />
</OptimizationRoot>
```

`onStatesReady` complements, but does not replace, `onEventBlocked`. Use `onEventBlocked` for one
startup callback dedicated to blocked events. Use `onStatesReady` when a framework app needs a clear
provider-owned place to subscribe to `eventStream`, `blockedEventStream`, or other observables as
soon as SDK state is available and before child router, screen, or entry effects run. Each
subscription still immediately emits its current snapshot.

Both framework roots set up provider-owned SDK instances outside render and expose provider-owned
state only after the relevant runtime setup path has started. React Web creates a snapshot runtime
for the first render, then hydrates or creates the live browser SDK in a layout effect so ready
children normally mount before first visible paint. React Native keeps async effect scheduling
because SDK creation depends on platform storage and device state. When a framework adapter injects
an already-created SDK, children can render immediately unless `onStatesReady` is provided. React
Web seeds the initial snapshot from `handoff` when server/static/edge handoff data is provided, so
children can render from that state before the live SDK takes over.

## Diagnostics

### Diagnosing blocked events

Subscribe to `states.blockedEventStream` to receive details about any event that consent gating
prevented from being sent:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.blockedEventStream.subscribe((blocked) => {
  if (!blocked) return

  console.warn(`${blocked.method} was blocked (reason: ${blocked.reason})`)
})
```

This is useful during integration testing and consent-flow debugging. Use `blocked.method` to see
which SDK method was blocked and `blocked.reason` to confirm that consent gating blocked it.
`blockedEventStream` is a stateful SDK surface. Node and other stateless request clients invoke
`onEventBlocked` for blocked events and do not write a blocked-event stream.

You can also handle blocks at construction time using the `onEventBlocked` config option:

Web and React Native TypeScript SDK instance:

```ts
const sdk = new ContentfulOptimization({
  clientId: 'my-client-id',
  onEventBlocked: (blocked) => {
    logger.warn('Optimization event blocked', blocked)
  },
})
```

In stateful SDKs, `onEventBlocked` and `states.blockedEventStream` carry the same information. Use
`states.blockedEventStream` when you need to subscribe and unsubscribe dynamically; use
`onEventBlocked` when you want a single startup handler. In Node and stateless request clients,
`onEventBlocked` is the available blocked-event diagnostic surface.

### Auditing all emitted events

`states.eventStream` emits the most recent event that passes through the SDK, whether it goes to the
Experience API or the Insights API:

Web and React Native TypeScript SDK instance:

```ts
sdk.states.eventStream.subscribe((event) => {
  if (event) {
    devToolsPanel.logEvent(event)
  }
})
```

This is useful for building debugging overlays, integration tests that assert on emitted payloads,
or custom telemetry pipelines that operate alongside the SDK's own delivery.

Native public adapters can expose different replay behavior from Core observables. The iOS
`client.eventStream` Combine publisher is passthrough and does not replay the latest Core event to
late subscribers.

Sticky `trackView()` calls produce two `eventStream` records for one semantic view: an Experience
record followed by a paired Insights record. They have distinct `messageId` values, so analytics
integrations that need one exposure must dedupe by semantic fields such as `viewId`, `componentId`,
`experienceId`, and `variantIndex`.

## Extending Core: interceptors

Interceptors are advanced SDK-layer extension points. Use them when a cross-cutting concern must run
inside the SDK send or publication path. Keep ordinary application decisions, such as whether a
particular button click emits an event, in application code before calling the SDK.

### Event interceptors

`CoreBase` exposes an `interceptors.event` `InterceptorManager` that lets you transform or inspect
events before they are validated and sent. Event interceptors run on stateful SDK event send paths
and on Node/stateless request send paths. An interceptor is a function that receives a
`Readonly<InsightsEvent | ExperienceEvent>` and returns a possibly async event of the same type:

Web, React Native, and Node TypeScript SDK instance:

```ts
const interceptorId = sdk.interceptors.event.add(async (event) => {
  // Return a new object. Do not mutate the readonly input.
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
> The `value` parameter is typed `Readonly<T>`. Return a new or safely updated object instead of
> mutating the input. The parameter is readonly by contract, and returning new values keeps ordering
> and downstream behavior explicit.

### State interceptors

`interceptors.state` applies the same mechanism to `OptimizationData` responses from the Experience
API before Core writes them to `profile`, `selectedOptimizations`, `changes`, and
`experienceRequestState`. State interceptors run during stateful Experience response publication:

Web and React Native stateful TypeScript SDK instance:

```ts
sdk.interceptors.state.add((data) => {
  // Normalize all trait keys to lowercase.
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
sees the transformed values. SDK layers can also use async state interceptors for runtime work that
must complete before Experience response state is published.

Node and other stateless request clients do not run `interceptors.state`; transform returned
`OptimizationData` or `request.profile` in application code.

### When to use interceptors

Interceptors are the right tool when you need to:

- Enrich every outgoing event with shared context, such as device info, app version, or session ID.
- Filter or redact fields in events before they leave the device.
- Transform incoming optimization state in a stateful SDK layer before subscribers observe it.
- Instrument event delivery for testing or observability without modifying application code.
- Await platform persistence before response state is published in a runtime that requires that
  ordering.

Interceptors are not appropriate for conditionally suppressing events based on business logic. If
you need to decide whether an event fires at all, that decision belongs in application code before
the SDK method is called.

## What not to do: direct signal mutation

`core-sdk` exports the `signals` bundle, which gives SDK layers a reference to internal signals.
Writing to a signal directly, such as `signals.profile.value = newProfile`, bypasses every layer
that makes state changes coherent:

- No consent check. A direct write fires even when consent is `false`.
- No interceptors. Event and state interceptors are skipped.
- No queue coordination. The queues hold their own pending state; a direct signal write does not
  flush or reconcile the queue.
- No batch guarantee. Writing multiple signals outside a `batch()` call can trigger intermediate
  reactive states that subscribers see before all changes are applied.
- No observable cloning boundary. Signal readers receive a reference to the exact object you wrote.
  If you mutate that object later, every reader of that signal sees the mutation.
- No native or framework lifecycle coordination. Runtime adapters rely on supported Core methods and
  state publication paths to keep storage, bridges, and provider lifecycles aligned.

If you find yourself wanting to write to a signal directly, use one of the patterns above instead: a
method call, a state interceptor, or a `defaults` configuration value.

The `signals` and `signalFns` exports are intended for SDK layers that extend `CoreStateful`, such
as the Web SDK, React Native SDK, native JS bridge, and first-party preview tooling. They are not
part of the application consumer API.

## Related docs

- [Optimization SDK guides](../guides/README.md)
- [Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the Optimization React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the Optimization Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md)
- [Integrating the Optimization React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md)
- [Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
- [Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md)
- [Integrating the Optimization Android SDK in a Jetpack Compose app](../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md)
- [Integrating the Optimization Android SDK in an Android Views app](../guides/integrating-the-optimization-android-sdk-in-a-views-app.md)
- [Optimization Web SDK README](../../packages/web/web-sdk/README.md)
- [Optimization React Web SDK README](../../packages/web/frameworks/react-web-sdk/README.md)
- [Optimization React Native SDK README](../../packages/react-native-sdk/README.md)
- [Optimization Node SDK README](../../packages/node/node-sdk/README.md)
- [Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md)
- [Optimization Android SDK README](../../packages/android/README.md)
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md)
- [Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md)
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md)
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md)
- [React Native SDK interaction tracking mechanics](./react-native-sdk-interaction-tracking-mechanics.md)
- [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md)
- [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md)
