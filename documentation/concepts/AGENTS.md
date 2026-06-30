# AGENTS.md

Applies to authored concept documentation under `documentation/concepts/`.

## Purpose

- Concept docs explain how SDK mechanics work, why they behave that way, and what consequences
  integrators need to understand.
- Do not turn concepts into setup guides, API reference, or exhaustive configuration inventories.
- Write for engineers integrating SDKs into consumer applications, including junior engineers who
  need terms, prerequisites, and runtime boundaries stated explicitly.

## Required structure

- Start with the reader goal, scope, and runtime applicability.
- For cross-SDK docs, include an early runtime-support summary that names the applicable SDKs and
  calls out runtime-specific API surfaces.
- Put prerequisites and constraints before lifecycle details. This includes consent, persistence
  consent, allowed event types, storage availability, preview mode, offline behavior, and configured
  defaults.
- Present the mental model before implementation details.
- If a reader must choose between implementation paths, put the decision table near the start.
- Order mechanics in lifecycle order: initialization, state setup, runtime behavior, event emission,
  persistence or cleanup, then diagnostics.
- End with related docs, and include all SDKs or guides that the document materially discusses.

## Content boundaries

- Prefer stable contracts and consequences over copied signatures, prop tables, config tables, or
  state inventories.
- When a concept needs a code example, keep it minimal, label the runtime and language, and verify
  the exact call shape against source or package documentation.
- Do not describe one runtime's API as if it applies to all runtimes. Use runtime-specific names for
  Web, React Web, Node, React Native, iOS, and Android APIs.
- Treat defaults as defaults, not universal behavior. Use `by default`, `when configured`, and
  `when persistence consent is true` when behavior depends on configuration or stored consent.
- Avoid absolute claims such as `always`, `never`, or `only` unless source and tests confirm there
  is no configurable exception.
- When iOS and Android concepts share mechanics, check both sibling docs and both native sources.

## Writing

- Define domain terms before using them in dense mechanics.
- Use short paragraphs and tables for comparisons, not for exhaustive reference.
- Keep headings task-neutral and descriptive, in sentence case.
- Avoid `should`; use `must`, `can`, or `we recommend` according to the style guide.
- For junior readers, explain why constraints matter, not only that they exist.

## Accuracy checklist

Before updating a concept doc, verify any affected claims against source, tests, package READMEs,
guides, and nearby concepts for:

- public API call shapes
- exposed state names
- consent and persistence gates
- default-versus-configured behavior
- lifecycle ordering
- tracking metadata and event types
- storage, reset, and profile-continuity behavior
- native bridge behavior
- preview and offline semantics
