# Next.js SDK SSR reference implementation

`nextjs-sdk_ssr` is a Next.js App Router reference implementation for
`@contentful/optimization-nextjs`. The application imports only Next.js SDK subpaths:

- `@contentful/optimization-nextjs/server` in Server Components and server-only modules.
- `@contentful/optimization-nextjs/client` in Client Components.
- `@contentful/optimization-nextjs/request-handler` in proxy.

The Next.js SDK adapter owns its lower-level server/client composition internally, so this
implementation does not import, configure, or externalize lower-level SDK packages directly.

## What this demonstrates

- Server-rendered personalized first paint with `getNextjsServerOptimizationData()`.
- Server-rendered tracking markup with `ServerOptimizedEntry`.
- Anonymous ID continuity through `createNextjsOptimizationRequestHandler()`.
- Browser-side page, view, click, and hover tracking through the adapter client entry.
- `initialPageEvent="skip"` when the server already resolved the same initial page.

In this SSR pattern, content is static after hydration. Client actions such as consent, identify,
and reset update browser SDK state and analytics, but server-rendered content changes only on the
next server request.

## Architecture

```text
Request
  proxy.ts
    createNextjsOptimizationRequestHandler()
      reads app consent and anonymous ID
      calls page() when consent allows
      persists or clears the anonymous ID cookie

  app/page.tsx
    fetches CDA entries
    calls getNextjsServerOptimizationData()
    resolves entries through the request-bound SDK
    renders children through ServerOptimizedEntry

Hydration
  app/layout.tsx
    mounts OptimizationRoot from @contentful/optimization-nextjs/client
    passes initialPageEvent="skip" only after consented server page resolution

  browser tracking
    NextAppAutoPageTracker handles route page events
    trackEntryInteraction observes data-ctfl-* attributes
```

## CDA locale handling

The implementation defines one `APP_LOCALE`, passes it to the Next.js SDK server helpers, uses it
for event context, and passes it directly to Contentful CDA fetches. The hydrated provider receives
the same locale value. Do not use `contentful.js` `withAllLocales` or raw CDA `locale=*`; SDK entry
resolution expects direct single-locale fields such as `fields.nt_experiences` and
`fields.nt_variants`.

See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

## Prerequisites

Create a local environment file from the example and provide the Contentful and Optimization mock or
service values used by the other Web reference implementations:

```bash
cp implementations/nextjs-sdk_ssr/.env.example implementations/nextjs-sdk_ssr/.env
```

## Setup

Build local package tarballs, then install this implementation:

```bash
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_ssr implementation:install
```

## Running locally

```bash
pnpm implementation:run -- nextjs-sdk_ssr dev
```

The app runs on port `3001`.

## Running E2E tests

```bash
pnpm test:e2e:nextjs-sdk_ssr
```

The E2E suite mirrors the shared React SDK interaction and navigation tests that apply to
SSR-rendered markup, with additional Next.js SSR checks for server first paint, tracking attributes,
proxy cookie continuity, and skipped duplicate initial page events.

## Related

- [Next.js SDK hybrid](../nextjs-sdk_hybrid/README.md)
- [React Web SDK reference implementation](../react-web-sdk/README.md)
- [Next.js SDK adapter package](../../packages/web/frameworks/nextjs-sdk/README.md)
