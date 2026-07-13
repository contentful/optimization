---
sdk: nextjs-pages-router
archetype: integration
kb: ../../internal/sdk-knowledge/web/nextjs-pages-router.md
guide: ../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md
---

## Context

This blueprint is the **editorial map** for the Next.js Pages Router integration guide: for this one
SDK, which of its facts become sections, in what order, under which integration category, what proves
the quick start, and where the milestone boundary falls — with the reasoning, so a future compose
re-derives the same guide instead of re-inventing it. The `guide-writer` reads it alongside the
integration recipe (the archetype's shape) and the knowledge base (the facts). It is agent-facing
guidance, like a recipe's `## Context` — the writer never emits this file; it emits the guide the map
describes.

What this file owns, and what it does not:

- **Owns editorial judgment** — the section inventory and order, each section's category, the proof,
  the milestones, and the troubleshooting reader-symptoms. This is the layer that otherwise lives
  only inside the finished guide.
- **Does not own SDK facts** — every import subpath, config key, return shape, cookie, and behavior
  lives in the [knowledge base](../../internal/sdk-knowledge/web/nextjs-pages-router.md) and the
  [shared concepts](../../internal/sdk-knowledge/shared/concepts.md); cite them here by name, never
  restate them. If a fact is missing, that is a KB gap to escalate, not something to record here.
- **Does not own archetype structure** — the fixed heading spine (`## Quick start` → `## Before you
start` → `## Core integration` → …), the category value set, the fragments to compose, and the
  example-label rules belong to [`recipes/integration.md`](../recipes/integration.md). This file
  only decides how the Pages Router's topics populate that spine.

Read the recipe for the shape and this file for the arrangement; the two compose into the guide.

## What proves it works

The honest minimum proof for a **server-rendered React SDK** is that **one entry renders its
personalized variant in the server HTML** — not merely that the SDK initialized, and not a variant
that only appears after JavaScript runs. This SDK's whole reason to exist is the server→client
hydration handoff, so the proof has to demonstrate that handoff: the reader authors a variant, loads
the page, uses **View Source** (or disables JavaScript), searches the raw HTML for the variant text,
and confirms it is in the server HTML and stays on screen after hydrate. A proof that only checks the
rendered DOM would pass for a browser-only render that flashes default content first — exactly the
failure this SDK avoids — so the server-HTML check is load-bearing, not incidental.

Unlike the Node blueprint, resolving a variant is the proof here rather than a second milestone: an
SSR personalization integration that never puts a variant in the first paint has proven nothing.
Authoring cost is real, so the quick start leads the reader to an **all-visitors** experience they
match automatically, and the baseline-fallback contract keeps the integration rendering correctly
before the variant exists (cite `shared/concepts.md#baseline-fallback`). Ground the quick start in
the most common real Pages Router shape — `getServerSideProps` fetches a page's entries and the page
renders them through the app's own components — never an invented hardcoded-entry array. Show the
change as `+`/`-` diffs against the reader's own `lib/optimization.ts`, `lib/optimization-server.ts`,
`pages/_app.tsx`, and a page's `getServerSideProps`, so the additions are unambiguous against files
the reader already owns.

## Milestones

- **Milestone 1 — personalized first paint (the quick start).** `getServerSideProps` resolves the
  visitor's variants on the server and hands serializable state to the page, so the visitor sees
  their variant in the server HTML with no flash of default content. Shippable on its own with no
  browser reactivity at all — the browser SDK only replays the server's decision — which is exactly
  why it leads.
- **Milestone 2 — browser takeover and live updates (opt-in, later).** After load, the browser SDK
  takes ownership from the server-resolved state so content can re-personalize live when consent,
  identity, or the profile changes, without a reload.

The boundary is the **hydration line**, not authoring cost (that is where this diverges from Node):
everything the server can resolve once and hand over as static hydrated state is Milestone 1;
anything that must re-resolve live after the page is interactive is Milestone 2. Milestone 2 turns on
`liveUpdates` so the browser SDK owns re-resolution instead of just mirroring the server.

## Section order & category, and why

Pages Router readers are wiring a **server→client handoff**: a request resolves variants in
`getServerSideProps`, the state flows through `pageProps` to `_app.tsx`, and the browser hydrates
from it. Sections follow that data path — set up the two modules, teach the fetch the resolver needs,
then the server helper that produces the state, then the `_app.tsx` mount that consumes it, then the
entry wrap that renders it — rather than walking the export surface alphabetically. Teach each piece
before the section that depends on it.

**Core integration** (Required + Common but policy-dependent):

- **How the SDK fits your app** — Required — explains the two modules the quick start created: the
  browser binding (`/pages-router`) and the separate server-only helper (`/pages-router/server`).
  This lands first because the Pages Router split is explicit — two factories that happen to share
  the name `createNextjsPagesRouterOptimization` but export different things — and every later section
  refers to one module or the other, so the reader has to hold the split before anything else. Owns
  the import-subpath table and the "package root is not an import path" rule.
- **Fetching Contentful entries** — Required — the fetch/SDK boundary; the reader's own single-locale,
  deep-`include` fetch is a precondition for resolution on both the manual (`baselineEntry`) and
  managed paths, so it precedes the first wrap. Required because a wrong fetch shape (all-locale,
  shallow include) silently falls back to baseline and reads as broken.
- **The getServerSideProps state handoff and the profile cookie** — Required — the server→client
  handoff that makes first paint personalized; it owns the three-field `contentfulOptimization` props
  object and the SDK-owned `ctfl-opt-aid` cookie, and it must state the Pages-Router-specific mechanic
  that there is **no middleware or proxy** — all server work happens inside `getServerSideProps`. This
  is the section a KB-only compose is most likely to under-weight: the KB records the return shape as
  a fact, but nothing there says the props-merge step (forget the spread and every entry renders
  baseline) and the Experience-API-throws-500 gotcha (the helper has no internal try/catch) each
  deserve their own teaching. Both are app-integration work the reader cannot guess.
- **The bound root and page events** — Required — the `_app.tsx` mount point, taught after the state
  it consumes exists. The root applies `serverOptimizationState` and `clientDefaults` before children
  render so the hydration matches the server; the tracker owns the one decision the reader must get
  right — who emits the first page event (`initialPageEvent: 'skip' | 'emit'`), passed straight
  through so the browser does not duplicate the server's report. Note the Pages Router tracker reads
  `useRouter`, so unlike the App Router tracker it needs **no `Suspense` boundary**.
- **Personalizing entries** — Required — Milestone 1 made concrete: the entry wrap is where a fetched
  entry becomes a personalized component, and the variant is already in the server HTML because the
  root hydrated the state first. Required because an integration that never renders a variant is
  incomplete. Owns the render-prop cast (`resolved as YourEntryType`), the baseline-fallback contract,
  the double-wrap-returns-null warning, and the managed `entryId` server-prefetch sub-shape (the
  browser factory strips `contentful`, so managed fetching is a server-side path here — keep it a
  subsection, not a separate Core section).
- **Browser takeover and live updates** — Common but policy-dependent — this **is** Milestone 2. It
  belongs in Core rather than Optional because a common class of Pages Router app needs live
  re-personalization after the handoff, but it is policy-dependent because a pure server-first app
  never turns it on. Covers the bound root's internal live-updates provider, the app-wide/runtime/
  per-entry scopes, and that per-entry `liveUpdates` is accepted directly on the Pages Router
  `OptimizedEntry`.
- **Entry interaction tracking** — Common but policy-dependent — on by default with `OptimizedEntry`,
  so most apps ship it, but whether views/clicks/hovers actually fire is a consent-policy decision and
  page events can precede full consent while interactions cannot.
- **Consent, identity, profile, and reset** — Common but policy-dependent — the browser controls
  (`setConsent`/`identifyUser`/`resetUser`) plus the per-request `server.consent` and the app-owned
  consent cookie the resolver reads with `context.req.cookies[NAME]` (not the App Router's
  `cookies.get`). Common because a typical app has both a consent choice and a login; policy-dependent
  because the exact posture is app-owned.

**Optional integrations** (additive capabilities a reader opts into):

- **Analytics forwarding** — Optional — a hand-off to the analytics-forwarding supplemental guide;
  keep it a pointer with the `onStatesReady` subscribe-early pattern, not a re-teaching. Link target:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- **Merge tags and Custom Flags** — Optional — only relevant if the content model uses MergeTag
  entries or experiences author Custom Flag changes; owns the `isMergeTagEntry` guard and the
  `getMergeTagValue` render-prop second argument.
- **Preview panel** — Optional — only where authors or engineers must inspect or force variants;
  gated behind an app-owned browser flag (`NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`, the
  reader's value, not an SDK one) and attached lazily once the SDK is ready.

**Advanced integrations** (production hardening, off the first-integration path):

- **Mixed route strategies** — Advanced or production-only — choosing a rendering strategy per route
  (server-personalized, server-plus-reactive, browser-owned) rather than forcing one model; off the
  first-integration path.
- **Manual server and client escape hatches** — Advanced or production-only — the `/server` and
  `/client` manual helpers for when the bound Pages Router helper cannot express a route's needs.
- **Caching and request policy** — Advanced or production-only — the cache-boundary discipline:
  `serverOptimizationState` is profile-specific and must not be shared, cache raw entries not resolved
  decisions, keep personalized HTML out of shared caches. Advanced because it only bites at production
  scale and behind a CDN.
- **Strict consent and duplicate-event controls** — Advanced or production-only —
  `allowedEventTypes: []`, returning `false` from `server.consent` while consent is unknown, the
  `initialPageEvent` override, and blocked-event validation; production policy work a first
  integration does not need.

Where the Pages Router diverges from the App Router sibling, say so, because the two guides cross-link
and a reader may have arrived from the wrong one: the module split is explicit (two factories vs. the
App Router's single bound export set); server work lives entirely in `getServerSideProps` with no
proxy/middleware and no forced-dynamic route; the tracker needs no `Suspense` boundary; and
`OptimizedEntry` takes `liveUpdates`/managed `entryId` directly. Cross-link the App Router guide by
its exact filename `./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md` — a guessed name
is wrong.

## Troubleshooting the reader will actually hit

Rows map to real first-run symptoms, not every theoretical failure:

- **Entries stay on baseline** → no variant applies / denied consent / unresolved Contentful links /
  all-locale CDA payload. Ties directly to the authored-variant gotcha and the single-locale fetch
  rule.
- **Every entry renders baseline even with consent granted** → `optimization.props` was not spread
  into the page's returned `props`, so `pageProps.contentfulOptimization` never reached `_app.tsx`.
- **The page 500s instead of showing baseline when the API is down** → `getServerSideOptimizationProps`
  throws on an Experience API error and the reader did not `try/catch` it in `getServerSideProps`.
- **The variant never appears even though it is authored** → the test visitor does not match the
  experience audience. (Target all visitors for a first test, or force the variant with the preview
  panel.)
- **`<Component entry={resolved} />` shows a type error** → the render prop returns a base `Entry`
  wider than the component's type; cast `resolved as YourEntryType`.
- **Browser sends a duplicate first page event** → the tracker emitted after the server helper already
  reported the same route; pass the helper's `initialPageEvent` straight through.
- **Browser does not send the first page event** → `initialPageEvent="skip"` reached a browser-owned
  route with no matching server event; let the helper choose the value.
- **Live entries do not update after `identifyUser()` or `resetUser()`** → live updates are off (the
  default).
- **Entry views, clicks, or hovers do not emit** → interaction tracking is opted out, consent blocks
  the event, or no profile is available.
- **Server and browser use different profiles** → the `ctfl-opt-aid` cookie's domain, path,
  readability, or consent cleanup differs between runtimes.
- **Personalized HTML appears stale** → route or CDN caching is sharing profile-evaluated output.
- **Next.js 15 reports unsupported `export *` in a client boundary** → a `'use client'` module
  re-exports with `export *`, in the reader's code or a dependency's client entry.

## Pinned link targets

Record exact filenames — testing showed guessed names are wrong:

- Sibling App Router guide (these two cross-link):
  `./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md`.
- Analytics-forwarding supplemental guide:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- Pages Router reference implementation:
  `../../implementations/nextjs-sdk_pages-router/README.md`.
- App Router reference implementation (the sibling comparison target):
  `../../implementations/nextjs-sdk_app-router/README.md`.
