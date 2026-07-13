---
archetype: supplemental-recipe
filename: supplemental recipe guides (e.g. analytics forwarding)
---

## Context

For a guide that **supplements** an SDK integration without replacing it (for example, forwarding
Optimization context to analytics tools). The `guide-writer` renders the **Template** below; it never
emits this Context.

- `## Quick start` is one minimal viable recipe the reader can apply first — not the full pattern.
- `## Default recipe` explains the reusable pattern behind the quick start.
- `## Runtime or vendor variants` groups by runtime/vendor/destination; each variant states when it
  applies.

Structure invariant: intro → `## Do you need this?` → `## Quick start` → TOC → `## Default recipe` →
`## Runtime or vendor variants` → `## Validate the integration` → `## Governance notes` →
`## Related guides and concepts`. The TOC omits both `## Quick start` and `## Do you need this?` (the
reader has passed them). Every fenced block carries one example-intent label from the integration
recipe's label set.

## Template

# ⟨Supplemental recipe guide title⟩

Use this guide when ⟨the supplemental task⟩.

## Do you need this?

⟨Short qualifier: who needs this recipe and who can skip it.⟩

## Quick start

⟨One minimum viable recipe the reader can apply first, with an example-intent label.⟩

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Default recipe

⟨The reusable pattern behind the quick start, explained.⟩

## Runtime or vendor variants

⟨Variants grouped by runtime, vendor, or destination. Each variant states when it applies.⟩

## Validate the integration

## Governance notes

## Related guides and concepts
