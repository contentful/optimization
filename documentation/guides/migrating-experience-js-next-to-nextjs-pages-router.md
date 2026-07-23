# Migrating experience.js Next.js to the Pages Router SDK

Use this guide when a Pages Router app uses `@ninetailed/experience.js-next`, SSR plugin behavior,
or legacy React surfaces and you want to move to the Optimization Pages Router SDK.

## What changes

The Pages Router target uses `@contentful/optimization-nextjs/pages-router` for browser components
and `@contentful/optimization-nextjs/pages-router/server` for `getServerSideProps`. Server props
own request evaluation and profile continuity; the browser root receives server state and continues
with React Web behavior.

Start with the
[Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).

## Before you migrate

Gather these inputs:

- Provider and tracker placement in `_app.tsx`.
- Every `getServerSideProps` path that uses SSR plugin behavior or `ntaid`.
- Legacy React components, hooks, flags, and mapper-dependent entries.
- Consent cookie, profile cookie, and initial page-event behavior.
- Any analytics, privacy, preview, or insights plugins.

## Migration path

1. Confirm this app should use Pages Router through
   [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md).
2. Migrate authored Contentful entries when legacy mapper output is still required. See
   [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md).
3. Install and bind the Pages Router client and server factories.
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

Use the target guide to create both factories:

- Client factory from `@contentful/optimization-nextjs/pages-router`.
- Server factory from `@contentful/optimization-nextjs/pages-router/server`.

Mount the target `OptimizationRoot` and `NextPagesAutoPageTracker` in `_app.tsx`, passing
`pageProps.contentfulOptimization`. That object is the SDK handoff returned from
`getServerSideOptimizationProps()`; it can contain browser consent defaults, server optimization
state, managed-entry prefetch handoff, and the required `initialPageEvent` value.

If migrated components will use `<OptimizedEntry entryId>`, configure the server factory with the
app's `contentful` client and pass `prefetchManagedEntries` in the server helper options before
switching those components. The Pages Router client factory does not fetch managed entries by
itself.

### Replace server profile and page evaluation

Move SSR plugin behavior into `getServerSideOptimizationProps(context)`. The server helper binds
request consent, emits the first page event when allowed, writes the anonymous-id cookie, and passes
server optimization state through page props. Observe accepted server evaluation by checking that
`contentfulOptimization.serverOptimizationState` is present and `initialPageEvent` is `skip`;
observe denied consent by checking that no Experience API call is made and `initialPageEvent` is
`emit`.

The target server helper resolves `initialPageEvent` so the browser tracker skips the first route
when the server reported it and emits when the server did not. Keep that value wired to the tracker
instead of duplicating legacy route-change code.

### Replace personalized rendering

Replace legacy React wrappers and mapper output with the Pages Router `OptimizedEntry`. It accepts a
manual `baselineEntry` or an `entryId` path backed by server-managed prefetch. It can use per-entry
loading, error, and live-update props because it is the React Web component bound for Pages Router.

If the first render depends on legacy `nt_*` fields, migrate the Contentful model before replacing
the component.

### Replace client-side extras

Client features use the React Web runtime:

- Flags use target flag reads and optional `trackFlagView()`.
- Analytics vendors use accepted and blocked event streams.
- Consent uses app-owned policy passed to server and browser SDK surfaces.
- Preview attaches to the live browser SDK through the preview panel package.

Use [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
for plugin-specific replacement.

### Validate Pages Router migration

Verify the server and browser handoff:

- `getServerSideOptimizationProps()` runs on the personalized page.
- `pageProps.contentfulOptimization` reaches `_app.tsx`.
- The browser tracker uses the server-provided `initialPageEvent`.
- A target `OptimizedEntry` renders a variant or baseline.
- Personalized results are not cached outside the request boundary.

## Validate the migration

- Search for `@ninetailed/experience.js-next`, SSR plugin imports, `ntaid`, and legacy React
  surfaces.
- Verify accepted server evaluation and denied-consent behavior.
- Verify all-locale Contentful payloads are not used for optimized entries.
- Verify client-side plugin replacements only after the route and rendering work.

## Troubleshooting

| Symptom                                           | Check                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| First page events duplicate                       | Pass the server `initialPageEvent` value from page props into `NextPagesAutoPageTracker`.    |
| `getServerSideProps` returns a 500 on API failure | Wrap the server helper and render baseline on failure when your app needs graceful fallback. |
| Browser render cannot find managed entries        | Use server-side managed prefetch and pass `prefetchedManagedEntries` through page props.     |
| Hooks import fails                                | Import React Web hooks from `@contentful/optimization-nextjs/client`, not `/pages-router`.   |

## Related guides

- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
