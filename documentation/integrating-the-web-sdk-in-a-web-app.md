# Integrating the Optimization Web SDK in a Web App

Use this guide when you want to implement client-side personalization and analytics in a browser
application such as a static site, multi-page app, SPA, or custom frontend runtime using
`@contentful/optimization-web`.

The examples below use vanilla browser APIs, but the same flow applies in any frontend stack where
you manage the Web SDK instance yourself. If you are building a React application and want
providers, hooks, and router adapters, use the React Web guide instead.

## Scope And Capabilities

The Web SDK is the browser-side package in the Optimization SDK Suite. It lets consumers:

- evaluate browser events such as `page()`, `identify()`, and `track()` and receive profile data,
  selected optimizations, and Custom Flag changes
- persist consent, profile state, selected optimizations, and the anonymous profile identifier in
  browser-managed storage
- resolve optimized Contentful entries in the browser after baseline content has been fetched
- resolve merge tags against the current profile
- emit page, component view, click, hover, and custom business events from the browser
- automatically or manually track entry interactions in the DOM
- continue the same anonymous journey as the Node SDK in hybrid SSR + browser applications

The Web SDK is stateful. After `page()` or `identify()` runs, the returned `profile`, `changes`, and
`selectedOptimizations` are stored in SDK state, so later calls such as `resolveOptimizedEntry()`
and `getFlag()` can use current state without you threading response objects through the entire UI.

The Web SDK also does not replace your Contentful delivery client. Your application still fetches
entries from Contentful, renders the DOM, decides how consent works, and decides when user identity
becomes known.

## The Integration Flow

In practice, most Web SDK integrations follow this high-level sequence:

1. Create one SDK instance for the current page or SPA runtime.
2. Let the application own consent UI and call `consent(true | false)` when the user makes a choice.
3. Emit `page()` on the first load and again whenever the active route changes.
4. Fetch baseline Contentful entries and resolve variants with `resolveOptimizedEntry()`.
5. Render flags and merge tags from current SDK state.
6. Call `identify()` when the user becomes known, and `reset()` when identity should be discarded.
7. Enable automatic or manual entry tracking and send follow-up business events with `track()`,
   `trackView()`, `trackClick()`, or `trackHover()`.
8. Subscribe to `states` so the UI rerenders when profile or optimization state changes.

The Web-focused reference implementations in this repository show that pattern in working
applications:

- [Web Vanilla](../implementations/web-sdk/README.md)
- [Node SSR + Web SDK Vanilla](../implementations/node-sdk+web-sdk/README.md)
- [Web SDK React](../implementations/web-sdk_react/README.md)

## 1. Install And Initialize The SDK

Install the package in your web application:

```sh
pnpm add @contentful/optimization-web
```

Create the SDK once and reuse it for the lifetime of the page or SPA runtime:

```ts
import * as contentful from 'contentful'
import ContentfulOptimization from '@contentful/optimization-web'

const APP_CONFIG = {
  contentfulAccessToken: 'your-contentful-token',
  contentfulEnvironment: 'main',
  contentfulSpaceId: 'your-space-id',
  optimizationClientId: 'your-optimization-client-id',
  optimizationEnvironment: 'main',
  experienceBaseUrl: 'https://experience.ninetailed.co/',
  insightsBaseUrl: 'https://ingest.insights.ninetailed.co/',
} as const

export const contentfulClient = contentful.createClient({
  accessToken: APP_CONFIG.contentfulAccessToken,
  environment: APP_CONFIG.contentfulEnvironment,
  space: APP_CONFIG.contentfulSpaceId,
})

export const optimization = new ContentfulOptimization({
  clientId: APP_CONFIG.optimizationClientId,
  environment: APP_CONFIG.optimizationEnvironment,
  app: {
    name: 'my-web-app',
    version: '1.0.0',
  },
  api: {
    experienceBaseUrl: APP_CONFIG.experienceBaseUrl,
    insightsBaseUrl: APP_CONFIG.insightsBaseUrl,
  },
  autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
  logLevel: 'warn',
})
```

Treat that SDK as a singleton. Do not create a new `ContentfulOptimization` instance per component,
per route render, or per click handler. In browser runtimes, the constructor also attaches the
instance to `window.contentfulOptimization` and throws if another instance is already active.

Notes:

