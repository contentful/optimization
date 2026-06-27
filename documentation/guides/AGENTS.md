# AGENTS.md

Applies to public guides under `documentation/guides/`.

## Guide index

- Directory README: keep `Choosing the right SDK` under `## Start here`; list integration guides
  under `## Integration guides` with server and web SDKs before native and mobile SDKs in this
  order: Node, Web, React Web, Next.js SSR, Next.js hybrid, React Native, iOS SwiftUI, iOS UIKit,
  Android Compose, Android Views.
- Keep the directory README as a lightweight routing index. It must help readers pick the next
  guide, not preview setup steps, compare every tradeoff, or teach integration procedures.
- Use only concise routing fields in the directory README, such as `Guide`, `Runtime or app type`,
  and `Package`. Do not include `Fastest path`, `Choose another guide when`, setup summaries, or
  procedure previews there. Put detailed package tradeoffs in `choosing-the-right-sdk.md` and
  runnable paths in the individual integration guides.

## Guide archetypes

Use the archetype that matches the guide's primary reader goal. A guide must have one primary
archetype, but it can include local decision tables, short recipes, or troubleshooting decision
paths when they support that archetype's goal.

### Integration guides

Use this archetype for files named `integrating-*.md`.

Integration guides must use this structure. Organize the full guide by feature/concept instead of
one monolithic ordered flow. Procedures belong inside the relevant feature/concept section as
numbered lists, not numbered headings:

```md
# Integrating the Optimization <SDK name> SDK in a <runtime> app

Use this guide when...

## Quick start

<quick-start content>

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Required setup

## Core integration

### <required or policy-dependent feature/concept>

**Integration category:** <Required for first integration | Common but policy-dependent>

1. <local procedure step>
2. <local procedure step>

## Optional integrations

<include when the guide has optional feature/concept sections>

### <optional feature/concept>

**Integration category:** Optional

1. <local procedure step>
2. <local procedure step>

## Advanced integrations

<include only when the guide has advanced or production-only feature/concept sections>

### <advanced feature/concept>

**Integration category:** Advanced or production-only

1. <local procedure step>
2. <local procedure step>

## Production checks

## Troubleshooting

<include only when the guide covers known failure modes>

## Reference implementations to compare against
```

- Include `## Optional integrations` only when the guide contains optional feature/concept sections.
- Include `## Advanced integrations` only when the guide contains advanced or production-only
  feature/concept sections.
- Include `## Troubleshooting` only when the guide covers known failure modes.
- Integration guide H1 format: `# Integrating the Optimization <SDK name> SDK in a <runtime> app`;
  Next.js variants may append the pattern in parentheses, such as `(SSR)` or
  `(hybrid SSR + CSR takeover)`.
- When extracting README material, update the matching integration guide when possible; TypeDoc owns
  method-by-method API detail.

### Decision guides

Use this archetype for `choosing-the-right-sdk.md` and future guides where the reader's primary goal
is to choose between SDKs, runtimes, patterns, or tradeoffs.

Decision guides must use this required structure:

```md
# <Decision guide title>

Use this guide when...

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Recommendation

## Decision table

## Alternatives

## Follow-up guides
```

Decision tables must use these columns: `Reader need`, `Choose`, `Why`, and `Next guide`. Add
`Do not choose when` only when a row needs a boundary or warning.

### Supplemental recipe guides

Use this archetype for
`forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md` and future guides
that supplement an SDK integration without replacing the matching integration guide.

Supplemental recipe guides must use this required structure:

```md
# <Supplemental recipe guide title>

Use this guide when...

## Do you need this?

## Quick start

<quick-start content>

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->
<!-- mtoc-end -->
</details>

## Default recipe

## Runtime or vendor variants

## Validate the integration

## Governance notes

## Related guides and concepts
```

- `## Quick start` is one minimum viable recipe that a reader can apply first.
- `## Default recipe` explains the reusable pattern behind the quick start.
- `## Runtime or vendor variants` must group variants by runtime, vendor, or destination, and each
  variant must state when it applies.

## Quick starts and setup

- Put `## Quick start` before the collapsible TOC in integration guides and supplemental recipe
  guides.
- Treat `## Quick start` as the minimum viable integration: the least setup and code required to
  prove the SDK works in that runtime with one observable result.
- Keep the quick start focused on one direct success path and one verification statement. Install
  only what is required, initialize the SDK, apply the default consent path when application policy
  permits it, choose one first observable result, and state how to verify only that result.
- A quick start may include only setup and code required for its chosen first observable result. If
  a concern has its own feature/concept section later in the guide, keep it out of the quick start
  unless the chosen first result cannot work without it.
