---
sdk: node
archetype: integration
kb: ../../internal/sdk-knowledge/node/node.md
guide: ../../guides/integrating-the-node-sdk-in-a-node-app.md
---

## Context

This blueprint is the **editorial map** for the Node integration guide: for this one SDK, which of
its facts become sections, in what order, under which integration category, what proves the quick
start, and where the milestone boundary falls — with the reasoning, so a future compose re-derives
the same guide instead of re-inventing it. The `guide-writer` reads it alongside the integration
recipe (the archetype's shape) and the knowledge base (the facts). It is agent-facing guidance, like
a recipe's `## Context` — the writer never emits this file; it emits the guide the map describes.

What this file owns, and what it does not:

- **Owns editorial judgment** — the section inventory and order, each section's category, the proof,
  the milestones, and the troubleshooting reader-symptoms. This is the layer that otherwise lives
  only inside the finished guide.
- **Does not own SDK facts** — every symbol, config key, return shape, and behavior lives in the
  [knowledge base](../../internal/sdk-knowledge/node/node.md); cite it here by name, never restate
  it. If a fact is missing, that is a KB gap to escalate, not something to record here.
- **Does not own archetype structure** — the fixed heading spine (`## Quick start` → `## Before you
start` → `## Core integration` → …), the category value set, the fragments to compose, and the
  example-label rules belong to [`recipes/integration.md`](../recipes/integration.md). This file
  only decides how Node's topics populate that spine.

Read the recipe for the shape and this file for the arrangement; the two compose into the guide.

## What proves it works

The honest minimum proof for a **stateless server SDK** is an accepted `page()` that returns a
profile for the request — not a resolved entry. Resolution needs an authored variant the reader
almost never has on day one, so leading with it makes the quick start fail for the wrong reason
(everything renders baseline and reads as broken). An accepted event plus a reported `profile.id`
proves the SDK is wired, credentials work, and the Experience API answered — with zero Contentful
authoring. One proof, one verification: the reader `curl`s the route and sees a `profileId` in the
JSON.

Ground the quick start in the most common real Node shape — a request handler that builds a response
— not the reference implementation's hardcoded entry-id array (the recipe forbids invented fetch
shapes, and both Node impls happen to use exactly that). Show the SDK inlined in a single
`server.mjs` for the quick start; the sections below factor init into a shared `optimization.ts`
module.

## Milestones

- **Milestone 1 — an accepted page event and a profile for the request.** Shippable on its own with
  no authored content, which is exactly why it leads: it is the smallest thing a reader can verify
  and deploy.
- **Milestone 2 — a resolved entry in the response.** The first capability that requires Contentful
  authoring, so it comes second. It is the payoff of the quick start's event: you take the request's
  selections and turn them into a rendered variant.

The boundary is authoring-cost: everything on the near side works with an empty Contentful space;
everything on the far side needs a variant attached to an experience.

## Section order & category, and why

Node readers are building a **request pipeline**, so sections follow the request lifecycle — set up
the process, bind the request, then act on it — rather than walking the API surface alphabetically.
Teach each dependency before the call that needs it.

**Core integration** (Required + Common but policy-dependent):

- **Install and initialize the Node SDK** — Required — the process-level singleton; nothing works
  until it exists, and the "one per process, bind per request with `forRequest()`" model has to land
  first because every later section assumes it.
- **Bind request context and locale** — Required — every event and managed fetch below needs the
  per-request `eventContext` and `locale`, so teach how to build them before the first `page()`.
  (This is the section a KB-only compose is most likely to drop, because the KB records the
  `eventContext` shape as a fact but nothing tells the writer it deserves its own step — it does,
  because populating `page.*` from a real request is app-integration work the reader cannot guess.)
- **Apply consent policy** — Common but policy-dependent — policy decides whether it is on by
  default, but it gates every call below it, so it is taught early in Core rather than deferred.
- **Evaluate route requests with `page()`** — Required — the core call; this is where `profile`,
  `selectedOptimizations`, and `changes` are introduced as the return envelope the rest of the guide
  consumes.