- The reference implementations use `PUBLIC_...` environment variable names. A consumer app can use
  any runtime-config mechanism that fits its bundler or deployment setup.
- If your app is an SPA, keep the singleton alive across navigations. The `web-sdk_react`
  implementation demonstrates that pattern even though its rendering layer is React.
- If you are not bundling JavaScript at all, the package README also shows direct UMD usage in a
  plain HTML page.

## 2. Handle Consent In The UI Layer

The Web SDK exposes a browser-side `consent()` method, but your application still owns the consent
policy and user experience.

By default, only `identify` and `page` are allowed before consent is explicitly set. Other event
types are blocked until the user accepts consent. When consent is accepted, the Web SDK also starts
any auto-enabled entry interaction trackers.

```ts
const acceptButton = document.querySelector<HTMLButtonElement>('#consent-accept')
const rejectButton = document.querySelector<HTMLButtonElement>('#consent-reject')

acceptButton?.addEventListener('click', () => {
  optimization.consent(true)
})

rejectButton?.addEventListener('click', () => {
  optimization.consent(false)
})

optimization.states.consent.subscribe((consent) => {
  document.documentElement.dataset.optimizationConsent = String(consent)
})
```

Important behavior:

- `consent(true)` enables the full event surface and starts any auto-enabled entry interaction
  trackers
- `consent(false)` keeps the browser in a denied state and blocks non-allowed event types
- consent is persisted by the Web SDK, so the next page load starts from the remembered value
- `reset()` is not a consent API; it clears profile-related state but intentionally preserves the
  consent choice

If your policy requires a stricter pre-consent posture, configure `allowedEventTypes: []` during
initialization instead of relying on the default `['identify', 'page']`.

## 3. Emit `page()` On First Load And Route Changes

In a traditional multi-page site, calling `page()` after initialization is usually enough because
the Web SDK can derive browser page properties such as URL, referrer, title, query parameters, and
viewport size automatically.

That is exactly what the vanilla and hybrid reference implementations do:

```ts
await optimization.page()
```

For SPAs or other client-side routing solutions, emit another page event whenever the active route
changes:

```ts
function getCurrentPageProperties() {
  const url = new URL(window.location.href)

  return {
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    referrer: document.referrer,
    search: url.search,
    title: document.title,
    url: url.toString(),
  }
}

async function emitPage(): Promise<void> {
  const page = getCurrentPageProperties()

  await optimization.page({
    name: page.title,
    properties: page,
  })
}

void emitPage()

router.onRouteChange(() => {
  void emitPage()
})
```

Replace `router.onRouteChange(...)` with whatever hook your framework exposes. The important rule is
that the browser should emit a new `page()` event whenever the user lands on a different route-like
experience.

## 4. Resolve Contentful Entries With `selectedOptimizations`

Once the page has been evaluated, fetch baseline Contentful entries the same way you normally would,
then resolve each entry with `resolveOptimizedEntry()`.

```ts
async function renderEntry(entryId: string, element: HTMLElement): Promise<void> {
  const baseline = await contentfulClient.getEntry<MarketingHeroSkeleton>(entryId, {
    include: 10,
  })

  const { entry, selectedOptimization } = optimization.resolveOptimizedEntry(baseline)

  element.textContent = String(entry.fields.headline ?? '')

  // Application-owned rendering metadata for later rerenders.
  element.dataset.ctflBaselineId = baseline.sys.id

  // SDK-owned auto-tracking metadata for the resolved entry.
  element.dataset.ctflEntryId = entry.sys.id

  if (selectedOptimization) {
    if (selectedOptimization.experienceId) {
      element.dataset.ctflOptimizationId = selectedOptimization.experienceId
    } else {
      delete element.dataset.ctflOptimizationId
    }

    if (selectedOptimization.sticky !== undefined) {
      element.dataset.ctflSticky = String(selectedOptimization.sticky)
    } else {
      delete element.dataset.ctflSticky
    }

    if (selectedOptimization.variantIndex !== undefined) {
      element.dataset.ctflVariantIndex = String(selectedOptimization.variantIndex)
    } else {
      delete element.dataset.ctflVariantIndex
    }
  } else {
    delete element.dataset.ctflOptimizationId
    delete element.dataset.ctflSticky
    delete element.dataset.ctflVariantIndex
  }
}
```

