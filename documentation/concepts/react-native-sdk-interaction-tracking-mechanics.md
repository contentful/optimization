---
title: React Native SDK interaction tracking mechanics
---

# React Native SDK interaction tracking mechanics

Use this concept document to understand what the `@contentful/optimization-react-native` SDK tracks,
when each event fires, and how events leave the device. The goal is to make tracking behavior
predictable before you debug an entry view, tap, screen, or custom event in a running app.

For step-by-step setup, see
[Integrating the Optimization React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md).
For the entry resolution model that supplies tracking metadata, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md).

## Runtime boundary

This document applies to React Native applications that use `@contentful/optimization-react-native`.
The package is a stateful mobile runtime built on the shared Core SDK. It adds React providers,
hooks, `OptimizedEntry`, React Navigation helpers, AsyncStorage persistence, NetInfo connectivity
handling, and app lifecycle flushing.

The SDK does not own application routing, consent UI, identity policy, Contentful entry fetching, or
final rendering. Applications fetch entries, choose locales, render UI, and call `consent(...)` from
their own policy layer. The SDK observes mounted React Native components and sends events through
the shared Core event pipeline.

## Prerequisites and runtime constraints

Decide these policies before initialization because they control which events can leave the device
and which state can survive a process restart:

| Constraint           | React Native behavior                                                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent              | Consent starts as unset unless `defaults.consent` or persisted SDK consent provides a value. Until event consent is `true`, the React Native default allow-list permits `identify` and `screen`; entry views, taps, `page`, and custom `track` events do not emit unless `allowedEventTypes` permits them. |
| Persistence consent  | Boolean `consent(true)` and `consent(false)` update event consent and durable profile-continuity persistence consent together. Use object-form consent when event emission and durable profile continuity follow separate policy decisions.                                                                |
| Allowed event types  | `allowedEventTypes` replaces the React Native default pre-consent allow-list. Keep it narrow and align it with the application's privacy review. For interaction tracking, use `component` for entry views, `component_click` for taps, and `flag` or `component` for Custom Flag views.                   |
| Active profile       | Insights events need a current Optimization profile. Hydrate a persisted or default profile, or bootstrap one through an Experience path such as `identify`, `screen`, `page`, `track`, or a sticky entry view before relying on entry views, taps, or flag views.                                         |
| Scroll context       | View tracking needs both entry layout and viewport position. Wrap scrollable screens in `OptimizationScrollProvider`; otherwise the hook assumes `scrollY = 0` and only screen-height visibility is considered.                                                                                            |
| Storage availability | AsyncStorage persists SDK consent and, when persistence consent is `true`, profile-continuity values such as profile, anonymous ID, selected optimizations, and pending changes. Live state reads use in-memory SDK state after startup.                                                                   |
| Preview mode         | The preview panel is an application opt-in surface. Mount it only in authoring or development flows; opening it forces live entry updates so audience and variant overrides are visible immediately.                                                                                                       |
| Offline behavior     | Insights queueing and offline Experience buffering are in memory. NetInfo lets the SDK pause flushing while offline and resume on reconnect. Background or inactive app transitions trigger a `flush()` and AsyncStorage drain, but the SDK does not provide a durable outbox across process death.        |
| Configured defaults  | Startup defaults apply before provider children mount. Use `defaults={{ consent: true }}` only for default-on application policies; do not set default consent later from a child effect because child tracking effects can run before that policy is applied.                                             |

## Mental model

If you mount `OptimizationRoot`, wrap React Navigation with `OptimizationNavigationContainer`, and
wrap Contentful entries in `<OptimizedEntry />`, the SDK gives you these tracking behaviors:

- **Entry view tracking** - Initial event after 2 s at 80% or greater visibility, periodic updates
  every 5 s while visible, and a final event when visibility ends after an event has already fired.
