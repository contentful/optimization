---
archetype: integration
filename: integrating-*.md
---

## Context

Write for **an average developer with little or no personalization background**, opening the guide
cold and wanting a working result fast. This recipe is **SDK-neutral**: it is the shape every
integration guide shares — the fixed section spine, the heading order, the integration-category value
set, which fragments to instantiate, and the craft rules for each section. The `guide-writer` agent
renders the **Template** below into a guide; it never emits this Context.

Three artifacts own three different things — keep them separate:

- **This recipe owns the archetype shape and craft** (SDK-neutral) — the fixed section spine and
  heading order, the four integration-category values, which fragments compose where, and the
  transferable rules for writing a quick start, showing diffs, labeling examples, and keeping verify
  performable. Rules here hold for _every_ integration guide.
- **The SDK's blueprint owns the per-SDK editorial map** —
  `documentation/authoring/blueprints/<sdk>.md` decides, for one SDK, which KB topics become which
  sections, in what **order**, under which **category**, what proves its quick start, and where its
  milestone boundary falls, with the reasoning. This recipe does not decide the specific section
  inventory or per-section category for a given SDK — the blueprint does. (That mapping was
  previously unwritten and re-invented on every compose; the blueprint memoizes it.)
- **The knowledge base owns the facts** — which behaviors exist, what a call does on the edges,
  identifier ownership. You do not restate SDK facts here. Facts flow from the KB into the guide at
  compose time; the source-verifier flags any fact feeding this guide that the guide left out.

Fragments are reusable reader-facing prose with a fixed spine and knowledge-base-filled slots. When
this recipe says to include one, the guide-writer copies that fragment's Template **verbatim** and
fills only its `⟨slots⟩`. That verbatim spine is what keeps the guide family consistent, so do not
reword an instantiated fragment. If a fragment needs a local adjustment for this archetype, say so on
the line that references it.

Voice: plain and direct, warm but not chatty. No hype or filler that reads oddly in a reference doc
("this is the payoff", "the magic happens here", "boom", gratuitous "just"). Describe the current SDK
in present tense — never narrate change ("no longer", "now supports", "used to", PR/issue numbers).
While the SDK is pre-release, document the single current version; do not compare SDK versions.

Structure invariants (deterministic — a future `guides:check` will enforce these):

- Fixed section order: `# H1` → intro → `## Quick start` → collapsible TOC → `## Before you start` →
  `## Core integration` → `## Optional integrations` (if any) → `## Advanced integrations` (if any) →
  `## Production checks` → `## Troubleshooting` (if any) → `## Reference implementations to compare
against`.
- H1 form: `# Integrating the Optimization <SDK name> SDK in a <runtime> app`. Next.js variants name
  the router (`Next.js App Router app`, `Next.js Pages Router app`).
- No numbered headings at any level. No monolithic flow section (`## The integration flow`,
  `## Required steps`, `## Core steps`). Procedures are numbered lists inside `###` sections.
- Every `###` feature section opens with a bold `**Integration category:**` line, exactly one of:
  `Required for first integration`, `Common but policy-dependent`, `Optional`,
  `Advanced or production-only`. `Required` and `Common but policy-dependent` go under
  `## Core integration`; `Optional` under `## Optional integrations`; `Advanced or production-only`
  under `## Advanced integrations`.
- Every fenced code block gets exactly one bold intent label immediately before it, from the set in
  the Example labels section below.
- Preserve `<!-- mtoc-start -->` / `<!-- mtoc-end -->`. The TOC omits `## Quick start`, includes all
  `##` headings and the `###` feature headings under Core/Optional/Advanced, and every anchor
  resolves to a real heading.

## Template

# Integrating the Optimization ⟨SDK name⟩ SDK in a ⟨runtime⟩ app

Use this guide to ⟨one-sentence reader goal, phrased as the working result they will have⟩.

Include [personalization-explainer](../fragments/personalization-explainer.md).

You will get there in two milestones:

