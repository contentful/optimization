# Integrating the Optimization Node SDK in a Node app

Use this guide when you want to implement server-side personalization in a Node runtime such as
Express, a custom SSR server, or a server-side function.

The examples below use Express, but the same flow applies to any Node request handler.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Install and initialize the SDK](#1-install-and-initialize-the-sdk)
- [2. Turn the Express request into SDK event context](#2-turn-the-express-request-into-sdk-event-context)
- [3. Handle consent in your application layer](#3-handle-consent-in-your-application-layer)
- [4. Decide how you will persist the profile ID](#4-decide-how-you-will-persist-the-profile-id)
- [5. Call `page()` and `identify()` at the right time](#5-call-page-and-identify-at-the-right-time)
  - [`page()` and `identify()` call order](#page-and-identify-call-order)
- [6. Resolve Contentful entries with `selectedOptimizations`](#6-resolve-contentful-entries-with-selectedoptimizations)
- [7. Resolve merge tags and custom flags](#7-resolve-merge-tags-and-custom-flags)
  - [Merge tags](#merge-tags)
  - [Custom flags](#custom-flags)
- [8. Emit follow-up server events when they matter](#8-emit-follow-up-server-events-when-they-matter)
- [Forward optimization context to third-party analytics](#forward-optimization-context-to-third-party-analytics)
- [Caching and cache safety](#caching-and-cache-safety)
- [Know when the Web SDK belongs in the architecture](#know-when-the-web-sdk-belongs-in-the-architecture)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The Node SDK is the server-side package for Node-based applications in the Optimization SDK Suite.
It lets consumers:

- evaluate a request and receive profile data, selected optimizations, and Custom Flag changes
- stitch anonymous and known identities together when a user becomes known
- render optimized Contentful entries before HTML leaves the server
- render merge tags against the current profile data
- emit server-side optimization and analytics events
- share an anonymous profile identifier with the Web SDK when the app has both SSR and browser code

The Node SDK is intentionally stateless. It does not manage consent, cookies, sessions, or
long-lived profile state for you. Your application decides how profile IDs are persisted and when
events are sent.

It also does not replace your Contentful delivery client. Your app still fetches entries from
Contentful. The Node SDK helps you choose the right variant for the current profile after that
content has been fetched.

## The integration flow

In practice, most Node integrations follow this high-level sequence:

1. Create one SDK instance for the Node process.
2. Bind the application's request policy with `forRequest()`: pass accepted consent for default-on
   integrations, or read request-scoped consent state before SDK calls.
3. Call the SDK to evaluate the request and, when appropriate, associate a known user with the
   current profile.
4. Use the returned profile data, selected optimizations, and flag changes to render the response.
5. Persist the returned `profile.id` and emit follow-up events only when your consent policy allows
   it.

The two Node reference implementations in this repository show that pattern in working applications:

- [Node SSR Only](../../implementations/node-sdk/README.md)
- [Node SSR + Web SDK Vanilla](../../implementations/node-sdk+web-sdk/README.md)

## 1. Install and initialize the SDK

Install the package in your Node app:

```sh
pnpm add @contentful/optimization-node
```

Create the SDK once and reuse it across requests:

```ts
import ContentfulOptimization from '@contentful/optimization-node'

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

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

Treat that SDK as a module-level singleton for the current Node process. Do not create a new
`ContentfulOptimization` instance per incoming request. Use `forRequest()` to bind request-scoped
consent, profile, event context, and SDK locale before calling event methods.

Choose the application Contentful locale in your router, i18n, or request layer. Pass that value to
CDA fetches and to `forRequest({ locale: appLocale })` when Experience API responses and events
should use the same locale.

For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

Notes:

- The reference implementations in this repo use `PUBLIC_...` environment variable names. A consumer
  app can use any environment variable names that fit its deployment setup.
- On modern Node runtimes, the built-in `fetch` implementation is usually enough. If your runtime
  does not expose a standard Fetch API, provide `fetchOptions.fetchMethod`.

## 2. Turn the Express request into SDK event context

The SDK can accept request-scoped event context such as locale, user agent, and page information.
That context must be built fresh for every incoming request.

The reference implementations do this by translating the Express request into
`UniversalEventBuilderArgs`:

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

The exact page fields do not need to come from Express. The important part is that the app passes a
stable, request-specific description of the current page or route.

`getRequestContext(req, appLocale).locale` affects the event payload context. The request-scoped
`forRequest({ locale: appLocale })` value sets the Experience API `locale` query parameter. When an
SSR response renders Contentful entries that can contain MergeTags, use the same `appLocale` for CDA
fetches and request-scoped SDK locale so localized profile values match the entry language.

## 3. Handle consent in your application layer

The Node SDK does not expose a server-side `consent()` state the way stateful SDKs do. In a Node
app, consent belongs in your application layer.

When application policy permits Optimization by default and no end-user consent UI is rendered, bind
each request with accepted event and persistence consent:

```ts
const requestOptimization = optimization.forRequest({
  consent: { events: true, persistence: true },
  locale: appLocale,
  eventContext: getRequestContext(req, appLocale),
  profile: getProfileFromRequest(req),
})
```

That allows SDK calls to emit events and lets `requestOptimization.canPersistProfile` return `true`
when a response includes a profile ID.

When consent depends on user choice, your app needs to:

- store the user's consent decision in its own cookie, session, or user-preference store
- decide which high-level SDK methods are allowed before consent, after consent, and after consent
  revocation

One common conservative pattern is:

- when consent is unknown or denied, do not persist `profile.id` and do not emit follow-up tracking
  events
- in many applications, that also means rendering baseline content until consent exists
- when consent is granted, switch back to normal requests and persist the returned `profile.id`
- when consent is revoked, clear the stored anonymous ID and stop sending further optimization
  traffic until consent is granted again

If your app stores consent in cookies, register cookie parsing middleware before reading
`req.cookies`. The next section shows the same Express setup for profile persistence.

```ts
import type { Request, Response } from 'express'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function appPolicyAllowsOptimizationEvent(req: Request): boolean {
  const consent = req.cookies[APP_PERSONALIZATION_CONSENT_COOKIE]

  return consent === 'granted'
}

function clearOptimizationIdentity(res: Response): void {
  res.clearCookie(ANONYMOUS_ID_COOKIE, { path: '/' })
}
```

The exact consent policy belongs to the application, not the SDK. The important parts are that the
server makes the call/no-call decision before it persists identifiers or emits events on the user's
behalf. Bind that decision with `forRequest()` so emitted events are labeled with the request's
actual consent state.

## 4. Decide how you will persist the profile ID

Because the Node SDK is stateless, it will not remember a visitor between requests on its own. Your
app needs to persist the returned `profile.id` somewhere and pass it back into later SDK calls when
your consent policy allows it.

There are two common approaches:

- server-only app: keep the ID in a session or first-party cookie
- hybrid SSR + browser app: store the ID in the shared `ANONYMOUS_ID_COOKIE` so the Node SDK and Web
  SDK can continue the same anonymous journey

With Express and cookies, the shared-cookie approach looks like this:

```ts
import cookieParser from 'cookie-parser'
import type { Request, Response } from 'express'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'

app.use(cookieParser())

function getProfileFromRequest(req: Request): { id: string } | undefined {
  const id = req.cookies[ANONYMOUS_ID_COOKIE]

  return typeof id === 'string' && id.length > 0 ? { id } : undefined
}

function persistProfile(res: Response, profileId?: string): void {
  if (!profileId) return

  res.cookie(ANONYMOUS_ID_COOKIE, profileId, {
    path: '/',
    sameSite: 'lax',
  })
}
```

This is the same cookie name used in the hybrid reference implementation.

If your app will also run `@contentful/optimization-web` in the browser, avoid marking that cookie
as `HttpOnly`, because browser-side code needs to read it. If your app is server-only, a session
store is equally valid. If consent is revoked, clear the same cookie or session value.

## 5. Call `page()` and `identify()` at the right time

The Node SDK returns event results from `page()`, `identify()`, `screen()`, `track()`, and sticky
`trackView()` calls. In a typical SSR route, `page()` is the most important entry point.

This is a minimal Express shape:

```ts
import type { Request } from 'express'
function getAuthenticatedUserId(req: Request): string | undefined {
  const userId = req.query.userId

  return typeof userId === 'string' && userId.length > 0 ? userId : undefined
}

app.get('/', async (req, res) => {
  const appLocale = getAppLocale(req)
  const requestOptimization = optimization.forRequest({
    consent: {
      events: appPolicyAllowsOptimizationEvent(req),
      persistence: appPolicyAllowsOptimizationEvent(req),
    },
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: getProfileFromRequest(req),
  })
  const pageResult = await requestOptimization.page()
  const pageResponse = pageResult.data

  const userId = getAuthenticatedUserId(req)

  const identifyResult = userId
    ? await requestOptimization.identify({
        userId,
        traits: { authenticated: true },
      })
    : undefined
  const identifyResponse = identifyResult?.data

  if (requestOptimization.canPersistProfile) {
    persistProfile(res, identifyResponse?.profile?.id ?? pageResponse?.profile?.id)
  }

  res.json({
    profile: identifyResponse?.profile ?? pageResponse?.profile,
    changes: identifyResponse?.changes ?? pageResponse?.changes,
    selectedOptimizations:
      identifyResponse?.selectedOptimizations ?? pageResponse?.selectedOptimizations,
  })
})
```

Replace `getAuthenticatedUserId()` with the lookup your app actually uses, such as a session,
cookie, or upstream auth middleware.

This example shows the common "evaluate first, then identify when the user is known" flow. If your
policy allows a specific pre-consent server event, configure that event type in `allowedEventTypes`
and bind request consent as false. Do not persist `profile.id` returned by an approved pre-consent
event unless `requestOptimization.canPersistProfile` is true.

```ts
const optimization = new ContentfulOptimization({
  allowedEventTypes: ['page'],
  clientId: 'your-client-id',
})

const requestOptimization = optimization.forRequest({
  consent: { events: false, persistence: false },
  locale: appLocale,
  eventContext: { locale: appLocale },
  profile,
})

const { accepted, data } = await requestOptimization.page()
```

That route lets a consumer accomplish two things:

- anonymous personalization: `page()` evaluates the current request for an anonymous or known
  profile
- identity stitching: `identify()` links a known user ID to the current profile before or during the
  same request

Accepted event result data usually gives you the three values you care about most:

- `profile`: the current profile, including the profile ID to persist
- `changes`: Custom Flag inputs
- `selectedOptimizations`: the variant choices to use when resolving Contentful entries

### `page()` and `identify()` call order

Both patterns appear in the reference implementations because they answer slightly different
questions:

- call `identify()` and then `page()` when the current page view must be attributed to the known
  user identity
- call `page()` and then `identify()` when the request arrived anonymous but the response must still
  render with data returned from the identify step

The important rule is simpler than the ordering nuance: always render from the most relevant
response object for the user state you want on that response.

## 6. Resolve Contentful entries with `selectedOptimizations`

Once you have optimization data, fetch the baseline Contentful entry the same way your application
normally does, then hand it to `resolveOptimizedEntry()`.

In the example below, replace `ArticleSkeleton` with the generated Contentful skeleton type your app
already uses.

```ts
import type { Request } from 'express'
import type { Entry } from 'contentful'
import * as contentful from 'contentful'

const contentfulClient = contentful.createClient({
  accessToken: required('CONTENTFUL_DELIVERY_TOKEN'),
  environment: required('CONTENTFUL_ENVIRONMENT'),
  space: required('CONTENTFUL_SPACE_ID'),
})

type ArticleEntry = Entry<ArticleSkeleton>

async function getArticle(entryId: string, locale?: string): Promise<ArticleEntry> {
  return await contentfulClient.getEntry<ArticleSkeleton>(entryId, {
    include: 10,
    ...(locale ? { locale } : {}),
  })
}

app.get('/article/:entryId', async (req, res) => {
  const appLocale = getAppLocale(req)
  const requestOptimization = optimization.forRequest({
    consent: {
      events: appPolicyAllowsOptimizationEvent(req),
      persistence: appPolicyAllowsOptimizationEvent(req),
    },
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: getProfileFromRequest(req),
  })
  const pageResult = appPolicyAllowsOptimizationEvent(req)
    ? await requestOptimization.page()
    : undefined
  const pageResponse = pageResult?.data

  const article = await getArticle(req.params.entryId, appLocale)

  const { entry: optimizedArticle, selectedOptimization } = optimization.resolveOptimizedEntry(
    article,
    pageResponse?.selectedOptimizations,
  )

  if (appPolicyAllowsOptimizationEvent(req)) {
    persistProfile(res, pageResponse?.profile?.id)
  }

  res.render('article', {
    article: optimizedArticle,
    profile: pageResponse?.profile,
    selectedOptimization,
  })
})
```

This is the main server-side personalization loop:

1. Ask Optimization for the current profile's selected variants.
2. Fetch the baseline Contentful entry with the application Contentful locale chosen by your router,
   i18n layer, or request policy.
3. Resolve the optimized entry variant before rendering.

If your optimized entries contain linked entries or merge tags, fetch with an `include` depth that
matches your content model. The SSR reference implementation uses `include: 10` for that reason.
All-locale CDA responses from `contentful.js` `withAllLocales` or raw CDA `locale=*` are not valid
input for `resolveOptimizedEntry()` because they contain locale-keyed fields. The resolver expects a
standard single-locale CDA entry shape where `fields.nt_experiences` and `fields.nt_variants` are
direct field values. See
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model.

## 7. Resolve merge tags and custom flags

The Node SDK also exposes helpers for profile-aware merge tags and Custom Flags.

### Merge tags

If a Rich Text field contains merge-tag entries, resolve them against the current profile while
rendering the field:

```ts
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES } from '@contentful/rich-text-types'
import { isMergeTagEntry } from '@contentful/optimization-node/api-schemas'

const html = documentToHtmlString(richTextField, {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (!isMergeTagEntry(node.data.target)) return ''

      return optimization.getMergeTagValue(node.data.target, pageResponse?.profile) ?? ''
    },
  },
})
```

That is the pattern used in the SSR-only reference implementation.

If a merge tag references localized profile fields such as `location.city` or `location.country`,
its resolved value can change with the per-call `{ locale }` request option used to fetch that
profile. Use the same resolved Contentful locale for that option so `getMergeTagValue()` reads
localized profile values in the same language as the Contentful entry being rendered.

### Custom flags

Use `getFlag()` when the response includes Custom Flag changes:

```ts
const showNewNavigation = optimization.getFlag('new-navigation', pageResponse?.changes) === true
```

In the Node SDK, `getFlag()` does not auto-track flag views. If a flag exposure also needs to be
captured as an Insights event, call `trackFlagView()` explicitly:

```ts
if (appPolicyAllowsOptimizationEvent(req) && pageResponse?.profile) {
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse.profile,
  })

  await requestOptimization.trackFlagView({
    componentId: 'new-navigation',
  })
}
```

## 8. Emit follow-up server events when they matter

The Node SDK can send more than page views. Common server-side cases are:

- `track()`: a business event triggered by a server action
- `trackView()`: a rendered entry view when the server knows exactly which optimized entry was shown
- `screen()`: useful when a Node runtime fronts a non-web screen-based experience
- `trackClick()` and `trackHover()`: available, but usually better emitted from browser code once a
  real interaction happens

Gate these calls with the same consent policy your app applies to `page()` and `identify()`.

In stateless Node usage, Insights-backed calls need a request-bound profile. `trackClick()`,
`trackHover()`, `trackFlagView()`, and non-sticky `trackView()` must use a persisted or freshly
returned profile bound with `forRequest()`. Sticky `trackView()` can start without a profile,
because it can reuse the paired Experience response profile.

Example custom event:

```ts
if (appPolicyAllowsOptimizationEvent(req)) {
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse?.profile,
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

Example rendered-entry view event:

```ts
import { randomUUID } from 'node:crypto'

const viewPayload = {
  componentId: optimizedArticle.sys.id,
  experienceId: selectedOptimization?.experienceId,
  variantIndex: selectedOptimization?.variantIndex,
  viewDurationMs: 0,
  viewId: randomUUID(),
}

if (appPolicyAllowsOptimizationEvent(req) && selectedOptimization?.sticky) {
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse?.profile,
  })

  await requestOptimization.trackView({ ...viewPayload, sticky: true })
} else if (appPolicyAllowsOptimizationEvent(req) && pageResponse?.profile) {
  const requestOptimization = optimization.forRequest({
    consent: true,
    locale: appLocale,
    eventContext: getRequestContext(req, appLocale),
    profile: pageResponse.profile,
  })

  await requestOptimization.trackView(viewPayload)
}
```

## Forward optimization context to third-party analytics

Use this optional step when your Node app already sends server-side events to an analytics,
customer-data, or tag-management destination. The Optimization SDK still sends events to Contentful.
Your application decides which approved Contentful context, if any, should also be forwarded.

| Reporting need                             | Node SDK handoff                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Server-rendered exposure attribution       | Use request-local event result data from `page()`, `identify()`, or `track()`.   |
| Business event attribution                 | Add Contentful fields in the server action or event collector that owns it.      |
| Entry or variant attribution               | Use `selectedOptimization` from the same `resolveOptimizedEntry()` call.         |
| Hybrid browser interactions                | Forward later browser activity from the Web or React Web SDK subscription path.  |
| Consent or duplicate-delivery verification | Gate both SDK and destination calls with the same request-scoped consent policy. |

The Node SDK is request-local and does not expose process-wide subscriptions. Use the event result
data returned by the SDK call that belongs to the request or server-side business event.

Keep the third-party payload in the same request or server event collector that already owns the
business event:

```ts
const { entry: resolvedHeroEntry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineHeroEntry,
  pageResponse.selectedOptimizations,
)

analytics.track('Quote Requested', {
  plan: 'enterprise',
  contentful_profile_id: canForwardOptimizationProfileId ? pageResponse.profile.id : undefined,
  contentful_experience_id: selectedOptimization?.experienceId,
  contentful_variant_index: selectedOptimization?.variantIndex,
  contentful_variant_entry_id: selectedOptimization ? resolvedHeroEntry.sys.id : undefined,
  contentful_baseline_entry_id: baselineHeroEntry.sys.id,
})
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for request-local mapping, vendor examples, consent, identity, dedupe, and governance guidance.

## Caching and cache safety

The Node SDK sits on one side of an important cache boundary:

- your app fetches content from Contentful
- the Node SDK evaluates the current request and returns profile and optimization data
- your app resolves the selected variant and renders the response

In server-rendered applications, only the raw Contentful delivery payload is broadly cache-safe.
Personalized output is not.

Safe patterns:

- cache baseline Contentful entries or query results returned by `contentful.js`
- treat cached Contentful `Entry` objects as immutable
- clone a cached entry before applying request-specific transforms such as merge-tag rendering
- resolve the selected variant from the current request's `selectedOptimizations`
- render merge tags against the current request's `profile`

Unsafe patterns:

- caching full HTML responses for personalized routes without varying on all personalization inputs
- mutating a cached `Entry` object during request rendering
- caching the result of `page()`, `identify()`, `screen()`, `track()`, or `trackView()` as if those
  methods were pure reads
- sharing merge-tag-rendered Rich Text across users or requests

The request-scoped SDK methods are not cacheable reads. They emit Experience or Insights events and
might return updated profile state for the current visitor. Call them per request when
personalization is needed.

If you want to cache variant resolution itself, key that cache by both:

- the version or identity of the baseline Contentful entry
- a fingerprint of the current `selectedOptimizations`

Do not key personalized caches only by URL or entry ID.

| Artifact                                                                   | Shared-cache safe? | Notes                                                                                       |
| -------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Raw `contentful.js` entry or query response                                | Yes                | Key by entry or query, locale, include depth, environment, host, and delivery mode          |
| `resolveOptimizedEntry(entry, selectedOptimizations)` result               | Conditionally      | Safe only if keyed by the baseline entry version plus a `selectedOptimizations` fingerprint |
| Merge-tag-rendered rich text                                               | No                 | Depends on the current request `profile`                                                    |
| SSR HTML with personalized content                                         | Usually no         | Safe only when the cache varies on all personalization inputs                               |
| `page()`, `identify()`, `screen()`, `track()`, and `trackView()` responses | No                 | These methods perform side effects and must not be memoized                                 |

## Know when the Web SDK belongs in the architecture

Use the Node SDK by itself when the server is responsible for choosing the variant and rendering the
response.

Add `@contentful/optimization-web` when the browser also needs to participate after hydration. That
is usually the right move when you need:

- browser-managed consent state
- automatic entry view, click, or hover tracking in the DOM
- cookie-based profile continuity between SSR and client-side code
- follow-up personalization after the first server render

For the lower-level mechanics behind cookie-based continuity, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

The [Node SSR + Web SDK reference implementation](../../implementations/node-sdk+web-sdk/README.md)
shows that setup across its server and browser flows.

## Reference implementations to compare against

Use these reference implementations when you want working repository examples instead of guide
snippets:

- [Node SSR Only](../../implementations/node-sdk/README.md): server-only SSR flow with `page()`,
  `identify()`, `resolveOptimizedEntry()`, `getMergeTagValue()`, and rendered output that consumes
  resolved entries.
- [Node SSR + Web SDK Vanilla](../../implementations/node-sdk+web-sdk/README.md): cookie sharing
  with `ANONYMOUS_ID_COOKIE` for Node and Web SDK continuity, plus browser-side follow-up tracking
  and entry resolution.
