---
title: Forward Optimization SDK context to analytics and tag-management tools
fern:
  slug: forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools
  section: Guides
  description: >-
    Use this guide when your application already sends events to an analytics, tag-management,
    customer-data, replay, or product-analytics destination and you want to attach approved
    Optimization SDK context to those events.
---

# Forward Optimization SDK context to analytics and tag-management tools

Use this guide when your application already sends events to an analytics, tag-management,
customer-data, replay, or product-analytics destination and you want to attach approved Optimization
SDK context to those events.

By the end, you can forward one approved SDK event or context signal to an app-owned destination
without changing which events the SDK sends to Contentful.

This guide supplements the SDK integration guides. It does not install a vendor SDK, define a full
tracking plan, or replace Contentful Analytics delivery. The Optimization SDK still sends its own
supported events to Contentful when your integration and consent policy allow them. Your
application decides which Contentful context, if any, can also reach a third-party destination.

## Do you need this?

Use this guide when one of these statements is true:

- A report needs to break down existing events by Contentful experience, variant, entry, or Custom
  Flag value.
- A tag manager or CDP needs a small set of `contentful_*` fields for routing or enrichment.
- A server-rendered or native app already has an analytics event owner and needs request-local or
  runtime-local Optimization context.

Skip this guide when you only need Contentful Personalization and Analytics. The SDK integration
guides own the Contentful event-delivery setup; this recipe only covers app-owned forwarding to
other destinations.

## Quick start

Start with one app-level subscription in a plain browser Web SDK integration. This example assumes
`./optimization` exports the initialized SDK singleton from that integration, `./analytics` exports
your destination client, and `./analytics-consent` exports your app-owned destination-consent
decision. Register the subscription near SDK initialization, keep the message-ID cache outside the
subscriber lifecycle, and forward only primitive fields.

Every emitted event has an SDK-generated `messageId`; use it to deduplicate that one event across
subscriber remounts. `states.eventStream.current` is the latest accepted event value, not a history.
`hoverId` is required for hover events. `viewId` is required for entry-view events and optional only
for flag-view events. Forward both according to the event schema.

**Adapt this to your use case:**

```ts
import { analytics } from './analytics'
import { appPolicyAllowsThirdPartyAnalytics } from './analytics-consent'
import { optimization } from './optimization'

// Keep this cache in module or app-singleton scope so remounts do not reset it.
const forwardedMessageIds = new Set<string>()

type ComponentOptimizationEvent = {
  type: 'component' | 'component_click' | 'component_hover'
  messageId: string
  componentId: string
  componentType: 'Entry' | 'Variable'
  experienceId?: string
  variantIndex: number
  viewId?: string
  hoverId?: string
}

function isComponentOptimizationEvent(event: {
  type: string
}): event is ComponentOptimizationEvent {
  return (
    event.type === 'component' ||
    event.type === 'component_click' ||
    event.type === 'component_hover'
  )
}

function pickQuickStartContentfulProperties(event: { type: string; messageId: string }) {
  const componentEvent = isComponentOptimizationEvent(event) ? event : undefined

  return {
    contentful_event_type: event.type,
    contentful_message_id: event.messageId,
    contentful_component_id: componentEvent?.componentId,
    contentful_component_type: componentEvent?.componentType,
    contentful_experience_id: componentEvent?.experienceId,
    contentful_variant_index: componentEvent?.variantIndex,
    contentful_view_id: componentEvent?.viewId,
    contentful_hover_id: componentEvent?.hoverId,
  }
}

// Skip the synchronous current accepted value when this handoff forwards only later SDK events.
const initialMessageId = optimization.states.eventStream.current?.messageId

// Subscribe once near SDK initialization so child or router events can be observed.
const subscription = optimization.states.eventStream.subscribe((event) => {
  if (!event) return

  // The observable can emit its current value when a subscriber registers.
  if (forwardedMessageIds.has(event.messageId)) return
  if (event.messageId === initialMessageId) {
    forwardedMessageIds.add(event.messageId)
    return
  }

  // Apply the destination's consent policy before leaving your application boundary.
  if (!appPolicyAllowsThirdPartyAnalytics()) return

  forwardedMessageIds.add(event.messageId)

  // Forward only the approved primitive fields that your analytics owner expects.
  analytics.track(`Contentful ${event.type}`, pickQuickStartContentfulProperties(event))
})
```

Keep the returned `subscription` for teardown in tests, hot reloads, or route-level provider
unmounts. The message-ID cache, not the subscription object, prevents re-forwarding across
subscriber or provider remounts. `analytics.track()` and
`appPolicyAllowsThirdPartyAnalytics()` remain app-owned integration points. The property helper
narrows before reading component-specific fields, so
page, screen, identify, and custom track events forward only event-level properties. Remove the
initial-value guard when forwarding the current accepted SDK event at subscription time is
intentional. Verify that an SDK activity creates the intended destination event before adding more
vendors or fields. Use the helper in the default recipe when the destination rejects `undefined`
values.

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
   provider lifecycle so remounts can recognize the same current value. When a subscriber must
   forward only events emitted after it registers, record `states.eventStream.current?.messageId`
   before subscribing and skip that first message ID.
