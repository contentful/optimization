---
archetype: decision
filename: choosing-the-right-sdk.md and future decision guides
---

## Context

For a guide whose primary reader goal is **choosing** between SDKs, runtimes, patterns, or tradeoffs.
Shorter and rule-light next to an integration guide. The `guide-writer` renders the **Template**
below; it never emits this Context.

The recommendation must state a clear default ("choose the highest-level SDK that matches the
runtime") rather than listing every option neutrally. Keep runtime jargon defined. Place the TOC
after the reader-goal opening, before the first `##`.

Structure invariant: intro → TOC → `## Recommendation` → `## Decision table` → `## Alternatives` →
`## Follow-up guides`. Decision-table columns are exactly `Reader need`, `Choose`, `Why`,
`Next guide`; add `Do not choose when` only when a row needs a boundary or warning.

## Template

# ⟨Decision guide title⟩

Use this guide when ⟨the choice the reader is trying to make⟩.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Recommendation

⟨The default choice and the principle behind it, in plain language. Name the common cases and what to
pick for each. Keep runtime jargon defined.⟩

## Decision table

| Reader need | Choose | Why | Next guide |
| ----------- | ------ | --- | ---------- |
| …           | …      | …   | …          |

## Alternatives

⟨Lower-level or adjacent packages and when they apply. One bullet each.⟩

## Follow-up guides

⟨Table or list routing to the matching integration guides.⟩
