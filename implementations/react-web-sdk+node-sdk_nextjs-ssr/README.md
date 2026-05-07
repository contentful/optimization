# Next.js SSR + Client Events Reference Implementation

`react-web-sdk+node-sdk_nextjs-ssr` — Next.js App Router reference using
`@contentful/optimization-node` for server-side entry resolution and
`@contentful/optimization-react-web` for client-side event tracking and interactive controls.

## Pattern: SSR-Primary with CSR Analytics

This setup is the simplest and most robust Next.js personalization pattern. The server owns all
personalization decisions. The client owns all analytics and interactive concerns.

### Why this pattern?

- **No flicker.** Personalized content is in the HTML from the server. No loading states, no
  client-side variant swaps.
- **Full SEO.** Search engines see the resolved personalized content.
- **Minimal client JS.** Content rendering requires zero JavaScript. Only tracking and interactive
  controls (consent, identify) need client hydration.
- **No Next.js SDK needed.** The Node SDK (stateless) works in Server Components and Middleware. The
  React Web SDK (stateful) works in Client Components. No framework-specific glue package required.

### Responsibility split

| Concern                                          | Where it runs             | SDK used                                    |
| ------------------------------------------------ | ------------------------- | ------------------------------------------- |
| Anonymous ID cookie lifecycle                    | Middleware (Edge Runtime) | Node SDK                                    |
| Profile resolution (`sdk.page()`)                | Server Component          | Node SDK                                    |
| Entry variant resolution                         | Server Component          | Node SDK (`resolveOptimizedEntry`)          |
| HTML rendering of personalized content           | Server Component          | None (plain React)                          |
| Page view tracking                               | Client (after hydration)  | React Web SDK (`NextAppAutoPageTracker`)    |
| Entry interaction tracking (views/clicks/hovers) | Client (after hydration)  | React Web SDK (`autoTrackEntryInteraction`) |
| Consent management                               | Client (after hydration)  | React Web SDK (`sdk.consent()`)             |
| User identification                              | Client (after hydration)  | React Web SDK (`sdk.identify()`)            |

### Behavioral expectations

Once the page is served, the personalized content is **static until the next server roundtrip**.
Client-side actions like granting consent or identifying the user update the Web SDK's internal
state and fire analytics events, but they do **not** cause the page content to re-render or swap
variants. The user sees the updated personalization only on the next full navigation (a new server
request where the Node SDK re-resolves entries with the updated profile).