4. Map only stable, primitive values. Prefer `contentful_*` property names unless your tracking plan
   already defines destination-specific names.
5. Attach Contentful context to existing business events only when the report needs attribution by
   experience, variant, entry, or flag.

`states.selectedOptimizations` is the plural set of current experience and variant selections. It
is useful for readiness checks and coarse segmentation, but it is not an exposure event by itself.
It tells you which experiences are active for the current profile, not which entry rendered or
which user interaction occurred.

Every emitted JavaScript SDK event carries `event.context.campaign`, the SDK-owned output object for
campaign attribution. When an event call omits explicit campaign data, the SDK can populate that
object from supported UTM parameters. If inference finds nothing, the emitted object is empty:
`event.context.campaign` is `{}`.

For a direct `page()` call, use these full paths to distinguish application inputs from SDK output:

| Full field path                                         | Owner                                       | Campaign-attribution role                                                                                   |
| ------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `page()` input `campaign`                               | Application input                           | Highest priority. Even an explicit empty object suppresses URL inference; URL values never fill its fields. |
| `page()` input `properties.url`                         | Application input for this page event       | Supplies the whole inferred campaign when it contains at least one supported UTM parameter.                 |
| `page()` input `page.url`                               | Application input when passed directly      | Supplies the fallback URL for inference when `properties.url` has no supported UTM parameter.               |
| Runtime-provided `page.url`                             | JavaScript SDK runtime or route integration | Supplies the same fallback when the application does not pass `page.url` directly.                          |
| `page()` input `page.referrer` or `properties.referrer` | Application or runtime page-metadata input  | Never supplies campaign attribution, even when the referrer contains supported UTM parameters.              |
| Emitted `event.context.campaign`                        | SDK output                                  | Always an object containing explicit or inferred fields, or `{}` when neither source supplies them.         |

The `properties.url` and fallback `page.url` values are separate inputs. When both contain UTM
parameters, the SDK does not merge them: `properties.url` supplies the entire inferred campaign.
Forward the resulting output fields as separate primitives:

| URL parameter  | `event.context.campaign` field | Suggested destination field   |
| -------------- | ------------------------------ | ----------------------------- |
| `utm_campaign` | `name`                         | `contentful_campaign_name`    |
| `utm_source`   | `source`                       | `contentful_campaign_source`  |
| `utm_medium`   | `medium`                       | `contentful_campaign_medium`  |
| `utm_term`     | `term`                         | `contentful_campaign_term`    |
| `utm_content`  | `content`                      | `contentful_campaign_content` |

> [!NOTE]
>
> An invalid URL, or both eligible URLs lacking supported UTM parameters, leaves the emitted
> `event.context.campaign` object empty.

The SDK event stream is a live handoff, not a durable third-party delivery queue. Stateful
JavaScript observables emit the current value when a subscriber registers, then later updates. They
do not replay the full history, and a new empty `Set` inside a new subscriber does not know which
current `messageId` an earlier subscriber already forwarded. Keep the message-ID cache in
longer-lived app state, or seed an initial message ID to skip when only later events belong in the
destination. React Native uses the same stateful Core stream through `onStatesReady`. iOS uses a
Combine `PassthroughSubject`, and Android exposes a `SharedFlow` with a finite recent-event replay
buffer. Register native collectors before the page, screen, flag, or entry interaction events that
you need to own instead of treating either stream as a durable analytics queue.

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

`OptimizationAnalyticsEvent` below is a reader-owned local projection containing only the SDK event
fields this mapper reads. It is not a type exported by an Optimization SDK package.

**Copy this:**

