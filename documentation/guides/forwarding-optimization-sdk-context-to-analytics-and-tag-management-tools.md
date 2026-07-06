---
title: Forwarding Optimization SDK context to analytics and tag-management tools
---

# Forwarding Optimization SDK context to analytics and tag-management tools

Use this guide when your application already sends events to an analytics, tag-management,
customer-data, replay, or product-analytics destination and you want to attach approved Optimization
SDK context to those events.

By the end, you can forward one approved SDK event or context signal to an app-owned destination
without changing which events the SDK sends to Contentful.

This guide supplements the SDK integration guides. It does not install a vendor SDK, define a full
tracking plan, or replace Contentful Analytics delivery. The Optimization SDK still sends its own
events to Contentful. Your application decides which Contentful context, if any, can also reach a
third-party destination.

## Do you need this?

Use this guide when one of these statements is true:

- A report needs to break down existing events by Contentful experience, variant, entry, or Custom
  Flag value.
- A tag manager or CDP needs a small set of `contentful_*` fields for routing or enrichment.
- A server-rendered or native app already has an analytics event owner and needs request-local or
  runtime-local Optimization context.

Skip this guide when you only need Contentful Personalization and Analytics. The SDK already sends
page, screen, entry interaction, Custom Flag, and profile-updating events to Contentful when your
integration and consent policy allow them.

## Quick start

Start with one app-level subscription in a stateful JavaScript runtime. Register it near SDK
initialization, gate it with your destination consent policy, keep the message-ID cache outside the
subscriber lifecycle, and forward only primitive fields.

**Adapt this to your use case:**

```ts
// Keep this cache in module or app-singleton scope so remounts do not reset it.
const forwardedMessageIds = new Set<string>()

// Skip the synchronous current snapshot when this handoff forwards only later SDK events.
const initialMessageId = optimization.states.eventStream.current?.messageId

// Subscribe once near SDK initialization so child or router events can be observed.
const subscription = optimization.states.eventStream.subscribe((event) => {
  if (!event) return

  // The observable can emit the current snapshot when a subscriber registers.
  if (forwardedMessageIds.has(event.messageId)) return
  if (event.messageId === initialMessageId) {
    forwardedMessageIds.add(event.messageId)
    return
  }

  // Apply the destination's consent policy before leaving your application boundary.
  if (!appPolicyAllowsThirdPartyAnalytics()) return

  forwardedMessageIds.add(event.messageId)

  // Forward only the approved primitive fields that your analytics owner expects.
  analytics.track(`Contentful ${event.type}`, {
    contentful_event_type: event.type,
    contentful_message_id: event.messageId,
    contentful_component_id: event.componentId,
    contentful_component_type: event.componentType,
    contentful_experience_id: event.experienceId,
    contentful_variant_index: event.variantIndex,
    contentful_view_id: event.viewId,
    contentful_hover_id: event.hoverId,
  })
})
```

