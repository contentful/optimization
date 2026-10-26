# Astro + React compatibility exploration

Exploration date: October 26, 2026. Audience: developers evaluating Contentful Optimization for a
hybrid Astro app. This report concerns the implementation in this directory, not a general Astro
support certification.

## Assessment

The Optimization SDK can support Astro with React using the existing Node and React Web packages.
A dedicated Astro SDK is not required for the tested architecture. The natural integration is one
SDK-owning React island, with optional request-time personalization supplied by Astro's Node runtime.
The main friction is ownership of hydration, page events, consent, and state across islands. All
recommendations preserve one SDK version per dependency and one canonical live runtime and mutable
state per web page global context. Multiple SDK instances or fragmented state are not acceptable
solutions.

Use an on-demand route when personalized content must be present in the response HTML. Use a
prerendered route when baseline first paint and a later client update are acceptable. Static output
cannot derive visitor-specific content from request cookies at build time. This distinction follows
[Astro's rendering model](https://docs.astro.build/en/guides/on-demand-rendering/).

## Versions and scope

| Dependency                            | Version exercised                               |
| ------------------------------------- | ----------------------------------------------- |
| Astro                                 | 7.4.2                                           |
| Node adapter                          | `@astrojs/node` 11.1.9, standalone mode         |
| React integration                     | `@astrojs/react` 7.1.1                          |
| React and React DOM                   | 19.2.8                                          |
| Optimization Node, React Web, and Web | 2.1.1, local tarballs built from the repository |
| Node.js and pnpm                      | 26.12.1 and 12.5.1                              |
| Browser                               | Playwright 1.63.0 Chromium                      |

The implementation has an on-demand `/` route, a prerendered `/static` route, a personalized entry,
a separate counter island, consent controls, identification, and a custom CTA event. It uses existing
local CDA, Experience, and Insights fixtures. It does not claim full parity with other reference
implementations or validate live Contentful infrastructure.

## How the integration works

1. Astro fetches a single-locale baseline entry with linked variants. The CDA token stays in a
   server-only module. The static route does this during build; the on-demand route does it per request.
2. For a consented on-demand request, a reusable stateless Node SDK creates a request-bound client
   with the visitor's `ctfl-opt-aid` cookie and request URL context. Visitor data is never stored on
   the process-level SDK instance.
3. `prepareRequestHandoff()` previews the initial page using the Experience API. The app combines
   its replay and API-issued identity with `createRequestHandoffFromData({ data })` to preserve the
   selected content and profile snapshot. It marks browser presentation `preserve-server`.
4. Astro serializes the entry and handoff as props on a React component with `client:load`.
   `OptimizationRoot` renders the snapshot on the server and during initial hydration, then owns the
   browser SDK and commits the prepared page replay. The app does not separately call `page()` for
   that replay-backed load.
5. Browser SDK construction receives the application's cookie consent before it loads persistent
   state. Without a handoff, a guarded client effect calls `trackCurrentPage()` using the visible pathname and search string. `OptimizedEntry liveUpdates`
   can then update the build-time baseline after selections arrive.
6. The same island owns automatic entry tracking, identification, custom events, and event-stream
   subscriptions. The SDK persists identity after consent; the next full-document request reads it.

See [server preparation](./src/lib/server.ts), [React integration](./src/components/Personalization.tsx),
the [Node handoff contract](../../packages/node/node-sdk/src/handoff.ts), and the
[React root page ownership logic](../../packages/web/frameworks/react-web-sdk/src/root/OptimizationRoot.tsx).

## Compatibility and developer experience findings

| Area                                | Assessment                                    | Practical implication                                                                                                          |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Astro rendering and package imports | Compatible in the exercised production build. | No SDK source change, Astro-specific adapter, import alias, or Vite SSR override was needed.                                   |
| Personalized server HTML            | Supported through the Node handoff.           | Request-bound state and `client:load` preserve the selected first paint through hydration.                                     |
| Static personalization              | Supported after hydration.                    | Baseline HTML can be cached publicly, but personalized content appears later and requires JavaScript.                          |
| React hooks and components          | Work within one React island.                 | Astro markup and independently hydrated React islands do not share this provider context.                                      |
| Page analytics                      | Work with explicit ownership.                 | Replay-backed pages use the root; other document loads call `trackCurrentPage()`. There is no Astro router tracker in the SDK. |
| Entry and custom analytics          | Work through the hydrated browser runtime.    | Entry clicks use the resolved entry's tracking attributes. Custom events use `sdk.track()`.                                    |
| Consent and identity                | Application integration required.             | The app synchronizes its cookie with SDK event and persistence consent; the Node SDK does not read cookies itself.             |
| Full-document navigation            | Fits the tested lifecycle.                    | Each document creates one SDK owner; consented identity survives through cookies.                                              |
| Build-time data                     | Operational prerequisite.                     | Prerendering needs CDA availability and updates only when the static route is rebuilt.                                         |

### Pitfall inventory and resolution policy

Each entry defines the pitfall, identifies the workaround actually used, and separates proposed SDK
work from consumer responsibilities. Proposed changes below are **not implemented** by this
exploration. Source-backed risks and untested scenarios are identified separately from the identity
failure observed in the browser suite.

**Required invariant:** A web page global context has one canonical live Optimization SDK runtime
and one authoritative mutable state. Each SDK dependency must resolve to one version within that
context. Separate islands, frameworks, or analytics integrations must not create independent SDK
instances, load conflicting versions, copy signals into independent state stores, or create separate
profile, consent, selection, or event-queue authorities. Read-only server/hydration snapshots are
presentation inputs that attach to that canonical runtime, not independent live SDKs. A full-document
navigation creates a new global context; ClientRouter navigation does not.

No SDK source change was necessary for the tested single-island, full-document app. Proposed helpers
and diagnostics below reduce integration work; they are not prerequisites for its existing behavior.
The documented composition is one root around multiple React components within one hydrated React
tree. Independent Astro hydration boundaries do not inherit that context. ClientRouter needs separate
lifecycle validation; neither constraint authorizes additional instances or constructor state scopes.

### 1. Independent Astro islands do not inherit a surrounding React provider

**Pitfall:** React context follows the React component tree, not DOM ancestry. One
`OptimizationRoot` can surround any number of personalized React components in the same React tree;
all of those components share its SDK instance and state. However, Astro hydrates independently
marked `client:*` components using separate React roots. Nesting those islands beneath a provider
in `.astro` markup does not put them in the provider's React tree. Astro-rendered slot HTML is also
not a live React component subtree supplied by the provider.

**Workaround used:** `Personalization.tsx` imports and renders its SDK-dependent component subtree
beneath one `OptimizationRoot`, and Astro hydrates that parent once with `client:load`. Additional
personalized React components can be imported and rendered anywhere within that same React tree.
They do not need another provider, SDK instance, state scope, or a new SDK API. The independent
counter island has no SDK dependency.

**SDK change or consumer guidance:** No constructor, instance, or state-model change is required.
Keep the existing duplicate-instance rejection. Use a React composition component as the single
hydrated boundary for all components that consume Optimization context. Apply `client:load` to that
parent in `.astro`; import the consuming children inside its `.tsx` component rather than giving
each child an independent Astro hydration directive. These can be separate visible page regions,
but Astro treats the combined React tree as one island. The trade-off is a common hydration boundary
instead of independent Astro scheduling for each consuming region.

An outer provider in `.astro` around independently hydrated children does not remove that trade-off.
Do not change the SDK constructor to create multiple state scopes, introduce a runtime registry or
island attachment facility, or construct one SDK per island. The earlier attachment-facility proposal
is withdrawn. If independently hydrated SDK-consuming regions remain a hard application requirement,
that is a separate integration investigation; this exploration does not establish a supported
solution and does not justify changing the one-instance constraint.

See [Astro's context limitation](https://docs.astro.build/en/recipes/sharing-state-islands/),
[Astro React children parsing](https://docs.astro.build/en/guides/integrations-guide/react/#children-parsing),
the [Web constructor](../../packages/web/web-sdk/src/ContentfulOptimization.ts), and the
[React provider](../../packages/web/frameworks/react-web-sdk/src/provider/OptimizationProvider.tsx).

### 2. Server-rendered React HTML does not activate browser behavior

**Pitfall:** Without a `client:*` directive, Astro renders React HTML without running browser effects.
`client:idle` and `client:visible` delay initialization, analytics, and client personalization;
`client:only="react"` omits server rendering. Before live initialization, snapshot-backed content is
available but browser actions must wait. See
[Astro framework components](https://docs.astro.build/en/guides/framework-components/).

**Workaround used:** The SDK-owning component uses `client:load`; the independent counter uses
`client:idle`. `Experience` guards imperative calls with `isLive` and `sdk`, disables action buttons
until ready, and renders initialization errors before mounting SDK-dependent content.

**SDK change or consumer guidance:** No SDK can force Astro to hydrate an omitted or intentionally
deferred island. Document the required directive, snapshot-versus-live lifecycle, and error handling
in an Astro integration recipe. An Astro integration could validate common directive mistakes, but
must initialize only the canonical runtime. No additional runtime API is required for this app.

### 3. Static HTML cannot personalize its first paint per visitor

**Pitfall:** Build-time rendering cannot use an individual visitor's request cookies. A static route
therefore serves baseline HTML and requires JavaScript plus an Experience result to personalize.
A visible content change is possible; this exploration did not measure layout shift or flicker.

**Workaround used:** `/static` deliberately prerenders baseline content and enables
`OptimizedEntry liveUpdates` for the later browser result. `/` uses on-demand Node rendering and
`preserve-server` hydration when personalized response HTML is required.

**SDK change or consumer guidance:** This is a rendering constraint, not an SDK defect. Choose
on-demand rendering for visitor-specific response HTML, or accept and design for the client update
on static pages. An SDK recipe should explain that choice. Do not embed a visitor profile in public
static output or create a second SDK to resolve content independently. See
[Astro on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/).

### 4. Prerendering moves content availability and freshness to the build

**Pitfall:** The static route fetches CDA content during `astro build`. An unavailable CDA prevents
that build, and publishing content does not refresh already-generated baseline HTML. This app does
not provide a stale-build fallback or automatic rebuild trigger.

**Workaround used:** `fetchBaseline()` performs the build-time fetch. Local instructions require the
mock server before building; Playwright starts mocks before the production build. The on-demand
route fetches its baseline per request.

**SDK change or consumer guidance:** No SDK change can refresh a deployed static document by itself.
Document build-time CDA prerequisites and arrange content-triggered rebuilds, or use on-demand
rendering and an application-owned freshness policy. Do not treat successful browser personalization
as proof that the baseline entry and variant graph are up to date.

### 5. The Astro-to-React boundary accepts data, not live dependencies

**Pitfall:** SDK instances, callbacks, and Contentful clients are not suitable props for Astro to
serialize into a hydrated island. Passing credentials in props or `PUBLIC_` configuration exposes
them to the browser. Serializing complete baseline entries with linked variants also adds HTML
payload cost; that cost was not benchmarked.

**Workaround used:** Server-only `content.ts` fetches CDA data using non-public `CONTENTFUL_TOKEN`.
Astro passes only the baseline entry, route key, and optional handoff. The React module imports the
content type with a type-only import. The app does not prune the variant graph or optimize payload
size.

**Proposed SDK change:** Document the serializable handoff contract and which fields are required for
resolution and tracking. A validated minimal handoff serializer could reduce consumer mistakes and
payload size, but would need to retain linked variants and tracking metadata. No SDK change is
required for the data-only boundary already used here.

**Consumer guidance:** Create or acquire the canonical browser SDK on the browser side, not through
serialized props. Keep secrets in server-only modules; measure large entry graphs before choosing
payload pruning or managed client fetching. See
[Astro framework component props](https://docs.astro.build/en/guides/framework-components/).

### 6. Server preview data and prepared replay require manual composition

**Pitfall:** `prepareRequestHandoff()` returns preview `data` separately from handoff replay metadata.
Passing only replay metadata omits the selected snapshot needed for personalized server rendering;
passing only snapshot state omits the prepared browser commit. This is SDK wiring complexity, not
a demonstrated transport incompatibility.

**Workaround used:** `server.ts` combines the prepared handoff with
`createRequestHandoffFromData({ data })` and `hydration: 'preserve-server'`. The Node SDK remains
process-scoped and stateless; cookie identity and consent belong to the request-bound client.

**Proposed SDK change:** Add a documented composition helper, or an explicit option on preparation,
that returns a complete serializable content handoff containing snapshot state, replay, identity,
cache scope, and hydration policy. Preserve the distinction between preview and committed events;
do not introduce a second browser state authority.

**Consumer guidance:** Until then, preserve both parts exactly as this app does. On the server, never
store visitor state on the reusable SDK instance. See the
[Node handoff helper](../../packages/node/node-sdk/src/handoff.ts) and
[request preparation](../../packages/universal/core-sdk/src/CoreStatelessRequest.ts).

### 7. Missing or competing page owners cause missing or duplicate analytics

**Pitfall:** A plain `OptimizationRoot` without a handoff does not automatically emit an ordinary
Astro page visit. Conversely, emitting a server `page()` and independently tracking the same visit
in the browser can count it twice. Astro has no dedicated SDK router tracker in this implementation.

**Workaround used:** The root owns the prepared replay for handoff-backed requests. Only when there
is no handoff does a guarded browser effect call `trackCurrentPage()` with the visible pathname and
search string. The smoke suite checks one outgoing page event per exercised document navigation.

**Proposed SDK change:** Supply an Astro page-lifecycle adapter that delegates to the canonical
runtime's handoff admission and route deduplication. It must select one initial-page owner and
coordinate later navigation without adding SDK instances, constructor state scopes, or page owners. Existing
`trackCurrentPage()` and handoff APIs supply the runtime primitives.

**Consumer guidance:** Assign page ownership explicitly. Do not attach an unconditional second page
handler or use the route key alone as proof that a page was emitted. See the
[React root page logic](../../packages/web/frameworks/react-web-sdk/src/root/OptimizationRoot.tsx).

### 8. Handoff cache metadata does not configure HTTP or CDN caching

**Pitfall:** A `private-request` handoff can contain profile data and visitor-specific selections.
SDK cache-safety validation cannot stop an incorrectly configured Astro response or CDN from
sharing that HTML with another visitor.

**Workaround used:** The on-demand route sends `Cache-Control: private, no-store`. The prerendered
route receives no request handoff or visitor profile.

**SDK change or consumer guidance:** An Astro server helper could set safe response headers along
with preparing a private handoff, reducing separate configuration steps. Infrastructure outside the
SDK still requires consumer guidance: honor those headers, avoid shared caching of personalized
responses, and never put private request state into static output. No SDK-only change can enforce
all CDN policies. See the [cache contract](../../packages/universal/core-sdk/src/handoff.ts).

### 9. Server personalization adds request latency and a preview failure path

**Pitfall:** An on-demand personalized render waits for an Experience preview as well as CDA content.
If preview fails, selected preview state is unavailable. No latency benchmark or induced-outage
browser test was performed, so the size of the latency cost and recovery experience remain unmeasured.

**Workaround used:** `/` fetches baseline content and prepares personalization concurrently with
`Promise.all`. SDK preparation already catches preview failure and retains replay metadata; the app
then supplies baseline HTML and the browser may recover through replay. That fallback is verified
from source, not exercised by the smoke suite. CDA failure still fails the fetch; the app does not
provide an offline content cache.

**SDK change or consumer guidance:** Preview fallback already exists; it does not require a new SDK
runtime. Document its semantics and the configured API timeout behavior. Consumers should measure
latency, decide their server-rendering budget and baseline-content failure policy, and choose static
rendering where delayed personalization is acceptable. A framework adapter should preserve replay
on preview failure. See [request preparation](../../packages/universal/core-sdk/src/CoreStatelessRequest.ts).

### 10. Default consent policy and server/browser consent records can disagree

**Pitfall:** The default SDK pre-consent allow-list includes `page` and `identify`; that is not an
all-events-blocked policy. The Node SDK does not read application consent or identity cookies. Browser
SDK consent, persistence consent, and the application's consent record need an explicit common
policy. The identity cookie must remain readable by browser code for this hybrid continuation path.

**Workaround used:** Both runtimes use `allowedEventTypes: []`. Server preparation requires the
application cookie to equal `granted`; browser defaults resolve that same cookie. The controls update
both SDK consent axes and the application cookie, reset continuity on withdrawal, and reload. The
consent cookie adds `Secure` on HTTPS. The server reads `ctfl-opt-aid` into request-bound profile data.
The example identify control uses a fixed illustrative user ID, not an authentication integration.

**SDK change or consumer guidance:** Add an Astro recipe showing one application-owned consent policy
across server and browser, including persistence and withdrawal. A convenience preset for explicit
consent could reduce accidental reliance on defaults, but changing the SDK-wide default policy is a
separate product decision. Do not silently change it for Astro. Consumers must connect their CMP and
trusted identity flow and understand the browser-readable cookie requirement; those application
choices cannot be inferred by the SDK. See the
[Node knowledge](../../documentation/internal/sdk-knowledge/node/node.md) and
[React Web knowledge](../../documentation/internal/sdk-knowledge/web/react-web.md).

### 11. Late persistence consent deletes a returning visitor's identity

**Pitfall:** Initializing with `persistenceConsent: false` because a static route has no handoff
clears identity cookies and persisted continuity during SDK construction. Calling `consent(true)`
later cannot restore the deleted identity. This failure was observed: the smoke suite found a
different `ctfl-opt-aid` after navigation.

**Workaround used:** `Personalization.tsx` reads the application consent cookie before constructing
the owned root and supplies that value for both initial consent axes. Server rendering uses the
request's handoff presence for this app's explicit-consent path. The read-only static snapshot still
renders baseline content. Tests cover identification followed by navigation to `/static` and reload.

**Proposed SDK change:** Offer an initialization-time consent resolver on the canonical runtime that
runs before loading or clearing durable continuity, or an explicit bootstrap facility with the same
ordering guarantee. It should distinguish unresolved consent from explicit refusal and preserve
intentional withdrawal semantics. The existing `defaults` API already supports a synchronous known
decision; the proposed facility would standardize its timing and support clearer CMP integration.
Do not reinterpret explicit `false` as permission to retain identity.

**Consumer guidance:** Resolve consent before SDK creation. Do not derive it from handoff presence
on a static page, and do not initialize with `false` merely as a temporary loading value. See the
[Web constructor and persistence effects](../../packages/web/web-sdk/src/ContentfulOptimization.ts).

### 12. All-locales CDA payloads and inconsistent locale configuration break resolution assumptions

**Pitfall:** SDK entry resolution expects direct single-locale fields. `withAllLocales` or `locale=*`
changes the field shape, while a different Experience locale can produce inconsistent localized
content or MergeTag values. This is a documented input contract, not an Astro-specific defect found
by these tests.

**Workaround used:** `APP_LOCALE` is `en-US` in SDK configuration and the CDA request. The app fetches
linked variants with `include: 10` and passes the resulting single-locale entry unchanged.

**SDK change or consumer guidance:** Document the input contract in the Astro recipe. Clear diagnostics
for all-locales input could improve DX; silently guessing the locale or flattening the payload is
not a safe fix. Consumers must align CDA queries and SDK locale and fetch the linked variant data
needed by resolution. See the
[entry contract](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### 13. A late event subscription can miss the initial page event

**Pitfall:** Subscribing from a child effect after the initial replay begins can omit that event from
an application event log or forwarding integration. The live stream is not a historical event log.
This was identified while wiring the app and corrected before final smoke validation.

**Workaround used:** The root subscribes through `onStatesReady` and returns the subscription cleanup.
It receives events before publishing the live runtime to children. The event list is display-only;
it does not become another profile, consent, selection, or queue authority.

**SDK change or consumer guidance:** The necessary hook already exists. Document `onStatesReady` as
the setup point for initial-event observation and show cleanup and `messageId` deduplication for
external forwarding. Do not create a second SDK or page owner to reconstruct missed events. A new
replayable delivery stream is not required to fix this app. See the
[React Web event-stream contract](../../documentation/internal/sdk-knowledge/web/react-web.md).

### 14. Accepted events are not proof of successful delivery

**Pitfall:** Seeing an event in the SDK event stream proves acceptance, not a successful request to
the destination API. A UI log alone can therefore give false confidence about analytics transport.

**Workaround used:** The UI labels its list as accepted events and states that delivery is checked
separately. The CTA calls `track()` followed by `flush()`. The smoke suite also inspects outgoing
page requests and checks a successful entry-click Insights response. Calling `flush()` alone is not
used as proof of every event's delivery.

**SDK change or consumer guidance:** Document acceptance, queue flushing, and delivery as distinct
signals. If consumers need per-event delivery reporting, add explicit transport outcome diagnostics
on the same canonical runtime, rather than another sender or queue. That capability is a proposed
observability improvement, not something validated by this exploration. Consumer monitoring should
check actual responses and errors and avoid describing the accepted-event stream as delivered events.

### 15. ClientRouter changes the SDK lifetime and page-event lifecycle

**Pitfall:** Full-document navigation creates a fresh global context, whereas Astro ClientRouter
reuses the context while replacing content. Island replacement or persistence can therefore change
owner lifetimes, and a naive initializer may collide with the existing runtime or install competing
page handlers. Bundled scripts do not rerun for every transition. This is an untested integration
risk, not an observed ClientRouter failure in this app.

**Workaround used:** The app uses ordinary links and full-document loads. It does not contain a
ClientRouter workaround and makes no compatibility claim for that navigation mode.

**Proposed SDK change:** The Astro page adapter proposed in item 7 would coordinate the existing single
root and SDK with navigation, admit each applicable server handoff once, and track committed route
changes. It must not introduce per-island owners, an attachment registry, or constructor state
scopes. Preserving the one root across navigation, or ordering its replacement so SDK lifetimes do
not overlap, requires validation. `astro:page-load` is a lifecycle input, not sufficient implementation
by itself. No SDK constructor change is proposed.

**Consumer guidance:** Use the tested full-document path until a ClientRouter integration is
validated. Do not add an unconditional `astro:page-load` page call alongside the root's replay owner
or reinitialize the SDK after every swap. See
[Astro view transitions](https://docs.astro.build/en/guides/view-transitions/).

### Unexplored areas

Server islands (`server:defer`), persisted islands, edge adapters, streaming behavior, CSP policies,
preview tooling, offline recovery, hover/view thresholds, and cross-browser coverage were not
explored. Their omission is a scope boundary, not an observed incompatibility. These are validation
gaps, not additional proven pitfalls or a reason to introduce another SDK version or state runtime.

## Validation evidence

The focused suite lives in [e2e/hybrid.spec.ts](./e2e/hybrid.spec.ts) and runs against the production
Node build with local mock APIs. It covers baseline behavior before consent and after withdrawal,
personalized response HTML, hydration without browser errors, one outgoing page event per document,
static baseline followed by client personalization, identity continuity, an independent island,
identification, a custom event, and successful entry-click Insights delivery.

| Check                                              | Outcome                                                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build:pkgs`                                  | Passed; rebuilt and packed the SDK package graph.                                                                                         |
| Installed artifact comparison                      | 313 SDK runtime/declaration/artifact files matched the fresh tarballs across Node, React Web, Web, Core, and API Client.                  |
| `pnpm implementation:run -- astro-react typecheck` | Passed; 14 files, no errors, warnings, or hints.                                                                                          |
| `pnpm implementation:run -- astro-react lint`      | Passed.                                                                                                                                   |
| `pnpm implementation:run -- astro-react test:e2e`  | Passed; four Chromium tests against a fresh production build, including identity continuity after identification, navigation, and reload. |

Repository `format:check`, `knowledge:check`, `guides:check`, and `fern:check` also passed. Local
links in the README and this report resolve. Independent source review found no remaining actionable
issue after the persistence-consent correction.

No full shared web E2E matrix, SDK unit suite, live API check, edge deployment, load test, or browser
performance measurement is claimed. The new app does not modify SDK code or bundle-size budgets.
The repository's aggregate installation and lint paths discover the implementation, but there is no
dedicated Astro E2E CI job in this exploration.

## Recommended next step

For an Astro app using ordinary navigation, start with this single-island design and choose
on-demand rendering only for pages needing personalized response HTML. If the intended product uses
Astro ClientRouter, validate SDK lifetime and exactly-once page ownership under that router before
expanding feature coverage; that is the largest integration uncertainty left by this exploration.
