# React Native SDK interaction tracking mechanics

Use this concept document to understand exactly _what_ the `@contentful/optimization-react-native`
SDK is tracking, _when_ each event fires, and _how_ it leaves the device. Every number, state
transition, and gate is grounded in SDK source so you can reason about tracking behavior without
running a live experiment.

The companion
[Integrating the Optimization React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md)
walks through setup, consent, and screen wiring at a tutorial level. Read that first for "how do I
plug the SDK in?" — come back here for "why isn't my entry view firing?"

## What you get out of the box

If you drop `OptimizationRoot` at the top, wrap `NavigationContainer` in
`OptimizationNavigationContainer`, and wrap Contentful entries in `<OptimizedEntry />`, you get:

- **Entry view tracking** — initial event after 2 s at ≥ 80% visibility, periodic updates every 5 s
  while visible, final event on scroll-away / unmount.
- **Screen tracking** on every navigation change.
- **Identify/screen events before consent** (blocked events: everything else until consent is
  `true`).
- **Offline queueing and background flushing** when `@react-native-community/netinfo` is installed.
- **Persistence across launches** via AsyncStorage (consent, profile, anonymous ID, selected
  optimizations).

Things you still have to enable yourself:

- **Tap tracking** — off by default. Opt in via `trackEntryInteraction={{ taps: true }}`,
  `trackTaps`, or an `onTap` callback.
- **Accurate scroll-based view tracking** — wrap the scroll view in `<OptimizationScrollProvider>`.
- **Consent UI** — the SDK exposes `consent(true | false)`; the banner is yours.
- **Manual tracking for non-Contentful surfaces** — `optimization.trackView` / `trackClick`.

<details>
  <summary>Table of Contents</summary>

