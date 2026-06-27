# Integrating the Optimization Web SDK in a web app

Use this guide when you want to implement browser-side personalization and analytics in a static
site, multi-page app, SPA, or custom frontend runtime using `@contentful/optimization-web`.

The examples use vanilla browser APIs. If you are building a React application and want official
providers, hooks, components, and router adapters, use
[Integrating the Optimization React Web SDK in a React app](./integrating-the-react-web-sdk-in-a-react-app.md)
instead.

## Quick start

Use this path when your application policy permits Optimization to start with accepted consent. If
your policy requires an end-user choice first, complete the consent handoff section before sending
events.

1. Install the browser SDK and a Contentful delivery client in your web application.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-web contentful
   ```

2. Create one Web SDK instance for the page or SPA runtime, then emit one `page()` event, fetch one
   single-locale Contentful entry, resolve the selected variant, and render it.

   **Adapt this to your use case:**

   ```ts
   import * as contentful from 'contentful'
   import ContentfulOptimization from '@contentful/optimization-web'

   const APP_LOCALE = 'en-US'

   const contentfulClient = contentful.createClient({
     accessToken: 'your-contentful-delivery-token',
     environment: 'main',
     space: 'your-space-id',
   })

   const optimization = new ContentfulOptimization({
     clientId: 'your-optimization-client-id',
     environment: 'main',
     locale: APP_LOCALE,
     // Only use default-on consent when application policy permits it.
     defaults: { consent: true },
     app: {
       name: 'my-web-app',
       version: '1.0.0',
     },
   })

   // Emit the page event before resolving entries so selections are current.
   const pageResult = await optimization.page()
   const baselineEntry = await contentfulClient.getEntry('hero-entry-id', {
     include: 10,
     locale: APP_LOCALE,
   })
   // Passing [] falls back to the baseline when the page event is blocked or has no data.
   const selectedOptimizations = pageResult.accepted ? pageResult.data?.selectedOptimizations : []
   const { entry } = optimization.resolveOptimizedEntry(baselineEntry, selectedOptimizations ?? [])

   const hero = document.querySelector<HTMLElement>('#hero')
   if (hero) {
     hero.textContent = String(entry.fields.headline ?? '')
   }
   ```

3. Verify the hero renders from the selected variant when the visitor matches an optimization, or
   from the baseline entry when no optimization is selected or no Optimization data is available.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Install and initialize the browser singleton](#install-and-initialize-the-browser-singleton)
  - [Consent and privacy handoff](#consent-and-privacy-handoff)
  - [Page and route events](#page-and-route-events)
  - [Contentful fetching, entry resolution, and fallback rendering](#contentful-fetching-entry-resolution-and-fallback-rendering)
  - [State subscriptions, locale changes, and rerenders](#state-subscriptions-locale-changes-and-rerenders)
  - [Identity, profile continuity, and reset](#identity-profile-continuity-and-reset)
  - [Entry interactions and business events](#entry-interactions-and-business-events)
- [Optional integrations](#optional-integrations)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Web Components entry rendering](#web-components-entry-rendering)
  - [Preview panel](#preview-panel)
  - [Analytics forwarding](#analytics-forwarding)
- [Advanced integrations](#advanced-integrations)
  - [Hybrid SSR and browser continuity](#hybrid-ssr-and-browser-continuity)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

The full guide uses these setup items:

| Setup item                                                          | Category                       | Required for quick start | Where to configure                                                                   |
| ------------------------------------------------------------------- | ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------ |
| `@contentful/optimization-web` package                              | Required for first integration | Yes                      | Application package manager                                                          |
| Contentful delivery client package                                  | Required for first integration | Yes                      | Application package manager and Contentful client factory                            |
| Optimization client ID and environment                              | Required for first integration | Yes                      | Runtime configuration passed to `new ContentfulOptimization(...)`                    |
| Contentful space, environment, and access token                     | Required for first integration | Yes                      | Application-owned Contentful client configuration                                    |
| Non-default Contentful CDA host                                     | Common but policy-dependent    | No                       | Application-owned Contentful client host or endpoint configuration                   |
| Application Contentful locale and SDK Experience/event locale       | Required for first integration | Yes                      | Router, i18n layer, and SDK `locale`                                                 |
| Single-locale Contentful entry and CDA `include` depth for variants | Required for first integration | Yes                      | Contentful content model and CDA `include` depth                                     |
| Initial page event                                                  | Required for first integration | Yes                      | Browser entrypoint or first SPA route                                                |
| SPA route-change hook                                               | Common but policy-dependent    | No                       | Router or navigation layer                                                           |
| Consent and persistence policy                                      | Common but policy-dependent    | Conditional              | SDK `defaults`, `allowedEventTypes`, `consent(...)`, and application CMP or banner   |
| Identity policy for known users                                     | Common but policy-dependent    | No                       | Authentication, account, or profile layer that calls `identify(...)` and `reset()`   |
| State subscriptions for rerenders, diagnostics, or forwarding       | Common but policy-dependent    | No                       | SDK `states.*` subscribers and application teardown                                  |
| Entry interaction tracking                                          | Common but policy-dependent    | No                       | SDK `autoTrackEntryInteraction`, `tracking.*`, and rendered `data-ctfl-*` attributes |
| Rich Text renderer packages for merge tags                          | Optional                       | No                       | `@contentful/rich-text-html-renderer` and `@contentful/rich-text-types`              |
| Web Components entrypoint                                           | Optional                       | No                       | `@contentful/optimization-web/web-components`                                        |
| `@contentful/optimization-web-preview-panel` package                | Optional                       | No                       | Environment-gated dynamic import and `attachOptimizationPreviewPanel(...)`           |
| Analytics or tag-manager forwarding                                 | Optional                       | No                       | Application-level `states.eventStream` subscriber                                    |
| Preview panel CSP nonce                                             | Advanced or production-only    | No                       | Preview panel `nonce` option or `window.litNonce`                                    |
| Shared Node/Web anonymous ID continuity                             | Advanced or production-only    | No                       | Server cookies, `ANONYMOUS_ID_COOKIE`, and browser Web SDK initialization            |
| Production event, privacy, and cache validation                     | Advanced or production-only    | No                       | Release checklist, observability, and deployment configuration                       |

Keep the default path single-locale. Fetch entries for SDK resolution with one concrete Contentful
locale and enough include depth for linked optimization entries and variants. Do not pass
`contentful.js` `withAllLocales` results or raw CDA `locale=*` responses to
`resolveOptimizedEntry()`.

## Core integration

### Install and initialize the browser singleton

**Integration category:** Required for first integration

The Web SDK is stateful. Create one SDK instance for the active page or SPA runtime and reuse it
across components, route handlers, and interaction handlers.

1. Install `@contentful/optimization-web` and the Contentful delivery client your app uses.
2. Read runtime configuration from your bundler, server-injected environment, or deployment
   configuration.
3. Pass the Optimization `clientId`, `environment`, optional API base URLs, `locale`, and app
   metadata to the constructor.
4. Keep the instance in a module-level binding or another singleton container. The browser runtime
   attaches it to `window.contentfulOptimization` and throws if another instance is already active.
5. Call `destroy()` only for explicit teardown paths such as tests, hot reload, or a framework root
   unmount that owns the instance.

**Adapt this to your use case:**

```ts
import * as contentful from 'contentful'
import ContentfulOptimization from '@contentful/optimization-web'

