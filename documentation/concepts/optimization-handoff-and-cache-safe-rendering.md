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
- [Server preparation and browser commitment](#server-preparation-and-browser-commitment)
- [Analytics-only handoff and tracking attributes](#analytics-only-handoff-and-tracking-attributes)
- [Why profile state stays out of public caches](#why-profile-state-stays-out-of-public-caches)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Runtime support

| Runtime surface                                                           | Handoff role                                                                                                                                                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router/server`                       | Binds explicit-input App Router server components and helpers plus the nested request component family.                                                         |
| `@contentful/optimization-nextjs/app-router/client`                       | Binds App Router browser roots, entries, trackers, and explicit handoff helpers.                                                                                |
| `@contentful/optimization-nextjs/pages-router` and `/pages-router/server` | Binds Pages Router roots, `getServerSideProps` request handoff helpers, and public permutation handoff helpers.                                                 |
| `@contentful/optimization-nextjs/edge`                                    | Configures Edge runtime request handoff and public permutation handoff helpers.                                                                                 |
| `@contentful/optimization-nextjs/request-handler`                         | Forwards sanitized request context through pass-through responses and can perform response-capable server page work before App Router Server Components render. |
| `@contentful/optimization-nextjs/cache-middleware`                        | Rewrites pass-through Next.js proxy or middleware requests to the public permutation cache key produced by the same metadata helper used by handoffs.           |
| `@contentful/optimization-nextjs/tracking-attributes`                     | Produces server, static, and edge `data-ctfl-*` tracking attributes for manual rendering paths.                                                                 |
| `@contentful/optimization-react-web`                                      | Consumes content handoffs in `OptimizationRoot` and analytics-only handoffs in `OptimizationAnalyticsRoot`.                                                     |
| `@contentful/optimization-web`                                            | Hydrates content handoffs into a live browser SDK and analytics-only handoffs into a narrow analytics runtime.                                                  |

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

Browser handoffs add one field:

- `hydration` - the browser presentation policy for already-rendered content.

A request handoff can also contain `replay`, an ordered batch of prepared Experience events and the
visible route key they belong to. A matching browser route hydrates the handoff and admits that
batch to the normal Experience queue. A route without a matching replay follows ordinary browser
page tracking.

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
terminal responses are returned unchanged. The request-context handler is different: it preserves
an existing rewrite response while still applying SDK request context and eligible profile-cookie
persistence. Pass-through responses keep flowing through the Optimization rewrite or
request-context path.

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
metadata. A different baseline entry ID starts a new presentation. This presentation commitment is
separate from event commitment: rendering handoff state does not mean the browser has admitted or
delivered the prepared event batch.

`liveUpdates` controls later browser re-resolution after startup. A route can preserve the rendered
content for stable first paint and still keep live updates off. Turn live updates on when visible
content must react to consent, identity, profile, or preview changes after hydration. Preview state
can force live re-resolution for authoring flows.

When Web or React Web hydrates a profileless `static` or `public-permutation` content or analytics
handoff, the handoff state can affect live browser memory for that page, but the SDK preserves
existing durable browser profile continuity by suppressing durable continuity persistence for that
handoff. A `private-request` handoff, or any profile-backed handoff that passes cache safety,
follows normal persistence behavior when persistence consent allows.

## Server preparation and browser commitment

For a private request, the server builds the initial `identify` and `track` events in order, followed
by one page event. It applies server event transformations and validates the batch before previewing
it with the Experience API. The preview uses the per-request mutation option `preflight: true`, so
the API returns evaluated profile data for rendering without storing those event mutations. The
handoff carries the prepared events and visible route key to the browser.

On the matching browser route, the Web SDK hydrates presentation state and admits the prepared batch
to its normal Experience queue. Admission is the browser's commitment point; the request-side
preview is not event commitment. The queue applies current consent and handles delivery, retries,
and response state through the same path as other Experience events. A repeated invocation for the
current handoff joins current work instead of admitting the batch again. This guard covers the
current initialization, not every future visit to the route. Later visits and distinct handoffs
remain trackable.

If the handoff has no replay for the current route, the browser builds and tracks an ordinary page
event subject to current consent. If consent or queue capacity prevents replay admission, the batch
is not replaced by a page event that omits its prepared prefix. A still-unadmitted batch can be
reassessed through a later invocation when prerequisites change. Admission means the queue owns the
batch; it does not guarantee exactly-once backend commitment when a response is lost.

Static and public-permutation handoffs contain selected state and cache metadata, not request replay.
Their browser route tracking follows the ordinary page path. App Router request components create
the request handoff from one request-scoped preparation and pass it to the root or provider that
renders the matching page. The framework must deliver the page's handoff across navigation;
request memoization alone does not transfer a new handoff through a persistent layout.

## Analytics-only handoff and tracking attributes

Some server, static, ISR-style, or Edge runtime routes render the final HTML themselves and use the
browser SDK only for page and interaction tracking. Those routes use an analytics-only handoff:

- `OptimizationAnalyticsRoot` hydrates an analytics runtime, not a content resolution provider.
- `getServerTrackingAttributes(baselineEntry, resolvedData)` attaches the SDK-owned `data-ctfl-*`
  attributes that browser entry-interaction tracking consumes.
- The `data-ctfl-*` attributes describe the resolved entry, baseline entry, optimization context,
  variant index, sticky selection, and clickable state.

Analytics-only handoffs can also carry a prepared replay. The analytics runtime hydrates tracking
state and admits a matching replay, or tracks the ordinary current page when no matching replay is
present. If a newer analytics hydration starts or the root unmounts before async hydration finishes,
the stale hydration stops before writing state, warning, or tracking the page.

Analytics-only rendering still needs the same cache decision as the markup it tracks. A static
analytics handoff is static; a public permutation needs an application-owned key; request-personalized
markup remains private to the request.

## Why profile state stays out of public caches

Profile state is visitor-specific. Request-backed selected optimizations, Custom Flag changes, merge
tag values, and rendered personalized HTML can all depend on that profile. If that state enters a
shared public cache, another visitor can receive the wrong variant, wrong Custom Flag state, wrong
merge-tag output, or a page-event handoff that was created for a different profile.

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
