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

- Every fact carries a `source:` pointer (path, or `path#symbol`, with line where useful).
- Per-SDK files conform to [`_template.md`](./_template.md) exactly — same sections, same order. If
  a section has no entries, keep the heading and write `None.`
- Per-SDK files link to [`shared/concepts.md`](./shared/concepts.md) and
  [`shared/vocabulary.md`](./shared/vocabulary.md) instead of restating shared material. Capture
  each shared fact once, in `shared/`, and reference it.
- Terse notes, not prose. Not guides. Nothing goes into the skill. Do not git-commit (review owns
  commits).

## Adding a new SDK

Copy `_template.md` into the right family dir, keep every heading, fill each section with verified
facts + source pointers, mark empty sections `None.`, and add shared vocabulary/concepts to
`shared/` rather than duplicating them. </content>
