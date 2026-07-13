# Guide self-review checklist

Run before finishing any guide edit. Assertions are written to be mechanically checkable so they can
also back a future validation hook on `documentation/guides/**`. Group A applies to all guides; B–D
add per-archetype checks.

## A. All guides

- [ ] The intro opens by naming the working result, not stacked jargon. The first sentence a reader
      hits does not use an undefined term.
- [ ] **A stated count matches what follows.** If the intro explainer promises "the whole idea in N
      points" (or sentences/steps), the actual count matches. Because explainer bullets can be
      multi-sentence, count the unit named — the `personalization-explainer` fragment counts
      **points** (bullets), five when the profile bullet is included, four when omitted.
- [ ] Every term the quick start relies on is defined in plain language at or before first use (for
      SDK guides that includes the domain concepts — variant, experience, Experience API, resolving,
      baseline fallback — plus any SDK-owned config key, identifier, or event name the quick start
      touches). The definition is in prose (or the intro explainer), not only inside a code comment
      — a reader who skims prose and diffs must still meet the term defined.
- [ ] **Every result-shape field the reader branches on or passes downstream is defined at first
      use.** A key the guide tells the reader to check (`accepted`, `data`, `isPresentationReady`) or
      hand to render logic (`profile`, `selectedOptimizations`, `changes`) gets a plain-prose
      definition at first use, not only a code comment. This extends the term rule above from domain
      nouns to the fields of the SDK's return envelope. It applies wherever the noun first appears in
      prose, even in a section far from the feature that owns it (e.g. `selected optimizations` and
      `changes` first surfacing in a Consent or Identity section) — define it there, do not defer to
      the owning feature section below.
- [ ] **Every SDK-fixed content-model identifier is glossed and its ownership stated at first use.**
      A fixed Contentful content-type or field name the SDK relies on (`nt_experiences`, `nt_audience`,
      `nt_experience`) gets a one-line plain-language gloss and a statement that it is SDK-owned, not a
      name the reader chooses — so a reader cannot mistake it for reader-invented configuration. This
      is the content-model case of the magic-value ownership rule in this group.
- [ ] **Near-identical or shorthand identifiers are disambiguated once.** When two names differ by
      one letter and mean different things (`selectedOptimization` the single returned selection vs
      `selectedOptimizations` the set passed in), or a shorthand form coexists with a longhand one
      (`consent: true` vs `consent: { events, persistence }`), the guide states the distinction at
      first use so neither reads as a typo or a different feature.
- [ ] No section promises "you don't need X" and then requires an undefined X before it is
      explained.
