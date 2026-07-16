---
title: Optimization handoff and cache-safe rendering
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
- [Initial page event ownership](#initial-page-event-ownership)
- [Analytics-only handoff and tracking attributes](#analytics-only-handoff-and-tracking-attributes)
- [Why profile state stays out of public caches](#why-profile-state-stays-out-of-public-caches)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Runtime support

| Runtime surface                                                           | Handoff role                                                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-nextjs/app-router`                              | Binds request handoff helpers, customer-owned selection handoff helpers, roots, analytics roots, and server tracking attributes for App Router routes. |
| `@contentful/optimization-nextjs/pages-router` and `/pages-router/server` | Binds Pages Router roots, `getServerSideProps` request handoff helpers, and customer-owned selection handoff helpers.                                  |
| `@contentful/optimization-nextjs/edge`                                    | Configures Edge runtime request handoff and customer-owned selection handoff helpers.                                                                  |
| `@contentful/optimization-react-web`                                      | Consumes content handoffs in `OptimizationRoot` and analytics-only handoffs in `OptimizationAnalyticsRoot`.                                            |
| `@contentful/optimization-web`                                            | Hydrates content handoffs into a live browser SDK and analytics-only handoffs into a narrow analytics runtime.                                         |

## Inputs and constraints

An `OptimizationHandoff` is the framework-neutral shape for state produced before browser hydration.
It can contain:

- `state.selectedOptimizations` - the selected experience and variant records used for entry
  resolution.
- `state.changes` - Custom Flag changes derived from the selected optimizations.
- `state.profile` - profile state from a request-backed Experience API response.
- `entries` - managed-entry baseline snapshots that let browser-managed entries hydrate from the
  same baseline entry the server or static render used.
- `cache` - metadata that describes where the rendered output is allowed to be cached.

Browser handoffs add two fields:

- `hydration` - the browser presentation policy for already-rendered content.
- `initialPageEvent` - whether the browser emits or skips the first page event for this route.

The SDK serializes and hydrates the state it receives. It does not infer application segments,
campaigns, markets, or other public permutations from the URL. When a handoff is cacheable across
visitors, application code supplies the selected optimizations and cache key.

## Mental model

Handoff is a render boundary. A server, build, ISR, or edge path resolves content using a known
Optimization state, then passes that same state to the browser so the first browser render matches
the markup.

```text
request, build, ISR, or edge code chooses Optimization state
  -> route resolves entries or renders analytics-only markup
  -> route creates a browser handoff with cache metadata
  -> browser root hydrates from the handoff
  -> browser SDK takes over according to hydration and liveUpdates policy
```

The handoff is not a cache key by itself. Cache safety comes from matching the rendered output, the
handoff state, and the cache scope.

## Cache scopes

| Scope                | Use it for                                                                                                            | Cache rule                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `private-request`    | A real request backed by cookies, request headers, profile continuity, or an Experience API response for one visitor. | Keep the rendered output out of shared public caches.                             |
| `public-permutation` | A customer-owned segment, market, campaign, or path where application code already chose the selected optimizations.  | Provide an application-owned `cache.key` that covers the full public permutation. |
| `static`             | Build-time or baseline output that does not depend on request profile state.                                          | Do not include profile state.                                                     |

The generic cache-safety helper reports warnings rather than blocking rendering. Request handoff
creation is stricter: request-derived profile state must use `private-request` cache scope. Creating
a request handoff with profile state and `public-permutation` or `static` cache metadata throws a
`TypeError`. The helper also warns when a `public-permutation` handoff lacks an application-owned
key.

## Customer-owned permutations

A customer-owned public permutation is a cacheable output your application can name from a finite
app-owned or customer-owned registry without reading a visitor profile. The registry can come from a
segment service, CMS or config mapping, static artifact, or reviewed app config.

The Experience API evaluates one request context. It is not a registry source for public
permutations and does not enumerate the public segments, markets, campaigns, routes, or locales your
application can cache.

A registry record is valid for a static, ISR, or edge public output only when it has enough
dimensions to fetch, resolve, hand off, and cache one output: public key or slug, locale, baseline
entry IDs, `selectedOptimizations`, optional `changes`, and an app-owned revision or cache version.
The SDK serializes and hydrates the state you supply. It does not discover or enumerate valid public
permutations for the application.

The validity boundary is cache ownership. Public and static handoffs must use app-owned selections,
not request profile, cookies, headers, or request-specific Experience API output. Public cache keys
must cover the public permutation dimensions plus locale, baseline entry IDs, selected
optimizations, and the app revision, environment, or cache version when those values can change the
rendered output.

For selected-optimization shape, content model, variant-index, and fallback details, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md). For
the procedural Next.js recipe, see
[Rendering personalized Next.js routes with static, ISR, and edge handoffs](../guides/rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md).

## Hydration and live updates

`hydration` controls the first browser presentation over already-rendered markup.

| Hydration mode                   | Effect                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preserve-server`                | Keep server, static, ISR, or edge-rendered content visible while the browser hydrates.                                                              |
| `client-only-hidden-until-ready` | Let the browser own content resolution; the default loading presentation can hide the baseline layout target until resolution settles or times out. |
| `analytics-only`                 | Hydrate analytics state without providing content resolution context.                                                                               |

`liveUpdates` controls later browser re-resolution after startup. A route can preserve the rendered
content for stable first paint and still keep live updates off. Turn live updates on when visible
content must react to consent, identity, profile, or preview changes after hydration. Preview state
can force live re-resolution for authoring flows.

## Initial page event ownership

The first page event must have one owner.

- Use `initialPageEvent: 'skip'` when a request or edge helper already accepted the first page
  event for the same route.
- Use `initialPageEvent: 'emit'` when the browser owns the first page event for a static,
  public-permutation, or browser-owned route.

Next.js request helpers set this value from the accepted page event result. Selection handoff helpers
require application code to supply it because customer-owned static and public permutations do not
emit a server request event by themselves.

React Web roots can emit or skip the handoff-owned initial page event when they receive both
`routeKey` and `buildPagePayload`. Next.js route trackers use the same `"emit"` or `"skip"` control
for the first browser route and then track later navigations.

## Analytics-only handoff and tracking attributes

Some server, static, ISR, or edge routes render the final HTML themselves and use the browser SDK
only for page and interaction tracking. Those routes use an analytics-only handoff:

- `OptimizationAnalyticsRoot` hydrates an analytics runtime, not a content resolution provider.
- `getServerTrackingAttributes(baselineEntry, resolvedData)` attaches the SDK-owned `data-ctfl-*`
  attributes that browser entry-interaction tracking consumes.
- The `data-ctfl-*` attributes describe the resolved entry, baseline entry, optimization context,
  variant index, sticky selection, and clickable state.

Analytics-only rendering still needs the same cache decision as the markup it tracks. A static
analytics handoff is static; a public permutation needs an application-owned key; request-personalized
markup remains private to the request.

## Why profile state stays out of public caches

Profile state is visitor-specific. Request-backed selected optimizations, Custom Flag changes, merge
tag values, and rendered personalized HTML can all depend on that profile. If that state enters a
shared public cache, another visitor can receive the wrong variant, wrong Custom Flag state, wrong
merge-tag output, or a page-event handoff that was created for a different profile.

Use request-backed handoffs for private request rendering. Use customer-owned selection handoffs for
cacheable public permutations. Cache raw Contentful baseline entries according to your application
policy, but keep resolved personalized output scoped to the state that produced it.

## Related documentation

- [Rendering personalized Next.js routes with static, ISR, and edge handoffs](../guides/rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md)
- [Integrating the Optimization Next.js SDK in a Next.js App Router app](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js Pages Router app](../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md)
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md)