- [What you get out of the box](#what-you-get-out-of-the-box)
- [1. Events the SDK emits](#1-events-the-sdk-emits)
  - [Automatic events](#automatic-events)
  - [Manual events](#manual-events)
  - [Wire type mapping](#wire-type-mapping)
- [2. How events flow from the device](#2-how-events-flow-from-the-device)
  - [The two APIs](#the-two-apis)
  - [Queueing, flushing, and offline](#queueing-flushing-and-offline)
  - [Persistence via AsyncStorage](#persistence-via-asyncstorage)
- [3. Consent gating](#3-consent-gating)
  - ["Why is nothing tracking?"](#why-is-nothing-tracking)
- [4. Entry view tracking mechanics](#4-entry-view-tracking-mechanics)
  - [Default thresholds](#default-thresholds)
  - [The visibility state machine](#the-visibility-state-machine)
  - [Initial, periodic, and final events](#initial-periodic-and-final-events)
  - [App backgrounding and cleanup](#app-backgrounding-and-cleanup)
- [5. Scroll context and viewport resolution](#5-scroll-context-and-viewport-resolution)
  - [Inside OptimizationScrollProvider](#inside-optimizationscrollprovider)
  - [Outside OptimizationScrollProvider](#outside-optimizationscrollprovider)
- [6. Tap tracking semantics](#6-tap-tracking-semantics)
- [7. Screen tracking paths](#7-screen-tracking-paths)
  - [OptimizationNavigationContainer](#optimizationnavigationcontainer)
  - [useScreenTracking](#usescreentracking)
  - [useScreenTrackingCallback](#usescreentrackingcallback)
- [8. The configuration surface](#8-the-configuration-surface)
  - [OptimizationRoot props](#optimizationroot-props)
  - [OptimizedEntry props](#optimizedentry-props)
  - [SDK init config](#sdk-init-config)
  - [Resolution order](#resolution-order)
- [9. Manual tracking API](#9-manual-tracking-api)
  - [Payload shapes](#payload-shapes)
  - [When to reach for manual tracking](#when-to-reach-for-manual-tracking)
- [10. Putting it together](#10-putting-it-together)
- [Reference](#reference)

</details>

## 1. Events the SDK emits

"Tracking" in the React Native SDK is a small, fixed set of event types. Some are fired by the SDK
as a side effect of component rendering and user behavior; others are explicit method calls you make
from application code.

### Automatic events

These are emitted by the SDK without an application-level call, as long as consent allows and the
relevant provider/component is mounted.

| Event                             | When it fires                                                                                                              | Required wiring                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Screen view**                   | Each time the active navigation route changes.                                                                             | `<OptimizationNavigationContainer>` wrapping `NavigationContainer` (or `useScreenTracking` on each screen). |
| **Entry view (initial)**          | When a wrapped entry has accumulated enough visible time (default 2000 ms at ≥ 80% visibility).                            | `<OptimizedEntry entry={entry}>` with view tracking enabled (the default).                                  |
| **Entry view (periodic updates)** | Every `viewDurationUpdateIntervalMs` (default 5000 ms) while the entry remains visible.                                    | Same as above.                                                                                              |
| **Entry view (final)**            | When visibility ends (scrolled away, unmounted, or app backgrounded) _if_ at least one event already fired.                | Same as above.                                                                                              |
| **Entry tap**                     | On touch end, when the touch moved less than 10 points from touch start, on a wrapped entry.                               | `<OptimizedEntry>` with tap tracking enabled (off by default; opt in via `trackTaps` or `onTap`).           |
| **Flag view**                     | Internally emitted when a flag value changes (deduplicated via deep equality). Not strictly an interaction; worth knowing. | Any `getFlag(...)` call or `states.flag(...)` subscription.                                                 |

### Manual events

Call these on the SDK instance from `useOptimization()`. Use them for screens or components that
don't fit the `OptimizedEntry` pattern, or for business events unrelated to a Contentful entry.

| Method       | Purpose                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `identify`   | Associates a known user ID and traits with the profile. Always allowed before consent.                      |
| `page`       | Emits a `page` event. `screen` is the mobile idiom; `page` is rarely used in RN.                            |
| `screen`     | Emits a `screen` event. What `useScreenTracking` and `OptimizationNavigationContainer` call under the hood. |
| `track`      | Emits a generic `track` event for arbitrary business actions.                                               |
| `trackView`  | Manually emits an entry view event.                                                                         |
| `trackClick` | Manually emits an entry click/tap event (wire type `component_click`).                                      |

```tsx
const optimization = useOptimization()
await optimization.identify('user-123', { plan: 'pro' })
await optimization.track('Added to Cart', { sku: 'ABC' })
await optimization.trackView({ componentId: 'entry-123', experienceId: 'exp-456', variantIndex: 0 })
```

At the wire level, "automatic" and "manual" events funnel through the same emission pipeline.

### Wire type mapping

The on-the-wire event types used by the Insights API do not always match the public method name. In
particular:

| Method       | Wire event type                                                  |
| ------------ | ---------------------------------------------------------------- |
| `trackView`  | `component`                                                      |
| `trackClick` | `component_click`                                                |
| `trackHover` | `component_hover` (not emitted by RN; included for completeness) |

These wire types are defined in `packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts:45-50`
and are shared across all SDKs (web, iOS, RN).

## 2. How events flow from the device

### The two APIs

The SDK talks to two HTTP endpoints, both defaulting to Ninetailed hosts:

| API                | Default base URL                         | Purpose                                                                                       |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Experience API** | `https://experience.ninetailed.co/`      | Variant resolution, identify, sticky entry views, profile aggregation.                        |
| **Insights API**   | `https://ingest.insights.ninetailed.co/` | All fire-and-forget interaction events: entry views, clicks, flag views, track, page, screen. |

Both are configurable via the `api` config on the SDK (see section 8).

A single user action can touch either or both APIs. `trackView({ sticky: true })` delivers through
Experience first (sticky views become part of the profile) then through Insights. Plain `trackView`
only hits Insights; `identify` only touches Experience.

### Queueing, flushing, and offline

Both APIs are fronted by an in-memory queue in the core SDK. Events are enqueued, never sent
synchronously. Insights events are batched and POSTed; Experience events are per-request but the
queue handles offline replay and circuit breaking. Retry/backoff is configurable via
`queuePolicy.flush`.

The React Native SDK layers RN-specific behavior on top:

1. **Online/offline detection** via `@react-native-community/netinfo`. When offline, the queue
   buffers; when `isInternetReachable` (preferred) or `isConnected` flips back to `true`, the SDK
   resumes flushing. If NetInfo is not installed the SDK logs a warning and stays always-online —
   you keep tracking but lose offline durability. _Source:
   `packages/react-native-sdk/src/handlers/createOnlineChangeListener.ts:74-112`._
2. **Background flushing.** On `AppState` transition to `background` or `inactive`, the SDK calls
   `flush()` to drain the queue before the OS might suspend the process. _Source:
   `packages/react-native-sdk/src/handlers/createAppStateChangeListener.ts:38-54`._
3. **Final view event on background.** If an entry is mid-visibility-cycle when the app backgrounds,
   `useViewportTracking` pauses, emits a final view event if at least one event already fired, and
   resets. _Source: `packages/react-native-sdk/src/hooks/useViewportTracking.ts:525-553`._

The offline queue has a cap (`queuePolicy.offlineMaxEvents`) and a drop callback
(`queuePolicy.onOfflineDrop`). See the
[README](../../packages/react-native-sdk/README.md#common-configuration) for the common queue
configuration entry point.

### Persistence via AsyncStorage

`AsyncStorageStore` persists the following across launches so tracking decisions and variant
assignments survive a cold start:

| Key                                | Contents                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `CONSENT_KEY`                      | `'accepted'` / `'denied'` / absent.                                                |
| `PROFILE_CACHE_KEY`                | The aggregated profile returned from the Experience API.                           |
| `SELECTED_OPTIMIZATIONS_CACHE_KEY` | Current audience/variant assignments. Drives which variant renders on next launch. |
| `ANONYMOUS_ID_KEY`                 | Stable anonymous identifier until `identify` is called.                            |
| `CHANGES_CACHE_KEY`                | Pending profile changes.                                                           |
| `DEBUG_FLAG_KEY`                   | Forces `logLevel` to `'debug'` when set.                                           |

Persistence is best-effort; write failures keep the SDK running on in-memory state. Structured
values are schema-validated on load; malformed JSON is evicted. _Source:
`packages/react-native-sdk/src/storage/AsyncStorageStore.ts`._

Why this matters for tracking: selected optimizations persist, so a user placed in Variant B
continues to see it on the next launch and view/tap events carry the correct `experienceId` /
`variantIndex` without re-round-tripping Experience first.

## 3. Consent gating

The SDK gates event emission behind a three-valued consent state: `true`, `false`, or `undefined`
(unset). This is the most common cause of "tracking isn't working" during integration — without
`defaults.consent: true` or a banner that calls `optimization.consent(true)`, everything except
`identify` and `screen` is dropped silently at the SDK boundary.

| Consent     | Behavior                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `undefined` | Only `allowedEventTypes` emit. RN default: `['identify', 'screen']`. All view/tap/track/page events are blocked. |
| `true`      | All event types emit.                                                                                            |
| `false`     | Same as `undefined` — only `allowedEventTypes` emit. Persists until `consent(true)` is called again.             |

The default allow-list comes from `packages/react-native-sdk/src/ContentfulOptimization.ts:52`. To
widen it before consent, pass `allowedEventTypes` to `OptimizationRoot`:

```tsx
<OptimizationRoot clientId={CLIENT_ID} allowedEventTypes={['identify', 'screen', 'page']}>
  <App />
</OptimizationRoot>
```

When consent flips:

- **`consent(true)`** — new events flow normally. Blocked events are _not_ retroactively replayed;
  they were dropped at the guard (you can observe this via `onEventBlocked`). Consent persists to
  AsyncStorage.
- **`consent(false)`** — the allow-list gate re-engages. In-flight events that already cleared the
  guard continue to flush.

### "Why is nothing tracking?"

Four checks, in order of likelihood:

1. **Consent.** Without `defaults.consent: true` or a user accept, only `identify`/`screen` go out.
   Set `logLevel: 'info'` to see blocked events in the console.
2. **Tap tracking opt-in.** Views default to `true`, taps default to `false`.
3. **Visibility threshold.** Defaults are strict (80% for 2 s). Scroll-by content never fires.
4. **No scroll context.** An entry below the fold without `<OptimizationScrollProvider>` will never
   pass the visibility threshold — `scrollY` is assumed `0`.

## 4. Entry view tracking mechanics

This section describes the internals of `useViewportTracking`, the hook `<OptimizedEntry />` uses
under the hood.

### Default thresholds

All defaults live as module constants in
`packages/react-native-sdk/src/hooks/useViewportTracking.ts:72-75`:

| Constant                                   | Value  | Meaning                                                                                                             |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `DEFAULT_THRESHOLD`                        | `0.8`  | Minimum visibility ratio (0.0 – 1.0). An entry is "visible" when at least 80% of its height is within the viewport. |
| `DEFAULT_VIEW_TIME_MS`                     | `2000` | Minimum accumulated visible time (ms) before the **initial** view event fires. A.k.a. the "dwell time".             |
| `DEFAULT_VIEW_DURATION_UPDATE_INTERVAL_MS` | `5000` | Interval (ms) between **periodic** duration update events after the initial event.                                  |

Tap tracking has one additional threshold in
`packages/react-native-sdk/src/hooks/useTapTracking.ts:17`:

| Constant                 | Value | Meaning                                                                                                                         |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `TAP_DISTANCE_THRESHOLD` | `10`  | Maximum pixel distance between `touchStart` and `touchEnd`. Beyond this, the gesture is classified as a scroll/drag, not a tap. |

### The visibility state machine

Each mounted `<OptimizedEntry>` runs a small state machine keyed on a "visibility cycle" — a cycle
starts when the entry goes not-visible → visible, and ends when it transitions back or unmounts.
State lives in refs (not React state) to avoid re-rendering on every scroll tick:

```ts
interface ViewCycleState {
  viewId: string | null // UUID; correlates all events in this cycle
  visibleSince: number | null // Timestamp of last visibility entry; null while paused
  accumulatedMs: number // Running total of visible time
  attempts: number // Number of view events already emitted
}
```

_Source: `packages/react-native-sdk/src/hooks/useViewportTracking.ts:89-101`._

On every scroll tick or layout change, `checkVisibility()` computes the overlap between the entry's
measured `{y, height}` and the current viewport `{scrollY, viewportHeight}` to derive a
`visibilityRatio`, and compares it to `threshold`:

- **not-visible → visible** — `onVisibilityStart` resets the cycle, mints a fresh `viewId`, sets
  `visibleSince = now`, and schedules the next fire.
- **visible → not-visible** — `onVisibilityEnd` clears the fire timer, pauses accumulation, emits a
  **final** event if `attempts > 0`, and resets the cycle.

### Initial, periodic, and final events

Within a cycle, events fire based on accumulated visible time. The schedule mirrors the Web SDK's
`ElementViewObserver`:

```
requiredMs_for_event_N = viewTimeMs + N * viewDurationUpdateIntervalMs
```

So with defaults:

| Event       | When it fires (from cycle start)         |
| ----------- | ---------------------------------------- |
| Initial     | 2000 ms accumulated visible              |
| Periodic #1 | 7000 ms accumulated visible              |
| Periodic #2 | 12 000 ms accumulated visible            |
| Periodic #N | `2000 + N * 5000` ms accumulated visible |
| Final       | At `onVisibilityEnd`, if `attempts > 0`  |

"Accumulated" is load-bearing: if the user scrolls away at 1.5 s and back 10 s later, the timer
resumes from 1.5 s and takes another 0.5 s to fire the initial event. Pause/resume is driven by
`visibleSince` being set/cleared.

A few consequences:

- **An entry briefly scrolled into view (< 2 s total) fires no events.** The initial gate is never
  crossed, so the final event is suppressed (guarded by `attempts > 0`).
- **An entry scrolled into view for 2 s and then immediately unmounted** fires one initial event,
  then one final event (from the unmount cleanup effect at `useViewportTracking.ts:555-568`).
- **Each event carries `viewDurationMs`**, computed from the cycle's accumulated time at the moment
  of emission. The sequence of events for a 12 s continuous view is: initial (~2000 ms), periodic
  (~7000 ms), periodic (~12 000 ms), final (~12 000 ms).
- **Each event also carries `viewId`** — the UUID for the cycle. All events in one cycle share a
  `viewId`; a new cycle gets a fresh one. Use `viewId` downstream to correlate.

### App backgrounding and cleanup

Two additional transitions matter:

1. **AppState → background or inactive.** The hook listens to `AppState` changes. On transition to
   background/inactive, it clears the fire timer, pauses accumulation, and — if `attempts > 0` —
   emits a final event before resetting the cycle and marking `isVisibleRef.current = false`. When
   the app becomes `active` again, it re-checks visibility from scratch, which will start a new
   cycle if the entry is still on screen. _Source:
   `packages/react-native-sdk/src/hooks/useViewportTracking.ts:525-553`._

2. **Component unmount.** The unmount cleanup clears the fire timer and, if the cycle had any
   successful events (`attempts > 0`), flushes a final view event synchronously. _Source:
   `packages/react-native-sdk/src/hooks/useViewportTracking.ts:555-568`._

Combined, these guarantees mean that as long as the initial event fired, a final event (with a
matching `viewId` and the true total duration) will always follow — whether visibility ends
naturally, the user backgrounds the app, or the component unmounts.

## 5. Scroll context and viewport resolution

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
  <OptimizedEntry entry={post}>
    <ArticleBody post={post} />
  </OptimizedEntry>
</OptimizationScrollProvider>
```

_Source: `packages/react-native-sdk/src/context/OptimizationScrollContext.tsx:80-154`._ The in-tree
reference implementation wraps its entry list in
[`OptimizationScrollProvider`](../../implementations/react-native-sdk/App.tsx).

### Outside OptimizationScrollProvider

With no scroll context, the hook falls back to screen dimensions — `scrollY = 0`, viewport =
`Dimensions.get('window').height` (with an orientation listener). _Source:
`packages/react-native-sdk/src/hooks/useViewportTracking.ts:256-257`._

This is correct for full-screen non-scrollable layouts, hero/banner content always on screen, and
modal content. It is _wrong_ for anything below the fold in a `ScrollView` — wrap those.

## 6. Tap tracking semantics

Tap tracking is implemented by `useTapTracking`. Behavior:

1. The wrapping `View` gets `onTouchStart` / `onTouchEnd` (not `onPress`). Raw touch events mean
   **taps are captured even when a child `Pressable` also handles the press**. A `Pressable` wrapper
   gives the child's `onPress` precedence.
2. `onTouchStart` records `{ pageX, pageY }`.
3. `onTouchEnd` computes Euclidean distance from start to end. Under `TAP_DISTANCE_THRESHOLD` (10
   points) → tap; over → scroll/drag, ignored.
4. On tap: `optimization.trackClick({ componentId, experienceId, variantIndex })` (wire type
   `component_click`). If `onTap` was passed on `<OptimizedEntry>`, it's also invoked synchronously
   with the resolved entry.

_Source: `packages/react-native-sdk/src/hooks/useTapTracking.ts:95-156`._

Tap tracking is **off by default**. Enable via
`<OptimizationRoot trackEntryInteraction={{ taps: true }}>`, `<OptimizedEntry trackTaps>`, or
implicitly by passing `onTap`.

## 7. Screen tracking paths

Screen tracking emits `screen` events, which are allowed before consent and feed into route-based
profile attribution. The SDK gives you three paths.

### OptimizationNavigationContainer

The highest-automation path. Wrap `NavigationContainer` in `<OptimizationNavigationContainer>` and a
`screen` event fires automatically on every active-route change, including the initial ready.

```tsx
<OptimizationRoot clientId={CLIENT_ID}>
  <OptimizationNavigationContainer>
    {(navigationProps) => (
      <NavigationContainer {...navigationProps}>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="BlogPostDetail" component={BlogPostDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    )}
  </OptimizationNavigationContainer>
</OptimizationRoot>
```

`onReady` fires the initial screen event; `onStateChange` compares the current route name to the
previous and emits a new screen event when they differ. `includeParams: true` includes the route
params in the event's `properties` (they're JSON-validated via Zod before being attached). _Source:
`packages/react-native-sdk/src/components/OptimizationNavigationContainer.tsx:108-167`._

### useScreenTracking

Per-screen hook for apps not using React Navigation, or when you want fine-grained control over when
the event fires (e.g. after data loads).

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

With `trackOnMount: true` (the default), it fires once on mount. The hook also resets its internal
`hasTrackedRef` whenever `name` changes, so renaming the screen mid-life re-fires. _Source:
`packages/react-native-sdk/src/hooks/useScreenTracking.ts:113-167`._

### useScreenTrackingCallback

Returns a stable `(name, properties?) => void` callback for imperative screen tracking with names
that aren't known at render time (deep links, dynamic titles, navigation state transforms).
`OptimizationNavigationContainer` uses this internally.

```tsx
const trackScreen = useScreenTrackingCallback()
trackScreen('Deep Linked Article', { slug, source: 'email' })
```

_Source: `packages/react-native-sdk/src/hooks/useScreenTracking.ts:55-71`._

## 8. The configuration surface

All interaction-tracking behavior is controlled at one of three layers: SDK init config,
`OptimizationRoot` props, or per-component `<OptimizedEntry>` props. Lower layers override higher
ones.

### OptimizationRoot props

| Prop                    | Type                   | Default                        | Controls                                                                                          |
| ----------------------- | ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `trackEntryInteraction` | `{ views?, taps? }`    | `{ views: true, taps: false }` | Default view/tap tracking for every `<OptimizedEntry>`. Omitted keys fall back to the defaults.   |
| `liveUpdates`           | `boolean`              | `false`                        | Global live-updates default. When `false`, `<OptimizedEntry>` locks to the first variant it sees. |
| `previewPanel`          | `PreviewPanelConfig`   | `undefined`                    | Forces `liveUpdates = true` whenever the panel is open (cannot be overridden).                    |
| `defaults.consent`      | `boolean \| undefined` | `undefined`                    | Initial consent state at startup. Overridden by `consent()` calls at runtime.                     |
| `allowedEventTypes`     | `EventType[]`          | `['identify', 'screen']`       | Event types permitted while consent is `undefined` or `false`.                                    |

The "`{ views: true, taps: false }`" default lives in
`packages/react-native-sdk/src/context/InteractionTrackingContext.tsx:38-44`.

### OptimizedEntry props

| Prop                           | Type                                     | Default     | Controls                                                                                               |
| ------------------------------ | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `trackViews`                   | `boolean \| undefined`                   | `undefined` | Per-entry override for view tracking. `undefined` inherits from `trackEntryInteraction.views`.         |
| `trackTaps`                    | `boolean \| undefined`                   | `undefined` | Per-entry override for tap tracking. `undefined` inherits from `trackEntryInteraction.taps`.           |
| `onTap`                        | `(resolved) => void`                     | `undefined` | Implicitly enables tap tracking unless `trackTaps` is explicitly `false`. Fires after the click event. |
| `threshold`                    | `number (0.0 – 1.0)`                     | `0.8`       | Visibility ratio required to consider the entry visible.                                               |
| `viewTimeMs`                   | `number`                                 | `2000`      | Dwell time before the initial view event.                                                              |
| `viewDurationUpdateIntervalMs` | `number`                                 | `5000`      | Interval between periodic duration updates after the initial event.                                    |
| `liveUpdates`                  | `boolean \| undefined`                   | `undefined` | Per-entry live-updates override. See resolution order below.                                           |
| `entry`                        | `Entry`                                  | (required)  | The baseline or optimized Contentful entry.                                                            |
| `children`                     | `ReactNode \| ((resolved) => ReactNode)` | (required)  | Render prop receives the resolved variant; static children are rendered as-is.                         |

Each default is defined alongside the corresponding prop in
`packages/react-native-sdk/src/components/OptimizedEntry.tsx:64-141` and confirmed in
`useViewportTracking.ts:72-75`.

### SDK init config

Beyond the layer above, the full `CoreStatefulConfig` is accepted as `OptimizationRoot` props (since
`OptimizationRootProps extends CoreStatefulConfig`). The ones that directly shape tracking:

| Config option                  | Default                                  | Controls                                                                                        |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `api.experienceBaseUrl`        | `https://experience.ninetailed.co/`      | Where sticky views, identify, and variant resolution go.                                        |
| `api.insightsBaseUrl`          | `https://ingest.insights.ninetailed.co/` | Where all fire-and-forget interaction events go.                                                |
| `api.beaconHandler`            | `undefined`                              | Optional custom beacon; takes over batch delivery to Insights if provided.                      |
| `fetchOptions.requestTimeout`  | `3000`                                   | Max ms per request before abort.                                                                |
| `fetchOptions.retries`         | `1`                                      | Retry attempts on failure.                                                                      |
| `queuePolicy.flush`            | See README                               | Backoff, circuit breaker, and retry callbacks for the flush loop.                               |
| `queuePolicy.offlineMaxEvents` | —                                        | Cap on the offline buffer; overflow triggers `onOfflineDrop`.                                   |
| `onEventBlocked`               | `undefined`                              | Callback when an event is blocked by the consent guard. Useful for surfacing misconfigurations. |
| `eventBuilder.channel`         | `'mobile'`                               | Channel tag on every event. RN SDK sets this; no need to change.                                |
| `logLevel`                     | `'error'`                                | Set to `'debug'` to see every gate decision.                                                    |

The full configuration reference lives in the
[React Native SDK README](../../packages/react-native-sdk/README.md#common-configuration).

### Resolution order

**View tracking enabled?**

1. If `<OptimizedEntry trackViews={true|false}>`, use that.
2. Else use `trackEntryInteraction.views` from `OptimizationRoot`.
3. Else use the default (`true`).

**Tap tracking enabled?**

1. If `<OptimizedEntry trackTaps={true|false}>`, use that.
2. Else if `<OptimizedEntry onTap={...}>` is provided, use `true`.
3. Else use `trackEntryInteraction.taps` from `OptimizationRoot`.
4. Else use the default (`false`).

_Source: `packages/react-native-sdk/src/components/OptimizedEntry.tsx:143-151, 272-273`._

**Live updates enabled?**

1. If the preview panel is open — always `true`, cannot be overridden.
2. Else if `<OptimizedEntry liveUpdates={true|false}>`, use that.
3. Else use `OptimizationRoot.liveUpdates`.
4. Else default (`false`; the entry locks to its first variant).

_Source: `packages/react-native-sdk/src/components/OptimizedEntry.tsx:229-231`._

## 9. Manual tracking API

For content that doesn't fit `<OptimizedEntry>` — custom screens, server-rendered fragments,
non-Contentful components — call tracking methods directly on the SDK instance. These hit the same
wire pipeline, consent gates, and offline queue.

```tsx
const optimization = useOptimization()

useEffect(() => {
  void optimization.trackView({
    componentId: contentfulId,
    experienceId,
    variantIndex: 0,
    viewDurationMs: 0,
  })
}, [contentfulId, experienceId, optimization])
```

### Payload shapes

```ts
// trackView — Source: CoreStatefulEventEmitter.ts:215-237
optimization.trackView({
  componentId: string,
  viewId?: string,              // UUID; correlates events in a cycle
  experienceId?: string,
  variantIndex?: number,        // 0 for baseline
  viewDurationMs?: number,
  sticky?: boolean,             // When true, also routes through Experience API
  profile?: PartialProfile,
})

// trackClick — Source: CoreStatefulEventEmitter.ts:249-251 (wire type: component_click)
optimization.trackClick({
  componentId: string,
  experienceId?: string,
  variantIndex?: number,
})
```

### When to reach for manual tracking

- **Screen-wide entry views without viewport-visibility semantics** — `trackView` from `useEffect`
  on mount.
- **Non-Contentful UI that counts as a component click** — `trackClick` from a `Pressable`'s
  `onPress`.
- **Business events unrelated to a Contentful entry** — `track('Added To Cart', { sku })`.

For anything backed by a Contentful entry, prefer `<OptimizedEntry>` — it handles the state machine,
initial/periodic/final sequencing, final-on-unmount, final-on-background, and `viewId` correlation
for you.

## 10. Putting it together

A fully-instrumented list screen combines every mechanism in this guide:

```tsx
;<OptimizationRoot
  clientId={OPTIMIZATION_CLIENT_ID}
  defaults={{ consent: true }}
  trackEntryInteraction={{ views: true, taps: true }}
  previewPanel={{ enabled: __DEV__, contentfulClient }}
>
  <OptimizationNavigationContainer>
    {(navigationProps) => (
      <NavigationContainer {...navigationProps}>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    )}
  </OptimizationNavigationContainer>
</OptimizationRoot>

function HomeScreen({ navigation }) {
  const { posts } = useContentfulData()
  return (
    <OptimizationScrollProvider>
      {posts.map((post) => (
        <OptimizedEntry
          key={post.sys.id}
          entry={post}
          onTap={() => navigation.navigate('BlogPostDetail', { post })}
        >
          <BlogPostCard post={post} />
        </OptimizedEntry>
      ))}
    </OptimizationScrollProvider>
  )
}
```

What fires:

- **On launch** — consent is seeded `true`, so view/tap events flow immediately.
- **Every route change** — a `screen` event via `OptimizationNavigationContainer`.
- **Per card scrolled into view for ≥ 2 s** — initial entry view, periodic updates every 5 s, final
  event on scroll-away / unmount.
- **Per card tapped** — a `component_click` event plus the `onTap` callback.
- **On backgrounding mid-view** — a final view event for any card mid-cycle; the queue flushes
  before the OS suspends the process.
- **Offline** — events buffer; they replay on reconnect.

For the broader integration walkthrough, read the
[React Native SDK integration guide](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md).

## Reference

- **SDK source:** `packages/react-native-sdk/src/`
- **Tracking hooks:** `hooks/useViewportTracking.ts`, `hooks/useTapTracking.ts`,
  `hooks/useScreenTracking.ts`
- **Context providers:** `context/InteractionTrackingContext.tsx`,
  `context/OptimizationScrollContext.tsx`, `context/LiveUpdatesContext.tsx`
- **Event emission pipeline:** `packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts`
- **Reference implementation:**
  [`implementations/react-native-sdk`](../../implementations/react-native-sdk/README.md) exercises
  the React Native SDK API surface in this monorepo.
- **Integration guide:**
  [Integrating the Optimization React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md).
