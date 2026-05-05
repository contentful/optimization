# Next.js React Web SDK Reference Implementation

Next.js App Router reference implementation demonstrating `@contentful/optimization-react-web`
(client-side) and `@contentful/optimization-node` (server-side SSR) as independent integration
patterns.

## Purpose and Context

This reference implementation exists to explore and document the most common customer setups for
personalization in Next.js. In practice, customer architectures vary significantly:

- **Pure CSR**: SPA-style, React SDK handles everything in the browser
- **Pure SSR with client-side tracking**: Node SDK resolves personalized content on the server,
  client JS is limited to event tracking (page views, clicks, consent)
- **Hybrid**: Server resolves entries for fast first paint, client takes over for live reactivity

The right pattern depends on how the customer's solution is engineered — information typically
gathered during pre-sales and post-sales. This implementation aims to demonstrate the range of
setups so the team and customers can evaluate which approach fits their architecture.

### Current Status

This implementation currently demonstrates two patterns independently. They are **not designed to
coexist in the same running application** — navigating between them will cause a singleton conflict
because the Web SDK only allows one instance per runtime. A customer would choose one pattern for
their application, not switch between them at runtime.

### Known Limitation: Singleton Conflict Between Routes

The `ContentfulOptimization` Web SDK is a singleton. Both route layouts (`/client-resolved` and
`/server-resolved`) initialize their own `OptimizationRoot` via `ClientProviderWrapper`. Navigating
between routes without a full page reload causes:

```
ContentfulOptimization SDK failed to initialize: ContentfulOptimization is already initialized
```

This is expected given the current setup — these patterns are meant to be viewed independently
(e.g., direct navigation or separate browser tabs), not as a multi-page app with client-side routing
between them. In a real customer deployment, only one pattern would be active across the
application.

### Future Direction

To better understand what setups customers actually use, we may:

- Gather architecture information from pre-sales and post-sales teams on how customer solutions are
  engineered
- Use an AI agent to simulate common customer architectures and identify the most frequent Next.js
  feature usage patterns and personalization setups
- Expand this reference implementation into separate focused examples per customer archetype

## Architecture

Each route is fully isolated with its own SDK setup. The root layout is neutral — no SDK
initialization at the app level.

### Client-Resolved (`/client-resolved`)

The React SDK does everything in the browser. No Node SDK involvement.

```
Browser loads page
  → JavaScript downloads and executes
  → React SDK initializes (browser-only singleton via dynamic import, ssr:false)
  → SDK calls Experience API from the browser
  → Component fetches entries from Contentful CDA
  → SDK resolves entries client-side
  → React renders content
```

- **First paint**: empty/loading state until JS loads and SDK resolves
- **Reactivity**: immediate — identify, consent, reset all re-resolve entries instantly
- **Client JS**: required for all content rendering

### Server-Resolved (`/server-resolved`)

The Node SDK resolves entries on the server. Client JS is only needed for interactive controls
(consent, identify) and event tracking — not for content rendering.

```
Request hits server
  → Middleware reads ctfl-opt-aid cookie, calls Node SDK sdk.page(), sets/refreshes cookie
  → Server Component reads cookie, calls Node SDK sdk.page() for selectedOptimizations
  → Server Component fetches entries from Contentful CDA
  → Node SDK resolves entries with sdk.resolveOptimizedEntry()
  → Server renders final HTML with correct personalized content

Browser receives HTML
  → Content is visible immediately (static server HTML, zero JS)
  → InteractiveControls component hydrates for consent/identify buttons
  → Entry content does NOT re-render on hydration
```

- **First paint**: correct resolved content immediately, no loading flash
- **Reactivity**: profile changes (identify/reset) require a page refresh to re-resolve entries
- **Client JS**: only for interactive controls, not for content

### Key Differences

|                            | Client-Resolved       | Server-Resolved               |
| -------------------------- | --------------------- | ----------------------------- |
| Who resolves entries       | Browser (React SDK)   | Server (Node SDK)             |
| First paint                | Loading state         | Correct content               |
| Client JS for content      | Required              | None                          |
| Experience API called from | Browser               | Server (middleware + page)    |
| Profile changes            | Instant re-resolution | Requires page refresh         |
| `"use client"` boundary    | Entire page           | Small controls component only |

### Cookie-Based Profile Consistency

Both patterns share the `ctfl-opt-aid` cookie managed by Next.js middleware. The middleware runs on
every request and ensures an anonymous profile exists before any page renders. This is the bridge
between server and client — both SDKs use the same profile identity.

## Setup

```bash
# From the repository root:
pnpm build:pkgs
pnpm implementation:run -- react-web-sdk_nextjs implementation:install

# Copy env:
cp implementations/react-web-sdk_nextjs/.env.example implementations/react-web-sdk_nextjs/.env
```

## Development

```bash
# Start mock server + dev server:
pnpm implementation:run -- react-web-sdk_nextjs dev

# Or with PM2-managed processes:
pnpm implementation:run -- react-web-sdk_nextjs serve
pnpm implementation:run -- react-web-sdk_nextjs serve:stop
```

## Key Files

```
app/
  layout.tsx                        # Root layout — neutral, no SDK
  page.tsx                          # Home page with navigation to both patterns

  client-resolved/
    layout.tsx                      # Route layout — ClientProviderWrapper (React SDK)
    page.tsx                        # "use client" — React SDK resolves entries, full interactivity

  server-resolved/
    layout.tsx                      # Route layout — ClientProviderWrapper (React SDK for tracking)
    page.tsx                        # Server Component — Node SDK resolves entries, pure HTML
    InteractiveControls.tsx         # "use client" — consent/identify buttons only

components/
  ClientProviderWrapper.tsx         # "use client" — dynamic import of OptimizationRoot (ssr:false)

lib/
  config.ts                         # Shared SDK configuration from env vars
  contentful-client.ts              # Contentful CDA client
  optimization-server.ts            # Node SDK singleton for server-side use

middleware.ts                       # Cookie lifecycle — ensures ctfl-opt-aid exists on every request
config/entries.ts                   # Entry IDs shared across both patterns
types/contentful.ts                 # Contentful entry type definitions
```

## Design Decisions

### Why `next/dynamic` with `ssr: false`?

The Web SDK requires browser APIs (`localStorage`, `document.cookie`) and cannot be instantiated
during server rendering. Next.js server-renders `"use client"` components too — the directive only
marks the hydration boundary, not the execution boundary. `dynamic({ ssr: false })` is the standard
Next.js pattern for browser-only third-party SDKs.

### Why isolated route layouts instead of a root provider?

Each integration pattern is independent. A customer would choose one approach, not mix them. Keeping
them isolated means:

- No shared singleton conflicts between routes
- Each pattern is self-contained and testable
- Clear demonstration of what each approach requires

### Why does the middleware also call `sdk.page()`?

The middleware runs on every route. Its job is cookie lifecycle — ensuring `ctfl-opt-aid` exists for
first-time visitors regardless of which page they land on. The server-resolved page makes its own
`sdk.page()` call for data fetching. They serve different purposes.

### Why don't server-resolved entries update on identify/reset?

Server Components render once on the server. They are not reactive. To see updated entries after a
profile change, the page needs a new server render (page refresh or `router.refresh()`). This is the
fundamental SSR tradeoff: fast first paint at the cost of immediate reactivity.
