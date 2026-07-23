---
title: Rendering personalized Next.js routes with static, ISR, and edge handoffs
---

# Rendering personalized Next.js routes with static, ISR, and edge handoffs

Use this guide to render a Next.js route from application-chosen Optimization selections, cache the
result at the right scope, and hydrate the browser from the same state.

This guide supplements the App Router and Pages Router integration guides. It assumes the SDK is
already configured and focuses on rendering strategy. Code snippets use App Router file names unless
a section says otherwise. Pages Router apps can use the same ownership and cache rules for their own
static or ISR pages, but the maintained Pages Router reference implementation validates the
`getServerSideProps` request-handoff path.

Vocabulary used below:

- A **browser handoff** is the serializable Optimization state passed from server, static, ISR, or
  application-owned edge output to the browser.
- A **public permutation** is a cacheable route output your application can name without reading a
  visitor profile, such as a segment, market, campaign, or locale route.
- **Selected optimizations** are the selected experience and variant records for one permutation.
  In this guide, your application supplies them from a segment service, CMS config, static file, or
  other app-owned source.
- **Hydration** is the first browser render over existing markup. `liveUpdates` is later browser
  re-resolution after startup.
- **Customer-owned** means owned by your application team. It does not mean a site visitor owns the
  selection.
- Cache scope and hydration strings such as `public-permutation`, `static`, `private-request`,
  `preserve-server`, `client-only-hidden-until-ready`, `analytics-only`, `emit`, and `skip` are
  SDK-owned exact values. Route keys, cache keys, payload `properties`, environment variable names,
  and helper names are application-owned.

Here, edge-side rendering (ESR) means a Next.js Edge route owns the response before it reaches the
browser. The public SDK entrypoint for Edge handoff state is
`@contentful/optimization-nextjs/edge`; HTML or JSON rendering stays application-owned.

## Do you need this?

Use this guide when a route uses one of these strategies:

- static generation where the browser SDK chooses variants after hydration;
- static generation or ISR for app-owned segments, markets, campaigns, or other public permutations;
- edge route-handler handoff for a public permutation;
- edge request handoff where the route owns a `Response`;
- analytics-only server, static, ISR, or edge markup that needs Optimization tracking attributes.

Skip this guide for the default App Router or Pages Router request-handoff path. Those flows are
covered in the integration guides and use `private-request` cache scope.
Request-derived profile handoffs are private-request only; public and static handoffs use
app-owned selections.

## Quick start

Start with one ISR route whose permutation is owned by your application. The example expects these
app-owned helpers:

- `@/lib/optimization` is the bound App Router module from the integration guide. It exports
  `OptimizationRoot`, `createHandoffFromSelections()`, `createOptimizationCacheKey()`, and
  `resolveEntriesForSelections()`.
- `getHeroEntry()` fetches the baseline Contentful entry for the route.
- `getPublicSegments()` returns the public segment slugs that Next.js can pre-render.
- `getPublicSegment(slug)` returns
  `{ slug, locale, baselineEntryIds, selectedOptimizations, changes?, cacheVersion }`.
  `baselineEntryIds` names the baseline entries rendered by this route. `changes?` is the optional
  Custom Flag change array from the same approved source as `selectedOptimizations`. `cacheVersion`
  is an app-owned value you change when the segment's selected optimizations, rendered entry set, or
  cache policy changes.

`selectedOptimizations` must use the SDK's selected-optimization shape. Store it in your app from a
segment service, CMS config, static build artifact, or another app-owned source that already knows
which experience and variant this public route represents. Do not build a public permutation by
reading the current visitor profile. `changes` is the optional Custom Flag change array from the
same approved source as `selectedOptimizations`; omit it when the route does not render Custom Flag
values.

**Reference excerpt:**

```ts
import type {
  ChangeArray,
  SelectedOptimizationArray,
} from '@contentful/optimization-nextjs/api-schemas'

type PublicSegment = {
  slug: string
  locale: string
  baselineEntryIds: readonly string[]
  cacheVersion: string
  selectedOptimizations: SelectedOptimizationArray
  changes?: ChangeArray
}
```

