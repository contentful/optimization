# Integrating the Optimization Node SDK in a Node app

Use this guide when you want to implement server-side personalization in a Node runtime such as
Express, a custom SSR server, or a server-side function using `@contentful/optimization-node`.

The examples below use Express, but the same request-scoped flow applies to any Node request
handler.

## Quick start

Install the Node SDK and Express, create one process-level SDK instance, bind request-scoped consent
and page context with `forRequest()`, call `page()` from a route, and start a local server. This
quick start assumes your application policy permits Optimization by default and no end-user consent
UI is rendered.

**Copy this:**

```sh
pnpm add @contentful/optimization-node express
```

Create `server.mjs`.

**Copy this:**

```js
import ContentfulOptimization from '@contentful/optimization-node'
import express from 'express'

const app = express()
const APP_LOCALE = 'en-US'
const PORT = Number(process.env.PORT ?? 3000)

function required(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

// Reuse one SDK instance for the process; bind request data with forRequest().
const optimization = new ContentfulOptimization({
  clientId: required('CONTENTFUL_OPTIMIZATION_CLIENT_ID'),
  environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  locale: APP_LOCALE,
})

app.get('/', async (req, res) => {
  const host = req.get('host') ?? `localhost:${PORT}`
  const url = new URL(`${req.protocol}://${host}${req.originalUrl}`)
  const requestOptimization = optimization.forRequest({
    // Default-on consent lets page() emit events and lets the app persist returned profile IDs.
    consent: { events: true, persistence: true },
    locale: APP_LOCALE,
    // This request-local context is attached to the emitted page event.
    eventContext: {
      locale: APP_LOCALE,
      userAgent: req.get('user-agent') ?? 'node-server',
      page: {
        path: req.path,
        query: {},
        referrer: req.get('referer') ?? '',
        search: url.search,
        url: url.toString(),
      },
    },
  })

  // page() evaluates the request and returns the profile for this response.
  const pageResult = await requestOptimization.page()

  if (!pageResult.accepted || !pageResult.data) {
    res.status(204).end()
    return
  }

  res.json({
    profileId: pageResult.data.profile.id,
  })
})