const APP_CONFIG = {
  contentfulAccessToken: 'your-contentful-delivery-token',
  contentfulEnvironment: 'main',
  contentfulSpaceId: 'your-space-id',
  optimizationClientId: 'your-optimization-client-id',
  optimizationEnvironment: 'main',
  experienceBaseUrl: 'https://experience.ninetailed.co/',
  insightsBaseUrl: 'https://ingest.insights.ninetailed.co/',
} as const

const APP_LOCALE = 'en-US'

export const contentfulClient = contentful.createClient({
  accessToken: APP_CONFIG.contentfulAccessToken,
  environment: APP_CONFIG.contentfulEnvironment,
  space: APP_CONFIG.contentfulSpaceId,
})

// Reuse this singleton across route, render, and tracking handlers.
export const optimization = new ContentfulOptimization({
  clientId: APP_CONFIG.optimizationClientId,
  environment: APP_CONFIG.optimizationEnvironment,
  locale: APP_LOCALE,
  app: {
    name: 'my-web-app',
    version: '1.0.0',
  },
  api: {
    experienceBaseUrl: APP_CONFIG.experienceBaseUrl,
    insightsBaseUrl: APP_CONFIG.insightsBaseUrl,
  },
  logLevel: 'warn',
})
```

The Web SDK does not replace the Contentful delivery client. Your application still owns Contentful
credentials, entry fetching, routing, rendering, consent policy, identity policy, and cache policy.

For locale mechanics, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).
Changing the SDK locale with `optimization.setLocale(nextLocale)` updates subsequent Experience API
requests and event context. It does not refetch Contentful entries or clear application caches.

### Consent and privacy handoff

**Integration category:** Common but policy-dependent

The Web SDK exposes consent state and event gates. Your application owns the consent policy, user
experience, legal basis, CMP records, and downstream destination policy.

1. If application policy permits Optimization by default and you do not render a user consent UI,
   seed accepted consent at startup.
2. If consent depends on user choice, decide whether any pre-consent Optimization events are
   permitted. The Web SDK default allow-list permits `identify` and `page` while event consent is
   `undefined` or `false`.
3. For strict opt-in policies, pass `allowedEventTypes: []`, leave `defaults.consent` unset, and
   call `consent(...)` from the application-owned banner or CMP callback.
4. Use object-form consent when events are permitted but durable profile-continuity storage must
   remain session-only.
5. Configure `allowedEventTypes` only after privacy review approves which event types can emit while
   event consent is `undefined` or `false`.
6. Subscribe to `states.blockedEventStream` during development to verify which calls are blocked by
   consent.

**Copy this:**

```ts
const optimization = new ContentfulOptimization({
  clientId: APP_CONFIG.optimizationClientId,
  // Starts event emission and durable profile continuity immediately.
  defaults: { consent: true },
})
```

Use strict opt-in when no Optimization event can emit until the user accepts consent:

**Copy this:**

```ts
const optimization = new ContentfulOptimization({
  clientId: APP_CONFIG.optimizationClientId,
  // Replaces the Web SDK default pre-consent allow-list of identify and page.
  allowedEventTypes: [],
})
```

**Adapt this to your use case:**

```ts
const acceptButton = document.querySelector<HTMLButtonElement>('#consent-accept')
const rejectButton = document.querySelector<HTMLButtonElement>('#consent-reject')

