# SDK knowledge (internal)

Internal, non-public knowledge base. **Not guides.** Terse, verified facts + source pointers only —
no teach-first narrative, no `Copy this` / `Adapt this` labels, no reader framing.

## What this is

APIs verified against `packages/**/src` captured once, so guide authors and future regeneration
reuse them instead of re-grepping, and so guides in the same family share vocabulary and do not
drift. Facts here are a byproduct of guide work: only record what a guide author already verified
against source while drafting. No net-new verification passes just to fill these in.

## The three-artifact split

- **This knowledge base** — SDK-specific verified facts (symbols, props, cookies, return shapes).
- **The authoring skill** (`skills/optimization-guide-authoring`) — how to write good guides;
  principles only, never SDK facts.
- **The guides** (`documentation/guides`) — teach-first prose for readers.

If a fact names a concrete symbol/API/cookie/prop, it belongs here (or in a guide), never in the
skill.

## Organization

```
documentation/internal/sdk-knowledge/
  README.md                     # this index
  _template.md                  # canonical per-SDK section skeleton; every SDK file copies it
  shared/
    vocabulary.md               # canonical term → one-line meaning, used verbatim across web guides
    concepts.md                 # SDK-neutral shared concepts
    consistency-notes.md        # where guides must share language; drift logged for review
  web/                          # web family
    nextjs-app-router.md
    nextjs-pages-router.md
    react-web.md
    web.md
```

Future families get sibling dirs (e.g. `native/`, `node/`). Do not create empty ones ahead of need.

## Rules

- Every fact carries a `source:` pointer in the [grammar below](#source-pointer-grammar).
- Per-SDK files conform to [`_template.md`](./_template.md) exactly — same sections, same order. If
  a section has no entries, keep the heading and write `None.`
- Per-SDK files link to [`shared/concepts.md`](./shared/concepts.md) and
  [`shared/vocabulary.md`](./shared/vocabulary.md) instead of restating shared material. Capture
  each shared fact once, in `shared/`, and reference it.
- Terse notes, not prose. Not guides. Nothing goes into the skill. Do not git-commit (review owns
  commits).

## Source pointer grammar

A pointer is machine-checked by `pnpm knowledge:check`
([`scripts/validate-sdk-knowledge.ts`](../../../scripts/validate-sdk-knowledge.ts)). It must match
this grammar exactly — free-text pointers (e.g. `source: accepted App Router guide`) are rejected,
which is what keeps a fact grounded in source rather than in another doc.

Where a pointer lives:

- **Prose fact** — end the fact with its own line: `source: <pointers>`. Keep it on one line; never
  wrap a pointer across lines.
- **Table row** — a section whose `_template.md` shape has a `source` column puts `<pointers>` in
  that column. No bare `source:` prefix inside a table cell.

`<pointers>` is one or more pointer tokens separated by `; ` (semicolon-space). Token forms:

| Form                       | Resolves to                                                | Checked                                     |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `<sdk>#<relpath>`          | a file under that package's `src/`                         | file exists                                 |
| `<sdk>#<relpath>#<symbol>` | a declared/exported identifier in that file                | file exists **and** symbol is declared      |
| `impl:<name>#<relpath>`    | a file under `implementations/<name>/`                     | file exists                                 |
| `concept:<slug>`           | `documentation/concepts/<slug>.md`                         | file exists                                 |
| `kb:<relpath>`             | another file in this knowledge base (relative to its root) | file exists                                 |
| `extern:<free text>`       | an out-of-repo fact (e.g. `extern:Next.js convention`)     | not checked — use sparingly, state the fact |

Definitions:

- `<sdk>` is a workspace package **directory basename** — the validator discovers these from
  `packages/**/package.json`, so every SDK family is covered automatically. Current keys include
  `core-sdk`, `web-sdk`, `nextjs-sdk`, `react-web-sdk`, `node-sdk`, `react-native-sdk`,
  `api-schemas`, `api-client`, `preview-panel`.
- `<relpath>` is relative to that package's `src/` (e.g. `CoreBase.ts`,
  `resolvers/OptimizedEntryResolver.ts`).
- `<symbol>` is a single top-level identifier declared in the file (`export`ed or not): a `const`,
  `function`, `class`, `interface`, `type`, `enum`, or a named member of an exported
  interface/type. One symbol per token; for two symbols, write two `; `-separated tokens.
- **No line numbers.** The symbol is the anchor — line ranges drift on every edit, symbols do not.
  A fact about a behavior spanning many lines points at the enclosing symbol.

Examples:

- `source: core-sdk#CoreBase.ts#ContentfulConfig`
- `source: core-sdk#constants.ts#ANONYMOUS_ID_COOKIE; nextjs-sdk#cookies.ts`
- `source: react-web-sdk#optimized-entry/optimizedEntryUtils.ts; concept:entry-personalization-and-variant-resolution`
- `source: impl:nextjs-sdk_pages-router#pages/_app.tsx`
- `source: extern:Next.js exposes only NEXT_PUBLIC_-prefixed vars to the browser`

## Adding a new SDK

Copy `_template.md` into the right family dir, keep every heading, fill each section with verified
facts + source pointers, mark empty sections `None.`, and add shared vocabulary/concepts to
`shared/` rather than duplicating them. </content>
