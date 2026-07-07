# Decision guide and supplemental recipe templates

Two archetypes share this file because both are short and rule-light next to integration guides.

## Decision guide

Use for `choosing-the-right-sdk.md` and any future guide whose primary reader goal is choosing
between SDKs, runtimes, patterns, or tradeoffs.

### Skeleton

```md
# <Decision guide title>

Use this guide when <the choice the reader is trying to make>.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Recommendation

<The default choice and the principle behind it, in plain language. Name the common cases and what
to pick for each. Keep runtime jargon defined.>

## Decision table

| Reader need | Choose | Why | Next guide |
| ----------- | ------ | --- | ---------- |
| ...         | ...    | ... | ...        |

## Alternatives

<Lower-level or adjacent packages and when they apply. One bullet each.>

## Follow-up guides

<Table or list routing to the matching integration guides.>
```

### Rules

- Place the TOC after the reader-goal opening, before the first `##`.
- Decision-table columns are exactly `Reader need`, `Choose`, `Why`, `Next guide`. Add
  `Do not choose when` only when a row needs a boundary or warning.
- The recommendation must state a clear default ("choose the highest-level SDK that matches the
  runtime") rather than listing every option neutrally.

## Supplemental recipe guide

Use for guides that supplement an SDK integration without replacing it (for example, analytics
forwarding), and future guides of that kind.

### Skeleton

```md
# <Supplemental recipe guide title>

Use this guide when <the supplemental task>.

## Do you need this?

<Short qualifier: who needs this recipe and who can skip it.>

## Quick start

<One minimum viable recipe the reader can apply first, with an example-intent label.>

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Default recipe

<The reusable pattern behind the quick start, explained.>

## Runtime or vendor variants

<Variants grouped by runtime, vendor, or destination. Each variant states when it applies.>

## Validate the integration

## Governance notes

## Related guides and concepts
```

### Rules

- `## Quick start` is one minimal viable recipe, not the full pattern.
- `## Default recipe` explains the reusable pattern behind the quick start.
- `## Runtime or vendor variants` groups by runtime/vendor/destination; each variant says when it
  applies.
- The TOC omits both `## Quick start` and `## Do you need this?` (the reader has passed them).
