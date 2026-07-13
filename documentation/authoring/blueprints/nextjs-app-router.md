---
sdk: nextjs-app-router
archetype: integration
kb: ../../internal/sdk-knowledge/web/nextjs-app-router.md
guide: ../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md
---

## Context

This blueprint is the **editorial map** for the Next.js App Router integration guide: for this one
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
- **Does not own SDK facts** — every symbol, config key, cookie, return shape, and behavior lives in
  the [knowledge base](../../internal/sdk-knowledge/web/nextjs-app-router.md) and the shared
  [`concepts.md`](../../internal/sdk-knowledge/shared/concepts.md); cite them here by name, never
  restate them. If a fact is missing, that is a KB gap to escalate, not something to record here.
- **Does not own archetype structure** — the fixed heading spine (`## Quick start` → `## Before you
start` → `## Core integration` → …), the category value set, the fragments to compose, and the
  example-label rules belong to [`recipes/integration.md`](../recipes/integration.md). This file only
  decides how App Router's topics populate that spine.

The App Router SDK spans **Server Components and Client Components**, so the defining editorial
concern is the server/client boundary: what renders on the server for first paint, what the browser
takes over after load, and the two App-Router-specific hazards that sit on that boundary — a
version-specific handler filename that fails silently, and a server-side call that forces dynamic
rendering. This guide is the sibling of the Pages Router guide; the two cross-link, so pin the exact
sibling filename `./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md` (the intro
routes Pages Router readers there, and that guide routes back here).

Read the recipe for the shape and this file for the arrangement; the two compose into the guide.

## What proves it works

The honest minimum proof for a **server-rendering web SDK** is one section rendering its personalized
variant in the **server HTML** — visible in View Source or with JavaScript disabled, and still on
screen after hydration. This is deliberately different from Node's proof: the stateless Node SDK
leads with an accepted `page()` returning a `profile.id` and avoids resolution because resolution
needs authored content. A render SDK has no profile-id surface a reader can inspect from a page; its
whole observable _is_ the variant in the HTML. So App Router pays the authoring cost up front — the
reader authors an experience that targets **all visitors** so they match it automatically. Without
that variant the baseline-fallback contract (see the KB `Baseline fallback` fact) makes every section
render baseline, which reads as broken; the authored all-visitors variant is what lets the reader
tell personalization from a bug. One proof, one verification: View Source and find the variant text
in the raw HTML, confirming it survives hydration.

Ground the quick start in the most common App Router + Contentful shape — fetch a page entry and
render its content through the app's own components, wrapping at the content-type-to-component
hand-off — not a hardcoded entry-id array (the recipe forbids invented fetch shapes). Show additions
as `+` diffs against the reader's existing `layout.tsx` and renderer, keeping their own lines visible.
The quick start uses always-on `defaults` and `server.consent` to reach a result fast; the Core
sections factor real consent-gated startup back in.

## Milestones

- **Milestone 1 — personalized first paint (the quick start).** A visitor sees their variant in the
  server HTML. Shippable on its own with no browser reactivity, which is exactly why it leads: it is
  the smallest thing a reader can verify and deploy, and it is everything a single server render
  produces.
- **Milestone 2 — browser takeover and live updates.** Opt-in, later: content re-personalizes _after_
  load when consent, identity, or profile changes, without a reload. It comes second because most
  content is fixed for the life of a request, so post-load reactivity is additive.

The boundary is **server-render-time vs. post-load**: everything on the near side is what one server
render emits; everything on the far side needs live-update subscriptions in the browser plus an
interactive trigger (`identifyUser()`, `setConsent()`, `resetUser()`). Note the guide files the
Milestone 2 section (`Browser takeover and live updates`) under `## Core integration` and marks it
`Required for first integration` — a tension to preserve exactly, not smooth over: the section teaches
the server-to-browser handoff mental model every integration relies on, even though live updates
themselves are opt-in.

## Section order & category, and why