The SDK hydrates the selected state your app supplies; it does not discover the segment or choose the
selected optimizations.

**Adapt this to your use case:**

```tsx
// app/segments/[segment]/page.tsx
import { Hero } from '@/components/Hero'
import {
  OptimizationRoot,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  resolveEntriesForSelections,
} from '@/lib/optimization'
import { getHeroEntry, getPublicSegment, getPublicSegments } from '@/lib/segments'

export const revalidate = 300

export async function generateStaticParams() {
  const segments = await getPublicSegments()

  return segments.map((segment) => ({ segment: segment.slug }))
}

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment: segmentSlug } = await params
  const segment = await getPublicSegment(segmentSlug)
  const hero = await getHeroEntry({ locale: segment.locale, include: 10 })
  const [resolvedHero] = resolveEntriesForSelections({
    entries: [hero],
    selectedOptimizations: segment.selectedOptimizations,
  })
  const routeKey = `/segments/${segment.slug}`
  const cacheKey = [
    `segment:${segment.slug}`,
    `v${segment.cacheVersion}`,
    createOptimizationCacheKey({
      scope: 'public-permutation',
      locale: segment.locale,
      entryIds: segment.baselineEntryIds,
      selectedOptimizations: segment.selectedOptimizations,
    }),
  ].join(':')
  const cacheMetadata = {
    scope: 'public-permutation' as const,
    key: cacheKey,
    tags: [cacheKey],
  }
  const handoff = createHandoffFromSelections({
    selectedOptimizations: segment.selectedOptimizations,
    changes: segment.changes,
    cache: cacheMetadata,
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
  })

  return (
    <OptimizationRoot
      buildPagePayload={() => ({ properties: { locale: segment.locale, segment: segment.slug } })}
      handoff={handoff}
      routeKey={routeKey}
    >
      <Hero entry={resolvedHero.entry} />
    </OptimizationRoot>
  )
}
```

Verify one segment before adding more:

1. Pick a segment whose selected optimization resolves to distinctive variant text, such as
   `Summer sale hero`.