- **Identify known users** — Common but policy-dependent — most apps with a login will call it, and
  it belongs next to `page()` because it shares the request-client flow and the identify-vs-page
  ordering question. (A KB-only compose tends to misfile this as Optional; it is Common because a
  typical authenticated app ships it.)
- **Persist profile identity between requests** — Common but policy-dependent — the stateless SDK
  cannot remember a visitor, so profile continuity is app work most integrations do; it pairs with
  consent's `canPersistProfile` gate and owns the `ANONYMOUS_ID_COOKIE` cookie-sharing detail.
- **Fetch and resolve Contentful entries** — Required — this is Milestone 2 made concrete; it is
  Required because a personalization integration that never renders a variant is incomplete. Covers
  managed `fetchOptimizedEntry()` vs. manual `resolveOptimizedEntry()`, and disambiguates
  `selectedOptimizations` (plural, passed in) from `selectedOptimization` (singular, returned).

**Optional integrations** (additive capabilities a reader opts into):

- **Resolve merge tags** — Optional — only relevant if the content model uses MergeTag entries.
- **Read Custom Flags** — Optional — only relevant if experiences author Custom Flag changes; note
  `getFlag()` is read-only in Node and never auto-emits a flag view.
- **Track server-side interactions and business events** — Optional — server-owned `track()`/
  `trackView()`; frame that browser clicks/hovers usually belong in browser SDK code.
- **Forward optimization context to analytics** — Optional — a hand-off to the analytics-forwarding
  supplemental guide; keep it a pointer, not a re-teaching. Link target:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- **Share continuity with the Web SDK** — Optional — the hybrid Node+Web handoff; belongs here (not
  dropped, not in Core) because a pure-Node app never needs it but a common class of app does. Links
  to the Web SDK guide (`./integrating-the-web-sdk-in-a-web-app.md`) and the
  `node-sdk+web-sdk` reference implementation.

**Advanced integrations** (production hardening, off the first-integration path):

- **Control pre-consent event admission and request options** — Advanced or production-only —
  `allowedEventTypes: []`, `onEventBlocked`, request-scoped `experienceOptions`/`insightsOptions`;
  strict-consent and diagnostics concerns a first integration does not need.
- **Keep caches safe for personalized rendering** — Advanced or production-only — the cache-boundary
  discipline (what is shared-cache safe vs. request-local), including the cache-safety table. Advanced
  because it only bites at production scale.

Where Node diverges from the web family, say so: managed fetching is **Optional** here (most Node
apps already own their Contentful client and fetch themselves), whereas the web guides lean managed.
The render-prop / cast guidance and "browser-visible env var" notes from the recipe/fragments are
web-shaped — for Node, translate them to a generic typing note and server `process.env`.

## Troubleshooting the reader will actually hit

Rows map to real first-run symptoms, not every theoretical failure:

- **Entry always resolves to the baseline** → no variant applies / no `selectedOptimizations` passed
  / entry not optimized / all-locale payload. Ties directly to the authored-variant gotcha.
- **Variant never appears even though authored** → request does not match the experience audience, or
  resolution ran without the request's selections. (Target all visitors for a first test.)
- **`page()` returns `{ accepted: false }`** → event consent not granted and the type not
  allow-listed.
- **`trackView() requires a request-bound profile id` thrown** → a non-sticky Insights call ran
  without a bound profile.
- **Profile not consistent across requests** → the returned `profile.id` was not persisted, or
  `canPersistProfile` was `false`.
- **Hybrid browser sessions start with a different anonymous profile** → server and browser do not
  share the readable `ctfl-opt-aid` cookie.
- **Merge tags render the fallback for everyone** → no matching profile value, or profile/entry
  locale mismatch.
- **Personalized output leaks between visitors** → an event response or merge-tag output was shared
  through a cache.

## Pinned link targets

Pin these exact paths — guessed filenames are wrong:

- Analytics-forwarding supplemental guide:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`
- Web SDK guide (for the hybrid browser-continuity handoff):
  `./integrating-the-web-sdk-in-a-web-app.md`
- Reference implementation (server-only SSR): `../../implementations/node-sdk/README.md`
- Reference implementation (Node SSR + Web SDK continuity):
  `../../implementations/node-sdk+web-sdk/README.md`
