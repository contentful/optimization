# Next.js CSR Reference Implementation

`react-web-sdk_nextjs` — Next.js App Router reference using `@contentful/optimization-react-web` for
pure client-side entry resolution. No Node SDK, no SSR personalization.

## Architecture

```
Browser loads page
  → Next.js serves HTML shell (no personalized content yet)
  → React SDK initializes via ClientProviderWrapper (dynamic, ssr:false)
  → SDK calls Experience API from the browser
  → Component fetches entries from Contentful CDA
  → SDK resolves entries client-side
  → React renders personalized content
```

- **First paint**: loading state until JS loads and SDK resolves
- **Reactivity**: immediate — identify, consent, reset all re-resolve entries instantly
- **Client JS**: required for all content rendering
- **Node SDK**: not used

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
