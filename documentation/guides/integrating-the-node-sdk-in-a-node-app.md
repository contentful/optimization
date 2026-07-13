# Integrating the Optimization Node SDK in a Node app

Use this guide to add Contentful personalization to a Node server you already have — an Express app,
a custom SSR server, or a server-side function — using `@contentful/optimization-node`. By the end
of the quick start, one route will emit a page event and report the profile the Experience API
returns for that request, without changing how your server fetches or renders content.

**New to personalization?** Here is the whole idea in five points:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- On each request, Contentful's **Experience API** looks at who the visitor is and picks the variant
  for each experience. Swapping a fetched entry for its picked variant is called **resolving** the
  entry.
- The Experience API also returns a **profile**: the anonymous, per-visitor identity and state used
  to keep personalization consistent across requests or app launches.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies—the **baseline
  fallback**. You can fetch the entry yourself or give the SDK your Contentful client and an entry
  ID; either way, the client stays yours.
- You render the returned entry with the same application components you already use.

For the stateless Node SDK, your application persists the profile between requests.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — an accepted page event and a profile for the request (the quick start below).** A
  page event is _accepted_ when your consent policy allows it and the Experience API responds; the
  response carries the profile and the request's variant selections, and the route reports the
  profile ID. This is complete and shippable on its own.
