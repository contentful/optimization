# Next.js SSR Hybrid Reference Implementation

`react-web-sdk+node-sdk_nextjs` — Next.js App Router reference using `@contentful/optimization-node`
for server-side entry resolution and `@contentful/optimization-react-web` for client-side event
tracking and interactive controls.

## Architecture

```
Request
  → Middleware: reads ctfl-opt-aid cookie, calls Node SDK sdk.page(), sets cookie
  → Server Component (page.tsx): reads cookie, calls Node SDK sdk.page(),
    fetches entries from CDA, resolves with sdk.resolveOptimizedEntry(),
    renders personalized HTML

Browser
  → HTML arrives with correct personalized content (zero JS for content)
  → React SDK hydrates via ClientProviderWrapper (dynamic, ssr:false)
  → InteractiveControls hydrate for consent/identify buttons
  → Auto page tracking and entry interaction tracking active
```

## Setup

```bash
pnpm build:pkgs
pnpm implementation:run -- react-web-sdk+node-sdk_nextjs implementation:install
cp implementations/react-web-sdk+node-sdk_nextjs/.env.example implementations/react-web-sdk+node-sdk_nextjs/.env
```

## Development

```bash
pnpm implementation:run -- react-web-sdk+node-sdk_nextjs dev
```
