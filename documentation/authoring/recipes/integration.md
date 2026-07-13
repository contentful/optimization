---
archetype: integration
filename: integrating-*.md
---

## Context

Write for **an average developer with little or no personalization background**, opening the guide
cold and wanting a working result fast. This recipe is **SDK-neutral**: it is the shape every
integration guide shares — the fixed section spine, heading order, category values, fragment
placement, and archetype-wide completeness rules. The `guide-writer` renders the **Template** below;
it never emits this Context.

Three artifacts own three different things — keep them separate:

- **This recipe owns the archetype shape and craft** (SDK-neutral) — the fixed section spine and
  heading order, the four integration-category values, which fragments compose where, and the
  transferable rules for writing a quick start, showing diffs, labeling examples, and keeping verify
  performable. Rules here hold for _every_ integration guide.
- **The SDK's blueprint owns the per-SDK editorial contract** —
  `documentation/authoring/blueprints/<sdk>.md` decides the quick-start proof, milestones, exact
  section inventory/order/category, and the evidence each section must show. Its Purpose cells keep
  the editorial reasoning; its Fact sources link behavior back to the KB.
- **The knowledge base owns the facts** — which behaviors exist, what a call does on the edges,
  identifier ownership. You do not restate SDK facts here. Facts flow from the KB into the guide at
  compose time; the blueprint makes the required coverage explicit, and the source verifier checks
  the claims the guide makes.

Fragments are small pieces of reader-facing wording shared verbatim. Any variation switch is explicit
in the blueprint; fragments must not infer an SDK family or restate behavior.

Voice: plain and direct, warm but not chatty. No hype or filler that reads oddly in a reference doc
("this is the payoff", "the magic happens here", "boom", gratuitous "just"). Describe the current SDK
in present tense — never narrate change ("no longer", "now supports", "used to", PR/issue numbers).
While the SDK is pre-release, document the single current version; do not compare SDK versions.

Structure invariants (`pnpm guides:check` enforces the blueprint-to-guide section and category map):

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
- A blueprint evidence item is an **evidence atom**, not a keyword-presence check. Unless the
  blueprint explicitly marks an item as a compact inventory, the section must connect all five
  parts: state the mechanism, identify its owner, state the failure consequence or tradeoff, show
  the smallest realistic example, and give a performable verification. These parts may share prose,
  a table, or code; they do not require five repeated paragraphs.
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

The intro's teaching content is the `personalization-explainer` fragment. Apply only the two switches
recorded in the blueprint, then add the runtime-specific persistence/ownership sentence from the KB.
After it, frame the two milestones from the blueprint and name the package and what the app still
owns. Do not front-load concept or reference links before the quick start unless the reader must
understand them before acting.

### Quick start (the part reviews scrutinize most)

- One proof, one verification statement, minimum setup. **Which proof this SDK uses is the blueprint's
  call** (`## Quick-start contract`); this recipe only holds the archetype rule that there is exactly
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
- A verification may use only an observation mechanism already available to the reader: a named
  browser tool, visible UI state, server log, or diagnostic snippet defined before the assertion.
  If a section says to inspect an event, blocked call, profile, or SDK state, it must show the
  development-only observer (including cleanup) or point back to one already shown. Do not use a
  gated production integration, such as analytics forwarding, as the only diagnostic for the gate
  itself.
- The guide must also mount any diagnostic it defines. A browser observer proves browser events and
  blocked attempts only; it cannot retroactively prove a completed server event unless the KB
  explicitly records that bridge. Use a server-observable outcome (for example, selected raw HTML)
  for the server path and the browser observer to prove that takeover did not emit a duplicate.
- A state-change proof must define its authored prerequisite and expected before/after result. For
  identity-based personalization, name the audience trait/value the reader should substitute and
  show both the state that should change and any locked/control state the verification compares.
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
- Include every item in the blueprint's **Required artifacts**. A quick start is incomplete when it
  describes a required file without showing runnable or honestly adaptable content for it.
