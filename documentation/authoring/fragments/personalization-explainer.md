---
fragment: personalization-explainer
---

## Context

The intro explainer that teaches an average developer — no personalization background — the whole
idea before the quick start uses any of it. A guide instantiates this from the **Template** below.

Two kinds of bullet, and they instantiate differently:

- **Verbatim bullets** — the variant/experience bullet, the resolving sentence, and the closing "You
  render whatever the SDK hands back…" line are reproduced word-for-word, only their `⟨slots⟩` filled.
  These fixed sentences are what keep the family consistent — do not reword them.
- **Composed bullets** — the entry-source hand-off bullet is composed from a knowledge-base fact
  around a fixed anchor: the sentence must end with the **baseline-fallback** contract (the exact
  clause below), but the lead and the fetch-boundary wording are shaped to the SDK because the
  boundary itself is SDK-shaped (manual-only vs. managed vs. both) and some SDKs reorder the sentence.
  Keep the anchor exact; compose the rest from the KB entry-source-boundary fact.

Every slot resolves from a knowledge-base fact — never invent one.

Slots and where each is filled from:

- **⟨timing phrase⟩** — when the Experience API picks the variant, in this runtime's terms:
  `On each request` (stateless server), `When a page is requested` (server-rendered pages),
  `As the visitor uses your app` (browser), `As the app runs` (native). Fill from the KB runtime
  model.
- **⟨visitor reference⟩** — how the sentence refers to the visitor after the timing phrase, chosen to
  read cleanly with it: `who the visitor is` when the timing phrase has no visitor antecedent
  (`On each request`, `As the app runs`), `who they are` when it already names the visitor
  (`As the visitor uses your app` — avoids repeating "visitor"), or `the current visitor` for a
  request framing that wants an explicit noun (`When a page is requested`). This co-varies with the
  timing phrase; it is grammatical agreement, not free choice.
- **⟨profile bullet⟩** — include this bullet **only if the SDK persists a per-visitor profile**
  across requests or launches (Node, React Native). SDKs that hold no cross-request identity in the
  explainer omit the whole bullet (the web family). Fill the requests-vs-launches wording from the
  KB runtime model.
- **entry-source hand-off bullet (composed)** — compose this bullet from the KB entry-source-boundary
  fact around one fixed anchor: it must state that the SDK hands back the resolved variant, **or the
  original entry when no variant applies, the baseline fallback** (that clause is the anchor — keep
  it). The lead names how this app turns Contentful entries into output today (`Your server fetches
Contentful entries and turns them into a response`, `Your app turns Contentful entries into
markup`, `Your app already fetches Contentful entries and turns them into components`). If the SDK
  supports **managed fetching** (it can take the reader's client and fetch by ID), add the "fetch it
  yourself or give the SDK your client — either way the client stays yours" clause; omit it for
  manual-only SDKs. A screen-first SDK (React Native) may reorder the sentence so the hand-off reads
  naturally — that is allowed for this composed bullet, as long as the baseline-fallback anchor
  survives intact.
- **⟨deferred concepts⟩** — the not-yet list for this SDK, drawn from the sections this guide defers
  (audiences, interaction events, identity, preview, live updates…).

## Template

**New to personalization?** Here is the whole idea in ⟨four | five⟩ sentences:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- ⟨timing phrase⟩, Contentful's **Experience API** looks at ⟨visitor reference⟩ and picks the variant
  for each experience. Swapping a fetched entry for its picked variant is called **resolving** the
  entry.
- ⟨profile bullet — only if the SDK persists a profile:⟩ The Experience API also returns a
  **profile**: the anonymous, per-visitor identity and state the SDK uses to keep the same visitor's
  personalization consistent across ⟨requests | app launches⟩.
- ⟨entry-source hand-off bullet — composed from the KB entry-source-boundary fact; MUST end with the
  baseline-fallback anchor "…or the original entry when no variant applies, the **baseline
  fallback**." Add the managed-fetch clause only if the SDK fetches by ID; a screen-first SDK may
  reorder the sentence. Example (managed, browser): "Your app turns Contentful entries into markup,
  and the SDK sits at that hand-off: it gives you the resolved variant instead of the original — or
  the original entry when no variant applies, the **baseline fallback**. You can fetch the entry
  yourself and hand it to the SDK, or give the SDK your Contentful client and let it fetch by ID —
  either way the client stays yours."⟩
- You render whatever the SDK hands back exactly as you render entries today.

That is enough to start. You do not need ⟨deferred concepts⟩ yet; this guide introduces each idea at
the point you need it.
