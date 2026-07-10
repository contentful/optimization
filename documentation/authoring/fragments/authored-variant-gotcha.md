---
fragment: authored-variant-gotcha
---

## Context

The bullet in `## Before you start` that stops a reader mistaking working personalization for a bug:
without an authored variant, the integration runs but everyone sees the baseline, and the reader
concludes it is broken. A guide instantiates this by copying the **Template** verbatim and filling
the two `⟨slots⟩`. Both resolve from the same knowledge-base fact — the SDK's runtime model:

- **⟨request | visitor⟩** and **⟨every request matches it | you match it⟩** — use the **request**
  framing for stateless server SDKs where work is per request (Node); use the **visitor** framing for
  client and per-visitor SDKs (web, React, native). Do not invent the framing; read the runtime model
  from the KB.

This bullet is mandatory in every integration guide. It ties directly to the quick start's verify
step — the reader needs an all-visitors experience to see anything happen.

## Template

- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant the integration still runs, but every ⟨request | visitor⟩ ⟨resolves to | sees⟩
  the baseline, so you cannot tell personalization from a bug. For your first test, an experience
  that targets all visitors is the easiest to verify because ⟨every request matches it | you match
  it⟩ automatically.
