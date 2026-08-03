---
name: migration-guide-authoring
description: >-
  Create or revise legacy-to-Optimization SDK Suite migration guide structure and prose using
  documentation/authoring/recipes/migration.md, migration blueprints, migration knowledge, and target
  SDK knowledge. Use when authoring or reviewing migrating-*.md guides, editing migration
  blueprints, planning migration guide routes, or replacing migration-specific agent instructions.
  Not legacy fact derivation and not SDK knowledge authoring.
argument-hint: '[migration guide or migration blueprint]'
paths: documentation/authoring/migration-blueprints/**, documentation/guides/migrating-*.md
---

# Authoring migration guides

Use this skill with `optimization-guide-authoring`. This skill owns migration-specific workflow and
routing; `optimization-guide-authoring` owns guide voice, example-label discipline, and the general
writer workflow.

## Source layers

- **Migration recipe** (`documentation/authoring/recipes/migration.md`) — the `##` spine and
  repeatable migration-guide rules.
- **Migration blueprint** (`documentation/authoring/migration-blueprints/*.md`) — one legacy-to-target
  guide's route, guide order, section plan, and fact links.
- **Migration knowledge** (`documentation/internal/migration-knowledge/`) — legacy behavior and
  migration boundaries.
- **SDK knowledge** (`documentation/internal/sdk-knowledge/`) — target Optimization SDK behavior.
- **Source/types** — exact legacy or target interface shape.
- **Guide** (`documentation/guides/migrating-*.md`) — reader-facing task flow.

Do not let facts leak into the recipe, blueprint, or skill. Fact-source links route the writer; they
are not evidence by themselves.

## Workflow

1. Open the migration recipe, the matching migration blueprint, and the linked migration knowledge.
2. Open the target SDK blueprint and SDK KB sections linked by the migration blueprint.
3. Draft or revise the guide in the migration recipe's `##` order. Preserve useful existing guide
   detail that still matches the facts and blueprint.
4. Put ownership changes before code changes: Contentful authoring, runtime configuration, consent
   records, cookies, first page events, analytics forwarding, preview behavior, and cache boundaries.
5. Keep runtime migrations split. Use plugin/privacy/preview and content-model migration guides for
   shared replacement work instead of folding every concern into one guide.
6. Source each claim by kind:
   - legacy behavior from migration knowledge;
   - target behavior from SDK knowledge;
   - interface shape from the relevant source/types.
7. Hand missing legacy behavior to `migration-knowledge-authoring`; hand missing target behavior to
   `sdk-knowledge-authoring`. Do not invent either in the guide.

## Blueprint work

When creating or revising a migration blueprint:

- copy `migration-blueprints/_template.md` for a new blueprint;
- create the smallest route/section plan that lets the guide writer draft without guessing;
- keep Fact sources as links only;
- list only real handoffs for missing legacy or target behavior facts;
- update authoring indexes only when the route changes what readers can find.

Run the migration-blueprint structural review in `documentation/authoring/README.md` before handing
the blueprint to a writer.

## Migration rules

- Put content-model migration before runtime rendering when legacy `nt_*` fields, mapper output, or
  runtime experience configuration arrays are involved.
- Use one authored all-visitors or otherwise always-matching variant for the first performable
  content check.
- For event, consent, and analytics migrations, require accepted-event evidence and blocked-event
  diagnostics when the target runtime supports them.
- For server, framework, and hybrid migrations, name first-page-event ownership, profile-cookie
  ownership, and request-bound dynamic/cache consequences before rendering replacement.
- Manual Node/Web hybrids keep cookie read/write/clear behavior app-owned; framework adapters may own
  more of that handoff.

## Before you finish

- Run `pnpm exec prettier --write <touched markdown>`.
- Run `pnpm guides:check`; it validates migration blueprint shape, links, and migration guide spine.
- Run `pnpm knowledge:check` when a guide may contain or resolve an `ESCALATE` marker.
- Report changed guide, blueprint, and fact-store handoffs separately.
