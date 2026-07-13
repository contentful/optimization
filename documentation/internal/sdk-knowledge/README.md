# SDK knowledge (internal)

Internal, non-public knowledge base. **Not guides.** Terse, verified facts + source pointers only —
no teach-first narrative, no `Copy this` / `Adapt this` labels, no reader framing.

## What this is

Behavior verified against `packages/**/src` is captured once so guide authors do not repeatedly trace
control flow. Exact interface shape—exports, signatures, props, optionality, and returns—remains
authoritative in the package types. Per-SDK files may keep a small public-symbol/import index for
navigation, but must not copy detailed type shapes as facts.

## Ownership

- **This knowledge base** — SDK behavior, defaults, ownership, fallbacks, and cross-runtime semantics.
- **Package types/source** — exact interface shape.
- **The authoring skill** (`skills/optimization-guide-authoring`) — how to write good guides;
  principles only, never SDK facts.
- **The guides** (`documentation/guides`) — teach-first prose for readers.

Concrete symbols may anchor behavioral facts. A signature, prop list, or return type is looked up in
the types instead of copied here.

**Behavior here, editorial mapping in the blueprint.** This base records _what is true_ about an SDK. It
does not decide _which_ of those facts become guide sections, in what order, or under which
integration category — that per-SDK editorial judgment lives in the SDK's **blueprint**
(`documentation/authoring/blueprints/<sdk>.md`), the writer-facing side of the pipeline. When a guide
gains or loses a documented capability, the blueprint's section list changes; when a behavior changes,
a fact here changes. See [`../../authoring/README.md`](../../authoring/README.md) for the recipe /
blueprint / fragment layers.

## Organization

```
documentation/internal/sdk-knowledge/
  README.md                     # this index
  _template.md                  # canonical per-SDK section skeleton; every SDK file copies it
  shared/
    vocabulary.md               # canonical term → one-line meaning, used verbatim across web guides
    concepts.md                 # SDK-neutral shared concepts
  web/                          # web family
    nextjs-app-router.md
    nextjs-pages-router.md
    react-web.md
    web.md
```

Future families get sibling dirs (e.g. `native/`, `node/`). Do not create empty ones ahead of need.

## Rules

- Every fact carries a `source:` pointer in the [grammar below](#source-pointer-grammar).
- Every per-SDK file declares the guide(s) its facts compose into, with a
  `<!-- feeds-guides: documentation/guides/<guide>.md -->` marker under the title (comma-separate
  multiple). This is the KB→guide direction of the dependency graph: a `source:` pointer says which
  source a fact came from; `feeds-guides` says which guide must be recomposed when the fact changes.
  `knowledge:check` requires the marker and that its targets resolve.
- Per-SDK files conform to [`_template.md`](./_template.md) exactly — same sections, same order. If
  a section has no entries, keep the heading and write `None.`
- Per-SDK files link to [`shared/concepts.md`](./shared/concepts.md) and
  [`shared/vocabulary.md`](./shared/vocabulary.md) instead of restating shared material. Capture
  each shared fact once, in `shared/`, and reference it.
- Terse notes, not prose. Not guides. Nothing goes into the skill. Do not git-commit (review owns
  commits).

## Source pointer grammar

A pointer is integrity-checked by `pnpm knowledge:check`
([`scripts/validate-sdk-knowledge.ts`](../../../scripts/validate-sdk-knowledge.ts)). It must match
this grammar exactly — free-text pointers (e.g. `source: accepted App Router guide`) are rejected,
which keeps a fact traceable to source rather than circularly grounded in another guide. A resolving
pointer proves that the provenance target still exists; it does not prove that the behavioral
statement remains semantically true. Source changes still require scoped re-verification.

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
`shared/` rather than duplicating them.