- Choose one primary quick-start proof. Common valid proofs include:
  - SDK initialization plus one accepted page or screen event.
  - One Contentful entry rendering as either the selected variant or the baseline fallback.
  - Server-rendered content surviving browser takeover without a duplicate initial page event in a
    hybrid guide.
  - One approved SDK event or context signal reaching an app-owned destination in a supplemental
    analytics-forwarding recipe.
- Do not combine several proofs in one quick start. For example, do not verify entry rendering, view
  tracking, tap tracking, identity changes, analytics forwarding, and live updates in the same
  quick-start path.
- Prefer copy-paste quick-start snippets. Use `**Copy this:**` when a snippet only requires simple
  value substitution, such as IDs, tokens, environment variable names, package versions, file paths,
  app names, or config values.
- Do not include optional integrations, production hardening, full app architecture, multiple
  alternate flows, custom helper abstractions, or broad setup inventories in the quick start.
- Move interaction tracking, consent variants, routing variants, identity, analytics forwarding,
  preview, live updates, offline queues, caching, governance, strict event admission, production
  hardening, and production-only concerns to later feature/concept sections unless they are required
  for the chosen first observable result.
- `## Quick start` is the shortest runnable path that lets the reader see the SDK work.
- `## Required setup` is the setup inventory for the full guide. It clarifies required,
  policy-dependent, optional, and advanced inputs before the feature/concept sections.
- Do not repeat the quick-start procedure in `## Required setup`. Use `## Required setup` for the
  setup table and brief setup notes, then put feature-specific procedures under the matching
  feature/concept sections.
- Follow the quick start with `## Required setup` in integration guides. Include an early setup
  table with these categories: required for first integration, common but policy-dependent,
  optional, and advanced or production-only.
- Use this exact setup table shape in integration guides: `Setup item`, `Category`,
  `Required for quick start`, and `Where to configure`. Use only these `Category` values:
  `Required for first integration`, `Common but policy-dependent`, `Optional`, and
  `Advanced or production-only`. Create one row per setup item; do not rename columns or category
  values.
- Use only `Yes`, `No`, or `Conditional` in the `Required for quick start` column.
- Set `Required for quick start` from the actual quick-start path only, not from the full guide.
  Mark a row `Yes` only when the quick-start code or verification cannot work without it. Mark later
  feature work such as entry interaction tracking, analytics forwarding, preview, live updates,
  identity, strict event policy, offline delivery, and production validation as `No` or
  `Conditional` unless the quick start explicitly requires it for the chosen first result.
- The setup table must include rows for supported setup needs in these groups: package dependencies,
  credentials and environment configuration, consent or privacy policy decisions, Contentful data
  and entry-shape requirements, runtime hooks such as routing or lifecycle integration, and optional
  platform modules.
- Keep minimum viable setup before stricter consent, persistence, hybrid, troubleshooting, or
  regulatory variants.
- After `## Required setup`, organize full integration guidance by feature/concept. Use
  `## Core integration` for required and common policy-dependent features,
  `## Optional integrations` for optional features, and `## Advanced integrations` for advanced or
  production-only features.
- Consent guidance must include default-on accepted startup when supported and frame UI/CMP wiring
  as application-policy dependent.
- Move exhaustive props, options, and API tables out of the quick start and required setup sections
  unless the table is necessary to complete the first working path.

## SDK-specific quick-start guardrails

Use these guardrails when the SDK supports the listed feature but the quick start does not choose
that feature as its single proof:

- Web and React Web quick starts: do not include explicit tracking-attribute setup, explicit
  interaction tracking configuration, interaction-event verification, analytics forwarding, preview,
  live updates, or identity unless the guide's chosen first result requires that feature. Default
  interaction tracking may exist implicitly when the quick start uses `OptimizedEntry`.
- Next.js hybrid quick starts: do not include explicit `trackEntryInteraction`, `data-ctfl-*`
  verification, entry view/click/hover verification, analytics forwarding, preview, or production
  cache policy. Keep the first path focused on server defaults, request handling, duplicate initial
  page-event prevention, baseline fallback, and browser takeover. Default interaction tracking may
  exist implicitly when the quick start renders SDK entry wrappers.
- React Native quick starts: do not include `OptimizationScrollProvider`, explicit `trackTaps`, view
  tracking verification, tap tracking verification, preview, offline delivery, or analytics
  forwarding. Keep interaction tracking in the later feature section. Default interaction tracking
  may exist implicitly when the quick start uses `OptimizedEntry`.
- Android Compose quick starts: do not include `OptimizationLazyColumn`, explicit `trackViews` or
  `trackTaps`, view tracking verification, tap tracking verification, preview, offline delivery, or
  analytics forwarding. Keep interaction tracking in the later feature section. Default interaction
  tracking may exist implicitly when the quick start uses `OptimizedEntry`.