- [ ] No informal filler or hype that reads oddly in a reference doc ("this is the payoff", "the
      magic happens here", "boom", gratuitous "just"). Section openers state what the section does
      plainly.
- [ ] Every fenced code block has exactly one bold intent label immediately before it
      (`**Copy this:**`, `**Adapt this to your use case:**`, `**Follow this pattern:**`, or
      `**Reference excerpt:**`). No former/other labels.
- [ ] Every `**Copy this:**` snippet works with only value substitution; its env-var names,
      endpoints, and paths match reality, or a NOTE explains the discrepancy.
- [ ] No placeholder-only snippet is labeled `**Copy this:**` when it actually needs relocation or
      structural change (that is an adapt).
- [ ] **Every API in a code example is real, sourced by kind — interface vs. behavior.** For
      _interface_ (a symbol's existence, signature, prop/config-key names & types, optionality, union
      shape, return type, import path): confirm it directly against `packages/**/src` or the types — a
      cheap, self-verifying lookup; a plausible-looking field name such as `isEnabled` or `hasResults`
      is not proof it exists. For _behavior_ (what a call does: fallback contracts, dynamic-render
      forcing, batching, defaults, identifier ownership, cross-SDK semantics): it must trace to a
      verified fact in `documentation/internal/sdk-knowledge/`; do not re-trace it from source. If a
      needed _behavioral_ fact is missing, escalate to `sdk-knowledge-authoring` (an interface gap you
      just look up, no escalation). The reference impl shows one working path for shape and "adapt"
      starting points, but the base, not the impl, is what makes a behavioral claim true.
- [ ] Code comments explain only meaningful SDK-specific lines; no obvious-syntax narration.
- [ ] **Every magic-value identifier states who owns it.** For each cookie name, env var, header,
      storage key, or config string in a snippet, the guide states whether the reader must match the
      exact name (SDK-defined) or can choose it freely (reader-invented). Neither reads as the
      other. When an SDK-exported constant (e.g. `ANONYMOUS_ID_COOKIE`) surfaces elsewhere as its
      literal value (e.g. `ctfl-opt-aid` in a Troubleshooting row), the guide states the mapping once
      so the reader can connect the code they wrote to the artifact they observe.
- [ ] **Every helper the reader would run is defined before or at first use, or points forward.**
      Helper functions used inside `**Adapt this to your use case:**` blocks (`getRequestContext`,
      `getProfileFromRequest`) are defined at or before their first appearance, or the guide points
      forward to the section that defines them. A helper referenced but defined nowhere in the guide
      (a `getAppLocale`-style phantom) is a defect: define it once or inline the expression the guide
      already teaches.
- [ ] **No orphan cross-SDK API or event name.** The guide does not name a method or event a given
      runtime never emits (e.g. `screen()` in a Node guide, or `page` / `clicks` in a React Native
      guide that emits `screen` / `taps`) inside a warning, "do not do X" list, blocked-events list,
      or table without introducing it in a flow first. Warn only about methods and event names the
      guide actually teaches; a blocked-events list names only event types this runtime can emit.
- [ ] **`render prop` is defined in prose at first use.** The function-as-child pattern is named and
      explained in plain language the first time prose calls it a "render prop" (React-pattern
      vocabulary is not assumed for the target reader), tied back to the `{(entry) => ...}` form the
      reader already copied.
- [ ] **Source language is consistent, or the switch is announced with run instructions.** A guide
      does not silently switch source language (e.g. a `.mjs` quick start run with `node` followed by
      TypeScript body snippets) without a prose note stating the switch and how to run the new form.
      The run command shown for a `**Copy this:**` block must actually work for that block's
      language.
- [ ] `pnpm format:fix <file>` leaves the file unchanged (run it; Prettier owns formatting).
- [ ] The collapsible TOC preserves the mtoc markers, omits `## Quick start`, and every anchor
      resolves to a real heading.
- [ ] Concept links and reference-implementation links are not front-loaded before the quick start
      unless the reader must understand them before acting.

## B. Integration guides (`integrating-*.md`)

- [ ] Section order and headings match the integration recipe
      (`documentation/authoring/recipes/integration.md`); no numbered headings; no monolithic flow
      section.
- [ ] Every `###` feature section has a correct `**Integration category:**` line, and its category
      matches its parent `##` (Required/Common under Core; Optional under Optional; Advanced under
      Advanced).
- [ ] **A Core section that revisits a quick-start step opens with a bridge, not a verbatim recap.**
      The first feature section (typically install/initialize) does not repeat the quick start's
      install/mount steps word-for-word; it opens by naming what is genuinely new below (the full
      config surface, extra props) so a skimming reader is not invited to skip past new material.
- [ ] The quick start proves exactly one result and verifies only that result. If the intro or quick
      start promises more than one observable result (e.g. "one entry resolving and one screen
      event"), the verify step confirms every promised result where the reader hits it — or the quick
      start is narrowed to a single proof. A promised proof with no matching verification is a defect.
- [ ] **The inspection mechanism a verify step names is present in the pasted quick-start code.** If
      the verify step tells the reader to watch `states.eventStream`, read a `logLevel` log line, or
      inspect any accessor, the quick-start snippet the reader just pasted must already expose it — a
      verify step that depends on an accessor only wired up in a later section is not performable
      where the reader hits it.
- [ ] **The quick start is grounded in a real app shape** — no invented fetch shapes (e.g. a
      hardcoded array of entry IDs). The most common real shape leads; other shapes are pointed to a
      feature section.
- [ ] **Files the reader already owns (layout, providers, renderer, and the runtime root component
      such as `App.tsx`) are shown as `+`/`-` diffs that preserve existing content**, not full files
      to paste over, and not with the additions blended invisibly into a rewritten file. A reader's
      app root is something they always already own, so a full standalone `App` is never a
      `**Copy this:**` paste-over. The `+` lines must be unambiguously the additions. A short prose
      note states the surrounding code is illustrative context to match against, not a block to paste
      verbatim.
- [ ] **Native integration guides put the native build step inline in the quick start.** For iOS /
      Android / React Native targets, the native install step (`pod install`, `npx expo prebuild`, or
      equivalent) that must run before the app launches appears in the quick start where the reader
      installs, not deferred to `## Before you start` — the reader needs it before the verify step.
- [ ] The entry-wrap example shows any cast the render prop requires and states the fallback
      contract; the cast matches the matching reference implementation (verify against
      `implementations/`).
- [ ] The verify step is performable — it tells the reader how to cause the result
      (audience-targets- all, or forcing a variant), not just to "load as a qualifying visitor."
- [ ] The quick start is self-contained: no step (the verify step included) is only actionable via a
      forward reference to a later section. A step may link onward for depth, but the instruction it
      needs to act must be present inline where the reader hits it.
- [ ] `## Before you start` is a prerequisites list, not a setup-inventory table, and instantiates
      the `authored-variant-gotcha` fragment
      (`documentation/authoring/fragments/authored-variant-gotcha.md`).
- [ ] Each shared concern is either covered by the guide or explicitly marked not-applicable for
      this SDK: install/init/config; consent & privacy handoff; the fetch/SDK boundary; entry
      resolution + fallback; page/route/screen events; interaction tracking; identity/profile/reset;
      routing/lifecycle/request context; real-time updates/preview/analytics/caching; verification.
- [ ] `## Production checks` covers config, consent, event delivery, content fallback, duplicate
      tracking, privacy/governance, and a local validation path.
- [ ] `## Troubleshooting` is present only if the guide covers known failure modes, and its rows map
      to real symptoms a reader hits (including the render-prop cast type error, if applicable).
- [ ] Reference-implementation links point to monorepo READMEs, not source files, sample apps, or
      external demos. Reference implementations are framed as maintained comparison and validation
      targets for SDK behavior, not as optional examples or lower-stakes sample code.

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