app.listen(PORT, () => {
  console.log(`Optimization quick start listening on http://localhost:${PORT}`)
})
```

Start the app with your Optimization client ID.

**Copy this:**

```sh
CONTENTFUL_OPTIMIZATION_CLIENT_ID=your-client-id CONTENTFUL_OPTIMIZATION_ENVIRONMENT=main node server.mjs
```

In another terminal, verify the route.

**Copy this:**

```sh
curl http://localhost:3000/
```

The JSON response contains a `profileId` when `page()` is accepted.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Install and initialize the Node SDK](#install-and-initialize-the-node-sdk)
  - [Bind request context and locale](#bind-request-context-and-locale)
  - [Apply consent policy](#apply-consent-policy)
  - [Evaluate route requests with `page()`](#evaluate-route-requests-with-page)
  - [Identify known users](#identify-known-users)
  - [Persist profile identity between requests](#persist-profile-identity-between-requests)
  - [Fetch and resolve Contentful entries](#fetch-and-resolve-contentful-entries)
- [Optional integrations](#optional-integrations)
  - [Resolve merge tags](#resolve-merge-tags)
  - [Read Custom Flags](#read-custom-flags)
  - [Track server-side interactions and business events](#track-server-side-interactions-and-business-events)
  - [Forward optimization context to analytics](#forward-optimization-context-to-analytics)
  - [Share continuity with the Web SDK](#share-continuity-with-the-web-sdk)
- [Advanced integrations](#advanced-integrations)
  - [Control pre-consent event admission and request options](#control-pre-consent-event-admission-and-request-options)
  - [Keep caches safe for personalized rendering](#keep-caches-safe-for-personalized-rendering)
- [Production checks](#production-checks)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this setup inventory before you move beyond the quick start:

| Setup item                                                      | Category                       | Required for quick start | Where to configure                                                                       |
| --------------------------------------------------------------- | ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| `@contentful/optimization-node` package                         | Required for first integration | Yes                      | Node app package dependencies                                                            |
| Express package for the quick-start route                       | Required for first integration | Yes                      | Quick-start app dependencies, or your equivalent Node request framework                  |
| Optimization client ID                                          | Required for first integration | Yes                      | `ContentfulOptimization({ clientId })` from environment configuration                    |
| Optimization environment and API endpoints                      | Required for first integration | Conditional              | `environment` and `api` SDK options when not using defaults or local mocks               |
| Application Contentful delivery client                          | Required for first integration | Conditional              | App-owned `contentful.js`, REST, or GraphQL client used before entry resolution          |
| Single-locale Contentful entry payloads with optimization links | Required for first integration | Conditional              | CDA request options such as `locale: appLocale` and `include` depth                      |
| Request route or handler integration                            | Required for first integration | Yes                      | Express routes, server functions, or custom Node request handlers                        |
| Request event context                                           | Required for first integration | Yes                      | `forRequest({ eventContext })` per incoming request                                      |
| Application locale decision                                     | Required for first integration | Yes                      | Router, i18n layer, request policy, CDA requests, and `forRequest({ locale })`           |
| Consent policy                                                  | Common but policy-dependent    | Yes                      | Application policy, consent cookie, CMP callback, session, or preference store           |
| Profile ID persistence                                          | Common but policy-dependent    | Conditional              | Application session or first-party cookie such as `ANONYMOUS_ID_COOKIE`                  |
| Known-user identity source                                      | Common but policy-dependent    | No                       | Authentication middleware, session, JWT, or account service used before `identify()`     |
| Rich Text merge-tag renderer                                    | Optional                       | No                       | Application Rich Text rendering pipeline                                                 |
| Custom Flag reads                                               | Optional                       | No                       | Server render logic that consumes `getFlag()`                                            |
| Server-side interaction or business event tracking              | Optional                       | No                       | App-owned event collector, route action, or rendered-entry exposure path                 |
| Third-party analytics forwarding                                | Optional                       | No                       | Server-side analytics, customer-data, or tag-management integration                      |
| `@contentful/optimization-web` package and continuity           | Optional                       | No                       | Browser package dependencies, shared anonymous-ID cookie, and browser SDK initialization |
| Strict pre-consent allowlist and request options                | Advanced or production-only    | No                       | SDK `allowedEventTypes`, `experienceOptions`, `insightsOptions`, and `onEventBlocked`    |
| Personalized response caching policy                            | Advanced or production-only    | No                       | Application cache keys, CDN rules, and render cache boundaries                           |

The Node SDK is stateless. It does not manage cookies, sessions, consent state, long-lived profile
state, Contentful fetching, or HTML rendering. Your application provides those inputs per request,
and the SDK evaluates or emits events, resolves entries, and returns request-local data.

## Core integration

### Install and initialize the Node SDK

**Integration category:** Required for first integration

Create the SDK once for the Node process or module, then reuse that singleton across requests. Bind
request-specific inputs later with `forRequest()`.

1. Install `@contentful/optimization-node`.
2. Read the Optimization client ID and environment from your runtime configuration.
3. Configure default locale and API endpoint overrides only when your app needs them.
4. Export the singleton so route handlers can create request-bound SDK clients.

**Copy this:**

```sh
pnpm add @contentful/optimization-node
```

**Copy this:**

```ts
import ContentfulOptimization from '@contentful/optimization-node'

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

// Create this once per process; use forRequest() inside route handlers.
export const optimization = new ContentfulOptimization({
  clientId: required('CONTENTFUL_OPTIMIZATION_CLIENT_ID'),
  environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  app: {
    name: 'my-express-app',
    version: '1.0.0',
  },
  api: {
    experienceBaseUrl: process.env.CONTENTFUL_EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: process.env.CONTENTFUL_INSIGHTS_API_BASE_URL,
  },
  locale: 'en-US',
  logLevel: 'error',
})
```

The reference implementations in this repository use `PUBLIC_...` environment variable names because
they run against shared mock defaults. Consumer applications can use any environment variable names
that fit their deployment setup.

### Bind request context and locale

**Integration category:** Required for first integration

Build request context for every incoming request. The context gives SDK events a stable page or
route description, user agent, and locale. The request-scoped `locale` also sets the Experience API
locale query parameter.

1. Choose the application Contentful locale in your router, i18n layer, or request policy.
2. Pass the same locale to Contentful CDA requests and to `forRequest({ locale: appLocale })` when
   Experience API responses and events need to use the same language.
3. Derive page context from the current request instead of sharing it across requests.

**Adapt this to your use case:**

```ts
import type { Request } from 'express'
import type { UniversalEventBuilderArgs } from '@contentful/optimization-node/core-sdk'

