---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-<source>-to-<target>.md
---

# <Migration guide> blueprint

## Reader goal

- **Use when:** <legacy integration state>
- **Target result:** <Optimization SDK Suite result>
- **Guide file:** `documentation/guides/<future-guide>.md`
- **Write after:** <earlier migration guide files, or None>
- **First verification:** <baseline, all-visitors, or always-matching variant/result the reader can
  verify before migrating every rule>

## Migration route

| Legacy surface | Target route | Detail owner |
| -------------- | ------------ | ------------ |
| ...            | ...          | ...          |

## Section plan

Each row becomes one migration section. Link to facts; do not restate behavior.

| Section | Purpose | Must route to | Fact sources |
| ------- | ------- | ------------- | ------------ |
| ...     | ...     | ...           | ...          |

Every applicable section plan must make these ownership and sequence checks explicit:

- Content-model migration comes before runtime rendering when legacy `nt_*` fields, mapper output,
  or runtime experience configuration arrays are involved.
- Runtime configuration, consent records, first page events, analytics forwarding, preview behavior,
  and profile/cookie continuity each have one owner.
- Event migrations include accepted-event evidence and blocked-event diagnostics when the target
  runtime supports them.
- Server and framework migrations name per-request dynamic or cache consequences before rendering
  replacement.
- Manual Node/Web hybrid migrations keep cookie read/write/clear behavior app-owned and route
  framework-cookie behavior to the framework guide or SDK KB.

## Handoffs

List missing legacy or target behavior facts. Write `None.` when there are no known gaps.

## Link roles

Use exact links for existing target guides, supplemental guides, concepts, and maintained reference
implementations. Planned sibling migration guides may be named as code until they exist.
