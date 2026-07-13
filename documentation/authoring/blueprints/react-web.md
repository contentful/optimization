---
sdk: react-web
archetype: integration
kb: ../../internal/sdk-knowledge/web/react-web.md
guide: ../../guides/integrating-the-react-web-sdk-in-a-react-app.md
---

## Context

This blueprint is the **editorial map** for the React Web integration guide: for this one SDK, which
of its facts become sections, in what order, under which integration category, what proves the quick
start, and where the milestone boundary falls — with the reasoning, so a future compose re-derives
the same guide instead of re-inventing it. The `guide-writer` reads it alongside the integration
recipe (the archetype's shape) and the knowledge base (the facts). It is agent-facing guidance, like
a recipe's `## Context` — the writer never emits this file; it emits the guide the map describes.

What this file owns, and what it does not:

- **Owns editorial judgment** — the section inventory and order, each section's category, the proof,
  the milestones, and the troubleshooting reader-symptoms. This is the layer that otherwise lives
  only inside the finished guide.
- **Does not own SDK facts** — every symbol, prop, config key, return shape, and behavior lives in
  the [React Web knowledge base](../../internal/sdk-knowledge/web/react-web.md), which builds on the
  [Web SDK knowledge base](../../internal/sdk-knowledge/web/web.md) (React Web wraps the Web SDK) and
  the [shared concepts](../../internal/sdk-knowledge/shared/concepts.md). Cite them here by name,
  never restate them. A missing fact is a KB gap to escalate, not something to record here.
- **Does not own archetype structure** — the fixed heading spine (`## Quick start` → `## Before you
start` → `## Core integration` → …), the category value set, the fragments to compose, and the
  example-label rules belong to [`recipes/integration.md`](../recipes/integration.md). This file
  only decides how React Web's topics populate that spine.

Read the recipe for the shape and this file for the arrangement; the two compose into the guide.

## What proves it works

The honest minimum proof for a **stateful browser SDK** is **one entry rendering its personalized
variant in the browser once the SDK resolves it** — not an accepted event (React Web hides event
mechanics behind the component) and not a resolved entry available synchronously (there is none). The
proof is intrinsically two-phase: because the SDK is created _after_ React commits and only then asks
the Experience API who the visitor is, the entry shows a brief loading state and then reveals the
resolved content. That reveal-after-loading is the proof working, not a bug, so the quick start must
say so out loud.

Unlike the Node proof, this one does need an authored variant to _show_ personalization — but the
baseline-fallback contract (shared `concepts.md`) means the integration renders correctly before any
variant exists (it shows the baseline), so leading with the entry-render proof is still honest: a
missing variant reads as "correct default content", not "broken". Verification is therefore
performable: author an all-visitors variant so the reader matches it automatically, load the app, and
watch the baseline give way to the variant.

Ground the quick start in the most common real React + Contentful shape — fetch one entry in an
effect, render its fields through the reader's own components — not the reference implementation's
harness. Use always-on `defaults={{ consent: true }}` in the quick start to keep the path simple, and
defer real gated startup to the consent section; the recipe forbids putting consent policy on the
first-result path unless consent is the chosen proof.

## Milestones

- **Milestone 1 — a personalized entry in the client render (the quick start).** After the SDK
  resolves, a visitor sees their variant on screen; complete and shippable on its own. It leads
  because it is the first observable result and needs none of the re-personalization machinery.
- **Milestone 2 — live re-personalization (opt-in, later).** Content re-resolves when consent,
  identity, or profile changes, without a full reload. See [Live updates](#live-updates).

The boundary is the **render lifecycle**, not authoring cost (that is Node's boundary): everything in
M1 happens on the first resolution pass after mount; M2 is the opt-in machinery that re-runs
resolution on already-rendered entries after a state change. Live updates are off by default because
most content is fixed once resolved, which is exactly why M2 is genuinely additive rather than part
of the first integration.

## Section order & category, and why

React Web readers wire a **browser render pipeline** around one mounted component, so the Core
sections follow that pipeline — mount and configure, understand the async readiness model, get an
entry, resolve and render it, then drive re-evaluation with events — rather than walking the API
surface. Each dependency is taught before the section that needs it.

Note the deliberate split: the render pipeline is **five** separate Required sections, not one. A
KB-only compose tends to collapse "get an entry and render its variant" into a single step; that
hides the two things that make this SDK different from the server-rendered guides — the async
readiness model, and the manual-vs-managed fetch boundary — so keep all five distinct.

**Core integration** (Required + Common but policy-dependent):

- **How the SDK fits your app** — Required — the single `OptimizationRoot` mount and its prop surface
  that every later section hangs off; it must land first because there is no factory call and one
  mount point owns config, provider composition, and the "mount exactly once" rule.
- **SDK readiness, loading, and error states** — Required — the concept with no server-rendered
  analogue: the SDK is not ready on first render, so loading and error are first-class, taught right
  after the mount and before any fetch/resolve section because those depend on
  `useOptimizationContext().error` and the `OptimizedEntry` loading model (the 5s baseline-reveal
  timeout). This is the section a server-guide-shaped compose would omit entirely; it exists only
  because the browser lifecycle forces it.
- **Fetching Contentful entries** — Required — the fetch boundary, manual (`baselineEntry`) vs
  managed (`entryId` + root `contentful: { client }`), plus the single-locale / deep-`include`
  rules; taught before resolving because you need a fetched entry in a shape the resolver can read
  before you can wrap it.
- **Resolving entries and rendering the result** — Required — the `OptimizedEntry` render-prop wrap,
  the base-`Entry` cast, and the baseline-fallback contract; this is Milestone 1 made concrete and is
  Required because an integration that never renders a variant is incomplete. It also owns the
  double-wrap `null` and `as` (`'div'`/`'span'`) host-element rules, which only make sense once the
  wrap is on screen.
- **Page events and route tracking** — Required — route-based experiences evaluate off page events,
  so most integrations emit one on first load and every route change via an auto tracker (one per
  router tree); Required because without it route experiences never fire. Placed after the render
  result so the reader has something on screen before wiring the events that re-evaluate it.
- **Consent and privacy handoff** — Common but policy-dependent — policy decides whether
  personalization is on by default; the quick start seeded always-on consent, so this section teaches
  the real gated startup (`setConsent`, the two axes, the pre-consent allow-list). Common because a
  typical production app gates on the visitor's choice.
- **Entry interaction tracking** — Common but policy-dependent — on by default with `OptimizedEntry`,
  so most apps ship it with no extra wiring, but which detectors run (views/clicks/hovers) is a
  privacy-policy decision, so it is opt-out per type rather than Required.
- **Identity, profile, and reset** — Common but policy-dependent — most apps with a login call
  `identifyUser()` and `resetUser()`; it pairs with consent because reset preserves consent state and
  the app clears its own consent record separately.

**Optional integrations** (additive capabilities a reader opts into):

- **Live updates** — Optional — this **is** Milestone 2; opt-in because most content is fixed once
  resolved, and the provider is already composed by `OptimizationRoot`, so the reader only chooses
  the scope (app-wide, per-entry, or the preview-panel override).
- **Merge tags and Custom Flags** — Optional — only relevant if the content model embeds MergeTag
  entries in Rich Text or experiences author Custom Flag changes; different mechanics from entry
  replacement, so it is its own section, not a note.
- **Analytics forwarding** — Optional — a hand-off to the analytics-forwarding supplemental guide;
  keep it a pointer with the `onStatesReady` / `messageId`-dedupe shape, not a re-teaching. Link
  target: `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.
- **Preview panel** — Optional — a separate published package
  (`@contentful/optimization-web-preview-panel`) for authoring and staging; off the first-integration
  path and environment-gated out of production, so Optional, not Core.

**Advanced integrations** (production hardening, off the first-integration path):

- **Owning the Web SDK instance** — Advanced or production-only — `OptimizationProvider` with an
  injected `sdk`, the explicit `LiveUpdatesProvider`, and the managed-entry SSR prefetch handoff
  (`prefetchManagedEntries` → `prefetchedManagedEntries`); framework-adapter territory a first
  integration does not need. Points server-rendered readers to the Next.js guides rather than
  re-teaching a server path this SDK does not own.
- **Strict consent, storage, and delivery controls** — Advanced or production-only —
  `allowedEventTypes={[]}`, `cookie`, `queuePolicy`, `onEventBlocked`; posture a first integration
  configures only after privacy, analytics, and platform owners agree.

Where React Web diverges from the wider family, say so: managed fetching is a **first-class Required
choice here** (the guide presents manual as the quick-start default but teaches both in the fetch
section), whereas the Node guide files managed as Optional. And the readiness/loading/error section
has **no equivalent** in the server-rendered guides — it is the defining structural difference of a
browser-only SDK, so it must never be dropped when reconciling against those guides.

## Troubleshooting the reader will actually hit

Rows map to real first-run symptoms, not every theoretical failure:

- **Entry stays on baseline** → no variant applies, denied consent, unresolved Contentful links, or
  an all-locale (`withAllLocales` / `locale=*`) payload. Ties to the authored-variant gotcha and the
  fetch rules.
- **Variant never appears even though authored** → the test visitor does not match the experience
  audience, or no page event was emitted. (Target all visitors for a first test, or force it with the
  preview panel; confirm the tracker.)
- **`<Component entry={resolved} />` shows a type error** → the render prop hands back a base
  `contentful` `Entry`, wider than the component's type; cast `resolved as YourEntryType`, adding
  `as unknown` only for a genuinely disjoint type.
- **Entry is stuck showing loading UI** → optimization state never settled (only entries with
  optimization references wait); it reveals baseline automatically after the 5s timeout — check the
  Experience request and `include: 10`.
- **`<OptimizedEntry entryId>` renders the error fallback** → the managed fetch failed, or
  `contentful: { client }` is not configured on `OptimizationRoot`.
- **A wrapped entry renders nothing** → two `OptimizedEntry` wrappers share one baseline id
  (double-wrap returns `null` with a dev-only warning); wrap at one level. Different baseline ids are
  fine.
- **`useOptimization must be used within an OptimizationProvider`** → a hook renders outside
  `OptimizationRoot` / `OptimizationProvider`; move the provider above that subtree.
- **`ContentfulOptimization is already initialized`** → more than one owned SDK instance in the same
  browser runtime; keep one `OptimizationRoot` or inject a single shared instance.
- **Route page events fire more than expected** → more than one tracker per router tree, or manual
  `trackPageView()` duplicating the adapter.
- **View / click / hover events do not emit** → consent not accepted, the interaction opted out, the
  entry still loading, or the DOM lacks resolved `data-ctfl-*` metadata.
- **Live entries do not update after `identifyUser()` / `resetUser()`** → live updates are off (the
  default); set `liveUpdates` on the root or the entry.
- **Preview panel does not attach** → package not installed, the environment gate is false, attach
  ran before the SDK existed, or no singleton exists (attach from `onStatesReady`).

## Pinned link targets

Pin these exact paths — guessed filenames are wrong:

- **React Web SDK reference implementation** — `../../implementations/react-web-sdk/README.md`: the
  working React SPA using `OptimizationRoot`, `ReactRouterAutoPageTracker`, `OptimizedEntry`, live
  updates, merge tags, tracking, consent/identity controls, and gated preview-panel attach.
- **Custom React adapter over the Web SDK** — `../../implementations/web-sdk_react/README.md`: a
  custom React adapter built on `@contentful/optimization-web`, for comparison when an app needs full
  control instead of the official React Web surface.

Sibling-guide link targets referenced from the guide (verified filenames):

- Next.js App Router: `./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md`
- Next.js Pages Router: `./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md`
- Web SDK: `./integrating-the-web-sdk-in-a-web-app.md`
- Analytics forwarding supplemental:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`
