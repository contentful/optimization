---
sdk: web
archetype: integration
kb: ../../internal/sdk-knowledge/web/web.md
guide: ../../guides/integrating-the-web-sdk-in-a-web-app.md
---

## Context

This blueprint is the **editorial map** for the Web integration guide: for this one SDK, which of
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
  [knowledge base](../../internal/sdk-knowledge/web/web.md); cite it here by name, never restate it.
  If a fact is missing, that is a KB gap to escalate, not something to record here.
- **Does not own archetype structure** — the fixed heading spine (`## Quick start` → `## Before you
start` → `## Core integration` → …), the category value set, the fragments to compose, and the
  example-label rules belong to [`recipes/integration.md`](../recipes/integration.md). This file
  only decides how Web's topics populate that spine.

Read the recipe for the shape and this file for the arrangement; the two compose into the guide.

## What proves it works

The honest minimum proof for a **stateful browser SDK** is one entry that renders its personalized
variant into the page once the SDK resolves it — not just an accepted event. Unlike the stateless
Node SDK, the Web SDK's baseline fallback means a resolved entry renders correctly on day one even
before a variant is authored, so leading with a rendered entry does not fail for the wrong reason:
without a variant the reader sees the baseline (which is correct), and with an all-visitors variant
they see the variant. That contrast is the whole proof, and it needs the full create → emit → resolve
path, so the quick start is allowed to be longer than Node's. One proof, one verification: author an
all-visitors variant, load the page, and confirm the hero swaps to the variant's text (baseline text
staying put routes to Troubleshooting).

Ground the quick start in the most common real browser shape — you fetch an entry and render its
fields into the DOM — not the reference implementation's element markup. Show the SDK inlined for the
quick start (`new ContentfulOptimization(...)`, `await page()`, fetch, `resolveOptimizedEntry`, DOM
write); the sections below factor init into a shared singleton module and split the manual-vs-managed
fetch paths out. Use always-on `defaults: { consent: true }` to keep the path simple, and explicitly
tell the reader to add the consent step before shipping if personalization must wait for consent.

## Milestones

- **Milestone 1 — a personalized entry rendered into the page (the quick start).** After an emitted
  page event, a fetch, and a resolve, a visitor sees their variant on screen. Shippable on its own,
  which is why it leads: the baseline fallback guarantees it renders correctly even with nothing
  authored yet.
- **Milestone 2 — live re-personalization (opt-in, later).** Content re-resolves when consent,
  identity, or profile changes, without a full reload, by subscribing to `states.*` and re-running
  the same render. It comes second because it is opt-in and because it is the imperative SDK's
  distinctive work — no framework re-renders for you.

