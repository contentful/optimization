# Next.js Hybrid SSR + CSR Takeover Reference Implementation

`react-web-sdk_nextjs` — Next.js App Router reference demonstrating the "SSR → CSR Takeover"
pattern. First paint is server-resolved via the Node SDK (no flicker), after hydration the React
Web SDK takes over for reactive entry resolution and SPA-style navigation.

## Pattern: Hybrid SSR + CSR Takeover 

This is setup is the first page load is fully server-resolved (identical to nextJs-ssr), but
after hydration the React Web SDK takes over. Subsequent navigations, identify, consent, and profile
changes all re-resolve entries client-side without a server roundtrip.

### Why this pattern?

- **No flicker on first paint.** The initial HTML contains server-resolved personalized content
- **Instant reactivity after hydration.** Identify, consent, reset all re-resolve entries
  immediately — no page refresh needed.
- **SPA-style navigation.** After first paint, `<Link>` navigations resolve variants client-side
  (faster, no server roundtrip).
- **Best of both worlds.** Combines the SEO and first-paint benefits of SSR with the reactivity of
  CSR.
- **No Next.js SDK needed.** Achievable today with the Node SDK + React Web SDK composition.

### Trade-offs

- **Higher complexity than nextJs-ssr.** Must manage both server-side resolution (Server Components)
  and client-side resolution (Client Components with `<OptimizedEntry>`).
- **Two resolution paths.** First paint uses `sdk.resolveOptimizedEntry()` on the server; subsequent
  interactions use `resolveEntry()` / `<OptimizedEntry>` on the client.
- **State handoff gap.** `OptimizationProvider` cannot currently accept pre-fetched server data — it
  always initializes fresh and calls the Experience API from the browser. This means the client SDK
  makes a redundant API call on hydration to get the same `selectedOptimizations` the server already
  resolved.

### Responsibility split

| Concern | First paint (Server) | After hydration (Client) |
|---------|---------------------|--------------------------|
| Profile resolution | Middleware + Server Component (Node SDK) | React Web SDK (automatic on init) |
| Entry resolution | `sdk.resolveOptimizedEntry()` in Server Component | `resolveEntry()` / `<OptimizedEntry>` via hooks |
| Entry fetching | Server-side from CDA | Client-side from CDA (for new routes) |
| Page tracking | N/A | `NextAppAutoPageTracker` fires on route change |
| Interaction tracking | N/A (data attributes rendered server-side) | `autoTrackEntryInteraction` observes elements |
| Consent / Identify / Reset | N/A | React Web SDK — triggers immediate re-resolution |

### Behavioral expectations

| Phase | Content behavior |
|-------|-----------------|
| First page load | Server-resolved personalized HTML (no flicker, no loading state) |
| After hydration | React Web SDK initializes, fires page event, starts tracking |
| User identifies | `sdk.identify()` → `selectedOptimizations` updates → entries re-resolve instantly |
| User grants consent | `sdk.consent()` → re-resolution if optimization rules depend on consent state |
| Client-side navigation (`<Link>`) | `NextAppAutoPageTracker` fires page event → new entries fetched client-side → resolved via `resolveEntry()` |
| Full page navigation (browser refresh) | Back to server-resolved first paint |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ FIRST REQUEST (Server — identical to nextJs-ssr)                       │
│                                                                     │
│  1. Middleware (Edge Runtime)                                       │
│     ├─ Read `ctfl-opt-aid` cookie from request                     │
│     ├─ Call Node SDK `sdk.page()` with request context + profile    │
│     └─ Set `ctfl-opt-aid` cookie on response with profile.id       │
│                                                                     │
│  2. Server Component (landing page)                                 │
│     ├─ Read `ctfl-opt-aid` cookie                                  │
│     ├─ Fetch entries from CDA + call `sdk.page()` in parallel      │
│     ├─ `sdk.resolveOptimizedEntry()` for each entry                │
│     └─ Render personalized HTML (zero client JS for content)        │
│                                                                     │
│  ↓ HTML response with personalized content                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ HYDRATION + SPA TAKEOVER (Browser)                                  │
│                                                                     │
│  3. ClientProviderWrapper (dynamic, ssr: false)                     │
│     ├─ OptimizationRoot initializes Web SDK                         │
│     ├─ Reads `ctfl-opt-aid` cookie → same identity as server       │
│     ├─ Calls Experience API → gets selectedOptimizations            │
│     └─ NextAppAutoPageTracker fires initial page view               │
│                                                                     │
│  4. Subsequent navigations (client-side via <Link>)                 │
│     ├─ NextAppAutoPageTracker fires page event for new route        │
│     ├─ Client Component fetches entries from CDA                    │
│     ├─ <OptimizedEntry> / resolveEntry() resolves with current      │
│     │   selectedOptimizations                                       │
│     └─ React renders personalized content (no server roundtrip)     │
│                                                                     │
│  5. User actions (identify, consent, reset)                         │
│     ├─ sdk.identify() / sdk.consent() / sdk.reset()                │
│     ├─ selectedOptimizations updates reactively                     │
│     └─ <OptimizedEntry liveUpdates={true}> re-resolves immediately │
└─────────────────────────────────────────────────────────────────────┘
```

## Key implementation patterns

### 1. Landing page is a Server Component (same as nextJs-ssr)

The first page the user hits resolves entries server-side. No loading state, no flicker:

```typescript
// app/page.tsx (Server Component)
const { entry: resolved } = sdk.resolveOptimizedEntry(entry, optimizationData.selectedOptimizations)
```

### 2. Subsequent pages use Client Components with `<OptimizedEntry>`

After hydration, navigating to other routes fetches entries client-side and resolves them via the
React Web SDK:

```typescript
// app/other-page/page.tsx ("use client")
import { OptimizedEntry } from '@contentful/optimization-react-web'