App Router readers are building across the **server/client boundary**, so sections follow the render
lifecycle across it — configure the factory, get data in, identify the visitor before render, render
on the server, hand off to the browser, then browser behaviors — rather than walking the API surface
alphabetically. Teach each dependency before the call that needs it.

**Core integration** (Required + Common but policy-dependent):

- **How the SDK fits your app** — Required — explains the `lib/optimization.ts` factory the quick
  start created; it lands first because every later section references its config surface, and it owns
  the single `/app-router` import that resolves to the server build in Server Components and the
  browser build in Client Components (the KB `Package & entry points` fact) plus the subpath map.
- **Fetching Contentful entries** — Required — the fetch/SDK boundary; it teaches the resolvable-
  payload rules (one concrete locale, deep enough `include`) before the first wrap, and disambiguates
  manual `baselineEntry` from opt-in managed `entryId` fetching. Required because a personalization
  integration that never produces a resolvable entry is incomplete. Cites the shared
  `Entry-source boundary` and `Entry resolution` facts.
- **Request context and the profile cookie** — Common but policy-dependent — explains the request
  handler; it is here (not Optional) because server first paint cannot identify the visitor without
  it, but it is policy-dependent because the `matcher` scope and persistence are app choices. This is
  the section that carries the **filename/export convention that fails silently**: Next.js 16 loads a
  `proxy` export from `proxy.ts`, Next.js 15 a `middleware` export from `middleware.ts`; get it wrong
  and the handler never runs, and because `server.enabled` is `true` the bound root _throws_ instead
  of degrading to baseline (KB `Version / runtime quirks`). It also owns the non-`HttpOnly`
  `ctfl-opt-aid` cookie constraint (KB `Identifier ownership`).
- **Personalizing first paint on the server** — Required — Milestone 1 made concrete: the entry-wrap
  hand-off, the render-prop cast (`resolved as YourType`), the baseline-fallback contract, and the
  double-wrap guard. This is the section that carries the **runtime-mode side effect**: bound server
  components read `headers()`, which forces the route dynamic and disables `revalidate` /
  `generateStaticParams` (KB `Version / runtime quirks`). Per the recipe, that side effect is flagged
  here in the Core path, not deferred to the caching section.
- **The bound root and page events** — Required — explains the root and tracker mounted in the quick
  start; it owns the one decision that must be right — who owns the first page event
  (`initialPageEvent="skip"` when the server already reported the view, `"emit"` for browser-owned
  routes) — and the `Suspense`-around-the-tracker rule (it reads `useSearchParams()`).
- **Browser takeover and live updates** — Required for first integration (preserve exactly; this is
  Milestone 2 content) — opt-in live updates, the app-wide `liveUpdates` switch, and per-entry control
  via the `/client` `OptimizedEntry`; it explains why the bound `/app-router` `OptimizedEntry` omits
  per-entry `liveUpdates` so one import type-checks in both Server and Client Components.
- **Entry interaction tracking** — Common but policy-dependent — views, clicks, and hovers are on by
  default with `OptimizedEntry`; policy only decides whether to opt a detector out via factory
  `trackEntryInteraction`. Uses the resolved entry id (shared `Page events` fact).
- **Consent, identity, profile, and reset** — Common but policy-dependent — app-owned decisions where
  the SDK supplies the runtime controls (`setConsent()`, `identifyUser()`, `resetUser()`) and the
  reader owns the consent record and cookie; it sits late in Core because it is where consent-gated
  startup and the identity flow converge, and it shows the Client Component that writes the reader's
  own consent cookie that `server.consent` reads.

**Optional integrations** (additive capabilities a reader opts into):