acceptButton?.addEventListener('click', () => {
  // Boolean consent updates both event and persistence consent.
  optimization.consent(true)
})

rejectButton?.addEventListener('click', () => {
  optimization.consent(false)
})

optimization.states.consent.subscribe((consent) => {
  document.documentElement.dataset.optimizationConsent = String(consent)
})
```

Boolean consent calls update both event consent and durable profile-continuity persistence consent.
Use this form when events can emit but profile, selected optimizations, changes, and the anonymous
ID must not persist beyond the session:

**Copy this:**

```ts
optimization.consent({ events: true, persistence: false })
```

Calling `consent(false)` blocks subsequent non-allowed events and clears SDK-managed durable
profile-continuity storage. It does not clear the active in-memory profile or erase application,
server, CMP, or third-party records. Call `reset()` when the active browser profile must be removed
from the current session.

For cross-SDK policy guidance, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Page and route events

**Integration category:** Required for first integration

`page()` evaluates the current browser page and updates SDK state with the returned profile,
changes, and selected optimizations.

1. Emit `page()` after SDK initialization for a multi-page application or first SPA route.
2. In SPAs, emit another page event whenever the active route-like experience changes.
3. Use `trackCurrentPage()` when a router integration needs route-key deduplication. Manual `page()`
   calls always emit when consent permits them.
4. Include stable page properties such as URL, path, search, referrer, and title when your router or
   analytics taxonomy needs them.
5. Inspect the returned `{ accepted, data }` result. `{ accepted: false }` means consent or SDK
   guards blocked the event.

**Copy this:**

```ts
const result = await optimization.page()
```

**Adapt this to your use case:**

```ts
function getRouteKey(): string {
  return `${window.location.pathname}${window.location.search}`
}

function buildCurrentPagePayload() {
  const url = new URL(window.location.href)

  return {
    name: document.title,
    properties: {
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      referrer: document.referrer,
      search: url.search,
      title: document.title,
      url: url.toString(),
    },
  }
}

async function trackRoute(): Promise<void> {
  await optimization.trackCurrentPage({
    // Stable route keys prevent duplicate SPA page events.
    routeKey: getRouteKey(),
    buildPayload: buildCurrentPagePayload,
  })
}

void trackRoute()

