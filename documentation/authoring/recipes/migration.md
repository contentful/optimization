---
archetype: migration
filename: migrating-*.md
---

## Context

For guides that move an existing integration from a legacy SDK to the Optimization SDK Suite. The
reader goal is not a clean install; it is replacing a working surface without preserving obsolete
architecture. The `guide-writer` renders the **Template** below; it never emits this Context.

Use this recipe when an integration guide is too start-from-zero and a supplemental recipe is too
narrow. Keep the guide scoped to one runtime or one cross-runtime migration concern. Do not collapse
browser, React, Next.js, server, plugins, and content-model migration into one guide.

The migration blueprint owns the guide file, source package route, target guide route, section plan,
fact routing, and unresolved handoffs. Legacy facts come from the migration knowledge base. Target
SDK facts come from the SDK knowledge base. Interface shapes still come from package source/types
while writing.

Migration guides must make ownership changes visible before code changes. The reader should know
which layer owns Contentful authoring, runtime configuration, consent records, cookies, first page
events, analytics forwarding, preview behavior, and cache boundaries before deleting legacy packages.
Route those decisions to target guides, concepts, or supplemental migration guides instead of
recreating SDK facts here.

For runtime migrations, put content-model prerequisites before rendering work when the app depends
on legacy `nt_*` fields, mapper output, or runtime experience configuration arrays. The first
performable content check should use one authored all-visitors or otherwise always-matching variant
so the reader can separate authoring/setup failures from audience-rule failures.

For event, consent, and analytics migrations, require both accepted-event and blocked-event
observability when the target runtime supports it. Link runtime-specific consent sections rather
than generalizing consent mechanics in the migration guide. Blocked diagnostics are evidence, not a
replay queue.

For server, framework, and hybrid migrations, require the guide to name the owner of the first page
event, the target profile-cookie boundary, and any per-request dynamic or cache consequence before
the rendering replacement. Manual Node/Web hybrids are app-owned at the cookie boundary; target
framework adapters may own more of that handoff.

## Template

# ⟨Migration guide title⟩

Use this guide when ⟨the legacy integration being replaced and the target result⟩.

## What changes

⟨A short routing summary: source package(s), target package(s), and the main ownership change. Link
to the target integration guide before detail.⟩

## Before you migrate

⟨Inputs the reader gathers from the existing app and Contentful space: package usage, rendered
surfaces, consent/analytics policy, profile continuity, authored content, target SDK values,
configuration ownership, first-event ownership, and request/cache constraints.⟩

## Migration path

⟨A numbered path that removes legacy wiring, installs target packages, restores the first working
result, then adds policy-dependent replacements. If legacy Contentful mapper output is involved,
route to content-model migration before runtime rendering. Each step links to the target integration
or supplemental guide when that guide owns the detailed procedure.⟩

## Replace legacy surfaces

⟨Sections from the blueprint. Each section names the legacy surface, the target surface or manual
replacement, and the verification the reader should perform.⟩

## Validate the migration

⟨Checks for target rendering, an authored all-visitors or always-matching variant, fallback, accepted
and blocked event evidence, consent, profile continuity, first-event ownership, cache/dynamic
boundaries, analytics forwarding, preview behavior, and dead legacy package removal as applicable.⟩

## Troubleshooting

⟨Only reader-observable migration failures from the blueprint.⟩

## Related guides

⟨Target integration guides, supplemental guides, and concepts.⟩