function toQueryValue(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(String).join(',')

  return JSON.stringify(value)
}

function getRequestContext(req: Request, appLocale: string): UniversalEventBuilderArgs {
  const url = new URL(`${req.protocol}://${req.get('host') ?? 'localhost'}${req.originalUrl}`)

  const query = Object.keys(req.query).reduce<Record<string, string>>((acc, key) => {
    const stringValue = toQueryValue(req.query[key])

    if (stringValue !== null) {
      acc[key] = stringValue
    }

    return acc
  }, {})

  // Use the same locale for event context that forRequest({ locale }) sends to the Experience API.
  return {
    locale: appLocale,
    userAgent: req.get('user-agent') ?? 'node-server',
    page: {
      path: req.path,
      query,
      referrer: req.get('referer') ?? '',
      search: url.search,
      url: url.toString(),
    },
  }
}
```

For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Apply consent policy

**Integration category:** Common but policy-dependent

Consent belongs to your application layer. The Node SDK accepts the request-scoped decision through
`forRequest({ consent })`.

1. If application policy permits Optimization by default and no end-user consent UI is rendered,
   bind each request with `{ events: true, persistence: true }`.
2. If consent depends on user choice, read that decision from your consent cookie, session, CMP, or
   preference store before making SDK calls.
3. Persist returned profile IDs only when `requestOptimization.canPersistProfile` is `true`.
4. When consent is revoked, clear the stored anonymous ID and stop sending further Optimization
   traffic until consent is granted again.

**Copy this:**

```ts
const requestOptimization = optimization.forRequest({
  // Default-on policy: events can be sent and profile continuity can be persisted.
  consent: { events: true, persistence: true },
  locale: appLocale,
  eventContext: getRequestContext(req, appLocale),
  profile: getProfileFromRequest(req),
})
```

**Adapt this to your use case:**

```ts
import type { Request } from 'express'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function appPolicyAllowsOptimizationEvent(req: Request): boolean {
  return req.cookies?.[APP_PERSONALIZATION_CONSENT_COOKIE] === 'granted'
}

const allowed = appPolicyAllowsOptimizationEvent(req)
const requestOptimization = optimization.forRequest({
  // Use the same request decision for event delivery and app-owned profile persistence.
  consent: { events: allowed, persistence: allowed },
  locale: appLocale,
  eventContext: getRequestContext(req, appLocale),
  profile: getProfileFromRequest(req),
})
```

By default, the Node SDK still allows request-bound `identify()` and `page()` before event consent
is granted, and labels those events with `context.gdpr.isConsentGiven: false`. Configure
`allowedEventTypes: []` if your policy requires strict opt-in before all stateless events.

### Evaluate route requests with `page()`

**Integration category:** Required for first integration

Call `page()` for the server route or request that needs profile evaluation, selected optimizations,
or Custom Flag changes. Render from the accepted event result for the current request.

1. Create a request-bound SDK client inside the route handler.
2. Call `page()` before resolving personalized entries for that response.
3. Use `result.accepted` and `result.data` to handle consent-blocked or unavailable data paths.
4. Pass returned `profile`, `selectedOptimizations`, and `changes` to downstream render logic.

**Adapt this to your use case:**

```ts
app.get('/', async (req, res) => {
  const appLocale = getAppLocale(req)
  const allowed = appPolicyAllowsOptimizationEvent(req)
  // Bind request data before calling stateless event methods.
  const requestOptimization = optimization.forRequest({
    consent: { events: allowed, persistence: allowed },
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: getProfileFromRequest(req),
  })

  // page() performs event delivery and returns request-local optimization data.
  const pageResult = await requestOptimization.page()
  const pageResponse = pageResult.accepted ? pageResult.data : undefined

  // Persist only when the request-level consent object allows profile continuity.
  if (requestOptimization.canPersistProfile) {
    persistProfile(res, pageResponse?.profile.id)
  }

  res.json({
    profile: pageResponse?.profile,
    selectedOptimizations: pageResponse?.selectedOptimizations,
    changes: pageResponse?.changes,
  })
})
```

The SDK does not expose direct event methods on the singleton. Call event methods on the object
returned by `forRequest()`.

### Identify known users

**Integration category:** Common but policy-dependent

Call `identify()` when your request has a known user ID from an application-owned identity source.
The Node SDK does not choose the identity key or fetch traits for you.

1. Read the known user ID from authentication middleware, a session, a JWT, or an upstream account
   service.
2. Bind the current anonymous profile ID, if one exists, with `forRequest({ profile })`.
3. Call `identify()` when the user is known and your consent policy permits that event.
4. Render from the response object that best matches the user state for the current response.

**Adapt this to your use case:**

```ts
import type { Request } from 'express'

