# Integrating the Optimization Next.js SDK in a Next.js Pages Router app

Use this guide to add Contentful personalization to a Next.js Pages Router site you already have. By
the end of the quick start, one piece of content will be personalized per visitor in the
server-rendered HTML — resolved in `getServerSideProps`, no flash of default content, no rewrite of
how your app fetches or renders.

**New to personalization?** Here is the whole idea in four sentences:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- When a page is requested, Contentful's **Experience API** looks at the current visitor and picks
  the variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- Your app already fetches Contentful entries and turns them into components. The SDK's only job is
  to sit at that hand-off and give you the resolved variant instead of the original — or the
  original entry when no variant applies, which is the **baseline fallback**.
- You render whatever the SDK hands back exactly as you render entries today.

That is enough to start. You do not need to understand audiences, traffic allocation, or events yet;
this guide introduces each idea at the point you need it.

You will get there in two milestones:

- **Milestone 1 — personalized first paint (the quick start below).** `getServerSideProps` resolves
  the visitor's variants on the server and hands that state to the page, so the visitor sees their
  variant in the server HTML. This is complete and shippable on its own.
- **Milestone 2 — browser takeover (opt-in, later).** After the page loads, the browser SDK takes
  ownership of personalization from the server-resolved state, so content can re-personalize live
  when consent, identity, or the **profile** changes — without a page reload. The profile is the
  anonymous id the SDK uses to keep the same visitor consistent across requests. See
  [Browser takeover and live updates](#browser-takeover-and-live-updates).

This guide uses `@contentful/optimization-nextjs`. The `/pages-router` factory gives you app-local
components for the browser, and `/pages-router/server` prepares the serializable state your pages
hand to the browser from `getServerSideProps`. Your app keeps ownership of Contentful fetching,
consent policy, identity, routing, caching, and rendering.

If your app uses the App Router, use the
[Next.js App Router guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
instead.

## Quick start

Most Pages Router + Contentful sites share one shape: `getServerSideProps` fetches the entries a
page needs, and the page component renders them through your own components. This quick start
assumes that shape. In the snippets that change an existing file, lines prefixed with `+` are what
you add and `-` lines are what you replace; the rest is a typical app for context — match the
changes to your own file rather than pasting the whole block. If your app is shaped differently, the
change is the same wherever an entry becomes a component; see
[Personalizing entries](#personalizing-entries).

It proves one result: **one entry renders its personalized variant in the server HTML.** It assumes
your app may personalize on startup. If personalization must wait for consent, keep this structure
and add the [Consent, identity, profile, and reset](#consent-identity-profile-and-reset) step before
you ship.

1. Install the adapter package.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-nextjs
   ```

2. Create one module that binds the browser components to your config. You do this once and import
   the components from it everywhere. Use the same environment-variable convention your app already
   uses for Contentful. The snippets import it as `@/lib/optimization`, which assumes the file is at
   `lib/optimization.ts` and your `tsconfig` maps `@/*` to the project root — adjust the specifier
   to match your own `paths`.

   The `defaults` below seed two consent flags: `consent` (the SDK may personalize and send events
   for this visitor) and `persistenceConsent` (the SDK may store the anonymous profile-id cookie so
   results stay consistent). The quick start turns both on; the consent section makes them depend on
   a real choice.

   **Adapt this to your use case:** replace the placeholder values and the import path; the config
   keys are explained in [How the SDK fits your app](#how-the-sdk-fits-your-app).

   ```ts
   // lib/optimization.ts
   import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

   export const APP_LOCALE = 'en-US'

   export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
     createNextjsPagesRouterOptimization({
       clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
       environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
       locale: APP_LOCALE,
       // consent: allowed to personalize and send events for this visitor.
       // persistenceConsent: allowed to store a profile-id cookie so results stay consistent.
       defaults: { consent: true, persistenceConsent: true },
       app: { name: 'my-next-pages-app', version: '1.0.0' },
     })
   ```

3. Create a server-only module that prepares the Optimization state your pages hand to the browser.
   This is where server-side resolution happens: the helper reads the visitor's cookies, asks the
   Experience API who they are, resolves their variants, and returns serializable state plus the
   `ctfl-opt-aid` cookie that keeps the same visitor consistent next request. You are only
   configuring it — not writing that logic.

   **Adapt this to your use case:** replace the placeholder values and the import path. `APP_LOCALE`
   is imported `from './optimization'` (step 2) so both the server and browser use one locale
   definition — adjust if your app stores the locale elsewhere.

   ```ts
   // lib/optimization-server.ts
   import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router/server'
   import type { GetServerSidePropsContext } from 'next'
   import { APP_LOCALE } from './optimization'

   const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
     clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
     environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
     locale: APP_LOCALE,
     app: { name: 'my-next-pages-app', version: '1.0.0' },
     // Per-request decision: may the server personalize? `true` always personalizes;
     // the consent section makes it read your recorded choice per request.
     server: { consent: true },
   })

   export function getOptimizationProps(context: GetServerSidePropsContext) {
     return getServerSideOptimizationProps(context)
   }
   ```

4. Mount the bound root and page tracker once in `pages/_app.tsx`. **Keep everything your app shell
   already renders** — `Head`, navigation, providers, styles. You are adding a wrapper, not
   replacing the file. Put the root around everything so any part of the app can be personalized
   later too.

   **Adapt this to your use case:** the `+` lines are the additions; the rest is a typical
   `pages/_app.tsx` for context.

   ```tsx
   // pages/_app.tsx
   +import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
   +// NextjsPagesRouterOptimizationPageProps: the shape of pageProps.contentfulOptimization the root reads.
   +import type { NextjsPagesRouterOptimizationPageProps } from '@contentful/optimization-nextjs/pages-router/server'
    import type { AppProps } from 'next/app'

   +interface OptimizationAppPageProps {
   +  readonly contentfulOptimization?: NextjsPagesRouterOptimizationPageProps
   +}

   -export default function App({ Component, pageProps }: AppProps) {
   +export default function App({ Component, pageProps }: AppProps<OptimizationAppPageProps>) {
   +  const optimization = pageProps.contentfulOptimization
      return (
   +    <OptimizationRoot
   +      clientDefaults={optimization?.clientDefaults}
   +      serverOptimizationState={optimization?.serverOptimizationState}
   +    >
   +      {/* "skip" when the server already reported this page view; the helper decides. */}
   +      <NextPagesAutoPageTracker initialPageEvent={optimization?.initialPageEvent} />
          <Component {...pageProps} />
   +    </OptimizationRoot>
      )
    }
   ```

5. In a personalized page's `getServerSideProps`, fetch your entries and call the helper together,
   merge the returned props, and wrap each entry in `OptimizedEntry` where the page renders it. Keep
   your fetch and your components as they are.

   The two type names from `/pages-router/server` look alike, so keep them straight:
   `NextjsPagesRouterOptimizationProps` (used here) is what you spread into your page's own returned
   props — it carries the `contentfulOptimization` field. `NextjsPagesRouterOptimizationPageProps`
   (used in step 4) is the shape of that one field, which `_app.tsx` reads from `pageProps`.

   **Adapt this to your use case:** `getPageBySlug(...)` stands in for your existing fetch — yours
   takes whatever route params it needs. The `+` lines are the additions; the merge of
   `optimization.props` and the entry wrap are the pattern to copy.

   ```tsx
   // pages/[slug].tsx
   +import { OptimizedEntry } from '@/lib/optimization'
   +import { getOptimizationProps } from '@/lib/optimization-server'
   +import type { NextjsPagesRouterOptimizationProps } from '@contentful/optimization-nextjs/pages-router/server'
    import { getPageBySlug } from '@/lib/contentful' // your existing fetch
    import type { Entry } from 'contentful'
    import type { GetServerSideProps } from 'next'

   -type PageProps = { entries: Entry[] }
   +type PageProps = NextjsPagesRouterOptimizationProps & { entries: Entry[] }

    export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
   -  const entries = await getPageBySlug(context.params?.slug)
   -  return { props: { entries } }
   +  const [entries, optimization] = await Promise.all([
   +    getPageBySlug(context.params?.slug), // your fetch, keyed by the route's params
   +    getOptimizationProps(context),
   +  ])
   +  // Spread the helper's props so pageProps.contentfulOptimization reaches pages/_app.tsx.
   +  return { props: { ...optimization.props, entries } }
    }

    export default function Page({ entries }: PageProps) {
      return entries.map((entry) => (
   -    <YourCard key={entry.sys.id} entry={entry} />
   +    <OptimizedEntry key={entry.sys.id} baselineEntry={entry}>
   +      {/* Render prop hands back a base `Entry`; cast to your own entry type. */}
   +      {(resolved) => <YourCard entry={resolved as YourEntryType} />}
   +    </OptimizedEntry>
      ))
    }
   ```

6. Check that it works. In Contentful, author a variant on an entry your page renders and attach it
   to an experience — for a first test, target **all visitors** so you match it automatically. Load
   the page, **View Source** (or disable JavaScript), and search the raw HTML for the variant's
   text. It must be present in the server HTML and stay on screen after the page hydrates. If you
   see the original content instead, work through [Troubleshooting](#troubleshooting). (This is the
   authored variant [Before you start](#before-you-start) covers in more detail.)

You now have personalization working end to end. **The rest of this guide is not a re-run of the
quick start** — it explains what each step did and covers what the quick start deliberately skipped:
real, consent-gated startup; your Contentful fetch requirements and the baseline-fallback contract;
browser takeover and live updates; interaction tracking; and production hardening. Read straight
through to understand the pieces, or jump to the section you need.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [How the SDK fits your app](#how-the-sdk-fits-your-app)
  - [Fetching Contentful entries](#fetching-contentful-entries)
  - [The getServerSideProps state handoff and the profile cookie](#the-getserversideprops-state-handoff-and-the-profile-cookie)
  - [The bound root and page events](#the-bound-root-and-page-events)
  - [Personalizing entries](#personalizing-entries)
  - [Browser takeover and live updates](#browser-takeover-and-live-updates)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Consent, identity, profile, and reset](#consent-identity-profile-and-reset)
- [Optional integrations](#optional-integrations)
  - [Analytics forwarding](#analytics-forwarding)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Mixed route strategies](#mixed-route-strategies)
  - [Manual server and client escape hatches](#manual-server-and-client-escape-hatches)
  - [Caching and request policy](#caching-and-request-policy)
  - [Strict consent and duplicate-event controls](#strict-consent-and-duplicate-event-controls)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A Next.js Pages Router app** with React and React DOM installed, and its own Contentful fetching
  already working.
- **Contentful delivery credentials** — space ID, delivery token, and environment.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant the integration still runs, but every visitor sees the baseline, so you cannot
  tell personalization from a bug. For your first test, an experience that targets all visitors is
  the easiest to verify because you match it automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The Experience and Insights API base URLs default correctly; you only set them for mocks
  or non-default hosts (see [How the SDK fits your app](#how-the-sdk-fits-your-app)).

You do not need a setup inventory up front. Everything else — the server helper, the root, entry
wrapping, consent, tracking — is introduced by the section that needs it.

> [!NOTE]
>
> This guide uses `NEXT_PUBLIC_`-prefixed environment variables because Next.js only exposes
> variables with that prefix to browser code. Use whatever prefix your app already uses for its
> other browser-visible Contentful variables, and keep it consistent.

## Core integration

### How the SDK fits your app

**Integration category:** Required for first integration

This section explains the two modules you created in the quick start — the browser binding
(`lib/optimization.ts`) and the server helper (`lib/optimization-server.ts`) — what each config key
does, and how to make startup depend on real consent.

The Next.js adapter is a thin layer between three things you already have or control: your
Contentful data, Contentful's Experience API, and your React components. Unlike the App Router, the
Pages Router split is explicit: one module binds the browser components, and a separate server-only
module prepares the state your pages pass through `pageProps`.

| Import path                                           | Use it for                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/pages-router`        | The factory returning your bound `OptimizationRoot`, `OptimizedEntry`, and page tracker |
| `@contentful/optimization-nextjs/pages-router/server` | `getServerSideOptimizationProps()` for `getServerSideProps` state handoff               |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks and providers (all Pages Router components can use these)            |
| `@contentful/optimization-nextjs/server`              | Manual server SDK control, for advanced routes only                                     |
| `@contentful/optimization-nextjs/api-schemas`         | Type guards such as `isMergeTagEntry` and `isResolvedContentfulEntry`                   |