2. Request `/segments/<slug>` with your normal Next.js dev or preview command running.
3. Open View Source and find the distinctive variant text in the raw HTML.
4. Load the page normally and verify the same text remains after hydration.
5. During first validation, log `cacheMetadata.key` next to the handoff creation, change
   `segment.cacheVersion`, request the route again, and verify the logged key changes. Remove the
   temporary log after the route is validated.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Default recipe](#default-recipe)
  - [Build app-owned public permutations](#build-app-owned-public-permutations)
- [Runtime or vendor variants](#runtime-or-vendor-variants)
  - [SSG baseline with browser-owned personalization](#ssg-baseline-with-browser-owned-personalization)
  - [SSG customer-owned static permutation](#ssg-customer-owned-static-permutation)
  - [ISR customer-owned public permutation](#isr-customer-owned-public-permutation)
  - [Edge public permutation](#edge-public-permutation)
  - [Edge request-personalized handoff](#edge-request-personalized-handoff)
  - [Analytics-only server, static, or edge markup](#analytics-only-server-static-or-edge-markup)
- [Validate the integration](#validate-the-integration)
- [Governance notes](#governance-notes)
- [Related guides and concepts](#related-guides-and-concepts)

<!-- mtoc-end -->
</details>

## Default recipe

Use the same ownership test for every route: the cache owner must match the Optimization state that
produced the markup. A **baseline entry** is the Contentful entry before Optimization resolution.
Resolving entries means applying selected optimizations to those baseline entries before rendering.
`initialPageEvent` tells the browser whether to emit or skip the first page event for the route.

| Route strategy                    | Optimization state owner       | Rendering owner                    | Cache scope                                        |
| --------------------------------- | ------------------------------ | ---------------------------------- | -------------------------------------------------- |
| Browser-owned personalization     | Browser SDK after hydration    | Static page shell                  | Static shell without a handoff                     |
| SSG static permutation            | Application build code         | Static generation                  | `static`                                           |
| ISR public permutation            | App-owned segment or path code | ISR route                          | `public-permutation` with an app-owned key         |
| Edge public permutation           | Application edge code          | Edge runtime                       | `public-permutation` with an application-owned key |
| Edge request-personalized handoff | Request-bound edge helper      | Edge runtime                       | `private-request`                                  |
| Analytics-only markup             | The markup owner               | Server, static, ISR, or edge route | Same scope as the markup                           |

### Build app-owned public permutations

An app-owned public permutation starts in a finite registry your application owns. The registry can
live in app code, a CMS mapping entry, a segment service, a generated static artifact, or reviewed
config.

Use one app-owned source of truth for each registry. Segment services, CMS config, and static
artifacts can store the selected-optimization records that your application has approved for each
public segment, market, campaign, route, or locale.

Do not use the Experience API to discover public permutations. The Experience API evaluates one
request context; it does not enumerate the public segments, markets, campaigns, routes, or locales
your application can cache. Do not call it from an SSG, ISR, or public edge render to choose
selections for the current visitor.

Each registry record needs enough information to fetch, resolve, hand off, and cache one public
output:

| Field                   | Purpose                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key` or `slug`         | App-owned public name for the permutation, such as a segment, market, campaign, or path slug. Use the name your route already uses.                        |
| `locale`                | One concrete Contentful Delivery API locale used to fetch baseline entries.                                                                                |
| `baselineEntryIds`      | The baseline Contentful entry IDs the route renders and includes in its cache key.                                                                         |
| `selectedOptimizations` | SDK selected-optimization records for this public output. This must be an array; pass `[]` only for an intentional baseline/static handoff.                |
| `changes`               | Optional Custom Flag changes captured from the same approved source as `selectedOptimizations`. Omit it when the route does not render Custom Flag values. |
| `cacheVersion`          | App-owned revision you change when the registry mapping, selected optimizations, rendered entry set, locale, content environment, or cache policy changes. |

**Reference excerpt:**

```ts
import type {
  ChangeArray,
  SelectedOptimization,
  SelectedOptimizationArray,
} from '@contentful/optimization-nextjs/api-schemas'

type PublicOptimizationPermutation = {
  key: string
  locale: string
  baselineEntryIds: readonly string[]
  selectedOptimizations: SelectedOptimizationArray
  changes?: ChangeArray
  cacheVersion: string
}

const summerHeroSelection = {
  experienceId: 'exp-homepage-hero',
  variantIndex: 2,
  variants: {
    'hero-baseline': 'hero-variant-summer',
  },
  sticky: true,
} satisfies SelectedOptimization
```

Prefer selected-optimization records generated from reviewed segment, CMS, or static config based on
the same Optimization content model. Hand-author this shape only when your app config can name the
matching experience and variant entry IDs exactly. A selected-optimization record has four fields:

| Field          | Rule                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experienceId` | Must match the attached optimization entry's `fields.nt_experience_id`.                                                                                                 |
| `variantIndex` | `0` means baseline. `1` selects the first configured variant in `nt_config`, `2` selects the second configured variant, and higher values continue that pattern.        |
| `variants`     | Maps baseline entry IDs to selected variant entry IDs. Copy it from the selection source, or build it from the same baseline and variant entry IDs used by `nt_config`. |
| `sticky`       | Optional selection metadata. Include it when your source of truth captured it.                                                                                          |

Validate each permutation before you add it to SSG, ISR, or edge rendering:

- Confirm `selectedOptimizations` is an array. `createHandoffFromSelections()` rejects non-array
  values.
- Fetch each baseline entry with one concrete locale and enough `include` depth to resolve the
  SDK-owned `nt_experiences` and `nt_variants` links, and include the `nt_config` field on each
  attached optimization entry. `nt_experiences` is the baseline entry field that links attached
  optimization entries. `nt_config` is the optimization entry field that describes entry-replacement
  components. `nt_variants` is the optimization entry field that links replacement entries.
- Confirm every `experienceId` you expect to affect a baseline entry matches the attached
  optimization entry's `fields.nt_experience_id`. The attached optimization entry uses the
  SDK-owned `nt_experience` content type.
- Confirm the selected `variantIndex` exists in the configured variants for that baseline entry.
- Confirm the selected variant entry is resolved in the Contentful payload and uses the same content
  type as the baseline entry.
- Run resolution for one known non-baseline permutation and inspect `resolved.entry.sys.id`. It must
  equal the expected variant entry ID. For an intentional `variantIndex: 0` permutation, it must
  equal the baseline entry ID.
- Treat unexpected baseline output as a failed validation for non-baseline permutations. The
  supported fallback contract is baseline output when no matching selection exists, Optimization
  links are unresolved, or the payload uses all-locale fields.

Resolve and assemble each usable permutation in the route that renders it:

1. Load the registry record by public key, slug, path, market, campaign, or locale.
2. Fetch the baseline entries named by `baselineEntryIds` with the record's `locale` and include
   depth.
3. Call `resolveEntriesForSelections()` with those baseline entries and the record's
   `selectedOptimizations`.
4. Build a cache key from the public permutation dimensions. `createOptimizationCacheKey()` covers
   scope, locale, baseline entry IDs, and a normalized selected-optimization fingerprint. Prefix the
   app-owned dimensions it does not know: public key or slug, `cacheVersion`, and Contentful
   environment when the same shared cache can serve multiple environments.
5. Call `createHandoffFromSelections()` with the same `selectedOptimizations`, optional `changes`,
   and cache metadata.
6. Use `cache: { scope: 'static' }` for one build-time static output. Use public-permutation cache
   metadata with a key and tags for ISR, edge, or CDN-cached public outputs.
7. Use `initialPageEvent: 'emit'` unless a request or edge helper already accepted the first page
   event for the same route.

**Follow this pattern:**

```tsx
const baselineEntries = await getBaselineEntries({
  entryIds: permutation.baselineEntryIds,
  locale: permutation.locale,
  include: 10,
})
const resolvedEntries = resolveEntriesForSelections({
  entries: baselineEntries,
  selectedOptimizations: permutation.selectedOptimizations,
})
const cacheKey = [
  `permutation:${permutation.key}`,
  `v${permutation.cacheVersion}`,
  createOptimizationCacheKey({
    scope: 'public-permutation',
    locale: permutation.locale,
    entryIds: permutation.baselineEntryIds,
    selectedOptimizations: permutation.selectedOptimizations,
  }),
].join(':')
const cacheMetadata = {
  scope: 'public-permutation' as const,
  key: cacheKey,
  tags: [cacheKey],
}
const handoff = createHandoffFromSelections({
  selectedOptimizations: permutation.selectedOptimizations,
  changes: permutation.changes,
  cache: cacheMetadata,
  hydration: 'preserve-server',
  initialPageEvent: 'emit',
})
```

`getBaselineEntries()` is your Contentful fetch helper. `permutation` is the app-owned registry
record. Keep profile, cookies, headers, and request-specific Experience API output out of public and
static handoffs. The SDK serializes and hydrates the state you supply; it does not discover or
enumerate valid public permutations for the application.

Use `preserve-server` hydration when the route already rendered the selected content. Use
`client-only-hidden-until-ready` when the browser owns content resolution and the route must avoid a
visible baseline flash.

## Runtime or vendor variants

### SSG baseline with browser-owned personalization

Use this when the route can serve a static baseline shell and the browser can resolve content after
hydration. The server or build does not create a handoff because no selected Optimization state
exists before hydration.

**Adapt this to your use case:**

```tsx
// app/landing/BrowserOwnedHero.tsx
'use client'

import { Hero } from '@/components/Hero'
import { OptimizationRoot, OptimizedEntry } from '@contentful/optimization-nextjs/client'

export function BrowserOwnedHero({ hero }) {
  return (
    <OptimizationRoot
      clientId={process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!}
      defaults={{ consent: false, persistenceConsent: false }}
      environment={process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main'}
      hydration="client-only-hidden-until-ready"
      locale="en-US"
      routeKey="/landing"
      buildPagePayload={() => ({ properties: { path: '/landing' } })}
    >
      <OptimizedEntry baselineEntry={hero}>
        {(resolvedHero) => <Hero entry={resolvedHero} />}
      </OptimizedEntry>
    </OptimizationRoot>
  )
}
```

`NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID` and `NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT` are reader-owned
browser-visible environment variable names. `consent` controls whether SDK events can personalize or
emit; `persistenceConsent` controls whether the browser can store SDK profile continuity. For this
browser-owned route, verify in the rendered page or browser devtools after hydration, not in View
Source.

### SSG customer-owned static permutation

Use this when build code already knows the selected optimizations for one static output. The handoff
uses `static` because there is no request profile and no ISR or CDN permutation key.

**Adapt this to your use case:**

```tsx
// app/static-segment/page.tsx
import { Hero } from '@/components/Hero'
import {
  OptimizationRoot,
  createHandoffFromSelections,
  resolveEntriesForSelections,
} from '@/lib/optimization'
import { getBuildSelection, getHeroEntry } from '@/lib/static-segment'

export default async function StaticSegmentPage() {
  const selection = await getBuildSelection()
  const hero = await getHeroEntry({ locale: 'en-US', include: 10 })
  const [resolvedHero] = resolveEntriesForSelections({
    entries: [hero],
    selectedOptimizations: selection.selectedOptimizations,
  })
  const handoff = createHandoffFromSelections({
    selectedOptimizations: selection.selectedOptimizations,
    changes: selection.changes,
    cache: { scope: 'static' },
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
  })

  return (
    <OptimizationRoot
      buildPagePayload={() => ({ properties: { path: '/static-segment' } })}
      handoff={handoff}
      routeKey="/static-segment"
    >
      <Hero entry={resolvedHero.entry} />
    </OptimizationRoot>
  )
}
```

Use a separate static route or path for each public output. Do not add request profile state to a
`static` handoff.

### ISR customer-owned public permutation

Use this when a public permutation can be regenerated and cached independently. The quick start uses
this strategy.

**Follow this pattern:**

```tsx
export const revalidate = 300

const cacheKey = [
  `segment:${segment.slug}`,
  `v${segment.cacheVersion}`,
  createOptimizationCacheKey({
    scope: 'public-permutation',
    locale: segment.locale,
    entryIds: segment.baselineEntryIds,
    selectedOptimizations: segment.selectedOptimizations,
  }),
].join(':')
const cacheMetadata = {
  scope: 'public-permutation' as const,
  key: cacheKey,
  tags: [cacheKey],
}
const handoff = createHandoffFromSelections({
  selectedOptimizations: segment.selectedOptimizations,
  changes: segment.changes,
  cache: cacheMetadata,
  hydration: 'preserve-server',
  initialPageEvent: 'emit',
})
```

The cache key is reader-owned. The helper covers locale, entry IDs, and selected optimizations;
prefix the public segment or market name and app-owned version or revision value.

### Edge public permutation

Use this when an Edge route handler chooses a public permutation without reading a request profile.
The route can return an application-owned `Response` and still use a public cache key because the
selected optimizations are supplied by application code. This is the `/edge` helper boundary; an App
Router page that imports the bound React `OptimizationRoot` and returns React markup from
`runtime = 'edge'` is outside this guide. `NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID` and
`CONTENTFUL_ENVIRONMENT` are reader-owned environment variable names in this excerpt. A
request-derived selection is any selection produced from a visitor profile, cookie, header, or
request-specific Experience API response; keep those out of this public path.
`configureNextjsEdgeOptimization(...)` configures stateless Edge helpers for the route module; it is
not a per-request isolation context.

**Adapt this to your use case:**

```ts
// app/edge-segments/[segment]/route.ts
import { getEdgeHeroEntry, getEdgeSegment } from '@/lib/edge-segments'
import { renderEdgeSegmentResponse } from '@/lib/render-edge-segment-response'
import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'

export const runtime = 'edge'

const { createHandoffFromSelections, createOptimizationCacheKey } = configureNextjsEdgeOptimization(
  {
    clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
    environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
    locale: 'en-US',
  },
)

export async function GET(_request: Request, { params }: { params: Promise<{ segment: string }> }) {
  const { segment: segmentSlug } = await params
  const segment = await getEdgeSegment(segmentSlug)
  const hero = await getEdgeHeroEntry({ locale: segment.locale, include: 10 })
  const cacheKey = [
    `edge-segment:${segment.slug}`,
    `v${segment.cacheVersion}`,
    createOptimizationCacheKey({
      scope: 'public-permutation',
      locale: segment.locale,
      entryIds: segment.baselineEntryIds,
      selectedOptimizations: segment.selectedOptimizations,
    }),
  ].join(':')
  const cacheMetadata = {
    scope: 'public-permutation' as const,
    key: cacheKey,
    tags: [cacheKey],
  }
  const handoff = createHandoffFromSelections({
    selectedOptimizations: segment.selectedOptimizations,
    changes: segment.changes,
    cache: cacheMetadata,
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
  })
  const response = await renderEdgeSegmentResponse({ handoff, hero, segment })

  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60')

  return response
}
```

`renderEdgeSegmentResponse()` is your existing edge-safe renderer that returns a `Response` and
serializes the handoff for the browser root that will hydrate the output. Keep the bound App Router
module, profile cookies, and request-derived selected optimizations out of this path. If the route
reads visitor state, use a `private-request` handoff.

### Edge request-personalized handoff

Use this when an edge route owns a `Response` and renders for the current request. This is a
reference excerpt for custom route handlers that already turn application HTML into a `Response`; it
is not an App Router page recipe. The helper reads request cookies and headers, emits the page event,
returns a browser handoff, and gives the route a `persist(response)` callback for the SDK-owned
anonymous ID cookie. `app-consent` is a reader-owned consent cookie name.

**Reference excerpt:**

```ts
// app/personalized-edge/route.ts
import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'

export const runtime = 'edge'

const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'main',
  locale: 'en-US',
  consent: {
    server: ({ cookies }) =>
      cookies.get('app-consent')?.value === 'accepted'
        ? { events: true, persistence: true }
        : false,
  },
})

export async function GET(request: Request) {
  const routeKey = new URL(request.url).pathname
  const { handoff, persist } = await createEdgeRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { path: routeKey } },
    request,
  })
  const response = await renderPersonalizedResponse({ handoff, routeKey })

  response.headers.set('Cache-Control', 'private, no-store')
  persist(response)

  return response
}
```

`renderPersonalizedResponse()` is your existing custom renderer that returns a `Response`. Keep the
response private because the handoff can include request profile state.

### Analytics-only server, static, or edge markup

Use this when the route already renders the final entry output and needs browser page or interaction
tracking without browser content re-resolution. Analytics state is the selected Optimization context
needed for page and entry-interaction events. Content-resolution state is the data a content-capable
`OptimizationRoot` or `OptimizationProvider` uses to choose and render entry variants.
`OptimizationAnalyticsRoot` hydrates the analytics state only; it does not let child components
resolve content in the browser.

**Adapt this to your use case:**

```tsx
import { Hero } from '@/components/Hero'
import {
  OptimizationAnalyticsRoot,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  getServerTrackingAttributes,
  resolveEntriesForSelections,
} from '@/lib/optimization'
import { getAnalyticsSegment, getHeroEntry } from '@/lib/analytics-segments'

export default async function AnalyticsOnlyPage() {
  const segment = await getAnalyticsSegment('campaign-a')
  const hero = await getHeroEntry({ locale: segment.locale, include: 10 })
  const [resolvedHero] = resolveEntriesForSelections({
    entries: [hero],
    selectedOptimizations: segment.selectedOptimizations,
  })
  const cacheKey = [
    `campaign:${segment.slug}`,
    `v${segment.cacheVersion}`,
    createOptimizationCacheKey({
      scope: 'public-permutation',
      locale: segment.locale,
      entryIds: segment.baselineEntryIds,
      selectedOptimizations: segment.selectedOptimizations,
    }),
  ].join(':')
  const cacheMetadata = {
    scope: 'public-permutation' as const,
    key: cacheKey,
    tags: [cacheKey],
  }
  const handoff = createHandoffFromSelections({
    selectedOptimizations: segment.selectedOptimizations,
    changes: segment.changes,
    cache: cacheMetadata,
    hydration: 'analytics-only',
    initialPageEvent: 'emit',
  })
  const trackingAttributes = getServerTrackingAttributes(hero, resolvedHero)

  return (
    <OptimizationAnalyticsRoot
      buildPagePayload={() => ({ properties: { campaign: 'campaign-a' } })}
      handoff={handoff}
      routeKey="/campaign-a"
    >
      <article {...trackingAttributes}>
        <Hero entry={resolvedHero.entry} />
      </article>
    </OptimizationAnalyticsRoot>
  )
}
```

`data-ctfl-*` tracking attributes are SDK-owned. A resolved entry ID is the ID of the baseline or
variant entry that the route rendered. Attach the attributes to the element that represents that
entry so browser interaction tracking can read the entry ID and Optimization context.

If you build the analytics-only browser owner without React, import
`initializeOptimizationAnalyticsRuntime(...)` and `hydrateOptimizationAnalyticsHandoff(...)` from
`@contentful/optimization-web/analytics`. Initialize one analytics-only runtime for the page and
hydrate each analytics-only handoff into it; the runtime does not expose content-resolution APIs and
is not an isolation context.

## Validate the integration

- At the handoff creation point, log `handoff.cache` during first validation and verify public
  routes use `public-permutation` or `static`, while request-personalized routes use
  `private-request`.
- For customer-owned permutations, inspect the logged handoff and verify `handoff.state?.profile` is
  absent.
- For every `public-permutation` handoff, inspect the logged `handoff.cache.key` and verify it
  changes when the segment, locale, selected optimization set, entry set, or app-owned cache version
  changes.
- For server, static, ISR, and application-owned edge responses that render HTML, open View Source
  and find distinctive variant text from the selected permutation.
- With `hydration: 'preserve-server'`, load the page normally and verify the same distinctive text
  remains after hydration.
- For browser-owned routes, skip View Source for the variant proof; verify the variant in the
  rendered page or browser devtools after hydration.
- Verify one first page event is emitted by checking your Contentful event diagnostics or the
  browser `states.eventStream` subscription from the integration guide.
- For analytics-only markup, inspect the rendered DOM and verify the resolved entry element has
  `data-ctfl-entry-id` and the related `data-ctfl-*` attributes.

## Governance notes

Treat selected optimizations as targeting decisions. For public permutations, store and review the
application rule that maps a route, segment, market, campaign, or locale to those selected
optimizations. The SDK records and hydrates the selection; it does not decide whether that public
permutation is allowed to be cached.

Do not put request profile state, request-derived selected optimizations, merge-tag output, or
request-personalized HTML into a public shared cache. Cache raw Contentful baseline entries according
to your application policy, then scope resolved output to the Optimization state that produced it.

## Related guides and concepts

- [Optimization handoff and cache-safe rendering](../concepts/optimization-handoff-and-cache-safe-rendering.md)
- [Integrating the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Choosing the right SDK](./choosing-the-right-sdk.md)
- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
