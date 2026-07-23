# Integrating the Optimization React Web SDK in a React app

Use this guide to add Contentful personalization to a client-side React app you already have — a
single-page app built with Vite, Create React App, React Router, or a similar setup. By the end of
the quick start, one piece of content will render its personalized variant in the browser once the
SDK resolves it, without changing how your app fetches or renders content.

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

- **Milestone 1 — a personalized entry in the client render (the quick start below).** After the SDK
  resolves, a visitor sees their variant on screen. This is complete and shippable on its own.
- **Milestone 2 — live re-personalization (opt-in, later).** Content re-resolves when consent,
  identity, or profile changes, without a full reload. See [Live updates](#live-updates).

This guide uses `@contentful/optimization-react-web`, which wraps the lower-level
`@contentful/optimization-web` browser SDK in React providers, hooks, and an entry-rendering
component. You configure it by passing props to one `OptimizationRoot` component you mount once —
that root initializes the single browser runtime for the mounted React tree. Your app keeps
ownership of the Contentful client, consent policy, identity, routing, and rendering.

Because this SDK runs entirely in the browser, there is no server-rendered first paint: the SDK
becomes ready _after_ React mounts, so loading and error states are a first-class part of the
integration, not an afterthought. If your app renders on the server (Next.js), use the
[Next.js App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md) or the
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
instead; if your app is not React-based, or you want to own the browser SDK lifecycle without React
abstractions, use the [Web SDK guide](./integrating-the-web-sdk-in-a-web-app.md).

## Quick start

Most React + Contentful apps share one shape: you fetch an entry (a page, a hero, a section) and
render its fields through your own components. This quick start assumes that shape and personalizes
a single entry. In the snippets that change an existing file, lines prefixed with `+` are what you
add and the rest is a typical app for context — match the additions to your own file rather than
pasting the whole block. If your app is shaped differently, the change is the same wherever an entry
becomes a component; see
[Resolving entries and rendering the result](#resolving-entries-and-rendering-the-result).

It proves one result: **one entry renders its personalized variant in the browser once the SDK
resolves it.** Because the SDK is not ready synchronously, the entry shows a brief loading state
first, then reveals the resolved content — that is expected, not a bug. This quick start assumes
your app may personalize on startup; if personalization must wait for consent, keep this structure
and add the [Consent and privacy handoff](#consent-and-privacy-handoff) step before you ship.

1. Install the package. Add `contentful` too — a companion dependency you install alongside the SDK
   — if your app does not already have a Contentful Delivery API client.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-react-web contentful
   ```

2. Mount `OptimizationRoot` once, around every component that will use the SDK. Pass your
   Optimization project config as props. Use the same environment-variable convention your app
   already uses for browser-visible values (this example uses Vite's `import.meta.env` with a
   `PUBLIC_` prefix; adjust to your bundler).

   `defaults` is the SDK's starting browser state (consent, persistence, and similar). Inside it,
   `consent: true` tells the SDK it may personalize and send events for this visitor; the quick
   start uses always-on consent to keep the path simple — production gates this on the visitor's
   choice (see [Consent and privacy handoff](#consent-and-privacy-handoff)).

   **Adapt this to your use case:** wrap your existing app tree; replace the placeholder env-var
   names with yours. The config keys are explained in
   [How the SDK fits your app](#how-the-sdk-fits-your-app).

   ```tsx
   // src/App.tsx (or wherever your app root lives)
   +import { OptimizationRoot } from '@contentful/optimization-react-web'

    export function App() {
      return (
   +    <OptimizationRoot
   +      clientId={import.meta.env.PUBLIC_OPTIMIZATION_CLIENT_ID}
   +      environment={import.meta.env.PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
   +      locale="en-US" // the one locale you also pass to Contentful
   +      // consent: allowed to personalize and send events for this visitor.
   +      defaults={{ consent: true }}
   +    >
         <HomePage /> {/* your existing app */}
   +    </OptimizationRoot>
      )
    }
   ```

3. Fetch one Contentful entry and render it through `OptimizedEntry`. `OptimizedEntry` takes the
   entry you fetched as `baselineEntry` and calls your render prop with the resolved entry — the
   variant when one applies, or the baseline entry otherwise. While the SDK is still resolving,
   `OptimizedEntry` shows the baseline as a hidden loading target and reveals the result once
   resolution settles.

   **Adapt this to your use case:** this is your page component. Your fetch, your Contentful client,
   and your markup stay yours; the pattern to copy is the fetch-in-effect and the `OptimizedEntry`
   wrap.

   ```tsx
   // src/HomePage.tsx
   import { OptimizedEntry, useOptimizationContext } from '@contentful/optimization-react-web'
   import { createClient, type Entry } from 'contentful'
   import { useEffect, useState } from 'react'

   const contentfulClient = createClient({
     accessToken: import.meta.env.PUBLIC_CONTENTFUL_TOKEN,
     environment: import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
     space: import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID,
   })

   export function HomePage() {
     // useOptimizationContext() surfaces `error` if SDK init fails — guard on it so a failure does not render broken UI.
     const { error } = useOptimizationContext()
     const [entry, setEntry] = useState<Entry | undefined>()

     useEffect(() => {
       void contentfulClient
         .getEntry(import.meta.env.PUBLIC_HERO_ENTRY_ID, {
           include: 10, // resolve linked experience and variant entries before rendering
           locale: 'en-US', // one concrete locale — never withAllLocales / locale=*
         })
         .then(setEntry)
     }, [])

     if (error) return <p>Personalization failed to load.</p>
     if (!entry) return <p>Loading…</p>

     return (
       <OptimizedEntry baselineEntry={entry}>
         {/* Render prop hands back a base contentful `Entry`; cast to your own type. Replace
             `YourEntryType` with your own entry type, or drop the cast and use the base `Entry`. */}
         {(resolved) => <h1>{String((resolved as YourEntryType).fields.title ?? '')}</h1>}
       </OptimizedEntry>
     )
   }
   ```

4. Check that it works. In Contentful, author a variant on the entry you fetch above and attach it
   to an experience — for a first test, target **all visitors** so you match it automatically. Load
   the app: you should see a brief loading state, then the variant's text render in place of the
   baseline. If the baseline text stays on screen, work through [Troubleshooting](#troubleshooting).

You now have personalization working. **The rest of this guide is not a re-run of the quick start**
— it explains what each step did and covers what the quick start deliberately skipped: real,
consent-gated startup; the SDK readiness and loading model; your Contentful fetch requirements and
the baseline-fallback contract; page events and route tracking; interaction tracking; identity; live
updates; and production hardening. Read straight through, or jump to the section you need.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [How the SDK fits your app](#how-the-sdk-fits-your-app)
  - [SDK readiness, loading, and error states](#sdk-readiness-loading-and-error-states)
  - [Fetching Contentful entries](#fetching-contentful-entries)
  - [Resolving entries and rendering the result](#resolving-entries-and-rendering-the-result)
  - [Page events and route tracking](#page-events-and-route-tracking)
  - [Consent and privacy handoff](#consent-and-privacy-handoff)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile, and reset](#identity-profile-and-reset)
- [Optional integrations](#optional-integrations)
  - [Live updates](#live-updates)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Analytics forwarding](#analytics-forwarding)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Owning the Web SDK instance](#owning-the-web-sdk-instance)
  - [Strict consent, storage, and delivery controls](#strict-consent-storage-and-delivery-controls)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A React app** (18.3 or newer) with React and React DOM installed, and its own Contentful
  fetching already working. `contentful` is a companion dependency you install alongside the SDK if
  you do not already have a Delivery API client.
- **Contentful delivery credentials** — space ID, delivery token, and environment.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The Experience and Insights API base URLs default correctly; you only set them for mocks
  or non-default hosts (see [How the SDK fits your app](#how-the-sdk-fits-your-app)).

You do not need a setup inventory up front. Everything else — consent, page events, tracking,
identity, live updates — is introduced by the section that needs it.

> [!NOTE]
>
> The snippets use a `PUBLIC_`-prefixed `import.meta.env` convention (Vite). Use whatever mechanism
> your bundler uses to expose variables to browser code — `process.env.REACT_APP_*` for Create React
> App, `import.meta.env.VITE_*`, and so on — and keep it consistent with your other browser-visible
> Contentful variables.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

This section explains the `OptimizationRoot` you mounted in the quick start — what each prop does
and how to make startup depend on real consent.

`OptimizationRoot` is the single React entry point. It composes the `OptimizationProvider` and
`LiveUpdatesProvider` for you, creates the underlying Web SDK instance after React commits, and
destroys that instance on unmount. You configure the SDK by passing props directly to this
component, and you mount it exactly once around the subtree that uses the SDK.

The props you pass break down like this:

1. `clientId` and `environment` identify your Optimization project. Read them from browser-safe env
   variables.
2. `locale` is the one locale the SDK uses for Experience and event context. Use the same locale you
   pass to Contentful.
3. `defaults` is the browser SDK's starting state: `consent` (may personalize and send events) and
   `persistenceConsent` (may store the profile-id cookie — the anonymous identifier the SDK assigns
   each visitor to keep their variant assignments consistent across visits).
4. `api` overrides the Experience and Insights endpoints (`experienceBaseUrl`, `insightsBaseUrl`).
   Set these only for a mock, a proxy, or non-default hosts; omit them otherwise.
5. `app` is your app's name and version, sent as metadata.
6. `contentful` opts into managed entry fetching by handing the SDK your Contentful client
   (`contentful: { client, defaultQuery?, cache? }`); leave it unset to fetch entries yourself. See
   [Fetching Contentful entries](#fetching-contentful-entries).
7. `handoff` and `hydration` are for server, static, or edge handoff and browser-owned presentation
   control. `hydration` overrides the mode from `handoff.hydration`.
8. `liveUpdates`, `trackEntryInteraction`, and `onStatesReady` are optional and covered in their own
   sections below.

The quick start used always-on `defaults` to get you a result. For production, make startup depend
on real consent: leave `consent` unset (or seed it off) and call `setConsent(true)` from the UI that
owns the visitor's decision, as shown in
[Consent and privacy handoff](#consent-and-privacy-handoff).

The only import path you need to start is the package root, `@contentful/optimization-react-web`.
Other subpaths cover specific needs you reach for later:

| Import path                                                 | Use it for                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@contentful/optimization-react-web`                        | `OptimizationRoot`, `OptimizationProvider`, `OptimizedEntry`, and every hook |
| `@contentful/optimization-react-web/router/react-router`    | The React Router auto page tracker                                           |
| `@contentful/optimization-react-web/router/tanstack-router` | The TanStack Router auto page tracker                                        |
| `@contentful/optimization-react-web/router/next-pages`      | The Next.js Pages Router auto page tracker (React Web only setups)           |
| `@contentful/optimization-react-web/router/next-app`        | The Next.js App Router auto page tracker (React Web only setups)             |
| `@contentful/optimization-react-web/api-schemas`            | Type guards such as `isMergeTagEntry` and `isRichTextDocument`               |
| `@contentful/optimization-react-web/logger`                 | `createScopedLogger` for app-owned diagnostic logging                        |

**Adapt this to your use case:** the root with app metadata and API overrides, the way a real app
configures it.

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'
import type { ReactNode } from 'react'

export function AppRoot({ children }: { children: ReactNode }) {
  return (
    <OptimizationRoot
      clientId={import.meta.env.PUBLIC_OPTIMIZATION_CLIENT_ID}
      environment={import.meta.env.PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
      locale="en-US"
      app={{ name: 'my-react-app', version: '1.0.0' }}
      // Set these only for mocks or non-default hosts; both default correctly otherwise.
      api={{
        experienceBaseUrl: import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL,
        insightsBaseUrl: import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL,
      }}
      logLevel="warn"
    >
      {children}
    </OptimizationRoot>
  )
}
```

Mount `OptimizationRoot` exactly once. Mounting a second owned instance in the same browser runtime
throws `ContentfulOptimization is already initialized`. Do not nest `OptimizationProvider` inside
`OptimizationRoot`: the root already composes the provider and live-updates provider. If you need
direct provider control, use `OptimizationProvider` instead of `OptimizationRoot`; nesting an
injected provider shadows the root context, including prefetched managed entries.

### SDK readiness, loading, and error states

**Integration category:** Required for first integration

This is the concept that has no equivalent in the server-rendered guides, so it is worth stating
plainly. Because the SDK runs only in the browser, it is **not ready on the first render**. It is
created after React commits, then it asks the Experience API who the visitor is. Two consequences
follow, and both surface through hooks you already saw in the quick start:

- **Reading the SDK instance.** `useOptimizationContext()` returns `{ sdk, error }`. `sdk` is
  defined from the first render (the provider seeds a read-only snapshot so hooks never crash), and
  `error` is set only if initialization fails. Guard on `error` to render a fallback, as the quick
  start does. Use `useOptimization()` instead when a component needs the SDK instance directly and
  can assume it is present — it throws if the SDK is unavailable, so it belongs below
  `OptimizationRoot` in code that runs after mount (event handlers, effects).
- **Reading an entry's resolution state.** `OptimizedEntry` handles its own loading: while it waits
  for the Experience API outcome, it renders the baseline entry as a hidden layout target so the
  page does not jump, then reveals the resolved content when resolution settles. If resolution never
  settles, it reveals the baseline after a 5-second timeout so the UI never hangs. Pass
  `loadingFallback` to show custom loading UI during that window instead.

Your own Contentful fetch is a separate concern from SDK readiness — you can start it in an effect
on mount. The important rule is only about entry _resolution_: an entry with optimization references
stays in its loading state until the Experience request settles, which is why you see a brief
loading state before the variant appears.

1. Render an app-level fallback when `useOptimizationContext().error` is set — personalization is
   unavailable, but decide whether the rest of your app should still render.
2. Let `OptimizedEntry` own per-entry loading; add `loadingFallback` only where you want custom UI.
3. Do not block your whole app waiting for optimization state. Entries without optimization
   references render immediately after SDK initialization.

**Follow this pattern:** an app-level error fallback plus per-entry loading UI.

```tsx
import { OptimizedEntry, useOptimizationContext } from '@contentful/optimization-react-web'
import type { Entry } from 'contentful'

function Hero({ baselineEntry }: { baselineEntry: Entry }) {
  const { error } = useOptimizationContext()
  if (error) return <StaticHero entry={baselineEntry} /> // degrade to non-personalized UI

  return (
    <OptimizedEntry baselineEntry={baselineEntry} loadingFallback={() => <HeroSkeleton />}>
      {(resolved) => <StaticHero entry={resolved as YourEntryType} />}
    </OptimizedEntry>
  )
}
```

For components that need loading and readiness metadata directly — for example to disable a control
until optimizations are available — use `useOptimizedEntry()`, which returns
`{ entry, isLoading, canOptimize, selectedOptimization, … }` for one baseline entry.

### Fetching Contentful entries

**Integration category:** Required for first integration

Your app always owns the Contentful client. There are two supported ways to get a fetched entry to
the point where the SDK resolves it, and you can mix them per entry:

- **Manual (the quick start's path).** Your code calls the Contentful client itself and passes the
  result to `OptimizedEntry` as `baselineEntry`. Your fetching, caching, and response shaping stay
  entirely yours; the SDK only needs the entry to arrive in a shape it can resolve.
- **Managed (opt-in).** You hand the SDK your Contentful client once via `contentful: { client }` on
  `OptimizationRoot`, and then reference entries by id — `<OptimizedEntry entryId="…">`. The SDK
  fetches through your client's `getEntry()` and `getEntries()` methods and resolves the result.
  This trades a little control for less wiring per entry; see
  [Resolving entries and rendering the result](#resolving-entries-and-rendering-the-result) for the
  managed component variant.

If you are just starting or want full control over fetching, stay on the manual path; switch to
managed when you would rather the SDK make the `getEntry()` call than write per-component fetch
code.

Both paths obey the same fetch rules, because the SDK resolves the same single-locale entry shape
either way:

1. Fetch with one concrete Contentful locale. Do not use `withAllLocales` or raw Contentful Delivery
   API (CDA) `locale=*` — all-locale payloads use locale-keyed field maps the resolver cannot read,
   so entries fall back to baseline.
2. Use an `include` depth deep enough to resolve the whole tree — the entry, its sections, and the
   linked variant entries. `include: 10` is the common setting. In the managed path the SDK applies
   `include: 10` for you, and you can still override per call with `entryQuery`.
3. Pass the same locale to Contentful and to `OptimizationRoot` so localized Experience responses
   and rendered content line up. In the managed path the SDK falls back to the `OptimizationRoot`
   `locale` when your query does not set one.

A single-locale entry exposes its optimization fields directly, such as `fields.nt_experiences` and
`fields.nt_variants` (the `nt_` prefix is how personalization links appear on an entry).

**Copy this:** the manual fetcher from the quick start. `fetchPageEntry` is your own helper — name
it whatever fits your app.

```tsx
import { createClient } from 'contentful'

const APP_LOCALE = 'en-US'
const INCLUDE_DEPTH = 10

const contentfulClient = createClient({
  accessToken: import.meta.env.PUBLIC_CONTENTFUL_TOKEN,
  environment: import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'main',
  space: import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID,
})

export async function fetchPageEntry(entryId: string) {
  return await contentfulClient.getEntry(entryId, {
    include: INCLUDE_DEPTH, // resolve linked experience and variant entries before rendering
    locale: APP_LOCALE, // keep this aligned with the OptimizationRoot locale
  })
}
```

To use the managed path instead, pass that same client to `OptimizationRoot` and let the SDK fetch.
The `contentful` prop is SDK-owned; `client` is your app-owned Contentful client.

**Adapt this to your use case:** enable managed fetching on the root you already mount. The `+` line
is the only addition; the rest is the root from the quick start.

```tsx
 <OptimizationRoot
   clientId={import.meta.env.PUBLIC_OPTIMIZATION_CLIENT_ID}
   environment={import.meta.env.PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main'}
   locale="en-US"
   defaults={{ consent: true }}
+  // Hand the SDK your Contentful client so `<OptimizedEntry entryId>` can fetch by id.
+  // `defaultQuery` is merged into every managed getEntry() call; cache is per-instance
+  // ({ maxEntries: 100, ttlMs: 300_000 } by default, or `cache: false` to disable).
+  contentful={{ client: contentfulClient, defaultQuery: { locale: 'en-US' } }}
 >
   {/* your app */}
 </OptimizationRoot>
```

If your app changes locale at runtime, `OptimizationRoot` updates the SDK's Experience and event
locale when its `locale` prop changes. On the manual path you still refetch Contentful entries and
re-emit page events yourself; on the managed path a changed `entryId`/`entryQuery` refetches, but
you still re-emit page events yourself. For the full model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Resolving entries and rendering the result

**Integration category:** Required for first integration

Step 3 showed the wrap. This explains the two things about it that matter everywhere. The rule never
changes: **wherever a Contentful entry becomes a component, wrap it in `OptimizedEntry` and render
whatever the render prop hands back.**

- **Type of the resolved entry.** The render prop's first argument is typed as a base `contentful`
  `Entry`. If your component expects a narrower type, cast it — `resolved as YourEntryType` — which
  mirrors the reference implementation. This direct cast works for the common cases, including
  `.withoutUnresolvableLinks`-narrowed types. Only if TypeScript rejects a cast for a genuinely
  disjoint type do you need `resolved as unknown as YourEntryType`.
- **Fallback contract.** When consent is denied, no variant applies, links are unresolved, or the
  payload was all-locale, the render prop simply receives the baseline entry. Your UI never breaks;
  it falls back to default content — this is why the quick start renders correctly even before you
  author a variant.

The quick start wrapped an entry directly in a page. The other common shape is a renderer or
registry that maps a content type to a component; wrapping it there personalizes every entry it
renders. The wrap and the cast are identical.

**Adapt this to your use case:** a content-type-to-component renderer (yours may be named
differently). The `+` lines are the additions; keep your existing guards.

```tsx
// e.g. your renderer that maps a content type to a component
+import { OptimizedEntry } from '@contentful/optimization-react-web'

 export function ContentRenderer({ items }) {
   return items?.map((entry) => {
     const Component = entry ? componentFor(entry.sys.contentType.sys.id) : undefined
     if (!entry || !Component) return null // your existing guard stays
-    return <Component key={entry.sys.id} entry={entry} />
+    return (
+      <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
+        {(resolved) => <Component entry={resolved as YourEntryType} />}
+      </OptimizedEntry>
+    )
   })
 }
```

`OptimizedEntry` must render under an ancestor that handles `useOptimizationContext().error` (as the
[readiness section](#sdk-readiness-loading-and-error-states) shows). On an SDK initialization
failure it throws rather than rendering baseline, so an unguarded subtree crashes.

**The managed alternative to `baselineEntry`.** If you enabled managed fetching with
`contentful: { client }` (see [Fetching Contentful entries](#fetching-contentful-entries)), you can
pass `entryId` instead of fetching yourself. The two entry sources are mutually exclusive: an
`OptimizedEntry` takes **either** `baselineEntry` (manual — you fetched it) **or** `entryId`
(managed — the SDK fetches it), never both. With `entryId`, the SDK fetches through your client
while the component shows its loading state, then resolves and reveals exactly as the manual path
does. Two props exist only for the managed path, since only it can fail while fetching:

- `errorFallback` — what to render if the managed fetch fails. It is a node or
  `(error: Error) => ReactNode`; return `undefined` to render nothing.
- `onEntryError` — a `(error: Error) => void` callback for logging or reporting the fetch failure.

**Adapt this to your use case:** the managed variant of the same wrap. `entryQuery` is optional and
overrides the merged managed query per call.

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'

export function HomeHero() {
  return (
    <OptimizedEntry
      entryId={import.meta.env.PUBLIC_HERO_ENTRY_ID} // SDK fetches this id through your client
      entryQuery={{ locale: 'en-US' }} // optional per-call override; merged with the managed query
      loadingFallback={() => <HeroSkeleton />}
      errorFallback={(error) => <StaticHero error={error} />} // managed-fetch failure only
      onEntryError={(error) => diagnostics.logEntryFetchError(error)}
    >
      {(resolved) => <StaticHero entry={resolved as YourEntryType} />}
    </OptimizedEntry>
  )
}
```

The render prop, the cast, and the baseline-fallback contract are identical to the manual path; only
the entry source and the two managed-failure props differ.

Two more facts hold everywhere:

- **Do not double-wrap the same entry.** A nested `OptimizedEntry` that shares a baseline entry id
  with an `OptimizedEntry` above it renders nothing (it returns `null`, with a dev-only warning).
  Wrap at one level — the renderer hand-off, or the individual cards, not both. Nested wrappers with
  _different_ baseline ids are fine.
- **`OptimizedEntry` wraps content in a layout-neutral element** with `display: contents` by
  default, so it does not affect layout. Use the `as` prop when the wrapper must be a specific
  element; it accepts only `'div'` or `'span'` (default `'div'`), so it cannot be an arbitrary
  element such as `'section'`. It also accepts plain node children when the markup does not need the
  resolved entry; the wrapper still resolves metadata and emits tracking attributes.

For the resolver contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Page events and route tracking

**Integration category:** Required for first integration

A **page event** signals that a page or route was viewed. The Experience API uses page events to
evaluate route-based experiences, so most integrations emit one on first load and on every route
change. React Web ships auto page trackers for common routers; each dedupes consecutive route keys,
including React Strict Mode's double effects.

1. Mount one tracker inside `OptimizationRoot` and inside the router context it reads. Use the
   tracker that matches your router.
2. Use `pagePayload` for static fields and `getPagePayload` for fields derived from the route
   context. Router-derived payload, static `pagePayload`, and dynamic `getPagePayload` are
   deep-merged in that order; later values win on key conflicts.
3. For an app with no supported router, call `trackPageView()` from `useOptimizationActions()` in
   your own route-change effect.

| Router               | Import path                                                 | Mounting rule                                                          |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| React Router         | `@contentful/optimization-react-web/router/react-router`    | Mount under a data router that supports `useMatches()`                 |
| TanStack Router      | `@contentful/optimization-react-web/router/tanstack-router` | Mount under the TanStack router tree                                   |
| Next.js Pages Router | `@contentful/optimization-react-web/router/next-pages`      | Mount once in `pages/_app.tsx`; the adapter waits for `router.isReady` |
| Next.js App Router   | `@contentful/optimization-react-web/router/next-app`        | Mount in a `'use client'` provider under the App Router tree           |

Most React SPAs use React Router, so this guide uses `ReactRouterAutoPageTracker`. (The `next-pages`
and `next-app` trackers exist for React-Web-only Next.js setups; a full Next.js integration should
use the dedicated Next.js SDK guides instead.)

**Adapt this to your use case:** the tracker mounted once in your router root.

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

function RootLayout() {
  return (
    <OptimizationRoot clientId={import.meta.env.PUBLIC_OPTIMIZATION_CLIENT_ID}>
      {/* One tracker per router tree — more than one emits duplicate route page events. */}
      <ReactRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <RootLayout />, children: [{ index: true, element: <HomePage /> }] },
])

export function App() {
  return <RouterProvider router={router} />
}
```

To attach route-aware properties, pass `getPagePayload`:

**Follow this pattern:**

```tsx
<ReactRouterAutoPageTracker
  getPagePayload={({ context }) => ({
    properties: { appSection: context.pathname.startsWith('/account') ? 'account' : 'public' },
  })}
/>
```

The `next-pages` and `next-app` trackers also accept `initialPageEvent="skip"` for setups where a
server path already emitted the first page event. In a browser-only React SPA you emit the first
page event yourself, so leave it at the default (`"emit"`).

### Consent and privacy handoff

**Integration category:** Common but policy-dependent

Consent policy belongs to your application. The SDK tracks two independent axes: **consent** (may
personalize and send events) and **persistenceConsent** (may store the profile-id cookie). Until
consent is set, the SDK permits only `identify` and `page` events; other events stay blocked.

1. If policy permits personalization by default, seed accepted consent in `defaults` during setup
   (as the quick start does).
2. If policy depends on user choice, leave `consent` unset and call `setConsent(true | false)` from
   the banner, Consent Management Platform (CMP) callback, or settings screen that owns the
   decision.
3. Use object-form consent — `setConsent({ events: true, persistence: false })` — only when events
   and durable profile continuity have different policy decisions. A boolean sets both together.
4. Persist the visitor's choice in your own store (a cookie, `localStorage`, or account preference)
   so your UI can restore it on the next visit. That consent record is **yours** — you name, write,
   and read it. The SDK does not manage it; it only reflects what you pass to `setConsent()`.

**Adapt this to your use case:** a consent control wired to the SDK actions and to your own consent
record.

```tsx
import { useConsentState, useOptimizationActions } from '@contentful/optimization-react-web'
import { useEffect } from 'react'

// This cookie is YOURS: your app writes and reads it. It is not an SDK cookie.
const CONSENT_COOKIE = 'app-personalization-consent'

function persistConsent(consented: boolean): void {
  document.cookie = `${CONSENT_COOKIE}=${consented ? 'granted' : 'denied'}; Path=/; SameSite=Lax`
}

export function ConsentControls() {
  const consent = useConsentState() // boolean | undefined
  const { setConsent } = useOptimizationActions()

  useEffect(() => {
    if (typeof consent === 'boolean') persistConsent(consent)
  }, [consent])

  return (
    <button onClick={() => setConsent(consent !== true)} type="button">
      {consent === true ? 'Reject personalization' : 'Accept personalization'}
    </button>
  )
}
```

The SDK stores its own consent, persistence-consent, and profile-continuity state in browser
storage; the browser-readable profile-id cookie is named `ctfl-opt-aid` and is the one persistence
value the SDK owns and manages. If storage writes fail, the SDK continues with in-memory state. For
the cross-SDK policy model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Interaction tracking — views, clicks, and hovers on entries — is a browser behavior.
`OptimizedEntry` renders the tracking metadata the SDK needs, and the SDK observes interactions once
consent permits. It is on by default when you use `OptimizedEntry`, so you rarely configure anything
to get started.

1. Leave the defaults on when your consent policy allows them. Use the `trackEntryInteraction` prop
   on `OptimizationRoot` only to opt out of an interaction type you must not observe.
2. Use `OptimizedEntry` props — `clickable`, `trackViews`, `trackClicks`, `trackHovers`, and the
   duration-interval props — for per-entry control.
3. Page and identify events can be sent before full consent, but entry views, clicks, and hovers
   stay blocked until consent (or `allowedEventTypes`) permits them.

Tracking uses the _resolved_ entry id, not the baseline id.

**Follow this pattern:** opting one detector out globally, plus a per-entry override.

```tsx
<OptimizationRoot clientId={clientId} trackEntryInteraction={{ hovers: false }}>
  <OptimizedEntry baselineEntry={entry} clickable trackViews>
    {(resolved) => <HeroCard entry={resolved as YourEntryType} />}
  </OptimizedEntry>
</OptimizationRoot>
```

For DOM that automatic observation cannot reach, resolve metadata with `useOptimizedEntry()` and
call `sdk.tracking.enableElement('views', element, { data: … })` from an effect, clearing it with
`sdk.tracking.clearElement(...)` on unmount so recycled nodes do not keep stale entry data. For
detector behavior and data attributes, see
[Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

### Identity, profile, and reset

**Integration category:** Common but policy-dependent

Identify a visitor only when your app knows who they are or has policy-approved traits to send.
Reset profile state when the active visitor changes or logs out.

1. Call `identifyUser()` from the account, session, or profile event that owns the identity
   decision.
2. Render SDK state with dedicated hooks such as `useProfileState()` and
   `useSelectedOptimizationsState()`.
3. Call `resetUser()` when identity changes must clear profile, selected optimizations, and route
   dedupe state. Consent state is preserved; clear your own consent record separately if withdrawal
   also ends consent.
4. Re-emit `trackPageView()` or `identifyUser()` after a reset when the app needs fresh optimization
   state.

**Adapt this to your use case:** an account panel wired to the SDK actions.

```tsx
import {
  useOptimizationActions,
  useProfileState,
  useSelectedOptimizationsState,
} from '@contentful/optimization-react-web'

export function AccountState() {
  const { identifyUser, resetUser } = useOptimizationActions()
  const profile = useProfileState()
  const selectedOptimizations = useSelectedOptimizationsState()
  const isIdentified = Boolean(profile?.traits.identified)

  return (
    <div>
      <span>Profile: {profile?.id ?? 'anonymous'}</span>
      <span>Optimizations: {selectedOptimizations?.length ?? 0}</span>
      {isIdentified ? (
        <button onClick={() => resetUser()} type="button">
          Reset profile
        </button>
      ) : (
        <button
          onClick={() => void identifyUser({ userId: 'user-123', traits: { identified: true } })}
          type="button"
        >
          Identify
        </button>
      )}
    </div>
  )
}
```

With [live updates](#live-updates) enabled, `identifyUser()`, `setConsent()`, and `resetUser()` can
change selected variants and re-render affected entries without a reload. For cross-runtime identity
behavior, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

## Optional integrations

### Live updates

**Integration category:** Optional

This is Milestone 2. First render is already complete and shippable; add live updates only when some
content must re-personalize _after_ it first resolves — for example when a visitor accepts consent,
signs in, or is identified, and entries should update without a reload.

Live updates are opt-in because most content is fixed once resolved. You do not add a provider — the
bound `OptimizationRoot` already includes the live-updates provider internally. You only choose the
scope:

1. **App-wide default:** set `liveUpdates` on `OptimizationRoot`. Every entry without its own
   override re-resolves on state changes.
2. **Per-entry:** pass `liveUpdates` on a specific `OptimizedEntry` to opt one entry in
   (`liveUpdates`) or out (`liveUpdates={false}`), independent of the app-wide default.
3. The preview panel forces live updates while it is open, regardless of these settings.

The effective precedence is: preview panel open, then the per-entry `liveUpdates` prop, then the
root `liveUpdates` prop, then the default (locked to the first resolved state).

**Follow this pattern:** the app-wide switch plus per-entry overrides.

```tsx
// globalLiveUpdates is your own boolean (a state value or setting) — true turns live updates on app-wide.
<OptimizationRoot clientId={clientId} liveUpdates={globalLiveUpdates}>
  <OptimizedEntry baselineEntry={entry}>
    {(resolved) => <InheritsGlobalSetting entry={resolved as YourEntryType} />}
  </OptimizedEntry>

  <OptimizedEntry baselineEntry={entry} liveUpdates>
    {(resolved) => <AlwaysLive entry={resolved as YourEntryType} />}
  </OptimizedEntry>

  <OptimizedEntry baselineEntry={entry} liveUpdates={false}>
    {(resolved) => <LockedAfterFirstResolution entry={resolved as YourEntryType} />}
  </OptimizedEntry>
</OptimizationRoot>
```

To verify, enable live updates, then trigger `identifyUser()`, `setConsent()`, or `resetUser()`.
Live entries re-resolve without a full reload; entries with `liveUpdates={false}` stay put until the
next render.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags when Contentful Rich Text contains embedded profile-backed values (a personalized
greeting, a location). Use Custom Flags when app UI branches on a named flag rather than an
optimized entry.

1. Inside an `OptimizedEntry`, read `getMergeTagValue` from the render prop's second argument and
   pass it into your Rich Text renderer.
2. Use `useMergeTagResolver()` only when you resolve merge tags outside an `OptimizedEntry` render
   prop.
3. Merge tags live inside Rich Text as embedded entry nodes, so `getMergeTagValue` takes a merge-tag
   _entry node_. Guard each embedded entry with `isMergeTagEntry` (from `/api-schemas`) before
   resolving it.
4. For flags, read `optimization.getFlag(name)` for a nonreactive read, or subscribe to
   `optimization.states.flag(name)` when UI must re-render as the flag changes. Reading a flag can
   emit flag-view tracking when consent allows it.

**Follow this pattern:** resolving merge tags while rendering Rich Text.

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-web'
import { isMergeTagEntry } from '@contentful/optimization-react-web/api-schemas'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'

export function EntryWithMergeTags({ entry }: { entry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolved, { getMergeTagValue }) => {
        const options: Options = {
          renderNode: {
            [INLINES.EMBEDDED_ENTRY]: (node) => {
              const target = node.data.target
              // Only merge-tag nodes resolve to a profile value; render others as usual.
              return isMergeTagEntry(target) ? (getMergeTagValue(target) ?? '') : null
            },
          },
        }
        return documentToReactComponents(resolved.fields.body as never, options)
      }}
    </OptimizedEntry>
  )
}
```

Merge tags and entry replacement use different mechanics: entry replacement swaps the whole entry
for its variant; merge tags read profile-backed values from current SDK state. Keep the SDK locale
aligned with the rendered Contentful locale when merge tags reference localized profile fields.

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app needs to send approved Optimization context to a tag manager,
customer-data platform, or analytics destination. The SDK still sends its own events to Contentful;
forwarding is application-owned.

1. Register the subscription with the `onStatesReady` prop so it attaches before child effects (such
   as route trackers) emit events.
2. Dedupe forwarded events by `messageId`. To receive only future events, read the current
   `messageId` before subscribing and skip it.
3. Store forwarded message ids in module or app state so remounts do not forward the same event
   again.
4. Gate forwarding with the same consent and destination policy that governs the rest of your
   analytics stack.

**Follow this pattern:**

```tsx
const forwardedMessageIds = new Set<string>()

<OptimizationRoot
  clientId={clientId}
  onStatesReady={(states) => {
    // Subscribe before child effects, such as route trackers, emit events.
    const initialMessageId = states.eventStream.current?.messageId

    const subscription = states.eventStream.subscribe((event) => {
      if (!event) return
      if (forwardedMessageIds.has(event.messageId)) return
      if (event.messageId === initialMessageId) {
        forwardedMessageIds.add(event.messageId)
        return
      }
      if (!canForwardSdkEvent(event)) return // your own consent/destination filter

      forwardedMessageIds.add(event.messageId)
      // pickContentfulEventProperties is your own property mapper.
      analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
    })

    return () => subscription.unsubscribe()
  }}
>
  <ReactRouterAutoPageTracker />
  <YourApp />
</OptimizationRoot>
```

For diagnostics on events the SDK blocks by consent or `allowedEventTypes`, also subscribe to
`states.blockedEventStream`. For vendor mappings, consent boundaries, and dedupe guidance, see
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Preview panel

**Integration category:** Optional

The preview panel is a separate browser package for authoring and staging workflows — including
forcing a specific variant to verify a targeted experience. It appends a panel to `document.body`
and talks to the Web SDK through the browser preview bridge.

1. Install `@contentful/optimization-web-preview-panel`.
2. Gate the dynamic import behind an environment variable so production bundles can drop it.
3. Attach it after the SDK exists. The `onStatesReady` prop is a good attach point.
4. Pass an app-owned Contentful client, or pre-fetched preview entries, to the attach function.

**Adapt this to your use case:**

```tsx
import { createScopedLogger } from '@contentful/optimization-react-web/logger'
import { OptimizationRoot } from '@contentful/optimization-react-web'

const previewPanelLogger = createScopedLogger('PreviewPanel')

function attachPreviewPanel(): void {
  // Keep preview code behind an environment gate so production bundles can remove it.
  if (import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'true') return

  void import('@contentful/optimization-web-preview-panel')
    .then(async ({ default: attachOptimizationPreviewPanel }) => {
      // contentfulClient — your existing Contentful CDA client, imported from wherever you define it.
      await attachOptimizationPreviewPanel({ contentful: contentfulClient })
    })
    .catch((error: unknown) => {
      previewPanelLogger.warn('Failed to attach the preview panel.', error)
    })
}

export function App() {
  return (
    <OptimizationRoot clientId={clientId} onStatesReady={attachPreviewPanel}>
      <YourApp />
    </OptimizationRoot>
  )
}
```

By default the attach function uses `window.contentfulOptimization`, which the provider creates in
the browser. If your app injects its own SDK instance, pass `optimization` to the attach function.
If you already load preview definitions (through GraphQL, a loader, or a proxy), pass
`entries: { audiences, experiences }` instead of `contentful`. Verify with live updates enabled,
because the panel forces optimized entries to react to preview state.

## Advanced integrations

### Owning the Web SDK instance

**Integration category:** Advanced or production-only

Use `OptimizationProvider` directly when an application or framework adapter must create and own the
Web SDK instance outside React.

1. Create the Web SDK instance yourself with `@contentful/optimization-web`.
2. Pass it through `OptimizationProvider sdk={optimization}`.
3. Wrap children in `LiveUpdatesProvider` if any component uses `OptimizedEntry`,
   `useOptimizedEntry`, or `useLiveUpdates`. `OptimizationRoot` does this for you; when you compose
   the providers yourself, you add it explicitly.
4. Destroy the injected instance in the owner that created it — the provider does not call
   `destroy()` on instances it did not create.

Use this as an alternative to `OptimizationRoot`, not as a child of it. `OptimizationRoot` already
includes `OptimizationProvider`, and a nested provider creates a separate context for its subtree.

**Adapt this to your use case:**

```tsx
import ContentfulOptimization from '@contentful/optimization-web'
import { LiveUpdatesProvider, OptimizationProvider } from '@contentful/optimization-react-web'

const optimization = new ContentfulOptimization({ clientId: 'your-client-id', environment: 'main' })

function App() {
  return (
    <OptimizationProvider sdk={optimization}>
      <LiveUpdatesProvider>
        <YourApp />
      </LiveUpdatesProvider>
    </OptimizationProvider>
  )
}
```

The provider always renders its children — they are never withheld or unmounted. With an injected
`sdk` and no `handoff`, children render against the live injected SDK from the first render;
`onStatesReady` alone does not add a snapshot phase. When a server, static, or edge renderer passes a
content `handoff`, children render against that snapshot first and the provider hydrates the live SDK
from the same state after React commits.

Put `hydration` on the component that owns the content SDK context: `OptimizationRoot` in the normal
root path or `OptimizationProvider` in explicit provider composition. It overrides the content
presentation mode from `handoff.hydration`.

**Managed entries in a handoff.** A managed (`entryId`) `OptimizedEntry` can receive baseline
managed-entry snapshots through `handoff.entries` so the browser can preserve already-rendered
content without a client Contentful round trip. The package root also exports
`prefetchManagedEntries(runtime, descriptors)` for adapter authors; it returns a
`ManagedEntryHandoff[]` that a framework adapter can place in `handoff.entries`. `descriptors` are
`ManagedEntryDescriptor` values (`'entry-id'` or `{ entryId, entryQuery? }`); `runtime` is any
`ManagedEntryPrefetchRuntime` — an object exposing `prefetchManagedEntries(descriptors)`. Core uses
`getEntries()` for multiple uncached descriptors with the same normalized query, split into 100-ID
chunks for large fetches. The React Web SDK does not include a server runtime, so applications that
need full server-rendered request handoff usually use the
[Next.js App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md) or
[Next.js Pages Router guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md),
which own that path end to end. The `prefetchManagedEntries` prop on `OptimizationRoot` or
`OptimizationProvider` is for browser-owned cache warming after the live SDK is ready.

### Strict consent, storage, and delivery controls

**Integration category:** Advanced or production-only

Configure these only after your privacy, analytics, and platform owners agree on the event posture.

1. Set `allowedEventTypes={[]}` on `OptimizationRoot` when no Optimization event may emit before
   explicit consent. (The default allows `identify` and `page`.)
2. Use `cookie` when the profile-id cookie needs a specific domain or expiration.
3. Use `queuePolicy` when the default retry and offline-queue behavior does not match your limits.
4. Use `onEventBlocked` (and `states.blockedEventStream`) for diagnostics when consent or
   `allowedEventTypes` block events.

**Follow this pattern:**

```tsx
<OptimizationRoot
  clientId={clientId}
  allowedEventTypes={[]} // block all Optimization events until consent is accepted
  cookie={{ domain: '.example.com', expires: 180 }}
  queuePolicy={{ offlineMaxEvents: 100 }}
  onEventBlocked={(event) => diagnostics.logBlockedOptimizationEvent(event)}
>
  <YourApp />
</OptimizationRoot>
```

Blocked events are not replayed when consent later changes. If the current route, flag, or entry
state still qualifies after consent, the SDK can emit a fresh current-state event.

## Production checks

Run these checks before release:

- Confirm `clientId`, environment, `locale`, `api` endpoints, app metadata, and log level point to
  the intended environment, and that browser-exposed env variables contain only values safe to ship.
- Confirm Contentful fetches use one concrete locale with a deep enough `include`, and never pass
  `withAllLocales` / `locale=*` payloads to `OptimizedEntry` or the resolver hooks.
- Confirm default-on vs opt-in startup matches policy, `allowedEventTypes` matches the pre-consent
  posture, and revoking consent blocks non-allowed events.
- Confirm the first page event and route-change page events deliver, that one tracker is mounted per
  router tree, and that Strict Mode remounts do not duplicate them.
- Confirm baseline fallback renders when the Experience API fails, variants are missing, links are
  unresolved, or a payload is all-locale — and that `OptimizedEntry` stops showing loading after
  resolution settles or the 5-second reveal.
- If you use managed fetching (`contentful: { client }` with `<OptimizedEntry entryId>`), confirm a
  failed managed fetch renders your `errorFallback` and reaches `onEntryError`, and that the managed
  query still uses one concrete locale with a deep enough `include`.
- Confirm `identifyUser()`, `setConsent()`, and `resetUser()` re-resolve only the entries configured
  for live updates, and that reset runs when identity changes.
- Confirm entry views, clicks, hovers, flag views, page events, and forwarded analytics deliver only
  when policy permits, that forwarding dedupes by `messageId`, and that manual element tracking
  clears overrides on unmount.
- Confirm preview-panel code is environment-gated out of production bundles unless release policy
  allows it.
- Run the local validation path below.

**Copy this:**

```sh
pnpm implementation:run -- react-web-sdk typecheck
pnpm implementation:run -- react-web-sdk build
pnpm test:e2e:react-web-sdk
```

## Troubleshooting

| Symptom                                                           | Likely cause                                                                                     | Check                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Entry stays on baseline                                           | No variant applies, denied consent, unresolved Contentful links, or an all-locale payload        | Author a variant that targets you, check consent, fetch one `locale` with enough `include`             |
| The variant never appears even though it is authored              | Your test visitor does not match the experience's audience, or no page event was emitted         | Target all visitors for a first test, or force the variant with the preview panel; confirm the tracker |
| `<Component entry={resolved} />` shows a type error               | The render prop returns a base `Entry`, wider than your component's type                         | Cast it: `resolved as YourEntryType` (add `as unknown` only if TS rejects a genuinely disjoint type)   |
| Entry is stuck showing loading UI                                 | Optimization state never settled; only entries with optimization references wait                 | It reveals baseline after 5s automatically; check the Experience request and `include: 10`             |
| `<OptimizedEntry entryId>` renders the error fallback             | Managed fetch failed, or `contentful: { client }` is not configured on `OptimizationRoot`        | Confirm the root `contentful` client, the entry id, and the query; inspect the `onEntryError` error    |
| `useOptimization must be used within an OptimizationProvider`     | A hook renders outside `OptimizationRoot` / `OptimizationProvider`                               | Move the provider above that component tree                                                            |
| `ContentfulOptimization is already initialized`                   | More than one owned SDK instance in the same browser runtime                                     | Keep one `OptimizationRoot`, or inject a single shared instance via `OptimizationProvider`             |
| Route page events fire more than expected                         | More than one tracker per router tree, or manual `trackPageView()` duplicating the adapter       | Keep one adapter per router tree and centralize manual page emission                                   |
| View, click, or hover events do not emit                          | Consent not accepted, interaction opted out, entry still loading, or DOM lacks resolved metadata | Check `trackEntryInteraction`, per-entry props, consent state, and rendered `data-ctfl-*` attributes   |
| Live entries do not update after `identifyUser()` / `resetUser()` | Live updates are off (the default)                                                               | Set `liveUpdates` on `OptimizationRoot`, or pass `liveUpdates` to the `OptimizedEntry`                 |
| Preview panel does not attach                                     | Package not installed, gate is false, attach ran before the SDK existed, or no singleton exists  | Attach from `onStatesReady`, verify the gate, and pass `optimization` when using an injected instance  |

## Reference implementations to compare against

- [React Web SDK reference implementation](../../implementations/react-web-sdk/README.md): Working
  React SPA using `OptimizationRoot`, `ReactRouterAutoPageTracker`, `OptimizedEntry`, the SDK-ready
  fetch pattern, live updates, merge tags, automatic and manual entry tracking, an event-stream
  display, consent and identity controls, and environment-gated preview-panel attachment.
- [Custom React adapter over the Web SDK](../../implementations/web-sdk_react/README.md): Builds a
  custom React adapter on top of `@contentful/optimization-web` for comparison when an app needs
  full control instead of the official React Web SDK surface. </content>