```ts
type OptimizationAnalyticsEvent = {
  type: string
  messageId: string
  context: {
    campaign: {
      name?: string
      source?: string
      medium?: string
      term?: string
      content?: string
    }
  }
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

function pickContentfulEventProperties(
  event: OptimizationAnalyticsEvent,
): Record<string, string | number | undefined> {
  // Shape the payload to primitive fields instead of forwarding full SDK payloads.
  return dropUndefined({
    contentful_event_type: event.type,
    contentful_message_id: event.messageId,
    contentful_campaign_name: event.context.campaign.name,
    contentful_campaign_source: event.context.campaign.source,
    contentful_campaign_medium: event.context.campaign.medium,
    contentful_campaign_term: event.context.campaign.term,
    contentful_campaign_content: event.context.campaign.content,
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

For Custom Flags, forward analytics from the same code path that reads or renders the flag. In Web,
React Web, Next.js-bound, and React Native integrations, `getFlag()` and reactive flag state can
emit Contentful flag-view tracking. On iOS and Android, flag observers can emit the same Contentful
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
`bindNextjsAppRouterServerOptimization(...)` from
`@contentful/optimization-nextjs/app-router/server`. The nested request root and top-level
explicit-input root use that binding config and render without per-render `clientId`, `environment`,
or `onStatesReady` props. The binding call is not an isolation context; call it once for the
app-local helper set. Bound Client Components use a separate
`bindNextjsAppRouterClientOptimization(...)` binding from `/app-router/client`; router-neutral hooks
and per-entry controls use `/client`.

For Pages Router integrations, configure `onStatesReady` once in
`bindNextjsPagesRouterOptimization(...)` from `@contentful/optimization-nextjs/pages-router`, then
pass `pageProps.contentfulOptimization.handoff` to the bound root in `pages/_app.tsx`.

**Adapt this to your use case:**

```tsx
import { bindNextjsAppRouterServerOptimization } from '@contentful/optimization-nextjs/app-router/server'

const forwardedMessageIds = new Set<string>()

