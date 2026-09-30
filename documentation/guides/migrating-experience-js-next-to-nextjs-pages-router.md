---
fern:
  slug: migrate-experiencejs-next-to-nextjs-pages-router
  section: Migration guides
  description: >-
    Use this guide when a Pages Router app uses `@ninetailed/experience.js-next`, SSR plugin
    behavior, or legacy React surfaces and you want to move to the Optimization Pages Router SDK.
---

# Migrate experience.js Next.js to the Pages Router SDK

Use this guide when a Pages Router app uses `@ninetailed/experience.js-next`, SSR plugin behavior,
or legacy React surfaces and you want to move to the Optimization Pages Router SDK.

## What changes

The Pages Router target uses `@contentful/optimization-nextjs/pages-router` for browser components
and `@contentful/optimization-nextjs/pages-router/server` for `getServerSideProps`. Server props
evaluate the request for rendering; the browser root installs preview state and owns the initial replay/page decision, and continues with React Web behavior.

A **server preview** evaluates zero or more optional `identify`/`track` commands in
application-supplied order, followed by the SDK-appended `page` command. It returns preview state
without committing the sequence. The handoff's **private replay** is the SDK-owned, route-bound
continuation for the first browser route. A **successful Experience commit** is the non-preflight browser profile
response; only that response can persist browser continuity.

> [!NOTE]
>
> Without JavaScript, previewed server HTML can still render, but matching-route delivery and a new
> browser `ctfl-opt-aid` cookie do not occur.

Start with the
[Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).

## Before you migrate

Gather these inputs:

- Provider and tracker placement in `_app.tsx`.
- Every `getServerSideProps` path that uses SSR plugin behavior or `ntaid`.
- Legacy React components, hooks, flags, and mapper-dependent entries.
- Consent cookie, profile cookie, and any legacy `initialPageEvent` or route-skip behavior.
- Any analytics, privacy, preview, or insights plugins.

## Migration path

1. Confirm this app should use Pages Router through
   [Choose a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md).
2. Migrate authored Contentful entries when legacy mapper output is still required. See
   [Migrate an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md).
3. Create the Pages Router client and server bindings.
4. Replace SSR plugin profile and page evaluation in `getServerSideProps`.
5. Replace personalized rendering with the bound Pages Router `OptimizedEntry`.
6. Replace client-side extras through React Web behavior and the plugin migration guide.
7. Remove legacy Next, React, and plugin packages after imports are gone.

## Replace legacy surfaces

### Inventory legacy Pages Router wiring

Record where the legacy provider and tracker mount, whether `onRouteChange` replaces default page
calls, and which pages use SSR plugin helpers. Also record any code that reads or writes `ntaid`,
because target profile continuity uses the SDK-owned `ctfl-opt-aid` cookie.

### Install and bind the Pages Router SDK

Use the target guide to create both bindings:

- Client binding helper from `@contentful/optimization-nextjs/pages-router`.
- Server binding helper from `@contentful/optimization-nextjs/pages-router/server`.

`routeKey` is the path-plus-search identity used to match and deduplicate page delivery, while
`buildPagePayload` supplies the full page URL as event data.

Mount the target `OptimizationRoot` in `_app.tsx`, passing
`pageProps.contentfulOptimization.handoff`, a stable `routeKey`, and a lazy `buildPagePayload`. The
`contentfulOptimization` wrapper is app-owned; its `handoff` field is the SDK
`BrowserOptimizationHandoff` returned by `createRequestHandoff(context, options)`. The handoff can
contain browser consent defaults, request-preview state, managed entries, and an SDK-owned private
replay. The root owns current-route tracking, so remove the legacy tracker and do not add a separate
`NextPagesAutoPageTracker`.

If migrated components will use `<OptimizedEntry entryId>`, configure the server binding with the
app's `contentful` client. Pass `prefetchManagedEntries` descriptors—entry IDs or objects containing
`contentType`, `slug`, optional `slugField`, and optional `entryQuery`—in the `options` passed to
`createRequestHandoff(context, options)`. The helper fetches those baselines and adds them to
`handoff.entries` before the props reach the root. The Pages Router client binding does not fetch
managed entries by itself.

### Replace server profile and page evaluation