- **Analytics forwarding** — Optional — a hand-off to the analytics-forwarding supplemental guide;
  keep it a pointer plus the `onStatesReady` subscribe-before-child-effects shape, not a re-teaching.
  Link target: `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- **Merge tags and Custom Flags** — Optional — only relevant if the content model uses MergeTag
  entries or experiences author Custom Flag changes; owns `getMergeTagValue` via the render prop and
  the `isMergeTagEntry` guard from `/api-schemas`.
- **Preview panel** — Optional — only when authors or engineers need browser authoring tooling;
  attached from a Client Component and gated behind an app-owned `NEXT_PUBLIC_*` flag.

**Advanced integrations** (production hardening, off the first-integration path):

- **Route-level SSR, browser takeover, and browser-owned islands** — Advanced or production-only —
  mixing rendering strategies per route; the server/client ownership decision matrix, needed only once
  an app outgrows a single model.
- **Manual server and client escape hatches** — Advanced or production-only — `/server`
  `createNextjsOptimization()`, `getNextjsServerOptimizationData()`, manual `resolveOptimizedEntry()`;
  used only when the bound App Router factory cannot express a route's needs.
- **Caching and request deduplication** — Advanced or production-only — the cache-boundary discipline
  (cache raw Contentful payloads by id/locale/env/include, never profile-evaluated output) and the
  `export const dynamic = 'force-dynamic'` revisit of the first-paint side effect; Advanced because it
  only bites at production scale.
- **Strict consent and duplicate-event controls** — Advanced or production-only —
  `allowedEventTypes: []`, `server.consent` returning `false` while undecided, and
  `states.blockedEventStream` validation; production policy work done after privacy, analytics, and
  platform owners agree on the event posture.

Where App Router sits relative to the family: it is the **canonical web shape**, so the recipe's
web-shaped guidance applies verbatim — the render-prop cast, the `NEXT_PUBLIC_`-prefix browser-visible
env note — with no Node-style translation. Like Node, managed fetching is opt-in and the guide teaches
the manual path as default, but here the managed `entryId` path is **server-side only** (the browser
runtime does not carry the Contentful client), which the first-paint section must state.

## Troubleshooting the reader will actually hit

Rows map to real first-run symptoms, not every theoretical failure:

- **Entries stay on baseline** → no variant applies, denied consent, unresolved Contentful links, or
  an all-locale CDA payload. Ties directly to the authored-variant gotcha.
- **The variant never appears even though it is authored** → the test visitor does not match the
  experience audience. (Target all visitors for a first test, or force it via the preview panel.)
- **`<Component entry={resolved} />` shows a type error** → the render prop returns a base `Entry`,
  wider than the component's type; cast it (`as unknown as` only for a genuinely disjoint type).
- **Two server-side page events for one request** → multiple bound factories, or a manual helper also
  calling the server page path.
- **Browser sends a duplicate first page event** → `initialPageEvent="emit"` used after the server
  already emitted the same route.
- **Browser does not send the first page event** → `initialPageEvent="skip"` used on a browser-owned
  route with no matching server event.
- **Live entries do not update after `identifyUser()` or `resetUser()`** → live updates are off (the
  default) — Milestone 2 not enabled.
- **Entry views, clicks, or hovers do not emit** → interaction tracking opted out, consent blocks the
  event, or no profile is available.
- **Server and browser use different profiles** → the `ctfl-opt-aid` cookie's domain, path,
  readability, or consent cleanup differs between runtimes.
- **Server Components fail with browser globals** → a Client Component hook or browser-only import
  crossed into a server module.
- **Personalized HTML appears stale** → route or CDN caching is sharing profile-evaluated output.
- **Next.js 15 reports unsupported `export *` in a client boundary** → a `'use client'` module
  re-exports with `export *`, in the app or a package.

## Pinned link targets

Testing showed guessed filenames are wrong; these are read from `documentation/guides/` and
`implementations/`:

- Sibling Pages Router guide (bidirectional cross-link):
  `./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md`
- Analytics-forwarding supplemental guide:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`
- Reference implementation (App Router): `../../implementations/nextjs-sdk_app-router/README.md`
- Reference implementation (Pages Router, for comparison):
  `../../implementations/nextjs-sdk_pages-router/README.md`