export const optimization = bindNextjsAppRouterServerOptimization({
  // ...clientId, environment, locale, consent
  onStatesReady: (states) => {
    const initialMessageId = states.eventStream.current?.messageId

    // Attach before child route trackers and interaction observers emit.
    const eventSubscription = states.eventStream.subscribe((event) => {
      if (!event) return

      // Guard against the current value and provider remounts.
      if (forwardedMessageIds.has(event.messageId)) return
      if (event.messageId === initialMessageId) {
        forwardedMessageIds.add(event.messageId)
        return
      }

      // Keep vendor consent separate from the SDK's Contentful event consent gate.
      if (!appPolicyAllowsThirdPartyAnalytics()) return

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

export const {
  NextAppAutoPageTracker: RequestNextAppAutoPageTracker,
  OptimizationRoot: RequestOptimizationRoot,
  OptimizedEntry: RequestOptimizedEntry,
} = optimization.request
```

Use `states.blockedEventStream` or `onEventBlocked` for diagnostics. Blocked events are dropped at
the SDK boundary and are not replayed when consent changes.

### Node and Next.js server runtimes

Applies when a Node route, server action, middleware/proxy flow, or lower-level/manual Next.js
server flow already called a request-bound SDK method and owns the analytics event for that request.

Use the `data` from the same accepted SDK call that rendered the response or handled the server
event. App Router private-request routes normally use the nested `optimization.request` family,
which creates and shares its browser handoff internally. The top-level bound
`createRequestHandoff()` is an advanced path for routes that already own explicit request and
handoff orchestration. Pages Router integrations use the config-bound
`createRequestHandoff()` helper from `@contentful/optimization-nextjs/pages-router/server` inside
`getServerSideProps` and return `props.contentfulOptimization.handoff`. Use
`configureNextjsServerOptimization(...)` only when you intentionally configure a lower-level/manual
stateless `/server` runtime. That configuration is not a request-isolation context; bind each request
with the request helpers before reading request-local data. When the SDK is configured with
`contentful: { client }`, prefer the request-bound managed
entry helper so the entry decision and analytics context share the same request data. Browser state
streams cannot explain a server-rendered first paint unless you intentionally hydrate the browser
with the same handoff.

The example below uses the Node SDK. `optimization` is the process-level singleton exported by your
Node integration; `optimization.forRequest()` creates `requestOptimization`, the request-bound
client for one incoming request. `readOptimizationConsent()`, `readOptimizationProfile()`, the
destination policy, the profile-ID forwarding policy, and `analytics.track()` are app-owned helpers.

An event result separates `accepted` from `data`. `accepted` means the SDK policy admitted the call;
it does not prove receipt by a remote service. `data`, when present, is the Experience response with
the request profile, plural `selectedOptimizations`, and Custom Flag `changes`. A singular
`selectedOptimization` returned while resolving one entry is the selection applied to that entry.

**Adapt this to your use case:**

```ts
import { analytics } from './analytics'
import {
  appPolicyAllowsThirdPartyAnalytics,
  canForwardOptimizationProfileId,
} from './analytics-consent'
import { optimization } from './optimization'
import { readOptimizationConsent, readOptimizationProfile } from './optimization-request'

export async function forwardQuoteRequested(req: { url: string }) {
  const url = new URL(req.url)
  const requestOptimization = optimization.forRequest({
    consent: readOptimizationConsent(req),
    locale: 'en-US',
    profile: readOptimizationProfile(req),
  })
  const pageResult = await requestOptimization.page({
    properties: { path: url.pathname },
  })

  const optimizationData = pageResult.accepted ? pageResult.data : undefined

  // Fetch and resolve the entry with the same request-local Optimization data.
  const {
    baselineEntry,
    entry: resolvedHeroEntry,
    selectedOptimization,
  } = await requestOptimization.fetchOptimizedEntry('4ib0hsHWoSOnCVdDkizE8d')

  if (appPolicyAllowsThirdPartyAnalytics()) {
    // The server event owner decides which Contentful fields belong on this business event.
    analytics.track(
      'Quote Requested',
      dropUndefined({
        plan: 'enterprise',
        contentful_profile_id: canForwardOptimizationProfileId()
          ? optimizationData?.profile.id
          : undefined,
        contentful_experience_id: selectedOptimization?.experienceId,
        contentful_variant_index: selectedOptimization?.variantIndex,
        contentful_variant_entry_id: selectedOptimization ? resolvedHeroEntry.sys.id : undefined,
        contentful_baseline_entry_id: baselineEntry.sys.id,
      }),
    )
  }
}
```

For manual Contentful fetching, keep passing an app-fetched `baselineEntry` and
`optimizationData?.selectedOptimizations` to `resolveOptimizedEntry()`, then forward the same fields
from the returned result.

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
`componentId`, `experienceId`, `variantIndex`, `viewId`, and `viewDurationMs`. iOS and Android
expose view and tap tracking, not hover tracking; `hoverId` and `hoverDurationMs` apply to Web and
Node runtimes that emit hover events. If an optimized-entry interaction payload includes the
optional `optimization` enrichment object, prefer approved display strings, such as audience name,
over full nested objects. Apply the same destination policy in every runtime: destination consent
first, payload shaping second.

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

1. Enable both Optimization event consent and destination consent, then trigger a tracked
   optimized-entry click or a route page event. Observe an accepted SDK event with a `messageId` in
   the subscriber. Separately inspect the browser network panel for the expected SDK request; do not
   assume a one-to-one relationship between stream records and network requests, or treat either as
   proof that a remote service processed the event.
2. Add a temporary log immediately before `analytics.track()`, repeat the action, and observe the
   forwarding log and event in the destination's live debugger.
3. Keep Optimization event consent enabled but deny destination consent. Repeat the same action.
   Observe the accepted SDK event and Contentful network request, but no `analytics.track()` log and
   no destination event.
4. For a strict opt-in test, configure the test SDK with `allowedEventTypes: []`, deny Optimization
   event consent, and repeat the action. Observe the attempted method in
   `states.blockedEventStream`, native `blockedEventStream`, or `onEventBlocked`, with no accepted
   event and no third-party forwarding. The default Web allow-list includes `page` and `identify`,
   so denied consent alone does not block those methods.
5. Re-enable consent, trigger an event, then remount the subscriber or provider. Confirm the same
   current `messageId` does not produce a second destination event because the cache outlives the
   subscriber or the initial current value is intentionally skipped.
6. In a stateful browser JavaScript runtime, such as Web, React Web, or a Next.js browser binding,
   validate URL campaign attribution separately from the iOS and Android paths. Replace the quick-
   start `pickQuickStartContentfulProperties()` call with the full
   `pickContentfulEventProperties()` mapper from the default recipe; the quick-start mapper does not
   include campaign fields. Load a page URL such as
   `https://example.com/pricing?utm_campaign=spring&utm_source=newsletter&utm_medium=email`, then
   trigger its SDK page event. Set a breakpoint on the `analytics.track()` call, or add a temporary
   log immediately before it, and inspect both `event.context.campaign` and the object returned by
   `pickContentfulEventProperties(event)`. Observe `spring`, `newsletter`, and `email` in the
   campaign object and the corresponding destination fields. Because the URL omits `utm_term` and
   `utm_content`, expect no `contentful_campaign_term` or `contentful_campaign_content` keys after
   `dropUndefined()`. Confirm the same payload in the destination's live debugger.

Then confirm the broader tracking contract:

- The third-party destination receives only the intended `contentful_*` fields.
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

- [Choose the right SDK](./choosing-the-right-sdk.md)
- [Integrate the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md)
- [Integrate the Optimization Web SDK in a web app](./integrating-the-web-sdk-in-a-web-app.md)
- [Integrate the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrate the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrate the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Integrate the Optimization React Native SDK in a React Native app](./integrating-the-react-native-sdk-in-a-react-native-app.md)
- [Integrate the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
- [Integrate the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md)
- [Integrate the Optimization Android SDK in a Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md)
- [Integrate the Optimization Android SDK in a Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md)

Use these concepts for mechanics behind the recipe:

- [Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md)
- [Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md)
- [Interaction tracking in Node and stateless environments](../concepts/interaction-tracking-in-node-and-stateless-environments.md)
- [React Native SDK interaction tracking mechanics](../concepts/react-native-sdk-interaction-tracking-mechanics.md)
- [iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md)
- [Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