router.onRouteChange(() => {
  void trackRoute()
})
```

Replace `router.onRouteChange(...)` with your framework or router hook. In hybrid apps where the
server already emitted the first page event, use `initialPageEvent: 'skip'` for the first browser
route.

### Contentful fetching, entry resolution, and fallback rendering

**Integration category:** Required for first integration

The browser app fetches Contentful entries. The Web SDK chooses the current variant after the
baseline entry and Experience API selections exist.

1. Fetch the baseline Contentful entry with one CDA locale and enough include depth to resolve
   optimization entries and variants.
2. Call `page()` or `identify()` before rendering optimized content so SDK state has current
   `selectedOptimizations`.
3. Pass the baseline entry to `resolveOptimizedEntry()`. In a stateful Web SDK integration, the
   method uses current SDK state when you omit the second argument.
4. Render the returned `entry`. If no matching optimization exists, the SDK returns the baseline
   entry.
5. Store the baseline entry ID separately from the resolved entry ID so later rerenders do not
   resolve a previously selected variant as though it were the baseline.
6. Add tracking attributes when the rendered element represents the resolved entry and will be used
   for automatic entry interaction tracking.

**Adapt this to your use case:**

```ts
async function renderEntry(entryId: string, element: HTMLElement): Promise<void> {
  const baselineEntry = await contentfulClient.getEntry(entryId, {
    include: 10,
    locale: APP_LOCALE,
  })

  // Omitted selections use current SDK state from the most recent accepted page or identify call.
  const resolved = optimization.resolveOptimizedEntry(baselineEntry)
  const { entry, optimizationContextId, selectedOptimization } = resolved

  element.textContent = String(entry.fields.headline ?? '')

  // Keep the baseline ID separate so rerenders do not resolve a variant as the baseline.
  element.dataset.ctflBaselineId = baselineEntry.sys.id
  element.dataset.ctflEntryId = entry.sys.id

  if (optimizationContextId) {
    element.dataset.ctflOptimizationContextId = optimizationContextId
  } else {
    delete element.dataset.ctflOptimizationContextId
  }

  if (selectedOptimization) {
    element.dataset.ctflOptimizationId = selectedOptimization.experienceId
    element.dataset.ctflSticky = String(selectedOptimization.sticky)
    element.dataset.ctflVariantIndex = String(selectedOptimization.variantIndex)
  } else {
    delete element.dataset.ctflOptimizationId
    delete element.dataset.ctflSticky
    delete element.dataset.ctflVariantIndex
  }
}
```

Entry resolution expects standard single-locale CDA fields such as `fields.nt_experiences` and
`fields.nt_variants`. All-locale CDA responses put field values under locale keys and cause
resolution to fall back to the baseline entry.

For deeper mechanics and fallback behavior, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md).

### State subscriptions, locale changes, and rerenders

**Integration category:** Common but policy-dependent

The Web SDK stores the most recent accepted profile, changes, selected optimizations, consent state,
and diagnostic streams. Use state subscriptions for UI glue and rerenders.

1. Subscribe to `states.selectedOptimizations` when optimized entries need to rerender after
   `page()`, `identify()`, or live state changes.
2. Subscribe to `states.profile` for identity-aware UI and diagnostics.
3. Subscribe to `states.consent` and `states.persistenceConsent` when a local consent UI needs SDK
   state.
4. Subscribe to `states.eventStream` and `states.blockedEventStream` for local diagnostics or
   approved analytics forwarding.
5. Unsubscribe when the page root, framework root, or long-lived view is torn down.
6. When the app locale changes, update the SDK locale, refetch Contentful entries with the updated
   CDA locale, and emit a fresh `page()` or `identify()` call when profile data must refresh.

**Adapt this to your use case:**

```ts
const subscriptions = [
  optimization.states.profile.subscribe((profile) => {
    const badge = document.querySelector('#profile-id')
    if (badge) badge.textContent = profile?.id ?? 'anonymous'
  }),
  optimization.states.selectedOptimizations.subscribe((selectedOptimizations) => {
    if (selectedOptimizations === undefined) return

    // Rerender after page(), identify(), or live updates change the selected variants.
    void renderVisibleEntries()
  }),
  optimization.states.blockedEventStream.subscribe((blockedEvent) => {
    if (!blockedEvent) return

    console.info(`Blocked Optimization event: ${blockedEvent.method}`)
  }),
]

window.addEventListener('beforeunload', () => {
  subscriptions.forEach((subscription) => subscription.unsubscribe())
})
```

Each observable immediately emits its current snapshot and then emits later updates. Use `.current`
for a synchronous read, for example `optimization.states.profile.current`.

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Call `identify()` when the browser session becomes associated with a known user. Call `reset()` when
the active browser identity must be discarded.

1. Call `identify()` after sign-in, account lookup, or persisted auth refresh when your consent and
   identity policy permits the profile association.
2. Pass stable user identifiers and traits that your application is allowed to send.
3. After logout, account switch, consent withdrawal that ends profile continuity, or a similar
   identity boundary, call `reset()`.
4. Emit another `page()` when the app still needs browser-side optimization after reset.
5. Clear application-owned cookies, sessions, third-party identifiers, or server state separately.
   `reset()` clears SDK profile state and the SDK anonymous ID cookie, but it is not a CMP or server
   cleanup API.

**Adapt this to your use case:**

```ts
async function handleLogin(user: { id: string; plan: string }): Promise<void> {
  await optimization.identify({
    userId: user.id,
    traits: {
      authenticated: true,
      plan: user.plan,
    },
  })
}