- When the proof resolves a Contentful entry, state the minimum resolvable fetch shape in the quick
  start: one concrete locale and enough include depth for the linked experience and variants. Do not
  defer a constraint that can make the first verification silently return baseline. Put it before
  the Verify step and name any common incompatible fetch mode the blueprint identifies.

### Feature-section evidence

Treat every blueprint row as a teaching contract, not a list of nouns to mention. For each evidence
atom:

1. **Mechanism:** say what the SDK or application actually does.
2. **Owner:** distinguish SDK-owned names/state/lifecycle from reader-owned policy, data, and code.
3. **Consequence:** name the failure symptom, boundary, or tradeoff that makes the fact useful.
4. **Example:** show the smallest realistic code, diff, table row, or concrete shape needed to act.
5. **Verification:** tell the reader what observable result distinguishes success from a silent
   fallback or superficially working setup.

The blueprint can narrow an atom, combine several atoms into one example, or explicitly request a
compact inventory that does not need all five parts. Do not inflate obvious API lists merely to fill
the pattern. Conversely, a section does not satisfy an atom by naming its mechanism without its
reader consequence. Prefer one developed canonical path plus concise alternatives over several
equally shallow examples.

### Before you start

A prerequisites list, not a setup-inventory table. Include only what the reader gathers from outside
the guide (runtime prerequisites, credentials, authored Contentful data, Optimization project
values). If a sequenced section teaches it, it does not go here. Anti-patterns: a multi-column setup
table; rows that restate quick-start steps; rows that only say "there is a section below";
`Category` / `Required for quick start` columns; listing values the quick start never uses. The
authored-variant bullet is the slot-free `authored-variant-gotcha` fragment — mandatory.

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
- Factory/root blocks containing app-owned locale, metadata, consent policy, imports, or placement
  are normally `**Adapt this to your use case:**`, even when their SDK call shape is canonical.
- `**Adapt this to your use case:**` — realistic app-shaped code needing structural change or
  placement; name what is the reader's vs the pattern to copy; prefer a `+`/`-` diff of the reader's
  likely code.
- `**Follow this pattern:**` — illustrative shape, not drop-in runnable.
- `**Reference excerpt:**` — shortened/copied reference-implementation code.
- Before keeping any example, perform a local consistency pass: no prop/helper is redeclared or
  shadowed, callbacks do not accidentally call themselves, every referenced helper is defined or
  explicitly reader-owned, and the shown imports/return types agree with the body. An adaptable
  snippet may omit surrounding application code; it may not contain a defect in the pattern being
  taught.
- Define or export a reused app helper before the first snippet that imports it. A later definition
  does not make an earlier sequential step runnable.
- Comment only meaningful SDK-specific lines (lifecycle placement, consent, event sequencing,
  fallback, duplicate-event prevention). Never narrate obvious syntax.

### Production checks

Must cover: credentials/runtime config, consent behavior, event delivery, content fallback,
duplicate-tracking prevention, privacy/governance, and a local validation path.

Any commands must be available in the reader's application and labeled `Adapt this to your use
case` when script names vary. Repository-maintainer commands belong only in a clearly labeled
`Reference excerpt` with the repository context stated; never present them as copyable app commands.

Resolve every reader-facing link relative to the rendered guide under `documentation/guides/`, not
relative to the recipe, blueprint, fragment, or KB file where the link was discovered. Never copy a
blueprint-relative implementation or fact-source URL verbatim into the guide.

### Shared-concern coverage

Each shared concern is either covered by the guide or explicitly marked not-applicable for this SDK:
install/init/config; consent & privacy handoff; the fetch/SDK boundary; entry resolution + fallback;
page/route/screen events; interaction tracking; identity/profile/reset; routing/lifecycle/request
context; real-time updates/preview/analytics/caching; verification. The blueprint's Section map
records where applicable concerns land and what evidence each section must include. The writer checks
the complete map; the source verifier checks claims that were made, not omissions it cannot infer.
