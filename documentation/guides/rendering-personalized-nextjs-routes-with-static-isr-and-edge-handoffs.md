---
title: Render personalized Next.js routes with static, ISR, and edge handoffs
fern:
  slug: render-personalized-nextjs-routes
  section: Guides
  description: >-
    Use this guide to render a Next.js route from application-chosen Optimization selections, cache
    the result at the right scope, and hydrate the browser from the same state.
---

# Render personalized Next.js routes with static, ISR, and edge handoffs

Use this guide to render a Next.js route from application-chosen Optimization selections, cache the
result at the right scope, and hydrate the browser from the same state.

This guide supplements the App Router and Pages Router integration guides. It assumes the SDK is
already configured and focuses on rendering strategy. Code snippets use App Router file names unless
a section says otherwise. App Router Cache Components use `use cache`, `cacheLife()`, and
`cacheTag()` for ISR-style revalidation. Pages Router apps use `getStaticProps`,
`getStaticPaths`, and `revalidate` for ISR, and the maintained Pages Router reference implementation
validates both the `getServerSideProps` request-handoff path and a content-capable ISR public
permutation route.

Vocabulary used below:

- A **browser handoff** is the serializable Optimization state passed from server, static,
  Pages Router ISR, App Router Cache Components, or application-owned Edge runtime output to the
  browser.
- A **public permutation** is a cacheable route output your application can name without reading a
  visitor profile, such as a segment, market, campaign, or locale route.
- **Selected optimizations** are the selected experience and variant records for one permutation.
  In this guide, your application supplies them from a segment service, CMS config, static file, or
  other app-owned source.
- **Hydration** is the first browser render over existing markup. `liveUpdates` is later browser
  re-resolution after startup.
- A handoff's **private replay** carries server-built events for one browser operation. The initial
  Personalization commands retain input order in one batch; Analytics follows with the available
  profile. The combined operation hydrates provisional state and attempts an ordinary page only
  when replay accepted none. A successful **browser commit** is the non-preflight Experience
  response; only that response can establish durable continuity. Public and static handoffs cannot
  contain private replay. The Edge private-request section covers detailed fallback behavior.
- **Customer-owned** means owned by your application team. It does not mean a site visitor owns the
  selection.
- Cache scope and hydration strings such as `public-permutation`, `static`, `private-request`,
  `preserve-server`, `client-only-hidden-until-ready`, and `analytics-only` are SDK-owned exact
  values. Route keys, payload `properties`, environment variable names, and helper
  names are application-owned. `permutationKey`, `cacheVersion`, and Next.js tags are
  application-owned cache inputs; `handoff.cache.key` and `ctfl-opt-cache-key` are SDK-generated
  cache metadata.

> [!NOTE]
>
> For a private request handoff without JavaScript, previewed output can still render, but
> browser delivery and a new `ctfl-opt-aid` cookie do not occur. `ctfl-opt-aid` is the exact
> SDK-owned cookie name.

Here, edge-side rendering (ESR) means a Next.js Edge route owns the response before it reaches the
browser. The public SDK entrypoint for Edge handoff state is
`@contentful/optimization-nextjs/edge`; HTML or JSON rendering stays application-owned.

## Do you need this?

Use this guide when a route uses one of these strategies:

- static generation where the browser SDK chooses variants after hydration;
- static generation, App Router Cache Components, or Pages Router ISR for app-owned segments,
  markets, campaigns, or other public permutations;
- edge route-handler handoff for a public permutation;
- edge request handoff where the route owns a `Response`;
- analytics-only server, static, ISR-style, or Edge runtime markup that needs Optimization tracking
  attributes.

Skip this guide for the App Router nested request-component path or the Pages Router
`getServerSideProps` request-handoff path. Those flows are covered in the integration guides and use
`private-request` cache scope.
Request-derived profile handoffs are private-request only; public and static handoffs use
app-owned selections.

## Quick start

Start with one App Router Cache Components route whose permutation is owned by your application.
The example expects these app-owned helpers:

- `@/lib/optimization` exports the `optimization` server binding from
  `@contentful/optimization-nextjs/app-router/server`. The examples alias its top-level root as
  `ExplicitOptimizationRoot`. These explicit-input exports are separate from the nested private
  request family.
