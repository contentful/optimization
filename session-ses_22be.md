# SSR vs SSG in Next.js with edge personalization

**Session ID:** ses_22be2983affe0ibj2AEPG9G17s
**Created:** 4/28/2026, 2:43:10 PM
**Updated:** 4/28/2026, 5:03:35 PM

---

## User

I need to discuss some things and it is best to go one by own here.
the first thing that i need to learn about is SSR in nextjs and what are its use cases and is it possible to always have pure SSR components? I would like to know the same case for SSG in nextJs as well
There was previously a module called Middleware (now proxy.js) that helps execute HTTP requests before they hit Next.js servers. Middleware functions are deployed at the cloud edge (e.g., CDNs or Edge workers).
I recommend including this in the reference implementation to show how the customer can use SSG while also serving personalized content by proxying requests to our Optimization API to fetch variants before NextJS renders the components, which could be useful.
I got the idea to research this from Sebastian, who mentioned that we had a customer (Home Depot) with a slow, static React frontend (cached) that did not work well with our personalization. That caused flicker on first paint, which was not ideal for them. The solution they came up with was to use an edge worker that receives the request and knows what content to serve before first paint.
Looking through the documentation, I can see that NextJS recommends avoiding its use unless there are no other options available. but would serve personalization with SSG and proxy actually work in theory if we are using something like the experience API that we have?

---

## Assistant (Debug · nt-opus · 27.4s)



This is a great architectural discussion. Let me address each point:

## SSR in Next.js

**Server-Side Rendering** generates HTML on every request at the server. Use cases:
- Pages needing real-time data (dashboards, user profiles)
- Personalized content per request
- SEO-critical pages with dynamic data

**Can you have pure SSR components?** Yes, in the App Router (Next.js 13+), all components are Server Components by default. You only need `"use client"` when you need browser APIs, event handlers, or React state/effects. In Pages Router, `getServerSideProps` achieves SSR per-page.

## SSG in Next.js

**Static Site Generation** pre-renders pages at build time. Use cases:
- Marketing pages, blogs, docs
- Product listing pages with infrequent changes
- Any content that's the same for all users

**Can you have pure SSG?** Yes, but the limitation is obvious: **SSG serves the same HTML to everyone**. There's no per-user personalization at render time. You can use ISR (Incremental Static Revalidation) to periodically rebuild, but it's still not per-user.

## The Edge Middleware / Proxy Approach for SSG + Personalization

This is the key architectural question, and **yes, it works in theory**. Here's how:

1. **User request hits the edge** (Cloudflare Worker, Vercel Edge Middleware, etc.)
2. **Edge calls the Experience/Optimization API** with the user's context (cookies, geo, device, etc.) to resolve which variant to serve
3. **Edge rewrites/proxies the request** to the correct pre-built static page variant (e.g., `/homepage?variant=B` -> serves `/homepage-b.html`)
4. **Next.js serves the pre-rendered static page** -- zero flicker, fully cached, fast TTFB

### Why this solves the Home Depot problem

The flicker happened because: static HTML renders -> client JS hydrates -> JS calls personalization API -> DOM updates with new content (flash). With edge resolution, the correct content is served **before first paint**.

### Practical considerations

- **You need to pre-build all variants as static pages** (SSG with dynamic routes or params), which means a finite, known set of variants
- **The Experience API call adds latency at the edge**, but edge functions are typically 1-50ms from the user, so the round-trip to the Optimization API is the bottleneck. If the API is fast (~50-100ms), total overhead is acceptable
- **Caching at the edge** can help -- you can cache variant resolution by segment/audience key, not just per-user
- **Cookie-based routing** is common: edge sets a cookie with the variant, subsequent requests skip the API call entirely

### Why Next.js discourages Middleware overuse

Next.js warns against heavy Middleware because:
- It runs on **every matched request** (including static assets if not filtered)
- It has a limited runtime (Edge Runtime, no Node.js APIs)
- Complex logic there is harder to debug/test
- They'd prefer you use Server Components or Route Handlers

**But personalization variant resolution is exactly the right use case for it** -- it's a lightweight, stateless decision that must happen before rendering.

## Recommendation for the Reference Implementation

Including a `proxy.js` / Middleware example that:

1. Intercepts the request at the edge
2. Calls the Optimization/Experience API to resolve the variant
3. Rewrites to the correct pre-rendered SSG page

...would be a strong demonstration. It shows customers they can have **both** the performance of SSG **and** personalized content without flicker. This is particularly compelling for large retail customers like Home Depot where TTFP and CLS are critical metrics.

