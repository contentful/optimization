# Integrating the Optimization Node SDK in a Node App

Use this guide when you want to implement server-side personalization in a Node runtime such as
Express, a custom SSR server, or a server-side function.

The examples below use Express, but the same flow applies to any Node request handler.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and Capabilities](#scope-and-capabilities)
- [The Integration Flow](#the-integration-flow)
- [1. Install and Initialize the SDK](#1-install-and-initialize-the-sdk)
- [2. Turn the Express Request into SDK Event Context](#2-turn-the-express-request-into-sdk-event-context)
- [3. Handle Consent in Your Application Layer](#3-handle-consent-in-your-application-layer)
- [4. Decide How You Will Persist the Profile ID](#4-decide-how-you-will-persist-the-profile-id)
- [5. Call `page()` and `identify()` at the Right Time](#5-call-page-and-identify-at-the-right-time)
  - [Which Order Should `page()` and `identify()` Use?](#which-order-should-page-and-identify-use)
- [6. Resolve Contentful Entries with `selectedOptimizations`](#6-resolve-contentful-entries-with-selectedoptimizations)
- [7. Resolve Merge Tags and Custom Flags](#7-resolve-merge-tags-and-custom-flags)
  - [Merge Tags](#merge-tags)
  - [Custom Flags](#custom-flags)
- [8. Emit Follow-Up Server Events When They Matter](#8-emit-follow-up-server-events-when-they-matter)
- [Caching and Cache Safety](#caching-and-cache-safety)
- [Know When the Web SDK Should Join the Architecture](#know-when-the-web-sdk-should-join-the-architecture)
- [Reference Implementations to Compare Against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and Capabilities

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
events should be sent.

It also does not replace your Contentful delivery client. Your app still fetches entries from
Contentful. The Node SDK helps you choose the right variant for the current profile after that
content has been fetched.

## The Integration Flow

In practice, most Node integrations follow this high-level sequence:

1. Create one SDK instance for the Node process.
2. Read the request-scoped inputs your app owns: consent state, existing `profile.id`, known user
   identity, and page context.
3. Call the SDK to evaluate the request and, when appropriate, associate a known user with the
   current profile.
4. Use the returned profile data, selected optimizations, and flag changes to render the response.
5. Persist the returned `profile.id` and emit follow-up events only when your consent policy allows
   it.

The two Node reference implementations in this repository show that pattern in working applications:

- [Node SSR Only](../../implementations/node-sdk/README.md)
- [Node SSR + Web SDK Vanilla](../../implementations/node-sdk+web-sdk/README.md)

## 1. Install and Initialize the SDK

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
  logLevel: 'error',
})
```

Treat that SDK as a module-level singleton for the current Node process. Do not create a new
`ContentfulOptimization` instance per incoming request. Instead, compute request-scoped Experience
options per request and pass them as the final argument to stateless event methods.

Notes:

- The reference implementations in this repo use `PUBLIC_...` environment variable names. A consumer
  app can use any environment variable names that fit its deployment setup.
- On modern Node runtimes, the built-in `fetch` implementation is usually enough. If your runtime
  does not expose a standard Fetch API, provide `fetchOptions.fetchMethod`.

## 2. Turn the Express Request into SDK Event Context

The SDK can accept request-scoped event context such as locale, user agent, and page information.
That context should be built fresh for every incoming request.

The reference implementations do this by translating the Express request into
`UniversalEventBuilderArgs`:

```ts
import type { Request } from 'express'
import type {
  CoreStatelessRequestOptions,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'

function toQueryValue(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(String).join(',')

  return JSON.stringify(value)
}

function getRequestContext(req: Request): UniversalEventBuilderArgs {
  const url = new URL(`${req.protocol}://${req.get('host') ?? 'localhost'}${req.originalUrl}`)

  const query = Object.keys(req.query).reduce<Record<string, string>>((acc, key) => {
    const stringValue = toQueryValue(req.query[key])

    if (stringValue !== null) {
      acc[key] = stringValue
    }

    return acc
  }, {})

  return {
    locale: req.acceptsLanguages()[0] ?? 'en-US',
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

function getExperienceRequestOptions(req: Request): CoreStatelessRequestOptions {
  return {
    locale: req.acceptsLanguages()[0] ?? 'en-US',
  }
}
```

The exact page fields do not need to come from Express. The important part is that the app passes a
stable, request-specific description of the current page or route.

`getRequestContext(req).locale` affects the event payload context.
`getExperienceRequestOptions(req).locale` affects the Experience API request itself. Those two
locale values are intentionally separate, even if your app derives them from the same request
header.

## 3. Handle Consent in Your Application Layer

The Node SDK does not expose a server-side `consent()` state the way stateful SDKs do. In a Node
app, consent belongs in your application layer.

That usually means your app should:

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

const OPTIMIZATION_CONSENT_COOKIE = 'ctfl-opt-consent'

function hasOptimizationConsent(req: Request): boolean {
  return req.cookies[OPTIMIZATION_CONSENT_COOKIE] === 'true'
}

function clearOptimizationIdentity(res: Response): void {
  res.clearCookie(ANONYMOUS_ID_COOKIE, { path: '/' })
}
```

The exact consent policy belongs to the application, not the SDK. The important part is that the
server makes that decision before it persists identifiers or emits events on the user's behalf.

## 4. Decide How You Will Persist the Profile ID

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

## 5. Call `page()` and `identify()` at the Right Time

The Node SDK returns optimization data from `page()`, `identify()`, `screen()`, `track()`, and
sticky `trackView()` calls. In a typical SSR route, `page()` is the most important entry point.

This is a minimal Express shape:

```ts
import type { Request } from 'express'
import type { OptimizationData } from '@contentful/optimization-node/api-schemas'

function getAuthenticatedUserId(req: Request): string | undefined {
  const userId = req.query.userId

  return typeof userId === 'string' && userId.length > 0 ? userId : undefined
}

app.get('/', async (req, res) => {
  const consented = hasOptimizationConsent(req)
  if (!consented) {
    return res.json({
      profile: undefined,
      changes: undefined,
      selectedOptimizations: undefined,
    })
  }

  const requestContext = getRequestContext(req)
  const requestOptions = getExperienceRequestOptions(req)
  const existingProfile = getProfileFromRequest(req)
  const pageResponse: OptimizationData | undefined = await optimization.page(
    {
      ...requestContext,
      profile: existingProfile,
    },
    requestOptions,
  )

  const userId = getAuthenticatedUserId(req)

  const identifyResponse = userId
    ? await optimization.identify(
        {
          ...requestContext,
          profile: pageResponse?.profile ?? existingProfile,
          userId,
          traits: { authenticated: true },
        },
        requestOptions,
      )
    : undefined

  if (consented) {
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
policy allows a different pre-consent behavior, implement that policy in your application layer
before you call SDK methods.

That route lets a consumer accomplish two things:

- anonymous personalization: `page()` evaluates the current request for an anonymous or known
  profile
- identity stitching: `identify()` links a known user ID to the current profile before or during the
  same request

The returned `OptimizationData` usually gives you the three values you care about most:

- `profile`: the current profile, including the profile ID you should persist
- `changes`: Custom Flag inputs
- `selectedOptimizations`: the variant choices to use when resolving Contentful entries

### Which Order Should `page()` and `identify()` Use?

Both patterns appear in the reference implementations because they answer slightly different
questions:

- call `identify()` and then `page()` when the current page view should be attributed to the known
  user identity
- call `page()` and then `identify()` when the request arrived anonymous but the response should
  still render with data returned from the identify step

The important rule is simpler than the ordering nuance: always render from the most relevant
response object for the user state you want on that response.

## 6. Resolve Contentful Entries with `selectedOptimizations`

Once you have optimization data, fetch the baseline Contentful entry the same way you normally
would, then hand it to `resolveOptimizedEntry()`.

In the example below, replace `ArticleSkeleton` with the generated Contentful skeleton type your app
already uses.

```ts
import type { Entry } from 'contentful'
import * as contentful from 'contentful'

const contentfulClient = contentful.createClient({
  accessToken: required('CONTENTFUL_DELIVERY_TOKEN'),
  environment: required('CONTENTFUL_ENVIRONMENT'),
  space: required('CONTENTFUL_SPACE_ID'),
})

type ArticleEntry = Entry<ArticleSkeleton>

async function getArticle(entryId: string): Promise<ArticleEntry> {
  return await contentfulClient.getEntry<ArticleSkeleton>(entryId, {
    include: 10,
  })
}

app.get('/article/:entryId', async (req, res) => {
  const consented = hasOptimizationConsent(req)
  const requestOptions = getExperienceRequestOptions(req)
  const pageResponse = consented
    ? await optimization.page(
        {
          ...getRequestContext(req),
          profile: getProfileFromRequest(req),
        },
        requestOptions,
      )
    : undefined

  const article = await getArticle(req.params.entryId)

  const { entry: optimizedArticle, selectedOptimization } = optimization.resolveOptimizedEntry(
    article,
    pageResponse?.selectedOptimizations,
  )

  if (consented) {
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
2. Fetch the baseline Contentful entry.
3. Resolve the optimized entry variant before rendering.

If your optimized entries contain linked entries or merge tags, fetch with an `include` depth that
matches your content model. The SSR reference implementation uses `include: 10` for that reason.

## 7. Resolve Merge Tags and Custom Flags

The Node SDK also exposes helpers for profile-aware merge tags and Custom Flags.

### Merge Tags

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

### Custom Flags

Use `getFlag()` when the response includes Custom Flag changes:

```ts
const showNewNavigation = optimization.getFlag('new-navigation', pageResponse?.changes) === true
```

In the Node SDK, `getFlag()` does not auto-track flag views. If a flag exposure should also be
captured as an Insights event, call `trackFlagView()` explicitly:

```ts
if (pageResponse?.profile) {
  await optimization.trackFlagView({
    ...getRequestContext(req),
    componentId: 'new-navigation',
    profile: pageResponse.profile,
  })
}
```

## 8. Emit Follow-Up Server Events When They Matter

The Node SDK can send more than page views. Common server-side cases are:

- `track()`: a business event triggered by a server action
- `trackView()`: a rendered entry view when the server knows exactly which optimized entry was shown
- `screen()`: useful when a Node runtime fronts a non-web screen-based experience
- `trackClick()` and `trackHover()`: available, but usually better emitted from browser code once a
  real interaction happens

Gate these calls with the same consent policy your app applies to `page()` and `identify()`.

In stateless Node usage, Insights-backed calls need a profile. `trackClick()`, `trackHover()`,
`trackFlagView()`, and non-sticky `trackView()` should use a persisted or freshly returned profile.
Sticky `trackView()` may omit `profile`, because it can reuse the paired Experience response
profile.

Example custom event:

```ts
const requestOptions = getExperienceRequestOptions(req)

await optimization.track(
  {
    ...getRequestContext(req),
    profile: pageResponse?.profile,
    event: 'quote_requested',
    properties: {
      plan: 'enterprise',
      source: 'pricing-page',
    },
  },
  requestOptions,
)
```

Example rendered-entry view event:

```ts
import { randomUUID } from 'node:crypto'

const requestOptions = getExperienceRequestOptions(req)
const viewPayload = {
  ...getRequestContext(req),
  componentId: optimizedArticle.sys.id,
  experienceId: selectedOptimization?.experienceId,
  variantIndex: selectedOptimization?.variantIndex,
  viewDurationMs: 0,
  viewId: randomUUID(),
}

if (selectedOptimization?.sticky) {
  await optimization.trackView({ ...viewPayload, sticky: true }, requestOptions)
} else if (pageResponse?.profile) {
  await optimization.trackView({ ...viewPayload, profile: pageResponse.profile }, requestOptions)
}
```

## Caching and Cache Safety

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
may return updated profile state for the current visitor. Call them per request when personalization
is needed.

If you want to cache variant resolution itself, key that cache by both:

- the version or identity of the baseline Contentful entry
- a fingerprint of the current `selectedOptimizations`

Do not key personalized caches only by URL or entry ID.

| Artifact                                                                   | Shared-cache safe? | Notes                                                                                       |
| -------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Raw `contentful.js` entry or query response                                | Yes                | Key by entry or query, locale, include depth, environment, host, and delivery mode          |
| `resolveOptimizedEntry(entry, selectedOptimizations)` result               | Conditionally      | Safe only if keyed by the baseline entry version plus a `selectedOptimizations` fingerprint |
| Merge-tag-rendered Rich Text                                               | No                 | Depends on the current request `profile`                                                    |
| SSR HTML with personalized content                                         | Usually no         | Safe only when the cache varies on all personalization inputs                               |
| `page()`, `identify()`, `screen()`, `track()`, and `trackView()` responses | No                 | These methods perform side effects and should not be memoized                               |

## Know When the Web SDK Should Join the Architecture

Use the Node SDK by itself when the server is responsible for choosing the variant and rendering the
response.

Add `@contentful/optimization-web` when the browser also needs to participate after hydration. That
is usually the right move when you need:

- browser-managed consent state
- automatic entry view, click, or hover tracking in the DOM
- cookie-based profile continuity between SSR and client-side code
- follow-up personalization after the first server render

The hybrid reference implementation shows exactly that setup:

- [Server integration](../../implementations/node-sdk+web-sdk/src/app.ts)
- [Browser integration](../../implementations/node-sdk+web-sdk/src/index.ejs)

## Reference Implementations to Compare Against

Use these files when you want working repository examples instead of guide snippets:

- [`implementations/node-sdk/src/app.ts`](../../implementations/node-sdk/src/app.ts): server-only
  SSR flow with `page()`, `identify()`, `resolveOptimizedEntry()`, and `getMergeTagValue()`
- [`implementations/node-sdk/src/index.ejs`](../../implementations/node-sdk/src/index.ejs): rendered
  output that consumes resolved entries
- [`implementations/node-sdk+web-sdk/src/app.ts`](../../implementations/node-sdk+web-sdk/src/app.ts):
  cookie sharing with `ANONYMOUS_ID_COOKIE` for Node and Web SDK continuity
- [`implementations/node-sdk+web-sdk/src/index.ejs`](../../implementations/node-sdk+web-sdk/src/index.ejs):
  browser-side follow-up tracking and entry resolution
