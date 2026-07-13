---
sdk: react-native
archetype: integration
kb: ../../internal/sdk-knowledge/native/react-native.md
guide: ../../guides/integrating-the-react-native-sdk-in-a-react-native-app.md
---

> Editorial map for the React Native integration guide — how its knowledge-base facts fill the
> integration recipe. Conventions and the recipe/blueprint/KB split: [`_template.md`](./_template.md).

## What proves it works

React Native is a **stateful native SDK** with no server first paint, so the honest minimum proof is
what the app can observe on the first launch of an empty Contentful space: **one screen renders a
resolved entry — variant or baseline — and one screen event is accepted.** Both halves cost zero
Contentful authoring, which is exactly why they can lead. Entry resolution falls back to the baseline
entry on no matching variant (shared `baseline-fallback`), so `OptimizedEntry` renders the original
entry safely with nothing authored — unlike the stateless Node SDK, leading with entry render here
does not read as broken. And `screen` is in the RN pre-consent allow-list (`['identify', 'screen']`
per the KB), so the event emits and is accepted without a consent UI.

Track **screens, not pages** — this is a mobile runtime, so the proof and its section are
screen-shaped throughout; do not import the web family's `page()` vocabulary. The screen event is the
piece that keeps the visitor's profile consistent, which is why it belongs in the proof rather than
being deferred.

Ground the quick start in the most common React Native + Contentful shape — a screen that fetches or
receives an entry and renders it — and hand the SDK the app's Contentful client so managed fetch
proves in one file. Seed `defaults={{ consent: true }}` and set `logLevel="debug"` so the accepted
screen event is visible in Metro/device logs; that is the verification. The **native build step is
inline in the quick start** where the reader installs (`pod install` for bare React Native,
`npx expo prebuild` for Expo), because the required AsyncStorage peer ships native code and the app
will not launch without it — it does not get deferred to `## Before you start`.

## Milestones

- **Milestone 1 — one entry resolving and one screen event (the quick start below).** The minimum
  wired integration: `OptimizationRoot` mounted, one `OptimizedEntry` rendering, one accepted
  `useScreenTracking` event. Complete and shippable on its own, which is why it leads.
- **Milestone 2 — the opt-in layers (later).** Consent handoff, interaction tracking, identity, live
  updates, the preview panel, offline delivery, and analytics forwarding — each introduced by the
  section that needs it.

The boundary is **opt-in vs. mandatory**, not authoring-cost. Node splits its milestones on whether a
step needs an authored variant; React Native cannot, because M1's entry render already resolves-or-
falls-back with an empty space. So the divider here is instead: everything in M1 is the minimum every
RN app wires, and everything in M2 is a layer the app opts into on its own policy.

## Section order & category, and why

React Native readers are building a **provider tree around a running app**, so sections follow the
mount order — create the instance, decide consent, feed it entries, render, track — rather than
walking the API surface. Teach each dependency before the component that needs it.

**Core integration** (Required + Common but policy-dependent):

- **Install and initialize `OptimizationRoot`** — Required for first integration — the provider that
  creates the stateful SDK instance, restores AsyncStorage state, and provides it to every hook and
  component below; with no server instance, the React root _is_ the only entry point, so it lands
  first.
- **Consent and privacy-policy handoff** — Common but policy-dependent — policy decides whether it is
  seeded on by default, but it gates persistence and every non-allow-listed event, so it is taught
  early in Core; the two-axes split (`events` vs. `persistence`) is native-shaped because persistence
  maps to AsyncStorage continuity.
- **Contentful entry fetching and locale shape** — Required for first integration — every resolved
  entry below needs a single-locale CDA payload fetched deep enough (`include: 10`) to pull the
  variant links, so the managed-vs-manual choice and locale shape are taught before resolution.
- **Entry resolution and fallback rendering** — Required for first integration — half the quick-start
  proof made concrete, and Required because a personalization integration that never renders a
  variant is incomplete; owns the render prop, the baseline-fallback-vs-managed-fetch-failure
  distinction, and the RN detail that there is no baseline-reveal timeout (unlike web).
- **Screen and navigation tracking** — Required for first integration — the other half of the proof
  and the native analogue of the web page-event section; RN tracks screens, so this owns the React
  Navigation adapter and the screen hooks, and it is Required because the screen event is what keeps
  the profile consistent.