function PersonalizedSection({ entry }) {
  return (
    <OptimizedEntry baselineEntry={entry} liveUpdates={true}>
      {({ resolvedEntry }) => <div>{resolvedEntry.fields.text}</div>}
    </OptimizedEntry>
  )
}
```

### 3. `liveUpdates={true}` enables reactive re-resolution

When the user's profile changes (identify, consent, reset), entries with `liveUpdates={true}`
automatically re-resolve and re-render without any manual state management:

```typescript
<OptimizedEntry baselineEntry={entry} liveUpdates={true}>
  {({ resolvedEntry }) => <Content entry={resolvedEntry} />}
</OptimizedEntry>
```

### 4. Cookie bridge (same as nextJs-ssr)

Middleware creates `ctfl-opt-aid`, Server Components read it, and the Web SDK picks it up from
`document.cookie` on hydration. Same identity across server and client.

### 5. `<Link>` for SPA navigation

Using Next.js `<Link>` avoids full page reloads. The `NextAppAutoPageTracker` detects route changes
and fires page events, which may update `selectedOptimizations` if the new page context matches
different audience rules.

### 6. Mixed route strategy

Some routes can be Server Components (SSR-resolved), others can be Client Components (CSR-resolved).
This is a natural capability of the Next.js App Router — you choose per-route:

- **High-SEO pages** (homepage, landing pages): Server Component + Node SDK resolution
- **Interactive pages** (dashboard, account): Client Component + React Web SDK resolution

## Known gap: redundant API call on hydration

The `OptimizationRoot` always initializes a fresh Web SDK instance that calls the Experience API to
get `selectedOptimizations`. This is the same data the server already resolved. Currently there is
no way to pass server-resolved optimization data into the client provider to skip this call.

**Impact:** Slight delay after hydration before client-side resolution is ready. The server-rendered
content remains visible (no flicker), but client-side reactivity only activates after the Web SDK's
API call completes.

**Future solution:** An `initialOptimizationData` prop on `OptimizationRoot` that seeds the SDK
state without a redundant API call. This would make the SSR → CSR handoff seamless.

## When does the user see updated personalization?

| User action | Effect | Timing |
|---|---|---|
| First page load | Server-resolved personalized content | Immediate (in HTML) |
| After hydration (same page) | No change — server content stays | Seamless |
| Identify / consent / reset | Entries with `liveUpdates` re-resolve | Instant (client-side) |
| Navigate via `<Link>` | New page entries resolved client-side | Fast (no server roundtrip) |
| Browser refresh / full navigation | Back to server-resolved first paint | Immediate (new SSR) |

## Comparison with nextJs-ssr

| | nextJs-ssr (SSR + Events-Only) | (Hybrid SSR + CSR Takeover) |
|---|---|---|
| **First paint** | Personalized (server-resolved) | Personalized (server-resolved) |
| **After identify** | No change until next server request | Immediate re-resolution |
| **Subsequent navigation** | Full server roundtrip | Client-side (SPA) |
| **Complexity** | Lower (server is sole truth) | Higher (two resolution paths) |
| **Node SDK** | Required | Required (first paint only) |
| **React Web SDK role** | Events/tracking only | Events + entry resolution |
| **Content reactivity** | Static | Live |

## When to use this pattern

- Marketing sites that need both SEO (first paint) AND instant personalization reactions (after
  identify)
- Sites with multi-page flows where subsequent navigations should feel like an SPA
- Customer setups that want "Welcome back, [name]!" to appear immediately after identification
  without a page refresh
- Teams already using nextJs-ssr who need to add client-side reactivity for specific pages

## When NOT to use this pattern

- If you never need client-side reactivity — use nextJs-ssr (simpler, server is sole truth)
- If your site is a pure SPA with no server rendering — use the React Web SDK directly (see
  `react-web-sdk` implementation)
- If the redundant API call on hydration is unacceptable and the `initialOptimizationData` gap
  hasn't been resolved yet

## Setup

```bash
pnpm build:pkgs
pnpm implementation:run -- react-web-sdk_nextjs implementation:install
cp implementations/react-web-sdk_nextjs/.env.example implementations/react-web-sdk_nextjs/.env
```

## Development

```bash
pnpm implementation:run -- react-web-sdk_nextjs dev
```

## Related

- [nextJs-ssr: SSR + Events-Only](../react-web-sdk+node-sdk_nextjs-ssr/README.md) — Server resolves
  content, client tracks events only. Content is static until next server request.
- [React Web SDK (pure CSR, non-Next.js)](../react-web-sdk/README.md) — Pure client-side
  personalization without any server involvement.
- [Web SDK + React (custom adapter)](../web-sdk_react/README.md) — CSR with hand-rolled adapter
  layer on the raw Web SDK.
