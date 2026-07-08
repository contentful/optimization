# Shared concepts (web family, SDK-neutral)

SDK-neutral concepts common to Web, React Web, and both Next.js routers. Per-SDK files reference
these instead of restating them. Terse; not a guide.

## You-fetch / SDK-resolves boundary

The app owns Contentful fetching; the SDK only resolves. The SDK sits at the hand-off where a
fetched entry becomes a component and returns the resolved variant (or the baseline entry). The app
keeps its client, fetchers, components, routing, caching, and rendering.

## Entry resolution

Fetch with ONE concrete locale and an `include` depth deep enough to cover the page, its sections,
and linked variant entries. All-locale payloads (`withAllLocales` / CDA `locale=*`) use locale-keyed
field maps the resolver cannot read ⇒ entries fall back to baseline. The entry wrapper's render prop
hands back the resolved entry as a base `contentful` `Entry`; a narrower component type needs a
cast. source: react-web `optimized-entry/optimizedEntryUtils.ts`; entry-personalization concept doc.

## Baseline fallback

On denied consent, no matching variant, unresolved links, or an all-locale payload, the render prop
receives the baseline (original) entry and the UI does not break. This is why an integration renders
correctly even before any variant is authored. source: react-web `OptimizedEntry`.

## Consent & persistence

Two independent axes: `consent` (may personalize + send events) and `persistenceConsent` (may store
the profile-id cookie). Consent policy is app-owned: the app records the choice and the SDK reads it
(server-side per request, browser-side via seeded defaults). The consent record/cookie is
reader-owned; the profile-id cookie is SDK-owned. source: factory `defaults`; per-SDK server
consent.

## Live updates

Opt-in. Most content is fixed for a request's life, so re-resolution after load is off by default.
Turned on app-wide (factory `liveUpdates`) or per-entry; a per-entry value overrides the app-wide
default. Triggers: consent/identity/profile changes in the browser. source: react-web
`LiveUpdatesProvider`, `hooks/useLiveUpdates.ts`.

## Page events

A page event signals a page/route view. Auto-page trackers emit them on navigation and dedupe
consecutive route keys. When the server already reported a consented page view, the browser must
skip the duplicate (per-SDK `initialPageEvent` / tracker prop). Interaction events
(view/click/hover) are consent-gated browser activity and use the resolved entry id. source:
react-web `auto-page/*`, `router/*`. </content>
