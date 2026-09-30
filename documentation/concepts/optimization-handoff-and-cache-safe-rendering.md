---
title: Optimization handoff and cache-safe rendering
fern:
  slug: optimization-handoff-and-cache-safe-rendering
  section: Concepts
  description: >-
    Understand how server, static, and edge-rendered Optimization state reaches the browser without
    putting visitor-specific profile state into public caches.
---

# Optimization handoff and cache-safe rendering

Use this document to understand how server, static, and edge-rendered Optimization state reaches the
browser without putting visitor-specific profile state into public caches. It applies to the
Next.js SDK, React Web SDK, and Web SDK surfaces that consume an Optimization handoff.

For setup steps, use the relevant Next.js integration guide. This concept explains the mechanics
behind those guides: what a handoff contains, who owns cacheable permutations, how hydration differs
from live updates, and how analytics-only markup can still carry Optimization tracking metadata.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime support](#runtime-support)
- [Inputs and constraints](#inputs-and-constraints)
- [Mental model](#mental-model)
- [Cache scopes](#cache-scopes)
- [Customer-owned permutations](#customer-owned-permutations)
- [Hydration and live updates](#hydration-and-live-updates)
- [Replay and initial page ownership](#replay-and-initial-page-ownership)
- [Analytics-only handoff and tracking attributes](#analytics-only-handoff-and-tracking-attributes)
- [Why profile state stays out of public caches](#why-profile-state-stays-out-of-public-caches)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Runtime support

| Runtime surface                                                           | Handoff role                                                                                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router/server`                       | Binds explicit-input App Router server components and helpers plus the nested request component family.                                               |
| `@contentful/optimization-nextjs/app-router/client`                       | Binds App Router browser roots, entries, trackers, and explicit handoff helpers.                                                                      |
| `@contentful/optimization-nextjs/pages-router` and `/pages-router/server` | Binds Pages Router roots, `getServerSideProps` request handoff helpers, and public permutation handoff helpers.                                       |
| `@contentful/optimization-nextjs/edge`                                    | Configures Edge runtime request handoff and public permutation handoff helpers.                                                                       |
| `@contentful/optimization-nextjs/request-handler`                         | Forwards sanitized request context through pass-through responses.                                                                                    |
| `@contentful/optimization-nextjs/cache-middleware`                        | Rewrites pass-through Next.js proxy or middleware requests to the public permutation cache key produced by the same metadata helper used by handoffs. |
| `@contentful/optimization-nextjs/tracking-attributes`                     | Produces server, static, and edge `data-ctfl-*` tracking attributes for manual rendering paths.                                                       |
| `@contentful/optimization-react-web`                                      | Consumes content handoffs in `OptimizationRoot` and analytics-only handoffs in `OptimizationAnalyticsRoot`.                                           |
| `@contentful/optimization-web`                                            | Hydrates content handoffs into a live browser SDK and analytics-only handoffs into a narrow analytics runtime.                                        |

## Inputs and constraints

An `OptimizationHandoff` is the framework-neutral shape for state produced before browser hydration.
It can contain:

- `state.selectedOptimizations` - the selected experience and variant records used for entry
  resolution.
- `state.changes` - Custom Flag changes derived from the selected optimizations.
- `state.profile` - profile state from a request-backed Experience API response.
- `entries` - managed-entry baseline snapshots that let browser-managed ID or content-type/slug
  sources hydrate from the same baseline entry the server or static render used. A slug handoff
  nests its normalized lookup descriptor under `managedEntry` and retains the fetched entry's
  `sys.id` in `entryId`.
- `cache` - metadata that describes where the rendered output is allowed to be cached.

Browser handoffs add `hydration`, the browser presentation policy for already-rendered content. A
private request handoff can also carry a replay envelope. The envelope is not general handoff state:
it is a one-shot browser-delivery instruction for the previewed server event batch.

The application owns serialization and transport of the handoff between its server render and browser
entry point. The SDK consumes the supplied handoff; it does not choose an application transport.

The SDK serializes and hydrates the state it receives. Browser hydration applies only state fields
that are present on the handoff. During Web handoff state interception, omitted interceptor fields
keep the incoming handoff value, while an own field whose value is `undefined` is applied
intentionally. Hydrating an undefined or empty handoff state still marks the browser Experience
request state as successful. For content handoffs, that successful empty hydration clears stale
selected optimizations and changes while preserving the existing profile unless the handoff includes
its own `profile` field.

The SDK does not infer application segments, campaigns, markets, or other public permutations from
the URL. When a handoff is cacheable across visitors, application code supplies the selected
optimizations and cache key.

## Mental model

Handoff is a render boundary. A server, build, Pages Router ISR, App Router Cache Components, or
Edge runtime path resolves content using a known Optimization state, then passes that same state to
the browser so the first browser render matches the markup.

```text
request, build, ISR, Cache Components, or Edge runtime code chooses Optimization state
  -> route resolves entries or renders analytics-only markup
  -> route creates a browser handoff with cache metadata
  -> browser root hydrates from the handoff
  -> browser SDK takes over according to hydration and liveUpdates policy
```

The handoff is not a cache key by itself. Cache safety comes from matching the rendered output, the
handoff state, and the cache scope.

In App Router, managed-entry prefetch without a supplied handoff creates a baseline `static` handoff
with `hydration: 'preserve-server'` and `selectedOptimizations: []`. Treat it as baseline entry
warming, not request-personalized state.
Prefetch accepts ID and content-type/slug descriptors. A matching browser source uses the handed-off
baseline through either the source key or resolved `sys.id`, so it does not repeat the CDA request.

For private App Router rendering, the server binding's nested `request` family owns the handoff
boundary. Its components share one request initializer that reads the active request, derives the
render inputs, creates a `private-request` handoff, and supplies that handoff to the bound root or
provider. Application code does not need a request cache, route shell, duplicate awaits, or manual
header, cookie, URL, route-key, or page-payload plumbing. Top-level server components remain
explicit-input surfaces for static, public-permutation, analytics-only, and advanced manual flows.

## Cache scopes

| Scope                | Use it for                                                                                                            | Cache rule                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `private-request`    | A real request backed by cookies, request headers, profile continuity, or an Experience API response for one visitor. | Keep the rendered output out of shared public caches.                       |
| `public-permutation` | A customer-owned segment, market, campaign, or path where application code already chose the selected optimizations.  | Provide a helper-built `cache.key` that covers the full public permutation. |
| `static`             | Build-time or baseline output that does not depend on request profile state.                                          | Do not include profile state.                                               |

`getOptimizationCacheSafetyWarnings()` reports diagnostics without blocking rendering.
`assertOptimizationCacheSafety()` throws a `TypeError` for the same unsafe states, and SDK handoff
constructors call it for created handoffs. Browser content and analytics handoff hydration also call
it before writing handoff state into the live Web SDK. Request handoff helpers are stricter before
request evaluation: they accept `private-request` cache metadata and reject `public-permutation` or
`static` cache metadata with a `TypeError`. Public permutation metadata requires a non-empty key at
the type level and at runtime.

React Web validates content handoff cache safety before children read the initial snapshot runtime.
An unsafe public or static handoff with profile state fails before the first handoff-backed render.

## Customer-owned permutations

A customer-owned public permutation is a cacheable output your application can name from a finite
app-owned or customer-owned registry without reading a visitor profile. The registry can come from a
segment service, CMS or config mapping, static artifact, or reviewed app config.

The public/static handoff helpers serialize the selected optimizations, changes, entries, and cache
metadata your application supplies. They do not call the Experience API or derive selections from
route, cookie, header, locale, or cache-key inputs.

A registry record is valid for a static, ISR-style, or Edge runtime public output only when it has
enough dimensions to fetch, resolve, hand off, and cache one output: public key or slug, locale,
baseline entry IDs, `selectedOptimizations`, optional rendered `changes`, and an app-owned revision
or cache version. The app-owned revision must change when selected optimizations, rendered Custom
Flag changes, rendered entries, locale, content environment, or cache policy change. The SDK
serializes and hydrates the state you supply. It does not discover public permutations for the
application.

The validity boundary is cache ownership. Public and static handoffs must use app-owned selections,
not request profile, cookies, headers, or request-derived selection data. Public cache keys come
from `createPublicPermutationCacheMetadata()` or a framework helper that calls it. The helper
encodes key fields such as `permutation=...` and `version=...`, then includes scope, locale,
baseline entry IDs, and selected optimizations in the suffix. `cacheVersion` is optional in the API,
but cacheable public routes should supply it so the app has an explicit invalidation dimension. The
generated `cache.key` does not fingerprint Custom Flag `changes`; if rendered flag values affect
the output, represent that dimension through `cacheVersion` or another caller-owned key. The
generated key is deterministic SDK identity and transport metadata; it is not a Next.js `use cache`
key and is not a `cacheTag()` or `revalidateTag()` tag.

Next.js public permutation middleware consumes the same public metadata object. Its default rewrite
uses the SDK-owned `ctfl-opt-cache-key` query parameter, and custom rewrites receive an
`encodedCacheKey` for locations that need an already-encoded value. Next.js tags are caller-owned
invalidation labels. When supplied to the Next.js helpers or middleware metadata, use no more than
128 tags; each tag must be a non-empty string after trimming, 256 characters or fewer, and must not
include commas. App Router Cache Components can pass short custom tags to `cacheTag()`. Pages Router
ISR and Edge runtime public routes can omit tags unless the app wires tag invalidation.
For public permutation middleware, existing middleware or proxy rewrites, redirects, or other
terminal responses are returned unchanged. The request-context handler is context-only: it preserves
an existing rewrite response while applying SDK request context, but it does not perform a server
event request or write profile cookies. Pass-through responses keep flowing through the Optimization
rewrite or request-context path.

For selected-optimization shape, content model, variant-index, and fallback details, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md). For
the procedural Next.js recipe, see
[Render personalized Next.js routes with static, ISR, and edge handoffs](../guides/rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md).

## Hydration and live updates

`hydration` controls the first browser presentation over already-rendered markup.

| Hydration mode                   | Effect                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preserve-server`                | Keep server, static, ISR-style, or Edge runtime-rendered content continuously visible while browser presentation state adopts the live SDK.                         |
| `client-only-hidden-until-ready` | Let the browser own content resolution; the default loading presentation can hide the baseline layout target until selected, baseline, or fallback content commits. |
| `analytics-only`                 | Hydrate analytics state without providing content resolution context.                                                                                               |

For each baseline entry ID, the first selected, baseline, preserved, or timeout/failure fallback
becomes the browser commitment: it is the first content shown, and with live updates off it stays in
place. Later selections, pending state, and failure state do not replace it or restore loading. With
live updates on, later defined selections can replace it; an empty `selectedOptimizations` array
(`[]`) means no selection applies and resolves baseline content with matching baseline tracking
metadata. A different baseline entry ID starts a new presentation.

`liveUpdates` controls later browser re-resolution after startup. A route can preserve the rendered
content for stable first paint and still keep live updates off. Turn live updates on when visible
content must react to consent, identity, profile, or preview changes after hydration. Preview state
can force live re-resolution for authoring flows.

Every full browser handoff applies its state in live memory only during hydration, regardless of
cache scope, profile state, or replay. Hydration does not update durable continuity. A later
successful live Experience response can persist continuity when persistence consent allows.

## Replay and initial page ownership

For a private Node or Next.js request, the server previews the supplied `identify` and `track`
commands, then appends one SDK-created `page` command. Prefix commands are flat objects:
`{ type: 'identify', userId, traits? }` and `{ type: 'track', event, properties? }`. Preview
evaluates the resulting state but does not commit those events or write a server preview cookie. The
private handoff carries that batch for browser replay. The caller documents the intended command
order; replay does not add versions, schemas, canonicalization, or general order and count
enforcement.

The combined browser operation applies preview state in memory, then submits the server-built Personalization batch with live consent and ordinary event interceptors. Analytics follows that batch using its returned or initially known profile. Input order is retained within Personalization; cross-transport interleaving and intermediate profiles are not reconstructed. Event locale remains metadata and does not split the request. A successful live Experience response can persist continuity when persistence consent permits it.

Server-built events retain their IDs, timestamps, channel, library metadata, request context, and
server interceptor changes. The browser does not regenerate those fields. Browser event interceptors
can still alter payloads through ordinary queue policy. Analytics is built on the server without
server delivery, then committed from the browser after Personalization.

Repeated calls with the same handoff share one completion. Distinct handoffs retain their admitted journals even when newer state arrives. A mismatch, unusable replay, blocked page, or delivery failure permits one ordinary-page attempt only when no page was accepted. Later Analytics failure cannot duplicate an accepted page. Recoverable hydration errors permit safe browser delivery; teardown stops work that has not started.

The server produces wire events and the browser root owns their initial replay/page decision. Keep one root or route tracker per browser runtime. A root with `beforeInitialPage` skips that callback after an accepted matching page replay; otherwise it runs the callback before the ordinary page attempt. Preview-backed content renders independently of this delivery. When a Next.js request has no route identity, preview state can still hydrate but the handoff has no page replay.

Static and public-permutation handoffs do not carry a private replay. A private-request
analytics-only handoff can carry one and follows the same one-shot continuation rules. Without a
replay, the browser route tracker emits the current page when its normal consent and deduplication
rules allow.

## Analytics-only handoff and tracking attributes

Some server, static, ISR-style, or Edge runtime routes render the final HTML themselves and use the
browser SDK only for page and interaction tracking. Those routes use an analytics-only handoff:

- `OptimizationAnalyticsRoot` hydrates an analytics runtime, not a content resolution provider.
- `getServerTrackingAttributes(baselineEntry, resolvedData)` attaches the SDK-owned `data-ctfl-*`
  attributes that browser entry-interaction tracking consumes.
- The `data-ctfl-*` attributes describe the resolved entry, baseline entry, optimization context,
  variant index, sticky selection, and clickable state.

Analytics-only handoffs can carry private replay without providing content resolution. Mount one
analytics route owner per browser runtime. Its combined operation hydrates state and owns initial
delivery, while the ordinary route tracker deduplicates later pages. Newer hydration controls state
publication but preserves earlier admitted journals. A runtime lifetime guard stops work that has
not started after teardown.

Analytics-only rendering still needs the same cache decision as the markup it tracks. A static
analytics handoff is static; a public permutation needs an application-owned key; request-personalized
markup remains private to the request.

## Why profile state stays out of public caches

Profile state is visitor-specific. Request-backed selected optimizations, Custom Flag changes, merge
tag values, and rendered personalized HTML can all depend on that profile. If that state enters a
shared public cache, another visitor can receive the wrong variant, wrong Custom Flag state, wrong
merge-tag output, or a replay envelope that was created for a different profile. Replay is valid
only for a private request handoff and must never enter a static or public-permutation cache.

Use request-backed handoffs for private request rendering. Use public permutation handoffs for
cacheable app-owned permutations. Cache raw Contentful baseline entries according to your
application policy, but keep resolved personalized output scoped to the state that produced it.

## Related documentation

- [Render personalized Next.js routes with static, ISR, and edge handoffs](../guides/rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md)
- [Integrate the Optimization Next.js SDK in a Next.js App Router app](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrate the Optimization Next.js SDK in a Next.js Pages Router app](../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md)
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md)