- `getHeroEntry()` fetches the baseline Contentful entry for the route.
- `getPublicSegments()` returns the public segment slugs that Next.js can pre-render.
- `getPublicSegment(slug)` returns
  `{ slug, locale, baselineEntryIds, selectedOptimizations, changes?, cacheVersion }`.
  `baselineEntryIds` names the baseline entries rendered by this route. `changes?` is the optional
  Custom Flag change array from the same approved source as `selectedOptimizations`. `cacheVersion`
  is an app-owned value you change when the segment's selected optimizations, rendered Custom Flag
  changes, rendered entry set, or cache policy changes.

`selectedOptimizations` must use the SDK's selected-optimization shape. Store it in your app from a
segment service, CMS config, static build artifact, or another app-owned source that already knows
which experience and variant this public route represents. Do not build a public permutation by
reading the current visitor profile or expecting the handoff helper to derive selections from route,
cookie, header, locale, or cache-key inputs. `changes` is the optional Custom Flag change array from
the same approved source as `selectedOptimizations`; omit it when the route does not render Custom
Flag values.

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
selected optimizations. Start with one approved segment whose selected variant has distinctive text;
the route below fetches the baseline and calls `resolveEntriesForSelections()` with that segment.

Each resolved item also carries optional `isEmptyVariant`. When it is `true`, `entry` retains the
baseline for tracking context, but direct route markup must omit consumer content. An absent flag
renders normally.

**Adapt this to your use case:**

```tsx
// app/segments/[segment]/page.tsx
import { Hero } from '@/components/Hero'
import { optimization } from '@/lib/optimization'
import { getHeroEntry, getPublicSegment, getPublicSegments } from '@/lib/segments'
import { createPublicPermutationHandoff } from '@contentful/optimization-nextjs/app-router/server'
import { cacheLife, cacheTag } from 'next/cache'

const { OptimizationRoot: ExplicitOptimizationRoot, resolveEntriesForSelections } = optimization

async function getSegmentData(segmentSlug: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`segment:${segmentSlug}`)

  const segment = await getPublicSegment(segmentSlug)
  const hero = await getHeroEntry({ locale: segment.locale, include: 10 })

  return { hero, segment }
}

export async function generateStaticParams() {
  const segments = await getPublicSegments()

  return segments.map((segment) => ({ segment: segment.slug }))
}

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment: segmentSlug } = await params
  const { hero, segment } = await getSegmentData(segmentSlug)
  const [resolvedHero] = resolveEntriesForSelections({
    entries: [hero],
    selectedOptimizations: segment.selectedOptimizations,
  })
  const routeKey = `/segments/${segment.slug}`
  const handoff = createPublicPermutationHandoff({
    permutationKey: segment.slug,
    cacheVersion: segment.cacheVersion,
    locale: segment.locale,
    entryIds: segment.baselineEntryIds,
    selectedOptimizations: segment.selectedOptimizations,
    changes: segment.changes,
    hydration: 'preserve-server',
  })

  return (
    <ExplicitOptimizationRoot
      buildPagePayload={() => ({ properties: { locale: segment.locale, segment: segment.slug } })}
      handoff={handoff}
      routeKey={routeKey}
    >
      {resolvedHero.isEmptyVariant ? null : <Hero entry={resolvedHero.entry} />}
    </ExplicitOptimizationRoot>
  )
}
```

Verify that first segment before adding more:

1. Request `/segments/<slug>` with your normal Next.js dev or preview command running.
2. Open View Source and find the distinctive variant text in the raw HTML.
3. Load the page normally and verify the same text remains after hydration.
4. During first validation, log `handoff.cache.key` next to the handoff creation, change
   `segment.cacheVersion`, request the route again, and verify the logged key changes. Remove the
   temporary log after the route is validated.

