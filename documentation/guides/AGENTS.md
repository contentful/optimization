# AGENTS.md

Read the repository root `AGENTS.md`, then `documentation/AGENTS.md`, before this file.

These instructions apply to public integration guides under `documentation/guides/`.

## Directory README

- Keep `Choosing the Right SDK` under `## Start Here`.
- List implementation guides under `## Integration Guides` in platform/layer order:
  1. Node
  2. Web
  3. React Web
  4. React Native

## Integration Guide Structure

Use this structure for implementation guides:

1. H1: `# Integrating the Optimization <SDK Name> SDK in a <Runtime> App`
2. A short introduction that starts with the reader's implementation goal, usually
   `Use this guide when...`
3. A collapsible table of contents immediately after the introduction and before the first `##`
   section.
4. `## Scope and Capabilities`
5. `## The Integration Flow`
6. Numbered `##` sections for core implementation steps only.
7. Unnumbered `##` sections for optional or informative material.
8. `## Reference Implementations to Compare Against`

Do not place a table of contents after a section it outlines. Do not turn an implementation guide
into a deep mechanics reference. Link to a concept document when the reader needs lower-level
behavior details.

When extracting dense material from a package README, prefer updating the existing guide for that
runtime. Keep package setup choices, common configuration, and workflow sequencing in the guide;
keep method-by-method API details in TypeDoc. Create a new guide only when the extracted material
has a distinct implementation goal that is not covered by an existing guide.

## Table of Contents

Every guide must include this TOC wrapper:

```md
<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

...

<!-- mtoc-end -->
</details>
```

- The TOC block must appear before the first `##` heading.
- Keep TOC entries and anchors synchronized with the headings after any heading edit.
- Include both `##` and relevant `###` headings in the TOC.

## Numbering Rules

- Number only core implementation steps.
- Do not number optional or informational sections such as live updates, preview panels, caching
  notes, hybrid architecture notes, or reference sections.
- If a section is optional, say so in prose near the integration flow instead of making it part of
  the numbered flow.

## Reference Implementation Policy

- Only link to or mention reference implementations that are co-located in this monorepo.
- Do not link to or mention external demo applications.
- Mention relevant monorepo reference implementations briefly near the top of an integration guide,
  usually in `The Integration Flow`.
- Expand reference links in `Reference Implementations to Compare Against`.
- Prefer links to implementation READMEs and relevant source files over vague references.

## Validation

- For guide edits, verify that each TOC block appears before the first `##` and that TOC anchors
  resolve to headings.
