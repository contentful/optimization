---
name: migration-knowledge-authoring
description: >-
  Derive migration-relevant legacy facts from a legacy source repository into
  documentation/internal/migration-knowledge/. Use before authoring legacy-to-Optimization SDK Suite
  migration guides, when a migration guide or technical review exposes a missing legacy behavior
  fact, when updating migration knowledge, or when working with experience.js migration facts. Not
  guide prose and not Optimization SDK fact authoring.
argument-hint: '[legacy source or migration knowledge file]'
paths: documentation/internal/migration-knowledge/**
---

# Authoring migration knowledge

Use this skill to record legacy behavior and migration boundaries once, so migration guide writers
and reviewers do not keep re-tracing a legacy repository.

Follow `sdk-knowledge-maintenance` for fact-store discipline and `sdk-knowledge-authoring` for the
interface-vs-behavior split, adapted to a legacy source repository instead of this repo's
`packages/**/src`.

## Source checkout

Use the legacy checkout named by the task or by the migration knowledge file. For experience.js, the
default source checkout is `../experience.js`, relative to this repository root.

Before deriving facts:

1. Confirm the checkout exists.
2. Inspect its git status and current commit.
3. If it is missing, dirty in relevant files, or appears stale, report that state and ask before
   updating or relying on it.
4. Do not modify the legacy checkout.

## What to record

Record only migration-relevant legacy facts in `documentation/internal/migration-knowledge/`.
Keep facts terse and present-tense. Capture behavior and migration boundaries, not guide prose:

- package mapping;
- providers, hooks, components, and render surfaces;
- Contentful mappers and content-model expectations;
- Experience API event behavior;
- plugins, privacy, analytics, and preview behavior;
- persistence, cookie, storage, and global identifiers;
- SSR, framework, and edge-runtime paths;
- unsupported or manual migration gaps.

Do not copy detailed signatures, prop lists, or return shapes unless a compact navigation index is
needed. Legacy interface shape can be checked directly in the legacy repo when a writer or verifier
needs it.

Each fact needs provenance that can be re-checked later: legacy repo commit, source path, and symbol
when available. External documentation may be secondary context; prefer source when they disagree.

## Workflow

1. Read the requested migration knowledge file and any migration blueprints that will consume it.
2. Scope the legacy fact gap. Do not re-read the whole legacy surface unless the task is a bootstrap.
3. Derive the missing legacy behavior from the legacy checkout.
4. Add or update only the relevant migration knowledge facts, preserving that file's pointer style.
5. If the gap is target Optimization SDK behavior, route it to `sdk-knowledge-authoring` instead.
6. Run `pnpm guides:check` when touched migration knowledge feeds linked migration blueprints or
   guides; run Prettier on touched Markdown.

## Before you finish

- Report which migration facts changed, which legacy commit was used, and which migration blueprint
  or guide can consume the facts.
- No guide prose leaked into migration knowledge.
- No Optimization SDK behavior fact was added here.
- The legacy checkout was not modified.