This quick-start proof does not validate tag invalidation. `cacheTag()` and `revalidateTag()` are
application-owned Next.js invalidation paths; validate them with your production webhook, Server
Action, or Route Handler outside the first route proof.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Default recipe](#default-recipe)
  - [Build app-owned public permutations](#build-app-owned-public-permutations)
- [Runtime or vendor variants](#runtime-or-vendor-variants)
  - [SSG baseline with browser-owned personalization](#ssg-baseline-with-browser-owned-personalization)
  - [SSG customer-owned static permutation](#ssg-customer-owned-static-permutation)
  - [App Router Cache Components public permutation](#app-router-cache-components-public-permutation)
  - [Public permutation middleware rewrites](#public-permutation-middleware-rewrites)
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
The browser root owns current-route tracking. Public and static handoffs carry selected state, not
private replay instructions.

A campaign can have two independent meanings in these recipes. A public `permutationKey` can name
an app-owned campaign and contributes to public cache identity. A page event's `context.campaign` is
attribution metadata for that event; it does not select a public permutation, populate its
`permutationKey`, or contribute to its cache key.

| Route strategy                                 | Optimization state owner       | Rendering owner                                  | Cache scope                                |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------------ |
| Browser-owned personalization                  | Browser SDK after hydration    | Static page shell                                | Static shell without a handoff             |
| SSG static permutation                         | Application build code         | Static generation                                | `static`                                   |
| App Router Cache Components public permutation | App-owned segment or path code | Cached component or data function                | `public-permutation` with app-owned inputs |
| Pages Router ISR public permutation            | App-owned segment or path code | `getStaticProps` with `revalidate`               | `public-permutation` with app-owned inputs |
| Edge public permutation                        | Application edge route handler | Edge runtime route                               | `public-permutation` with app-owned inputs |
| Edge request-personalized handoff              | Request-bound edge helper      | Edge runtime route                               | `private-request`                          |
| Analytics-only markup                          | The markup owner               | Server, static, ISR-style, or Edge runtime route | Same scope as the markup                   |

### Build app-owned public permutations

An app-owned public permutation starts in a finite registry your application owns. The registry can
live in app code, a CMS mapping entry, a segment service, a generated static artifact, or reviewed
config.

Use one app-owned source of truth for each registry. Segment services, CMS config, and static
artifacts can store the selected-optimization records that your application has approved for each
public segment, market, campaign, route, or locale.

The public/static handoff helpers serialize the selected optimizations, changes, entries, and cache
metadata your application supplies. They do not call the Experience API or derive selections from
route, cookie, header, locale, or cache-key inputs.

All browser handoff state is applied in memory. Profileless `static` or `public-permutation` handoffs apply selections and Custom Flag changes without overwriting durable browser profile continuity. Private replay also uses provisional state; the combined operation owns its delivery and page fallback. Only a successful live Experience response can establish durable continuity.

Each registry record needs enough information to fetch, resolve, hand off, and cache one public
output:

| Field                   | Purpose                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key` or `slug`         | App-owned public name for the permutation, such as a segment, market, campaign, or path slug. Pass it as `permutationKey`.                                                               |
| `locale`                | One concrete Contentful Delivery API locale used to fetch baseline entries.                                                                                                              |
| `baselineEntryIds`      | The baseline Contentful entry IDs the route renders and includes in cache identity.                                                                                                      |
| `selectedOptimizations` | SDK selected-optimization records for this public output. This must be an array; pass `[]` only for an intentional baseline/static handoff.                                              |
| `changes`               | Optional Custom Flag changes captured from the same approved source as `selectedOptimizations`. Omit it when the route does not render Custom Flag values.                               |
| `cacheVersion`          | App-owned revision you change when the registry mapping, selected optimizations, rendered Custom Flag changes, rendered entry set, locale, content environment, or cache policy changes. |

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
  experienceId: '6IueRX1pS3iMJncbhUQTba',
  variantIndex: 2,
  variants: {
    '4ib0hsHWoSOnCVdDkizE8d': '2qVK4T5lnScbswoyBuGipd',
  },
  sticky: true,
} satisfies SelectedOptimization
```

Prefer selected-optimization records generated from reviewed segment, CMS, or static config based on
the same Optimization content model. Hand-author this shape only when your app config uses matching
experience and variant entry IDs copied from Contentful or reviewed selection data. A
selected-optimization record has four fields:

| Field          | Rule                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experienceId` | Must match the attached optimization entry's `fields.nt_experience_id`.                                                                                                 |
| `variantIndex` | `0` means baseline. `1` selects the first configured variant in `nt_config`, `2` selects the second configured variant, and higher values continue that pattern.        |
| `variants`     | Maps baseline entry IDs to selected variant entry IDs. Copy it from the selection source, or build it from the same baseline and variant entry IDs used by `nt_config`. |
| `sticky`       | Optional selection metadata. Include it when your source of truth captured it.                                                                                          |

The helper API can omit `cacheVersion`, but this guide and the reference implementations include it
for cacheable public routes so route code has an explicit invalidation dimension.

Validate each permutation before you add it to SSG, ISR-style Cache Components, Pages Router ISR, or
edge rendering:

- Confirm `selectedOptimizations` is an array. `createPublicPermutationHandoff()` rejects non-array
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
4. Call `createPublicPermutationHandoff()` with the same public key, `cacheVersion`, locale, entry
   IDs, `selectedOptimizations`, optional `changes`, and hydration mode.
5. Use `cache: { scope: 'static' }` with `createHandoffFromSelections()` for one build-time static
   output. Use `createPublicPermutationHandoff()` for Cache Components, Pages Router ISR, Edge
   runtime, or CDN-cached public outputs.

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
const handoff = createPublicPermutationHandoff({
  permutationKey: permutation.key,
  cacheVersion: permutation.cacheVersion,
  locale: permutation.locale,
  entryIds: permutation.baselineEntryIds,
  selectedOptimizations: permutation.selectedOptimizations,
  changes: permutation.changes,
  hydration: 'preserve-server',
})
```

`getBaselineEntries()` is your Contentful fetch helper. `permutation` is the app-owned registry
record. Keep profile, cookies, headers, and request-derived selection data out of public and static
handoffs. The SDK serializes and hydrates the state you supply; it does not discover public
permutations for the application.

`createPublicPermutationHandoff()` creates `cache: { scope: 'public-permutation' }` for you. Your
application owns the `permutationKey`, `cacheVersion`, locale, entry IDs, selected optimizations,
and optional tags it passes in. The SDK owns the generated `handoff.cache.key`, which uses encoded
fields such as `permutation=segment-a:version=v3:...`; the remaining suffix covers scope, locale,
entry IDs, and selected optimizations. Because Custom Flag `changes` are handoff state rather than
part of that generated cache-key fingerprint, rotate `cacheVersion` or another app-owned key
dimension when rendered flag values change. Treat `handoff.cache.key` as deterministic SDK identity
and transport metadata, not as a Next.js `use cache` key and not as a `cacheTag()` or
`revalidateTag()` tag.

Next.js tags are caller-owned invalidation labels. Pass tags only when the route wires tag
invalidation, such as an App Router Cache Components route that calls `cacheTag()`. Supplied tags
must include no more than 128 values; each value must be a non-empty string after trimming, 256
characters or fewer, and must not include commas. Pages Router ISR and Edge runtime public routes
can omit tags unless they wire tag invalidation.

Use `preserve-server` hydration when the route already rendered the selected content. Use
`client-only-hidden-until-ready` when the browser owns content resolution and the route must avoid a
visible baseline flash.

## Runtime or vendor variants

### SSG baseline with browser-owned personalization

Use this when the route can serve a static baseline shell and the browser can resolve content after
hydration. The server or build does not create a handoff because no selected Optimization state
exists before hydration.

Define `useOptimizationConsent()` as an app-owned client hook that reads your consent record and
returns `{ events, persistence }` booleans for Optimization event delivery and profile-cookie
persistence.

This example uses the router-neutral `/client` root and entry because the component supplies browser
configuration and consent directly. `NextAppAutoPageTracker` is the one route coordinator. It
derives the App Router path and search state, emits the first accepted page event, and tracks later
navigation. Keep it inside `Suspense` because it reads `useSearchParams()`.

**Adapt this to your use case:**

```tsx
// app/landing/BrowserOwnedHero.tsx
'use client'

import { Hero } from '@/components/Hero'
import { useOptimizationConsent } from '@/lib/consent-client'
import { NextAppAutoPageTracker } from '@contentful/optimization-nextjs/app-router/client'
import { OptimizationRoot, OptimizedEntry } from '@contentful/optimization-nextjs/client'
import { Suspense } from 'react'

export function BrowserOwnedHero({ hero }) {
  const { events, persistence } = useOptimizationConsent()

  return (
    <OptimizationRoot
      spaceId={process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!}
      defaults={{ consent: events, persistenceConsent: persistence }}
      environment={process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'master'}
      hydration="client-only-hidden-until-ready"
      locale="en-US"
    >
      <Suspense fallback={null}>
        <NextAppAutoPageTracker />
      </Suspense>
      <OptimizedEntry baselineEntry={hero}>
        {(resolvedHero) => <Hero entry={resolvedHero} />}
      </OptimizedEntry>
    </OptimizationRoot>
  )
}
```

`NEXT_PUBLIC_CONTENTFUL_SPACE_ID` and `NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT` are reader-owned
browser-visible environment variable names. `consent` controls whether SDK events can personalize or
emit; `persistenceConsent` controls whether the browser can store SDK profile continuity.

For this browser-owned route, set your app-owned consent record to allow Optimization events during
the proof, then verify in the rendered page or browser devtools after hydration, not in View Source.
The tracker emits the current page after the SDK becomes live. Confirm one accepted page event on
initial load and one on navigation. Do not add another page tracker or direct page call beside it.

### SSG customer-owned static permutation

Use this when build code already knows the selected optimizations for one static output. The handoff
uses `static` because there is no request profile and no ISR or CDN permutation key.

**Adapt this to your use case:**

```tsx
// app/static-segment/page.tsx
import { Hero } from '@/components/Hero'
import { optimization } from '@/lib/optimization'
import { getBuildSelection, getHeroEntry } from '@/lib/static-segment'

const {
  OptimizationRoot: ExplicitOptimizationRoot,
  createHandoffFromSelections,
  resolveEntriesForSelections,
} = optimization

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
  })

  return (
    <ExplicitOptimizationRoot
      buildPagePayload={() => ({ properties: { path: '/static-segment' } })}
      handoff={handoff}
      routeKey="/static-segment"
    >
      {resolvedHero.isEmptyVariant ? null : <Hero entry={resolvedHero.entry} />}
    </ExplicitOptimizationRoot>
  )
}
```

Use a separate static route or path for each public output. Do not add request profile state to a
`static` handoff.

### App Router Cache Components public permutation

Use this when an App Router public permutation can be regenerated and cached independently with
Cache Components. The quick start uses this strategy. Cache Components do not use route-level
`export const revalidate`; put the revalidation policy in the cached component or data function.

**Follow this pattern:**

```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function getSegmentData(segmentSlug: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`segment:${segmentSlug}`)

  return getPublicSegment(segmentSlug)
}

const handoff = createPublicPermutationHandoff({
  permutationKey: segment.slug,
  cacheVersion: segment.cacheVersion,
  locale: segment.locale,
  entryIds: segment.baselineEntryIds,
  selectedOptimizations: segment.selectedOptimizations,
  changes: segment.changes,
  hydration: 'preserve-server',
})
```

The helper creates public-permutation cache metadata from the same route dimensions the handoff
serializes.

Tag invalidation remains application-owned. If the route wires a webhook, Server Action, or Route
Handler that calls `revalidateTag('segment:<slug>')`, trigger that path in production validation and
verify the next request renders from updated cached data. If no invalidation path exists, `cacheTag()`
only labels the cached work and does not prove invalidation.

For Pages Router ISR, use the same public-permutation handoff in `getStaticProps`, return
`revalidate`, and enumerate finite paths with `getStaticPaths`.

### Public permutation middleware rewrites

Use this when a proxy or middleware layer routes a visitor to the correct pre-rendered public
permutation. The middleware must return the same public cache metadata shape used by
`createPublicPermutationHandoff()`. Invalid metadata throws instead of silently falling back to an
unsafe route. The default rewrite writes the raw key to the SDK-owned `ctfl-opt-cache-key` query
parameter, and the URL layer encodes it in the rewritten URL. Use `encodedCacheKey` from the rewrite
context when a custom rewrite embeds the key in a path segment or another already-encoded location.
If middleware metadata includes tags, the same Next.js tag limits apply. Use `proxy.ts` with
`proxy` on Next.js 16, or `middleware.ts` with `middleware` on Next.js 13 to 15; the handler body is
the same.

**Adapt this to your use case:**

```ts
// Next.js 16: proxy.ts and export function proxy.
// Next.js 13 to 15: middleware.ts and export function middleware.
import { getPublicSegmentForRequest } from '@/lib/segments'
import { createNextjsPublicPermutationCacheMiddleware } from '@contentful/optimization-nextjs/cache-middleware'
import { createPublicPermutationCacheMetadata } from '@contentful/optimization-nextjs/edge'
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'
import type { NextFetchEvent, NextRequest } from 'next/server'

const forwardOptimizationContext = createNextjsOptimizationContextHandler()

const publicPermutationCache = createNextjsPublicPermutationCacheMiddleware({
  async resolveCache(request) {
    const segment = await getPublicSegmentForRequest(request)
    if (segment === undefined) return undefined

    return createPublicPermutationCacheMetadata({
      permutationKey: segment.slug,
      cacheVersion: segment.cacheVersion,
      locale: segment.locale,
      entryIds: segment.baselineEntryIds,
      selectedOptimizations: segment.selectedOptimizations,
    })
  },
})

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await forwardOptimizationContext(request, event)

  return publicPermutationCache(request, response)
}
```

`getPublicSegmentForRequest()` is your application lookup. It must return application-supplied
selected optimizations and cache metadata, not selections derived from a visitor profile, cookie, or
header.

### Edge public permutation

Use this when an Edge runtime route handler chooses a public permutation without reading a request
profile. The route must export `runtime = 'edge'` and avoid Node-only APIs.
The route can return an application-owned `Response` and still use public-permutation cache metadata
because the selected optimizations are supplied by application code. This is the `/edge` helper
boundary; an App Router page that imports the top-level bound React `OptimizationRoot` and returns
React markup from `runtime = 'edge'` is outside this guide. `NEXT_PUBLIC_CONTENTFUL_SPACE_ID` and
`CONTENTFUL_ENVIRONMENT` are reader-owned environment variable names in this excerpt. The latter is
server-only; give it the same environment value as the browser binding's
`NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT`. Keep visitor-profile, cookie, header, and other
request-derived selections out of this public path.
`configureNextjsEdgeOptimization(...)` configures stateless Edge helpers for the route module; it is
not a per-request isolation context.

**Adapt this to your use case:**

```ts
// app/edge-segments/[segment]/route.ts
import { getEdgeHeroEntry, getEdgeSegment } from '@/lib/edge-segments'
import { renderEdgeSegmentResponse } from '@/lib/render-edge-segment-response'
import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'

export const runtime = 'edge'

const { createPublicPermutationHandoff } = configureNextjsEdgeOptimization({
  spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
  locale: 'en-US',
})

export async function GET(_request: Request, { params }: { params: Promise<{ segment: string }> }) {
  const { segment: segmentSlug } = await params
  const segment = await getEdgeSegment(segmentSlug)
  const hero = await getEdgeHeroEntry({ locale: segment.locale, include: 10 })
  const handoff = createPublicPermutationHandoff({
    permutationKey: segment.slug,
    cacheVersion: segment.cacheVersion,
    locale: segment.locale,
    entryIds: segment.baselineEntryIds,
    selectedOptimizations: segment.selectedOptimizations,
    changes: segment.changes,
    hydration: 'preserve-server',
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

Use this when an Edge runtime route owns a `Response` and renders for the current request. The route
must export `runtime = 'edge'` and avoid Node-only APIs. This is a reference excerpt for custom
route handlers that already turn application HTML into a `Response`; it is not an App Router page
recipe. The helper reads request cookies and headers and returns a private request handoff for the
paired flow. The sequence is zero or more optional `identify`/`track` commands in application-supplied
order, followed by the SDK-appended `page` command. `app-consent` is a reader-owned consent cookie
name, and `edge_response_rendered` below is an app-owned event name. Configure `consent.server`
explicitly; if it is omitted, Edge request consent resolves to `false`.

`createEdgeRequestHandoff()` accepts either an already-resolved command array or a resolver that
receives the Edge request snapshot with `url`, `headers`, and optional `cookies`. Each command is
a flat input, such as `{ type: 'identify', userId, traits? }` or
`{ type: 'track', event, properties? }`. The App Router request config offers a similar
framework-owned resolver boundary. The Pages Router helper and lower-level Next.js server helper
accept only already-resolved arrays.

The Edge server preview sends the commands and SDK-appended page in an Experience profile `POST`
with `type=preflight`. This is an SDK transport mode, not a browser CORS preflight. An accepted
preview can carry state and replay; a consent-blocked page carries neither.

The Edge request helper converts operational preview failures, including Experience API,
initial-command resolver, interceptor, and event-schema failures, into a profileless private
baseline handoff. The route can render and the browser makes its normal page attempt. Invalid cache
scope and cache-safety failures remain fail-closed.

The app-owned `renderPersonalizedResponse()` must serialize both the private `handoff` and
`routeKey` into browser startup data. The browser parses that data, hydrates the handoff on its live
Web instance, then makes the ordinary `trackCurrentPage({ routeKey, buildPayload })` call for the
matching route. In the excerpt, `routeKey` is the path plus search string used for matching and
deduplication; `request.url` is the full page URL used as event context.

**Reference excerpt:**

```ts
// app/personalized-edge/route.ts
import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'

export const runtime = 'edge'

const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
  spaceId: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
  locale: 'en-US',
  consent: {
    server: ({ cookies }) =>
      cookies.get('app-consent')?.value === 'accepted'
        ? { events: true, persistence: true }
        : false,
  },
})

export async function GET(request: Request) {
  const pageUrl = new URL(request.url)
  const routeKey = `${pageUrl.pathname}${pageUrl.search}`
  const { handoff } = await createEdgeRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    initialExperienceEvents: ({ url }) => [
      { type: 'track', event: 'edge_response_rendered', properties: { url } },
    ],
    pagePayload: { properties: { path: pageUrl.pathname, search: pageUrl.search } },
    request,
  })
  const response = await renderPersonalizedResponse({ handoff, routeKey })

  response.headers.set('Cache-Control', 'private, no-store')

  return response
}
```

`renderPersonalizedResponse()` must expose the serialized handoff and route key to browser startup
code. Keep one-time hydration separate from the reusable route-tracking call so duplicate
suppression can be tested without hydrating again.

**Adapt this to your use case:**

```ts
import ContentfulOptimization from '@contentful/optimization-web'
import { type ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'

export async function startEdgeBrowserRuntime(
  optimization: ContentfulOptimization,
  handoff: ContentOptimizationHandoff,
  routeKey: string,
): Promise<void> {
  await optimization.hydrateAndTrackCurrentPage(handoff, {
    routeKey,
    buildPayload: () => ({ properties: { url: window.location.href } }),
  })
}

export async function trackCurrentRoute(
  optimization: ContentfulOptimization,
  routeKey = `${window.location.pathname}${window.location.search}`,
): Promise<void> {
  await optimization.trackCurrentPage({
    routeKey,
    buildPayload: () => ({ properties: { url: window.location.href } }),
  })
}
```

`renderPersonalizedResponse()` is your existing renderer returning a `Response`. Keep that response private because its handoff can include visitor state and replay. Edge preview does not write a new profile cookie. The browser's combined operation hydrates state in memory and submits the server-built Personalization batch followed by Analytics. It attempts one ordinary page only if replay accepted no page. Newer handoffs preserve earlier admitted journals. Preview-backed rendering proceeds during delivery, and only a successful live response can establish durable continuity when consent permits it.

Recoverable state hydration errors permit safe browser delivery through the combined operation.
Cache-safety errors remain fail-closed: do not apply the supplied state or replay.

In this example, `createEdgeRequestHandoff()` builds `page.url` from the full `request.url`; the
path-and-search `routeKey` is the separate stable identity used for duplicate-event control. Because
`pagePayload` supplies `properties.path` and `properties.search` but not `properties.url`, the
request-backed `page.url` is the campaign source when it has a supported UTM parameter. If you
customize that payload, the SDK chooses one whole source in order:
top-level `campaign`, then a UTM-bearing `properties.url`, then `page.url`. An explicit empty
`campaign: {}` suppresses URL inference and produces empty attribution. The SDK never fills missing
fields from a lower-priority source. The chosen URL maps into `context.campaign`: `utm_campaign`
becomes `name`, `utm_source` becomes `source`, `utm_medium` becomes `medium`, `utm_term` becomes
`term`, and `utm_content` becomes `content`. `page.referrer` remains page metadata, but it is not a
campaign source. This event attribution is the second campaign meaning defined in the default
recipe; it remains independent of public cache identity.

### Analytics-only server, static, or edge markup

Use this when the route already renders the final entry output and needs browser page or interaction
tracking without browser content re-resolution. Analytics state is the selected Optimization context
needed for page and entry-interaction events. Content-resolution state is the data a content-capable
`OptimizationRoot` or `OptimizationProvider` uses to choose and render entry variants.
`OptimizationAnalyticsRoot` hydrates the analytics state only; it does not let child components
resolve content in the browser.

Page `properties` can contain arbitrary app metadata. The example uses `pageCategory` so that value
cannot be mistaken for top-level event `campaign` attribution or for `permutationKey`, the app-owned
public-cache identity input. These three inputs do not populate one another.

**Adapt this to your use case:**

```tsx
import { Hero } from '@/components/Hero'
import { optimization } from '@/lib/optimization'
import { getAnalyticsSegment, getHeroEntry } from '@/lib/analytics-segments'
import { createPublicPermutationHandoff } from '@contentful/optimization-nextjs/app-router/server'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'

const { OptimizationAnalyticsRoot, resolveEntriesForSelections } = optimization

export default async function AnalyticsOnlyPage() {
  const segment = await getAnalyticsSegment('campaign-a')
  const hero = await getHeroEntry({ locale: segment.locale, include: 10 })
  const [resolvedHero] = resolveEntriesForSelections({
    entries: [hero],
    selectedOptimizations: segment.selectedOptimizations,
  })
  const handoff = createPublicPermutationHandoff({
    permutationKey: segment.slug,
    cacheVersion: segment.cacheVersion,
    locale: segment.locale,
    entryIds: segment.baselineEntryIds,
    selectedOptimizations: segment.selectedOptimizations,
    changes: segment.changes,
    hydration: 'analytics-only',
  })
  const trackingAttributes = getServerTrackingAttributes(hero, resolvedHero)

  return (
    <OptimizationAnalyticsRoot
      buildPagePayload={() => ({ properties: { pageCategory: 'campaign-landing' } })}
      handoff={handoff}
      routeKey="/campaign-a"
    >
      <article {...trackingAttributes}>
        {resolvedHero.isEmptyVariant ? null : <Hero entry={resolvedHero.entry} />}
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
is not an isolation context. Use the helper's `isCurrent` option for runtime lifetime, so teardown stops work that has not
started. Newer handoffs preserve earlier admitted journals while state publication keeps latest-wins arbitration.

## Validate the integration

- At the handoff creation point, log `handoff.cache` during first validation and verify public
  routes use `public-permutation` or `static`, while request-personalized routes use
  `private-request`.
- For customer-owned permutations, inspect the logged handoff and verify `handoff.state?.profile`
  is absent. That property is the optional per-visitor profile snapshot; a public or static handoff
  cannot carry it safely. Also verify `handoff.replay` is absent; replay is private-request only.
- For every `public-permutation` handoff, inspect the logged `handoff.cache.key` and verify it
  starts with encoded fields such as `permutation=...:version=...:` and changes when the segment,
  locale, selected optimization set, entry set, or app-owned cache version changes. If rendered
  Custom Flag changes affect the output, verify those changes also rotate the app-owned cache
  version or another caller-owned key dimension.
- If you pass custom tags, verify `handoff.cache.tags` equals that caller-owned list and each tag
  satisfies the Next.js tag limits.
- If the route uses tag invalidation, trigger the application-owned path that calls
  `revalidateTag(...)` and verify the next request renders updated cached data. If no such path
  exists, do not count tag invalidation as validated.
- For server, static, ISR-style, and application-owned Edge runtime responses that render HTML, open
  View Source and find distinctive variant text from the selected permutation.
- For Pages Router ISR, request a prerendered public permutation in the mode where ISR runs and
  verify the response cache header matches the route's `revalidate` policy, for example
  `s-maxage=60` when the route returns `revalidate: 60`.
- With `hydration: 'preserve-server'`, load the page normally and verify the same distinctive text
  remains after hydration.
- For an Edge request handoff, confirm the server response does not create a preview profile cookie,
  then inspect the browser Network panel for one browser `POST` whose path ends in `/profiles` or
  `/profiles/:id` and whose URL has no `type=preflight` query parameter. The separate Edge preview
  is an Experience profile `POST` with `type=preflight`, not a CORS preflight. In the browser
  request body, inspect the `events` array: zero or more optional identify/track events appear in
  your supplied order, followed by the page event. Treat a successful response as the browser
  commit, then confirm `ctfl-opt-aid` appears only when persistence consent permits durable
  persistence.
- Call `startEdgeBrowserRuntime()` once, then call only
  `trackCurrentRoute(optimization, routeKey)` again without changing the route key. The second
  route call must not produce another browser profile `POST`. Do not repeat
  `startEdgeBrowserRuntime()`, because it hydrates the handoff.
- Navigate to a different path or search string and observe one new page event. Each recipe names
  one current-page owner, so do not mount a second tracker or direct page call beside it.
- For browser-owned routes, skip View Source for the variant proof; verify the variant in the
  rendered page or browser devtools after hydration.
- For a bound App Router path, mount the integration guide's
  [event observer](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#the-bound-root-and-page-events)
  inside that route's root. Trigger the first page load and inspect the accepted or blocked record
  in the browser console.
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
- [Integrate the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrate the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Choose the right SDK](./choosing-the-right-sdk.md)
- [Forward Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