async function handleLogout(): Promise<void> {
  // reset() clears SDK profile state, not application-owned sessions or CMP records.
  optimization.reset()

  await optimization.page()
}
```

When persistence consent is true, the Web SDK can restore profile continuity from browser storage
and the readable `ctfl-opt-aid` anonymous ID cookie. When persistence consent is false or unset, the
SDK does not load durable profile continuity.

### Entry interactions and business events

**Integration category:** Common but policy-dependent

Use entry interaction tracking when rendered Contentful entries need Analytics events for views,
clicks, or hovers. Use `track()` for custom business events.

1. Leave the automatic interaction types your policy and product analytics plan permits enabled. The
   Web SDK constructor defaults `views`, `clicks`, and `hovers` to `true`; pass `false` for
   interactions that must opt out.
2. Render `data-ctfl-entry-id` on each auto-tracked entry element. Use the resolved entry ID, not
   the baseline entry ID.
3. Add `data-ctfl-optimization-id`, `data-ctfl-optimization-context-id`, `data-ctfl-sticky`, and
   `data-ctfl-variant-index` when the resolved entry came from an optimization.
4. For click tracking, use semantic clickable elements such as `<button>` and `<a href>`, or mark a
   non-semantic clickable path with `data-ctfl-clickable="true"`.
5. Use `tracking.enableElement(...)` when the DOM structure cannot use standard `data-ctfl-*`
   attributes.
6. Use `track()` for business events such as quote requests, form completions, or checkout
   milestones.

**Copy this:**

```ts
const optimization = new ContentfulOptimization({
  clientId: APP_CONFIG.optimizationClientId,
  // Opt out of interactions your consent and analytics policy does not permit.
  autoTrackEntryInteraction: { hovers: false },
})
```

**Adapt this to your use case:**

```html
<!-- Use the resolved entry ID, not the baseline entry ID, for automatic tracking. -->
<article
  data-ctfl-entry-id="resolved-entry-id"
  data-ctfl-optimization-id="experience-id"
  data-ctfl-optimization-context-id="optimization-context-id"
  data-ctfl-sticky="true"
  data-ctfl-variant-index="1"
>
  <button type="button">Request a quote</button>
</article>
```

**Adapt this to your use case:**

```ts
optimization.tracking.enableElement('views', element, {
  // Manual data takes precedence over data-ctfl-* attributes for this element.
  data: {
    entryId: resolved.entry.sys.id,
    optimizationContextId: resolved.optimizationContextId,
    optimizationId: resolved.selectedOptimization?.experienceId,
    sticky: resolved.selectedOptimization?.sticky,
    variantIndex: resolved.selectedOptimization?.variantIndex,
  },
  dwellTimeMs: 1000,
})

await optimization.track({
  event: 'quote_requested',
  properties: {
    plan: 'enterprise',
    source: 'pricing-page',
  },
})
```

Manual element data takes precedence over `data-ctfl-*` values on the same element. Use
`tracking.disableElement(...)` to force-disable one element, or `tracking.clearElement(...)` to
remove the manual override and fall back to attributes or global automatic tracking.

For thresholds, attribute precedence, DOM discovery, and delivery paths, see
[Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md).

## Optional integrations

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags when rendered Rich Text contains Contentful MergeTag entries. Use Custom Flags when
an optimization response contains variable changes that control UI behavior.

1. Install the Rich Text renderer packages when your app does not already provide an equivalent Rich
   Text rendering path.

   **Copy this:**

   ```sh
   pnpm add @contentful/rich-text-html-renderer @contentful/rich-text-types
   ```

2. Resolve merge tags while rendering Rich Text. The Web SDK defaults to the current profile state
   when you omit the profile argument.
3. Keep the SDK Experience/event locale aligned with the Contentful CDA locale when localized
   profile values, such as location fields, need to match the rendered content language.
4. Read Custom Flags with `getFlag(name)` or `states.flag(name)`.
5. Treat flag reads as Analytics exposure points. In stateful Web SDKs, flag reads auto-emit a flag
   view event when consent and profile state permit it, and repeated reads of the same value are
   deduplicated.

**Adapt this to your use case:**

```ts
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES } from '@contentful/rich-text-types'
import { isMergeTagEntry } from '@contentful/optimization-web/api-schemas'