- **Milestone 1 — ⟨first observable result⟩ (the quick start below).** ⟨why it is shippable alone⟩
- **Milestone 2 — ⟨the opt-in layer⟩ (later).** See [⟨section⟩](#anchor).

This guide uses `⟨package⟩`. ⟨one sentence on the entry point and what the app still owns.⟩ If
⟨other router/runtime⟩, use the [⟨other guide⟩](./⟨file⟩.md) instead.

## Quick start

⟨One realistic paragraph naming the app shape this assumes, and pointing readers with a different
shape to the feature section. Then one sentence naming the single proof and the consent assumption.⟩

1. ⟨step⟩ — **Copy this:** / **Adapt this to your use case:** + one fenced block.
2. … N. Verify the one result. ⟨Concrete, performable verification — including how to make the SDK
   actually produce the result, e.g. an all-visitors experience the reader matches automatically, or
   forcing a variant via the preview panel.⟩

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- ⟨runtime prerequisite — the framework/app, peer dependencies, that the reader's own Contentful
  fetching already works⟩.
- ⟨credentials — delivery/API tokens, space, environment⟩.
- Include [authored-variant-gotcha](../fragments/authored-variant-gotcha.md).
- ⟨Optimization project values — which default, which the reader must set⟩.

You do not need a setup inventory up front. Everything else is introduced by the section that needs
it.

> [!NOTE]
>
> ⟨one-line env-var-convention note: match the prefix/convention the app already uses for
> browser-visible variables⟩

<!-- The specific feature sections under Core / Optional / Advanced — which they are, in what order,
and each one's category — come from this SDK's blueprint, not from this recipe. The recipe fixes the
`##` spine and the category value set; the blueprint fills the `###` inventory. -->

## Core integration

### ⟨feature — from the blueprint's Core section list⟩

**Integration category:** Required for first integration | Common but policy-dependent

1. ⟨numbered procedure step⟩

## Optional integrations

<!-- only if the blueprint lists Optional sections -->

### ⟨feature — from the blueprint's Optional section list⟩

**Integration category:** Optional

## Advanced integrations

<!-- only if the blueprint lists Advanced/production-only sections -->

### ⟨feature — from the blueprint's Advanced section list⟩

**Integration category:** Advanced or production-only

## Production checks

⟨Cover: credentials/runtime config; consent behavior; event delivery; content fallback;
duplicate-tracking prevention; privacy/governance; and a local validation path.⟩

## Troubleshooting

<!-- only if the guide covers known failure modes; rows map to real symptoms a reader hits -->

## Reference implementations to compare against

⟨Link only monorepo reference-implementation READMEs — not source files, sample apps, or external
demos. Frame them as maintained comparison and validation targets for SDK behavior.⟩

---

## Section notes

Expanded guidance for the Template above. These are the rules a review (human or the future
`guides:check`) leans on most.

### Intro

The intro's teaching content is the `personalization-explainer` fragment — do not hand-write a
competing explainer. After it, frame the two milestones (take the specific M1/M2 boundary and its
wording from the SDK's blueprint) and name the package and what the app still owns. Do not front-load
concept links or reference-implementation links before the quick start unless the reader must
understand them before acting.

### Quick start (the part reviews scrutinize most)

- One proof, one verification statement, minimum setup. **Which proof this SDK uses is the blueprint's
  call** ("What proves it works"); this recipe only holds the archetype rule that there is exactly
  one. Valid proof shapes: SDK init + one accepted page event; one entry resolving to variant or
  baseline; server content surviving takeover without a duplicate page event.
- **Ground it in a real app shape, not a test harness.** Do not invent fetch shapes such as a
  hardcoded array of entry IDs. Model the reader's most common real shape and show changes as diffs
  against their existing files. Point readers with other shapes to the feature section.
- **Never hand over a full file the reader would paste over their own.** For layouts, providers,
  renderers, and the runtime root (`App.tsx`), show a `+`/`-` diff so the additions are unambiguous,
  keep the reader's existing lines visible around them, and add a one-line note that the surrounding
  code is illustrative context to match against — not a block to paste verbatim.
- Keep optional concerns out of the quick start unless one is the chosen proof: interaction-tracking
  config, analytics forwarding, identity, preview, live updates, offline queues, caching, strict
  event policy, production hardening. Default interaction tracking may exist implicitly via the entry
  wrapper.
- **Make verify performable.** The last step tells the reader how to cause the result, not just
  "load as a qualifying visitor."
- **Call out version-specific filenames or exports that fail silently.** When a framework resolves a
  handler by filename/export and the current vs previous major differ, name both and state the
  failure mode (a wrong name silently no-ops). Verify names against the framework and SDK source.
- **Flag runtime-mode side effects.** If wiring the SDK changes a route's rendering mode (e.g.
  forcing dynamic rendering, disabling static/ISR), say so in the core path, not only under caching.
- For screen/entry-heavy native runtimes, "init + one accepted screen event" is an acceptable first
  proof when entry rendering would make the quick start disproportionately app-specific.
- **Native build step inline.** For iOS/Android/React Native, the native install step (`pod install`,
  `npx expo prebuild`, or equivalent) that must run before launch appears in the quick start where
  the reader installs, not deferred to `## Before you start`.

### Before you start

A prerequisites list, not a setup-inventory table. Include only what the reader gathers from outside
the guide (runtime prerequisites, credentials, authored Contentful data, Optimization project
values). If a sequenced section teaches it, it does not go here. Anti-patterns: a multi-column setup
table; rows that restate quick-start steps; rows that only say "there is a section below";
`Category` / `Required for quick start` columns; listing values the quick start never uses. The
authored-variant bullet is the `authored-variant-gotcha` fragment — mandatory.

### Rendering / entry-wrap (the recurring credibility trap)

- The entry wrapper goes wherever an entry becomes a component. Use app-neutral wording — do not
  assume a specific file or symbol name (e.g. "SectionRenderer") that varies between apps.
- If the render prop returns a type wider than the app's schema type, the snippet must show the cast
  the reader needs (`resolved as YourType`) and say why. Verify against the SDK source
  (`packages/**/src`), not just the reference implementation. Recommend the plain direct cast as the
  default; mention `as unknown as YourType` only as a rare escape for genuinely disjoint types.
- State the fallback contract explicitly: on denied consent / no variant / unresolved links /
  all-locale payloads, the render prop receives the baseline entry and the UI does not break.
- Define `render prop` in prose at first use — React-pattern vocabulary is not assumed for the target
  reader — tied back to the `{(entry) => ...}` form the reader already copied.

### Example labels

- `**Copy this:**` — pasteable with only simple value substitution; the values must actually work
  against what the guide points to. A path/file the reader must relocate is an adapt, not a copy.
- `**Adapt this to your use case:**` — realistic app-shaped code needing structural change or
  placement; name what is the reader's vs the pattern to copy; prefer a `+`/`-` diff of the reader's
  likely code.
- `**Follow this pattern:**` — illustrative shape, not drop-in runnable.
- `**Reference excerpt:**` — shortened/copied reference-implementation code.
- Comment only meaningful SDK-specific lines (lifecycle placement, consent, event sequencing,
  fallback, duplicate-event prevention). Never narrate obvious syntax.

### Production checks

Must cover: credentials/runtime config, consent behavior, event delivery, content fallback,
duplicate-tracking prevention, privacy/governance, and a local validation path.

### Shared-concern coverage

Each shared concern is either covered by the guide or explicitly marked not-applicable for this SDK:
install/init/config; consent & privacy handoff; the fetch/SDK boundary; entry resolution + fallback;
page/route/screen events; interaction tracking; identity/profile/reset; routing/lifecycle/request
context; real-time updates/preview/analytics/caching; verification. This is the archetype-wide
checklist of what must be addressed; the SDK's blueprint records _how_ this SDK maps those concerns to
sections and categories. Coverage is judged against the knowledge-base facts that feed this guide —
the source-verifier flags a fed fact the guide omits.
