# Migrating experience.js Next.js to the App Router SDK

Use this guide when a Next.js App Router app carries legacy Next.js, ESR, SSR plugin, or React
experience.js wiring and you want to move to `@contentful/optimization-nextjs/app-router`.

## What changes

The App Router SDK provides bound server and client components for request context, server first
paint, browser takeover, route tracking, and entry resolution. Legacy Next provider, tracker, SSR
plugin, ESR helper, React component, and plugin behavior should be replaced by the App Router SDK
plus the shared migration guides.

Start with the
[Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).

## Before you migrate

Gather these inputs:

- Current `@ninetailed/experience.js-next`, `@ninetailed/experience.js-next-esr`, SSR plugin, and
  React imports.
- Existing middleware, proxy, route tracker, and page-event ownership.
- Use of `ntaid` or browser legacy storage for profile continuity.
- Personalized Server Components, Client Components, and Contentful fetches.
- Consent policy and whether server personalization may make affected routes dynamic.

## Migration path

1. Confirm this app should use App Router through
   [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md).
   Then open the
   [App Router integration quick start](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#quick-start)
   and make the request handler run before replacing render components.
2. Migrate authored Contentful entries when legacy mapper output is still required. See
   [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md).
3. Install and bind the App Router SDK.
4. Replace SSR/ESR profile continuity with target request context and cookie behavior.
5. Replace server-rendered personalization with bound `OptimizedEntry`.
6. Replace browser takeover features and plugins through target client surfaces.
7. Remove legacy Next, ESR, React, and plugin packages after imports are gone.

## Replace legacy surfaces

### Remove legacy Next.js package assumptions

Do not carry forward package-root or ESR helper assumptions. The target App Router import path is
`@contentful/optimization-nextjs/app-router`, with browser hooks from
`@contentful/optimization-nextjs/client`. Legacy ESR middleware and selector files are not supported
public import surfaces.

Remove legacy tracker and provider wiring before adding the bound target root, so one route owner is
responsible for server data and browser tracking.

### Install and bind the App Router SDK

Create bound App Router components once using the target integration guide. Configure the request
handler file and export in
[Request context and the profile cookie](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#request-context-and-the-profile-cookie):
Next.js 16 uses `proxy.ts` with a `proxy` export, while Next.js 15 uses `middleware.ts` with a
`middleware` export.

With `server.enabled: true`, a missing or misnamed handler is not a baseline fallback path; the
bound root expects server data and throws when the handler did not run. Verify the handler runs by
loading a matched route and confirming the root no longer reports missing server optimization data
before replacing many render surfaces.

### Replace SSR/ESR profile continuity

Move profile continuity to the App Router request context and target SDK cookie behavior. The target
profile cookie is `ctfl-opt-aid`; it must be browser-readable so browser takeover can continue the
same visitor. The app still owns the consent record and the server consent resolver.

The request handoff records whether server evaluation accepted the initial page event in
`handoff.initialPageEvent`. Pass the handoff to `OptimizationRoot`, which consumes that instruction.
Keep the separate `NextAppAutoPageTracker` mounted with
`initialPageEvent={handoff ? 'skip' : 'emit'}` so it skips whenever the root has a handoff and emits
the first route only when no handoff exists.

### Replace server-rendered personalization

Replace legacy mapped experiences and React wrappers with the bound App Router `OptimizedEntry`.
Use `baselineEntry` when your app fetched the entry manually. Use `entryId` only when the binding
config includes `contentful` for managed server fetching. If the browser must continue that managed
entry, pass matching descriptors through the bound root's `prefetchManagedEntries` prop so it adds
the fetched baselines to `handoff.entries`, or supply a handoff that already contains those entries.
The server component resolves against the current request's selected optimizations and returns the
variant or baseline.

Server personalization reads request data and makes the route dynamic. Do not keep ISR or static
assumptions on routes that render request-specific personalized output.

### Replace browser takeover features

Client-side flags, analytics forwarding, preview, and live updates use the React Web runtime behind
the App Router SDK:

- Flag reads auto-attempt flag-view tracking when consent and profile state allow it.
- Accepted and blocked event streams are available on the live client SDK.
- Preview panel attachment is a browser concern and forces live updates while open.
- Legacy plugin behavior moves to
  [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md).

### Validate App Router migration

Verify server HTML, hydration, and browser takeover together:

- The request handler runs for the personalized route.
- Server-rendered content uses the expected variant or baseline.
- Browser hydration does not briefly revert to empty optimization state.
- The root follows the handoff's first-page instruction, and the separate browser tracker skips
  whenever that handoff is present.
- Personalized HTML and resolved outputs are not shared across visitors through caching.

## Validate the migration

- Search for remaining `@ninetailed/experience.js-next`, `@ninetailed/experience.js-next-esr`, and
  legacy React imports.
- Verify one all-visitors variant on a dynamic App Router route.
- Verify denied consent and accepted consent event paths.
- Verify preview and analytics forwarding only after the core route works.

## Troubleshooting

| Symptom                                           | Check                                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The bound root throws instead of showing baseline | Confirm the App Router request handler file and export match your Next.js version and route matcher.            |
| The route conflicts with static generation        | Server personalization is request-specific; use a dynamic route or move personalization to a browser-only path. |
| Hydration changes the entry                       | Pass the same baseline entry path or matching managed-entry handoff to the browser.                             |
| Duplicate page events appear                      | Pass the handoff to the root; set the separate tracker to `initialPageEvent={handoff ? 'skip' : 'emit'}`.       |

## Related guides

- [Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Choosing a Next.js migration path from experience.js](./choosing-a-nextjs-migration-path-from-experience-js.md)
- [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [Profile synchronization between client and server](../concepts/profile-synchronization-between-client-and-server.md)
- [App Router reference implementation](../../implementations/nextjs-sdk_app-router/README.md)
