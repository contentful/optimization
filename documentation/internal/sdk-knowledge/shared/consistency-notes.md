# Cross-guide consistency notes (web family)

Where App Router / Pages Router / React Web / Web must share language, and any drift spotted for
main's final consistency pass. Terse; running log.

## Language that must match across web guides

- Intro four-sentence explainer of variant / experience / Experience API / resolving / baseline
  fallback. Keep the wording aligned (see [`vocabulary.md`](./vocabulary.md)).
- The **entry-source boundary** framing (managed-or-manual). See [`concepts.md`](./concepts.md).
  Every web guide states it the same way: "you own the Contentful client; the SDK can fetch through
  it (managed) OR you fetch yourself (manual); both are supported." The guide must not assert the
  SDK never fetches, and must keep the manual path first-class.
- Entry-wrap cast guidance: render prop returns a base `Entry`; use `resolved as YourType`; mention
  `as unknown as YourType` only for genuinely disjoint types.
- Baseline-fallback contract phrasing (denied consent / no variant / unresolved links / all-locale).
- `## Before you start` shape and the authored-variant gotcha (all-visitors experience for a first
  test).
- consent vs persistenceConsent one-line definitions.
- No app-authored helper is named after a real SDK method — notably `fetchOptimizedEntry`, which is
  an SDK method. A guide's own example fetch helper uses a distinct name (React Web uses
  `fetchPageEntry`).
- The two Next.js guides share one verbatim troubleshooting row: symptom "Next.js 15 reports
  unsupported `export *` in a client boundary" / cause "A `'use client'` module re-exports with
  `export *` — in your app, or a package that does" / check "If the error points to your own code,
  remove `export *` re-exports from your Client Components; if it points to a dependency's client
  entry, use one whose client entry uses named exports." Mechanism-only, no version framing. Keep
  the App Router and Pages Router rows aligned.

## Drift spotted (for review)

- **Preview-panel enable flag name.** Next.js guide uses
  `NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` (real Next.js browser-var convention). The
  `nextjs-sdk_pages-router` reference impl uses a bespoke `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`
  (no `NEXT_` prefix; non-standard). Guide deliberately diverges from the impl to teach the correct
  convention. Confirm the React Web / Web guides frame their own preview flag as reader-owned with
  each framework's real browser-var convention rather than copying the impl's `PUBLIC_` prefix.
  source: ref impl `lib/config.ts:6`.

## Open items to reconcile when guides 2 & 3 land

- Duplicate-page-event control differs by SDK surface (App Router tracker prop vs Pages Router
  `initialPageEvent` from server props vs React Web / Web). Ensure each guide names the mechanism
  its SDK actually uses; keep the _concept_ wording shared (see `concepts.md#page-events`).
- Live-updates opt-in wording: confirm App Router (bound root includes provider internally) vs Pages
  Router / React Web (explicit `LiveUpdatesProvider` / `globalLiveUpdates`) is described per-SDK
  accurately while keeping the shared concept sentence identical.

## Resolved when guides 2 & 3 closed (2026-07)

- **Both closed.** Guide 2 (React Web) + guide 3 (Web) verified against source with file:line
  evidence; KB `web/react-web.md` and `web/web.md` written from those facts. No cross-guide language
  drift introduced: guide 3 reuses the shared four-sentence explainer, the you-fetch/SDK-resolves
  sentence, the cast guidance, and the baseline-fallback phrasing verbatim.
- **Deliberate consistency hold (guide 3):** step-3 verify wording ("author a variant … target all
  visitors") and the lifecycle-section opener were left as-is because they mirror the accepted,
  already-closed guides 1/2. Two readability suggestions to reword them were DISCARDED to avoid
  making guide 3 inconsistent with the closed guides.
- **`Copy this` vs `Follow this pattern` for partial-constructor snippets:** guide 3 now labels
  merge-into-your-existing-`new ContentfulOptimization({...})` excerpts as `Follow this pattern:`
  (matches how React Web labels its `trackEntryInteraction={{ hovers: false }}` excerpt). Only
  self-contained pure-value-substitution blocks keep `Copy this:`. Good pattern for future guides.
- **Preview-panel flag (guide 3).** The Web guide's preview snippet uses
  `import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` as a reader-owned, environment-gated
  flag (an illustrative Vite-shaped convention). The Web SDK is bundler-agnostic, so there is no
  single "correct" prefix here; it is framed as reader-owned. Consistent with the earlier drift note
  — matches React Web's approach; does not copy the impl as an SDK constant.

## Backport candidate for main's cross-guide pass (NEW precision, not in the closed guides yet)

- **Control-variant `selectedOptimization` precision.** Guide 3 / `web/web.md` now state that
  `selectedOptimization` is `undefined` ONLY when no experience matched; when an experience assigns
  the CONTROL/baseline variant (`variantIndex: 0`) it is DEFINED while the resolved entry still
  equals the baseline — so `selectedOptimization === undefined` must not be read as "showing
  baseline content." source: `core-sdk/src/resolvers/OptimizedEntryResolver.ts:148-209`. The React
  Web, App Router, and Pages Router guides describe the baseline-fallback contract but do NOT
  surface this control-variant nuance. Consider whether to backport a one-line note to those guides
  (the render helpers already guard on presence, so it is a prose-precision improvement, not a bug).
  </content>