The boundary is the **render lifecycle**, not authoring cost (Node's boundary): near side is the
first resolve-and-paint; far side is re-painting after SDK state changes. This differs from Node
precisely because the browser SDK is stateful and its baseline fallback lets first paint succeed with
an empty Contentful space, so the interesting boundary moves to "does this content update after it
first resolves?"

## Section order & category, and why

Web readers drive a **stateful instance imperatively** across a page's life, so sections follow that
lifecycle — understand the one instance, learn the state-fill ordering, get an entry, resolve it,
then handle ongoing events and re-renders — rather than walking the API surface. Teach the mental
model before the calls that depend on it.

**Core integration** (Required + Common but policy-dependent):

- **How the SDK fits your app** — Required — explains the single `ContentfulOptimization` instance
  the quick start created (config keys, the reused singleton, the `window.contentfulOptimization`
  already-initialized throw); every later section assumes one reused instance, so it lands first.
- **The SDK lifecycle: create, emit, resolve** — Required — the construct → emit → resolve ordering
  is the load-bearing model unique to an imperative stateful SDK: the instance is synchronously ready
  but optimization state is empty until an accepted `page()`/`identify()` returns selections, so
  resolve-before-emit silently yields baseline. (This is the section a KB-only compose is most likely
  to drop: the KB records "synchronously ready, state empty until accepted event" as a runtime quirk,
  but nothing flags that the ordering deserves its own headline step — it does, because it is the
  difference between working personalization and silent baseline.)
- **Fetching Contentful entries** — Required — the entry-source boundary (manual vs managed) plus the
  one-locale / `include: 10` fetch requirements; the reader must get an entry into a resolvable shape
  before any resolve works. Both paths live in one Required section (unlike Node, where managed is
  Optional) because the web guides lean managed and present it as an equal supported path.
- **Resolving entries and rendering the result** — Required — the resolve step made concrete: the
  return envelope, the base-`Entry` cast, the baseline-fallback contract, and keeping the baseline id
  separate from the resolved id. A personalization integration that never renders a resolved entry is
  incomplete.
- **Page and route events** — Required — page events populate selections and most apps emit on load
  and route change. Placed _after_ resolve (Node teaches `page()` before the fetch) because the quick
  start and lifecycle section already established emit-before-resolve; this section deepens the
  _ongoing_ cadence — SPA `trackCurrentPage` dedupe and the hybrid `initialPageEvent: 'skip'` — which
  reads better once the reader has seen why selections matter.
- **Consent and privacy handoff** — Common but policy-dependent — policy decides default-on vs.
  gated, but it gates every non-allow-listed event, so it is taught in Core rather than deferred;
  Common (not Required) because the quick start ships with default-on consent and only a real app
  adds the gate.
- **State subscriptions, locale changes, and re-rendering** — Common but policy-dependent — this IS
  Milestone 2; live re-render is opt-in (most content is fixed for a page's life), so Common not
  Required, and it sits in Core because re-rendering after state changes is the imperative SDK's
  answer to a first-class need. Owns `setLocale` (updates subsequent Experience/event locale only —
  does not refetch or clear caches).
- **Entry interaction tracking** — Common but policy-dependent — auto view/click/hover is on by
  default so most apps ship it with no config, but it is gated by consent and analytics governance;
  Common not Required because first paint does not need it. (In Node this is Optional and server-side;
  here it is Common because browser interaction tracking is the SDK's home turf.)
- **Identity, profile, and reset** — Common but policy-dependent — most apps with a login call
  `identify()`/`reset()`; policy-dependent on whether the app has auth and approved traits. Sits last
  in Core because it layers onto the event/lifecycle path already taught.

**Optional integrations** (additive capabilities a reader opts into):

- **Web Components entry rendering** — Optional — the declarative element alternative to driving
  `resolveOptimizedEntry()` by hand; a reader uses either the class (default, quick start) or the
  elements. Side-effect-free until `defineContentfulOptimizationElements()` runs.
- **Merge tags and Custom Flags** — Optional — combined into one section (Node splits them into two)
  because both are content-model-conditional reads off current profile state: merge tags only when
  Rich Text embeds MergeTag entries, Custom Flags only when experiences author flag changes.
- **Analytics forwarding** — Optional — a hand-off to the analytics-forwarding supplemental guide;
  keep it a pointer, not a re-teaching. Link target:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- **Preview panel** — Optional — the separate `@contentful/optimization-web-preview-panel` browser
  package for dev/preview/staging, including forcing a variant; only when the app needs browser
  authoring tooling, so keep it behind an environment gate. No Node analogue.

**Advanced integrations** (production hardening, off the first-integration path):

- **Hybrid Node SSR and browser continuity** — Advanced or production-only — the Node+Web handoff via
  the SDK-owned `ctfl-opt-aid` cookie (`ANONYMOUS_ID_COOKIE`, not `HttpOnly`) and the
  `initialPageEvent: 'skip'` first-route dedupe. Categorized Advanced here (Node files the mirror
  section as _Optional_): for a browser-first reader this is production hardening a pure-browser app
  never needs, whereas for a Node-first reader it is an additive capability. Links the Web SDK guide
  is reached _from_ Node; from here it points at the `node-sdk+web-sdk` reference implementation.
- **Strict consent, storage, and delivery controls** — Advanced or production-only —
  `allowedEventTypes: []`, `cookie` domain/expiry, `queuePolicy`, and `onEventBlocked`/
  `blockedEventStream`; event-posture and diagnostics decisions a first integration does not need.

Where Web diverges from Node, say so: managed fetching is presented as an equal Required path here
(Node makes it Optional because most Node apps own their client); interaction tracking and state
subscriptions are Common under Core here (Node has no subscription surface and files server tracking
as Optional); and the hybrid handoff is Advanced here but Optional in Node.

## Troubleshooting the reader will actually hit

Rows map to real first-run symptoms, not every theoretical failure:

- **Entry stays on baseline** → no variant applies, denied consent, unresolved Contentful links, or
  an all-locale payload. Ties directly to the authored-variant gotcha and the fetch requirements.
- **Variant never appears even though authored** → the test visitor does not match the experience
  audience, or no accepted `page()` ran before the resolve. (Target all visitors, or force it with
  the preview panel; confirm `page()` was accepted.)
- **`resolveOptimizedEntry()` always returns the baseline** → no selections yet, entry not optimized,
  links unresolved, or all-locale payload. Verify the preceding `page()`/`identify()` result, the CDA
  `include`/`locale`, and `fields.nt_experiences`/variants.
- **`entry.fields.x` type error** → the resolved entry is a base `Entry`, wider than the component's
  type; cast `entry as YourType` (`as unknown as` only for genuinely disjoint types).
- **`ContentfulOptimization is already initialized` thrown** → more than one instance in the same
  browser runtime; reuse the module singleton, or call `destroy()` only in teardown paths.
- **SPA page events duplicate** → route changes call `page()` directly without route-key dedupe; use
  `trackCurrentPage()` with a stable `routeKey`.
- **`track()` or interaction events behave as blocked** → consent unset/false, or the event type is
  not allow-listed; inspect `states.consent.current`, `allowedEventTypes`, `onEventBlocked`, and
  `states.blockedEventStream`.
- **Automatic click tracking does not emit** → the event target is not on a clickable path; use
  native clickable elements or add `data-ctfl-clickable="true"`.
- **Custom Flag reads do not emit flag-view events** → consent or profile state is missing, or the
  same value was already tracked (reads are deduped).
- **Hybrid browser sessions start with a different anonymous profile** → server and browser do not
  share the readable `ctfl-opt-aid` cookie (path, same-site, consent, browser-readable).

## Pinned link targets

A prior compose guessed these wrong; record the exact filenames so a future compose does not:

- Sibling framework guides (intro fork): React Web →
  `./integrating-the-react-web-sdk-in-a-react-app.md`; Next.js App Router →
  `./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md`; Next.js Pages Router →
  `./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md`.
- Analytics forwarding supplemental →
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- Reference implementations (note the `_` and `+` separators):
  `../../implementations/web-sdk/README.md` (Vanilla JS),
  `../../implementations/web-sdk_react/README.md` (React adapter),
  `../../implementations/web-sdk_angular/README.md` (Angular), and
  `../../implementations/node-sdk+web-sdk/README.md` (hybrid Node SSR + Web).
