# Integration guide template and rules

Use this for files named `integrating-*.md`. Copy the skeleton, then fill each section. The rules
after the skeleton are the ones a review (human or hook) checks.

## Skeleton

```md
# Integrating the Optimization <SDK name> SDK in a <runtime> app

Use this guide to <one-sentence reader goal, phrased as the working result they will have>.

**New to personalization?** Here is the whole idea in <n> sentences:

- <plain-language definition of variant + experience>
- <plain-language definition of the Experience API + "resolving" an entry>
- <the you-fetch / SDK-resolves boundary, and baseline fallback>
- <how they render what the SDK returns>

That is enough to start. You do not need <deferred concepts> yet; this guide introduces each idea at
the point you need it.

You will get there in two milestones:

- **Milestone 1 — <first observable result> (the quick start below).** <why it is shippable alone>
- **Milestone 2 — <the opt-in layer> (later).** See [<section>](#anchor).

This guide uses `<package>`. <one sentence on the entry point and what the app still owns.>

If <other-router/runtime>, use the [<other guide>](./<file>.md) instead.

## Quick start

<One realistic paragraph naming the app shape this assumes, and pointing readers with a different
shape to the feature section. Then one sentence naming the single proof and the consent assumption.>

1. <step> — **Copy this:** / **Adapt this to your use case:** + one fenced block.
2. ... N. Verify the one result. <Concrete, performable verification — including how to make the SDK
   actually produce the result, e.g. how to match/force a variant.>

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Before you start

<Outside-the-guide prerequisites list only. See before-you-start.md.>

## Core integration

### <feature/concept>

**Integration category:** Required for first integration | Common but policy-dependent

1. <numbered procedure step>

## Optional integrations <!-- only if there are optional sections -->

### <feature/concept>

**Integration category:** Optional

## Advanced integrations <!-- only if there are advanced/production-only sections -->

### <feature/concept>

**Integration category:** Advanced or production-only

## Production checks

## Troubleshooting <!-- only if the guide covers known failure modes -->

## Reference implementations to compare against
```

## Structure rules

- H1: `# Integrating the Optimization <SDK name> SDK in a <runtime> app`. Next.js variants name the
  router: `Next.js App Router app`, `Next.js Pages Router app`.
- Fixed section order: intro → `## Quick start` → collapsible TOC → `## Before you start` →
  `## Core integration` → `## Optional integrations` (if any) → `## Advanced integrations` (if any)
  → `## Production checks` → `## Troubleshooting` (if any) →
  `## Reference implementations to compare against`.
- No numbered headings at any level. No monolithic flow section (`## The integration flow`,
  `## Required steps`, `## Core steps`). Procedures are numbered lists inside `###` sections.
- Every `###` feature section under Core/Optional/Advanced starts with a bold
  `**Integration category:**` line, exactly one of: `Required for first integration`,
  `Common but policy-dependent`, `Optional`, `Advanced or production-only`. `Required` and
  `Common but policy-dependent` go under `## Core integration`; `Optional` under
  `## Optional integrations`; `Advanced or production-only` under `## Advanced integrations`.
- `## Production checks` must cover: credentials/runtime config, consent behavior, event delivery,
  content fallback, duplicate-tracking prevention, privacy/governance, and a local validation path.

## Quick-start rules (the part reviews scrutinize most)

- One proof, one verification statement, minimum setup. Valid proofs: SDK init + one accepted page
  event; one entry resolving to variant or baseline; server content surviving takeover without a
  duplicate page event.
- **Ground it in a real app shape, not a test harness.** Do not invent fetch shapes such as a
  hardcoded array of entry IDs. Model the reader's most common real shape and show changes as diffs
  against their existing files. Point readers with other shapes to the feature section.
- **Never hand over a full file the reader would paste over their own.** For layouts, providers, and
  renderers, show a `+`/`-` diff so the additions are unambiguous, keep the reader's existing lines
  (guards, chrome, settings fetch) visible around them, and add a one-line note that the surrounding
  code is illustrative context to match against — not a block to paste verbatim. Do not "fix"
  copy-paste friction by blending the additions into a rewritten file; that trades clarity for
  pastability and loses more than it gains.
- **Keep example labels honest.** `**Copy this:**` only when values work as-is against what the
  guide points to; otherwise `**Adapt this to your use case:**`, and name what is the reader's vs
  the pattern to copy. A path or file the reader must relocate (import alias, app-root file) is an
  adapt, not a copy.