This is intentional: the server is the single source of truth for what content to show. The client
never contradicts what the server rendered.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ REQUEST PHASE (Server)                                              │
│                                                                     │
│  1. Middleware (Edge Runtime)                                       │
│     ├─ Read `ctfl-opt-aid` cookie from request                     │
│     ├─ Call Node SDK `sdk.page()` with request context + profile    │
│     └─ Set `ctfl-opt-aid` cookie on response with profile.id       │
│                                                                     │
│  2. Server Component (page.tsx)                                     │
│     ├─ Read `ctfl-opt-aid` cookie (set by middleware in same cycle) │
│     ├─ Fetch Contentful entries from CDA (in parallel)              │
│     ├─ Call Node SDK `sdk.page()` → get selectedOptimizations       │
│     ├─ For each entry: `sdk.resolveOptimizedEntry(entry, selected)` │
│     └─ Render resolved entries as plain HTML                        │
│                                                                     │
│  ↓ HTML response with personalized content                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ HYDRATION PHASE (Browser)                                           │
│                                                                     │
│  3. ClientProviderWrapper (dynamic, ssr: false)                     │
│     ├─ OptimizationRoot initializes Web SDK                         │
│     ├─ Reads `ctfl-opt-aid` cookie → same identity as server       │
│     ├─ NextAppAutoPageTracker fires page view event                 │
│     └─ autoTrackEntryInteraction observes elements with             │
│        data-ctfl-entry-id attributes (views, clicks, hovers)        │
│                                                                     │
│  4. InteractiveControls (client component)                          │
│     ├─ Subscribes to sdk.states.consent / sdk.states.profile        │
│     ├─ Renders consent toggle button                                │
│     └─ Renders identify / reset buttons                             │
│                                                                     │
│  Note: No content re-rendering happens client-side.                 │
│  Content remains as server-rendered until next navigation.           │
└─────────────────────────────────────────────────────────────────────┘
```

## Key implementation patterns

### 1. Cookie as the identity bridge

The `ctfl-opt-aid` cookie is the **only shared state** between server and client. Middleware creates
it, the Server Component reads it, and the Web SDK reads it from `document.cookie` after hydration.
This ensures both sides operate on the same anonymous profile.

```typescript
// middleware.ts
const anonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value
const profile = anonymousId ? { id: anonymousId } : undefined
const data = await sdk.page({ ...requestContext, profile })
response.cookies.set(ANONYMOUS_ID_COOKIE, data.profile.id, { path: '/', sameSite: 'lax' })
```

### 2. Node SDK as a module-level singleton

The Node SDK is stateless and safe to reuse across requests. A single instance is created at module
load and imported by both middleware and page:

```typescript
// lib/optimization-server.ts
import ContentfulOptimization from '@contentful/optimization-node'
const sdk = new ContentfulOptimization({ clientId, environment, api })
export { sdk }
```

### 3. React Web SDK loaded only on the client

The Web SDK depends on browser APIs (`localStorage`, `document.cookie`, `IntersectionObserver`).
Using `next/dynamic` with `ssr: false` prevents any server-side instantiation:

```typescript
// components/ClientProviderWrapper.tsx
const OptimizationRoot = dynamic(
  () =>
    import('@contentful/optimization-react-web').then((mod) => ({ default: mod.OptimizationRoot })),
  { ssr: false },
)
```

### 4. Server Components never import from the React Web SDK

This is a hard rule. Server Components use `@contentful/optimization-node` only. Client Components
(`"use client"`) use `@contentful/optimization-react-web` only. Mixing them causes runtime errors or
bundling issues.

### 5. Data attributes for automatic interaction tracking

Server-rendered entries include `data-ctfl-entry-id` and `data-ctfl-baseline-id` attributes. After
hydration, the Web SDK's `autoTrackEntryInteraction` uses a MutationObserver to detect these
elements and registers IntersectionObserver (views), click listeners, and hover listeners
automatically:

```tsx
<div data-ctfl-entry-id={resolvedEntry.sys.id} data-ctfl-baseline-id={baselineEntry.sys.id}>
  {/* content */}
</div>
```

## When does the user see updated personalization?

| User action                                | Effect on displayed content             | When personalization updates |
| ------------------------------------------ | --------------------------------------- | ---------------------------- |
| First page load (anonymous)                | Baseline or variant per profile         | Immediate (server-resolved)  |
| Grant/reject consent                       | No change to content                    | Next server request          |
| Identify (`sdk.identify()`)                | No change to content                    | Next server request          |
| Navigate to another page (full navigation) | New server-resolved content             | Immediate (new SSR)          |
| Browser refresh                            | Server re-resolves with updated profile | Immediate (new SSR)          |

The key insight: **client actions update the profile server-side (via the Experience API)**, but the
rendered content is only a snapshot of the profile state at the time of the server request. The next
request will reflect the updated profile.

## Setup

```bash
pnpm build:pkgs
pnpm implementation:run -- react-web-sdk+node-sdk_nextjs-ssr implementation:install
cp implementations/react-web-sdk+node-sdk_nextjs-ssr/.env.example implementations/react-web-sdk+node-sdk_nextjs-ssr/.env
```

## Development

```bash
pnpm implementation:run -- react-web-sdk+node-sdk_nextjs-ssr dev
```

## When to use this pattern

- Content-heavy marketing sites where SEO and first-paint performance matter
- Sites where personalization is based on profile traits, audience segments, or geo — not real-time
  interactions within the same page
- Teams that want the simplest mental model: server decides what to show, client tracks what
  happened
- Sites already using Next.js App Router with Server Components

## When NOT to use this pattern

- If you need instant client-side variant swaps after identify (e.g., "Welcome back, Charles!"
  appearing without a page refresh) — consider (Hybrid SSR + CSR takeover)
- If your site is a pure SPA with no server rendering — use the React Web SDK directly (see
  `react-web-sdk` implementation)
- If you need edge-side personalization for static/cached pages — consider a middleware-based ESR
  pattern with `resolveOptimizedEntry` at the edge
