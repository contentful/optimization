---
title: Use Contentful GraphQL data with the Optimization SDKs
fern:
  slug: use-contentful-graphql-data-with-the-optimization-sdks
  section: Guides
  description: >-
    Use this guide when your app fetches Contentful data through the Contentful GraphQL Content API
    and wants an Optimization SDK to choose which authored entry to render for a visitor.
---

# Use Contentful GraphQL data with the Optimization SDKs

Use this guide when your app fetches Contentful data through the Contentful GraphQL Content API and
wants an Optimization SDK to choose which authored entry to render for a visitor.

This guide exists for GraphQL-specific response shaping. Contentful GraphQL responses follow your
generated schema, while the SDK's `resolveOptimizedEntry()` method consumes what this guide calls an
Entry-like object: a plain object with the Contentful Entry fields the resolver checks. You keep your
GraphQL query, client, cache, and rendering model; reshape only the data that crosses into the
resolver.

The guide uses these terms:

- **Variant** - An authored alternative of an entry.
- **Experience** - A rule that decides which visitors see which variant.
- **Experience API** - The Contentful service that, per request or visitor, picks the variant for
  each experience.
- **Baseline entry** - The original Contentful entry before the SDK resolves it to a variant.
- **Selected optimizations** - The SDK's per-visitor selection array from an Experience API result or
  SDK state. The resolver can return `selectedOptimization` (singular) when one attached optimization
  matched the entry.
- **Resolving** - Swapping a fetched baseline entry for its picked variant, or leaving the baseline
  entry in place when no picked variant applies.
- **`nt_experiences`** - The SDK-owned field on a baseline entry that links to its Optimization
  experience entries.
- **`nt_experience`** - The SDK-owned content type for an Optimization experience entry.
- **`nt_name`** - The SDK-owned display name field on an `nt_experience` entry.
- **`nt_type`** - The SDK-owned optimization kind field on an `nt_experience` entry.
- **`nt_config`** - The SDK-owned JSON field on an `nt_experience` entry that describes entry
  replacement components.
- **`nt_variants`** - The SDK-owned field on an `nt_experience` entry that contains linked variant
  entries.
- **`nt_experience_id`** - The SDK-owned field on an `nt_experience` entry that matches
  `selectedOptimization.experienceId`.
- **Variant entries** - The authored replacement entries linked from `nt_variants`. They must already
  be present in the GraphQL response, but they can use any content type. Query a fragment for every
  content type your app supports and preserve each node's content-type ID in the Entry-like object.
- **Entry-like object** - A plain object shaped like the Contentful Entry fields the resolver checks:
  `sys.type: 'Entry'`, `sys.id`, `sys.contentType.sys.id`, `metadata`, and `fields`.

## Do you need this?

Use this recipe when your app already uses GraphQL-shaped Contentful data and you don't want to move
that fetch layer to `contentful.js`.

Skip it when you fetch entries through `contentful.js` and can pass those entries directly to
`resolveOptimizedEntry()`, `OptimizedEntry`, or managed SDK fetching by entry ID.

## Quick start

This recipe assumes `runContentfulGraphQlQuery` is your app-owned GraphQL request function,
`optimization` is the SDK instance from your integration guide, and `selectedOptimizations` is the
SDK-selected array from an accepted Experience API response or current SDK state.

For a resolver-only test, create one known selection. In production, use the array returned by an
accepted Experience API call or published by your SDK state. The minimum item shape is
`experienceId`, `variantIndex`, and `variants`; `sticky` is optional. `variantIndex: 0` selects the
baseline entry, and positive indexes are one-based into the matching EntryReplacement variants in
`nt_config`. The `variants` object uses opaque Contentful entry IDs: each key is a baseline entry ID,
and each value is the selected variant entry ID. Keep it consistent with the source selection; the
resolver chooses the entry from `nt_config` and the linked `nt_variants`, while the selection map
also contributes to cache identity. In the fixture below, the key matches `graphqlData.page.sys.id`,
and the value matches the selected `ntVariantsCollection.items[].sys.id`.

**Adapt this to your use case:**

```ts
const selectedOptimizations = [
  {
    experienceId: '6IueRX1pS3iMJncbhUQTba',
    variantIndex: 1,
    variants: {
      '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb',
    },
  },
]
```