The main trade-off is that variant count must be bounded and pages pre-built, but for most A/B testing and personalization scenarios (hero banners, CTAs, layouts), that's entirely feasible.

Want me to look at the current reference implementation in this repo to see how this could be integrated?

---

## User

with the practical considerations, we would need to build all the variants for this right? with the way that we do it now i am sure there is a contentful component that we can use to feed in the entry IDs that we get from the experience API which renders those entries to a degree right? since its coming from contentful anyways.

---

## Assistant (Debug · nt-opus · 13.1s)



You're right, and that's an important distinction that simplifies things significantly.

## You don't need to pre-build every variant

The flow would be:

1. **Edge receives request** -> calls Experience API -> gets back the winning variant (which is a Contentful entry ID)
2. **Edge passes that entry ID** to Next.js (via header, cookie, or rewrite param)
3. **Next.js page (SSG with ISR or SSR)** receives the entry ID and fetches that entry from Contentful at render time
4. **The Contentful component renders whatever entry it gets** -- it doesn't care which variant it is

So the page template is generic -- it's just "render this Contentful entry." The personalization decision (which entry) is made at the edge, but the actual content comes from Contentful's API as it always does.

### This means:

- **No need to pre-build N variants per page** -- you have one page/template that accepts an entry ID
- **Content authors can add/remove variants in Contentful** without triggering rebuilds
- **The Contentful SDK components already handle rendering entries** -- you just need to pass the right entry ID to them
- **SSG still works** for the page shell/layout, with the personalized content block being the dynamic part resolved at the edge

### The realistic flow becomes:

```
User -> Edge/Proxy -> Experience API -> "serve entry xyz123"
                   -> Next.js (cached template) + Contentful fetch(xyz123) -> Full HTML
```

The only latency cost is the Experience API call at the edge + the Contentful fetch for that specific entry. And if you're already using Contentful's CDN, that fetch is fast.

This is much more practical than pre-building all variant combinations. The page is essentially a shell that says "render whatever Contentful entry I'm told to," and the edge decides which entry that is.

---

## User

lets not start giving recommendations but its more me trying to learn about SSR and SSG and how I can implement it
how the HTML looks like in SSR if i were to implement react web sdk with the node SDK inside of a nextjs app 
what are the benefits and some detailed technical components of how it works under the hood and how i can be an expert on it.

---

## Assistant (Debug · nt-opus · 49.5s)



## SSR Under the Hood in Next.js

### What actually happens on a request

```
Browser sends GET /page
        ↓
Next.js server receives request
        ↓
Server executes your React component tree as JavaScript
        ↓
React's renderToString() / renderToReadableStream() converts
the component tree into an HTML string
        ↓
Server sends complete HTML to browser
        ↓
Browser paints immediately (no blank screen)
        ↓
React JS bundle downloads
        ↓
React "hydrates" — attaches event listeners to existing DOM
```

### The HTML output

When the server renders a page using SSR, the browser receives **fully formed HTML**. If you had a component like:

```jsx
// Server Component in App Router (SSR by default)
export default async function Page() {
  // This runs on the server — Node SDK call
  const experience = await fetchExperience(experienceId);
  
  return (
    <div class="hero">
      <h1>Welcome back, John</h1>
      <img src="/banner-variant-b.jpg" />
      <p>Special offer just for you</p>
    </div>
  );
}
```

The browser receives something like:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="/_next/static/chunks/main.js" defer></script>
  <script src="/_next/static/chunks/page.js" defer></script>
</head>
<body>
  <div id="__next">
    <div class="hero">
      <h1>Welcome back, John</h1>
      <img src="/banner-variant-b.jpg" />
      <p>Special offer just for you</p>
    </div>
  </div>
  <script id="__NEXT_DATA__" type="application/json">
    {"props":{"pageProps":{...serialized server data...}}}
  </script>
</body>
</html>
```

Key things to notice:
- **The content is in the HTML** — not injected later by JS
- **`__NEXT_DATA__`** is a JSON blob that Next.js injects so React on the client can hydrate without re-fetching the same data
- **Scripts are `defer`** — they load after HTML parsing, so paint happens first

### Hydration — the critical concept

Once the HTML is painted, React needs to "take over" the DOM to make it interactive. This is hydration:

1. React downloads and executes in the browser
2. It rebuilds the virtual DOM tree in memory
3. It walks the existing server-rendered DOM and **attaches event listeners** to matching nodes
4. It does NOT re-render — it assumes the server HTML matches what React would produce client-side

**If there's a mismatch** (server rendered "Welcome back, John" but client-side state says "Guest"), React throws a hydration error and may re-render, causing flicker. This is exactly what happens with client-side personalization on static pages — the server HTML doesn't match what the client wants to show.

### Server Components vs Client Components (App Router)

```
Server Component (default)
├── Runs ONLY on the server
├── Can use async/await, Node APIs, Node SDK
├── Output is HTML + React Server Component Payload (RSC Payload)
├── NEVER ships JS to the browser
└── Cannot use useState, useEffect, onClick, etc.