Import from these subpaths, not the package root: `@contentful/optimization-nextjs` itself is not an
import path, so always reach for `/pages-router`, `/pages-router/server`, or `/client`.

The config you pass to the **browser** factory (`/pages-router`) breaks down like this:

1. `clientId` and `environment` identify your Optimization project. Read them from browser-safe env
   variables.
2. `locale` is the one locale the SDK uses for Experience and event context. Use the same locale you
   pass to Contentful.
3. `defaults` is the browser SDK's starting state: `consent` (may personalize and send events) and
   `persistenceConsent` (may store the profile-id cookie). For personalized pages this is overridden
   per request by the `clientDefaults` the server helper returns (see the handoff section).
4. `app` is your app's name and version, sent as metadata.
5. `api` overrides the Experience and Insights endpoints. Set it only for a mock, a proxy, or
   non-default hosts; omit it otherwise. Optional factory keys `trackEntryInteraction`,
   `liveUpdates`, and `onStatesReady` are covered in their own sections.

The **server** helper (`/pages-router/server`) takes the same project fields plus one required key,
`server.consent`, which decides per request whether the server may personalize. It accepts a boolean
or a function of the `getServerSideProps` context. The browser factory has no `server` key — server
policy lives only here.

The quick start used always-on `defaults` and `server.consent: true` to get you a result. For
production, make startup depend on real consent: seed the browser `defaults` off, and make
`server.consent` a function that reads your app's recorded choice from the request. The server
helper then derives `clientDefaults` from what you return, so the browser starts in the same consent
state.