Query the baseline entry, its SDK-owned optimization links, each optimization entry's validation
fields and replacement configuration, and the linked variant entries in the same concrete locale:

**Adapt this to your use case:**

```graphql
query OptimizedPage(
  $id: String!
  $locale: String!
  $preview: Boolean!
  $useFallbackLocale: Boolean = true
) {
  page(id: $id, locale: $locale, preview: $preview, useFallbackLocale: $useFallbackLocale) {
    sys {
      id
    }
    __typename
    title
    slug
    heroHeadline
    ntExperiencesCollection(limit: 10) {
      items {
        sys {
          id
        }
        __typename
        ... on NtExperience {
          ntName
          ntType
          ntExperienceId
          ntConfig
          ntVariantsCollection(limit: 10) {
            items {
              sys {
                id
              }
              __typename
              ... on Page {
                title
                slug
                heroHeadline
              }
              ... on Hero {
                headline
              }
              ... on CallToAction {
                label
              }
            }
          }
        }
      }
    }
  }
}
```

Map the camelCase GraphQL fields back to the SDK-owned field names before calling the resolver. This
mapping belongs to your app: GraphQL `__typename` values and Contentful content-type IDs are related
but are not interchangeable strings. The example explicitly maps `Page` to `page`, `Hero` to `hero`,
and `CallToAction` to `callToAction`; replace both sides with values that exactly match your content
model.

The next example also assumes `appLocale` is your app-owned concrete locale, `preview` is your
app-owned preview-mode boolean, and `renderHero`, `renderCta`, and `renderPageFromEntry` are your
existing render functions. `runContentfulGraphQlQuery`, `optimization`, and
`selectedOptimizations` remain the app-owned values defined at the start of the quick start.

The typed path below defines a Contentful entry skeleton for each supported content type. A skeleton
declares an entry's content-type ID and fields. `PossibleSkeleton` contains the baseline and every
possible variant and becomes the resolver's first type argument, `S`.

The adapter imports types from `contentful`, so add it as a development dependency if the app does
not already use it: `pnpm add -D contentful`. The example imports `isEntryOfContentType` from React
Web. For Web, Next.js, Node, or React Native, use the same `/api-schemas` path from
`@contentful/optimization-web`, `@contentful/optimization-nextjs`,
`@contentful/optimization-node`, or `@contentful/optimization-react-native`, respectively.

**Adapt this to your use case:**