const html = documentToHtmlString(article.fields.body, {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (!isMergeTagEntry(node.data.target)) return ''

      // Omit the profile argument to use the Web SDK's current profile state.
      return optimization.getMergeTagValue(node.data.target) ?? ''
    },
  },
})
```

**Adapt this to your use case:**

```ts
const navigationFlag = 'new-navigation'

// Flag reads and subscriptions emit flag-view events when consent and profile state permit it.
document.body.dataset.newNavigation = String(optimization.getFlag(navigationFlag) === true)

optimization.states.flag(navigationFlag).subscribe((value) => {
  document.body.dataset.newNavigation = String(value === true)
})
```

### Web Components entry rendering

**Integration category:** Optional

The optional Web Components entrypoint provides vanilla custom elements for SDK ownership and entry
resolution without a framework adapter.

1. Import `defineContentfulOptimizationElements()` from
   `@contentful/optimization-web/web-components`.
2. Call the registration function once before using `<ctfl-optimization-root>` or
   `<ctfl-optimized-entry>`.
3. Use one root for entries that share one SDK instance. The root can create the SDK from attributes
   and assigned properties, or it can reuse an existing `window.contentfulOptimization` instance.
4. Assign structured values such as `defaults`, `api`, `trackEntryInteraction`, `sdk`, and
   `baselineEntry` as DOM properties, not string attributes.
5. Listen for `ctfl-entry-loading`, `ctfl-entry-resolved`, and `ctfl-entry-error` to render
   application-owned UI.

**Adapt this to your use case:**

```ts
import {
  type ContentfulOptimizationRootElement,
  type ContentfulOptimizedEntryElement,
  type ContentfulOptimizedEntryEventDetail,
  defineContentfulOptimizationElements,
} from '@contentful/optimization-web/web-components'

defineContentfulOptimizationElements()

const root = document.querySelector<ContentfulOptimizationRootElement>('ctfl-optimization-root')
const entry = document.querySelector<ContentfulOptimizedEntryElement>('ctfl-optimized-entry')

if (root) {
  // Structured SDK options must be assigned as properties, not string attributes.
  root.defaults = { consent: true }
  root.trackEntryInteraction = { hovers: false }
}

if (entry) {
  // Contentful entries are structured objects, so baselineEntry is property-only.
  entry.baselineEntry = baselineEntry
  entry.addEventListener('ctfl-entry-resolved', (event) => {
    const { detail } = event as CustomEvent<ContentfulOptimizedEntryEventDetail>

    renderHero(detail.entry)
  })
}
```

**Follow this pattern:**

```html
<ctfl-optimization-root client-id="your-optimization-client-id" environment="main" locale="en-US">
  <ctfl-optimized-entry id="hero-entry"></ctfl-optimized-entry>
</ctfl-optimization-root>
```

`@contentful/optimization-web/web-components` is side-effect-free. Custom elements are registered
only when `defineContentfulOptimizationElements()` runs. If the root owns the SDK instance,
`trackEntryInteraction` defaults view, click, and hover tracking to enabled. The lower-level
`ContentfulOptimization` constructor uses the same automatic interaction defaults.

Use `live-updates` on the root or an optimized entry only when a rendered entry needs to respond to
later selected-optimization changes instead of keeping its first resolved value.

### Preview panel

**Integration category:** Optional

The preview panel is a separate browser package for development, preview, and staging workflows. It
attaches a Lit-based panel to `document.body`, uses an existing Contentful Delivery API client to
read preview content, and talks to an existing Web SDK instance through the browser preview bridge.

1. Install `@contentful/optimization-web-preview-panel` only when your app needs browser authoring
   tooling.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-web-preview-panel
   ```

2. Gate the dynamic import behind an environment value so production bundles can remove preview code
   when the gate is replaced with `false` at build time.
3. Attach the panel after the Web SDK singleton and Contentful client exist. The attach function
   uses `window.contentfulOptimization` by default.
4. Pass the `optimization` option when your app owns an SDK instance that is not available through
   `window.contentfulOptimization`.
5. Pass a CSP `nonce` when strict Content Security Policy rules require one for Lit styles.
6. Expect SDK-controlled optimized entries to live-update while the panel drawer is open. Manual
   renderers still need `states.selectedOptimizations` subscriptions if they must react to preview
   overrides.

**Adapt this to your use case:**