- Android Views quick starts: do not include `TrackingRecyclerView`, explicit `trackViews` or
  `trackTaps`, view tracking verification, tap tracking verification, preview, offline delivery, or
  analytics forwarding. Keep interaction tracking in the later feature section. Default interaction
  tracking may exist implicitly when the quick start uses `OptimizedEntryView`.
- Native UIKit quick starts may use SDK initialization plus one accepted screen event as the first
  proof when Contentful entry rendering would make the quick start disproportionately app-specific.
  Put full entry resolution and rendering in the later feature section.

## Integration coverage

Integration guides must cover each supported SDK concern in a feature/concept section or explicitly
classify it as not applicable for that SDK/runtime. Use the integration category that matches the
reader's actual need.

When supported by the SDK/runtime, cover:

- SDK installation, initialization, and configuration.
- Consent and privacy-policy handoff.
- The boundary between SDK responsibilities and app-owned Contentful fetching.
- Entry resolution, rendering, and fallback behavior.
- Page, route, or screen events.
- Entry interaction tracking.
- Identity, profile, persistence, and reset behavior.
- Routing, navigation, lifecycle hooks, or request context.
- Live updates, preview tooling, analytics forwarding, caching, and hybrid continuity when they are
  supported optional or advanced concerns.
- Verification that the integration is working.

## Feature and procedure sections

- Feature/concept sections in integration guides must be `###` headings under one of these parent
  sections: `## Core integration`, `## Optional integrations`, or `## Advanced integrations`.
- Start each feature/concept section with a bold integration-category line. Use only these values:
  `**Integration category:** Required for first integration`,
  `**Integration category:** Common but policy-dependent`, `**Integration category:** Optional`, and
  `**Integration category:** Advanced or production-only`.
- Put `Required for first integration` and `Common but policy-dependent` sections only under
  `## Core integration`.
- Put `Optional` sections only under `## Optional integrations`.
- Put `Advanced or production-only` sections only under `## Advanced integrations`.
- Use numbered lists for ordered procedures inside a feature/concept section. If a feature/concept
  needs multiple named subflows, add unnumbered `####` subheadings and put the numbered lists under
  those subheadings.
- Do not create a monolithic flow section such as `## The integration flow`,
  `## Required integration steps`, `## Core steps`, or `## Numbered task steps`.

## Optional and advanced material

- Group optional concerns under `## Optional integrations`, with one `###` feature/concept section
  per optional concern.
- Group advanced or production-only flows under `## Advanced integrations`, with one `###`
  feature/concept section per advanced concern.
- Integration guides must include `## Production checks` for release-readiness validation before
  `## Reference implementations to compare against`. Add `## Troubleshooting` after
  `## Production checks` only when the guide covers known failure modes.
- `## Production checks` must include concrete checks for credentials and runtime configuration,
  consent behavior, event delivery, content fallback behavior, duplicate tracking prevention,
  privacy or governance constraints, and a local validation path.
- Put concept links and deeper mechanics after the task step that needs them or in a `## Learn more`
  section. Do not front-load concept links before the quick start unless the reader must understand
  them before acting.
- Use concepts for deeper mechanics and generated TypeDoc for exhaustive API reference. Guides own
  the default integration paths, feature tasks, decisions, examples, and operational checks.

## Examples

- Introduce each code block with a bold example-intent label immediately before the fenced block:
  - `**Copy this:**` for snippets that can be pasted with only simple value substitution, such as
    IDs, tokens, environment variable names, package versions, file paths, app names, or config
    values.
  - `**Adapt this to your use case:**` for realistic app-shaped snippets that require structural
    changes, framework placement, application-specific control flow, ownership decisions, or
    business logic.
  - `**Follow this pattern:**` for illustrative examples that demonstrate an approach or integration
    shape but are not intended as drop-in runnable code.
  - `**Reference excerpt:**` for shortened or copied reference-implementation code.
- Placeholder values alone do not make a snippet adaptive. Label a snippet `**Copy this:**` when the
  reader only needs to replace local values.
- Keep examples minimal but complete enough to run or adapt. Do not mix method-by-method API detail
  into guide examples.
- Add short code comments for important SDK-specific lines or blocks, especially lifecycle
  placement, SDK instance ownership, consent behavior, event sequencing, fallback behavior,
  duplicate-event prevention, and verification-relevant behavior. Do not comment obvious syntax or
  narrate every line.

## TOC and numbering

