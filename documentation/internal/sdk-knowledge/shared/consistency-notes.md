# Cross-guide consistency notes (web family)

Where App Router / Pages Router / React Web / Web must share language, and any drift spotted for
main's final consistency pass. Terse; running log.

## Language that must match across web guides

- Intro four-sentence explainer of variant / experience / Experience API / resolving / baseline
  fallback. Keep the wording aligned (see [`vocabulary.md`](./vocabulary.md)).
- The you-fetch / SDK-resolves boundary sentence. See [`concepts.md`](./concepts.md).
- Entry-wrap cast guidance: render prop returns a base `Entry`; use `resolved as YourType`; mention
  `as unknown as YourType` only for genuinely disjoint types.
- Baseline-fallback contract phrasing (denied consent / no variant / unresolved links / all-locale).
- `## Before you start` shape and the authored-variant gotcha (all-visitors experience for a first
  test).
- consent vs persistenceConsent one-line definitions.

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
  accurately while keeping the shared concept sentence identical. </content>