function getAuthenticatedUserId(req: Request): string | undefined {
  const userId = req.query.userId

  return typeof userId === 'string' && userId.length > 0 ? userId : undefined
}

const pageResult = await requestOptimization.page()
const pageResponse = pageResult.accepted ? pageResult.data : undefined
const userId = getAuthenticatedUserId(req)

// identify() links the app-owned user ID to the current anonymous profile.
const identifyResult = userId
  ? await requestOptimization.identify({
      userId,
      traits: { authenticated: true },
    })
  : undefined
const identifyResponse = identifyResult?.accepted ? identifyResult.data : undefined

const optimizationData = identifyResponse ?? pageResponse
```

Call `identify()` before `page()` when the current page view must be attributed to the known user.
Call `page()` before `identify()` when the request arrived anonymous but the response can still use
data returned from the identify step. In either order, render from the response that represents the
state you want on the page.

### Persist profile identity between requests

**Integration category:** Common but policy-dependent

The Node SDK is stateless, so it does not remember a visitor between requests. Persist only the
profile ID that your consent policy allows, then pass it back through `forRequest({ profile })`.

1. Choose an application session or first-party cookie for profile continuity.
2. Install cookie parsing middleware or use your framework's existing cookie/session reader.
3. Read the stored ID at the start of each request.
4. Persist the returned `profile.id` only when `requestOptimization.canPersistProfile` is true.
5. Clear the stored ID when consent is denied or revoked.

**Adapt this to your use case:**

```ts
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import cookieParser from 'cookie-parser'
import type { Request, Response } from 'express'

app.use(cookieParser())

function getProfileFromRequest(req: Request): { id: string } | undefined {
  // Use the shared cookie name when browser SDK continuity is part of the app.
  const id = req.cookies?.[ANONYMOUS_ID_COOKIE]

  return typeof id === 'string' && id.length > 0 ? { id } : undefined
}

function persistProfile(res: Response, profileId?: string): void {
  if (!profileId) return

  // Call this only after requestOptimization.canPersistProfile is true.
  res.cookie(ANONYMOUS_ID_COOKIE, profileId, {
    path: '/',
    sameSite: 'lax',
  })
}

function clearOptimizationIdentity(res: Response): void {
  res.clearCookie(ANONYMOUS_ID_COOKIE, { path: '/' })
}
```

Use the shared `ANONYMOUS_ID_COOKIE` cookie when the same app also runs the Web SDK in the browser.
Do not mark that cookie `HttpOnly` in a hybrid Node + Web SDK app because browser-side SDK code must
read it. In a server-only app, a session store or a stricter cookie policy can be valid.

For the lower-level mechanics, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

### Fetch and resolve Contentful entries

**Integration category:** Required for first integration

The Node SDK does not replace your Contentful delivery client. Fetch the baseline Contentful entry
with the application locale and enough include depth, then pass that entry and request-local
`selectedOptimizations` to `resolveOptimizedEntry()`.

After verifying the first `profileId` response, this section is where you add Contentful rendering:
pass the `selectedOptimizations` returned by `page()` to `resolveOptimizedEntry()` before rendering
the response.

1. Fetch a single-locale Contentful entry from the application layer.
2. Include linked optimization entries and variant entries in the Contentful response.
3. Call `resolveOptimizedEntry()` with the request's `selectedOptimizations`.
4. Render the returned `entry`. If resolution cannot find a matching optimization or variant, the
   resolver returns the baseline entry.

**Adapt this to your use case:**

```ts
import type { Entry } from 'contentful'
import * as contentful from 'contentful'

const contentfulClient = contentful.createClient({
  accessToken: required('CONTENTFUL_DELIVERY_TOKEN'),
  environment: required('CONTENTFUL_ENVIRONMENT'),
  space: required('CONTENTFUL_SPACE_ID'),
})

