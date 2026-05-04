# Next.js React Web SDK Reference Implementation

Next.js App Router reference implementation demonstrating `@contentful/optimization-react-web`
(client-side) and `@contentful/optimization-node` (server-side SSR) working together.

## Architecture

This implementation shows two integration patterns:

- **Client-Resolved** (`/client-resolved`): Entries are resolved entirely in the browser via the
  React SDK. The server renders an HTML shell; the Web SDK resolves optimizations client-side.
- **Server-Resolved** (`/server-resolved`): Entries are pre-resolved on the server via the Node SDK
  and passed as props to client components for hydration with full interactivity.

Both patterns share a cookie-based profile (`ctfl-opt-aid`) managed by Next.js middleware, ensuring
the same anonymous profile is used across server and client.

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
  layout.tsx              # Root layout (Server Component) wraps children in client provider
  page.tsx                # Home page with navigation to both patterns
  client-resolved/        # Client-side optimization resolution demo
  server-resolved/        # Server-side pre-resolution + client hydration demo
lib/
  config.ts               # Shared SDK configuration from env vars
  contentful-client.ts    # Contentful CDA client
  optimization-server.ts  # Node SDK singleton for server-side use
components/
  OptimizationProvider.tsx # "use client" wrapper for <OptimizationRoot>
middleware.ts             # Cookie-based profile management
```