Replace `MarketingHeroSkeleton` and `headline` with the generated Contentful skeleton type and field
names your application already uses.

This is the main browser-side personalization loop:

1. Ask Optimization for the current profile's selected variants by calling `page()` or `identify()`.
2. Fetch the baseline Contentful entry.
3. Resolve the optimized entry variant before rendering it into the DOM.

In a stateful browser integration, the usual rerender trigger is `states.selectedOptimizations`:

```ts
async function renderAllEntries(): Promise<void> {
  const entryElements = Array.from(document.querySelectorAll<HTMLElement>('[data-entry-id]'))

  await Promise.all(
    entryElements.map(async (element) => {
      const baselineId = element.dataset.ctflBaselineId ?? element.dataset.entryId

      if (!baselineId) return

      await renderEntry(baselineId, element)
    }),
  )
}

void renderAllEntries()

optimization.states.selectedOptimizations.subscribe((selectedOptimizations) => {
  if (selectedOptimizations === undefined) return

  void renderAllEntries()
})
```

> [!IMPORTANT]
>
> Keep the original baseline entry ID somewhere stable, such as `data-ctfl-baseline-id` or your own
> view-model state. Otherwise, a rerender can accidentally try to resolve a previously selected
> variant as though it were the baseline entry.

## 5. Resolve Merge Tags And Custom Flags

The Web SDK also exposes helpers for profile-aware merge tags and Custom Flags.

### Merge Tags

If a Rich Text field contains merge-tag entries, resolve them against current SDK state while
rendering the field:

```ts
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES } from '@contentful/rich-text-types'
import { isMergeTagEntry } from '@contentful/optimization-web/api-schemas'

const html = documentToHtmlString(article.fields.body, {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (!isMergeTagEntry(node.data.target)) return ''

      return optimization.getMergeTagValue(node.data.target) ?? ''
    },
  },
})
```

That is the same basic pattern used in the reference implementations, even when the final Rich Text
renderer differs.

### Custom Flags

Use `getFlag()` when the current optimization response contains Custom Flag changes:

```ts
const showNewNavigation = optimization.getFlag('new-navigation') === true
```

If you want the UI to react to later updates, subscribe to the flag state:

```ts
optimization.states.flag('new-navigation').subscribe((value) => {
  document.body.dataset.newNavigation = String(value === true)
})
```

Unlike the stateless Node SDK, the stateful Web SDK automatically emits flag-view tracking when you
read a flag via `getFlag()` or `states.flag(name)`.

## 6. Identify Known Users And Reset When Identity Changes

Call `identify()` when the browser session becomes associated with a known user, such as after a
sign-in, account lookup, or persisted auth refresh:

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
```

That lets the browser stitch the current anonymous profile to a known identity and update profile
state for later entry resolution, flags, and event attribution.

When the app should discard the current browser identity, call `reset()`:

```ts
async function handleLogout(): Promise<void> {
  optimization.reset()

  // Create a fresh anonymous profile immediately if the app still needs browser-side optimization.
  await optimization.page()
}
```

That is the same shape used in the vanilla reference implementation. `reset()` clears the anonymous
ID cookie, cached profile data, cached flag changes, selected optimizations, and entry-tracking
runtime state. It does not clear consent.

## 7. Track Entry Interactions And Follow-Up Events

The Web SDK can emit more than page and identify events. Common browser-side cases are:

- automatic entry `view`, `click`, and `hover` tracking from the DOM
- manual `trackView()` calls for UI regions that are not directly tied to a Contentful entry
- `track()` calls for business events such as quote requests or sign-up milestones
- `trackClick()` and `trackHover()` calls when the app has custom interaction logic that should not
  rely on DOM auto-detection

### Automatic Entry Tracking

If you enable `autoTrackEntryInteraction`, add the standard `data-ctfl-*` attributes to the rendered
element that contains the resolved entry content:

```html
<article
  data-ctfl-entry-id="resolved-entry-id"
  data-ctfl-optimization-id="experience-id"
  data-ctfl-sticky="true"
  data-ctfl-variant-index="1"