- Preserve the guide TOC wrapper with `<!-- mtoc-start -->` and `<!-- mtoc-end -->`.
- In integration guides and supplemental recipe guides, place the collapsible TOC after the
  quick-start content and before the next `##` section. Omit `## Quick start` from the TOC because
  the reader has already passed it.
- In supplemental recipe guides, also omit `## Do you need this?` from the TOC because the reader
  has already passed it.
- In decision guides, place the collapsible TOC after the reader-goal opening and before the first
  `##` section.
- In guide TOCs, include `##` headings by default. In integration guides, include the `###`
  feature/concept headings under `## Core integration`, `## Optional integrations`, and
  `## Advanced integrations`. Include other `###` headings only when they represent major alternate
  flows or runtime/vendor variants that readers need for navigation.
- Keep anchors synchronized after heading edits.
- Do not use numbered headings at any level. Use numbered lists for procedures inside the relevant
  parent section instead.
- Do not number optional live-update, preview-panel, caching, hybrid, production checks,
  troubleshooting, `## Learn more`, reference sections, or any other heading.

## Reference implementations

- Link only to monorepo reference implementation READMEs, not external demos or implementation
  source files.
- Mention relevant implementations briefly near the top only when they clarify the quick start or
  first required setup path; otherwise, expand links in
  `Reference implementations to compare against`.

## Validate

- For guide index edits, verify the README remains a lightweight routing index with no fastest-path
  columns, setup summaries, decision-matrix detail, or procedure previews.
- For guide edits, verify the quick start appears before the TOC when the archetype requires it.
- Verify quick starts are minimum viable integrations with one direct success path and one
  verification statement, not broad integration walkthroughs.
- For integration and supplemental recipe guides, extract only the text between `## Quick start` and
  `<!-- mtoc-start -->` during review. Verify that slice chooses one primary proof, verifies only
  that proof, and contains no optional-feature terms for the SDK unless the proof cannot work
  without them.
- Verify that every setup table row marked `Required for quick start` = `Yes` is present in, or
  strictly necessary for, the extracted quick-start slice. Rows for later feature sections must not
  be marked `Yes` merely because they are important elsewhere in the guide.
- Verify quick starts keep interaction tracking, analytics forwarding, identity, preview, live
  updates, offline queues, caching, and production hardening out of the first path unless the guide
  explicitly names one of those concerns as the chosen primary proof.
- Verify SDK-specific quick-start guardrails are satisfied. In particular, React Native quick starts
  must not include `OptimizationScrollProvider`, explicit `trackTaps`, or interaction-event
  verification; Android Compose quick starts must not include `OptimizationLazyColumn`, explicit
  `trackViews` or `trackTaps`, or interaction-event verification; Android Views quick starts must
  not include `TrackingRecyclerView`, explicit `trackViews` or `trackTaps`, or interaction-event
  verification; and Next.js hybrid quick starts must not include explicit `trackEntryInteraction` or
  `data-ctfl-*` verification unless the selected proof requires them. Default interaction tracking
  may exist implicitly when a quick start uses the SDK entry wrapper.
- Verify quick-start snippets use `**Copy this:**` unless they require structural adaptation.
- Verify guides do not use the former adaptive or pattern-only example labels.
- Verify `**Adapt this to your use case:**` is the only adaptive example label and
  `**Follow this pattern:**` is the only pattern-example label.
- Verify placeholder-only snippets are not labeled as adaptive.
- Verify code examples include concise comments for important SDK-specific setup, sequencing,
  ownership, consent, fallback, or duplicate-event behavior.
- Verify guide TOCs include `##` headings by default, include integration-guide `###`
  feature/concept headings, include any other intentional `###` major flows, and resolve to
  headings.
- Verify integration guides do not contain numbered headings or monolithic flow sections such as
  `## The integration flow` or `## Required integration steps`.
- Verify integration guides cover the shared integration coverage checklist or explicitly classify
  unsupported SDK/runtime concerns as not applicable.
- Verify feature/concept sections in integration guides use the required parent sections and exact
  integration-category labels.
- Verify integration guides include the required setup table columns, exact category values, exact
  `Required for quick start` values, required setup-need groups, exact example-intent labels, and
  grouped optional sections.
- Verify integration guides include `## Production checks`, and include `## Troubleshooting` only
  when the guide covers known failure modes.
- Verify `## Production checks` covers configuration, consent, event delivery, content fallback,
  duplicate tracking, privacy or governance, and local validation.
- Verify decision guides use the required decision-table columns.
- Verify supplemental recipe guides distinguish the minimal quick-start recipe from the reusable
  default recipe, and group variants by runtime, vendor, or destination with applicability.
- Verify concept links and reference links are not front-loaded before the quick start unless they
  are required before action.
