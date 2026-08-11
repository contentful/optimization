# Integrating the Optimization Web SDK in a web app

Use this guide to add Contentful personalization to a browser app you already have that is not built
with React — a static site, a multi-page app, a single-page app, or a custom frontend runtime where
you want to own the browser SDK lifecycle directly. By the end of the quick start, one piece of
content will render its personalized variant in the page once you resolve it, without changing how
your app fetches or renders content.

**New to personalization?** Here is the whole idea in four points:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- As the visitor uses your app, Contentful's **Experience API** looks at who they are and picks the
  variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies—the **baseline
  fallback**. You can fetch the entry yourself or give the SDK your Contentful client and an entry
  ID; either way, the client stays yours.
- You render the returned entry with the same application components you already use.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — a personalized entry rendered into the page (the quick start below).** After you
  emit a page event, fetch an entry, and resolve it, a visitor sees their variant on screen. This is
  complete and shippable on its own.
- **Milestone 2 — live re-personalization (opt-in, later).** Content re-resolves when consent,
  identity, or profile changes, without a full reload, by subscribing to SDK state and re-rendering.
  See
  [State subscriptions, locale changes, and re-rendering](#state-subscriptions-locale-changes-and-re-rendering).

This guide uses the `ContentfulOptimization` class from `@contentful/optimization-web`. You create
one instance, drive it imperatively — emit events, resolve entries, subscribe to state — and your
app keeps ownership of its Contentful client, consent policy, identity, routing, caching, and
rendering. The package also ships optional Web Components (`defineContentfulOptimizationElements()`)
for a declarative element-based integration; the quick start uses the class, and
[Web Components entry rendering](#web-components-entry-rendering) covers the elements.

If you are building a React app and want official providers, hooks, components, and router adapters,
use the [React Web SDK guide](./integrating-the-react-web-sdk-in-a-react-app.md) instead. If your
app renders on the server with Next.js, use the
[Next.js App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md) or the
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).

## Quick start

Most browser + Contentful apps share one shape: you fetch an entry (a page, a hero, a section) and
render its fields into the DOM. This quick start assumes that shape and personalizes a single entry.
If your app is shaped differently, the change is the same wherever an entry becomes rendered markup;
see [Resolving entries and rendering the result](#resolving-entries-and-rendering-the-result).

It proves one result: **one entry renders its personalized variant in the page once the SDK resolves
it.** This quick start assumes your app may personalize on startup; if personalization must wait for
consent, keep this structure and add the [Consent and privacy handoff](#consent-and-privacy-handoff)
step before you ship.

1. Install the browser SDK and a Contentful delivery client. Add `contentful` only if your app does
   not already have a Contentful Delivery API (CDA) client.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-web contentful
   ```

2. Create one SDK instance for the page or single-page app (SPA) runtime, emit one `page()` event,
   fetch one single-locale entry, resolve it, and render the result into the DOM. Read the
   placeholder config from whatever mechanism your build uses to expose browser-visible values, and
   keep it consistent with the Contentful variables your app already ships.

   `defaults: { consent: true }` tells the SDK it may personalize and send events for this visitor;
   the quick start uses always-on consent to keep the path simple — production gates this on the
   visitor's real choice (see [Consent and privacy handoff](#consent-and-privacy-handoff)).

   Before you resolve, call `page()` once: a page event asks the Experience API to evaluate the
   visitor. Its `accepted` field only says whether the SDK allowed the event. Returned `data`, when
   present, carries selections for that call. This quick start has no overlapping Experience calls
   or route transitions, so the response can populate the new instance's shared state. An accepted
   result without `data` leaves selections empty, so resolution safely returns the baseline;
   `accepted: false` stops the example before rendering.

   **Adapt this to your use case:** replace the placeholder values and the `#hero` selector with
   your own; the config keys are explained in
   [How the SDK fits your app](#how-the-sdk-fits-your-app). The render step is a minimal placeholder
   — substitute your own field rendering, template, or DOM update.

   ```ts
   import * as contentful from 'contentful'
   import ContentfulOptimization from '@contentful/optimization-web'

   const APP_LOCALE = 'en-US' // the one locale you also pass to Contentful

   const contentfulClient = contentful.createClient({
     accessToken: 'your-contentful-delivery-token',
     environment: 'main',
     space: 'your-space-id',
   })

   const optimization = new ContentfulOptimization({
     clientId: 'your-optimization-client-id',
     environment: 'main',
     locale: APP_LOCALE,
     // consent: allowed to personalize and send events for this visitor.
     // Use default-on consent only when application policy permits it.
     defaults: { consent: true },
     app: { name: 'my-web-app', version: '1.0.0' },
   })

   // Await the page event before resolving; this startup sequence has no overlapping calls.
   const pageResult = await optimization.page()
   if (!pageResult.accepted) {
     throw new Error('Optimization page event was blocked; check consent policy')
   }

   const baselineEntry = await contentfulClient.getEntry('4ib0hsHWoSOnCVdDkizE8d', {
     include: 10, // resolve linked experience and variant entries before rendering
     locale: APP_LOCALE, // one concrete locale — never withAllLocales / locale=*
   })

   // Uses current selections; with no page data or usable variant, this returns baselineEntry.
   const { entry, isEmptyVariant } = optimization.resolveOptimizedEntry(baselineEntry)

   const hero = document.querySelector<HTMLElement>('#hero')
   if (hero) hero.textContent = isEmptyVariant ? '' : String(entry.fields.headline ?? '')
   ```

3. Check that it works. In Contentful, author a variant on the entry you fetch above and attach it
   to an experience — for a first test, target **all visitors** so you match it automatically. Load
   the page: the hero renders the variant's text. If the baseline text stays on screen instead, work
   through [Troubleshooting](#troubleshooting).

You now have personalization working. **The rest of this guide is not a re-run of the quick start**
— it explains what each step did and covers what the quick start deliberately skipped: real,
consent-gated startup; the create-emit-resolve lifecycle; your Contentful fetch requirements and the
baseline-fallback contract; page and route events; state subscriptions and live re-rendering;
interaction tracking; identity; Web Components; and production hardening. Read straight through, or
jump to the section you need.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [How the SDK fits your app](#how-the-sdk-fits-your-app)
  - [The SDK lifecycle: create, emit, resolve](#the-sdk-lifecycle-create-emit-resolve)
  - [Fetching Contentful entries](#fetching-contentful-entries)
  - [Resolving entries and rendering the result](#resolving-entries-and-rendering-the-result)
  - [Page and route events](#page-and-route-events)
  - [Consent and privacy handoff](#consent-and-privacy-handoff)
  - [State subscriptions, locale changes, and re-rendering](#state-subscriptions-locale-changes-and-re-rendering)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile, and reset](#identity-profile-and-reset)
- [Optional integrations](#optional-integrations)
  - [Web Components entry rendering](#web-components-entry-rendering)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Analytics forwarding](#analytics-forwarding)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Hybrid Node SSR and browser continuity](#hybrid-node-ssr-and-browser-continuity)
  - [Strict consent, storage, and delivery controls](#strict-consent-storage-and-delivery-controls)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A browser app** with a build or runtime that can load an npm package, and its own Contentful
  fetching already working. `contentful` is a companion dependency you install alongside the SDK if
  you do not already have a Delivery API client.
- **Contentful delivery credentials** — space ID, delivery token, and environment.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. Find them in the Contentful web app under **Apps → Installed apps → Contentful
  Personalization → SDK keys**.

  The Experience and Insights API base URLs default correctly; you only set them for mocks or
  non-default hosts (see [How the SDK fits your app](#how-the-sdk-fits-your-app)).

You do not need a setup inventory up front. Everything else — consent, page events, state
subscriptions, tracking, identity — is introduced by the section that needs it.

> [!NOTE]
>
> The Web SDK is bundler-agnostic. Read its config from whatever mechanism your build uses to expose
> browser-visible values (a bundler define, `import.meta.env`, a server-injected global, or plain
> constants), and keep it consistent with your other browser-visible Contentful variables. Ship only
> the Contentful **delivery** token to the browser, never a Management API token.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

This section explains the `ContentfulOptimization` instance you created in the quick start — what
each config key does and how to make startup depend on real consent.

The Web SDK is a thin, stateful layer between three things you already have or control: your
Contentful data, Contentful's Experience API, and your rendering code. You create one instance and
reuse it across route handlers, render code, and interaction handlers. It is not a Contentful client
replacement: the Contentful client and credentials are yours, along with routing, rendering, consent
policy, identity policy, and cache policy.

The config you pass to `new ContentfulOptimization(...)` breaks down like this:

1. `clientId` and `environment` identify your Optimization project. Read them from browser-safe
   config.
2. `locale` is the one locale the SDK uses for Experience and event context. Use the same locale you
   pass to Contentful.
3. `api` overrides the Experience and Insights endpoints (`experienceBaseUrl`, `insightsBaseUrl`).
   Set these only for a mock, a proxy, or non-default hosts; omit them otherwise.
4. `defaults` is the SDK's starting state: `consent` (may personalize and send events) and
   `persistenceConsent` (may store the profile-id cookie — the anonymous identifier the SDK assigns
   each visitor to keep their variant assignments consistent across visits). If you set `consent`
   but omit `persistenceConsent`, `persistenceConsent` defaults to your `consent` value.
5. `app` is your app's name and version, sent as event metadata.
6. `logLevel`, `allowedEventTypes`, `autoTrackEntryInteraction`, `cookie`, `queuePolicy`, and
   `onEventBlocked` are optional and covered in their own sections below.

Keep the instance in a module-level binding or another singleton container. In a browser the
constructor attaches the instance to `window.contentfulOptimization` and **throws
`ContentfulOptimization is already initialized`** if one already exists there. Call `destroy()` only
for explicit teardown paths such as tests, hot reload, or a framework root unmount that owns the
instance.

The quick start used always-on `defaults` to get you a result. For production, make startup depend
on real consent: leave `consent` unset (or seed it off) and call `consent(true)` from the UI that
owns the visitor's decision, as shown in
[Consent and privacy handoff](#consent-and-privacy-handoff).

**Adapt this to your use case:** the shared module a real app imports everywhere, with app metadata
and API overrides.

```ts
import * as contentful from 'contentful'
import ContentfulOptimization from '@contentful/optimization-web'

const APP_LOCALE = 'en-US'

export const contentfulClient = contentful.createClient({
  accessToken: 'your-contentful-delivery-token',
  environment: 'main',
  space: 'your-space-id',
})

// Reuse this singleton across route, render, and tracking handlers.
export const optimization = new ContentfulOptimization({
  clientId: 'your-optimization-client-id',
  environment: 'main',
  locale: APP_LOCALE,
  app: { name: 'my-web-app', version: '1.0.0' },
  // Set these only for mocks or non-default hosts; both default correctly otherwise.
  api: {
    experienceBaseUrl: 'https://experience.example.com/',
    insightsBaseUrl: 'https://insights.example.com/',
  },
  logLevel: 'warn',
})
```

For the locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### The SDK lifecycle: create, emit, resolve

**Integration category:** Required for first integration

This is the concept that has no equivalent in the component-based guides, so it is worth stating
plainly. The Web SDK is imperative and stateful, and its state fills in a specific order:

- **The instance is ready synchronously.** `resolveOptimizedEntry()`, `getFlag()`, and the
  `states.*` observables (explained in
  [State subscriptions, locale changes, and re-rendering](#state-subscriptions-locale-changes-and-re-rendering))
  work the moment you call `new ContentfulOptimization(...)`.
- **Optimization state begins empty and only the applicable response updates it.** In a sequential
  startup, await `page()` or `identify()` before resolving (`identify()` works the same way — see
  [Identity, profile, and reset](#identity-profile-and-reset)). If calls overlap, each call still
  receives its own result, but an older result might not update shared SDK state. Resolve before any
  response populates that state and you get the baseline — which is correct, just not personalized
  yet.

So the order that matters is: construct → emit `page()` (or `identify()`) → resolve entries. That is
why the quick start awaits `page()` before calling `resolveOptimizedEntry()`.

1. Construct the instance once and reuse it (see
   [How the SDK fits your app](#how-the-sdk-fits-your-app)).
2. Await `page()` or `identify()` before rendering optimized content. In this non-overlapping
   startup sequence, returned response data can populate the shared `selectedOptimizations` state.
3. Resolve and render entries. When you omit the second argument, `resolveOptimizedEntry()` uses the
   SDK's current state, so later re-renders pick up the latest selections automatically.

**Follow this pattern:** the ordered startup sequence.

```ts
// 1. The instance is usable immediately after construction.
const optimization = new ContentfulOptimization({ clientId, environment, locale })

// 2. Await the event before resolving. `{ accepted: false }` means a guard blocked it.
const { accepted } = await optimization.page()

// 3. Now resolve against current state. Before step 2, this would return the baseline.
if (accepted) renderVisibleEntries()
```

### Fetching Contentful entries

**Integration category:** Required for first integration

The Contentful client is yours. This is the boundary, and it has two supported shapes: **you fetch,
the SDK resolves**, or **you hand the SDK your client and it fetches by ID or content type and slug
for you.** Both end at the same resolution step, and you can use different paths for different
entries in the same app.

- **Manual** — you fetch the entry with your own client and pass it in. The quick start uses this
  path. Keep your existing client, fetchers, and caching; the SDK only needs entries to arrive in a
  shape it can resolve.
- **Managed** — you give the SDK your Contentful client once through the `contentful` config key,
  then identify an entry by ID or `{ contentType, slug, slugField?, entryQuery? }`.
  `slugField` defaults to `slug`; `entryQuery` carries that source object's CDA query. The client stays
  yours. The SDK uses `getEntry()` for a single ID and `getEntries()` for slug lookup and eligible ID
  batches.

Either way, the same fetch requirements hold:

1. Fetch with one concrete Contentful locale. Do not use `withAllLocales` or raw Contentful Delivery
   API (CDA) `locale=*` — all-locale payloads use locale-keyed field maps the resolver cannot read,
   so entries fall back to baseline.
2. Use an `include` depth deep enough to resolve the whole tree — the entry, its sections, and the
   linked variant entries. `include: 10` is the common setting.
3. Use the same locale for Contentful and for the SDK so localized Experience responses and rendered
   content line up.

A single-locale entry exposes its optimization fields directly, such as `fields.nt_experiences` and
`fields.nt_variants` (the `nt_` prefix is how personalization links appear on an entry).

**Adapt this to your use case:** the manual path — your own fetcher, which the render step then
resolves. `fetchEntry` is a helper you own and name.

```ts
import * as contentful from 'contentful'

const APP_LOCALE = 'en-US'
const INCLUDE_DEPTH = 10

const contentfulClient = contentful.createClient({
  accessToken: 'your-contentful-delivery-token',
  environment: 'main',
  space: 'your-space-id',
})

export async function fetchEntry(entryId: string) {
  return await contentfulClient.getEntry(entryId, {
    include: INCLUDE_DEPTH, // resolve linked experience and variant entries before rendering
    locale: APP_LOCALE, // keep this aligned with the SDK locale
  })
}
```

For the managed path, pass your client to the SDK as `contentful: { client }`. The SDK merges your
`contentful.defaultQuery`, `entryQuery` (or the separate query argument on the ID overload), the SDK
locale as a fallback, and `include: 10`, and caches results per instance (default
`{ maxEntries: 100, ttlMs: 300_000 }`; pass `cache: false` to disable, or
`clearContentfulEntryCache()` to clear it). `fetchContentfulEntry(id)` returns the fetched entry;
the same method accepts a slug-source object. `fetchContentfulEntries(entries)` preserves input order
and duplicates. ID sources can batch when their effective locale, include depth, and other query
values match; each distinct slug source uses its own `getEntries()` request.
`prefetchManagedEntries(entries)` returns server handoff objects for framework adapters. A slug
handoff nests the normalized descriptor under `managedEntry` and retains the fetched entry's
`sys.id` as `entryId`. `fetchOptimizedEntry(...)` fetches and resolves in one call (see
[Resolving entries and rendering the result](#resolving-entries-and-rendering-the-result)).

Slug lookup enforces `content_type`, `fields.<slugField>`, and `limit: 2` after merging the normal
managed query, so those selectors win over conflicting query values. The placeholders below are
replaced with the source's actual content type, effective slug field, and slug:

- No match: `Contentful entry not found for content type "<contentType>" where
"fields.<slugField>" equals "<slug>".`
- More than one match: `Multiple Contentful entries found for content type "<contentType>" where
"fields.<slugField>" equals "<slug>".`

The SDK uses the fetched entry's real `sys.id` for handoff identity, resolution metadata, and
interaction tracking; it does not treat the slug as an entry ID.

**Adapt this to your use case:** the managed path — configure the client once, then fetch by your
app-owned content type and slug.

```ts
import * as contentful from 'contentful'
import ContentfulOptimization from '@contentful/optimization-web'

const contentfulClient = contentful.createClient({
  accessToken: 'your-contentful-delivery-token',
  environment: 'main',
  space: 'your-space-id',
})

const optimization = new ContentfulOptimization({
  clientId: 'your-optimization-client-id',
  locale: 'en-US',
  // Hand the SDK your client; slug lookup calls getEntries() through it. The client stays yours.
  contentful: { client: contentfulClient },
})

const baselineEntry = await optimization.fetchContentfulEntry({
  contentType: 'page',
  slug: 'home',
  // slugField defaults to 'slug'; set it only when your content model uses another field.
  entryQuery: { locale: 'en-US' },
})
```

For the combined fetch-and-resolve call — `fetchOptimizedEntry(id)`, which fetches and resolves in
one step — see the next section. For the resolver contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Resolving entries and rendering the result

**Integration category:** Required for first integration

The quick start showed the resolve-and-render. This explains the return shape and the two things
about it that matter everywhere. The rule never changes: **wherever a Contentful entry becomes
rendered markup, resolve it first. Render no content when `isEmptyVariant` is `true`; otherwise,
render the returned `entry`.**

`resolveOptimizedEntry(baselineEntry, selectedOptimizations?)` returns an object:

- `entry` — the resolved variant when one applies, or the baseline entry otherwise. This is what you
  render.
- `selectedOptimization` — selection metadata (`experienceId`, `variantIndex`, `sticky`,
  `variants`). It is `undefined` only when no experience matched (no selections, the entry is not
  optimized, or no selection matched it). When an experience matches but assigns the visitor to the
  control/baseline variant, it is defined with `variantIndex: 0` — and the returned `entry` still
  equals the baseline. So do not read `selectedOptimization === undefined` as "the visitor is seeing
  baseline content."
- `optimizationContextId` — an opaque id you attach to the rendered element so interaction tracking
  can tie events back to this selection (see
  [Entry interaction tracking](#entry-interaction-tracking)).
- `isEmptyVariant` — `true` when the selected variant has an empty ID. The returned `entry` retains
  the baseline for tracking context, but your app must render no content.

Omit the second argument to resolve against the SDK's current state (the selections from the latest
response that was allowed to update that state); pass an explicit `SelectedOptimizationArray` only
when you resolve against selections you captured yourself — for example selections handed over from
a server-rendered response (see
[Hybrid Node SSR and browser continuity](#hybrid-node-ssr-and-browser-continuity)).

If you configured the managed path (`contentful: { client }`), `fetchOptimizedEntry(id, options?)`
or `fetchOptimizedEntry({ contentType, slug, slugField?, entryQuery? }, options?)` fetches and
resolves in one call and returns the same fields plus the `baselineEntry` it fetched. The slug source
object puts the query inside `entryQuery`; its options contain only `selectedOptimizations`. Use a
managed call when you want the SDK to own the fetch; use `resolveOptimizedEntry(entry)` when you
fetch the entry yourself.

**Follow this pattern:** managed fetch-and-resolve in one call.

```ts
// The optional second argument is FetchOptimizedEntryOptions: { query?, selectedOptimizations? }.
// Omit selectedOptimizations to use current SDK state.
const { entry, baselineEntry, selectedOptimization } =
  await optimization.fetchOptimizedEntry('4ib0hsHWoSOnCVdDkizE8d')
```

The second resolver argument is always `selectedOptimizations`. Omit it to use the stateful SDK's
current selections, or pass a captured array positionally. A Contentful entry skeleton is the
TypeScript type that declares an entry's content-type ID and fields. When the baseline and variants
can use different known content types, put all of their skeletons in one union, pass it as the first
type argument, and narrow the result before reading fields. The resolver names this skeleton set
`S`.

**Follow this pattern:** one skeleton union for the baseline and every possible variant.

```ts
import {
  isEntryOfContentType,
  type SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type CtaSkeleton = EntrySkeletonType<{ label: EntryFieldTypes.Symbol }, 'cta'>
type PossiblePageSkeleton = PageSkeleton | HeroSkeleton | CtaSkeleton
type AppLocale = 'en-US'

function renderPage(
  baselineEntry: Entry<PageSkeleton, ChainModifiers, AppLocale>,
  selectedOptimizations?: SelectedOptimizationArray,
): string {
  const { entry, isEmptyVariant } = optimization.resolveOptimizedEntry<
    PossiblePageSkeleton,
    ChainModifiers,
    AppLocale
  >(baselineEntry, selectedOptimizations)

  if (isEmptyVariant) return ''
  if (isEntryOfContentType<HeroSkeleton, ChainModifiers, AppLocale>(entry, 'hero')) {
    return String(entry.fields.headline ?? '')
  }
  if (isEntryOfContentType<CtaSkeleton, ChainModifiers, AppLocale>(entry, 'cta')) {
    return String(entry.fields.label ?? '')
  }
  return String(entry.fields.title ?? '')
}
```

When every variant uses `PageSkeleton`, omit the generic arguments and TypeScript infers that single
skeleton from the baseline entry. For an open-ended content model, use `EntrySkeletonType` for `S`;
this avoids maintaining a closed union, but fields are unchecked and must be validated before
rendering. See
[TypeScript content-model choices](../concepts/entry-personalization-and-variant-resolution.md#typescript-content-model-choices)
for the complete modeling trade-offs.

A different content type does not by itself trigger baseline fallback. The returned `entry` also
remains the baseline for a control selection (`variantIndex === 0`) and an empty variant
(`id === ''`); `isEmptyVariant: true` distinguishes the empty variant, which renders no content.
Resolution can also fall back to the baseline when no matching selection or usable variant exists,
the required links are unresolved or invalid, or the payload uses all locales. This is why the quick
start renders default content before you author a variant or before an accepted event supplies
selections.

Keep the baseline entry id separate from the resolved entry id in the DOM. `data-ctfl-baseline-id`
is an SDK-defined tracking attribute; the app code below writes it because this imperative renderer
owns the DOM update. A later route render receives that route's baseline id from app-owned route
data, so never replace it with the resolved variant id.

The app-owned `EntryPresentation` type below has two modes. `current-selections` omits explicit
selections so resolution uses the SDK's current shared selections. `baseline` passes an empty
selection set so resolution returns baseline content. The optional `isCurrent` callback lets a
router prevent the helper from writing after its asynchronous fetch when a newer route owns the
screen.

**Adapt this to your use case:** a render function that resolves one manually fetched entry and
writes it plus its tracking metadata into an element.

```ts
type EntryPresentation = 'current-selections' | 'baseline'

async function renderEntry(
  entryId: string,
  element: HTMLElement,
  presentation: EntryPresentation = 'current-selections',
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const baselineEntry = await fetchEntry(entryId) // your own fetcher from the section above
  if (!isCurrent()) return // do not commit async work after a newer route takes ownership

  // An empty selection set explicitly presents baseline after a current route failure.
  const selectedOptimizations = presentation === 'baseline' ? [] : undefined
  const { entry, isEmptyVariant, optimizationContextId, selectedOptimization } =
    optimization.resolveOptimizedEntry(baselineEntry, selectedOptimizations)

  element.textContent = isEmptyVariant ? '' : String(entry.fields.headline ?? '')

  // Keep the baseline id separate so re-renders resolve from the baseline, not the variant.
  element.dataset.ctflBaselineId = baselineEntry.sys.id
  element.dataset.ctflEntryId = entry.sys.id // the resolved id — used for interaction tracking

  // Remove metadata from the previous presentation before adding the current selection.
  delete element.dataset.ctflOptimizationContextId
  delete element.dataset.ctflOptimizationId
  delete element.dataset.ctflVariantIndex
  if (optimizationContextId) element.dataset.ctflOptimizationContextId = optimizationContextId
  if (selectedOptimization) {
    element.dataset.ctflOptimizationId = selectedOptimization.experienceId
    element.dataset.ctflVariantIndex = String(selectedOptimization.variantIndex)
  }
}
```

### Page and route events

**Integration category:** Required for first integration

A **page event** signals that a page or route was viewed. The Experience API uses page events to
evaluate route-based experiences and to return current selections, so most integrations emit one on
first load and on every route change.

1. Call `page()` after SDK initialization for a multi-page app or the first SPA route. It returns
   `{ accepted, data }`; `{ accepted: false }` means consent or an SDK guard blocked the event.
2. In SPAs, use `trackCurrentPage({ routeKey, buildPayload })` on route changes. It deduplicates
   consecutive identical route keys and returns the SDK-provided `TrackCurrentPageResult` that
   identifies why an attempt was not accepted (a manual `page()` always emits when consent permits
   it).
3. Include stable page properties — url, path, search, referrer, title — when your router or
   analytics taxonomy needs them.
4. In hybrid apps where the server already emitted the first page event, pass
   `initialPageEvent: 'skip'` to `trackCurrentPage` for the first browser route so the browser does
   not report a duplicate (see
   [Hybrid Node SSR and browser continuity](#hybrid-node-ssr-and-browser-continuity)).

**Copy this:**

```ts
const result = await optimization.page()
```

`trackCurrentPage()` returns a result discriminated by `accepted`:

- **`accepted: true`** - The SDK counts the route as accepted for consecutive-route deduplication.
  With `initialPageEvent: 'skip'`, it marks the route accepted without emitting a browser page event.
- **`data`** - When present on an accepted result, this is the Optimization response returned to
  that call, including the visitor profile and selected optimizations. Returned data belongs to the
  call; shared personalization state follows the concurrency rule below. When `data` is absent, the
  result has no response payload to read. A rejected result also has no `data`; absence never means
  the current page was queued offline.
- **`accepted: false`** - The route was not accepted by this attempt. Use `reason` to decide what
  happened:
  - **`already-accepted`** - The same consecutive route key was already accepted, so the SDK did not
    emit it again.
  - **`not-allowed`** - Consent policy or connectivity prevented the page attempt from being
    accepted. This reason does not distinguish between those causes, so check consent and browser
    connectivity separately. An offline attempt does not emit an event or enter the offline queue;
    going offline during asynchronous event processing also returns this reason. The route remains
    observed and can be attempted again.
  - **`superseded`** - A different route became current before this attempt settled, so its outcome
    cannot become the current route state.

In this guide, an **operational failure** means that `trackCurrentPage()` rejects instead of returning
a result. The example below reports that error at the router boundary so your app can handle it
according to the error and its policy.

Route tracking and route presentation are separate app responsibilities. For an accepted or
`already-accepted` route, present the route through your normal resolve-and-render path. For a
current `not-allowed` result or operational rejection, explicitly present baseline by resolving with
an empty selection set, as `renderEntry(..., 'baseline')` does above, or by bypassing optimized
rendering. For `superseded`, present nothing from that stale completion because a newer route owns
the screen.

Give the tracker the incoming route's content after your router mounts it. In this example,
`getCurrentRouteEntry()` returns the baseline entry ID from the app's route data and the newly
mounted target. Both `current-selections` and `baseline` decisions use that captured pair; do not
recover either value from the prior route's DOM. A route without an optimized entry can return
`undefined` and still emit its page event.

When that explicit baseline presentation renders Rich Text, resolve its guarded MergeTag entries with
`optimization.getMergeTagFallbackValue(target)`. Do not read `target.fields.nt_fallback` yourself or
call `getMergeTagValue()` against live profile state: the fallback helper validates the entry and
returns its configured fallback without a profile lookup or missing-profile warning. Keep
`getMergeTagValue()` for the `current-selections` presentation described in
[Merge tags and Custom Flags](#merge-tags-and-custom-flags).

**Adapt this to your use case:** an SPA route tracker with stable route keys, wired to your router.
The exhaustive switch makes a future result reason a TypeScript error until the integration handles
it. The `heroEntryId` property and `#hero` selector stand for the incoming route's app-owned content
data and mounted target; replace both with your router's equivalents. Register the route callback
after that target mounts.

```ts
import type { TrackCurrentPageResult } from '@contentful/optimization-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'

type RouteDecision = {
  routeKey: string
  outcome: 'accepted' | 'already-accepted' | 'not-allowed' | 'superseded' | 'operational-rejection'
  presentation: EntryPresentation | undefined
  callLocalSelections?: SelectedOptimizationArray
}

type CurrentRouteEntry = {
  entryId: string
  element: HTMLElement
}

const ROUTE_DECISION_PROBE = false // enable only in a local or staging build

function getCurrentRouteEntry(): CurrentRouteEntry | undefined {
  // `heroEntryId` is app-owned route data used to fetch this route's baseline entry.
  const entryId = router.currentRoute.heroEntryId
  // Read the newly mounted route target, never data written by a prior presentation.
  const element = document.querySelector<HTMLElement>('#hero')
  return entryId && element ? { entryId, element } : undefined
}

function reportRouteDecision(
  decision: RouteDecision,
  generation: number,
  presentationApplied: boolean,
  element?: HTMLElement,
): void {
  if (!ROUTE_DECISION_PROBE) return
  console.debug('Optimization route decision', {
    generation,
    routeKey: decision.routeKey,
    outcome: decision.outcome,
    presentation: decision.presentation ?? 'none',
    presentationApplied,
    callLocalSelections: decision.callLocalSelections,
    currentSharedSelections: optimization.states.selectedOptimizations.current,
    renderedText: element?.textContent,
  })
}

function getRouteKey(): string {
  return `${window.location.pathname}${window.location.search}`
}

function assertNever(value: never): never {
  throw new Error(`Unhandled trackCurrentPage reason: ${String(value)}`)
}

async function trackRoute(routeKey: string): Promise<RouteDecision> {
  let result: TrackCurrentPageResult
  try {
    result = await optimization.trackCurrentPage({
      routeKey, // stable route keys prevent duplicate SPA page events
      buildPayload: () => {
        const url = new URL(window.location.href)
        return {
          properties: {
            path: url.pathname,
            referrer: document.referrer,
            search: url.search,
            title: document.title,
            url: url.toString(),
          },
        }
      },
    })
  } catch (error: unknown) {
    console.error('Optimization current-page tracking failed', error)
    return { routeKey, outcome: 'operational-rejection', presentation: 'baseline' }
  }

  if (result.accepted) {
    return {
      routeKey,
      outcome: 'accepted',
      presentation: 'current-selections',
      callLocalSelections: result.data?.selectedOptimizations,
    }
  }

  const reason = result.reason
  switch (reason) {
    case 'already-accepted':
      return { routeKey, outcome: reason, presentation: 'current-selections' }
    case 'not-allowed':
      console.info('Optimization page tracking is not allowed; check consent and connectivity')
      return { routeKey, outcome: reason, presentation: 'baseline' }
    case 'superseded':
      return { routeKey, outcome: reason, presentation: undefined }
    default:
      return assertNever(reason)
  }
}

let activeRouteTracking: Promise<void> | undefined
let currentRouteRetry = Promise.resolve()
let routeGeneration = 0

function startRouteTracking(): Promise<void> {
  const generation = ++routeGeneration
  const routeKey = getRouteKey()
  const routeEntry = getCurrentRouteEntry()
  const isCurrent = () => generation === routeGeneration
  const attempt = trackRoute(routeKey)
    .then(async (decision) => {
      if (!decision.presentation || !routeEntry || !isCurrent()) {
        reportRouteDecision(decision, generation, false)
        return
      }

      await renderEntry(routeEntry.entryId, routeEntry.element, decision.presentation, isCurrent)
      reportRouteDecision(decision, generation, isCurrent(), routeEntry.element)
    })
    .catch((error: unknown) => {
      console.error('Optimization current-route presentation failed', error)
    })
  activeRouteTracking = attempt
  void attempt.then(() => {
    if (activeRouteTracking === attempt) activeRouteTracking = undefined
  })
  return attempt
}

function retryCurrentRoute(): void {
  currentRouteRetry = currentRouteRetry.then(async () => {
    // Do not join the same pending attempt that saw blocked policy or offline state.
    while (activeRouteTracking) await activeRouteTracking
    await startRouteTracking()
  })
}

void startRouteTracking()
router.onRouteChange(() => void startRouteTracking()) // register after each route mounts its target
window.addEventListener('online', () => retryCurrentRoute()) // register once in your app root
```

`routeGeneration` is app-owned lifecycle state. Each route attempt captures its generation, checks
it before choosing a render target, and passes the same check into `renderEntry()` so an entry fetch
cannot commit after a newer attempt starts. A stale `superseded` result returns no presentation
decision. The same guard also drops a baseline decision from an operational rejection if a newer
route starts before the router consumes it.

The `not-allowed` reason does not identify its cause. The `online` listener above independently
retries the current route when browser connectivity returns. `retryCurrentRoute()` waits for any
active attempt to settle before it starts the retry, so it does not join the same pending attempt
and receive its earlier outcome. Normal router callbacks still start immediately so a new route can
supersede older work. A consent-blocked call remains unaccepted until your app changes consent and
explicitly calls `retryCurrentRoute()`.

If the router calls `trackCurrentPage()` again with the same key while the first attempt is pending,
both calls share that attempt: the SDK builds and emits the page event once, and both callers receive
the same outcome. A different key supersedes the older attempt, so the older call resolves with
`reason: 'superseded'` if it finishes later.

A route-key change also prevents every earlier in-flight Experience call from changing the SDK's
shared personalization state. This applies to all ordinary Experience calls, including the
`page()` and `identify()` calls introduced above, not only earlier `trackCurrentPage()` calls. Those
ordinary calls can still settle with their own returned results. If the app needs an ordinary call's
response to become the SDK's shared state, await that call before starting the route transition.

Current-page emissions are online-only. An offline emission attempt remains observed and retryable,
but coming back online does not retry it automatically. Call `trackCurrentPage()` again after
reconnecting. An ordinary `page()` call remains separate from current-route tracking and can still
use the SDK's offline queue.

For advanced router adapters and diagnostics, `states.currentStateTracking` is a read-only observable
of this lifecycle. A typical route moves through `idle` (no current key), `observed` (a current key
that can be attempted or retried), `pending` (its page attempt is in progress), and `accepted` (the
current key was accepted, including a deliberate skip). A policy- or connectivity-blocked route
remains `observed` and can be attempted again. A different route key advances the numeric generation
so stale work can be ignored.

Read `.current` or subscribe as shown in
[State subscriptions, locale changes, and re-rendering](#state-subscriptions-locale-changes-and-re-rendering).
Continue to use `trackCurrentPage()` to advance the lifecycle because the observable exposes no
mutation operations. For the full observable contract and current-state mechanics, see
[Core state management](../concepts/core-state-management.md#public-observation-surface).

### Consent and privacy handoff

**Integration category:** Common but policy-dependent

Consent policy belongs to your application. The SDK tracks two independent axes: **consent** (may
personalize and send events) and **persistenceConsent** (may store the profile-id cookie). While
event consent is `undefined` or `false`, the SDK's default allow-list permits only `identify` and
`page`; other events stay blocked.

1. If policy permits personalization by default and you render no consent UI, seed accepted consent
   in `defaults` (as the quick start does).
2. If policy depends on user choice, leave `consent` unset and call `consent(true | false)` from the
   banner, consent-management platform (CMP) callback, or settings screen that owns the decision.
3. For strict opt-in, pass `allowedEventTypes: []` so no event can emit before an explicit choice.
4. Use object-form consent — `consent({ events: true, persistence: false })` — only when events are
   permitted but durable profile continuity must stay session-only. A boolean sets both axes
   together.
5. Persist the visitor's choice in your own store (a cookie, `localStorage`, or account preference)
   so your UI can restore it next visit. That consent record is **yours** — you name, write, and
   read it. The SDK does not manage it; it only reflects what you pass to `consent()`.
6. If an SPA current-route attempt was blocked, explicitly retry it after calling `consent(true)`.
   Changing consent does not replay the blocked `trackCurrentPage()` call.

**Follow this pattern:** default-on, when policy permits.

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-optimization-client-id',
  // Starts event emission and durable profile continuity immediately.
  defaults: { consent: true },
})
```

**Follow this pattern:** strict opt-in — no event emits until the visitor accepts.

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-optimization-client-id',
  // Replaces the default pre-consent allow-list of identify and page.
  allowedEventTypes: [],
})
```

**Adapt this to your use case:** a consent control wired to the SDK and to your own consent record.
For an SPA, `retryCurrentRoute()` is the serialized helper from
[Page and route events](#page-and-route-events); omit that line when the app does not track routes.

```ts
// This cookie is YOURS: your app writes and reads it. It is not an SDK cookie.
const CONSENT_COOKIE = 'app-personalization-consent'

function persistConsent(consented: boolean): void {
  document.cookie = `${CONSENT_COOKIE}=${consented ? 'granted' : 'denied'}; Path=/; SameSite=Lax`
}

document.querySelector('#consent-accept')?.addEventListener('click', () => {
  optimization.consent(true) // boolean consent updates both event and persistence consent
  persistConsent(true)
  retryCurrentRoute() // consent changes future policy; retry the blocked current route explicitly
})

document.querySelector('#consent-reject')?.addEventListener('click', () => {
  optimization.consent(false) // blocks non-allowed events and clears durable profile-continuity storage
  persistConsent(false)
})
```

The SDK stores its own consent, persistence-consent, and profile-continuity state in `localStorage`;
the one persistence value it owns and exposes as a cookie is the browser-readable profile-id cookie
`ctfl-opt-aid`. Calling `consent(false)` blocks subsequent non-allowed events and clears SDK-managed
durable storage, but it does not erase your app, server, or CMP records, and it does not drop the
active in-memory profile — call `reset()` for that (see
[Identity, profile, and reset](#identity-profile-and-reset)). For the cross-SDK policy model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### State subscriptions, locale changes, and re-rendering

**Integration category:** Common but policy-dependent

This is Milestone 2. First render is already complete and shippable; add re-rendering only when some
content must re-personalize _after_ it first resolves — for example when a visitor accepts consent,
signs in, or is identified, and entries should update without a reload. Because the Web SDK is
imperative, you get this by subscribing to state and re-running your own render, rather than a
framework doing it for you.

The SDK exposes its latest accepted profile, selected optimizations, consent state, and diagnostic
streams through `states.*`. Every observable emits its current value immediately on subscribe and
then emits later updates; read `.current` for a one-off synchronous read.

1. Subscribe to `states.selectedOptimizations` when optimized entries must re-render after `page()`,
   `identify()`, or a profile change. Re-run the same resolve-and-render you used at first paint.
2. Subscribe to `states.profile` for identity-aware UI, and `states.consent` /
   `states.persistenceConsent` when a local consent UI must reflect SDK state.
3. Subscribe to `states.eventStream` and `states.blockedEventStream` for diagnostics or approved
   analytics forwarding (see [Analytics forwarding](#analytics-forwarding)).
4. Unsubscribe when the page root, framework root, or long-lived view tears down.
5. When the app locale changes, call `setLocale(nextLocale)`, then refetch Contentful entries with
   the new CDA locale and emit a fresh `page()` or `identify()`. `setLocale` updates subsequent
   Experience API requests and event context only; it does not refetch entries or clear your caches.

**Adapt this to your use case:** subscribe once, re-render on selection changes, and clean up.

```ts
const subscriptions = [
  optimization.states.selectedOptimizations.subscribe((selectedOptimizations) => {
    if (selectedOptimizations === undefined) return
    // Re-render after page(), identify(), or a live profile change updates selections.
    void renderVisibleEntries()
  }),
  optimization.states.profile.subscribe((profile) => {
    const badge = document.querySelector('#profile-id')
    if (badge) badge.textContent = profile?.id ?? 'anonymous'
  }),
]

window.addEventListener('beforeunload', () => {
  subscriptions.forEach((subscription) => subscription.unsubscribe())
})
```

To verify, accept consent or call `identify()`, then confirm your subscribed render swaps the
affected entries to their variants without a full reload.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Interaction tracking — views, clicks, and hovers on entries — is a browser behavior. The SDK
observes any element in the DOM carrying the `data-ctfl-*` tracking attributes, and emits the
matching events once consent permits. Automatic tracking for all three interaction types is on by
default, so you rarely configure anything to get started.

1. Render `data-ctfl-entry-id` on each tracked element using the **resolved** entry id, not the
   baseline id. The [resolve-and-render helper](#resolving-entries-and-rendering-the-result) already
   writes it, alongside `data-ctfl-optimization-id`, `data-ctfl-optimization-context-id`, and
   `data-ctfl-variant-index` when the entry came from an optimization.
2. Leave the defaults on when your consent policy allows them. Use the constructor's
   `autoTrackEntryInteraction` only to opt out of an interaction type you must not observe.
3. For click tracking, use semantic clickable elements (`<button>`, `<a href>`) or mark a
   non-semantic clickable path with `data-ctfl-clickable="true"`.
4. Use `tracking.enableElement(...)` for DOM the attribute path cannot express, and `track()` for
   custom business events (quote requests, form completions, checkout milestones).
5. Page and identify events can be sent before full consent, but entry views, clicks, and hovers
   stay blocked until consent (or `allowedEventTypes`) permits them.

**Follow this pattern:** opt one detector out globally.

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-optimization-client-id',
  // Opt out of interactions your consent and analytics policy does not permit.
  autoTrackEntryInteraction: { hovers: false },
})
```

**Adapt this to your use case:** enable manual element tracking and emit a business event.

```ts
// Manual element data takes precedence over data-ctfl-* attributes on the same element.
optimization.tracking.enableElement('views', element, {
  data: {
    entryId: entry.sys.id,
    optimizationContextId,
    optimizationId: selectedOptimization?.experienceId,
    variantIndex: selectedOptimization?.variantIndex,
  },
  dwellTimeMs: 1000,
})

await optimization.track({
  event: 'quote_requested',
  properties: { plan: 'enterprise', source: 'pricing-page' },
})
```

Use `tracking.disableElement(...)` to force-disable one element, or `tracking.clearElement(...)` to
remove a manual override so recycled DOM nodes do not keep stale entry data. For thresholds,
attribute precedence, and delivery paths, see
[Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

### Identity, profile, and reset

**Integration category:** Common but policy-dependent

Identify a visitor only when your app knows who they are or has policy-approved traits to send.
Reset profile state when the active visitor changes or logs out.

1. Call `identify({ userId, traits })` after sign-in, account lookup, or persisted auth refresh when
   your consent and identity policy permits the association. `userId` is required.
2. Call `reset()` on logout, account switch, or consent withdrawal that ends profile continuity. It
   clears SDK profile state, selected optimizations, route dedupe, and the `ctfl-opt-aid` cookie —
   but not your own sessions, cookies, or CMP records; clear those separately.
3. Emit another `page()` after a reset when the app still needs browser-side optimization.

**Adapt this to your use case:** login and logout handlers wired to the SDK actions.

```ts
async function handleLogin(user: { id: string; plan: string }): Promise<void> {
  await optimization.identify({
    userId: user.id,
    traits: { authenticated: true, plan: user.plan },
  })
}

async function handleLogout(): Promise<void> {
  optimization.reset() // clears SDK profile + anonymous-id cookie, not app/CMP records
  await optimization.page() // re-establish anonymous optimization state
}
```

When persistence consent is true, the SDK can restore profile continuity from `localStorage` and the
readable `ctfl-opt-aid` cookie; when it is false or unset, it does not load durable continuity. For
cross-runtime identity behavior, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

## Optional integrations

### Web Components entry rendering

**Integration category:** Optional

The optional Web Components entrypoint provides vanilla custom elements so you can resolve and
render entries declaratively in markup instead of driving `resolveOptimizedEntry()` by hand. It is
side-effect-free until you register the elements.

1. Import and call `defineContentfulOptimizationElements()` once from
   `@contentful/optimization-web/web-components` before using the elements. It registers
   `<ctfl-optimization-root>` and `<ctfl-optimized-entry>`.
2. Use one `<ctfl-optimization-root>` for entries that share one SDK instance. The root creates the
   SDK from its attributes and assigned properties, reuses an existing
   `window.contentfulOptimization` instance automatically if one is already present, and lets you
   pass an explicit instance by assigning its `sdk` property.
3. Pass simple config as **attributes** (`client-id`, `environment`, `locale`, `live-updates`), and
   structured config as **DOM properties** (`defaults`, `api`, `trackEntryInteraction`, `sdk`,
   `onStatesReady`) — attributes are strings, so objects must be assigned as properties.
4. Give each `<ctfl-optimized-entry>` its entry one of three ways:
   - **Manual:** assign the fetched entry to the `baselineEntry` **property** (an object, so not an
     attribute). You fetch the entry yourself and the element resolves it.
   - **Managed by ID:** set the SDK-owned `entry-id` **attribute** (or the `entryId` property, plus an
     optional `entryQuery` property).
   - **Managed by slug:** set the SDK-owned `content-type` and `slug` **attributes**, optionally set
     `slug-field` when the field is not `slug`, and assign `entryQuery` as a property when needed.
     Both managed forms fetch and resolve for you. They work only when the shared SDK instance carries
     a Contentful client
     (`contentful: { client }`), so use a reused `window.contentfulOptimization` or an assigned
     `sdk` that was configured that way; a root that builds its SDK from
     `client-id`/`environment`/`locale` alone has no client to fetch through.

   Per-entry tracking overrides use the `track-views`, `track-clicks`, `track-hovers`, and
   `live-updates` attributes either way.

5. Listen for `ctfl-entry-loading`, `ctfl-entry-resolved`, and `ctfl-entry-error` on an entry
   element to render app-owned UI; the root emits `ctfl-root-ready` and `ctfl-root-error`. The
   `ctfl-entry-resolved` event still fires for an empty variant. Its `detail.resolvedData` is the
   SDK's full resolution result; when `isEmptyVariant` is `true`, clear external app-owned UI instead
   of rendering `detail.entry`.

There are two separate rendering surfaces here. The `<ctfl-optimized-entry>` host and its light-DOM
children are caller-owned: for an empty variant, the element keeps that host connected with its
tracking attributes, applies the host's native `hidden` state, and leaves the child nodes in place
so it can reveal the same nodes after a later non-empty result. UI created elsewhere by a
`ctfl-entry-resolved` listener is app-owned external UI. In the example below, `clearHero()` clears
only that external UI target; it must not remove the `<ctfl-optimized-entry>` host or its light-DOM
children. An absent `isEmptyVariant` flag renders normally.

The `data-entry-id` below is an example name you invent — the SDK does not read it. The SDK-owned
ID attribute is `entry-id` (no `data-` prefix). Keep the two distinct.

**Adapt this to your use case:** the manual path — you fetch and assign `baselineEntry`, then render
on resolve. Here `data-entry-id` is your own lookup key, not the SDK's `entry-id` attribute.
`renderHero()` and `clearHero()` are app-owned renderer functions.

```ts
import {
  type ContentfulOptimizationRootElement,
  type ContentfulOptimizedEntryElement,
  type ContentfulOptimizedEntryEventDetail,
  defineContentfulOptimizationElements,
} from '@contentful/optimization-web/web-components'

defineContentfulOptimizationElements()

const root = document.querySelector<ContentfulOptimizationRootElement>('ctfl-optimization-root')
if (root) {
  // Structured SDK options are assigned as properties, not string attributes.
  root.defaults = { consent: true }
  root.trackEntryInteraction = { hovers: false }
}

const entryElement = document.querySelector<ContentfulOptimizedEntryElement>(
  'ctfl-optimized-entry[data-entry-id]',
)
if (entryElement?.dataset.entryId) {
  // data-entry-id here is YOUR app's lookup key — an attribute you named, not the SDK's entry-id.
  const baselineEntry = await contentfulClient.getEntry(entryElement.dataset.entryId, {
    include: 10,
    locale: 'en-US',
  })

  // Assigning the structured baseline entry object triggers resolution.
  entryElement.baselineEntry = baselineEntry
  entryElement.addEventListener('ctfl-entry-resolved', (event) => {
    const { detail } = event as CustomEvent<ContentfulOptimizedEntryEventDetail>
    if (detail.resolvedData.isEmptyVariant) {
      clearHero()
      return
    }
    renderHero(detail.entry) // detail also carries selectedOptimization and snapshot
  })
}
```

**Follow this pattern:** the markup the manual script above drives. `data-entry-id` is the app's own
attribute; the script reads it to decide what to fetch.

```html
<ctfl-optimization-root client-id="your-optimization-client-id" environment="main" locale="en-US">
  <ctfl-optimized-entry data-entry-id="4ib0hsHWoSOnCVdDkizE8d"></ctfl-optimized-entry>
</ctfl-optimization-root>
```

For the managed path, the SDK instance must carry a Contentful client. Use the SDK-owned `entry-id`
attribute (no `data-` prefix), or use `content-type` and `slug`; `slug-field` defaults to `slug`.
Source-attribute changes refetch. A slug result uses the fetched entry's `sys.id` for resolution and
tracking.

**Follow this pattern:** managed markup where the SDK's `content-type` and `slug` attributes drive
the fetch.

```html
<!-- The shared SDK was constructed with contentful: { client }, so the element can fetch by slug. -->
<ctfl-optimization-root>
  <ctfl-optimized-entry content-type="page" slug="home"></ctfl-optimized-entry>
</ctfl-optimization-root>
```

The managed attributes are SDK-owned: match their exact names. The `data-entry-id` in the manual
example is a reader-invented lookup key; the app names it and reads it to drive its own fetch. Do not
treat one as the other. When no `baselineEntry` property is assigned, a complete slug source and a
non-empty `entry-id` cannot be combined. The element fetches neither and emits this exact message:

- `Optimized entry source cannot include both entryId and managedEntry.`

An assigned `baselineEntry` takes precedence over both managed sources. Slug not-found and duplicate
results use the exact errors described in [Fetching Contentful entries](#fetching-contentful-entries).

When the root owns the SDK instance, `trackEntryInteraction` defaults view, click, and hover
tracking to enabled — the same defaults as the `ContentfulOptimization` constructor. Set the
`live-updates` attribute on the root or an entry only when a rendered entry must re-resolve on later
selection changes instead of keeping its first resolved value.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags when rendered Rich Text contains Contentful MergeTag entries (a personalized
greeting, a location). Use Custom Flags when app behavior branches on a named flag rather than an
optimized entry.

1. Install a Rich Text renderer if your app does not already have one.
2. Resolve merge tags while rendering Rich Text: for each embedded entry node, guard with
   `isMergeTagEntry` (from `@contentful/optimization-web/api-schemas`) and pass the node's `target`
   to `getMergeTagValue`. Omit the profile argument to use the SDK's current profile state.
3. Keep the SDK locale aligned with the rendered Contentful locale when merge tags reference
   localized profile fields such as `location.city` or `location.country`.
4. Read Custom Flags with `getFlag(name)` for a one-off read, or subscribe to `states.flag(name)`
   when UI must re-render as the flag changes. Reading a flag emits a flag-view event when consent
   and profile state permit it, and repeated reads of the same value are deduplicated.

**Copy this:** Install the Rich Text renderer.

```sh
pnpm add @contentful/rich-text-html-renderer @contentful/rich-text-types
```

**Adapt this to your use case:** resolve merge tags while rendering Rich Text.

```ts
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES } from '@contentful/rich-text-types'
import { isMergeTagEntry } from '@contentful/optimization-web/api-schemas'

const html = documentToHtmlString(article.fields.body, {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      // Only merge-tag nodes resolve to a profile value; render others as usual.
      if (!isMergeTagEntry(node.data.target)) return ''
      // Omit the profile argument to use the SDK's current profile state.
      return optimization.getMergeTagValue(node.data.target) ?? ''
    },
  },
})
```

**Adapt this to your use case:** read and subscribe to a Custom Flag.

```ts
const NAVIGATION_FLAG = 'new-navigation'

// Flag reads and subscriptions emit flag-view events when consent and profile state permit it.
document.body.dataset.newNavigation = String(optimization.getFlag(NAVIGATION_FLAG) === true)

optimization.states.flag(NAVIGATION_FLAG).subscribe((value) => {
  document.body.dataset.newNavigation = String(value === true)
})
```

Merge tags and entry replacement use different mechanics: entry replacement swaps the whole entry
for its variant; merge tags read profile-backed values from current SDK state.

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app already sends events to a tag manager, customer-data
platform, or analytics destination. The SDK still sends its own events to Contentful; forwarding is
application-owned, and your app decides which approved Contentful context, if any, is also
forwarded.

1. Register one app-level `states.eventStream` subscription after SDK initialization.
2. Dedupe forwarded records by `messageId`. To receive only future events, read the current
   `messageId` before subscribing and skip it.
3. Forward only events and fields your governance policy approves, gated by the same consent and
   destination policy that governs the rest of your analytics stack.
4. Use `states.blockedEventStream` and destination debuggers to validate consent behavior.

**Follow this pattern:**

```ts
const forwardedMessageIds = new Set<string>()
const initialMessageId = optimization.states.eventStream.current?.messageId

const analyticsSubscription = optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (event.messageId === initialMessageId) {
    forwardedMessageIds.add(event.messageId) // skip the snapshot emitted on subscribe
    return
  }
  if (!canForwardSdkEvent(event)) return // your governance + consent allow-list

  forwardedMessageIds.add(event.messageId)
  analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})

window.addEventListener('beforeunload', () => {
  analyticsSubscription.unsubscribe()
})
```

For destination mappings, consent alignment, dedupe, and governance, see
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Preview panel

**Integration category:** Optional

The preview panel is a separate browser package for development, preview, and staging workflows —
including forcing a specific variant to verify a targeted experience. It attaches a Lit-based panel
to `document.body`, reads preview content through a Contentful Delivery API client, and talks to
your Web SDK instance through the browser preview bridge.

1. Install `@contentful/optimization-web-preview-panel` only when your app needs browser authoring
   tooling.
2. Gate the dynamic import behind an environment value so production bundles can drop preview code
   when the gate is replaced with `false` at build time.
3. Attach the panel after the SDK singleton and either a Contentful client or pre-fetched preview
   entries exist. `attachOptimizationPreviewPanel(...)` uses `window.contentfulOptimization` by
   default; pass `optimization` when your instance is not the global one.
4. Pass a CSP `nonce` when strict Content Security Policy rules require one for Lit styles.

**Copy this:** Install the preview package.

```sh
pnpm add @contentful/optimization-web-preview-panel
```

**Adapt this to your use case:** an environment-gated dynamic import and attach.

```ts
function attachPreviewPanel(): void {
  // Keep preview code behind an environment gate so production bundles can remove it.
  if (import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'true') return

  void import('@contentful/optimization-web-preview-panel')
    .then(async ({ default: attachOptimizationPreviewPanel }) => {
      await attachOptimizationPreviewPanel({
        contentful: contentfulClient,
        optimization, // omit when the panel can use window.contentfulOptimization
      })
    })
    .catch((error: unknown) => {
      console.warn('Failed to attach the Contentful Optimization preview panel.', error)
    })
}

attachPreviewPanel()
```

If your app already loads preview content through GraphQL, SSR, a loader, or a proxy, pass
`entries: { audiences, experiences }` instead of `contentful`; when `entries` is provided the panel
does not fetch through `contentful`. While the panel drawer is open, Web Components entries live-
update so preview overrides render; manual renderers still need a `states.selectedOptimizations`
subscription to react to preview overrides.

## Advanced integrations

### Hybrid Node SSR and browser continuity

**Integration category:** Advanced or production-only

Use this integration when the same app uses `@contentful/optimization-node` on the server and
`@contentful/optimization-web` in the browser, and you want the same visitor's profile to carry
across the boundary.

1. Decide whether the server or browser owns the first personalization decision for each route.
2. Share the anonymous profile identifier through the SDK's `ANONYMOUS_ID_COOKIE` value
   (`ctfl-opt-aid`) when consent permits durable profile continuity. This cookie is **SDK-owned** —
   match the exact name; do not invent your own.
3. Write the cookie from the server with `Path=/` and a same-site policy that matches your app, and
   do **not** mark it `HttpOnly` — the browser SDK must read it to keep the same profile after
   takeover.
4. Use `trackCurrentPage({ initialPageEvent: 'skip', ... })` for the first browser route when the
   server already emitted the same initial page event, so the browser does not duplicate it.
5. On consent denial or revocation, clear the shared cookie and avoid persisting a returned profile
   id. Treat server-rendered personalized HTML as personalized output for cache policy.

**Follow this pattern:** build the shared anonymous-id `Set-Cookie` on the server.

```ts
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-web/constants'

function buildAnonymousIdSetCookie(id: string | undefined): string {
  if (!id) return `${ANONYMOUS_ID_COOKIE}=; Max-Age=0; Path=/`
  // Browser code must be able to read this cookie for Web SDK continuity — no HttpOnly.
  return `${ANONYMOUS_ID_COOKIE}=${id}; Path=/; SameSite=Lax`
}
```

`ANONYMOUS_ID_COOKIE` re-exports the core constant and equals `'ctfl-opt-aid'`. For the lower-level
mechanics, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

If you hydrate a browser handoff with `hydrateOptimizationHandoff()` from
`@contentful/optimization-web/handoff`, cache safety is enforced before state is published.
Profileless `static` and `public-permutation` handoffs publish selected optimizations and Custom
Flag changes to live browser state without overwriting durable profile continuity in browser
storage. `private-request` handoffs, and profile-backed handoffs that pass cache safety, follow
normal persistence behavior when persistence consent allows.

### Strict consent, storage, and delivery controls

**Integration category:** Advanced or production-only

Configure these only after your privacy, analytics, and platform owners agree on the event posture.

1. Set `allowedEventTypes: []` when no Optimization event may emit before explicit consent. (The
   default allows `identify` and `page`.)
2. Use `cookie` (`domain`, `expires` in days — default 365) when the profile-id cookie needs a
   specific domain or lifetime.
3. Use `queuePolicy` when the default retry and offline-queue behavior for ordinary Experience
   events does not match your limits. It does not add `trackCurrentPage()` attempts to that queue;
   retry the current route explicitly after reconnecting.
4. Use `onEventBlocked` (and `states.blockedEventStream`) for diagnostics when consent or
   `allowedEventTypes` block events.

**Adapt this to your use case:**

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-optimization-client-id',
  allowedEventTypes: [], // block all Optimization events until consent is accepted
  cookie: { domain: '.example.com', expires: 180 },
  queuePolicy: { offlineMaxEvents: 100 }, // ordinary offline Experience events only
  onEventBlocked: (event) => diagnostics.logBlockedOptimizationEvent(event),
})
```

Blocked events are not replayed when consent later changes. After allowing consent, call
`retryCurrentRoute()` to attempt the current SPA route again.

## Production checks

Before release, verify these behaviors in the target deployment:

- **Credentials and runtime configuration** — the browser receives the intended Optimization client
  id, environment, Contentful space/environment/host, API base URLs, app metadata, and locale; no
  Management API token is exposed to the browser.
- **Consent behavior** — default-on integrations set `defaults: { consent: true }` only when policy
  permits; CMP-driven integrations keep consent unset until a choice exists, use
  `allowedEventTypes: []` for strict opt-in, block non-allowed events before consent, and clear
  profile continuity on withdrawal.
- **Event delivery** — `page()`, `identify()`, `track()`, entry views/clicks/hovers, and flag views
  are accepted or blocked exactly as policy expects, and `states.blockedEventStream` stays empty for
  events that should be allowed. If the app uses the SPA route tracker from
  [Page and route events](#page-and-route-events), enable and run the development-only
  route-decision probe below to exercise every SPA result. Static and multi-page integrations skip
  this probe and verify their ordinary `page()` result and event streams instead.
- **Content fallback** — missing selections, unresolved links, and all-locale CDA responses resolve
  to baseline content. Route presentation explicitly uses baseline after a current `not-allowed`
  result or operational rejection instead of leaving stale personalized content on screen.
- **Duplicate-tracking prevention** — SPA routes use stable route keys via `trackCurrentPage`,
  subscriptions register once per app root, `messageId` dedupe is applied before forwarding, the
  resolved (not baseline) entry id is used for tracking, and element tracking is not enabled twice
  for the same node.
- **Privacy and governance** — profile identifiers, traits, forwarded fields, `localStorage` usage,
  the `ctfl-opt-aid` cookie, and retention match the app's approved policy.
- **Local validation path** — compare the app against the Web SDK reference implementation. The
  following maintainer commands run from the Optimization SDK Suite monorepo root.

**Reference excerpt:**

```sh
pnpm implementation:run -- web-sdk typecheck
pnpm test:e2e:web-sdk
```

The following route-result probe applies only to an SPA that uses the `trackCurrentPage()` route
tracker from [Page and route events](#page-and-route-events). Static and multi-page integrations
skip it. For an SPA route-result check, set `ROUTE_DECISION_PROBE` to `true` in the route tracker and
filter the browser console for `Optimization route decision`. Each record separates
`callLocalSelections` from `currentSharedSelections` and shows `generation`, `routeKey`,
`presentation`, `presentationApplied`, and `renderedText`:

- Start tracking online with consent allowed to observe `accepted` with `current-selections`.
- From temporary development code in the same module, call `startRouteTracking()` again without
  changing the route key to observe `already-accepted` with `current-selections`.
- In browser developer tools, switch the network offline. From temporary development code, call
  `history.pushState({}, '', '/optimization-probe-not-allowed')` before `startRouteTracking()` so the
  attempt uses a fresh, unaccepted route key. Observe `not-allowed` with `baseline`. Restore
  connectivity and invoke `retryCurrentRoute()` without changing the URL; it retries that same
  current key. The probe reports an accepted retry and `states.currentStateTracking.current` reaches
  `status: 'accepted'`. Repeat with a different fresh key, strict opt-in, and `consent(false)` when
  consent denial also needs coverage.
- Run `runControlledRouteDecisionProbe()` below. It first observes `operational-rejection` with
  `baseline`, then pauses route A, starts route B, and releases A. The probe reports route B as
  applied and route A as `superseded` with `presentation: 'none'` and
  `presentationApplied: false`.

For this SPA-only setup, the helper restores the original URL, removes its temporary event
interceptors, and retracks the original route in a `finally` block. Run it only in development after
configuring each probe path to mount the earlier `#hero` renderer and supply `heroEntryId` to
`getCurrentRouteEntry()`. If raw `history.pushState()` does not mount routes in your app, replace
those calls with your router's development navigation helper. Its interceptors ignore every event
except the page event whose path matches the relevant probe route. Replace the probe paths if they
conflict with your app.

Invoke the module-scoped helper from temporary development code at the bottom of the same module,
then remove that call and set `ROUTE_DECISION_PROBE` back to `false` after the check.

**Follow this pattern:** temporary in-module invocation.

```ts
if (ROUTE_DECISION_PROBE) void runControlledRouteDecisionProbe()
```

**Adapt this to your use case:** one deterministic operational-rejection and supersession trigger
for the route-decision probe.

```ts
async function runControlledRouteDecisionProbe(
  rejectionPath = '/optimization-probe-rejection',
  routeAPath = '/optimization-probe-a',
  routeBPath = '/optimization-probe-b',
): Promise<void> {
  const originalUrl = window.location.href
  let rejectionInterceptorId: number | undefined
  let pauseInterceptorId: number | undefined
  let releaseRouteA: (() => void) | undefined

  try {
    rejectionInterceptorId = optimization.interceptors.event.add((event) => {
      if (event.type !== 'page' || event.properties.path !== rejectionPath) return event
      throw new Error('Development-only route rejection')
    })
    history.pushState({}, '', rejectionPath)
    await startRouteTracking()
    optimization.interceptors.event.remove(rejectionInterceptorId)
    rejectionInterceptorId = undefined

    let markRouteAPaused!: () => void
    const routeAPaused = new Promise<void>((resolve) => {
      markRouteAPaused = resolve
    })
    const routeARelease = new Promise<void>((resolve) => {
      releaseRouteA = resolve
    })
    let pauseNextRoute = true
    pauseInterceptorId = optimization.interceptors.event.add(async (event) => {
      if (event.type === 'page' && event.properties.path === routeAPath && pauseNextRoute) {
        pauseNextRoute = false
        markRouteAPaused()
        await routeARelease
      }
      return event
    })
    history.pushState({}, '', routeAPath)
    const routeA = startRouteTracking()
    await routeAPaused

    history.pushState({}, '', routeBPath)
    const routeB = startRouteTracking()
    releaseRouteA?.()
    await Promise.all([routeA, routeB])
  } finally {
    releaseRouteA?.()
    if (rejectionInterceptorId !== undefined) {
      optimization.interceptors.event.remove(rejectionInterceptorId)
    }
    if (pauseInterceptorId !== undefined) {
      optimization.interceptors.event.remove(pauseInterceptorId)
    }
    history.replaceState({}, '', originalUrl)
    await startRouteTracking()
  }
}
```

## Troubleshooting

| Symptom                                                          | Likely cause                                                                                   | Check                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Entry stays on baseline                                          | No variant applies, denied consent, unresolved Contentful links, or an all-locale payload      | Author a variant that targets you, check consent, fetch one `locale` with enough `include`                       |
| The variant never appears even though it is authored             | Your test visitor does not match the experience's audience, or no accepted `page()` ran first  | Target all visitors for a first test or force the variant with the preview panel; confirm `page()` was accepted  |
| `resolveOptimizedEntry()` always returns the baseline            | No selected optimizations yet, the entry is not optimized, links are unresolved, or all-locale | Verify the preceding `page()`/`identify()` result, CDA `include`, `locale`, and `fields.nt_experiences`/variants |
| Variant fields show a type error                                 | The first generic does not include every possible baseline and variant skeleton                | Put all supported skeletons in one union as the first generic, then narrow with `isEntryOfContentType`           |
| `ContentfulOptimization is already initialized`                  | More than one instance in the same browser runtime                                             | Reuse the module singleton, or call `destroy()` only in teardown paths                                           |
| SPA page events duplicate                                        | Route changes call `page()` directly without route-key dedupe                                  | Use `trackCurrentPage()` with a stable `routeKey`                                                                |
| The current SPA route remains untracked after reconnecting       | The offline attempt was not queued, or the reconnect retry joined the same pending attempt     | Register one browser `online` handler and serialize its retry after the active route attempt settles             |
| `track()` or interaction events behave as blocked                | Consent is unset or false, or the event type is not allow-listed                               | Inspect `states.consent.current`, `allowedEventTypes`, `onEventBlocked`, and `states.blockedEventStream`         |
| Automatic click tracking does not emit                           | The event target is not on a clickable path                                                    | Use native clickable elements or add `data-ctfl-clickable="true"` to the clickable path                          |
| Custom Flag reads do not emit flag-view events                   | Consent or profile state is missing, or the same value was already tracked                     | Verify event consent, profile state, and that the flag value actually changed                                    |
| Hybrid browser sessions start with a different anonymous profile | Server and browser do not share the same readable anonymous-id cookie                          | Verify `ctfl-opt-aid` path, same-site settings, consent state, and that the cookie is readable by browser code   |

## Reference implementations to compare against

- [Web SDK Vanilla JS reference implementation](../../implementations/web-sdk/README.md): Vanilla
  browser initialization, Web Components entry rendering, consent state, `page()`, entry resolution,
  merge tags, live updates, and automatic and manual entry interaction tracking.
- [Web SDK React Adapter reference implementation](../../implementations/web-sdk_react/README.md): A
  local React adapter built directly on `@contentful/optimization-web`, including singleton
  lifecycle, React Router page events, state subscriptions, Rich Text merge tags, entry resolution,
  and tracking metadata.
- [Web SDK Angular reference implementation](../../implementations/web-sdk_angular/README.md):
  Angular services and standalone components that use the Web SDK directly, including route events,
  consent, identify/reset, nested entries, Rich Text merge tags, Custom Flags, and interaction
  tracking.
- [Node SDK SSR + Web SDK Vanilla JS reference implementation](../../implementations/node-sdk+web-sdk/README.md):
  Hybrid server/browser continuity with shared anonymous-id cookies, consent-aware persistence, and
  browser-side Web SDK takeover.

Use the [Web SDK package README](../../packages/web/web-sdk/README.md) for package orientation, and
the generated
[Web SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web.html)
for exhaustive API signatures.
