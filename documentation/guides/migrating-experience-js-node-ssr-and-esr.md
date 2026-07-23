# Migrating experience.js Node, SSR, and ESR

Use this guide when server code uses `@ninetailed/experience.js-node`, SSR plugin helpers, ESR
helpers, or a manual server-to-browser handoff.

## What changes

Legacy server code commonly uses `NinetailedAPIClient`, SSR plugin continuity, `ntaid`, or ESR
preflight helpers. The Optimization Node SDK is stateless: create one process-level SDK, bind each
incoming request with `forRequest()`, and let the app own cookies, consent, profile persistence,
request context, and caching.

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
- Emits the first page event.
- Persists profile continuity.
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

Accepted request-bound `page()` or `identify()` results carry the profile, selected optimizations,
and flag changes for that request. Consent-blocked events return blocked results or diagnostics
without throwing.

### Replace SSR and ESR handoff

Use a framework SDK when available. For Next.js, prefer the App Router or Pages Router migration
guide so the adapter owns request state, provider handoff, page-event dedupe, and cookie behavior.

For a manual Node/Web hybrid, the app owns the profile cookie. The Node SDK exports
`ANONYMOUS_ID_COOKIE` from `@contentful/optimization-node/constants`, and its value is
`ctfl-opt-aid`, but Node does not read, write, or clear cookies for you. Read the cookie from the
incoming request, pass it as `forRequest({ profile: { id } })`, write the returned profile ID only
when persistence consent allows it, and keep the cookie browser-readable if the Web SDK must
continue the same visitor.

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
- The app persists the profile only when persistence consent allows it.
- Entry resolution uses request selections.
- Browser takeover uses a compatible target SDK path.

## Validate the migration

- Search for `@ninetailed/experience.js-node`, SSR plugin imports, ESR helper imports, and `ntaid`.
- Verify one accepted request and one denied-consent request.
- Verify a resolved server entry falls back to baseline with no selection.
- Verify cache keys do not share personalized output across visitors.

## Troubleshooting

| Symptom                                     | Check                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Server event methods are missing            | Call `forRequest()` first; event methods live on the request-bound client.                             |
| Non-sticky interaction tracking throws      | Bind a request profile ID or use the event flow that derives one before sending Insights interactions. |
| Browser takeover starts a different visitor | Persist and pass the target anonymous ID according to the Web or framework SDK guide.                  |
| Personalized HTML leaks between visitors    | Remove shared caching around request-specific responses and rendered output.                           |

## Related guides

- [Node SDK integration guide](./integrating-the-node-sdk-in-a-node-app.md)
- [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md)
- [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [Node reference implementation](../../implementations/node-sdk/README.md)
- [Node plus Web reference implementation](../../implementations/node-sdk+web-sdk/README.md)
