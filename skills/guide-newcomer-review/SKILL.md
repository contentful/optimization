---
name: guide-newcomer-review
description: >-
  Review a documentation guide under documentation/guides/ as an average developer with little or no
  personalization background — the guide's actual target reader. Catches undefined jargon, skim-mode
  triggers, unperformable verify steps, and forward references that assume knowledge the reader does
  not have yet. Reports reader-experience findings; it does not verify SDK facts against source (that
  is guide-source-verification) and does not restructure prose (that is optimization-guide-authoring).
  Use when reviewing a new or rewritten guide before it ships, as the second of the three authoring
  roles (writer → newcomer reviewer → technical-foundation reviewer). Triggers on "newcomer review",
  "review this guide", "read it cold", "average developer review", "docs reviewer".
argument-hint: '[guide file to review]'
paths: documentation/guides/**
---

# Reviewing a guide as a newcomer

Read the guide the way its target reader does: **an average developer with little or no
personalization background**, opening it cold, wanting a working result fast. Your job is to find
every place that reader gets stuck, confused, or silently misled — not to fix the prose (the writer
owns that) and not to check whether the APIs are real (the technical-foundation reviewer owns that).
You report what breaks the reading experience; the writer decides how to fix it, and any rule worth
keeping goes back into the `optimization-guide-authoring` skill.

## The mindset

- **You do not know the domain.** You have not read the concept docs. If a term is used before it is
  defined in plain language, that is a finding — even if it is "obvious" to someone who knows the SDK.
- **You skim.** If the guide re-walks the happy path you already saw, you will skim past it and miss
  the part that matters. Flag anything that invites skim mode.
- **You act on each step as written.** If a step says "load as a qualifying visitor" without telling
  you how to become one, you cannot do it. If the instruction you need is in a later section, you are
  already stuck. Flag it.
- **You take labels literally.** A `**Copy this:**` block that does not actually work with simple
  value substitution has lied to you. A magic-looking identifier you cannot tell is yours-to-invent
  vs. must-match-exactly will cost you an hour.

## What to look for

Walk the guide top to bottom and record a finding wherever the reader would stumble:

- **Undefined term at first use.** Any SDK or domain term (variant, experience, resolving, baseline
  fallback, consent, a config key, an identifier, an event name) used before a plain-language
  definition in prose — not only inside a code comment.
- **Jargon-stacked opener.** The first sentence, or a section opener, that stacks unexplained terms.
- **Skim-mode trigger.** A section that re-teaches the quick start's happy path before reaching new
  material, with no bridge telling the reader what is genuinely new below.
- **Unperformable step.** A step (especially the verify step) that cannot be completed with only the
  information present where the reader hits it — including forward references ("see the section
  below") for an instruction the reader needs _now_.
- **Dishonest example label.** A `**Copy this:**` that needs relocation or structural change; a
  snippet whose env-var names / endpoints / paths would not actually work; a placeholder-only block
  labeled copyable.
- **Ambiguous ownership.** A cookie, env var, header, storage key, or config string where the reader
  cannot tell whether they must match an SDK-defined name or may choose their own.
- **Filler / hype** that reads oddly in a reference doc ("this is the payoff", "boom", gratuitous
  "just").
- **Missing before-you-start prerequisite.** Something the reader must have gathered from outside the
  guide (credentials, runtime setup, and especially authored Contentful data such as a variant on an
  all-visitors experience) that is not called out, so the reader cannot tell personalization from a
  bug.

The `optimization-guide-authoring` skill's `references/authoring-checklist.md` (Group A + the
integration-guide group) is the mechanical backing for most of these — use it as your itemized pass.

## How to report

Return findings, not rewrites. For each:

- **Location** — heading + the line or quoted phrase.
- **What a newcomer hits** — the concrete stumble ("`OptimizedEntry` render prop used here; `render
prop` is never defined, and I don't know personalization terms").
- **Severity** — blocker (cannot proceed) / friction (proceeds but confused or misled) / polish.
- **Suggested direction** — optional, one line; the writer owns the actual fix.

Then note whether any finding reflects a **rule the authoring skill should encode** so future guides
avoid it (e.g. "every render-prop term defined before first use"). Route those to the writer to fold
into `optimization-guide-authoring` — that is how the review loop improves the skill, not just this
guide.

## Not in scope

- **Verifying SDK facts against source** — whether an API, prop, or return shape is real is the
  `guide-source-verification` role. If you _suspect_ a claim is wrong, flag it as "verify" and hand
  it to that reviewer; do not confirm it yourself.
- **Rewriting prose or restructuring sections** — that is the writer with
  `optimization-guide-authoring`.
- **Concept docs, package READMEs, generated TypeDoc.**