- **Entry interaction tracking** — Common but policy-dependent — views and taps are on by default on
  `OptimizedEntry`, but Analytics/privacy policy decides whether they emit; native-shaped because
  view tracking is **viewport-based** (scroll position, dwell) and taps replace the web's clicks/hover
  (no hover on touch).
- **Identity, profile continuity, and reset** — Common but policy-dependent — most apps with a login
  call `identify`, so it is Common not Optional; continuity is AsyncStorage-backed, so this section
  owns the "no built-in cross-platform cookie handoff" point that a web reader would expect.

**Optional integrations** (additive capabilities a reader opts into):

- **Merge tags and Custom Flags** — Optional — only relevant when the content model authors
  profile-backed flag or Rich Text merge-tag `changes`.
- **Live updates** — Optional — off by default (an entry locks to its first selected variant); opt in
  per-entry or app-wide only when content should re-resolve in place.
- **Preview panel** — Optional — an in-app authoring/debug surface on the `/preview` subpath needing
  extra native peers and a custom dev build; off the first-integration path.
- **Offline event delivery** — Optional — opt-in via the NetInfo peer; in-memory replay only (no
  durable outbox), relevant to constrained mobile networks.
- **Analytics forwarding** — Optional — a hand-off to the analytics-forwarding supplemental guide;
  keep it a pointer that shows the `onStatesReady` subscription seam, not a re-teaching. Link target:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`.

**Advanced integrations** (production hardening, off the first-integration path):

- **Explicit SDK instance ownership** — Advanced or production-only — `ContentfulOptimization.create()`
  for adapters, test harnesses, or services that must build the SDK before React renders; owns the
  single-active-instance constraint and the caller-owned `destroy()`. `OptimizationRoot` remains the
  preferred path, so this is Advanced.
- **Strict event admission and queue controls** — Advanced or production-only —
  `allowedEventTypes={[]}`, `onEventBlocked`, and `queuePolicy` for privacy review, regulated
  deployments, or constrained networks; a first integration does not need them.
- **Platform build boundaries** — Advanced or production-only — native install steps, custom Expo dev
  build vs. Expo Go, the Android-emulator `localhost` → `10.0.2.2` rewrite (app-config the SDK does
  not do), and release-host verification; native production hardening rather than SDK API.

Where React Native diverges from the web family, say so: it tracks **screens, not pages**; interaction
tracking is **views and taps** (no hover) driven by a viewport, not DOM clicks; identity continuity is
**AsyncStorage-backed with no cookie handoff**; and there is no server first paint, so the provider
withholds children until the async, AsyncStorage-reading instance is ready. The native build step is
inline in the quick start, not deferred.

## Troubleshooting the reader will actually hit

Rows map to real first-run symptoms, not every theoretical failure:

- **Provider children do not render** → SDK initialization failed, or a second active React Native SDK
  instance already exists (call `destroy()` before replacing).
- **Entries always render baseline content** → the entry was fetched with all locales, links are
  unresolved, include depth is too shallow, or no selected-optimization state exists yet because no
  `screen()`/`identify()` was emitted. Ties directly to the authored-variant and single-locale
  gotchas.
- **Entry views do not appear** → consent unset/rejected, `trackViews` false, the dwell threshold has
  not elapsed, or scrollable content has no `OptimizationScrollProvider` so viewport tracking sees no
  scroll position.
- **Entry taps do not appear** → consent unset/rejected, `trackTaps` false, the touch moved past the
  tap-distance threshold (so it read as a scroll), or child touch handling swallowed the tap.
- **Screen events are missing or duplicated** → the app mixes `OptimizationNavigationContainer`,
  `useScreenTracking`, and manual `screen()` on the same route; use one path per route.
- **Preview panel fails to open** → preview peer dependencies missing, the panel is outside
  `OptimizationRoot`, or the build uses Expo Go instead of a custom dev build.
- **Offline replay does not happen** → NetInfo is not installed, the in-memory queue is full, the JS
  process restarted (no durable outbox), or the test runs against always-online mocks.
- **Render prop type error on the entry** → the render prop hands back a base `contentful` `Entry`,
  wider than the content-type interface, so the child needs a cast (`resolvedEntry as HeroFields`).

## Pinned link targets

Pin these exact paths — guessed filenames are wrong:

- Analytics-forwarding supplemental guide:
  `./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md`
- Reference implementation (React Native): `../../implementations/react-native-sdk/README.md`
