# AGENTS.md

Applies to public integration guides under `documentation/guides/`.

## Guide shape

- Directory README: keep `Choosing the right SDK` under `## Start here`; list implementation guides
  under `## Integration guides` in platform/layer order: Node, Web, React Web, React Native, iOS
  SwiftUI, iOS UIKit, Next.js SSR-primary, Next.js hybrid SSR + CSR takeover.
- Implementation guide H1 format:
  `# Integrating the Optimization <SDK name> SDK in a <runtime> app`.
- Open with the reader goal, usually `Use this guide when...`, then place the collapsible TOC before
  the first `##`.
- Standard section flow: `## Scope and capabilities`, `## The integration flow`, numbered core
  implementation steps, optional/informational sections, and
  `## Reference implementations to compare against`.
- Keep minimum viable/default setup before stricter consent, persistence, hybrid, troubleshooting,
  or regulatory variants.
- Consent guidance must include default-on accepted startup when supported and frame UI/CMP wiring
  as application-policy dependent.
- When extracting README material, update the existing runtime guide when possible; TypeDoc owns
  method-by-method API detail.

## TOC and numbering

- Preserve the guide TOC wrapper with `<!-- mtoc-start -->` and `<!-- mtoc-end -->`.
- Include `##` and relevant `###` headings in the TOC; keep anchors synchronized after heading
  edits.
- Number only core implementation steps. Do not number optional live-update, preview-panel, caching,
  hybrid, troubleshooting, or reference sections.

## Reference implementations

- Link only to monorepo reference implementation READMEs, not external demos or implementation
  source files.
- Mention relevant implementations briefly near the top, then expand links in
  `Reference implementations to compare against`.

## Validate

- For guide edits, verify the TOC appears before the first `##` and TOC anchors resolve to headings.