type ArticleEntry = Entry<ArticleSkeleton>

async function getArticle(entryId: string, locale: string): Promise<ArticleEntry> {
  return await contentfulClient.getEntry<ArticleSkeleton>(entryId, {
    // Include linked optimization entries and variants before SDK resolution.
    include: 10,
    // Fetch one CDA locale; all-locale payloads cannot be resolved by the SDK.
    locale,
  })
}

app.get('/article/:entryId', async (req, res) => {
  const appLocale = getAppLocale(req)
  const requestOptimization = optimization.forRequest({
    consent: { events: true, persistence: true },
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: getProfileFromRequest(req),
  })
  // Evaluate the request before resolving entry variants for this response.
  const pageResult = await requestOptimization.page()
  const pageResponse = pageResult.accepted ? pageResult.data : undefined
  const article = await getArticle(req.params.entryId, appLocale)

  // The resolver returns article when no matching selected optimization exists.
  const { entry: optimizedArticle, selectedOptimization } = optimization.resolveOptimizedEntry(
    article,
    pageResponse?.selectedOptimizations,
  )

  if (requestOptimization.canPersistProfile) {
    persistProfile(res, pageResponse?.profile.id)
  }

  res.render('article', {
    article: optimizedArticle,
    profile: pageResponse?.profile,
    selectedOptimization,
  })
})
```

Do not pass all-locale CDA responses from `contentful.js` `withAllLocales` or raw CDA `locale=*`
into `resolveOptimizedEntry()`. The resolver expects direct single-locale field values such as
`fields.nt_experiences` and `fields.nt_variants`. For the entry contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

## Optional integrations

### Resolve merge tags

**Integration category:** Optional

Use this helper when your Contentful content contains MergeTag entries.

1. Detect MergeTag entries in your Rich Text renderer.
2. Resolve each MergeTag entry against the current request's `profile`.
3. Render the fallback value when no profile value exists.
4. Keep merge-tag-rendered output request-local because it depends on profile data.

**Adapt this to your use case:**

```ts
import { isMergeTagEntry } from '@contentful/optimization-node/api-schemas'
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES } from '@contentful/rich-text-types'

const html = documentToHtmlString(richTextField, {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (!isMergeTagEntry(node.data.target)) return ''

      // MergeTag values depend on the request profile and fall back through the entry config.
      return optimization.getMergeTagValue(node.data.target, pageResponse?.profile) ?? ''
    },
  },
})
```

If MergeTags reference localized profile fields such as `location.city` or `location.country`, pass
the same application locale to Contentful fetches and `forRequest({ locale })` so profile values and
entry language line up.

### Read Custom Flags

**Integration category:** Optional

Use this helper when your Experience response includes Custom Flag changes.

1. Read flags from the accepted Experience response's `changes`.
2. Render the server response from the returned flag value.
3. Emit a flag-view event explicitly when your reporting policy needs a flag exposure.

**Copy this:**

```ts
// Pass request-local changes; stateless getFlag() does not emit flag-view tracking.
const showNewNavigation = optimization.getFlag('new-navigation', pageResponse?.changes) === true
```

**Adapt this to your use case:**

```ts
if (appPolicyAllowsOptimizationEvent(req) && pageResponse?.profile) {
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse.profile,
  })

  // getFlag() is read-only in Node; emit a profile-bound flag view when reporting needs it.
  await requestOptimization.trackFlagView({
    componentId: 'new-navigation',
  })
}
```

In the stateless Node SDK, `getFlag()` does not auto-track flag views.

### Track server-side interactions and business events

**Integration category:** Optional

Use request-bound event methods when the server owns an exposure, action, or business event. Browser
clicks and hovers are usually better emitted from browser SDK code because the browser observes the
real interaction.

1. Bind consent, locale, event context, and profile for the request or server action.
2. Use `track()` for custom business events.
3. Use `trackView()` when the server knows exactly which optimized entry was rendered.
4. Bind a profile for Insights-only calls such as non-sticky `trackView()`, `trackClick()`,
   `trackHover()`, and `trackFlagView()`.

**Adapt this to your use case:**

```ts
if (appPolicyAllowsOptimizationEvent(req) && pageResponse?.profile) {
  // Bind the current profile before emitting server-owned events.
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse.profile,
  })

  await requestOptimization.track({
    event: 'quote_requested',
    properties: {
      plan: 'enterprise',
      source: 'pricing-page',
    },
  })
}
```

**Adapt this to your use case:**

```ts
import { randomUUID } from 'node:crypto'