```ts
let previewPanelAttachmentStarted = false

function attachPreviewPanel(): void {
  if (import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'true') return
  if (previewPanelAttachmentStarted) return

  previewPanelAttachmentStarted = true

  void import('@contentful/optimization-web-preview-panel')
    .then(async ({ default: attachOptimizationPreviewPanel }) => {
      await attachOptimizationPreviewPanel({
        contentful: contentfulClient,
        // Omit this when the preview panel can use window.contentfulOptimization.
        optimization,
        nonce: APP_CONFIG.cspNonce,
      })
    })
    .catch((error: unknown) => {
      previewPanelAttachmentStarted = false
      console.warn('Failed to attach the Contentful Optimization preview panel.', error)
    })
}

attachPreviewPanel()
```

The attach function is side-effect-free until called. Repeated calls reuse the in-flight or
completed attachment. While the panel is open, Web Components entry rendering treats live updates as
enabled so preview overrides can render without toggling `live-updates` on the root or entry.

### Analytics forwarding

**Integration category:** Optional

Use this integration when your browser app already sends events to a tag manager, customer data
platform, or analytics destination. The Optimization SDK still sends its own events to Contentful.
Your application decides which approved Contentful context, if any, can also be forwarded.

1. Register one app-level `states.eventStream` subscription after SDK initialization.
2. Forward only events and fields approved by your governance policy.
3. Dedupe exact event records with `messageId` so current snapshots, subscriber remounts, retries,
   or duplicate browser deliveries do not resend the same SDK event record.
4. If the destination must receive only future SDK events, read the current `messageId` before
   subscribing and skip that event.
5. Add semantic exposure dedupe when the destination wants one exposure for a sticky view or view
   lifecycle. Use fields such as `viewId`, `componentId`, `experienceId`, and `variantIndex`.
6. Buffer destination calls in application code only when you have explicit size, TTL, and drop
   policies.
7. Use `states.blockedEventStream` and destination debuggers to validate consent behavior.

In this example, `canForwardSdkEvent()` enforces your governance and consent allow-list,
`shouldForwardContentfulEvent()` applies destination-specific semantic dedupe, and
`pickContentfulEventProperties()` maps only approved fields.

**Follow this pattern:**

```ts
const forwardedMessageIds = new Set<string>()
const initialMessageId = optimization.states.eventStream.current?.messageId

// eventStream is live; register the subscription once during SDK initialization.
const analyticsSubscription = optimization.states.eventStream.subscribe((event) => {
  if (!event) return
  if (forwardedMessageIds.has(event.messageId)) return
  if (event.messageId === initialMessageId) {
    forwardedMessageIds.add(event.messageId)
    return
  }
  if (!canForwardSdkEvent(event)) return

  forwardedMessageIds.add(event.messageId)

  if (!shouldForwardContentfulEvent(event)) return

  analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
})

window.addEventListener('beforeunload', () => {
  analyticsSubscription.unsubscribe()
})
```

For destination mappings, helper examples, consent alignment, identity, dedupe, and governance, see
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

## Advanced integrations

### Hybrid SSR and browser continuity

**Integration category:** Advanced or production-only

Use this integration when the same app uses `@contentful/optimization-node` on the server and
`@contentful/optimization-web` in the browser.

1. Decide whether the server or browser owns the first personalization decision for each route.
2. Share the anonymous profile identifier with the SDK `ANONYMOUS_ID_COOKIE` value when consent
   permits durable profile continuity.
3. Write the cookie from the server with `path: '/'` and a same-site policy that matches your app.
4. Do not mark the cookie `HttpOnly` if browser code must read it.
5. On consent denial or revocation, clear the shared anonymous ID cookie and avoid persisting a
   returned profile ID.
6. Use `trackCurrentPage({ initialPageEvent: 'skip', ... })` when the server already emitted the
   same initial page event and the browser takes over subsequent route events.
7. Treat server-rendered personalized HTML or profile-derived values as personalized output for
   cache policy. Avoid shared caching unless you vary on all relevant personalization inputs.

**Follow this pattern:**

```ts
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-web/constants'

function buildAnonymousIdSetCookie(id: string | undefined): string {
  if (!id) return `${ANONYMOUS_ID_COOKIE}=; Max-Age=0; Path=/`

  // Browser code must be able to read this cookie for Web SDK continuity.
  return `${ANONYMOUS_ID_COOKIE}=${id}; Path=/; SameSite=Lax`
}
```

For the lower-level mechanics, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

## Production checks

Before release, verify these behaviors in the target deployment:

