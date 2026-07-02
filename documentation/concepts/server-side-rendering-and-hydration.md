---
title: Server-side rendering and hydration
---

# Server-side rendering and hydration

Use this document to understand how the React layer renders personalized content on the server and
hands it off to the browser without a blank first paint or a hydration mismatch. It explains the
isomorphic runtime seam that lets the same hooks and components run in both environments, where the
server-versus-client boundary actually falls, and the determinism contract that keeps server HTML
and the first client render identical.

For installation and setup, start with the [Optimization SDK guides](../guides/README.md). For how
profile data and identifiers move between runtimes, see
[Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md).
For how a baseline entry resolves to a variant, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime applicability](#runtime-applicability)
- [The problem SSR poses](#the-problem-ssr-poses)
- [Capability tiers](#capability-tiers)
- [The isomorphic runtime seam](#the-isomorphic-runtime-seam)
  - [The provider chooses the backing](#the-provider-chooses-the-backing)
  - [Reading state on the server](#reading-state-on-the-server)
  - [Actions and tracking on the server](#actions-and-tracking-on-the-server)
- [The render lifecycle](#the-render-lifecycle)
- [The React Server Component boundary](#the-react-server-component-boundary)
- [The hydration determinism contract](#the-hydration-determinism-contract)
- [Framework handoff](#framework-handoff)

<!-- mtoc-end -->
</details>

## Runtime applicability

| Runtime                                                  | SSR role                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React Web SDK** (`@contentful/optimization-react-web`) | Owns the isomorphic provider, hooks, and `OptimizedEntry`. Renders on the server and hydrates in the browser.                                                 |
| **Core SDK** (`@contentful/optimization-core`)           | Provides the `OptimizationRuntime` contract and `createSnapshotRuntime`, the read-only runtime used for server rendering. Exposed on the `./runtime` subpath. |
| **Node SDK** (`@contentful/optimization-node`)           | Produces the request-scoped `OptimizationData` snapshot the server render is seeded with, using `forRequest()`.                                               |
| **Next.js SDK** (`@contentful/optimization-nextjs`)      | Binds the request context, resolves the snapshot, and forwards it to the provider.                                                                            |

## The problem SSR poses

The browser SDK (`ContentfulOptimization`) is stateful and browser-bound: its constructor reads
`localStorage` and `document.cookie`, attaches listeners, and registers a `window` singleton. It
cannot be constructed during server rendering, and React does not run effects (`useEffect`,
`useLayoutEffect`) on the server at all — only the render function and `useState`/`useMemo`
initializers run.

A provider that constructs the SDK in an effect and gates its children on that SDK therefore renders
nothing on the server: the effect never runs, so the children never mount, and `renderToString`
emits an empty tree. With JavaScript disabled that is a permanently blank page; with JavaScript
enabled it is a blank first paint until hydration.

The fix is not to make the browser SDK run on the server. It is to recognize that rendering
personalized content does not require the _stateful browser_ SDK — only the personalization data and
the pure logic that resolves it.

## Capability tiers

The SDK surface splits into three tiers by what each capability needs, not by environment:

| Tier            | Members                                                            | Needs a browser?    | Server behavior                                                     |
| --------------- | ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------- |
| **Resolve**     | `resolveOptimizedEntry`, `getMergeTagValue`, `getFlag`             | No — pure functions | Identical to the client                                             |
| **Read state**  | `states.{consent, profile, selectedOptimizations, canOptimize, …}` | No                  | Static values from the request snapshot                             |
| **Act / track** | `identify`, `page`, `track`, `tracking.*`, `trackCurrentPage`      | Yes                 | Inert no-ops (there is no user interaction to record on the server) |

The resolve tier already lives on `CoreBase`, the shared base class of both the stateful and
stateless runtimes, so variant resolution is available server-side with no browser globals. Reading
state server-side needs only a static view of the request's evaluated data. Only interaction
tracking genuinely needs the browser — and it is effect-only by nature (it observes DOM elements),
so it never executes during a server render.

## The isomorphic runtime seam

`OptimizationRuntime` is the single interface the hooks and components bind to. It is derived from
the stateful runtime, so the live browser SDK satisfies it by construction, and a server
implementation is forced to match the same signatures. Two runtimes implement it:

- **The live SDK** (`ContentfulOptimization`) on the client after hydration.
- **A snapshot runtime** (`createSnapshotRuntime`, on `@contentful/optimization-core/runtime`) for
  the server render and the initial client render. Its resolve methods delegate to the shared static
  resolvers, its `states` are static observables over a serialized `OptimizationData` snapshot, and
  its actions are inert no-ops that warn in development.

Consumers never see two objects or branch on environment. They call `useOptimization()` and receive
one runtime whose behavior is correct wherever it runs.

### The provider chooses the backing

`OptimizationProvider` is the only place that decides which runtime backs the context:

- On the server render and the first client render, it seeds the context with a snapshot runtime
  built from the configured consent, locale, and any `serverOptimizationState`. `isReady` is `true`,
  so children render immediately.
- In the mount effect (client only), it constructs the live `ContentfulOptimization`, hydrates it
  with the same snapshot, and swaps the context to point at it.

From that point the context is fully interactive: a later consent grant or identify call updates the
live signals and re-renders dependent components.

### Reading state on the server

Read hooks (`useConsentState`, `useProfileState`, `useSelectedOptimizationsState`, and the rest)
subscribe through `useSyncExternalStore`. On the server and during the first hydration render, React
calls the hook's `getServerSnapshot`, which reads the runtime observable's current value directly.
Because the snapshot runtime's observables are static, that value is stable and matches the value
the client is seeded with.

### Actions and tracking on the server

Event actions (`identify`, `page`, `track`) and browser-only tracking (`tracking.enableElement`,
`trackCurrentPage`) are safe to call on the snapshot runtime; they are inert no-ops. In practice the
server never reaches the browser-only ones, because they run inside effects, which do not execute
during server rendering. Keeping them present and safe means application code calls them the same
way everywhere without an environment check.

## The render lifecycle

```text
SERVER                                   BROWSER
------                                   -------
1. Resolve request OptimizationData
2. Render with a snapshot runtime   ──►  3. Paint personalized HTML immediately
   • render() + useState run                 (also what a JS-disabled browser or
   • effects DO NOT run                        crawler sees)
   • getServerSnapshot supplies state
   • OptimizedEntry resolves variants   ──►  4. Download JS
                                             5. Hydrate: first render reuses the SAME
                                                snapshot, so markup matches
                                             6. Effect constructs the live SDK,
                                                hydrates it, swaps the context
                                             7. Interactive: state changes re-render
```

## The React Server Component boundary

In the Next.js App Router, "isomorphic" applies to Client Components (`'use client'`) that are
server-rendered for first paint and then hydrate — this covers `OptimizedEntry` and every read hook.
React hooks cannot run inside a true asynchronous Server Component; that is a React rule, not an SDK
limitation.

Code that runs only in a Server Component — the fetch/decide step that produces the snapshot, or a
server-only entry render — uses the same-named imperative method,
`runtime.resolveOptimizedEntry(entry, selectedOptimizations)`, rather than a parallel vocabulary.
The developer story is therefore: resolve the snapshot in a Server Component or server helper, then
write the personalized UI as Client Components that server-render for first paint and hydrate for
interactivity.

## The hydration determinism contract

For hydration to succeed, the server render and the first client render must produce identical
markup. The rules that guarantee it:

- **Seed the first client render synchronously from the snapshot.** Never resolve initial
  personalization state inside an effect — that guarantees a flash and a hydration mismatch.
- **The serialized snapshot must be the exact value the client provider is seeded with.** Variant
  resolution is a pure function of the baseline entry and `selectedOptimizations`, so identical
  inputs produce identical output on both sides.
- **Reconcile later, not during hydration.** If the browser later discovers newer state (for example
  a locally cached profile), it applies after hydration through a normal re-render — the
  React-blessed path — rather than by rendering different initial markup.

## Framework handoff

The snapshot is a small, serializable `OptimizationData` shape (`profile`, `selectedOptimizations`,
`changes`). Each framework binds the same three seams — resolve on the server, transport the
snapshot, hydrate on the client:

- **Next.js** resolves the snapshot with the server helpers and passes it to the provider through
  `serverOptimizationState`.
- **Angular** carries the snapshot through `TransferState` and initializes read-only signals on the
  server, then the live Web SDK in the browser.

Because the resolve/read tiers are shared and the transport is one serializable shape, adding a new
framework is a thin adapter over the same contract rather than a reimplementation of personalization
logic.