`CONSENT_COOKIE` below is **your** cookie, not an SDK cookie — you name it, you write it (from your
consent UI or Consent Management Platform (CMP)), and you read it here. The SDK never touches it; it
only personalizes based on what your `server.consent` function returns. (The one SDK-managed cookie
is `ctfl-opt-aid`, from the
[state handoff](#the-getserversideprops-state-handoff-and-the-profile-cookie).) The
[Consent, identity, profile, and reset](#consent-identity-profile-and-reset) section shows the
browser component that writes this cookie.

**Adapt this to your use case:** the browser module from step 2 with `defaults` turned off, and the
server module from step 3 with `server.consent` reading real consent per request.

```ts
// lib/optimization.ts — browser binding
import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'

export const APP_LOCALE = 'en-US'

export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsPagesRouterOptimization({
    clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
    environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
    locale: APP_LOCALE,
    app: { name: 'my-next-pages-app', version: '1.0.0' },
    // Changed from step 2: start off. The server helper's clientDefaults win per request.
    defaults: { consent: false, persistenceConsent: false },
  })
```

```ts
// lib/optimization-server.ts — server helper
import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router/server'
import type { GetServerSidePropsContext } from 'next'
import { APP_LOCALE } from './optimization'

const CONSENT_COOKIE = 'app-personalization-consent'

const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
  environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
  locale: APP_LOCALE,
  app: { name: 'my-next-pages-app', version: '1.0.0' },
  server: {
    // Personalize only when your app has recorded consent for this visitor.
    consent: (context: GetServerSidePropsContext) =>
      context.req.cookies[CONSENT_COOKIE] === 'granted'
        ? { events: true, persistence: true }
        : false,
  },
})

export function getOptimizationProps(context: GetServerSidePropsContext) {
  return getServerSideOptimizationProps(context)
}
```

Create each of these modules exactly once. Sharing one browser binding keeps every `OptimizedEntry`
under one SDK instance; sharing one server helper keeps the anonymous-id and consent policy
consistent across routes.

### Fetching Contentful entries

**Integration category:** Required for first integration

Your app owns the Contentful client. There are two supported ways to get a fetched entry to the
SDK's resolution hand-off, and this guide teaches the first:

- **Manual (the quick-start default):** you fetch the entry yourself and pass it in as
  `baselineEntry`. You keep your existing client, fetchers, caching, and rendering; the SDK only
  needs entries to arrive in a shape it can resolve.
- **Managed (opt-in, server-side):** you configure the server factory with `contentful: { client }`
  and let the SDK fetch entries by ID for you during server prefetch, then hand the results to the
  browser. See the managed note under [Personalizing entries](#personalizing-entries).

Either way the SDK sits at the same hand-off and returns the resolved variant — or the baseline
entry when none applies. The fetch rules below apply to both paths.

1. Fetch with one concrete Contentful locale. Do not use `withAllLocales` or raw Contentful Delivery
   API (CDA) `locale=*` — all-locale payloads use locale-keyed field maps the resolver cannot read,
   so entries fall back to baseline.
2. Use an `include` depth deep enough to resolve the whole tree — the page, its sections, and the
   linked variant entries. `include: 10` is the common setting and is what most section-composed
   sites already use.
3. If you use `.withoutUnresolvableLinks` (common for deeply-linked pages), keep it; it does not
   interfere with variant resolution as long as the variant entries are published and within your
   include depth.
4. Use the same locale for Contentful and for the SDK when localized Experience responses and
   rendered content must line up.

Your existing fetch usually needs **no change** — most section-composed sites already fetch a page
by slug with a generous include depth and a single locale. A single-locale entry exposes its
optimization fields directly, such as `fields.nt_experiences` and `fields.nt_variants` (the `nt_`
prefix is how personalization links appear on an entry).

For the resolver contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### The getServerSideProps state handoff and the profile cookie

**Integration category:** Required for first integration

This explains the server helper you configured in step 3 and called in step 5. There is no
middleware or proxy in the Pages Router integration — all server work happens inside
`getServerSideProps` when you call `getServerSideOptimizationProps(context)`. On each request it:

1. Builds request context from the Pages Router `context` (cookies, headers, URL).
2. Reads the visitor's `ctfl-opt-aid` cookie, asks the Experience API who they are, and resolves
   their variants.
3. Writes or clears the `ctfl-opt-aid` cookie on the response (via `Set-Cookie`) when persistence
   consent allows, so the same visitor stays consistent on later requests.
4. Returns a serializable `props.contentfulOptimization` object with three fields.

The returned `props.contentfulOptimization` carries exactly what `pages/_app.tsx` needs:

| Field                     | What it is                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `serverOptimizationState` | The resolved decisions the browser hydrates so first paint matches the server       |
| `clientDefaults`          | The consent state the server used, so the browser SDK starts in the same state      |
| `initialPageEvent`        | `'skip'` when the server already reported a consented page view, otherwise `'emit'` |

Two things you control here:

1. **Consent policy** lives in `server.consent` (from the previous section). Return `false` to fall
   back to baseline for that request. The `server.consent` resolver receives the
   `GetServerSidePropsContext`, so you read cookies with `context.req.cookies[NAME]` — not the App
   Router's `cookies.get(NAME)`.
2. **Merging the props.** Spread `optimization.props` into your page's returned `props` (step 5) so
   `pageProps.contentfulOptimization` reaches `pages/_app.tsx`. If you forget the spread, the root
   gets no server state and every entry renders baseline.

**Handle Experience API failure yourself.** The render-layer fallbacks — no variant, denied consent,
unresolved links, all-locale payloads — are automatic: `OptimizedEntry` receives the baseline entry
and your UI is fine. A failed Experience API call is different. `getServerSideOptimizationProps`
awaits the Experience request with no internal `try/catch`, so if the API is unavailable it
**throws**, which rejects your `getServerSideProps` promise and serves Next.js's 500 page instead of
baseline content. If you want baseline HTML when the API is down, catch it and return your page's
props without `contentfulOptimization`. The root then gets no server state, so every
`OptimizedEntry` renders its baseline.

**Adapt this to your use case:** wrap the helper call so an Experience outage degrades to baseline
instead of a 500. The catch branch omits `contentfulOptimization`, so make it optional on your
page-props type (`Partial<NextjsPagesRouterOptimizationProps>`) for both branches to type-check.

```tsx
type PageProps = Partial<NextjsPagesRouterOptimizationProps> & { entries: Entry[] }

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  const entries = await getPageBySlug(context.params?.slug) // your fetch, keyed by route params
  try {
    const optimization = await getOptimizationProps(context)
    return { props: { ...optimization.props, entries } }
  } catch {
    // Experience API unavailable: render baseline. No contentfulOptimization ⇒ no server state ⇒
    // every OptimizedEntry falls back to its baselineEntry, and _app.tsx reads undefined.
    return { props: { entries } }
  }
}
```

One cookie constraint matters: `ctfl-opt-aid` is written without `HttpOnly` on purpose — the browser
SDK must read it to keep the same profile after takeover. It is the SDK's cookie; match the name
only if you read it directly. For how server and browser stay on the same profile, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

### The bound root and page events

**Integration category:** Required for first integration

Step 4 mounted the root and tracker in `pages/_app.tsx`. Here is what they do and the one decision
you have to get right. `OptimizationRoot` applies the server's decisions (`serverOptimizationState`)
and starting consent (`clientDefaults`) before its children render, then carries personalization
state through your tree. `NextPagesAutoPageTracker` reports **page events** — a signal that a page
was viewed — as the visitor navigates between Pages Router routes.

Two rules and one decision:

1. Configure behavior (`defaults`, `trackEntryInteraction`, `onStatesReady`, `liveUpdates`) in the
   browser factory, not as per-render props on the root. The root only takes the request-specific
   `clientDefaults` and `serverOptimizationState`.
2. Unlike the App Router tracker, `NextPagesAutoPageTracker` reads the Pages Router `useRouter`, not
   `useSearchParams`, so it does **not** need a `Suspense` boundary. Mount it directly under the
   root.
3. **The decision: who owns the first page event.** When the server personalized the page it already
   reported that view, so the helper returns `initialPageEvent: 'skip'` to stop the browser
   reporting a duplicate. Pass that value straight through, as in step 4. On a page with no server
   helper, `pageProps.contentfulOptimization` is `undefined`, so `initialPageEvent` is `undefined`
   and the tracker emits — which is correct for a browser-owned route.

`getPagePayload` lets you attach route-specific properties to each page event — for example,
grouping routes by section for analytics filtering. It receives an emission context whose route
fields (`pathname`, `asPath`, `query`, `router`) are nested under `context`, and returns properties
merged into that page event. Destructure the route fields from `context`, not the top level.

**Adapt this to your use case:** attaching route-aware properties to page events. `routeGroup` is an
arbitrary property name you choose.

```tsx
<NextPagesAutoPageTracker
  initialPageEvent={optimization?.initialPageEvent}
  getPagePayload={({ context: { pathname } }) => ({
    properties: { routeGroup: pathname.startsWith('/account') ? 'account' : 'public' },
  })}
/>
```

The tracker deduplicates consecutive route keys, including React Strict Mode's double effects, but
it does not replace your page-event policy. Let the helper choose `skip` only when there is a
matching server page event.

### Personalizing entries

**Integration category:** Required for first integration

Step 5 showed the wrap. This explains the two things about it that matter everywhere, then covers a
second app shape.

`OptimizedEntry` resolves the entry against the request's decisions and renders the variant — or the
baseline entry — through your render prop. Because the root hydrated `serverOptimizationState`
before children rendered, the variant is already in the server HTML; no JavaScript is required for
the visitor to see personalized content. The rule never changes: **wherever a Contentful entry
becomes a component, wrap it and render whatever the render prop hands back.** Three facts hold
everywhere:

- **Type of the resolved entry.** The render prop's first argument is typed as a base `contentful`
  `Entry`. If your component expects a narrower type, cast it — `resolved as YourEntryType` — which
  mirrors the reference implementation. This direct cast works for the common cases, including
  `.withoutUnresolvableLinks`-narrowed types. Only if TypeScript rejects a cast for a genuinely
  disjoint type do you need `resolved as unknown as YourEntryType`.
- **Fallback contract.** When consent is denied, no variant applies, links are unresolved, or the
  payload was all-locale, the render prop simply receives the baseline entry. Your UI never breaks;
  it falls back to default content — this is why the quick start works even before you author a
  variant.
- **Do not double-wrap the same entry.** A nested `OptimizedEntry` that shares a baseline entry id
  with an `OptimizedEntry` above it renders nothing (it returns `null`, with a dev-only warning).
  Wrap at one level — the renderer hand-off, or the individual cards, not both.

The quick-start example wrapped entries directly in the page. The other common shape is a renderer
or registry that maps a content type to a component; wrap it there and every entry it renders is
personalized — the wrap and the cast are identical:

**Adapt this to your use case:** a content-type-to-component renderer. The `+` lines are the
additions; keep your existing guards.

```tsx
// e.g. your renderer that maps a content type to a component (yours may be named differently)
+import { OptimizedEntry } from '@/lib/optimization'

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

#### Letting the server fetch by ID (managed)

If you would rather the SDK fetch an entry for you than fetch it yourself, give the **server**
helper a Contentful client and prefetch entries by ID. This is a server-side path: on the Pages
Router the browser factory does not carry a Contentful client, so the browser never fetches by ID on
its own — the server prefetches during `getServerSideProps` and hands the results to the browser
through the same `pageProps`.

Three changes wire it up, and all three are required — skip the third and the entry never finds its
prefetched baseline, so it silently renders nothing:

1. Add `contentful: { client }` to the server factory config from step 3 so the SDK can call
   `getEntry()` on your client.
2. Pass `prefetchOptimizedEntries` — a list of `{ entryId, entryQuery? }` descriptors, where
   `entryQuery` is optional `getEntry()` query params such as `include` depth — as the second
   argument to `getServerSideOptimizationProps`. The helper fetches and resolves those entries
   during `getServerSideProps` and adds them to the state it returns.
3. Pass that state to the bound `OptimizationRoot` in `_app.tsx` as `serverOptimizedEntries`, so a
   bound `<OptimizedEntry entryId="...">` hydrates from the server-prefetched baseline with no
   client fetch.

`client` and `entryId` are your values; `contentful`, `prefetchOptimizedEntries`, and
`serverOptimizedEntries` are the SDK-defined keys.

Apply them in that order — the root prop must exist before a page wraps an entry by id, or the page
renders nothing. First, the server helper: this replaces the `lib/optimization-server.ts` from step
3 (it is the same module, with a Contentful client added and the prefetch list forwarded), not a
second module alongside it.

**Adapt this to your use case:** the step-3 server helper with a Contentful client attached and a
prefetch list forwarded. `getYourContentfulClient()` and the entry ID are yours.

```ts
// lib/optimization-server.ts — server helper, managed variant
import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router/server'
import type { GetServerSidePropsContext } from 'next'
import { APP_LOCALE } from './optimization'
import { getYourContentfulClient } from './contentful' // your existing client

const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
  clientId: process.env.NEXT_PUBLIC_OPTIMIZATION_CLIENT_ID ?? '',
  environment: process.env.NEXT_PUBLIC_OPTIMIZATION_ENVIRONMENT ?? 'main',
  locale: APP_LOCALE,
  app: { name: 'my-next-pages-app', version: '1.0.0' },
  server: { consent: true },
  // Managed fetching: the SDK calls getEntry() on your client during server prefetch.
  contentful: { client: getYourContentfulClient() },
})

export function getOptimizationProps(context: GetServerSidePropsContext) {
  return getServerSideOptimizationProps(context, {
    // Fetched and resolved on the server; handed to the browser as serverOptimizedEntries.
    prefetchOptimizedEntries: [{ entryId: 'your-entry-id' }],
  })
}
```

Next, forward the prefetched entries from `_app.tsx` by passing one more prop on the
`OptimizationRoot` from step 4 — the state field the helper populated alongside
`serverOptimizationState`:

**Adapt this to your use case:** the one added prop on the `OptimizationRoot` from step 4.

```tsx
 <OptimizationRoot
   clientDefaults={optimization?.clientDefaults}
   serverOptimizationState={optimization?.serverOptimizationState}
+  serverOptimizedEntries={optimization?.serverOptimizedEntries}
 >
```

Finally, the page wraps the entry by id instead of passing a `baselineEntry` — the entry is already
in the server-handed state, so no client fetch happens:

**Follow this pattern:** a managed entry, wrapped by id.

```tsx
<OptimizedEntry entryId="your-entry-id">
  {(resolved) => <YourCard entry={resolved as YourEntryType} />}
</OptimizedEntry>
```

The manual `baselineEntry` path stays the default for this guide: it keeps your fetch and caching in
your own code. Reach for the managed path only when letting the SDK fetch by ID is simpler than
threading an entry through your props.

### Browser takeover and live updates

**Integration category:** Common but policy-dependent

This is Milestone 2. First paint is already complete and shippable; add this only when some content
must re-personalize _after_ the page loads — for example, when a visitor accepts consent, signs in,
or is identified, and entries should update without a reload.

Live updates are opt-in because most content is fixed for the life of a request. The bound
`OptimizationRoot` already renders a live-updates provider internally, so you do not mount one to
get started — you choose the scope:

1. **App-wide, static default:** set `liveUpdates: true` in the browser factory config
   (`createNextjsPagesRouterOptimization`). The bound root passes it to its internal provider, so
   every live-capable entry re-resolves on state changes for the life of the app. Use this when live
   updates are simply always on.
2. **App-wide, runtime-toggled:** when the default must change at runtime — a consent-driven or
   author-driven switch — wrap the root's children in your own `LiveUpdatesProvider` from `/client`
   and drive its `globalLiveUpdates` prop from your own state. A nested provider overrides the bound
   root's internal default, so this is how you turn live updates on and off without a reload. This
   is the pattern the reference implementation uses (its `GlobalLiveUpdatesProvider` wraps
   `LiveUpdatesProvider`).
3. **Per-entry:** pass `liveUpdates` to the app-local `OptimizedEntry`. A per-entry value overrides
   the app-wide setting, so you can opt one entry in (`liveUpdates`) or out (`liveUpdates={false}`)
   independently. Unlike the App Router, the Pages Router `OptimizedEntry` accepts `liveUpdates`
   directly — you do not need a separate `/client` import for it.
4. Use `/client` hooks such as `useOptimizedEntry()` only when you need rendering control the
   wrapper does not offer.

**Follow this pattern:** the app-wide static switch, in the browser factory from step 2 of the quick
start.

```ts
createNextjsPagesRouterOptimization({
  // ...clientId, environment, locale, defaults, app
  liveUpdates: true, // every live-capable entry re-resolves on browser state changes
})
```

**Adapt this to your use case:** a runtime toggle. Nest a `LiveUpdatesProvider` from `/client`
inside the `OptimizationRoot` you mounted in step 4 and feed `globalLiveUpdates` from your own state
(consent, an author switch, a feature flag), so live updates can flip on and off without a reload.
The `+` lines are the additions to the `pages/_app.tsx` from step 4.

```tsx
 // pages/_app.tsx
+import { LiveUpdatesProvider } from '@contentful/optimization-nextjs/client'
 // ...your other imports, including the bound root and tracker from step 4

 export default function App({ Component, pageProps }: AppProps<OptimizationAppPageProps>) {
   const optimization = pageProps.contentfulOptimization
+  const [liveUpdates, setLiveUpdates] = useState(false) // your own toggle / consent state
   return (
     <OptimizationRoot
       clientDefaults={optimization?.clientDefaults}
       serverOptimizationState={optimization?.serverOptimizationState}
     >
+      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>
         <NextPagesAutoPageTracker initialPageEvent={optimization?.initialPageEvent} />
         <Component {...pageProps} />
+      </LiveUpdatesProvider>
     </OptimizationRoot>
   )
 }
```

**Adapt this to your use case:** a single entry that re-resolves on profile changes, without turning
on the app-wide default. In the Pages Router every component is client-rendered after SSR, so no
directive is needed — but this entry only takes over once the browser SDK is running.

```tsx
import { OptimizedEntry } from '@/lib/optimization'
import type { Entry } from 'contentful'

export function LiveEntry({ baselineEntry }: { baselineEntry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry} liveUpdates>
      {(resolved) => <article>{String(resolved.fields.title ?? '')}</article>}
    </OptimizedEntry>
  )
}
```

For entries the browser owns, `OptimizedEntry` also accepts a `loadingFallback` prop (a node or a
function returning one) for the brief window before optimization state resolves. It is rarely needed
on server-first pages, which already have the resolved baseline in the HTML; the default is to
render the baseline while loading.

To verify takeover, enable live updates, then trigger `identifyUser()`, `setConsent()`, or
`resetUser()` from a browser component (see the next sections). Confirm that live entries re-resolve
without a full reload and that entries with `liveUpdates={false}` stay put until the next render.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Interaction tracking — views, clicks, and hovers on entries — is a browser behavior.
`OptimizedEntry` renders the metadata the browser SDK needs, and the SDK observes interactions once
consent permits. It is on by default when you use `OptimizedEntry`, so you rarely configure anything
to get started.

1. Leave the defaults on when your consent policy allows them. Use the factory
   `trackEntryInteraction` option only to opt out of an interaction type you must not observe.
2. Use `OptimizedEntry` props such as `clickable`, `trackViews`, `trackClicks`, `trackHovers`,
   `viewDurationUpdateIntervalMs`, and `hoverDurationUpdateIntervalMs` for per-entry control.
3. Page events can be allowed before full consent, but entry views, clicks, and hovers stay blocked
   until consent or `allowedEventTypes` permits them.

**Follow this pattern:** opting out of one detector globally.

```tsx
createNextjsPagesRouterOptimization({
  // ...clientId, environment, locale, defaults, app
  trackEntryInteraction: { hovers: false }, // opt out only where policy requires it
})
```

For app-owned manual observation, `useOptimization()` from `/client` exposes the SDK; call
`sdk.trackView({ ... })` from your own component. Tracking uses the _resolved_ entry id, not the
baseline id. For mechanics, see
[Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

### Consent, identity, profile, and reset

**Integration category:** Common but policy-dependent

Consent, identity, and profile continuity are your application's decisions. The SDK gives you the
runtime controls; your app owns the consent record, the privacy notice, the CMP, the identity
source, and cookie cleanup.

1. If policy permits accepted startup, return accepted `server.consent` and seed accepted browser
   `defaults`.
2. If policy depends on user choice, read the choice in `server.consent`
   (`context.req.cookies[...]`) and call `setConsent()` from the browser component that owns the
   decision.
3. Store the decision where the next request's `server.consent` can read it — the same CMP, account
   preference, or cookie. Because `server.consent` reads `context.req.cookies`, a cookie is the
   simplest store.
4. Call `identifyUser()` when a visitor becomes known, and `resetUser()` (plus clearing your own
   profile cookies) on sign-out or withdrawal.

**Adapt this to your use case:** a control panel wired to the SDK actions. The hooks come from
`/client`; the consent cookie is app-owned and matches the name your `server.consent` reads.
`useConsentState()` returns the SDK's current consent as a reactive value, so the `useEffect` below
re-runs whenever it changes.

```tsx
import {
  useConsentState,
  useOptimizationActions,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

const CONSENT_COOKIE = 'app-personalization-consent'

function persistConsent(consented: boolean): void {
  // Store where server.consent can read it on the next request.
  document.cookie = `${CONSENT_COOKIE}=${consented ? 'granted' : 'denied'}; Path=/; SameSite=Lax`
}

export function PersonalizationControls() {
  const { setConsent, identifyUser, resetUser } = useOptimizationActions()
  const consent = useConsentState()
  const profile = useProfileState()
  const isIdentified = Boolean(profile?.traits.identified)

  useEffect(() => {
    // Mirror consent changes to the cookie so server.consent reads them on the next request —
    // without this, server and browser consent state diverge.
    if (typeof consent === 'boolean') persistConsent(consent)
  }, [consent])

  return (
    <div>
      <button onClick={() => setConsent(consent !== true)} type="button">
        {consent === true ? 'Reject consent' : 'Accept consent'}
      </button>
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

With live updates enabled, `identifyUser()`, `setConsent()`, and `resetUser()` can change the
selected variants in the browser and re-render affected entries without a reload. For consent
design, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

## Optional integrations

### Analytics forwarding

**Integration category:** Optional

Use analytics forwarding when your app needs to send approved Optimization context to a tag manager,
customer-data platform, warehouse, or analytics destination. The SDK still sends its own events to
Contentful; forwarding is application-owned.

1. Register browser subscriptions with the factory `onStatesReady` option so observers attach before
   child effects such as the route tracker emit events.
2. Dedupe forwarded events by `messageId` or a destination-specific key.
3. Store forwarded message ids in module or app state so remounts do not forward the same event
   again. To receive only future events, read the current `messageId` before subscribing and skip
   it.
4. Gate forwarding with the same consent and destination policy that governs the rest of your
   analytics stack.

**Adapt this to your use case:**

```tsx
const forwardedMessageIds = new Set<string>()

export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsPagesRouterOptimization({
    // ...clientId, environment, locale, defaults, app
    onStatesReady: (states) => {
      // Subscribe before child effects, such as the route tracker, emit events.
      const initialMessageId = states.eventStream.current?.messageId

      const eventSubscription = states.eventStream.subscribe((event) => {
        if (!event) return
        if (forwardedMessageIds.has(event.messageId)) return
        if (event.messageId === initialMessageId) {
          forwardedMessageIds.add(event.messageId)
          return
        }
        if (!canForwardSdkEvent(event)) return

        forwardedMessageIds.add(event.messageId)
        analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
      })

      const blockedSubscription = states.blockedEventStream.subscribe((blockedEvent) => {
        if (blockedEvent) diagnostics.recordBlockedOptimizationEvent(blockedEvent)
      })

      return () => {
        eventSubscription.unsubscribe()
        blockedSubscription.unsubscribe()
      }
    },
  })
```

`forwardedMessageIds` is intentionally module-scoped, not created inside `onStatesReady`: it lives
for the lifetime of the app so a component remount that re-runs the subscription still skips ids it
already forwarded. If your destination has its own idempotency key you can drop the Set and dedupe
there instead.

See
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local server mapping, subscription helpers, vendor examples, consent, dedupe, and
governance guidance.

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags and Custom Flags when entries or components render profile-backed values that are not
entry replacements.

1. Resolve Rich Text merge tag entries with the `getMergeTagValue` function passed to the
   `OptimizedEntry` render prop's second argument.
2. Keep the SDK locale aligned with the rendered Contentful locale when merge tags reference
   localized profile fields such as `location.city` or `location.country`.
3. Use flag state from the browser SDK for components that must react after browser startup.
4. Treat flag-view and merge-tag events as consent-gated browser activity unless the server path
   owns the event.

Merge tags live inside Rich Text as embedded entry nodes, so `getMergeTagValue` takes a merge-tag
_entry node_ — not a plain field. You resolve them while rendering the Rich Text document: for each
embedded entry, guard with `isMergeTagEntry` (from `/api-schemas`) and pass the node's `target` to
`getMergeTagValue`.

**Follow this pattern:**

```tsx
import { OptimizedEntry } from '@/lib/optimization'
import { isMergeTagEntry } from '@contentful/optimization-nextjs/api-schemas'
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

Merge tags and entry replacement use different mechanics. Entry replacement swaps the whole entry
for its variant; merge tags read profile-backed values from current SDK state. Use
`useMergeTagResolver()` from `/client` only in browser components that need merge tags outside an
`OptimizedEntry` render prop.

### Preview panel

**Integration category:** Optional

Use the preview panel where authors or engineers need to inspect variant behavior — including
forcing a specific variant to verify a targeted experience. Keep production loading explicit and
gate attachment behind an application-owned flag.

1. Add the preview panel package only when your app needs browser authoring tooling.
2. Attach the panel from a component mounted under `OptimizationRoot`.
3. Wait until the browser SDK is ready before attaching.
4. Pass an app-owned Contentful client or pre-fetched preview entries to the attach function.
5. Enable it only when an approved environment sets your own
   `NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` flag to `true`. This is an app-owned env var you
   name, not an SDK value.
6. Verify with live updates, because the preview panel forces optimized entries to react to preview
   state.

**Follow this pattern:**

```tsx
import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

export function PreviewPanelAttachment({ nonce }: { nonce?: string }) {
  // The context exposes the SDK instance; it is undefined until the browser SDK is ready.
  const { sdk } = useOptimizationContext()
  const enabled = process.env.NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

  useEffect(() => {
    if (!enabled || sdk === undefined) return // opt-in, and only after the SDK is ready

    void Promise.all([
      import('@contentful/optimization-web-preview-panel'),
      import('@/lib/contentful'), // your Contentful client module
    ])
      .then(async ([{ default: attachOptimizationPreviewPanel }, { client }]) => {
        await attachOptimizationPreviewPanel({ contentful: client, nonce })
      })
      .catch(() => undefined)
  }, [sdk, nonce, enabled])

  return null
}
```

A dynamic import only loads the attach function; your app must call
`attachOptimizationPreviewPanel(...)` with a Contentful client, or with
`entries: { audiences, experiences }` when you already loaded the preview definitions. `entries`
takes precedence over `contentful`.

## Advanced integrations

### Mixed route strategies

**Integration category:** Advanced or production-only

Pages Router applications can mix route strategies. Choose the strategy per page instead of forcing
one rendering model across the whole app.

| Page need                                                   | Use this pattern                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Server-personalized first paint                             | `getServerSideProps` with `getServerSideOptimizationProps()`                        |
| Server first render plus browser-side reactivity            | Pass server state through `pageProps` and render live entries with `OptimizedEntry` |
| Browser-owned personalization after startup                 | Render baseline or loading UI on the server and let browser state own it            |
| Highly interactive account, dashboard, or settings surfaces | Components with live updates and explicit consent state                             |

1. Keep SEO-sensitive content in `getServerSideProps` pages so it appears in the initial HTML.
2. Use `/client` hooks for controls that call `identifyUser()`, `setConsent()`, `resetUser()`, live
   flag state, or manual tracking.
3. Reuse the same `OptimizationRoot` (mounted once in `pages/_app.tsx`) so every route shares one
   browser SDK instance and one profile.
4. Reuse the same Contentful locale and anonymous-id continuity across strategies.

### Manual server and client escape hatches

**Integration category:** Advanced or production-only

Use manual helpers only when the Pages Router helper cannot express a route's needs.

1. Use `createNextjsOptimization()` and `getNextjsServerOptimizationData()` from `/server` for
   direct request SDK control, custom server page payloads, or app-owned anonymous-id persistence.
2. Pass `serverOptimizationState` to a `/client` `OptimizationRoot` or `OptimizationProvider` only
   in manual server/client setups.
3. Use `getServerTrackingAttributes()` from `/tracking-attributes` only with manual
   `resolveOptimizedEntry()` results.

### Caching and request policy

**Integration category:** Advanced or production-only

Personalized server rendering is request-specific. `getServerSideProps` already runs per request, so
there is no static-generation trade to undo — but the state it returns is profile-specific and must
not be shared.

1. Do not share `serverOptimizationState` across requests; it is profile-specific and tied to the
   request's page event.
2. Cache raw Contentful entries by entry id, locale, environment, and include depth when your app
   cache policy permits — cache the fetch, not the resolved decisions.
3. Set response headers (`Cache-Control`) from `getServerSideProps` or the hosting layer so
   personalized HTML is not stored in shared caches unless the cache key varies on the full
   personalization context.

### Strict consent and duplicate-event controls

**Integration category:** Advanced or production-only

Strict consent and duplicate-event controls are production policy work. Configure them only after
your privacy, analytics, and platform owners agree on the event posture.

1. Use `allowedEventTypes: []` in the browser factory when no SDK events can emit before consent.
2. Return `false` from `server.consent` while consent is unknown or denied.
3. Clear `ctfl-opt-aid` and your own consent or profile cookies when withdrawal must end profile
   continuity.
4. Keep the helper's returned `initialPageEvent` by default. To override it, pass
   `{ initialPageEvent: 'emit' }` as the optional second argument to
   `getServerSideOptimizationProps` — only when a route owns first page tracking outside the helper.
   The step-3 wrapper forwards only `context`, so widen it to forward options too:
   `getOptimizationProps(context, options?)` → `getServerSideOptimizationProps(context, options)`.
5. Subscribe to `states.blockedEventStream` during validation to confirm the SDK blocks the events
   your policy expects it to block.

Blocked events are not replayed when consent later changes. If the current route, flag, or entry
state still qualifies after consent, the SDK can emit a fresh current-state event.

## Production checks

Run these checks before release:

- Confirm the browser factory and the server helper use the intended client id, environment, API
  endpoints, locale, app metadata, and log level.
- Confirm browser-exposed `NEXT_PUBLIC_` variables contain only values safe to ship to the client.
- Confirm Contentful fetches use one concrete locale and include resolved optimization entries and
  variants.
- Confirm `server.consent`, browser consent (`clientDefaults` and factory `defaults`), anonymous-id
  persistence, and CMP or account state stay aligned across first load, navigation, opt-in, opt-out,
  sign-in, sign-out, and reset.
- Confirm the server path owns the initial page event and `NextPagesAutoPageTracker` does not
  duplicate it when the helper returns `initialPageEvent: 'skip'`.
- Confirm `identifyUser()`, `setConsent()`, and `resetUser()` re-resolve only the entries configured
  for live updates.
- Confirm entry views, clicks, hovers, flag views, page events, business events, and forwarded
  analytics events deliver only when policy permits them.
- Confirm baseline fallback renders automatically when variants are missing, consent is denied,
  links are unresolved, or CDA payloads are all-locale.
- Confirm an Experience API failure is handled the way you intend. `getServerSideOptimizationProps`
  throws on an API error, so unless you catch it in `getServerSideProps` the route returns a 500
  rather than baseline HTML; see
  [the state handoff](#the-getserversideprops-state-handoff-and-the-profile-cookie).
- Confirm personalized HTML is not shared-cache safe unless the cache varies on every
  personalization input.

**Copy this:**

```sh
pnpm implementation:run -- nextjs-sdk_pages-router typecheck
pnpm implementation:run -- nextjs-sdk_pages-router lint
pnpm test:e2e:nextjs-sdk_pages-router
```

## Troubleshooting

| Symptom                                                            | Likely cause                                                                             | Check                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entries stay on baseline                                           | No variant applies, denied consent, unresolved Contentful links, or all-locale CDA       | Author a variant that targets you, check `server.consent`, fetch one `locale` with enough `include`                                                                                        |
| Every entry renders baseline even with consent granted             | `optimization.props` was not spread into the page's returned `props`                     | Return `{ props: { ...optimization.props, entries } }` so `pageProps.contentfulOptimization` is set                                                                                        |
| The page 500s instead of showing baseline when the API is down     | `getServerSideOptimizationProps` throws on an Experience API error and is not caught     | Wrap the call in `try/catch` and return props without `contentfulOptimization` to fall back to baseline                                                                                    |
| The variant never appears even though it is authored               | Your test visitor does not match the experience's audience                               | Target all visitors for a first test, or force the variant with the preview panel                                                                                                          |
| `<Component entry={resolved} />` shows a type error                | The render prop returns a base `Entry`, wider than your component's type                 | Cast it: `resolved as YourEntryType` (add `as unknown` only if TS rejects a genuinely disjoint type)                                                                                       |
| Browser sends a duplicate first page event                         | The tracker emitted after the server helper already reported the same route              | Pass the helper's `initialPageEvent` straight through in `pages/_app.tsx`                                                                                                                  |
| Browser does not send the first page event                         | `initialPageEvent="skip"` reached a browser-owned route without a matching server event  | Let the helper choose the value; it emits `undefined`/`emit` when there is no server helper                                                                                                |
| Live entries do not update after `identifyUser()` or `resetUser()` | Live updates are off (the default)                                                       | Set `liveUpdates: true` in the factory, or pass `liveUpdates` to the app-local `OptimizedEntry`                                                                                            |
| Entry views, clicks, or hovers do not emit                         | Interaction tracking is opted out, consent blocks the event, or no profile is available  | Check factory `trackEntryInteraction`, entry props, consent state, and `states.blockedEventStream`                                                                                         |
| Server and browser use different profiles                          | Cookie domain, path, readability, or consent cleanup differs between runtimes            | Keep `ctfl-opt-aid` browser-readable with a consistent path and clear it on withdrawal                                                                                                     |
| Personalized HTML appears stale                                    | Route or CDN caching is sharing profile-evaluated output                                 | Set `Cache-Control` or vary cache keys on the full personalization context                                                                                                                 |
| Next.js 15 reports unsupported `export *` in a client boundary     | A `'use client'` module re-exports with `export *` — in your app, or a package that does | If the error points to your own code, remove `export *` re-exports from your Client Components; if it points to a dependency's client entry, use one whose client entry uses named exports |

## Reference implementations to compare against

- [Next.js SDK Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md):
  Working Pages Router application using `getServerSideProps` state handoff, app-local bound
  components, client takeover, live updates, consent controls, page events, entry interaction
  tracking, preview attachment, and Playwright E2E coverage.
- [Next.js SDK App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md):
  App Router equivalent using bound Server and Client Component exports. </content> </invoke>