```ts
// Use the /api-schemas pass-through from the Optimization SDK package your app installed.
import { isEntryOfContentType } from '@contentful/optimization-react-web/api-schemas'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'

type PageSkeleton = EntrySkeletonType<
  {
    title: EntryFieldTypes.Symbol
    slug: EntryFieldTypes.Symbol
    heroHeadline: EntryFieldTypes.Symbol
    nt_experiences: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<EntrySkeletonType>>
  },
  'page'
>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type CtaSkeleton = EntrySkeletonType<{ label: EntryFieldTypes.Symbol }, 'callToAction'>
type PossibleSkeleton = PageSkeleton | HeroSkeleton | CtaSkeleton

type GraphQlCollection<T> = {
  items?: Array<T | null> | null
}

type GraphQlNode<T extends string> = {
  sys: { id: string }
  __typename: T
}

type GraphQlPageVariant = GraphQlNode<'Page'> & {
  title?: string | null
  slug?: string | null
  heroHeadline?: string | null
}

type GraphQlPage = GraphQlPageVariant & {
  ntExperiencesCollection?: GraphQlCollection<GraphQlExperience> | null
}

type GraphQlHero = GraphQlNode<'Hero'> & {
  headline?: string | null
}

type GraphQlCta = GraphQlNode<'CallToAction'> & {
  label?: string | null
}

type GraphQlVariant = GraphQlPageVariant | GraphQlHero | GraphQlCta

type GraphQlExperience = GraphQlNode<'NtExperience'> & {
  ntName?: string | null
  ntType?: 'nt_experiment' | 'nt_personalization' | null
  ntExperienceId?: string | null
  ntConfig?: unknown
  ntVariantsCollection?: GraphQlCollection<GraphQlVariant> | null
}

function present<T>(value: T | null | undefined): value is T {
  return value != null
}

function entryLike(
  node: GraphQlNode<string>,
  contentTypeId: string,
  fields: Record<string, unknown>,
): Entry<EntrySkeletonType> {
  return {
    sys: {
      type: 'Entry',
      id: node.sys.id,
      contentType: {
        sys: {
          type: 'Link',
          linkType: 'ContentType',
          id: contentTypeId,
        },
      },
    },
    metadata: {},
    fields,
  } as Entry<EntrySkeletonType>
}

function toPageEntry(page: GraphQlPage): Entry<PageSkeleton, undefined> {
  return entryLike(page, 'page', {
    title: page.title,
    slug: page.slug,
    heroHeadline: page.heroHeadline,
    nt_experiences:
      page.ntExperiencesCollection?.items?.filter(present).map(toExperienceEntry) ?? [],
  }) as Entry<PageSkeleton, undefined>
}

function toExperienceEntry(experience: GraphQlExperience): Entry<EntrySkeletonType> {
  return entryLike(experience, 'nt_experience', {
    nt_name: experience.ntName,
    nt_type: experience.ntType,
    nt_experience_id: experience.ntExperienceId,
    nt_config: experience.ntConfig,
    nt_variants: experience.ntVariantsCollection?.items?.filter(present).map(toVariantEntry) ?? [],
  })
}

function toVariantEntry(variant: GraphQlVariant): Entry<EntrySkeletonType> {
  switch (variant.__typename) {
    case 'Hero':
      return entryLike(variant, 'hero', {
        headline: variant.headline,
      })
    case 'CallToAction':
      return entryLike(variant, 'callToAction', {
        label: variant.label,
      })
    case 'Page':
      return entryLike(variant, 'page', {
        title: variant.title,
        slug: variant.slug,
        heroHeadline: variant.heroHeadline,
      })
  }
}

const graphqlData = await runContentfulGraphQlQuery({
  id: '4ib0hsHWoSOnCVdDkizE8d',
  locale: appLocale,
  preview,
})

const baselineEntry = toPageEntry(graphqlData.page)
const resolved = optimization.resolveOptimizedEntry<PossibleSkeleton>(
  baselineEntry,
  selectedOptimizations,
)

if (!resolved.isEmptyVariant) {
  if (isEntryOfContentType<HeroSkeleton, undefined>(resolved.entry, 'hero')) {
    renderHero(resolved.entry.fields.headline)
  } else if (isEntryOfContentType<CtaSkeleton, undefined>(resolved.entry, 'callToAction')) {
    renderCta(resolved.entry.fields.label)
  } else {
    renderPageFromEntry(resolved.entry)
  }
}
```

