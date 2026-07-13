---
fragment: personalization-explainer
---

## Context

This fragment defines the common introductory explanation. The guide writer copies the fixed wording
and fills only the explicit switches recorded in the SDK blueprint's `## Quick-start contract`:

- `profile point = include | omit` controls the complete profile bullet and the four/five count.
- `managed-fetch clause = include | omit` controls the final sentence of the entry-source bullet.

Runtime phrasing (`On each request`, `When a page is requested`, `As the visitor uses your app`, or
`As the app runs`) comes from the KB runtime model. Grammatical agreement may change only the visitor
reference in that sentence. No other SDK decision belongs in this fragment.

## Template

**New to personalization?** Here is the whole idea in ⟨four | five⟩ points:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- ⟨runtime timing phrase⟩, Contentful's **Experience API** looks at ⟨visitor reference⟩ and picks the
  variant for each experience. Swapping a fetched entry for its picked variant is called
  **resolving** the entry.
- ⟨When the blueprint includes the profile point:⟩ The Experience API also returns a **profile**: the
  anonymous, per-visitor identity and state used to keep personalization consistent across requests
  or app launches.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies—the **baseline
  fallback**. ⟨When the blueprint includes the managed-fetch clause: You can fetch the entry yourself
  or give the SDK your Contentful client and an entry ID; either way, the client stays yours.⟩
- You render the returned entry with the same application components you already use.

⟨When the blueprint includes the profile point: add one SDK-specific sentence from the KB stating
who persists the profile and across which lifecycle.⟩

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.
