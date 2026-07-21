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
      the owning feature section below. **Result and payload wrapper _types_, not just their fields,
      get a first-use gloss and an ownership signal** — a reader must be able to tell an SDK-provided
      type (`ResolvedOptimizedEntry`, `TrackingMetadata`, `EventEmissionResult`, `TrackClickPayload`)
      from a type they define themselves, and a config type whose name is non-obvious for what it holds
      (e.g. consent living inside a `StorageDefaults`) says so at first use.
- [ ] **A published/reactive state field is attributed to the exact object that exposes it.** When
      the guide says the SDK "publishes" or "observes" a value, it names whether that value is a
      top-level reactive property or a field on a published state snapshot (e.g. on iOS,
      `selectedOptimizations`/`locale` are `@Published` on the client, while `profile`/`consent`/
      `changes` are fields on the published `state` snapshot) — it does not list snapshot fields as if
      they were top-level published properties.
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
- [ ] **Cross-SDK contrast asides are bounded in a single-target guide.** A guide for one SDK may note
      once that its idiom differs from a sibling ("these are `StateFlow`s, not the iOS Combine
      publishers") where that genuinely prevents a wrong assumption, but does not repeat the contrast on
      every reactive/suspend/lifecycle surface — the target reader knows their own platform, not the
      sibling's, so repeated "unlike iOS…" asides are jargon that adds noise.
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
- [ ] `pnpm exec prettier --write <file>` leaves the file clean (run it; Prettier owns formatting).
- [ ] The collapsible TOC preserves the mtoc markers, omits `## Quick start`, and every anchor
      resolves to a real heading.
- [ ] Concept links and reference-implementation links are not front-loaded before the quick start
      unless the reader must understand them before acting.

## B. Integration guides (`integrating-*.md`)

- [ ] Section order and headings match the integration recipe
      (`documentation/authoring/recipes/integration.md`); no numbered headings; no monolithic flow
      section.
- [ ] Section inventory, order, exact categories, and teaching goals match the SDK blueprint under
      `documentation/authoring/blueprints/`; every Fact sources link resolves.
- [ ] Every `###` feature section has a correct `**Integration category:**` line, and its category
      matches its parent `##` (Required/Common under Core; Optional under Optional; Advanced under
      Advanced).
- [ ] **No single `###` section bundles multiple independent features under `####` sub-headings.**
      Each independent capability the blueprint lists as its own reader goal (e.g. screen tracking vs.
      entry-interaction tracking vs. custom events) is its own `###` section with its own category
      line and its own TOC entry, not several `####` features sharing one `###` and one category —
      such a mega-section is invisible to a TOC reader and blurs distinct categories.
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
- [ ] **A "read a log line" verify names the recognizable signature to look for.** When the proof is
      observed by reading a `logLevel`/console log, presence of the log switch is not enough — a
      `.debug`/verbose console is high-noise, so the guide shows the recognizable token, prefix, or
      line shape the reader searches for (and the subsystem/filter to narrow to), and that shape
      matches what the SDK actually logs. "Watch the console for the event" with no target line is not
      performable.
- [ ] **A verify step with an observable failure state wires a diagnostic for the failure path.** If
      the proof can render a "blocked"/"failed"/"error" outcome and the shown code `try?`-swallows or
      otherwise hides the cause, the quick start gives the reader one way to see _why_ (a `logLevel`
      note, an `onEventBlocked`/error callback, or an error stream) — otherwise landing on the failure
      branch is a dead end.
- [ ] **The proof's load-bearing state word is defined in the quick start and scoped honestly.** Any
      adjective the proof turns on (`accepted`, `resolved`, `ready`) is defined where the quick start
      first uses it, not only in a downstream section, and the verify names whose acceptance/readiness
      it observes — a client-side signal (a debug log, a returned `accepted` flag) proves the SDK
      emitted/allowed the event locally, not that the server received it, so the wording does not imply
      server receipt.
- [ ] **The verify step can distinguish success from failure.** A proof whose only observable outcome
      is true under both success and failure is not a verification — e.g. "confirm the entry renders
      its baseline or its variant," when the SDK renders baseline on _any_ failure, cannot tell working
      personalization from a broken integration or an unauthored variant. Pair a render proof with the
      `authored-variant-gotcha` prerequisite and a distinguishable signal, or prove a
      state-changing/event outcome the reader can see succeed or fail.
- [ ] **The quick start is grounded in a real app shape** — no invented fetch shapes (e.g. a
      hardcoded array of entry IDs). The most common real shape leads; other shapes are pointed to a
      feature section.
- [ ] **Files the reader already owns (layout, providers, renderer, and the runtime root component
      such as `App.tsx`, or the native runtime root such as `SceneDelegate`/`AppDelegate` on iOS and
      the `Activity`/`Application` on Android) are shown as `+`/`-` diffs that preserve existing
      content**, not full files to paste over, and not with the additions blended invisibly into a
      rewritten file. A reader's app root is something they always already own, so a full standalone
      `App`/`SceneDelegate` is never a `**Copy this:**` paste-over. The `+` lines must be unambiguously
      the additions. A short prose note states the surrounding code is illustrative context to match
      against, not a block to paste verbatim.
- [ ] **Native integration guides put the native build step inline in the quick start.** For iOS /
      Android / React Native targets, the native install step (`pod install`, `npx expo prebuild`, or
      equivalent) that must run before the app launches appears in the quick start where the reader
      installs, not deferred to `## Before you start` — the reader needs it before the verify step.
- [ ] **A required host-registration step is shown inline, with its silent-failure mode named.** When
      the SDK only runs because the host framework wires up a reader-owned entry point — most sharply,
      an Android `Application` subclass that does nothing unless registered via `android:name` in
      `AndroidManifest.xml` — the quick start shows that registration and states that omitting it makes
      initialization silently never run. A create-the-class step whose registration is implied is a
      quick start that cannot be performed.
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