- **Define each term at first use, tersely.** One clause is enough — for example, a consent config
  key defined inline as "may store the visitor-profile cookie." Do not promise "you don't need the
  model" and then require an undefined term two steps later.
- Keep optional concerns out of the quick start unless one is the chosen proof: interaction-tracking
  config, analytics forwarding, identity, preview, live updates, offline queues, caching, strict
  event policy, production hardening. Default interaction tracking may exist implicitly via the
  entry wrapper.
- **Make verify performable.** The last step must tell the reader how to cause the result (e.g. an
  experience targeting all visitors so they match automatically, or forcing a variant via the
  preview panel) — not just "load as a qualifying visitor."

## Quick-start scope discipline (per SDK)

Before adding or removing quick-start steps, consult the SDK's own source and its existing guide for
the exact entry points — this skill names none. Apply these general rules:

- Start from the SDK's primary/bound entry point; defer lower-level or escape-hatch subpaths to
  later sections.
- The first path should cover only: init/config, the request or lifecycle wiring, one accepted event
  or one entry resolving (variant or baseline), and the entry wrap. Exclude interaction tracking,
  analytics forwarding, identity, preview, live updates, offline queues, and production cache policy
  unless one of those is the explicit chosen proof. Default interaction tracking may exist
  implicitly via the entry wrapper.
- **Call out version-specific filenames or exports that fail silently.** When a framework resolves a
  handler by filename and/or export name, and the current vs previous major differ, name both
  explicitly and state the failure mode (a wrong name silently no-ops rather than erroring). Verify
  the exact names against the framework and SDK source.
- **Flag runtime-mode side effects of the integration.** If wiring the SDK changes a route's
  rendering mode (e.g. forcing dynamic rendering and disabling static/incremental generation), say
  so in the core path, not only under caching — verify the trigger against source.
- For screen/entry-heavy native runtimes, "init + one accepted screen event" is an acceptable first
  proof when entry rendering would make the quick start disproportionately app-specific.

## Rendering / entry-wrap rules (the recurring credibility trap)

- The entry wrapper goes wherever an entry becomes a component. Many apps have one such hand-off (a
  renderer or registry mapping content type to component); others render an entry directly in a
  page. Use app-neutral wording — do not assume a specific file or symbol name (e.g.
  "SectionRenderer") that varies between apps.
- If the render prop returns a type wider than the app's schema type (e.g. a base entry type rather
  than the app's specific content-type interface), the snippet must show the cast the reader needs
  (`resolved as YourType`) and say why. Verify against the SDK source (`packages/**/src`), not just
  the reference implementation — do not claim type-identity the SDK does not provide. Recommend the
  plain direct cast as the default; it works for common narrowed types. Mention
  `as unknown as YourType` only as a rare escape for genuinely disjoint types — do not tie it to a
  specific type modifier, and do not add it speculatively without compiling first.
- State the fallback contract explicitly: on denied consent / no variant / unresolved links /
  all-locale payloads, the render prop receives the baseline entry and the UI does not break.

## Example labels

- `**Copy this:**` — pasteable with only simple value substitution; values must actually work.
- `**Adapt this to your use case:**` — realistic app-shaped code needing structural
  change/placement; name reader-owned vs pattern-to-copy; prefer a `+`/`-` diff of the reader's
  likely code.
- `**Follow this pattern:**` — illustrative shape, not drop-in runnable.
- `**Reference excerpt:**` — shortened/copied reference-implementation code.
- Comment only meaningful SDK-specific lines (lifecycle, consent, sequencing, fallback,
  duplicate-event prevention). Never narrate obvious syntax.

## Reference implementations

- Link only to monorepo reference implementation READMEs — not external demos, sample apps, or
  implementation source files.
- Frame reference implementations as maintained comparison and validation targets for SDK behavior.
  Do not present them as optional examples or lower-stakes sample code.
- Mention relevant implementations briefly near the top only when they clarify the quick start or
  first required setup path; otherwise expand the links in
  `## Reference implementations to compare against`.

## TOC rules

- Preserve `<!-- mtoc-start -->` / `<!-- mtoc-end -->`.
- Place the collapsible TOC after the quick-start content, before the next `##`. Omit
  `## Quick start` from the TOC (the reader already passed it).
- Include all `##` headings and the `###` feature/concept headings under Core/Optional/Advanced.
  Include other `###` only when they are major alternate flows readers navigate to.
- Every TOC anchor must resolve to a real heading. Re-check after any heading edit.