- **Screen tracking** - A `screen` event on every active route change.
- **Default pre-consent `identify` and `screen` events** - The React Native default allows these
  events before event consent. A custom `allowedEventTypes` list can allow fewer, more, or different
  event types.
- **Profile-gated Insights events** - Entry views, taps, and flag views are Insights events. They
  need a current profile from an Experience path before the Insights queue accepts them.
- **Offline queueing and background flushing** - When `@react-native-community/netinfo` is
  installed, Insights events and offline Experience events flush after connectivity returns and when
  the app moves toward the background.
- **Persistence across launches** - AsyncStorage restores consent state and, when persistence
  consent permits it, profile-continuity values such as profile, anonymous ID, and selected
  optimizations.

Applications still own these choices:

- **Tap tracking opt-out** - Taps are tracked by default. Disable them with
  `trackEntryInteraction={{ taps: false }}` or `trackTaps={false}` when an entry must not emit tap
  events.
- **Scroll-aware view tracking** - Wrap scrollable content in `<OptimizationScrollProvider>`.
- **Consent UI** - The SDK exposes `consent(true | false | { events, persistence })`; the banner or
  CMP integration belongs to the application.
- **Manual tracking for non-Contentful surfaces** - Use `track({ event, properties })`,
  `trackView({ componentId, viewId, viewDurationMs, ... })`, or `trackClick(...)` from the SDK
  instance.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime boundary](#runtime-boundary)
- [Prerequisites and runtime constraints](#prerequisites-and-runtime-constraints)
- [Mental model](#mental-model)
- [Events the SDK emits](#events-the-sdk-emits)
  - [Automatic events](#automatic-events)
  - [Manual events](#manual-events)
- [Event delivery from the device](#event-delivery-from-the-device)
  - [API paths](#api-paths)
  - [Queueing, flushing, and offline](#queueing-flushing-and-offline)
  - [Persistence via AsyncStorage](#persistence-via-asyncstorage)
- [Consent gating](#consent-gating)
  - [Why is nothing tracking?](#why-is-nothing-tracking)
- [Entry view tracking mechanics](#entry-view-tracking-mechanics)
  - [Default visibility and timing](#default-visibility-and-timing)
  - [The visibility state machine](#the-visibility-state-machine)
  - [Initial, periodic, and final events](#initial-periodic-and-final-events)
  - [App backgrounding and cleanup](#app-backgrounding-and-cleanup)
- [Scroll context and viewport resolution](#scroll-context-and-viewport-resolution)
  - [Inside OptimizationScrollProvider](#inside-optimizationscrollprovider)
  - [Outside OptimizationScrollProvider](#outside-optimizationscrollprovider)
- [Tap tracking semantics](#tap-tracking-semantics)
- [Screen tracking paths](#screen-tracking-paths)
  - [OptimizationNavigationContainer](#optimizationnavigationcontainer)
  - [useScreenTracking](#usescreentracking)
  - [useScreenTrackingCallback](#usescreentrackingcallback)
- [Configuration guidance](#configuration-guidance)
- [Manual tracking guidance](#manual-tracking-guidance)
- [Lifecycle summary](#lifecycle-summary)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Events the SDK emits

"Tracking" in the React Native SDK is a small, fixed set of event types. Some are fired by the SDK
as a side effect of component rendering and user behavior; others are explicit method calls you make
from application code.

### Automatic events

These are emitted by the SDK without an application-level call when consent or `allowedEventTypes`
permits the event type and the relevant provider or component is mounted. Insights-backed automatic
events also need an active profile.

| Event                             | When it fires                                                                                                | Required wiring                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Screen view**                   | Each time the active navigation route changes.                                                               | `<OptimizationNavigationContainer>` wrapping `NavigationContainer` (or `useScreenTracking` on each screen). |
| **Entry view (initial)**          | When a wrapped entry has accumulated enough visible time (default 2000 ms at ≥ 80% visibility).              | `<OptimizedEntry baselineEntry={entry}>` with view tracking enabled (the default).                          |
| **Entry view (periodic updates)** | Every `viewDurationUpdateIntervalMs` (default 5000 ms) while the entry remains visible.                      | Same as above.                                                                                              |
| **Entry view (final)**            | When visibility ends (scrolled away, unmounted, or app backgrounded) _if_ at least one event already fired.  | Same as above.                                                                                              |
| **Entry tap**                     | On touch end, when the touch moved less than 10 points from touch start, on a wrapped entry.                 | `<OptimizedEntry>` with tap tracking enabled (the default; opt out with `trackTaps={false}`).               |
| **Flag view**                     | Attempted when a flag value is read or a subscribed value is delivered; accepted emissions are deduplicated. | Any `getFlag(...)` call or `states.flag(...)` subscription.                                                 |

### Manual events

Use these SDK instance methods from `useOptimization()` when a screen, component, or business event
doesn't fit the `OptimizedEntry` pattern. The generated reference owns full argument shapes.

| SDK method         | Delivery path and consequence                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `identify`         | Experience path. Associates a known user ID and traits with the profile and can bootstrap the active profile.                     |
| `screen`           | Experience path. Adds route context to the profile; React Native allows it before consent by default unless configured otherwise. |
| `page` and `track` | Experience path. Use for non-navigation context or business events.                                                               |
| `trackView`        | Insights path as wire type `component`; when `sticky: true`, also sends a sticky view through Experience.                         |
| `trackClick`       | Insights path as wire type `component_click`.                                                                                     |

React hook helpers can call those SDK methods for you. `useScreenTrackingCallback` is a hook, not an
SDK instance method; it returns an imperative callback for dynamic screen names, calls `screen`
directly, and does not apply current-route deduplication.

## Event delivery from the device

### API paths

The SDK talks to two HTTP endpoints, both defaulting to Ninetailed hosts:

| API                | Default base URL                         | Purpose                                                                                                       |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Experience API** | `https://experience.ninetailed.co/`      | Profile evaluation and updates for identify, page, screen, track, sticky entry views, and variant resolution. |
| **Insights API**   | `https://ingest.insights.ninetailed.co/` | Fire-and-forget Analytics interaction events: entry views, taps or clicks, and flag views.                    |

Both are configurable through SDK `api` configuration. The
[React Native SDK README](../../packages/react-native-sdk/README.md#common-configuration) and
[generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-react-native.html)
own the full configuration surface.

A single user action can touch either or both APIs. `trackView({ sticky: true })` delivers through
Experience first because sticky views become part of the profile, then through Insights. Plain
`trackView` only hits Insights; `identify` only touches Experience.

Insights delivery has one extra gate after consent: the SDK must have a current profile. If an entry
view, tap, or flag view reaches `InsightsQueue` before `sdk.states.profile.current` exists, the
queue logs a warning and drops the event before it can be batched. In practice, hydrate a persisted
profile, call `identify`, emit `screen`, or send another Experience event before depending on
Insights-backed interaction data.

Third-party analytics integrations that need one exposure for a sticky view must dedupe by semantic
fields such as `viewId`, `componentId`, `experienceId`, and `variantIndex`, not by `messageId`.

### Queueing, flushing, and offline

Insights and Experience use different delivery shapes:

- **Insights events** are queued by profile in memory and batched for the Insights API. Consent,
  active profile state, online state, and flush policy all affect whether they leave the device.
- **Experience events** call `upsertProfile` immediately while online. When offline, the SDK buffers
  them in memory and replays them through `upsertProfile` after reconnect. Retry and backoff are
  configurable via `queuePolicy.flush`.

The React Native SDK layers React Native-specific behavior on top:

1. **Online/offline detection** via `@react-native-community/netinfo`. When offline, the SDK buffers
   eligible in-memory events; when `isInternetReachable` (preferred) or `isConnected` flips back to
   `true`, the SDK resumes flushing. If NetInfo is not installed, the SDK logs a warning and stays
   always online. Tracking continues, but offline durability is reduced.
2. **Background flushing.** On `AppState` transition to `background` or `inactive`, the SDK calls
   `flush()` and drains pending AsyncStorage persistence before the OS might suspend the process.
3. **Final view event on background.** If an entry is mid-visibility-cycle when the app backgrounds,
   `useViewportTracking` pauses, emits a final view event if at least one event already fired, and
   resets.

`queuePolicy.offlineMaxEvents` caps offline Experience events, and `queuePolicy.onOfflineDrop` is
called when older offline Experience events are dropped to honor that cap. Insights events share the
flush policy, but these two offline drop controls belong to the Experience queue. See the
[React Native SDK README](../../packages/react-native-sdk/README.md#common-configuration) for the
common queue configuration entry point.

### Persistence via AsyncStorage

`AsyncStorageStore` persists consent-related state independently from profile-continuity values:

| Key                       | Contents                                 |
| ------------------------- | ---------------------------------------- |
| `CONSENT_KEY`             | `'accepted'`, `'denied'`, or absent.     |
| `PERSISTENCE_CONSENT_KEY` | `'accepted'`, `'denied'`, or absent.     |
| `DEBUG_FLAG_KEY`          | Forces `logLevel` to `'debug'` when set. |

Profile-continuity values persist and reload only when persistence consent allows durable storage:

| Key                                | Contents                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROFILE_CACHE_KEY`                | The aggregated profile returned from the Experience API.                                                                                          |
| `SELECTED_OPTIMIZATIONS_CACHE_KEY` | Current audience/variant assignments. Drives which variant renders on next launch.                                                                |
| `ANONYMOUS_ID_KEY`                 | Profile-continuity identifier used for future Experience requests; updated from Experience response `profile.id`, including `identify` responses. |
| `CHANGES_CACHE_KEY`                | Pending profile changes.                                                                                                                          |

Persistence is best-effort; write failures keep the SDK running on in-memory state. Structured
values are schema-validated on load; malformed JSON is evicted.

AsyncStorage is not the source for live state reads after SDK initialization. The SDK hydrates
allowed continuity values into memory during startup, then `sdk.states`, entry rendering, tracking
metadata, and later Experience requests read from in-memory SDK state.

AsyncStorage writes are serialized. When persistence consent permits durable profile continuity,
Experience responses from `identify`, `page`, `screen`, `track`, or sticky `trackView` are mirrored
to storage before the SDK publishes the resulting profile, selected optimizations, or changes
through `sdk.states`. If AsyncStorage rejects a write, the SDK logs the failure and publishes the
in-memory state only after that failure has been handled.

Why this matters for tracking: when persistence consent permits durable profile continuity, selected
optimizations persist, so a user placed in Variant B continues to see it on the next launch. View
and tap events carry the correct `experienceId` and `variantIndex` without re-round-tripping
Experience first.

## Consent gating

The SDK gates event emission behind a three-valued consent state: `true`, `false`, or `undefined`
(unset). This is the most common cause of "tracking isn't working" during integration. Without
`defaults.consent: true` or a banner that calls `optimization.consent(true)`, the SDK emits only
event types permitted by `allowedEventTypes`. React Native permits `identify` and `screen` by
default.

| Consent     | Behavior                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `undefined` | Only `allowedEventTypes` emit. React Native default: `['identify', 'screen']`. Entry views, taps, track, and page events do not emit unless explicitly allowed. |
| `true`      | All event types can emit, subject to other runtime gates such as active profile state for Insights events.                                                      |
| `false`     | Same as `undefined`: only `allowedEventTypes` emit. Persists until `consent(true)` is called again.                                                             |

To change the default pre-consent allow-list, pass `allowedEventTypes` to `OptimizationRoot`:

```tsx
<OptimizationRoot clientId={CLIENT_ID} allowedEventTypes={['identify', 'screen', 'page']}>
  <App />
</OptimizationRoot>
```

For default-on application policies without an end-user consent prompt, set
`defaults={{ consent: true }}` on `OptimizationRoot` during initialization. Avoid setting default
consent later from a component effect; that delays persistence policy until after child effects can
start emitting events.

When consent flips:

- **`consent(true)`** - New events flow normally. Blocked events are _not_ retroactively replayed;
  they were dropped at the guard. SDK method calls that reach Core report consent blocks through
  `onEventBlocked` and `states.blockedEventStream`; some automatic React Native paths skip before
  calling Core and do not produce blocked-event diagnostics. Event consent and durable
  profile-continuity persistence consent persist to AsyncStorage.
- **`consent({ events: true, persistence: false })`** - New events flow normally, but profile,
  selected optimizations, changes, and the anonymous ID stay session-only until persistence consent
  is granted.
- **`consent(false)`** - The allow-list gate re-engages. Queued events that already cleared the
  guard are purged from SDK queues. SDK-managed durable profile-continuity storage is cleared.

### "Why is nothing tracking?"

Five checks, in order of likelihood:

1. **Consent.** Without `defaults.consent: true`, user acceptance, or a matching `allowedEventTypes`
   entry, the SDK does not emit the event. Set `logLevel: 'info'` to see Core-blocked SDK method
   calls in the console, but also check automatic React Native guards because entry views, taps, and
   current-screen tracking can skip before Core is called.
2. **Active profile.** Insights-backed views, taps, and flag views drop before batching when no
   current profile exists.
3. **Tap tracking opt-out.** Views and taps default to `true`; check for root or per-entry
   `taps: false` or `trackTaps={false}` overrides.
4. **Visibility requirement.** Defaults are strict (80% for 2 s). Scroll-by content never fires.
5. **No scroll context.** An entry below the fold without `<OptimizationScrollProvider>` will never
   pass the visibility requirement because `scrollY` is assumed `0`.

## Entry view tracking mechanics

This section describes the internals of `useViewportTracking`, the hook `<OptimizedEntry />` uses
under the hood.

### Default visibility and timing

The default entry view settings are:

| Constant                                   | Value  | Meaning                                                                                                              |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `DEFAULT_MIN_VISIBLE_RATIO`                | `0.8`  | Minimum visibility ratio (0.0 to 1.0). An entry is "visible" when at least 80% of its height is within the viewport. |
| `DEFAULT_DWELL_TIME_MS`                    | `2000` | Minimum accumulated visible time (ms) before the **initial** view event fires.                                       |
| `DEFAULT_VIEW_DURATION_UPDATE_INTERVAL_MS` | `5000` | Interval (ms) between **periodic** duration update events after the initial event.                                   |

Tap tracking has one additional requirement:

| Constant                 | Value | Meaning                                                                                                                            |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `TAP_DISTANCE_THRESHOLD` | `10`  | Maximum pixel distance between `touchStart` and `touchEnd`. Beyond this, the gesture is classified as a scroll or drag, not a tap. |

### The visibility state machine

Each mounted `<OptimizedEntry>` runs a small state machine keyed on a "visibility cycle". A cycle
starts when the entry goes from not visible to visible, and ends when it transitions back or
unmounts. State lives in refs (not React state) to avoid re-rendering on every scroll tick:

```ts
interface ViewCycleState {
  viewId: string | null // UUID; correlates all events in this cycle
  visibleSince: number | null // Timestamp of last visibility entry; null while paused
  accumulatedMs: number // Running total of visible time
  attempts: number // Number of view events already emitted
}
```

On every scroll tick or layout change, `checkVisibility()` computes the overlap between the entry's
measured `{y, height}` and the current viewport `{scrollY, viewportHeight}` to derive a
`visibilityRatio`, and compares it to `minVisibleRatio`:

- **Not visible to visible** - `onVisibilityStart` resets the cycle, mints a fresh `viewId`, sets
  `visibleSince = now`, and schedules the next fire.
- **Visible to not visible** - `onVisibilityEnd` clears the fire timer, records the final
  accumulated duration, emits a **final** event if `attempts > 0`, and resets the cycle.

### Initial, periodic, and final events

Within a cycle, events fire based on accumulated visible time. The schedule mirrors the Web SDK's
`ElementViewObserver`:

```
requiredMs_for_event_N = dwellTimeMs + N * viewDurationUpdateIntervalMs
```

So with defaults:

| Event       | When it fires (from cycle start)         |
| ----------- | ---------------------------------------- |
| Initial     | 2000 ms accumulated visible              |
| Periodic #1 | 7000 ms accumulated visible              |
| Periodic #2 | 12 000 ms accumulated visible            |
| Periodic #N | `2000 + N * 5000` ms accumulated visible |
| Final       | At `onVisibilityEnd`, if `attempts > 0`  |

Accumulation applies only inside the current visibility cycle. Leaving visibility ends the cycle,
clears the fire timer, and resets accumulated time after any eligible final event is emitted. If the
user scrolls away at 1.5 s and returns later, the return starts a fresh dwell timer from 0 ms with a
new `viewId`.

A few consequences:

- **An entry briefly scrolled into view (< 2 s total) fires no events.** The initial gate is never
  crossed, so the final event is suppressed (guarded by `attempts > 0`).
- **An entry scrolled into view for 2 s and then immediately unmounted** fires one initial event,
  then one final event from the unmount cleanup effect.
- **Each event carries `viewDurationMs`**, computed from the cycle's accumulated time at the moment
  of emission. The sequence of events for a 12 s continuous view is: initial (~2000 ms), periodic
  (~7000 ms), periodic (~12 000 ms), final (~12 000 ms).
- **Each event also carries `viewId`**, the UUID for the cycle. All events in one cycle share a
  `viewId`; a new cycle gets a fresh one. Use `viewId` downstream to correlate.

### App backgrounding and cleanup

Two additional transitions matter:

1. **AppState background or inactive transition.** The hook listens to `AppState` changes. On
   transition to `background` or `inactive`, it clears the fire timer, pauses accumulation, and
   emits a final event before resetting the cycle and marking `isVisibleRef.current = false` when
   `attempts > 0`. When the app becomes `active` again, it re-checks visibility from scratch, which
   starts a new cycle if the entry is still on screen.

2. **Component unmount.** The unmount cleanup clears the fire timer and, if the cycle had any
   successful events (`attempts > 0`), flushes a final view event synchronously.

Combined, these transitions mean that when the initial event has fired, the hook emits a final event
with the same `viewId` and the cycle duration when visibility ends naturally, the user backgrounds
the app, or the component unmounts.

## Scroll context and viewport resolution

`useViewportTracking` needs the entry's position (`{y, height}` from `onLayout`) and the viewport
(`{scrollY, viewportHeight}`). Where the viewport comes from depends on whether the entry sits
inside `<OptimizationScrollProvider>`.

### Inside OptimizationScrollProvider

`OptimizationScrollProvider` wraps React Native's `ScrollView` and publishes the current `scrollY`
and layout height through context. The hook reads scroll on every event (`scrollEventThrottle={16}`,
~60 FPS) and recomputes visibility.

Use this for any scrollable screen. Without it, entries below the fold never transition to visible
no matter how far the user scrolls.

```tsx
<OptimizationScrollProvider>
  <OptimizedEntry baselineEntry={post}>
    <ArticleBody post={post} />
  </OptimizedEntry>
</OptimizationScrollProvider>
```

The [React Native reference implementation](../../implementations/react-native-sdk/README.md)
demonstrates this scroll-provider pattern in its entry list.

### Outside OptimizationScrollProvider

With no scroll context, the hook falls back to screen dimensions: `scrollY = 0` and viewport =
`Dimensions.get('window').height` with an orientation listener.

This is correct for full-screen non-scrollable layouts, hero or banner content always on screen, and
modal content. It is _wrong_ for anything below the fold in a `ScrollView`; wrap those.

## Tap tracking semantics

Tap tracking is implemented by `useTapTracking`. Behavior:

1. The wrapping `View` gets `onTouchStart` and `onTouchEnd`, not `onPress`. Raw touch events mean
   **taps are captured even when a child `Pressable` also handles the press**. A `Pressable` wrapper
   gives the child's `onPress` precedence.
2. `onTouchStart` records `{ pageX, pageY }`.
3. `onTouchEnd` computes Euclidean distance from start to end. Under `TAP_DISTANCE_THRESHOLD` (10
   points) is a tap; over 10 points is treated as a scroll or drag and ignored.
4. On a valid tap, the hook checks `hasConsent('trackClick')`. When allowed, it calls
   `optimization.trackClick({ componentId, experienceId, variantIndex })` (wire type
   `component_click`) for the Analytics event. If `onTap` was passed on `<OptimizedEntry>`, the hook
   also invokes that application callback synchronously with the resolved entry, even when the
   Analytics tap event is not emitted.

Tap tracking is **on by default**. Disable it with
`<OptimizationRoot trackEntryInteraction={{ taps: false }}>` or
`<OptimizedEntry trackTaps={false}>`. Passing `onTap` keeps tap tracking enabled unless
`trackTaps={false}` is set on the entry. `onTap` is application behavior, not Analytics emission, so
a consent guard for `trackClick` can skip the event while the app callback still runs.

## Screen tracking paths

Screen tracking emits Experience `screen` events. React Native allows these events before consent by
default, and the SDK uses them for route-based profile attribution. A custom `allowedEventTypes`
list can make screen tracking stricter.

### OptimizationNavigationContainer

The highest-automation path wraps React Navigation's `NavigationContainer` and emits a `screen`
event when the active route identity changes, including the initial ready event when allowed by
consent or `allowedEventTypes`.

Internally, the container builds a route key from the current route name. When `includeParams: true`
is set, it JSON-validates route params, attaches them to event `properties`, and includes them in
the route key. `onStateChange` compares the previous route key with the current route key, so two
routes with the same name can still emit separate screen events when params are included. The
container calls `trackCurrentScreen`, which deduplicates accepted current-route emissions. When
`screen` is not allowed, the underlying current-state tracker treats the emission as
`attempted: false` before Core is called, so that skip does not produce an `onEventBlocked` or
blocked-stream diagnostic.

### useScreenTracking

Per-screen hook for apps not using React Navigation, or when you want control over when the event
fires, such as after data loads.

```tsx
function DetailsScreen() {
  const { trackScreen } = useScreenTracking({
    name: 'Details',
    trackOnMount: false,
  })

  useEffect(() => {
    if (dataLoaded) void trackScreen()
  }, [dataLoaded, trackScreen])
}
```

With `trackOnMount: true` (the default), the hook calls `trackCurrentScreen` with the screen name as
the route key when the descriptor is ready. Changing the name changes the key and can emit again. If
automatic tracking is not allowed, the underlying current-state tracker treats the emission as
`attempted: false` without a Core blocked-event diagnostic. The returned `trackScreen` function
calls `screen` directly for manual retracking and is not current-route deduplicated.

### useScreenTrackingCallback

Returns a stable `(name, properties?) => void` callback for imperative screen tracking with names
that aren't known at render time (deep links, dynamic titles, navigation state transforms). It calls
`screen` directly and does not apply route-key deduplication.

```tsx
const trackScreen = useScreenTrackingCallback()
trackScreen('Deep Linked Article', { slug, source: 'email' })
```

## Configuration guidance

Tracking configuration is a set of gates and precedence rules, not a separate tracking system. Use
the [React Native SDK README](../../packages/react-native-sdk/README.md#common-configuration) and
[generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-react-native.html)
for exhaustive prop and type details.

- `allowedEventTypes` replaces the React Native default pre-consent list. Use `[]` for strict
  opt-in, or a narrow custom list when legal and privacy review permits specific pre-consent events.
  Use `component` for entry views, `component_click` for taps, and `flag` or `component` for Custom
  Flag views.
- `<OptimizedEntry>` view and tap props override `OptimizationRoot` `trackEntryInteraction`
  defaults. `onTap` keeps tap tracking enabled unless the entry sets `trackTaps={false}` and can run
  even when `trackClick` is not allowed.
- The preview panel forces live entry updates while it is open so authoring overrides can render
  immediately.
- `queuePolicy.flush` controls shared retry, backoff, and circuit behavior. `offlineMaxEvents` and
  `onOfflineDrop` apply to the offline Experience buffer.

Use `onStatesReady` when diagnostics or app-level observers must attach as soon as SDK state exists
and before provider children can emit `screen`, `eventStream`, or `blockedEventStream` updates.

## Manual tracking guidance

Manual tracking uses the same consent gates, profile requirements, and delivery paths as automatic
tracking. Reach for it when the event is meaningful but no `<OptimizedEntry>` lifecycle matches the
surface:

- Use `trackView` for a screen-wide or manually timed entry view. Provide a stable `viewId` and
  measured `viewDurationMs`; automatic entry tracking generates those values for each visibility
  cycle.
- Use `trackClick` when a non-Contentful wrapper still represents a component click or tap that
  Analytics must count.
- Use `track` for business events unrelated to a Contentful entry. This follows the Experience path
  and can update the profile while online.

For anything backed by a Contentful entry and visible in the viewport, prefer `<OptimizedEntry>`. It
owns the initial, periodic, and final sequencing, final-on-unmount behavior, final-on-background
behavior, and `viewId` correlation.

## Lifecycle summary

For a scrollable list screen with navigation and entry cards, tracking flows in this order:

- **Startup** - The SDK hydrates consent and, when persistence consent allows it, profile-continuity
  state from AsyncStorage before provider children mount.
- **Navigation** - `OptimizationNavigationContainer` or `useScreenTracking` sends a `screen`
  Experience event. While online, that event calls `upsertProfile` immediately and can establish the
  active profile needed by Insights.
- **Entry rendering** - `OptimizedEntry` resolves variants from current selected optimizations and
  attaches view and tap tracking metadata.
- **View cycle** - A card that stays at least 80% visible for 2 s emits the initial Insights view,
  then periodic updates every 5 s, then a final view when visibility ends if at least one view event
  already fired.
- **Tap** - A short touch movement on the wrapped entry emits a `component_click` Insights event
  when `trackClick` is allowed and calls the application `onTap` handler when provided, even when
  the Analytics event is skipped.
- **Background or offline** - Backgrounding triggers a final view for active cycles and asks queues
  to flush. Offline Insights events and offline Experience events remain in memory and replay on
  reconnect if the process survives.

## Related documentation

- [React Native SDK README](../../packages/react-native-sdk/README.md) - Package-level orientation
  and common configuration.
- [Core state management](./core-state-management.md) - Shared state, consent, persistence, event
  queues, and observable mechanics used by the React Native SDK.
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md) -
  Cross-SDK consent, persistence consent, allow-list, and withdrawal policy guidance.
- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  Contentful entry contract, variant fallback behavior, and local resolution mechanics.
- [React Native reference implementation](../../implementations/react-native-sdk/README.md) -
  Working app that exercises the React Native SDK API surface in this monorepo.
- [Integrating the Optimization React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md) -
  Step-by-step React Native integration flow.