The `isEmptyVariant` branch makes no render call. The skeleton names and fields belong to this
example content model; replace them and the GraphQL fragments with the content types your app
supports. `isEntryOfContentType` checks the preserved `sys.contentType.sys.id` and narrows the union;
it does not validate fields. When the baseline and every variant use `PageSkeleton`, omit the generic
and TypeScript infers that single skeleton. For an open-ended content model, use `EntrySkeletonType`
for `S`; this avoids maintaining a closed union, but fields are unchecked and must be validated
before rendering. See
[TypeScript content-model choices](../concepts/entry-personalization-and-variant-resolution.md#typescript-content-model-choices)
for the complete modeling trade-offs.

The adapter input boundary is the GraphQL `page` object passed to `toPageEntry()`. To verify without
calling Contentful, save one real `graphqlData.page` response as a JSON fixture with the shape shown
above, type the loaded object with `satisfies GraphQlPage`, and pass it directly to
`toPageEntry(fixturePage)`. For the variant case, keep one matching experience whose `ntExperienceId` matches
`selectedOptimizations[0].experienceId`, set `variantIndex: 1`, keep the first configured variant in
both `ntConfig` and `ntVariantsCollection.items`, and confirm the result ID matches that variant. For
the fallback case, reuse the same fixture with the matching item removed from
`ntVariantsCollection.items`; the same resolver call must return the baseline entry ID.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Default recipe](#default-recipe)
  - [Keep GraphQL fetching app-owned](#keep-graphql-fetching-app-owned)
  - [Query the optimization data](#query-the-optimization-data)
  - [Adapt at the resolver boundary](#adapt-at-the-resolver-boundary)
  - [Render from the resolved result](#render-from-the-resolved-result)
- [Runtime or vendor variants](#runtime-or-vendor-variants)
  - [React Web](#react-web)
  - [Next.js App Router or Pages Router](#nextjs-app-router-or-pages-router)
  - [Manual Node or server rendering](#manual-node-or-server-rendering)
- [Validate the integration](#validate-the-integration)
- [Governance notes](#governance-notes)
- [Related guides and concepts](#related-guides-and-concepts)

<!-- mtoc-end -->
</details>

## Default recipe

### Keep GraphQL fetching app-owned

The GraphQL query, GraphQL client, cache keys, preview token policy, and rendering components belong
to your app. The Optimization SDK owns the `nt_*` content-model identifiers and the resolver
contract.

Do not add a separate SDK-owned GraphQL client. App-owned GraphQL fetching stays on the manual side
of the entry-source boundary, which means the app fetches the data and hands an entry to the SDK
instead of asking the SDK to fetch by ID. Fetch the data, create the Entry-like shape, call
`resolveOptimizedEntry()`, and render the result.

### Query the optimization data

GraphQL fields are schema-shaped. Content fields are selected directly, Object fields such as
`ntConfig` are returned as JSON, and array links are selected through generated `*Collection` fields.
Request one concrete `locale` for the entry you pass to the resolver. GraphQL does not support the
CDA `locale=*` wildcard, but mixing several localized GraphQL payloads into one Entry-like object
creates the same problem: the resolver expects one localized value per field.

For optimized entry replacement, the query must include:

- The baseline entry's `sys.id`, `__typename`, render fields, and `ntExperiencesCollection`.
- Each linked `nt_experience` entry's `sys.id`, `ntName`, `ntType`, and `ntExperienceId`.
- Each linked `nt_experience` entry's `ntConfig` and `ntVariantsCollection` so entry replacement can
  resolve to a variant.
- Each linked variant entry's `sys.id`, `__typename`, and a fragment containing the render fields
  for every content type your app supports.

### Adapt at the resolver boundary

Keep the adapter narrow. Convert only the GraphQL nodes that enter `resolveOptimizedEntry()`. The
adapter must preserve SDK-owned field names inside `fields`, even though GraphQL exposes those names
in camelCase:

| GraphQL response field       | Entry-like resolver field |
| ---------------------------- | ------------------------- |
| `ntExperiencesCollection`    | `fields.nt_experiences`   |
| `ntName`                     | `fields.nt_name`          |
| `ntType`                     | `fields.nt_type`          |
| `ntExperienceId`             | `fields.nt_experience_id` |
| `ntConfig`                   | `fields.nt_config`        |
| `ntVariantsCollection.items` | `fields.nt_variants`      |

The resolver checks `sys.type`, `sys.id`, `sys.contentType.sys.id`, `metadata`, and `fields`. It
also validates linked `nt_experience` entries, so missing required fields such as `fields.nt_name` or
`fields.nt_type` make the optimization entry unusable for resolution. After validation, the resolver
matches `selectedOptimization.experienceId` to `fields.nt_experience_id`, reads `fields.nt_config`,
and looks for the selected variant in `fields.nt_variants`. Preserve each GraphQL node's
`__typename` as the corresponding `sys.contentType.sys.id`; the selected linked variant does not
have to match the baseline content type.

### Render from the resolved result

The quick start renders the reshaped Entry-like object directly. When your components expect the
original GraphQL-native objects, map the already-resolved entry ID back to those objects:

**Follow this pattern:**

```ts
const graphQlVariants =
  graphqlData.page.ntExperiencesCollection?.items
    ?.filter(present)
    .flatMap((experience) => experience.ntVariantsCollection?.items?.filter(present) ?? []) ?? []

const graphQlEntriesById = new Map(
  [graphqlData.page, ...graphQlVariants]
    .filter(present)
    .map((entry) => [entry.sys.id, entry] as const),
)

if (!resolved.isEmptyVariant) {
  const entryToRender = graphQlEntriesById.get(resolved.entry.sys.id) ?? graphqlData.page
  renderGraphQlEntry(entryToRender)
}
```

When your runtime emits tracking metadata manually, derive it after resolution. Tracking metadata is
the resolved entry and optimization context a runtime uses for entry view, click, hover, or tap
events. Use the resolved entry ID where applicable. SDK components and wrappers do this for you;
custom renderers must not keep rendering or tracking against the baseline ID after a variant
resolves.

## Runtime or vendor variants

### React Web

Use the React Web integration guide for provider setup and event timing. Inside components that
already receive GraphQL data, memoize the Entry-like baseline from the GraphQL response and call
`useEntryResolver()` or `useOptimization().resolveOptimizedEntry(...)`. Render the resolved
Entry-like object directly, or map `resolved.entry.sys.id` back to the GraphQL object your component
already understands.

If you need Web interaction tracking, prefer `OptimizedEntry` when you can pass an Entry-like
`baselineEntry`. For fully custom GraphQL renderers, add Web tracking metadata after resolution
instead of before it.

### Next.js App Router or Pages Router

Use your route loader, Server Component, `getServerSideProps`, or API route to run the GraphQL query
with the route's concrete locale and preview state. Resolve on the server when the route already has
request-local selected optimizations, then pass either the rendered result or the resolved entry ID
to the client.

For client hydration after server rendering, hydrate Optimization state through the relevant Next.js
integration guide and keep the same ID-map strategy on the client. The server and client must agree
on the GraphQL IDs and the locale used to build the Entry-like object.

### Manual Node or server rendering

Use a request-bound Node SDK instance for consent, profile, locale, and Experience events. After an
accepted event returns `data.selectedOptimizations`, adapt the GraphQL response and call
`resolveOptimizedEntry(baselineEntry, data.selectedOptimizations)`.

Server caches remain app-owned. Cache the GraphQL response by route, locale, preview state, and any
application cache dimensions. Treat the resolved entry as request-local unless a cache-safe handoff
guide tells you to render shared output for a preselected variant permutation.

## Validate the integration

- Confirm the GraphQL query includes `ntExperiencesCollection`, `ntName`, `ntType`,
  `ntExperienceId`, `ntConfig`, `ntVariantsCollection`, and a fragment with render fields for every
  supported variant content type.
- Confirm the query receives one concrete locale string for the entry being resolved.
- Confirm variant entries are present as objects in `ntVariantsCollection.items`, not only as IDs or
  unresolved links.
- Resolve a variant whose content type differs from the baseline, and confirm the preserved
  `sys.contentType.sys.id` selects the expected typed branch or GraphQL-native renderer.
- Resolve with a known `selectedOptimizations` item whose `experienceId` matches
  `ntExperienceId`, and confirm `resolved.entry.sys.id` is the expected variant entry ID.
- Remove `ntConfig`, `ntVariantsCollection`, or the matching variant entry in a test fixture, and
  confirm the resolver returns the baseline entry ID instead of throwing.
- When you emit tracking metadata manually, inspect the rendered metadata or event payload and
  confirm it uses `resolved.entry.sys.id` where the runtime expects the resolved entry identity.

## Governance notes

The app owns GraphQL documents, fragments, generated types, clients, preview credentials, cache
policy, route loaders, supported content-type union, and rendering. Keep those decisions in the app
layer.

The SDK owns `nt_experiences`, `nt_experience`, `nt_name`, `nt_type`, `nt_config`, `nt_variants`,
`nt_experience_id`, the `selectedOptimizations` shape, and the resolver contract. Do not rename
SDK-owned fields inside the Entry-like object, and do not invent replacement identifiers in GraphQL
fragments.

Keep the adapter close to the resolver call. A small adapter is easier to audit when the content
model changes, and it avoids turning your GraphQL schema into a second Contentful SDK model.

## Related guides and concepts

- [Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md) -
  Resolver inputs, content-model typing, fallback behavior, and single-locale entry constraints.
- [Contentful GraphQL Content API](https://www.contentful.com/developers/docs/references/graphql/) -
  Official Contentful GraphQL schema, locale, preview, and collection-field reference.
- [Integrate the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md) -
  React provider setup, entry resolution, and interaction tracking.
- [Integrate the Optimization Next.js SDK in a Next.js App Router app](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md) -
  App Router request handoff and server/client rendering paths.
- [Integrate the Optimization Next.js SDK in a Next.js Pages Router app](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md) -
  Pages Router request handoff and SSR patterns.
- [Integrate the Optimization Node SDK in a Node app](./integrating-the-node-sdk-in-a-node-app.md) -
  Request-bound server selection and manual entry resolution.
- [Build a custom JavaScript Optimization adapter](./building-a-custom-javascript-optimization-adapter.md) -
  Low-level adapter boundaries when no official SDK package fits your runtime.
