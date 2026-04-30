# [SPIKE] Next.js Support — React Web SDK / Next.js Implementation

## Document Status

Draft

## Document Author / Owner

Lotfi Arif

## Contributor(s)

(none yet)

## PRD Links

- PRD: Optimization React Web SDK

## Reference Links

- Confluence Project Page
- GitHub Repo

---

## 1. Purpose

Determine what it takes to fully support a Next.js application (SSR, SSG, bonus ESR) with the
Optimization SDK. Evaluate whether Node SDK + React Web SDK composition is sufficient or whether a
dedicated Next.js SDK is warranted. Produce a working reference implementation.

## 2. Approaches

### Approach A: Node SDK + React Web SDK (Composition)

Customer manually wires Node SDK on the server and React Web SDK on the client — similar to the
existing `node-sdk+web-sdk` reference implementation but in a Next.js context.

- Server: Node SDK calls Experience API with `preflight: true`, passes data as props
- Client: React Web SDK hydrates with server-provided data, takes over from there
- Cookie: `ctfl-opt-aid` shared between server and client for profile continuity

| Dimension               | Assessment                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Complexity for customer | High — must manage cookies, Node SDK setup, `preflight`, data passing, `'use client'` boundaries |
| Maintenance for us      | Low — no new package                                                                             |
| Consistency             | Low — every customer wires it differently                                                        |
| Error surface           | High — easy to forget `preflight`, double-count events, or leak state                            |

### Approach B: Dedicated Next.js SDK (`@contentful/optimization-next`)

A thin package providing the standard glue code, composed from Node SDK + React Web SDK internals.
Would provide things like:

- `getOptimizationData()` — async helper for Server Components / `getServerSideProps`
- `<OptimizationServerProvider>` / `<OptimizationClientProvider>` — server/client boundary pair
- `optimizationMiddleware()` — cookie management, optionally edge variant selection
- `withOptimization(gssp)` — Pages Router HOC

| Dimension               | Assessment                                                    |
| ----------------------- | ------------------------------------------------------------- |
| Complexity for customer | Low — single provider, familiar Next.js patterns              |
| Maintenance for us      | Medium — new package, but thin wrapper over existing SDKs     |
| Consistency             | High — every customer uses the same pattern                   |
| Error surface           | Low — `preflight`, cookies, and boundaries handled internally |

### Recommendation

**Start with Approach A as a reference implementation** to prove the architecture works. If that
reveals significant boilerplate (which we expect it will), extract it into a dedicated Next.js SDK
(Approach B). The dedicated SDK is only warranted if there is standard glue code that most/all
integrations would need.

## 3. What We Need to Know

### Rendering Mode Feasibility

**SSR — Feasible.** Node SDK (`CoreStateless`) is fully request-scoped and platform-agnostic. The
pattern is: server fetches optimization data with `preflight: true`, serializes it into page props,
client hydrates with that data. The existing `node-sdk+web-sdk` implementation already proves this
flow with Express; Next.js just changes the transport (props instead of EJS templates).

**SSG — Partially feasible.** No real user at build time, so only baseline content can be resolved.
Personalization happens client-side after hydration (causes a content shift). ISR has the same
limitation unless the regeneration is request-triggered (effectively SSR).

**ESR — Research-only.** `CoreStateless` is likely Edge-compatible (no Node-specific APIs, just
global `fetch`), but needs verification. The value would be running variant selection in Next.js
Middleware at the edge. Risk: cold start + API round-trip may negate latency benefits.

### Key Technical Pieces

1. **Dehydration/rehydration:** Server fetches `OptimizationData`, passes it to a client provider
   that seeds the Web SDK state without making a fresh API call. In App Router this is natural
   (Server Component props serialize automatically). In Pages Router, `getServerSideProps` returns
   it as page props.

2. **`'use client'` / `'use server'` boundaries:** The Web SDK and all React hooks must remain in
   Client Components. Server-side data fetching (Node SDK) lives in Server Components or
   `getServerSideProps`.

3. **Cookie continuity:** `ctfl-opt-aid` cookie bridges server and client identity. Server reads it
   from the request, passes it to Node SDK; Web SDK picks it up on hydration.

4. **`preflight: true`:** Already exists in the API client. Server calls should use preflight so the
   profile state is previewed but not persisted — client persists on hydration.

### What Already Exists

- `CoreStateless` / Node SDK — fully server-safe, request-scoped, no browser APIs
- `preflight` flag on Experience API client
- `ctfl-opt-aid` cookie constant exported from both Node and Web SDKs
- Next.js router adapters (`./router/next-app`, `./router/next-pages`) in React Web SDK
- `node-sdk+web-sdk` reference implementation demonstrating the SSR-to-client handoff pattern
- `typeof window === 'undefined'` guards throughout the Web SDK

### What Is Missing

- A way for `OptimizationProvider` to accept pre-fetched server data (currently always creates a
  fresh Web SDK instance that calls the API)
- Server-side entry resolution without signals (the resolution logic in `CoreBase` is pure, but
  `OptimizedEntry` reads from signals)
- Next.js-specific cookie reading (via `next/headers` `cookies()`)
- A reference implementation proving the full Next.js flow end-to-end

## 4. Open Questions

1. **App Router, Pages Router, or both?** Architecture differs significantly. Recommend App Router
   primary, Pages Router secondary.

2. **Should `preflight: true` be the default for server-side calls?** Probably yes (server previews,
   client persists), but some customers may want server-side persistence for bots/crawlers.

3. **Is Edge Runtime compatibility a hard requirement or nice-to-have?** Determines whether we need
   to verify/fix transitive dependencies.

4. **Is there appetite for Next.js Middleware?** Enables edge-based variant selection and A/B
   routing but adds complexity.

5. **What is the anonymous ID lifecycle for SSG?** No user at build time — always render baseline
   and defer personalization to client?

6. **How should the reference implementation handle Contentful entries?** Use `contentful.js`, or
   mock/fixture approach like existing implementations?

## 5. Next Steps

1. Build a Next.js App Router reference implementation (`implementations/nextjs-react-web-sdk/`)
   using Approach A (Node SDK + React Web SDK composition)
2. Evaluate how much boilerplate the reference implementation requires
3. Decide whether to extract into a dedicated Next.js SDK (Approach B)
4. Bonus: verify `CoreStateless` Edge Runtime compatibility