if (appPolicyAllowsOptimizationEvent(req) && pageResponse?.profile) {
  // Non-sticky trackView requires a request-bound profile in stateless runtimes.
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse.profile,
  })

  await requestOptimization.trackView({
    componentId: optimizedArticle.sys.id,
    experienceId: selectedOptimization?.experienceId,
    // sticky: true also emits an Experience view before Insights delivery.
    ...(selectedOptimization?.sticky ? { sticky: true } : {}),
    variantIndex: selectedOptimization?.variantIndex,
    viewDurationMs: 0,
    viewId: randomUUID(),
  })
}
```

Sticky `trackView()` sends an Experience event first and can reuse the returned profile for the
paired Insights event. Non-sticky `trackView()` and the Insights-only methods require a
request-bound profile ID because the Node SDK has no ambient profile state.

For the lower-level mechanics, see
[Interaction tracking in Node and stateless environments](../concepts/interaction-tracking-in-node-and-stateless-environments.md).

### Forward optimization context to analytics

**Integration category:** Optional

Use this integration when your Node app already sends server-side events to an analytics,
customer-data, or tag-management destination. The Optimization SDK still sends events to Contentful;
your application decides which approved Contentful context, if any, can also be forwarded.

1. Use request-local data from the SDK call that belongs to the server request or action.
2. Add selected Optimization fields to the same analytics event that already owns the business
   action.
3. Gate both Contentful and third-party delivery with the same application consent policy.
4. Prevent duplicate forwarding when the browser also sends a later client-side event for the same
   interaction.

**Adapt this to your use case:**

```ts
// Use selectedOptimization from the same resolution call that produced the rendered entry.
const { entry: resolvedHeroEntry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineHeroEntry,
  pageResponse?.selectedOptimizations,
)

analytics.track('Quote Requested', {
  plan: 'enterprise',
  contentful_profile_id: canForwardOptimizationProfileId ? pageResponse?.profile.id : undefined,
  contentful_experience_id: selectedOptimization?.experienceId,
  contentful_variant_index: selectedOptimization?.variantIndex,
  contentful_variant_entry_id: selectedOptimization ? resolvedHeroEntry.sys.id : undefined,
  contentful_baseline_entry_id: baselineHeroEntry.sys.id,
})
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local mapping, vendor examples, consent, identity, deduplication, and governance
guidance.

### Share continuity with the Web SDK

**Integration category:** Optional

Add `@contentful/optimization-web` when the browser also needs to participate after server render.
Use the Node SDK alone when the server chooses the variant and renders the full response.

1. Store the shared anonymous profile ID in `ANONYMOUS_ID_COOKIE` when consent permits persistence.
2. Leave the shared cookie readable by browser-side code in hybrid Node + Web SDK apps.
3. Initialize the Web SDK with the same Optimization client, environment, and application locale.
4. Let browser code handle later client-side consent, page events, entry interactions, and live
   updates.

The Node SDK does not provide browser live updates or a preview UI. Keep those concerns in
browser-side SDK code or app-owned Contentful preview tooling.

The [Node SSR + Web SDK reference implementation](../../implementations/node-sdk+web-sdk/README.md)
shows cookie sharing with `ANONYMOUS_ID_COOKIE` plus browser-side follow-up tracking and entry
resolution.

## Advanced integrations

### Control pre-consent event admission and request options

**Integration category:** Advanced or production-only

Use this section when your policy or deployment needs stricter consent behavior, diagnostics, or
per-request API options.

1. Configure `allowedEventTypes: []` to block all events before event consent is granted.
2. Configure a narrower or wider allowlist only after your privacy policy approves those event
   types.
3. Use `onEventBlocked` for diagnostics when consent blocks a request-bound event call.
4. Use request-scoped `experienceOptions` and `insightsOptions` for advanced API behavior such as
   `preflight`, IP override, or a custom Insights `beaconHandler`.

**Follow this pattern:**