- **Milestone 2 — a resolved entry in the response (later).** You fetch an entry, resolve it against
  the request's selections, and render the returned variant or baseline. See
  [Fetch and resolve Contentful entries](#fetch-and-resolve-contentful-entries).

This guide uses the `ContentfulOptimization` class from `@contentful/optimization-node`. You create
one instance for the whole process, then bind each incoming request to its own consent, locale, and
page context with `forRequest()`. Your app keeps ownership of its Contentful client, consent policy,
sessions, cookies, identity, routing, caching, and rendering — the Node SDK holds no per-visitor
state between requests.

The examples use Express, but the same request-scoped flow applies to any Node request handler. If
you also want the browser to continue personalization after the server renders, see
[Share continuity with the Web SDK](#share-continuity-with-the-web-sdk). For a browser-only app, use
the [Web SDK guide](./integrating-the-web-sdk-in-a-web-app.md) instead.

## Quick start

Most Node + Contentful apps share one shape: a request handler builds a response and, somewhere in
it, an entry becomes rendered output. This quick start assumes that shape and proves the smallest
server-side result: **one route reports an accepted page event and the profile the Experience API
returned for that request.** It creates one process-level SDK instance, binds request-scoped consent
and page context with `forRequest()`, and calls `page()` from a route.

This quick start assumes your application policy permits Optimization by default and renders no
end-user consent UI. Consent has two independent parts you bind per request: `events` (may the SDK
send events and personalize this request) and `persistence` (may your app store the profile ID so
the same visitor stays consistent). The shorthand `consent: true` sets both to `true`; the object
form `{ events, persistence }` sets them separately. If personalization must wait for a consent
decision, keep this structure and add the [Apply consent policy](#apply-consent-policy) step before
you ship.

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

The JSON response contains a `profileId` when `page()` is accepted — the Experience API evaluated
the request and returned a profile. An accepted event does not by itself prove a variant was chosen:
until you author a variant attached to an experience (see [Before you start](#before-you-start)),
every request resolves to the baseline. To see a variant later, author an experience that targets
all visitors so every request matches it automatically, then resolve an entry as shown in
[Fetch and resolve Contentful entries](#fetch-and-resolve-contentful-entries).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
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
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A Node server** you can add a route handler to, and its own Contentful fetching already working.
  Install `express` only if you are following the quick start verbatim; any Node request framework
  works. Install `contentful` if you want the SDK to fetch entries by ID and you do not already have
  a Delivery API client.
- **Contentful delivery credentials** — space ID, delivery token, and environment — read from your
  server's runtime configuration, never shipped to the browser.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The Experience API (which picks variants) and the Insights API (which receives event and
  interaction delivery) each have a base URL that defaults correctly; you only set them for mocks or
  non-default hosts (see [Install and initialize the Node SDK](#install-and-initialize-the-node-sdk)).

You do not need a setup inventory up front. Everything else — consent, entry resolution, identity,
tracking, caching — is introduced by the section that needs it. The Node SDK holds no per-visitor
state between requests: it does not manage cookies, sessions, consent, long-lived profiles, or
rendering. Your app owns those and passes request inputs in; the SDK evaluates the request, resolves
entries, and returns request-local data. When you give it your delivery client, it can fetch entries
for you (managed fetching) via `client.getEntry()` for one entry or `client.getEntries()` for several.

> [!NOTE]
>
> Read the SDK config from your server's runtime configuration. This guide's examples read
> `process.env` values, and the reference implementations use `PUBLIC_...` names because they run
> against shared mock defaults; use whatever environment variable convention your deployment already
> uses and keep it consistent. Ship only the Contentful **delivery** token to any client, never a
> Management API token.

## Core integration

### Install and initialize the Node SDK

**Integration category:** Required for first integration

Create the SDK once for the Node process or module, then reuse that singleton across requests. Bind
request-specific inputs later with `forRequest()`.

From here on, the guide's examples are TypeScript, because the SDK's request and result types are
most of the value in a server codebase. Run them with a TypeScript toolchain (for example `tsx`,
`ts-node`, or a build step) — or drop the type annotations to get back to plain `.mjs` like the quick
start. The quick start inlined the SDK inside `server.mjs`; the sections below factor initialization
into a small shared module (call it `optimization.ts`) that each route handler imports, so there is
still exactly one SDK instance per process.

1. Install `@contentful/optimization-node` and `contentful` when the SDK will fetch entries by ID.
2. Read the Optimization client ID and environment from your runtime configuration.
3. Configure default locale and API endpoint overrides only when your app needs them.
4. Export the singleton so route handlers can create request-bound SDK clients.

**Copy this:**

```sh
pnpm add @contentful/optimization-node contentful
```

**Adapt this to your use case:** this is a new `optimization.ts` module you create; the route
handlers in later sections `import { optimization }` from it. Replace the env-var reads with your
app's configuration mechanism.

```ts
import ContentfulOptimization from '@contentful/optimization-node'
import * as contentful from 'contentful'

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

const contentfulClient = contentful.createClient({
  accessToken: required('CONTENTFUL_DELIVERY_TOKEN'),
  environment: required('CONTENTFUL_ENVIRONMENT'),
  space: required('CONTENTFUL_SPACE_ID'),
})

// Create this once per process; route handlers import it and call forRequest() per request.
export const optimization = new ContentfulOptimization({
  clientId: required('CONTENTFUL_OPTIMIZATION_CLIENT_ID'),
  contentful: {
    client: contentfulClient,
    // Include linked optimization entries and variants for SDK-managed entry fetches.
    defaultQuery: { include: 10 },
  },
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

Set `api.experienceBaseUrl` and `api.insightsBaseUrl` only for mock servers or non-default hosts;
they default correctly otherwise. See the env-var note in [Before you start](#before-you-start) for
naming conventions.

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

Later snippets call `getAppLocale(req)` — that is your app's per-request locale decision (from step
1), which can be as simple as a single `const APP_LOCALE = 'en-US'` if your app is single-locale.
Wherever you see `getAppLocale(req)`, substitute your own locale source.

For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Apply consent policy

**Integration category:** Common but policy-dependent

Consent belongs to your application layer. The Node SDK accepts the request-scoped decision through
`forRequest({ consent })`.

The snippets here and in the next section call `getProfileFromRequest(req)` and `persistProfile(res,
id)` — the read and write halves of profile continuity. They are defined in
[Persist profile identity between requests](#persist-profile-identity-between-requests); if you are
building top to bottom, treat them as `undefined`/no-ops until you reach that section.

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

By default, the Node SDK admits request-bound `identify()` and `page()` before event consent is
granted, and labels those events with `context.gdpr.isConsentGiven: false`. Configure
`allowedEventTypes: []` if your policy requires strict opt-in before all stateless events.

### Evaluate route requests with `page()`

**Integration category:** Required for first integration

Call `page()` for the server route or request that needs profile evaluation, variant selections, or
Custom Flag changes. Render from the accepted event result for the current request.

An accepted `page()` returns three things your render logic uses:

- **`profile`** — the anonymous per-visitor identity and state (defined in the intro).
- **`selectedOptimizations`** — the whole set of variant selections the Experience API made for this
  request, one per matched experience. You pass this set into entry resolution.
- **`changes`** — the computed **Custom Flag** values for this request. A Custom Flag is a named
  value you author against an experience in Contentful (a feature toggle, a string, a number) and
  read at runtime, instead of swapping a whole entry. See [Read Custom Flags](#read-custom-flags).

1. Create a request-bound SDK client inside the route handler.
2. Call `page()` before resolving personalized entries for that response.
3. Use `result.accepted` and `result.data` to handle consent-blocked or unavailable data paths.
4. Pass returned `profile`, `selectedOptimizations`, and `changes` to downstream render logic.

This route is the quick start's handler with three additions: it gates consent on the app's real
decision (`allowed`), persists the profile only when `canPersistProfile` is `true`, and returns
`selectedOptimizations` and `changes` alongside the profile.

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

`ANONYMOUS_ID_COOKIE` is an SDK-defined constant that resolves to the cookie name `ctfl-opt-aid`;
import it rather than hardcoding the string, and do not rename it — the browser Web SDK reads the
same name. Use this shared cookie when the same app also runs the Web SDK in the browser, and do not
mark it `HttpOnly` in a hybrid Node + Web SDK app because browser-side SDK code must read it. In a
server-only app, a session store or a stricter cookie policy can be valid.

For the lower-level mechanics, see
[Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md).

### Fetch and resolve Contentful entries

**Integration category:** Required for first integration

Your app owns the Contentful delivery client, credentials, and delivery policy. The preferred
Contentful path passes an app-owned `contentful.js` client to the SDK, then calls the request-bound
`requestOptimization.fetchOptimizedEntry(entryId)` helper after `page()` or `identify()`.

This is Milestone 2: the quick start proved an accepted event and a profile; here you turn that into
a rendered variant. The one genuinely new call is `requestOptimization.fetchOptimizedEntry(entryId)`,
which fetches the baseline entry, resolves the selected variant, and uses the latest accepted
Experience response selections when you omit `selectedOptimizations`. For several known entry IDs at
once, `requestOptimization.fetchContentfulEntries()` and `requestOptimization.prefetchManagedEntries()`
batch the fetch — entries sharing a normalized query go through one `getEntries()` call, split into
100-ID chunks when large.

Two similarly named values appear from here on, and the one-letter difference is intentional:

- **`selectedOptimizations`** (plural) is the request's whole set of selections from `page()` — what
  you pass _into_ resolution.
- **`selectedOptimization`** (singular) is the one selection the resolver returns _for a specific
  entry_: which experience and variant index applied to it. Use it for tracking and analytics.

1. Configure the SDK with `contentful: { client, defaultQuery?, cache? }` (done once in your
   `optimization.ts` module from [Install and initialize the Node SDK](#install-and-initialize-the-node-sdk)).
2. Call `page()` or `identify()` before resolving entries for the response.
3. Call `requestOptimization.fetchOptimizedEntry(entryId)` inside the request handler.
4. Render the returned `entry`. If resolution cannot find a matching optimization or variant, the
   resolver returns the baseline entry.

**Adapt this to your use case:** the SDK config below repeats the `optimization.ts` module from the
install section so the `contentful.client` requirement is visible in one place — reuse your existing
instance rather than creating a second one. The route handler is the new part.

```ts
import * as contentful from 'contentful'

const contentfulClient = contentful.createClient({
  accessToken: required('CONTENTFUL_DELIVERY_TOKEN'),
  environment: required('CONTENTFUL_ENVIRONMENT'),
  space: required('CONTENTFUL_SPACE_ID'),
})

// This is the same singleton from optimization.ts; shown here so contentful.client is visible.
const optimization = new ContentfulOptimization({
  clientId: required('CONTENTFUL_OPTIMIZATION_CLIENT_ID'),
  contentful: {
    client: contentfulClient,
    // Include linked optimization entries and variants before SDK resolution.
    defaultQuery: { include: 10 },
  },
  environment: process.env.CONTENTFUL_OPTIMIZATION_ENVIRONMENT ?? 'main',
  locale: 'en-US',
})

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
  const {
    baselineEntry: article,
    entry: optimizedArticle,
    selectedOptimization,
  } = await requestOptimization.fetchOptimizedEntry(req.params.entryId)

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

Use `requestOptimization.fetchOptimizedEntry()` in request handlers. If you call
`optimization.fetchOptimizedEntry()` on the singleton for personalized content, pass
`selectedOptimizations` explicitly.

Use manual baseline-entry fetching plus `resolveOptimizedEntry()` when the app needs custom delivery
behavior, GraphQL, REST without `contentful.js`, or an already-fetched baseline entry:

**Adapt this to your use case:**

```ts
const baselineEntry = await contentfulClient.getEntry(req.params.entryId, {
  include: 10,
  locale: appLocale,
})
const { entry: optimizedArticle } = optimization.resolveOptimizedEntry(
  baselineEntry,
  pageResponse?.selectedOptimizations,
)
```

Do not configure SDK-managed fetches or manual fetches with `contentful.js` `withAllLocales` or raw
CDA `locale=*` responses. The resolver expects direct single-locale field values such as
`fields.nt_experiences` and `fields.nt_variants`. For the entry contract, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

## Optional integrations

### Resolve merge tags

**Integration category:** Optional

Use this helper when your Contentful content contains MergeTag entries. A MergeTag is an authored
placeholder embedded in Rich Text (for example a visitor's first name or city) that the SDK fills in
from the request's `profile` at render time, falling back to a default value when the profile has no
value for it.

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
entry language line up. For SDK-managed entry fetching on a request-bound client,
`forRequest({ locale })` supplies the managed Contentful query locale when neither
`contentful.defaultQuery` nor the per-call query sets `locale`.

### Read Custom Flags

**Integration category:** Optional

Use this helper when your Experience response includes Custom Flag changes.

1. Read flags from the accepted Experience response's `changes`.
2. Render the server response from the returned flag value.
3. Emit a flag-view event explicitly when your reporting policy needs a flag exposure.

The flag name you pass to `getFlag()` and `componentId` (`'new-navigation'` below) must match the
Custom Flag key you authored in Contentful — it is not a free-choice label. `getFlag()` returns the
authored value, so type its use to your flag (here, comparing against `true` for a boolean flag).

**Copy this:**

```ts
// 'new-navigation' must match the Custom Flag key authored in Contentful.
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

Unlike a Custom Flag key, the `track()` `event` name and its `properties` are your own free-choice
labels — pick names that fit your analytics plan; they do not need to match anything authored in
Contentful.

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

  // 'quote_requested' and its properties are your own analytics labels, not authored IDs.
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
const selectedReplacementEntryId = selectedOptimization?.variants[baselineHeroEntry.sys.id]
const selectedVariantEntryId =
  selectedReplacementEntryId && selectedReplacementEntryId !== baselineHeroEntry.sys.id
    ? selectedReplacementEntryId
    : undefined

analytics.track('Quote Requested', {
  plan: 'enterprise',
  contentful_profile_id: canForwardOptimizationProfileId ? pageResponse?.profile.id : undefined,
  contentful_experience_id: selectedOptimization?.experienceId,
  contentful_variant_index: selectedOptimization?.variantIndex,
  contentful_baseline_entry_id: baselineHeroEntry.sys.id,
  contentful_rendered_entry_id: resolvedHeroEntry.sys.id,
  contentful_selected_variant_entry_id: selectedVariantEntryId,
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
   `preflight`, IP override, or a custom Insights `beacon` sender.

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
3. Resolve variants from the current request's `selectedOptimizations`, or use
   `requestOptimization.fetchOptimizedEntry()` so the request-bound helper supplies them.
4. Render MergeTags against the current request's `profile`.
5. Do not memoize `page()`, `identify()`, `track()`, or `trackView()` results as if they were pure
   reads.

Use this cache-safety table when planning production caching:

| Artifact                                                       | Shared-cache safe? | Notes                                                                                                                                          |
| -------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw `contentful.js` entry or query response                    | Yes                | Key by entry or query, locale, include depth, environment, host, and delivery mode                                                             |
| SDK-managed entry cache                                        | Yes                | Caches baseline entries from managed `getEntry()` and `getEntries()` fetches; configure with `contentful.cache` or disable with `cache: false` |
| `resolveOptimizedEntry(entry, selectedOptimizations)` result   | Conditional        | Safe only if keyed by the baseline entry version plus a `selectedOptimizations` fingerprint                                                    |
| Merge-tag-rendered rich text                                   | No                 | Depends on the current request `profile`                                                                                                       |
| SSR HTML with personalized content                             | Usually no         | Safe only when the cache varies on all personalization inputs                                                                                  |
| `page()`, `identify()`, `track()`, and `trackView()` responses | No                 | These methods perform side effects and must not be memoized                                                                                    |

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

## Troubleshooting

| Symptom                                                          | Likely cause                                                                                                 | Check                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Entry always resolves to the baseline                            | No variant applies, no `selectedOptimizations` passed, the entry is not optimized, or an all-locale payload  | Author a variant that targets you, confirm an accepted `page()`/`identify()` ran first, fetch one `locale` with enough `include`          |
| The variant never appears even though it is authored             | The request does not match the experience's audience, or resolution ran without the request's selections     | Target all visitors for a first test or force the variant with the preview panel; pass `selectedOptimizations` or use the bound helper    |
| `page()` returns `{ accepted: false }`                           | Event consent is not granted and the event type is not allow-listed                                          | Bind `consent.events: true` for the request, or confirm `allowedEventTypes` permits `page`; inspect `onEventBlocked`                      |
| `trackView() requires a request-bound profile id` error thrown   | A non-sticky `trackView()`, `trackClick()`, `trackHover()`, or `trackFlagView()` ran without a bound profile | Pass `forRequest({ profile })`, or use sticky `trackView()` which derives the profile from its Experience response                        |
| Profile does not stay consistent across requests                 | The returned `profile.id` is not persisted, or `canPersistProfile` was `false`                               | Persist the ID only when `requestOptimization.canPersistProfile` is `true`, then read it back into `forRequest({ profile })`              |
| Hybrid browser sessions start with a different anonymous profile | Server and browser do not share the same readable anonymous-id cookie                                        | Verify the `ctfl-opt-aid` cookie path and same-site settings, and that it is not `HttpOnly` so browser SDK code can read it               |
| Merge tags render the fallback for every visitor                 | No matching profile value, or the profile locale and entry locale differ                                     | Confirm `getMergeTagValue()` receives the request `profile`, and pass one `APP_LOCALE` to both the CDA fetch and `forRequest({ locale })` |
| Personalized output leaks between visitors                       | A `page()`/`identify()` response or merge-tag-rendered entry was shared through a cache                      | Cache only raw Contentful payloads; clone before request transforms; never memoize event-method responses                                 |

## Reference implementations to compare against

Use these reference implementations when you want working repository examples instead of guide
snippets:

- [Node SSR Only](../../implementations/node-sdk/README.md): server-only SSR flow with `page()`,
  `identify()`, `resolveOptimizedEntry()`, `getMergeTagValue()`, raw Contentful entry caching, and
  single-locale CDA requests.
- [Node SSR + Web SDK Vanilla](../../implementations/node-sdk+web-sdk/README.md): consent-aware
  cookie sharing with `ANONYMOUS_ID_COOKIE` for Node and Web SDK continuity, plus browser-side
  follow-up tracking and entry resolution.