></article>
```

`data-ctfl-entry-id` is required. The other attributes are needed only when the current entry is an
optimized variant.

For click tracking, prefer semantic clickable elements such as `<button>` and `<a>`, or explicitly
mark clickability with `data-ctfl-clickable="true"`. The Web SDK can detect clicks on the tracked
element itself, on a clickable ancestor, or on a clickable descendant inside the tracked entry.

### Manual Element Observation

If your element structure does not fit the standard data-attribute pattern, force-enable tracking
for a specific element:

```ts
optimization.tracking.enableElement('views', element, {
  data: {
    entryId: resolvedEntry.sys.id,
    optimizationId: selectedOptimization?.experienceId,
    sticky: selectedOptimization?.sticky,
    variantIndex: selectedOptimization?.variantIndex,
  },
})
```

Use `tracking.disableElement(...)` to force-disable a specific element or
`tracking.clearElement(...)` to remove a manual override and return it to automatic behavior.

### Custom Browser Events

Use `track()` for business events:

```ts
await optimization.track({
  event: 'quote_requested',
  properties: {
    plan: 'enterprise',
    source: 'pricing-page',
  },
})
```

## 8. Subscribe To `states` For Rerenders And UI Feedback

The Web SDK is stateful, so most browser integrations should react to SDK state changes instead of
passing `OptimizationData` objects through every UI layer.

Useful streams include:

- `states.consent` for consent UI
- `states.profile` for identity-aware UI
- `states.selectedOptimizations` for rerendering optimized entries
- `states.flag(name)` for feature flag gates
- `states.eventStream` for analytics debugging or local dev tooling
- `states.blockedEventStream` for consent-gating diagnostics

Example:

```ts
const subscriptions = [
  optimization.states.profile.subscribe((profile) => {
    const badge = document.querySelector('#profile-id')
    if (badge) badge.textContent = profile?.id ?? 'anonymous'
  }),
  optimization.states.selectedOptimizations.subscribe((selectedOptimizations) => {
    if (selectedOptimizations === undefined) return

    void renderAllEntries()
  }),
  optimization.states.blockedEventStream.subscribe((blockedEvent) => {
    if (!blockedEvent) return

    console.info(`Blocked Optimization event: ${blockedEvent.type}`)
  }),
]

window.addEventListener('beforeunload', () => {
  subscriptions.forEach((subscription) => subscription.unsubscribe())
})
```

Each observable immediately emits its current snapshot and then emits future updates. If you need a
synchronous read instead of a subscription, use `.current`, for example
`optimization.states.profile.current`.

## 9. Share The Anonymous ID Cookie In Hybrid SSR + Browser Apps

If your architecture uses both `@contentful/optimization-node` on the server and
`@contentful/optimization-web` in the browser, let both runtimes continue the same anonymous journey
by sharing the anonymous ID cookie.

That is the pattern shown in the `node-sdk+web-sdk` reference implementation:

- the server persists `ANONYMOUS_ID_COOKIE` with `path: '/'` and `sameSite: 'lax'`
- the browser Web SDK reads the same cookie during initialization
- after hydration, browser events continue from the same anonymous profile instead of starting over

If browser code must read the cookie, do not mark it `HttpOnly`.

This hybrid architecture can preserve more cache flexibility when the browser resolves personalized
entries after hydration. If the server already embeds personalized HTML or profile-derived values,
treat that response as personalized and avoid shared caching unless you vary on all relevant
personalization inputs.

## Reference Implementations To Compare Against

Use these files when you want working repository examples instead of guide snippets:

- [`implementations/web-sdk/public/index.html`](../implementations/web-sdk/public/index.html):
  vanilla browser initialization, consent handling, `page()`, entry resolution, merge tags, and
  automatic or manual interaction tracking
- [`implementations/node-sdk+web-sdk/src/index.ejs`](../implementations/node-sdk+web-sdk/src/index.ejs):
  browser-side continuation of an SSR flow with the Web SDK
- [`implementations/node-sdk+web-sdk/src/app.ts`](../implementations/node-sdk+web-sdk/src/app.ts):
  shared anonymous cookie persistence for Node and Web SDK continuity
- [`implementations/web-sdk_react/src/App.tsx`](../implementations/web-sdk_react/src/App.tsx):
  SPA-style `page()` emission, consent updates, `identify()`, and `reset()` patterns
- [`implementations/web-sdk_react/src/sections/ContentEntry.tsx`](../implementations/web-sdk_react/src/sections/ContentEntry.tsx):
  resolved-entry rendering plus automatic and manual tracking metadata