In an app-owned server module, call `bindNextjsPagesRouterServerOptimization(config)` once and
destructure its returned `createRequestHandoff` helper. Call
`createRequestHandoff(context, options)` inside `getServerSideProps`, then assign the returned
handoff to the app-owned `contentfulOptimization.handoff` prop. If your app wraps this sequence in a
helper, define that helper in the server module before importing it into a page.

The server binding resolves request consent and previews zero or more optional
`initialExperienceEvents` identify/track commands in the order you supply them. The SDK appends its
page command. The preview is forced and does not write a new anonymous-ID cookie. The returned
private handoff carries the preview state for server rendering and its route-bound continuation.

Pass the handoff to `OptimizationRoot`. It applies preview state in memory and owns the initial replay/page decision, then uses ordinary current-route tracking for later navigation. Replay submits the server-built Personalization batch with live consent and ordinary interceptors, followed by Analytics through the normal queue. Only a successful browser Experience response can write `ctfl-opt-aid` when persistence consent permits it.

Remove legacy `initialPageEvent` props during migration. The target type retains that input only for
compatibility, and it is inert.

### Replace personalized rendering

Replace legacy React wrappers and mapper output with the Pages Router `OptimizedEntry`. It accepts a
manual `baselineEntry` or an `entryId` path backed by baselines in `handoff.entries`. Create those
entries by passing `prefetchManagedEntries` descriptors in the `options` argument to
`createRequestHandoff(context, options)`. It can use per-entry loading, error, and live-update props
because it is the React Web component bound for Pages Router.

If the first render depends on legacy `nt_*` fields, migrate the Contentful model before replacing
the component.

### Replace client-side extras

Client features use the React Web runtime:

- Flags use target flag reads and optional `trackFlagView()`.
- Analytics vendors use accepted and blocked event streams.
- Consent uses app-owned policy passed to server and browser SDK surfaces.
- Preview attaches to the live browser SDK through the preview panel package.

Use [Migrate experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
for plugin-specific replacement.

### Validate Pages Router migration

Verify the server and browser handoff:

- The server binding's `createRequestHandoff(context, options)` runs in `getServerSideProps` on the
  personalized page.
- The app-owned `pageProps.contentfulOptimization.handoff` reaches `OptimizationRoot` in `_app.tsx`.
- Run the integration guide's
  [browser Experience commit check](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#the-bound-root-and-page-events): find one browser `POST` ending in `/profiles` or `/profiles/:id`
  with no `type=preflight`; the separate server preview uses `type=preflight`. In the browser
  request body's `events` array, observe zero or more optional identify/track events in application-
  supplied order, followed by the page event.
- Reload the same path plus search and navigate once; observe no duplicate request for the initial
  route and one page event for the later route.
- Inspect cookies before and after the successful browser response; observe no server-preview write
  and `ctfl-opt-aid` only when persistence consent permits it.
- A target `OptimizedEntry` renders a variant or baseline.
- Personalized results are not cached outside the request boundary.

## Validate the migration

- Search for `@ninetailed/experience.js-next`, SSR plugin imports, `ntaid`, and legacy React
  surfaces.
- Verify accepted server evaluation and denied-consent behavior.
- Run the integration guide's
  [browser commit, duplicate-route, and continuity-cookie checks](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#the-bound-root-and-page-events).
- Verify all-locale Contentful payloads are not used for optimized entries.
- Verify client-side plugin replacements only after the route and rendering work.

## Troubleshooting

| Symptom                                              | Check                                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Browser page events duplicate                        | Keep `OptimizationRoot` as the only route coordinator; remove the legacy tracker, `initialPageEvent` prop, and direct page calls. |
| `getServerSideProps` returns a 500 on API failure    | Wrap the server helper and render baseline on failure when your app needs graceful fallback.                                      |
| Browser render cannot find managed entries           | Pass `prefetchManagedEntries` descriptors in the `options` argument to `createRequestHandoff(context, options)`.                  |
| Server variant renders but no profile cookie appears | Run the browser Experience commit check; confirm JavaScript ran and browser persistence consent is true.                          |
| Hooks import fails                                   | Import React Web hooks from `@contentful/optimization-nextjs/client`, not `/pages-router`.                                        |

## Related guides

- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Choose a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Migrate an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrate experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