Keep the returned `subscription` for teardown in tests, hot reloads, or route-level provider
unmounts. The message-ID cache, not the subscription object, prevents re-forwarding across
subscriber or provider remounts. Remove the initial snapshot guard when forwarding the current
accepted SDK event at subscription time is intentional. Verify one SDK activity creates one intended
destination event before adding more vendors or fields. Use the helper in the default recipe when
the destination rejects `undefined` values or when exposure reports need view and hover
deduplication.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Default recipe](#default-recipe)
- [Runtime or vendor variants](#runtime-or-vendor-variants)
  - [Stateful JavaScript runtimes](#stateful-javascript-runtimes)
  - [Node and Next.js server runtimes](#node-and-nextjs-server-runtimes)
  - [Native mobile runtimes](#native-mobile-runtimes)
  - [Destination variants](#destination-variants)
- [Validate the integration](#validate-the-integration)
- [Governance notes](#governance-notes)
- [Related guides and concepts](#related-guides-and-concepts)

<!-- mtoc-end -->
</details>

## Default recipe

Use the same pattern for every destination:

1. Pick the event owner. Use state streams for stateful clients, request-local event results for
   Node and server rendering, and existing business-event code for purchases, signups, leads, or
   other app-defined actions.
2. Gate forwarding with the same application or CMP decision that controls the destination. SDK
   consent controls SDK event emission, not vendor consent modes.
3. Deduplicate event-stream forwarding by `messageId`. Keep the cache outside the subscriber or
   provider lifecycle so remounts can recognize the same current snapshot. When a subscriber must
   forward only events emitted after it registers, record `states.eventStream.current?.messageId`
   before subscribing and skip that first message ID.
4. Collapse view and hover duration records before sending exposure or funnel events to a
   third-party destination. SDK view and hover tracking can emit multiple records with the same
   `viewId` or `hoverId`. Sticky `trackView()` also emits an Experience event and a paired Insights
   event for the same view.
5. Map only stable, primitive values. Prefer `contentful_*` property names unless your tracking plan
   already defines destination-specific names.
6. Attach Contentful context to existing business events only when the report needs attribution by
   experience, variant, entry, or flag.

`states.selectedOptimizations` is useful for readiness checks and coarse segmentation, but it is not
an exposure event by itself. It tells you which experiences are active for the current profile, not
which entry rendered or which user interaction occurred.

The SDK event stream is a live handoff, not a durable third-party delivery queue. Stateful
JavaScript observables emit the current value when a subscriber registers, then later updates. They
do not replay the full history, and a new empty `Set` inside a new subscriber does not know which
current `messageId` an earlier subscriber already forwarded. Keep the message-ID cache in
longer-lived app state, or seed an initial message ID to skip when only later events belong in the
destination. iOS uses a Combine `PassthroughSubject`, and Android exposes a `SharedFlow` with a
finite recent-event replay buffer. Register native collectors before the page, screen, flag, or
entry interaction events that you need to own instead of treating either stream as a durable
analytics queue.

Optimized entry interaction events can include an `optimization` object on the event-stream payload.
That object is runtime-only enrichment for application subscribers; the SDK does not send it to the
Experience API or Insights API event payload. The enrichment can include the selected optimization,
the Optimization entry, the audience entry, the baseline entry, the resolved entry, and selected
variant metadata. Treat it as read-only and potentially large. Forward only approved primitive
fields, such as audience name or experience name, instead of forwarding the full object or complete
Contentful entries.

The `optimization` object is optional. It appears when the SDK can connect an interaction event to
an optimized entry resolution context. It is absent on events without that context, including
standalone Custom Flag view events.

**Copy this:**

```ts
type OptimizationAnalyticsEvent = {
  type: string
  messageId: string
  componentId?: string
  componentType?: string
  experienceId?: string
  variantIndex?: number
  viewId?: string
  viewDurationMs?: number
  hoverId?: string
  hoverDurationMs?: number
  optimization?: {
    audienceEntry?: {
      fields?: {
        nt_name?: string
      }
    }
    optimizationEntry?: {
      fields?: {
        nt_name?: string
        nt_type?: string
      }
    }
  }
}

const forwardedSemanticInteractions = new Set<string>()

function shouldForwardContentfulEvent(event: OptimizationAnalyticsEvent): boolean {
  const semanticId = event.viewId ?? event.hoverId

  if ((event.type !== 'component' && event.type !== 'component_hover') || !semanticId) {
    return true
  }

  // Collapse repeated duration updates for the same view or hover interaction.
  const key = [
    event.type,
    event.componentType,
    event.componentId,
    event.experienceId,
    event.variantIndex,
    semanticId,
  ].join(':')

  if (forwardedSemanticInteractions.has(key)) return false

  forwardedSemanticInteractions.add(key)
  return true
}

function pickContentfulEventProperties(
  event: OptimizationAnalyticsEvent,
): Record<string, string | number | undefined> {
  // Shape the payload to primitive fields instead of forwarding full SDK payloads.
  return dropUndefined({
    contentful_event_type: event.type,
    contentful_message_id: event.messageId,
    contentful_component_id: event.componentId,
    contentful_component_type: event.componentType,
    contentful_experience_id: event.experienceId,
    contentful_variant_index: event.variantIndex,
    contentful_view_id: event.viewId,
    contentful_view_duration_ms: event.viewDurationMs,
    contentful_hover_id: event.hoverId,
    contentful_hover_duration_ms: event.hoverDurationMs,
    contentful_audience_name: event.optimization?.audienceEntry?.fields?.nt_name,
    contentful_experience_name: event.optimization?.optimizationEntry?.fields?.nt_name,
    contentful_experience_type: event.optimization?.optimizationEntry?.fields?.nt_type,
  })
}

function dropUndefined<TValue>(values: Record<string, TValue | undefined>): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Record<string, TValue>
}
```

If a destination can store engagement duration, aggregate by `viewId` or `hoverId` and send the
maximum or final duration value instead of dropping later duration records.

For Custom Flags, forward analytics from the same code path that reads or renders the flag. In
stateful SDKs, `getFlag()` and `states.flag(name)` or native flag observers can emit Contentful
flag-view tracking. Do not add an analytics-only flag subscription unless you intentionally want
that additional Contentful flag-view observation.

## Runtime or vendor variants

### Stateful JavaScript runtimes

Applies when you use the Web SDK, React Web SDK, React Native SDK, or app-local bound Next.js
components and the SDK instance owns observable state.

For plain Web SDK integrations, subscribe directly on the SDK instance. For React Web and React
Native integrations, prefer `onStatesReady` on the provider root so the subscription exists before
child effects can emit SDK events.

For Next.js App Router integrations, configure `onStatesReady` once in
`createNextjsAppRouterOptimization()` from `@contentful/optimization-nextjs/app-router`. The bound
`OptimizationRoot` uses that factory config and renders without per-render `clientId`,
`environment`, or `onStatesReady` props. Use lower-level `/client` root props only for manual
server/client escape hatches.

For Pages Router integrations, configure `onStatesReady` once in
`createNextjsPagesRouterOptimization()` from `@contentful/optimization-nextjs/pages-router`, then
pass `pageProps.contentfulOptimization.serverOptimizationState` to the bound root in
`pages/_app.tsx`.

**Adapt this to your use case:**

```tsx
import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'

const forwardedMessageIds = new Set<string>()

export const { proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsAppRouterOptimization({
    // ...clientId, environment, locale, server, defaults
    onStatesReady: (states) => {
      const initialMessageId = states.eventStream.current?.messageId

      // Attach before child route trackers and interaction observers emit.
      const eventSubscription = states.eventStream.subscribe((event) => {
        if (!event) return

        // Guard against the current snapshot and provider remounts.
        if (forwardedMessageIds.has(event.messageId)) return
        if (event.messageId === initialMessageId) {
          forwardedMessageIds.add(event.messageId)
          return
        }

        // Keep vendor consent separate from the SDK's Contentful event consent gate.
        if (!appPolicyAllowsThirdPartyAnalytics()) return
        if (!shouldForwardContentfulEvent(event)) return

        forwardedMessageIds.add(event.messageId)

        // The analytics layer owns destination naming and property registration.
        analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
      })

      const blockedSubscription = states.blockedEventStream.subscribe((blocked) => {
        if (!blocked) return

        // Blocked events are diagnostic only and are not replayed after consent changes.
        console.debug('Contentful event blocked', {
          method: blocked.method,
          reason: blocked.reason,
        })
      })

      return () => {
        eventSubscription.unsubscribe()
        blockedSubscription.unsubscribe()
      }
    },
  })
```

Use `states.blockedEventStream` or `onEventBlocked` for diagnostics. Blocked events are dropped at
the SDK boundary and are not replayed when consent changes.

### Node and Next.js server runtimes

Applies when a Node route, server action, middleware/proxy flow, or lower-level/manual Next.js
server flow already called a request-bound SDK method and owns the analytics event for that request.

Use the `data` from the same accepted SDK call that rendered the response or handled the server
event. App Router Next.js integrations load request server data through the bound components created
by `createNextjsAppRouterOptimization()`. Use the config-bound `getServerSideOptimizationProps()`
helper for Pages Router `getServerSideProps`; it returns the same `OptimizationData` shape in its
`data` field and serializable `props.contentfulOptimization`. Use
`getNextjsServerOptimizationData()` only when you intentionally build a lower-level/manual `/server`
flow. Browser state streams cannot explain a server-rendered first paint unless you intentionally
hydrate the browser with the same Optimization data.

**Adapt this to your use case:**

```ts
const pageResult = await requestOptimization.page({
  properties: { path: req.path },
})

const optimizationData = pageResult.accepted ? pageResult.data : undefined

// Resolve the entry and analytics context from the same request-local Optimization data.
const { entry: resolvedHeroEntry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineHeroEntry,
  optimizationData?.selectedOptimizations,
)

if (appPolicyAllowsThirdPartyAnalytics()) {
  // The server event owner decides which Contentful fields belong on this business event.
  analytics.track(
    'Quote Requested',
    dropUndefined({
      plan: 'enterprise',
      contentful_profile_id: canForwardOptimizationProfileId
        ? optimizationData?.profile.id
        : undefined,
      contentful_experience_id: selectedOptimization?.experienceId,
      contentful_variant_index: selectedOptimization?.variantIndex,
      contentful_variant_entry_id: selectedOptimization ? resolvedHeroEntry.sys.id : undefined,
      contentful_baseline_entry_id: baselineHeroEntry.sys.id,
    }),
  )
}
```

In stateless runtimes, Insights-only calls such as non-sticky `trackView()`, `trackClick()`,
`trackHover()`, and `trackFlagView()` need a request-bound profile. Sticky `trackView()` returns
Optimization data from the Experience path before sending the paired Insights event.

### Native mobile runtimes

Applies when an iOS or Android app uses the native SDK and an app-owned analytics layer already
collects events.

Subscribe from the screen or application owner that outlives the interactions you want to observe.
On iOS, `eventStream` is a Combine publisher backed by a `PassthroughSubject`, so subscribe before
calling `page()`, `screen()`, `flagPublisher(...)`, or rendering tracked entries. On Android,
collect `client.eventStream` from a lifecycle-aware coroutine scope and cancel that scope with the
owning screen or activity.

#### iOS

Applies when a SwiftUI view model, UIKit controller, scene delegate, or app-level analytics owner
holds the `AnyCancellable`. Shape the dictionary before calling the vendor SDK because native events
can include fields that your destination has not approved.

**Follow this pattern:**

```swift
private var analyticsCancellable: AnyCancellable?

func contentfulAnalyticsProperties(from event: [String: Any]) -> [String: Any] {
    let optimization = event["optimization"] as? [String: Any]
    let audience = optimization?["audienceEntry"] as? [String: Any]
    let audienceFields = audience?["fields"] as? [String: Any]
    let experience = optimization?["optimizationEntry"] as? [String: Any]
    let experienceFields = experience?["fields"] as? [String: Any]

    [
        "contentful_event_type": event["type"],
        "contentful_message_id": event["messageId"],
        "contentful_component_id": event["componentId"],
        "contentful_component_type": event["componentType"],
        "contentful_experience_id": event["experienceId"],
        "contentful_variant_index": event["variantIndex"],
        "contentful_view_id": event["viewId"],
        "contentful_audience_name": audienceFields?["nt_name"],
        "contentful_experience_name": experienceFields?["nt_name"],
        "contentful_experience_type": experienceFields?["nt_type"],
    ].compactMapValues { $0 }
}

analyticsCancellable = client.eventStream.sink { event in
    // Apply destination consent and payload shaping before forwarding outside the app.
    guard appPolicyAllowsThirdPartyAnalytics() else { return }

    analytics.track(
        "Contentful \(event["type"] as? String ?? "event")",
        properties: contentfulAnalyticsProperties(from: event)
    )
}
```

#### Android

Applies when a Compose screen, XML activity, or app-level analytics owner can collect from a
lifecycle-aware coroutine scope. Android keeps a finite recent-event replay buffer, so apply
`messageId` or semantic deduplication before forwarding if the collector can restart.

**Follow this pattern:**

```kotlin
lifecycleScope.launch {
    client.eventStream.collect { event ->
        // Apply destination consent and payload shaping before forwarding outside the app.
        forwardOptimizationEvent(event)
    }
}
```

Native events arrive as dictionary or map payloads with fields such as `type`, `messageId`,
`componentId`, `experienceId`, `variantIndex`, `viewId`, and `viewDurationMs`. Native mobile SDKs
expose view and tap tracking, not hover tracking; `hoverId` and `hoverDurationMs` apply to Web and
Node runtimes that emit hover events. Optimized entry interaction events can also include the same
optional `optimization` enrichment object. Keep the same mapping and consent rules that you use for
JavaScript destinations, and prefer approved display strings, such as audience name, over full
nested objects.

### Destination variants

Use the destination shape that matches your analytics architecture:

| Destination group                     | Applies when                                                                     | Handoff pattern                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Direct analytics SDKs                 | Your app owns calls such as GA, Segment, Amplitude, Mixpanel, or PostHog events. | Call the destination's track or capture method with mapped `contentful_*` fields.  |
| Tag managers and data layers          | GTM or another tag manager owns routing and vendor tags.                         | Push one normalized object and map variables inside the tag manager.               |
| CDPs and event buses                  | Segment, Adobe Experience Platform, or a warehouse pipeline fans out events.     | Keep Contentful fields in a namespaced object or approved tracking-plan schema.    |
| Replay and experience analytics tools | Contentsquare, Heap, or session replay tools need segmentation by variant.       | Send short, non-personal segment fields and avoid broad profile or entry payloads. |

#### GTM and dataLayer

Applies when Google Tag Manager owns routing to one or multiple vendor tags. Push one normalized
object and register the corresponding data-layer variables inside the tag manager.

**Follow this pattern:**

```ts
window.dataLayer = window.dataLayer ?? []

window.dataLayer.push({
  // The tag manager owns routing from this normalized object to vendor tags.
  event: `contentful_${event.type}`,
  ...pickContentfulEventProperties(event),
})
```

#### Adobe Web SDK

Applies when Adobe Web SDK forwards event data to Adobe Experience Platform or downstream Adobe
reporting. Keep the Contentful fields namespaced unless your approved tracking plan maps them to
specific XDM fields.

**Follow this pattern:**

```ts
alloy('sendEvent', {
  type: `contentful.${event.type}`,
  data: {
    contentful: {
      // Keep Contentful context namespaced when the destination fans out events.
      optimization: pickContentfulEventProperties(event),
    },
  },
})
```

Register destination-specific custom dimensions, event properties, XDM fields, or data-layer
variables before relying on reports. Keep vendor autocapture from duplicating SDK page, screen,
click, tap, hover, or exposure events unless your tracking plan intentionally counts both.

## Validate the integration

Verify the recipe before release:

- The SDK integration still sends expected events to Contentful when consent allows it.
- The third-party destination receives only the intended `contentful_*` fields.
- Denied or withdrawn consent blocks both SDK-gated events and third-party forwarding according to
  your application policy.
- `states.blockedEventStream`, native `blockedEventStream`, or `onEventBlocked` shows expected
  blocked methods during consent tests.
- Subscriber or provider remounts do not resend the same current `messageId`; either the cache
  outlives the subscriber or the initial snapshot is intentionally skipped.
- View and hover records are collapsed, summarized, or intentionally mirrored before reaching
  third-party exposure and funnel reports.
- Sticky view tracking produces one intended downstream exposure, not one Experience exposure plus
  one Insights exposure.
- Server-rendered first paint and browser follow-up tracking have one owner for each event in the
  tracking plan.
- Known-user identity uses your application user ID. The Optimization profile ID is metadata only
  when your policy allows forwarding it.
- Event-stream `optimization` enrichment is reduced to approved primitive fields, such as audience
  name or experience name, before it leaves the application boundary.
- Full profile objects, audience membership lists, raw `changes`, complete Contentful entries, and
  rich text bodies are absent from destination payloads unless the destination is explicitly
  approved for that data.

## Governance notes

Treat this recipe as a data-routing decision, not as an SDK requirement.

The application owns the tracking plan, consent record, destination consent modes, retention rules,
and deletion or suppression flows. SDK consent is a runtime gate for SDK events. It does not
configure Google Consent Mode, tag-manager consent, warehouse routing, replay masking, ad-platform
sharing, or product-analytics opt-out behavior.

Use the Optimization profile ID carefully. It is a profile-continuity identifier, not your known
user ID. Use your application user ID for vendor `identify()` calls, and forward the Optimization
profile ID only as approved event metadata.

Keep server, browser, and native event names aligned when they describe the same business behavior.
When the same user action can happen in more than one runtime, document which runtime owns the
third-party event and which runtime only sends Contentful SDK events.

## Related guides and concepts

Use these guides when you need the SDK setup that this recipe assumes:

- [Choosing the right SDK](./choosing-the-right-sdk.md)
- [Integrating the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md)
- [Integrating the Optimization Web SDK in a web app](./integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Integrating the Optimization React Native SDK in a React Native app](./integrating-the-react-native-sdk-in-a-react-native-app.md)
- [Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
- [Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md)
- [Integrating the Optimization Android SDK in a Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md)
- [Integrating the Optimization Android SDK in a Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md)

Use these concepts for mechanics behind the recipe:

- [Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md)
- [Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md)
- [Interaction tracking in Node and stateless environments](../concepts/interaction-tracking-in-node-and-stateless-environments.md)
- [React Native SDK interaction tracking mechanics](../concepts/react-native-sdk-interaction-tracking-mechanics.md)
- [iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md)
- [Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
