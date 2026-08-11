# Migrating experience.js Next.js to the Pages Router SDK

Use this guide when a Pages Router app uses `@ninetailed/experience.js-next`, SSR plugin behavior,
or legacy React surfaces and you want to move to the Optimization Pages Router SDK.

## What changes

The Pages Router target uses `@contentful/optimization-nextjs/pages-router` for browser components
and `@contentful/optimization-nextjs/pages-router/server` for `getServerSideProps`. Server props
own request evaluation and profile continuity; the browser root receives a request handoff and
continues with React Web behavior.

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

- Client binding helper, browser hooks, providers, and per-entry controls for the bound tree from
  `@contentful/optimization-nextjs/pages-router`.
- Server binding helper from `@contentful/optimization-nextjs/pages-router/server`.

Mount the target `OptimizationRoot` and `NextPagesAutoPageTracker` in `_app.tsx`, passing
`pageProps.contentfulOptimization.handoff` to the root. `contentfulOptimization` is an app-owned page
props wrapper; its `handoff` field is the SDK `BrowserOptimizationHandoff` returned by the server
binding's `createRequestHandoff(context, options)` helper. The handoff can contain browser consent defaults,
request-scoped optimization state, managed entries, and the required `initialPageEvent` value.

The root consumes the handoff's initial-page instruction. Keep the separate tracker mounted with
`initialPageEvent={handoff ? 'skip' : 'emit'}` so it skips the first route whenever the root has a
handoff and emits only when no handoff exists.

If migrated components will use `<OptimizedEntry entryId>`, configure the server binding with the
app's `contentful` client. Pass `prefetchManagedEntries` descriptors—entry IDs or objects containing
`entryId` and optional `entryQuery`—in the `options` passed to
`createRequestHandoff(context, options)`. The helper fetches those baselines and adds them to
`handoff.entries` before the props reach the root. The Pages Router client binding does not fetch
managed entries by itself.

### Replace server profile and page evaluation

In an app-owned server module, call `bindNextjsPagesRouterServerOptimization(config)` once and
destructure its returned `createRequestHandoff` helper. Call
`createRequestHandoff(context, options)` inside `getServerSideProps`, then assign the returned
handoff to the app-owned `contentfulOptimization.handoff` prop. If your app wraps this sequence in a
helper, define that helper in the server module before importing it into a page.

The server binding resolves request consent, emits the first page event when allowed, writes the
anonymous-id cookie when profile persistence permits it, and returns the request handoff. Observe
accepted server evaluation by checking
`contentfulOptimization.handoff.initialPageEvent === 'skip'`; observe denied consent by checking
that no Experience API call is made and the value is `'emit'`.

Pass the handoff to `OptimizationRoot`. The root follows its `initialPageEvent` value, while
`NextPagesAutoPageTracker` uses `initialPageEvent={handoff ? 'skip' : 'emit'}` to avoid duplicating
the root's first-route decision. Keep legacy route-change code removed.

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

Use [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
for plugin-specific replacement.

### Validate Pages Router migration

Verify the server and browser handoff:

- The server binding's `createRequestHandoff(context, options)` runs in `getServerSideProps` on the
  personalized page.
- The app-owned `pageProps.contentfulOptimization.handoff` reaches `OptimizationRoot` in `_app.tsx`.
- The handoff records accepted server evaluation with `initialPageEvent: 'skip'`, and the separate
  tracker skips whenever that handoff is present.
- A target `OptimizedEntry` renders a variant or baseline.
- Personalized results are not cached outside the request boundary.

## Validate the migration

- Search for `@ninetailed/experience.js-next`, SSR plugin imports, `ntaid`, and legacy React
  surfaces.
- Verify accepted server evaluation and denied-consent behavior.
- Verify all-locale Contentful payloads are not used for optimized entries.
- Verify client-side plugin replacements only after the route and rendering work.

## Troubleshooting

| Symptom                                           | Check                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| First page events duplicate                       | Pass the handoff to `OptimizationRoot`; set `NextPagesAutoPageTracker` to `initialPageEvent={handoff ? 'skip' : 'emit'}`. |
| `getServerSideProps` returns a 500 on API failure | Wrap the server helper and render baseline on failure when your app needs graceful fallback.                              |
| Browser render cannot find managed entries        | Pass `prefetchManagedEntries` descriptors in the `options` argument to `createRequestHandoff(context, options)`.          |
| Hooks cannot read the bound provider              | Import context-bound hooks from `@contentful/optimization-nextjs/pages-router`, not the generic `/client` runtime.        |

## Related guides

- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [Pages Router reference implementation](../../implementations/nextjs-sdk_pages-router/README.md)
