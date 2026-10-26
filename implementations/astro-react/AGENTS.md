# AGENTS.md

Exploratory Astro + React integration using the Node SDK and official React Web SDK.

- Keep one SDK-owning React island per document. Other islands must not create another owned root.
- `/` renders per request with a private request handoff; `/static` prerenders baseline content.
- Use full-document navigation. ClientRouter, server islands, and edge adapters are not validated.
- The explicit consent cookie gates all event types; no query-string identity or consent shortcuts.
- CDA credentials stay in server-only imports. Keep single-locale entries in serialized props.
- Run commands through `pnpm implementation:run -- astro-react <script>`.
- Validate with `typecheck`, `lint`, `build`, and the focused `test:e2e` Chromium smoke suite.
- Start the shared mock server before build: prerendering fetches CDA content at build time.
- The Playwright runner starts and cleans up its own mock and app servers. No global setup needed.
