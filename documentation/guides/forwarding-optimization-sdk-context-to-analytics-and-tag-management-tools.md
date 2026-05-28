---
title: Forwarding Optimization SDK context to analytics and tag-management tools
---

# Forwarding Optimization SDK context to analytics and tag-management tools

Use this guide when your application already sends events to an analytics, tag-management,
customer-data, or product-analytics system and you are adding the Optimization SDK. It helps you
forward Contentful optimization context without building a new analytics layer around the SDK.

Start by choosing the runtime handoff that matches your SDK integration. Then use the shared
mapping, validation, and vendor examples in this guide to keep third-party analytics behavior
consistent across browser, mobile, Node, and server-rendered flows.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and responsibilities](#scope-and-responsibilities)
  - [Third-party analytics delivery model](#third-party-analytics-delivery-model)
- [Choose your runtime entry point](#choose-your-runtime-entry-point)
- [Runtime handoff patterns](#runtime-handoff-patterns)
  - [Stateful SDK subscriptions](#stateful-sdk-subscriptions)
  - [Register provider-managed subscriptions](#register-provider-managed-subscriptions)
  - [Forward SDK events from `eventStream`](#forward-sdk-events-from-eventstream)
  - [Use request-local data in Node and SSR](#use-request-local-data-in-node-and-ssr)
  - [Filter semantic exposures before forwarding](#filter-semantic-exposures-before-forwarding)
  - [Forward profile and flag state](#forward-profile-and-flag-state)
  - [Use selected optimizations for readiness, not exposure by itself](#use-selected-optimizations-for-readiness-not-exposure-by-itself)
  - [Diagnose blocked events](#diagnose-blocked-events)
- [Enrich business events](#enrich-business-events)
- [Normalize and map Contentful context](#normalize-and-map-contentful-context)
  - [Normalize SDK events](#normalize-sdk-events)
  - [Build context from a resolved entry](#build-context-from-a-resolved-entry)
- [Vendor examples](#vendor-examples)
  - [Google Analytics](#google-analytics)
  - [Google Tag Manager](#google-tag-manager)
  - [Adobe Analytics](#adobe-analytics)
  - [Adobe Experience Platform](#adobe-experience-platform)
  - [Contentsquare](#contentsquare)
  - [Segment](#segment)
  - [Amplitude](#amplitude)
  - [Heap](#heap)
  - [Mixpanel](#mixpanel)
  - [PostHog](#posthog)
- [Validate delivery and prevent duplicates](#validate-delivery-and-prevent-duplicates)
- [Data governance checklist](#data-governance-checklist)
- [Related guides and concepts](#related-guides-and-concepts)

<!-- mtoc-end -->
</details>

## Scope and responsibilities

Start by separating what the Optimization SDK Suite does from what your analytics destination does.
The SDK keeps Contentful Personalization and Analytics working. Your integration forwards only the
approved optimization context that your third-party destination needs.

The Optimization SDK Suite sends these events to Contentful:

- `page()`, `identify()`, `screen()`, `track()`, and sticky `trackView()` use the Experience API to
  update or evaluate a profile and return optimization data.
- `trackView()` also uses the Insights API for Contentful Analytics entry-view tracking. Sticky
  views send an Experience event first, then a paired Insights event. Non-sticky views only use
  Insights.
- `trackClick()`, `trackHover()`, and `trackFlagView()` use the Insights API for Contentful
  Analytics.
- `resolveOptimizedEntry()`, `getMergeTagValue()`, and `getFlag()` use SDK state or request-local
  optimization data to decide what to render.

Your third-party integration is separate. It can listen to SDK state, mirror SDK events, or add
selected Contentful metadata to your existing analytics calls.

| Area                     | What the SDK does                                                                                                       | What you decide and implement                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Contentful events        | Sends Experience API and Insights API events that power Contentful Personalization and Analytics.                       | Which event fields, if any, you forward to another analytics system.                                     |
| Stateful subscriptions   | Exposes `states.eventStream`, `states.blockedEventStream`, `states.profile`, `states.selectedOptimizations`, and flags. | Which subscriptions to register, where to register them, and how to map their payloads.                  |
| Rendering                | Resolves entries, merge tags, and flags from SDK state or request-local optimization data.                              | When rendered content counts as an exposure for your analytics model.                                    |
| Consent                  | Provides consent APIs and blocked-event diagnostics.                                                                    | The consent policy, the default state, and which destinations can receive mirrored events.               |
| Identity                 | Accepts known-user IDs and traits through SDK identity APIs.                                                            | Which stable user ID your analytics destination uses, how traits are filtered, and when identity resets. |
| Third-party destinations | Does not install, configure, or fan out vendor analytics calls.                                                         | Vendor SDK setup, tag-manager rules, CDP mappings, tracking plans, and privacy filters.                  |

This guide does not replace vendor implementation documentation. Use each vendor's official
instructions for SDK installation, workspace setup, schema configuration, consent mode, regional
endpoints, and privacy controls alongside the SDK-specific patterns below.

### Third-party analytics delivery model

The SDK exposes live state and request-local results. It does not provide a durable third-party
analytics delivery queue.

For stateful SDKs, `states.eventStream` lets application code observe SDK events from the point a
subscriber is registered. It immediately emits the current snapshot, then future updates. It does
not replay every prior event for late subscribers or retain events until a destination acknowledges
them.

For Node and server-rendered flows, the SDK returns request-local `OptimizationData` from the SDK
call that produced it. Server-side analytics forwarding should use that return value in the same
request or event collector.

If a destination SDK loads late, is temporarily unavailable, or requires acknowledgement before an
event is considered delivered, put that buffering policy in application code. The application can
choose the queue size, TTL, consent behavior, retry policy, and drop behavior that match its
analytics requirements.

## Choose your runtime entry point

Choose the simplest handoff that matches the SDK runtime and the event your reports need. For
stateful SDKs, subscribe first and add custom code only where a subscription does not have the
context you need. For Node and server-rendered flows, use request-local SDK data from the same
request that rendered or emitted the event.

We recommend this default:

- Register one app-level `states.eventStream` subscription and forward the SDK events your
  destination needs. For entry exposure reporting, collapse SDK path records and duration updates
  into one semantic third-party exposure unless your tracking plan requires path-level mirroring.
- Forward Custom Flag values from the same app-owned flag read or render path. Use
  `states.flag(name)` only when that subscription is already how the app reads the flag.
- Use `states.profile` only for profile availability or approved profile metadata. Do not treat the
  Optimization profile ID as your known-user ID.
- Use `resolveOptimizedEntry()` metadata only when you need entry-specific exposure or
  business-event attribution.
- Use request-local `OptimizationData` in Node and SSR flows, where state subscriptions are not the
  integration surface.

You do not need an analytics adapter for every integration. A small mapping function is often
enough.

Use this table to choose the code location that owns the third-party handoff:

| Path                               | Use it when                                                                 | Integration shape                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stateful SDK subscriptions         | You use Web, React Web, or React Native and the SDK instance owns state.    | Subscribe to `states.eventStream`, `states.blockedEventStream`, `states.profile`, `states.selectedOptimizations`, or `states.flag(...)`. |
| Provider-managed subscriptions     | You use React Web or React Native and want subscriptions tied to the root.  | Register app-level subscribers from the provider `onStatesReady` callback.                                                               |
| Existing business-event code       | You need to attribute purchases, signups, or other app events to variants.  | Add Contentful metadata from `resolveOptimizedEntry()` to the existing event.                                                            |
| Request-local Node or SSR data     | You call the Node SDK or resolve first paint on the server.                 | Use the `OptimizationData` returned by `page()`, `identify()`, `track()`, or sticky `trackView()`.                                       |
| Destination-specific mapping layer | Your organization enforces a strict tracking plan or sends to many vendors. | Add a small mapper that normalizes SDK events before forwarding.                                                                         |

Avoid starting with a broad adapter that mirrors every SDK value. Start with subscriptions and map
only the event types and fields that answer a reporting or activation question.

Before copying a vendor example, confirm the runtime path and the code location that owns the
forwarded event.

| Runtime                 | Register subscriptions where                               | Forward Contentful context from                                                                  |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Web                     | After constructing the SDK instance.                       | `states.eventStream`, app-owned flag reads, or the business event that owns the user action.     |
| React Web               | `onStatesReady` on `OptimizationRoot` or provider setup.   | Provider-managed subscriptions, React entry resolution helpers, or the action handler.           |
| React Native            | `onStatesReady` on `OptimizationRoot` or provider setup.   | Provider-managed subscriptions, flag render paths, screen events, or tap/action handlers.        |
| Node or server rendered | The same request or server event collector that calls SDK. | Request-local `OptimizationData` and the server-side business event or exposure collector.       |
| Hybrid SSR and CSR      | Server request first, then browser provider subscriptions. | Server-resolved first paint from `OptimizationData`; later client activity from stateful events. |

Move through the integration in this order:

1. Choose whether the integration can use state subscriptions or needs request-local data.
2. Register SDK subscriptions once at the app or provider boundary when the runtime is stateful.
3. Add Contentful metadata to your own business events only when reports need attribution by
   experience, variant, entry, or flag.
4. Map the subscription or request-local payload into each destination's event schema.
5. Validate consent, identity, duplicate handling, and destination payloads before release.

## Runtime handoff patterns

### Stateful SDK subscriptions

Stateful SDK subscriptions are the default path for browser and mobile integrations. Register them
once near SDK initialization, not inside every component that renders optimized content.

In React Web and React Native, prefer `onStatesReady` when your provider owns SDK setup. In plain
Web apps, subscribe after constructing the SDK instance.

### Register provider-managed subscriptions

Use `onStatesReady` to attach app-level subscriptions before provider children can emit SDK events.
Return a cleanup function so hot reloads, tests, and route-level provider teardown do not leave
stale subscribers behind.

```tsx
<OptimizationRoot
  clientId="your-client-id"
  environment="main"
  onStatesReady={(states) => {
    const forwardedMessageIds = new Set<string>()

    const eventSubscription = states.eventStream.subscribe((event) => {
      if (!event) return
      if (forwardedMessageIds.has(event.messageId)) return
      if (!canForwardSdkEvent(event)) return

      forwardedMessageIds.add(event.messageId)

      analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
    })

    const blockedSubscription = states.blockedEventStream.subscribe((blocked) => {
      if (!blocked) return

      console.debug('Contentful event blocked', {
        method: blocked.method,
        reason: blocked.reason,
      })
    })

    return () => {
      eventSubscription.unsubscribe()
      blockedSubscription.unsubscribe()
    }
  }}
>
  <App />
</OptimizationRoot>
```

Use the same callback shape with React Web or React Native provider roots. Keep destination setup,
consent checks, and privacy filters in your application code around the forwarded call.

### Forward SDK events from `eventStream`

`states.eventStream` emits each SDK event that passes through the SDK. Use it when you want a tag
manager, CDP, or analytics tool to receive the same high-level SDK activity that Contentful
receives.

```ts
const forwardedMessageIds = new Set<string>()

const subscription = optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})
```

`subscribe()` emits the current value immediately. Dedupe by `messageId` when your subscriber can
mount more than once or when a destination does not accept repeated payloads.

`eventStream` is a live handoff, not a replay queue. Register the subscription at SDK or provider
initialization. If the analytics destination is not ready yet, buffer forwarded payloads in
application code with an explicit size, TTL, and drop policy.

Use this path for:

- SDK page and screen events.
- SDK `track()` events.
- Entry view and hover events emitted by Web SDK interaction tracking.
- Entry click or mobile tap events emitted by Web, React Web, or React Native interaction tracking.
- Sticky view events that also update the Experience API profile.
- Custom Flag view events emitted by `getFlag()` or `states.flag(name)`.

### Use request-local data in Node and SSR

The Node SDK is stateless, so use the data returned by the SDK call that belongs to the current
request. The same rule applies when a server-rendered page resolves first-paint content.

Node and SSR flows do not expose process-wide subscriptions. Keep third-party forwarding tied to the
request or server-side business event that produced the SDK data.

```ts
const optimizationData = await optimization.page({
  profile,
  properties: { path: req.path },
})

const { entry: resolvedHeroEntry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineHeroEntry,
  optimizationData.selectedOptimizations,
)

analytics.track('Contentful Optimization Exposure', {
  contentful_profile_id: canForwardOptimizationProfileId ? optimizationData.profile.id : undefined,
  contentful_experience_id: selectedOptimization?.experienceId,
  contentful_variant_index: selectedOptimization?.variantIndex,
  contentful_variant_entry_id: selectedOptimization ? resolvedHeroEntry.sys.id : undefined,
  contentful_baseline_entry_id: baselineHeroEntry.sys.id,
})
```

Forward server-side payloads from the same request or event collector that owns your existing
server-side analytics. Do not depend on browser state subscriptions to explain server-rendered
content unless you bootstrap the browser with the same `OptimizationData`.

### Filter semantic exposures before forwarding

> [!IMPORTANT] View and hover tracking can emit heartbeat events for the same observed view or hover
> so Contentful Analytics can measure duration. Sticky views also emit one Experience event and one
> paired Insights event for the same view. Many third-party analytics tools count each forwarded
> call as a new event. Filter, summarize, or throttle these SDK records before sending them to a
> funnel, exposure, or product-analytics destination.

For exposure and funnel reporting, forward one semantic exposure for each `viewId` or `hoverId` and
drop later records for that same view or hover. This collapses both duration updates and sticky
Experience/Insights pairs. If a destination supports engagement duration, aggregate by `viewId` or
`hoverId` and send the maximum observed or final `viewDurationMs` or `hoverDurationMs` value
instead.

```ts
const forwardedExposureKeys = new Set<string>()

function canForwardSdkEvent(event: {
  type: string
  componentType?: string
  componentId?: string
  experienceId?: string
  variantIndex?: number
  viewId?: string
  hoverId?: string
}): boolean {
  const semanticId = event.viewId ?? event.hoverId
  const isEntryExposure =
    (event.type === 'component' &&
      event.componentType !== 'Variable' &&
      event.viewId !== undefined) ||
    (event.type === 'component_hover' && event.hoverId !== undefined)

  if (!isEntryExposure || semanticId === undefined) return true

  const exposureKey = [
    event.type,
    event.componentId,
    event.experienceId,
    event.variantIndex,
    semanticId,
  ].join(':')

  if (forwardedExposureKeys.has(exposureKey)) return false

  forwardedExposureKeys.add(exposureKey)
  return true
}
```

This filter is separate from `messageId` dedupe. `messageId` dedupe prevents the same SDK event from
being forwarded again when a subscriber remounts. Semantic exposure filtering prevents distinct SDK
records for the same observed view or hover from being counted as repeated exposures or
interactions. Sticky `trackView()` records have distinct `messageId` values, so `messageId` dedupe
does not collapse the Experience and Insights records for a single sticky view.

### Forward profile and flag state

Use `states.profile` when your destination needs to know that a profile exists, or when your policy
allows the Optimization profile ID as destination metadata.

```ts
optimization.states.profile.subscribe((profile) => {
  if (!profile) return
  if (!canForwardOptimizationProfileId) return

  analytics.track('Contentful Optimization Profile Ready', {
    contentful_profile_id: profile.id,
  })
})
```

Use your application user ID for vendor identity calls. Do not call `analytics.identify()` with
`profile.id` as the known-user ID.

For Custom Flags, forward third-party analytics from the same code path that already reads or
renders the flag. The SDK emits Contentful flag-view tracking when `states.flag(name)` delivers a
value, when `states.flag(name).current` is read, or when `getFlag(name)` returns a changed value. Do
not add an analytics-only flag subscription unless you intentionally want that additional Contentful
flag-view observation.

```ts
optimization.states.flag('pricing-layout').subscribe((value) => {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return
  }

  renderPricingLayout(value)

  analytics.track('Contentful Flag Evaluated', {
    contentful_flag_key: 'pricing-layout',
    contentful_flag_value: value,
  })
})
```

### Use selected optimizations for readiness, not exposure by itself

`states.selectedOptimizations` tells you which experiences and variants are active for the current
profile. It does not tell you which Contentful entry your application rendered.

Use it for readiness, diagnostics, or coarse segmentation:

```ts
optimization.states.selectedOptimizations.subscribe((selectedOptimizations) => {
  if (!selectedOptimizations) return

  analytics.track('Contentful Optimizations Ready', {
    contentful_experience_ids: selectedOptimizations.map(({ experienceId }) => experienceId),
  })
})
```

Do not treat this subscription as an exposure event by itself. For exposure, use the SDK interaction
events from `eventStream`, or add entry-specific metadata from the render path.

### Diagnose blocked events

Subscribe to `states.blockedEventStream` while testing consent and destination gating. It shows
which SDK method was blocked and why.

```ts
optimization.states.blockedEventStream.subscribe((blocked) => {
  if (!blocked) return

  console.debug('Contentful event blocked', {
    method: blocked.method,
    reason: blocked.reason,
  })
})
```

Use `onEventBlocked` at SDK construction time when you need one startup diagnostic hook instead of a
dynamic subscription. Blocked SDK events are not replayed later when consent changes, so use this
diagnostic path only for debugging and validation, not as a deferred delivery queue.

## Enrich business events

Your business event remains the primary analytics event. Add Contentful fields only when the report
needs to break the event down by experience, variant, entry, or flag.

In stateful Web and React Native SDKs, `resolveOptimizedEntry()` can use current SDK state when you
omit the `selectedOptimizations` argument:

```ts
const { entry: resolvedHeroEntry, selectedOptimization } =
  optimization.resolveOptimizedEntry(baselineHeroEntry)

renderHero(resolvedHeroEntry)

analytics.track('Quote Requested', {
  plan: 'enterprise',
  contentful_experience_id: selectedOptimization?.experienceId,
  contentful_variant_index: selectedOptimization?.variantIndex,
  contentful_variant_entry_id: selectedOptimization ? resolvedHeroEntry.sys.id : undefined,
  contentful_baseline_entry_id: baselineHeroEntry.sys.id,
})
```

`baselineHeroEntry` is the Contentful entry your application fetched. `resolvedHeroEntry` is the
entry your application rendered. `selectedOptimization` is the SDK metadata that explains the
selected experience and variant.

For React Web, the same metadata is available when you use helpers or components that return
resolved entry data. Keep the analytics call beside the user action you are measuring, not inside a
global subscription.

## Normalize and map Contentful context

Most destinations need one of these payload shapes:

- An SDK event from `states.eventStream`, normalized by a small mapper.
- A flag event from the app-owned flag read or render path.
- A business event with Contentful properties from `resolveOptimizedEntry()`.
- A request-local server event with fields from `OptimizationData`.

Use stable names and primitive values. When you do not already have a naming convention, use
`contentful_*` property names.

| Property                       | Source                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `contentful_event_type`        | `event.type` from `states.eventStream`.                                                                    |
| `contentful_message_id`        | `event.messageId` from `states.eventStream`, useful for dedupe.                                            |
| `contentful_profile_id`        | `profile.id` from `states.profile` or `optimizationData.profile.id`, only when policy allows forwarding.   |
| `contentful_experience_id`     | `event.experienceId` or `selectedOptimization.experienceId`.                                               |
| `contentful_variant_index`     | `event.variantIndex` or `selectedOptimization.variantIndex`.                                               |
| `contentful_component_id`      | `event.componentId`, a rendered entry ID, or a Custom Flag key.                                            |
| `contentful_component_type`    | `event.componentType`, such as `Entry` or `Variable`.                                                      |
| `contentful_view_id`           | `event.viewId`, useful when grouping semantic view records.                                                |
| `contentful_view_duration_ms`  | `event.viewDurationMs`, useful when a destination accepts summarized view duration.                        |
| `contentful_hover_id`          | `event.hoverId`, useful when grouping semantic hover records.                                              |
| `contentful_hover_duration_ms` | `event.hoverDurationMs`, useful when a destination accepts summarized hover duration.                      |
| `contentful_variant_entry_id`  | The resolved entry ID when entry personalization selected a variant.                                       |
| `contentful_baseline_entry_id` | The baseline entry ID your application fetched before resolution.                                          |
| `contentful_flag_key`          | The flag key from the app-owned flag read path.                                                            |
| `contentful_flag_value`        | A primitive flag value after filtering strings, numbers, and booleans from the returned Custom Flag value. |

Do not send the full `profile`, full `changes`, audience membership lists, raw traits, full
Contentful entry payloads, or rich text content to a third-party analytics destination unless your
approved data policy explicitly allows that destination.

Use helpers when more than one destination needs the same mapping or when your tracking plan needs
stable names. Keep them small.

### Normalize SDK events

This helper keeps the `states.eventStream` subscriber short and avoids forwarding whole SDK event
objects by default.

```ts
function pickContentfulEventProperties(event: {
  type: string
  messageId: string
  userId?: string
  componentId?: string
  componentType?: string
  experienceId?: string
  variantIndex?: number
  viewId?: string
  viewDurationMs?: number
  hoverId?: string
  hoverDurationMs?: number
}): Record<string, string | number | undefined> {
  return {
    contentful_event_type: event.type,
    contentful_message_id: event.messageId,
    contentful_user_id: event.userId,
    contentful_component_id: event.componentId,
    contentful_component_type: event.componentType,
    contentful_experience_id: event.experienceId,
    contentful_variant_index: event.variantIndex,
    contentful_view_id: event.viewId,
    contentful_view_duration_ms: event.viewDurationMs,
    contentful_hover_id: event.hoverId,
    contentful_hover_duration_ms: event.hoverDurationMs,
  }
}
```

If the destination does not accept `undefined` values, remove them before sending the payload.

### Build context from a resolved entry

Use this helper only when you need to repeat business-event or server-side attribution in several
places.

```ts
function pickResolvedEntryContext(input: {
  baselineEntryId: string
  resolvedEntryId: string
  selectedOptimization?: {
    experienceId: string
    variantIndex: number
    sticky?: boolean
  }
}): Record<string, string | number | boolean | undefined> {
  return {
    contentful_experience_id: input.selectedOptimization?.experienceId,
    contentful_variant_index: input.selectedOptimization?.variantIndex,
    contentful_variant_entry_id: input.selectedOptimization ? input.resolvedEntryId : undefined,
    contentful_baseline_entry_id: input.baselineEntryId,
    contentful_sticky: input.selectedOptimization?.sticky,
  }
}
```

## Vendor examples

The examples below show the SDK subscription and the destination call together. Subscription
examples include `messageId` dedupe and use `canForwardSdkEvent(event)` from
[Filter semantic exposures before forwarding](#filter-semantic-exposures-before-forwarding). They
also use `pickContentfulEventProperties(event)` from [Normalize SDK events](#normalize-sdk-events).
Business-event examples use `pickResolvedEntryContext(...)` from
[Build context from a resolved entry](#build-context-from-a-resolved-entry).

Use the examples as starting shapes, then replace event names, custom dimensions, and destination
property names with the names in your tracking plan.

| Destination               | Use this example when                                     | Primary call shown           |
| ------------------------- | --------------------------------------------------------- | ---------------------------- |
| Google Analytics          | Your app owns `gtag.js` calls.                            | `gtag('event', ...)`         |
| Google Tag Manager        | Tags and routing rules live in GTM.                       | `window.dataLayer.push(...)` |
| Adobe Analytics           | Your site owns AppMeasurement variables.                  | `s.tl(...)`                  |
| Adobe Experience Platform | Events go through Adobe Edge Network or datastreams.      | `alloy('sendEvent', ...)`    |
| Contentsquare             | You segment experience analytics or replay by variant.    | `window._uxa.push(...)`      |
| Segment                   | Segment is your central fan-out layer.                    | `analytics.track(...)`       |
| Amplitude                 | Funnels or cohorts need Contentful experience properties. | `amplitude.track(...)`       |
| Heap                      | You use autocapture plus explicit Contentful metadata.    | `heap.track(...)`            |
| Mixpanel                  | Product analytics depends on explicit event tracking.     | `mixpanel.track(...)`        |
| PostHog                   | Product analytics, replay, or funnels sit beside the SDK. | `posthog.capture(...)`       |

### Google Analytics

Use Google Analytics directly when your app already uses `gtag.js` and your code owns event calls.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  gtag('event', `contentful_${event.type}`, pickContentfulEventProperties(event))
})
```

For a business event, add Contentful context from the render or action path:

```ts
const context = pickResolvedEntryContext({
  baselineEntryId: baselineHeroEntry.sys.id,
  resolvedEntryId: resolvedHeroEntry.sys.id,
  selectedOptimization,
})

gtag('event', 'quote_requested', {
  plan: 'enterprise',
  ...context,
})
```

Register the parameters that your reports need as custom dimensions or metrics. Coordinate enhanced
measurement and SPA page-view tracking with your SDK page calls so route changes are not counted
twice.

### Google Tag Manager

Use Google Tag Manager when your tags live outside your app bundle. Push one normalized object into
the data layer and map fields to tags in GTM.

```ts
window.dataLayer = window.dataLayer || []
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  window.dataLayer.push({
    event: `contentful_${event.type}`,
    ...pickContentfulEventProperties(event),
  })
})
```

Create a Custom Event trigger for the `contentful_*` event name and map each required field to a
Data Layer Variable.

### Adobe Analytics

Use Adobe Analytics AppMeasurement when your site owns report suites, eVars, props, and events
through the `s` object.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  const properties = pickContentfulEventProperties(event)

  s.tl(true, 'o', `Contentful ${event.type}`, {
    eVar21: properties.contentful_experience_id,
    eVar22: String(properties.contentful_variant_index ?? ''),
    eVar23: properties.contentful_component_id,
    events: 'event42',
    linkTrackVars: 'eVar21,eVar22,eVar23,events',
    linkTrackEvents: 'event42',
  })
})
```

Replace `eVar21`, `eVar22`, `eVar23`, and `event42` with the variables reserved for Contentful
reporting. Prefer variable overrides for one event so Contentful context does not leak onto
unrelated calls.

### Adobe Experience Platform

Use Adobe Experience Platform Web SDK when you collect events through Adobe Edge Network, map data
to XDM, or forward data through datastreams.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  alloy('sendEvent', {
    type: `contentful.${event.type}`,
    data: {
      contentful: {
        optimization: pickContentfulEventProperties(event),
      },
    },
  })
})
```

Put fields that are part of your XDM schema in `xdm`. Put other approved metadata in `data` and map
it in the datastream or destination rules.

### Contentsquare

Use Contentsquare when you need experience analytics, zoning, session replay segmentation, or
analysis by Contentful variant.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (event.type !== 'component') return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  const properties = pickContentfulEventProperties(event)
  if (properties.contentful_experience_id === undefined) return

  window._uxa = window._uxa || []

  window._uxa.push([
    'trackDynamicVariable',
    {
      key: 'Contentful Optimization',
      value: `${properties.contentful_experience_id}:${properties.contentful_variant_index}`,
    },
  ])

  window._uxa.push(['trackPageEvent', 'Contentful Optimization Exposure'])
})
```

Keep dynamic variable values short and non-personal. Configure masking, replay, and personal-data
controls before forwarding user or page-level metadata.

### Segment

Use Segment when it is your central fan-out layer.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})
```

For a business event:

```ts
const context = pickResolvedEntryContext({
  baselineEntryId: baselineHeroEntry.sys.id,
  resolvedEntryId: resolvedHeroEntry.sys.id,
  selectedOptimization,
})

analytics.track('Quote Requested', {
  plan: 'enterprise',
  ...context,
})
```

Keep the Segment tracking plan as the source of truth for event names and property types. Use
destination filters or consent controls when only some downstream tools can receive Contentful
context.

### Amplitude

Use Amplitude when you analyze funnels, cohorts, retention, or experiment outcomes by Contentful
experience or variant.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  amplitude.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})
```

Use event properties for experience and variant metadata. Use user properties only for stable
traits, not per-exposure variant metadata.

### Heap

Use Heap when you rely on automatic behavioral capture but still need explicit Contentful metadata.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  heap.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})
```

Use `heap.track()` for SDK events that Heap cannot infer from autocapture. Use
`heap.addEventProperties()` only when the context must apply to later Heap events, and clear it when
the context is no longer active.

### Mixpanel

Use Mixpanel when product analytics depends on explicit event tracking and user-profile enrichment.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  mixpanel.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})
```

Use event properties for experience and variant fields. Use super properties only when the current
Contentful context must attach to every later event in the session, and unregister them when the
context changes.

### PostHog

Use PostHog when you want product analytics, feature-usage analysis, session replay, or funnels
alongside Contentful Personalization.

```ts
const forwardedMessageIds = new Set<string>()

optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  posthog.capture(`contentful_${event.type}`, pickContentfulEventProperties(event))
})
```

Use PostHog autocapture intentionally. Disable or filter it when it duplicates explicit Optimization
interaction events. Use PostHog opt-in and opt-out controls with the same consent decision that
drives `optimization.consent()`.

## Validate delivery and prevent duplicates

Validate the integration in the browser console, network panel, vendor debugger, and Contentful
Analytics reports before releasing it.

Check for these issues:

- The subscription is registered once for each SDK instance.
- One SDK activity creates one intended third-party event, unless your tracking plan intentionally
  mirrors path-level records.
- `messageId` dedupe prevents repeated forwarding when subscribers remount.
- View and hover records are filtered, grouped, or summarized before they reach third-party funnel,
  exposure, or product analytics reports.
- Vendor autocapture does not duplicate SDK page, click, tap, hover, or exposure events.
- Consent denial blocks both Optimization non-allowed events and third-party analytics events, and
  blocked-event diagnostics show the expected SDK method and reason.
- Known-user identity uses your application user ID, not the Optimization anonymous profile ID.
- Logout or profile switching resets SDK state and vendor identity state as your app requires.
- Full profile objects, audience memberships, personal data, and raw entry payloads are not present
  in third-party event payloads unless approved.

## Data governance checklist

Before releasing a third-party analytics integration, confirm these points:

- Your event contract is documented in your tracking plan.
- Contentful fields sent to third-party tools are limited to approved IDs, labels, and primitive
  metadata.
- The Optimization profile ID is sent only when policy allows it.
- Known-user identity uses your own stable user ID.
- Consent state controls both the Optimization SDK and the third-party destination.
- Vendor autocapture does not duplicate subscription-forwarded SDK events.
- Server-side and browser-side paths use the same event names and property casing when they report
  the same behavior.
- Debug logging, network inspection, and vendor dashboards confirm the expected payloads.

## Related guides and concepts

- [Choosing the right SDK](./choosing-the-right-sdk.md)
- [Integrating the Optimization Web SDK in a web app](./integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md)
- [Integrating the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the Optimization React Native SDK in a React Native app](./integrating-the-react-native-sdk-in-a-react-native-app.md)
- [Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md)
- [Interaction tracking in Node and stateless environments](../concepts/interaction-tracking-in-node-and-stateless-environments.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [React Native SDK Interaction Tracking Mechanics](../concepts/react-native-sdk-interaction-tracking-mechanics.md)