- **Credentials and runtime configuration** - The browser receives the intended Optimization client
  ID, Optimization environment, Contentful space, Contentful environment, CDA host, API base URLs,
  app metadata, and locale values. No secret Management API token is exposed to the browser.
- **Consent behavior** - Default-on integrations start with `defaults: { consent: true }` only when
  application policy permits it. CMP-driven integrations keep consent unset until a choice exists,
  use `allowedEventTypes: []` for strict opt-in, block non-allowed events before consent, and clear
  profile continuity on withdrawal.
- **Event delivery** - `page()`, `identify()`, `track()`, entry views, clicks, hovers, and Custom
  Flag views are accepted or blocked exactly as the policy expects. `states.blockedEventStream`
  stays empty for expected allowed events.
- **Content fallback behavior** - Missing selections, malformed optimization entries, unresolved
  links, all-locale CDA responses, or failed Experience API calls render baseline content instead of
  breaking the page.
- **Duplicate tracking prevention** - SPA routes use stable route keys, subscriptions are registered
  once per app root, `messageId` dedupe is applied before forwarding exact analytics records,
  semantic exposure dedupe is applied when a destination wants one sticky-view exposure, and element
  tracking is not enabled twice for the same DOM node.
- **Privacy and governance constraints** - Profile identifiers, traits, forwarded analytics fields,
  localStorage usage, cookies, and retention behavior match the application's approved policy.
- **Local validation path** - Compare the app against the Web SDK reference implementation, run the
  route and entry flows locally, and inspect accepted events, blocked events, rendered variants, and
  baseline fallback cases in browser dev tools.

## Troubleshooting

Use these checks when the browser integration does not behave as expected:

| Symptom                                                          | Likely cause                                                                                                       | Check                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `ContentfulOptimization is already initialized`                  | More than one Web SDK instance exists in the same browser runtime                                                  | Reuse the module singleton or call `destroy()` only in teardown paths                                                     |
| `track()` or interaction events return or behave as blocked      | Consent is unset or false, or the event type is not allow-listed                                                   | Inspect `states.consent.current`, `allowedEventTypes`, `onEventBlocked`, and `states.blockedEventStream`                  |
| `resolveOptimizedEntry()` always returns the baseline            | The app has no selected optimizations, the entry is not optimized, links are unresolved, or CDA data is all-locale | Verify the preceding `page()` or `identify()` result, CDA `include`, `locale`, `fields.nt_experiences`, and variant links |
| SPA page events duplicate                                        | Route changes use direct `page()` calls without route-key dedupe                                                   | Use `trackCurrentPage()` with a stable route key                                                                          |
| Automatic click tracking does not emit                           | The event target is not on a clickable path                                                                        | Use native clickable elements or add `data-ctfl-clickable="true"` to the clickable path                                   |
| Custom Flag reads do not emit flag-view events                   | Consent or profile state is missing, or the same value was already tracked                                         | Verify event consent, profile state, and flag value changes                                                               |
| Hybrid browser sessions start with a different anonymous profile | The server and browser do not share the same readable anonymous ID cookie                                          | Verify `ctfl-opt-aid` path, same-site settings, consent state, and whether the cookie is readable by browser code         |

## Reference implementations to compare against

Use these repository examples when you want a working implementation to compare with guide snippets:

- [Web SDK Vanilla JS reference implementation](../../implementations/web-sdk/README.md) - Vanilla
  browser initialization, Web Components entry rendering, consent state, `page()`, entry resolution,
  merge tags, live updates, and automatic or manual entry interaction tracking.
- [Web SDK React Adapter reference implementation](../../implementations/web-sdk_react/README.md) -
  A local React adapter built directly on top of the Web SDK, including singleton lifecycle, React
  Router page events, state subscriptions, Rich Text merge tags, entry resolution, and tracking
  metadata.
- [Web SDK Angular reference implementation](../../implementations/web-sdk_angular/README.md) -
  Angular services and standalone components that use the Web SDK directly, including route events,
  consent, identify/reset, nested entries, Rich Text merge tags, Custom Flags, and interaction
  tracking.
- [Node SDK SSR + Web SDK Vanilla JS reference implementation](../../implementations/node-sdk+web-sdk/README.md) -
  Hybrid server/browser continuity with shared anonymous ID cookies, consent-aware persistence, and
  browser-side Web SDK takeover.

Use the [Web SDK package README](../../packages/web/web-sdk/README.md) for package orientation and
common configuration, and the generated
[Web SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web.html)
for exhaustive API signatures.
