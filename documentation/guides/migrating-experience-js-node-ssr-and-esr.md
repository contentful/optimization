---
fern:
  slug: migrate-experiencejs-node-ssr-and-esr
  section: Migration guides
  description: >-
    Use this guide when server code uses `@ninetailed/experience.js-node`, SSR plugin helpers, ESR
    helpers, or a manual server-to-browser handoff.
---

# Migrate experience.js Node, SSR, and ESR

Use this guide when server code uses `@ninetailed/experience.js-node`, SSR plugin helpers, ESR
helpers, or a manual server-to-browser handoff.

## What changes

Legacy server code commonly uses `NinetailedAPIClient`, SSR plugin continuity, `ntaid`, or ESR
preflight helpers. The Optimization Node SDK is stateless: create one process-level SDK, bind each
incoming request with `forRequest()`, and let the app own cookies, consent, profile persistence,
request context, and caching. Direct Node event calls commit on the server. A route that continues
in a browser SDK instead creates preview state on the server and delivers a private replay for
the matching browser route.

A **server preview** evaluates zero or more optional `identify`/`track` commands in
application-supplied order, followed by the SDK-appended `page` command. It returns preview state
without committing the sequence. The handoff's **private replay** is the SDK-owned, route-bound
continuation for one browser route. A **successful Experience commit** is the non-preflight browser profile
response; only that response can persist browser continuity.

> [!NOTE]
>
> Without JavaScript, previewed server HTML can still render, but matching-route delivery and a new
> browser `ctfl-opt-aid` cookie do not occur.

Follow the [Node SDK integration guide](./integrating-the-node-sdk-in-a-node-app.md) unless a
Next.js adapter owns the route.

## Before you migrate

Gather these inputs:

- Server paths that create profiles, emit page events, or call `NinetailedAPIClient`.
- SSR or ESR helpers and any manual server-to-browser profile handoff.
- Cookie reads/writes for `ntaid` and any browser continuation logic.
- Server-rendered Contentful entries and mapper-dependent experience configuration.
- Consent policy, request locale, user agent, URL, IP/location forwarding, and cache boundaries.

## Migration path

1. For Next.js apps, choose the App Router or Pages Router path before building a manual hybrid.
2. Install `@contentful/optimization-node` for non-Next server paths.
3. Replace server API-client calls with request-bound Node SDK calls.
4. Replace SSR/ESR profile handoff with app-owned persistence and target browser continuity.
5. Replace server content resolution with Node or framework entry resolution.
6. Remove legacy Node, SSR, ESR, and browser packages after imports are gone.

## Replace legacy surfaces

### Inventory server profile and event ownership

Identify which server code owns each responsibility:

- Creates or reads an anonymous profile ID.
- Commits events on a server-only route, or previews the initial sequence for a browser route.
- Delivers private replay and persists profile continuity in the browser path.
- Resolves Contentful entries before rendering.
- Hands state to the browser.

This inventory prevents one request from being evaluated twice or from losing the profile before
browser takeover.

### Replace Node API client calls

Create one `ContentfulOptimization` instance per process and call `forRequest()` for each incoming
request. Event methods live on the request-bound client, not on the singleton. The minimum legal
shape is `forRequest({ consent })`; a migration request usually adds `locale`, `profile`, and
`eventContext`. `locale` selects the request locale, `profile` carries the app-owned anonymous
profile ID, and `eventContext` carries URL, user-agent, referrer, query, and other page data the SDK
cannot infer from your server framework.

On a server-only route, accepted request-bound `page()`, `identify()`, or `track()` calls commit from
Node and carry the profile, selected optimizations, and flag changes for that request. Persist the
returned profile ID only when `canPersistProfile` is true. Consent-blocked events return blocked
results or diagnostics without throwing.

### Replace SSR and ESR handoff

Use a framework SDK when available. For Next.js, prefer the App Router or Pages Router migration
guide so the adapter owns request preview, private browser replay, route dedupe, and browser cookie
behavior.

For a manual Node/Web hybrid, read an existing `ctfl-opt-aid` into `forRequest({ profile: { id } })` and call `previewInitialExperience()` with optional commands. The SDK appends its page and preflights one batch. `createRequestHandoffFromPreview()` packages private preview state and replay. Your app owns serialization and transport. In Web, call `hydrateAndTrackCurrentPage(handoff, { routeKey, buildPayload })` once, then `trackCurrentPage()` for later routes. Preview rendering need not await delivery.

The browser checks live consent and submits the server-built events through its ordinary interceptors and queues, sending the Personalization sequence as one
normal batch. The preview does not write a profile cookie. A successful browser Experience response
commits the sequence and can write the SDK-owned `ctfl-opt-aid` cookie when persistence consent
permits it. Keep that cookie browser-readable for the next server request. Do not migrate hybrid
code by calling Node `page()` and trying to suppress the browser with the legacy
`initialPageEvent` option; that option is inert compatibility input.

### Replace server content resolution

Stop building legacy experience configuration arrays. Fetch a baseline Contentful entry with one
concrete locale and enough linked entries, then resolve it with the request's selected
optimizations. The singleton resolver has no ambient visitor state, so pass selections explicitly
or use the request-bound `fetchOptimizedEntry()` path after an accepted request-bound `page()` or
`identify()` call.

Do not cache personalized outputs across visitors. Raw Contentful baseline entries can follow your
normal content-cache policy, but rendered personalized HTML, merge-tag values, and Experience
responses are request-specific.

### Validate server migration

Verify the request boundary:

- Accepted events return profile data when consent allows them.
- Blocked events do not throw and surface diagnostics.
- Direct Node routes persist returned profile identity only when persistence consent allows it.
- For Node/Web routes, perform the browser Experience commit, duplicate-route, and continuity-cookie
  checks in the Node guide's
  [Share continuity with the Web SDK](./integrating-the-node-sdk-in-a-node-app.md#share-continuity-with-the-web-sdk)
  section.
- Entry resolution uses request selections.
- Browser takeover uses a compatible target SDK path.

## Validate the migration

- Search for `@ninetailed/experience.js-node`, SSR plugin imports, ESR helper imports, and `ntaid`.
- Verify one accepted request and one denied-consent request.
- For a Node/Web route, run the Node guide's
  [paired-flow checks](./integrating-the-node-sdk-in-a-node-app.md#share-continuity-with-the-web-sdk)
  and observe one matching-route browser commit, no duplicate request for the same path plus search,
  and `ctfl-opt-aid` only after a successful response when persistence consent permits it.
- Verify a resolved server entry falls back to baseline with no selection.
- Verify cache keys do not share personalized output across visitors.

## Troubleshooting

| Symptom                                      | Check                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Server event methods are missing             | Call `forRequest()` first; event methods live on the request-bound client.                             |
| Non-sticky interaction tracking throws       | Bind a request profile ID or use the event flow that derives one before sending Insights interactions. |
| Browser takeover starts a different visitor  | Read existing continuity into Node, then run the linked browser commit and cookie checks.              |
| Server variant renders but no cookie appears | Run the browser Experience commit check; confirm JavaScript ran and persistence consent is true.       |
| Personalized HTML leaks between visitors     | Remove shared caching around request-specific responses and rendered output.                           |

## Related guides

- [Node SDK integration guide](./integrating-the-node-sdk-in-a-node-app.md)
- [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md)
- [Choose a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [Node reference implementation](../../implementations/node-sdk/README.md)
- [Node plus Web reference implementation](../../implementations/node-sdk+web-sdk/README.md)