Client Component ("use client")
├── Renders on server first (for initial HTML) AND on client
├── Ships JS bundle to browser for hydration
├── Can use hooks, browser APIs, event handlers
└── React Web SDK components would be this if they need interactivity
```

The RSC Payload is a binary format that describes the server component tree. It's streamed alongside HTML and lets React on the client understand the component boundaries without needing the server component code.

### How Node SDK + React Web SDK would fit

```
Server Component (Node SDK)
│
│  Runs on server: fetches experiences, resolves variants,
│  gets Contentful entries — all in Node.js
│
├── Passes resolved data as props to:
│
│   ├── Server Components (no interactivity needed)
│   │   → Pure HTML, zero JS shipped
│   │   → Contentful rich text, images, static content
│   │
│   └── Client Components ("use client", React Web SDK)
│       → Interactive elements (carousels, forms, analytics)
│       → Hydrates on client with event listeners
│       → The Web SDK JS ships in the bundle
```

In practice:

```jsx
// app/page.tsx — Server Component
import { getExperience } from '@ninetailed/node-sdk';
import { HeroBanner } from './HeroBanner'; // client component

export default async function Page() {
  const experience = await getExperience({
    experienceId: 'xxx',
    profile: getProfileFromCookies(),
  });
  
  const entry = await fetchContentfulEntry(experience.variantId);
  
  // Data resolved on server, passed as serialized props
  return <HeroBanner content={entry} />;
}
```

```jsx
// app/HeroBanner.tsx — Client Component
"use client";

