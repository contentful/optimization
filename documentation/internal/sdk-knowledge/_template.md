<!--
Canonical per-SDK template. Copy this file into the right family dir (e.g. web/) and fill each
section with VERIFIED facts + source pointers. Keep every heading, in this order. If a section has
no entries for this SDK, keep the heading and write "None." Terse notes, not prose. Link to
shared/concepts.md and shared/vocabulary.md instead of restating shared material.
-->

# <SDK display name> — SDK knowledge

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only what is specific to
this SDK.

## Package & entry points

| Import path | Purpose | source |
| ----------- | ------- | ------ |

## Setup / factory

- Factory/init function name(s), the config keys they accept (name — type — what it does —
  required?), and what they return. Note same-named factories on different subpaths. source: per
  line.

## Components & hooks

| Name | Kind (component/hook/provider) | Import path | Key props/args | Returns | source |
| ---- | ------------------------------ | ----------- | -------------- | ------- | ------ |

## Render / entry resolution

- What the entry wrapper's render prop (or equivalent) hands back, its exact type, and any cast the
  reader needs. source:

## Identifier ownership

| Identifier (cookie/header/storage/env) | Owner: SDK or reader | Notes | source |
| -------------------------------------- | -------------------- | ----- | ------ |

## Events & tracking

- Page/route/screen events, interaction tracking: how emitted, dedup/skip semantics, consent gating.
  source: per line.

## Consent & persistence

- consent vs persistence model, where consent policy is read, default behavior. source:

## Version / runtime quirks

- Filename/handler conventions, framework-version differences, SSR/caching/dynamic-render
  interactions. source:

## Failure & fallback behavior

- What happens on API failure, missing variant, unresolved links, bad payload shape. source:
  </content>