```ts
const optimization = new ContentfulOptimization({
  // Empty allowlist blocks page() and identify() until request consent is true.
  allowedEventTypes: [],
  clientId: 'your-client-id',
  environment: 'main',
  // Use this callback for rollout diagnostics, not user-facing error handling.
  onEventBlocked: (event) => {
    console.warn('Contentful Optimization event blocked', event.method, event.reason)
  },
})

const requestOptimization = optimization.forRequest({
  consent: { events: false, persistence: false },
  eventContext: getRequestContext(req, appLocale),
  // Advanced Experience API options stay request-scoped in stateless runtimes.
  experienceOptions: { preflight: true },
  locale: appLocale,
  profile: getProfileFromRequest(req),
})

const pageResult = await requestOptimization.page()
```

If both `locale` and `experienceOptions.locale` are supplied to `forRequest()`, the request-scoped
top-level `locale` wins.

### Keep caches safe for personalized rendering

**Integration category:** Advanced or production-only

The Node SDK sits on one side of an important cache boundary: your app fetches Contentful content,
the SDK evaluates the current request, and your app resolves and renders the selected variant. Cache
raw Contentful delivery payloads broadly; keep profile-evaluated output request-local unless your
cache varies on every personalization input.

1. Cache baseline Contentful entries or query results by entry, query, locale, include depth,
   environment, host, and delivery mode.
2. Treat cached Contentful entries as immutable, or clone them before request-specific transforms
   such as merge-tag rendering.
3. Resolve variants from the current request's `selectedOptimizations`.
4. Render MergeTags against the current request's `profile`.
5. Do not memoize `page()`, `identify()`, `screen()`, `track()`, or `trackView()` results as if they
   were pure reads.

Use this cache-safety table when planning production caching:

| Artifact                                                                   | Shared-cache safe? | Notes                                                                                       |
| -------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Raw `contentful.js` entry or query response                                | Yes                | Key by entry or query, locale, include depth, environment, host, and delivery mode          |
| `resolveOptimizedEntry(entry, selectedOptimizations)` result               | Conditional        | Safe only if keyed by the baseline entry version plus a `selectedOptimizations` fingerprint |
| Merge-tag-rendered rich text                                               | No                 | Depends on the current request `profile`                                                    |
| SSR HTML with personalized content                                         | Usually no         | Safe only when the cache varies on all personalization inputs                               |
| `page()`, `identify()`, `screen()`, `track()`, and `trackView()` responses | No                 | These methods perform side effects and must not be memoized                                 |

## Production checks

Before releasing a Node SDK integration, verify these points:

- Credentials and runtime configuration: the deployed runtime has the Optimization client ID,
  environment, API endpoint overrides if needed, Contentful delivery credentials, and the same Node
  runtime support you validated locally.
- Consent behavior: default-on requests bind `{ events: true, persistence: true }` only when policy
  permits it, user-choice flows bind the actual request decision, and revoked consent clears stored
  profile IDs.
- Event delivery: `page()` and `identify()` return accepted results in allowed paths, blocked paths
  fail closed, and `onEventBlocked` or server logs expose consent-blocked diagnostics during
  rollout.
- Content fallback behavior: baseline entries render when `selectedOptimizations` is missing,
  entries are not optimized, linked optimization entries are unresolved, or a selected variant
  cannot be found.
- Duplicate tracking prevention: server-rendered exposures, browser follow-up tracking, and
  third-party forwarding have one owner per event in your tracking plan.
- Privacy and governance constraints: profile IDs, full profile objects, selected optimizations,
  changes, and analytics payloads are forwarded only to approved destinations.
- Local validation path: run the server against mock or test credentials, load a route that calls
  `page()`, verify a returned `profile.id`, render an optimized entry, and verify the baseline
  fallback path by testing without `selectedOptimizations`.

## Reference implementations to compare against

Use these reference implementations when you want working repository examples instead of guide
snippets:

- [Node SSR Only](../../implementations/node-sdk/README.md): server-only SSR flow with `page()`,
  `identify()`, `resolveOptimizedEntry()`, `getMergeTagValue()`, raw Contentful entry caching, and
  single-locale CDA requests.
- [Node SSR + Web SDK Vanilla](../../implementations/node-sdk+web-sdk/README.md): consent-aware
  cookie sharing with `ANONYMOUS_ID_COOKIE` for Node and Web SDK continuity, plus browser-side
  follow-up tracking and entry resolution.