export function HeroBanner({ content }) {
  // This component hydrates on the client
  // content was resolved on the server — no flicker
  return (
    <div onClick={trackClick}>
      <h1>{content.fields.headline}</h1>
    </div>
  );
}
```

### What the network looks like

**First request (SSR):**
```
GET /page                    → 200 HTML (~50-200ms TTFB)
GET /_next/static/chunks/main.js    → JS bundle (cached)
GET /_next/static/chunks/page.js    → Page-specific JS (cached)
```

**The HTML response is complete.** The user sees content immediately. JS loads in background for interactivity.

### Benefits — the technical specifics

**1. TTFB to First Contentful Paint**
- CSR: browser gets empty `<div id="root">` → downloads JS → executes → fetches data → renders. Could be 2-4s on slow connections.
- SSR: browser gets full HTML → paints. TTFB is slower (server has to render) but FCP is much faster because there's no JS execution in the critical path.

**2. No layout shift from personalization**
- The server already resolved the variant. The HTML contains the correct content. There's no "swap" after hydration.
- CLS (Cumulative Layout Shift) stays at 0 for personalized content.

**3. SEO**
- Crawlers get complete HTML. Googlebot can execute JS, but other crawlers can't, and even Google prefers server-rendered content.

**4. Streaming SSR (React 18+)**
- Next.js App Router uses `renderToReadableStream()` which streams HTML chunks as they resolve
- If one component is slow (e.g., waiting on Experience API), the rest of the page streams first, and a `<Suspense>` fallback shows until it resolves
- The browser starts painting before the full response is complete

```jsx
export default async function Page() {
  return (
    <div>
      <Header />  {/* streams immediately */}
      <Suspense fallback={<Skeleton />}>
        <PersonalizedHero />  {/* streams when Experience API responds */}
      </Suspense>
      <Footer />  {/* streams immediately */}
    </div>
  );
}
```

**5. The `__NEXT_DATA__` / RSC Payload contract**
- In Pages Router: server serializes props into `__NEXT_DATA__` JSON, client React reads it during hydration so it doesn't re-fetch
- In App Router: the RSC Payload is a streaming binary format that describes the server component output, more efficient than JSON serialization
- Either way, data fetched on the server is passed to the client without a second network request

### What you need to understand to be expert-level

1. **The rendering pipeline**: request → server render → HTML stream → client JS download → hydration → interactive
2. **Hydration mismatches**: the #1 source of bugs. Server and client must produce identical DOM for the initial render
3. **Serialization boundary**: data passing from server to client components must be JSON-serializable (no functions, no classes, no circular refs)
4. **The cost of "use client"**: every client component's JS ships to the browser. Pushing the "use client" boundary as deep as possible in the tree keeps bundle size small
5. **Caching layers**: Next.js has multiple caches (Full Route Cache, Data Cache, Router Cache) that interact with SSR. Understanding when a page is dynamically rendered vs statically cached is critical
6. **`dynamic = 'force-dynamic'` vs `revalidate`**: these control whether Next.js treats a route as SSR (every request) or ISR (cached, revalidated periodically)

---

## User

i have this written about SSG
is ther esomething i can write about SSR that is a similar style?
NextJS Personalization with SSG
There was previously a module called Middleware (now proxy.js) that helps execute HTTP requests before they hit Next.js servers. Middleware functions are deployed at the cloud edge (e.g., CDNs or Edge workers).
I recommend including this in the reference implementation to show how the customer can use SSG while also serving personalized content by proxying requests to our Optimization API to fetch variants before NextJS renders the components, which could be useful.
I got the idea to research this from Sebastian, who mentioned that we had a customer (Home Depot) with a slow, static React frontend (cached) that did not work well with our personalization. That caused a flicker on the first paint, which was not ideal for them. The solution they came up with was to use an edge worker that receives the request and knows what content to serve before first paint.
Looking through the documentation, I can see that NextJS recommends avoiding its use unless there are no other options available. 
 [Image 1] 

---

## Assistant (Debug · nt-opus · 19.5s)



Here's an SSR counterpart in the same style:

---

**NextJS Personalization with SSR**

With SSR, personalization happens on the server at request time — no edge proxy or middleware needed. When a request comes in, the server executes the Node SDK to call the Experience API, resolves the winning variant, fetches the corresponding Contentful entry, and returns fully rendered HTML with the personalized content already in place. The browser paints the correct variant on first load with zero flicker and zero layout shift.

This is the most straightforward approach to personalization in Next.js because the rendering pipeline naturally supports it — there's no architectural workaround required. The server already has access to request context (cookies, headers, geo) and can pass that to the Experience API before React ever touches the component tree. The resolved content flows down as props, and the HTML the browser receives is complete and correct.

The trade-off compared to SSG is latency. Every request hits the server, which must call the Experience API and Contentful before responding. There's no cached static page to fall back on. For high-traffic pages where the variant set is small and doesn't change per-user, SSG with edge resolution may perform better. But for pages where personalization is highly dynamic (per-user profile, real-time segmentation, many variant combinations), SSR is simpler to implement and avoids the complexity of pre-building variants or maintaining an edge proxy layer.

In the App Router, this is the default behavior — components are Server Components and can call the Node SDK directly with async/await. In the Pages Router, `getServerSideProps` achieves the same thing. Either way, the client never sees a loading state or content swap for the personalized block.

I'd recommend including this in the reference implementation alongside the SSG + proxy approach so customers can compare both patterns and choose based on their traffic profile and performance requirements.

---

Want me to adjust the tone or add/remove anything?

---

## User

but with calling the experience API it would not use the SDK which is what we would want to use to have further personalization with useing the SDK methods like consent and everything not just the personalization right?
so what is a better way of doing this in a full way? with supporting SSR on nextJs

---

## Assistant (Debug · nt-opus · 14.5s)



You're right. Calling the Experience API directly only gives you variant resolution — you lose the full SDK surface (consent management, event tracking, profile merging, `identify`, `track`, `page`, etc.).

## The full approach for SSR with the SDK

You need **both** SDKs working together:

**Server side (Node SDK)** handles the initial render:
- Resolves experiences/variants at request time using profile context
- Fetches the correct Contentful entries
- Returns fully rendered HTML — no flicker

**Client side (React Web SDK)** hydrates and takes over:
- Manages the ongoing user session (profile, consent, traits)
- Tracks events (`track`, `page`)
- Handles `identify` for known users
- Manages consent state
- Listens for profile changes and can re-evaluate experiences client-side if the profile updates mid-session (e.g., user logs in, consent changes, new traits added)

The flow looks like:

```
Request → Server (Node SDK resolves variant, renders HTML)
       → Browser paints correct content immediately
       → React hydrates
       → Web SDK initializes with the same profile state
       → Web SDK handles all ongoing interactions:
           consent, track, identify, page, etc.
       → If profile changes mid-session, Web SDK
           re-evaluates and can swap variants client-side
```

The key is that the **Node SDK handles the first render** (solving flicker) and the **Web SDK handles everything after** (solving the full personalization lifecycle). The server passes the initial profile/variant state to the client so the Web SDK doesn't start from scratch — it picks up where the Node SDK left off, avoiding a hydration mismatch.

This is the pattern worth documenting in the reference implementation: not just "how to get the right variant on first paint" but "how to run the full personalization lifecycle with SSR as the foundation."

---

