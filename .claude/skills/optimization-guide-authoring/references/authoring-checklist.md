# Guide self-review checklist

Run before finishing any guide edit. Assertions are written to be mechanically checkable so they can
also back a future validation hook on `documentation/guides/**`. Group A applies to all guides; B–D
add per-archetype checks.

## A. All guides

- [ ] The intro opens by naming the working result, not stacked jargon. The first sentence a reader
      hits does not use an undefined term.
- [ ] Every term the quick start relies on is defined in plain language at or before first use (for
      SDK guides that includes: variant, experience, Experience API, resolving, baseline fallback,
      and any of consent/persistenceConsent/profile/page-event the quick start touches).
- [ ] No section promises "you don't need X" and then requires an undefined X before it is
      explained.
- [ ] Every fenced code block has exactly one bold intent label immediately before it
      (`**Copy this:**`, `**Adapt this to your use case:**`, `**Follow this pattern:**`, or
      `**Reference excerpt:**`). No former/other labels.
- [ ] Every `**Copy this:**` snippet works with only value substitution; its env-var names,
      endpoints, and paths match reality, or a NOTE explains the discrepancy.
- [ ] No placeholder-only snippet is labeled `**Copy this:**` when it actually needs relocation or
      structural change (that is an adapt).
- [ ] Code comments explain only meaningful SDK-specific lines; no obvious-syntax narration.
- [ ] `pnpm format:fix <file>` leaves the file unchanged (run it; Prettier owns formatting).
- [ ] The collapsible TOC preserves the mtoc markers, omits `## Quick start`, and every anchor
      resolves to a real heading.
- [ ] Concept links and reference-implementation links are not front-loaded before the quick start
      unless the reader must understand them before acting.

## B. Integration guides (`integrating-*.md`)

- [ ] Section order and headings match integration-guide-template.md; no numbered headings; no
      monolithic flow section.
- [ ] Every `###` feature section has a correct `**Integration category:**` line, and its category
      matches its parent `##` (Required/Common under Core; Optional under Optional; Advanced under
      Advanced).
- [ ] The quick start proves exactly one result and verifies only that result.
- [ ] **The quick start is grounded in a real app shape** — no invented fetch shapes (e.g. a
      hardcoded array of entry IDs). The most common real shape leads; other shapes are pointed to a
      feature section.
- [ ] **Files the reader already owns (layout, providers, renderer) are shown as diffs that preserve
      existing content**, not full files to paste over. The prose says so.
- [ ] The entry-wrap example shows any cast the render prop requires and states the fallback
      contract; the cast matches the matching reference implementation (verify against
      `implementations/`).
- [ ] The verify step is performable — it tells the reader how to cause the result
      (audience-targets- all, or forcing a variant), not just to "load as a qualifying visitor."
- [ ] `## Before you start` is a prerequisites list, not a setup-inventory table, and includes the
      authored-variant gotcha (see before-you-start.md).
- [ ] The shared concern checklist is covered or each unsupported concern is explicitly marked
      not-applicable: install/init/config; consent & privacy handoff; the fetch/SDK boundary; entry
      resolution + fallback; page/route/screen events; interaction tracking; identity/profile/reset;
      routing/lifecycle/request context; live updates/preview/analytics/caching where supported;
      verification.
- [ ] `## Production checks` covers config, consent, event delivery, content fallback, duplicate
      tracking, privacy/governance, and a local validation path.
- [ ] `## Troubleshooting` is present only if the guide covers known failure modes, and its rows map
      to real symptoms a reader hits (including the render-prop cast type error, if applicable).
- [ ] Reference-implementation links point to monorepo READMEs, not source files or external demos.

## C. Decision guides (`choosing-the-right-sdk.md` and future)

- [ ] Structure: intro → TOC → `## Recommendation` → `## Decision table` → `## Alternatives` →
      `## Follow-up guides`.
- [ ] The decision table uses columns `Reader need`, `Choose`, `Why`, `Next guide` (add
      `Do not choose when` only where a row needs a boundary).

## D. Supplemental recipe guides

- [ ] Structure: intro → `## Do you need this?` → `## Quick start` → TOC → `## Default recipe` →
      `## Runtime or vendor variants` → `## Validate the integration` → `## Governance notes` →
      `## Related guides and concepts`.
- [ ] `## Quick start` is one minimal viable recipe; `## Default recipe` explains the reusable
      pattern; variants are grouped by runtime/vendor/destination and each states when it applies.
- [ ] TOC omits both `## Quick start` and `## Do you need this?`.

## E. Directory README (`documentation/guides/README.md`)

- [ ] It is a lightweight router: fields limited to `Guide`, `Runtime or app type`, `Package`.
- [ ] No fastest-path column, setup summary, tradeoff matrix, or procedure preview.
- [ ] Listing order: Node, Web, React Web, Next.js App Router, Next.js Pages Router, React Native,
      iOS SwiftUI, iOS UIKit, Android Compose, Android Views.
