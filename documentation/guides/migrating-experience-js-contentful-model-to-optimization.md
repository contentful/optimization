# Migrating an experience.js Contentful model to Optimization

Use this guide when a Contentful space uses Ninetailed-authored experience entries, legacy `nt_*`
fields, or `@ninetailed/experience.js-utils-contentful` mapper code and you need the authored
content ready for Optimization SDK rendering.

## What changes

The legacy mapper turns Ninetailed Contentful entries into runtime experience configuration arrays.
The Optimization SDK Suite reads Optimization-authored links from the entries you fetch and resolves
the entry at render time. Runtime guides own rendering; this guide owns the authoring inventory and
handoff.

Before changing runtime code, read the target guide for your app:

- [Web SDK](./integrating-the-web-sdk-in-a-web-app.md)
- [React Web SDK](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Next.js App Router SDK](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Next.js Pages Router SDK](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
- [Node SDK](./integrating-the-node-sdk-in-a-node-app.md)

## Before you migrate

Gather these inputs from your existing app and Contentful space:

- The content types and entries that contain legacy `nt_name`, `nt_description`, `nt_type`,
  `nt_config`, `nt_audience`, `nt_variants`, `nt_experience_id`, or `nt_experiences` fields.
- Every call to `ExperienceMapper`, `mapCustomExperience`, async custom mappers, or code that builds
  `ExperienceConfiguration` arrays.
- The baseline entries your app renders, the variants attached to them, and the audience rules that
  must still apply after migration.
- The target runtime and guide that will render those entries.
- A first verification target: one baseline entry, one Optimization experience linked from that
  baseline, and one variant entry. Configure that test experience so every visitor is eligible, so
  baseline fallback and a missing authored variant are easy to tell apart.

There is no SDK-provided content migration codemod or official field mapping for converting
Ninetailed-authored entries to the Optimization content model. Treat the content migration as an
operational authoring task in Contentful, then verify it through the target SDK.

## Migration path

1. Inventory the legacy authored entries and mapper usage.
2. Author the target Optimization experiences and variants in Contentful.
3. Stop producing legacy runtime configuration arrays from `nt_config`.
4. Update runtime code to pass fetched Contentful entries to the target SDK's entry-resolution path.
5. Verify one authored all-visitors variant in the target runtime.
6. Remove `@ninetailed/experience.js-utils-contentful` after no runtime path imports it.

## Replace legacy surfaces

### Inventory legacy authored entries and mapper usage

Find the entries and code paths that make personalization depend on the legacy model:

- Baseline entries with `fields.nt_experiences`.
- Experience entries with `nt_config`, `nt_audience`, `nt_variants`, and `nt_experience_id`.
- Mapper code that converts traffic, distribution, audiences, or replacement components into
  runtime objects.
- Custom variant mapping that adds application fields before rendering.

Do not preserve `ExperienceConfiguration` arrays as the target data model. In Optimization, a
baseline entry links to Optimization experience entries through SDK-owned fields, and matching
experiences link to replacement entries. If the links are absent or unresolved in the fetched
payload, the SDK returns the baseline entry.

### Plan target Optimization authoring

Use Contentful personalization authoring to create the target experiences and variants. For the
minimum first proof, identify one legacy baseline entry, create or reuse one target baseline entry,
link one Optimization experience from the baseline entry's `nt_experiences` field, and link one
replacement entry from that experience's `nt_variants` field. Configure that experience with no
restrictive audience, or with an audience rule that matches every visitor in your test route.

Keep the runtime expectation simple:

- Fetch one concrete locale, such as `en-US`; do not use all-locale payloads.
- Include linked entries deeply enough for the page or section you render. The default managed
  entry-fetching path uses `include: 10`; for manual fetching, set an equivalent include depth in
  your app's Contentful query.
- Keep the Contentful client in the app. With manual fetching, your app fetches the baseline entry
  and passes it as `baselineEntry` or to `resolveOptimizedEntry()`. With managed fetching, your app
  gives the SDK its `contentful.js` client and the SDK fetches explicit entry IDs for the supported
  target runtime.

For the first verification, choose one baseline entry and one variant that targets all visitors.
That proves the authoring links and runtime resolution before you migrate more rules.

### Replace mapper-dependent runtime code

Remove mapper output from the rendering path. Replace code that passes mapped experience arrays to
experience.js components with the target runtime's entry-resolution surface:

- Web: [Resolving entries and rendering the result](./integrating-the-web-sdk-in-a-web-app.md#resolving-entries-and-rendering-the-result)
  or [Web Components entry rendering](./integrating-the-web-sdk-in-a-web-app.md#web-components-entry-rendering).
- React Web:
  [Resolving entries and rendering the result](./integrating-the-react-web-sdk-in-a-react-app.md#resolving-entries-and-rendering-the-result)
  with `OptimizedEntry`, `useOptimizedEntry`, or `resolveOptimizedEntry()`.
- Next.js App Router:
  [Personalizing first paint on the server](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#personalizing-first-paint-on-the-server).
- Next.js Pages Router:
  [Personalizing entries](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#personalizing-entries)
  and
  [Letting the server fetch by ID (managed)](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#letting-the-server-fetch-by-id-managed).
- Node:
  [Fetch and resolve Contentful entries](./integrating-the-node-sdk-in-a-node-app.md#fetch-and-resolve-contentful-entries).

If custom mapper code added application-specific fields, keep that adaptation outside the SDK
handoff. Fetch or transform the app's own content first, then pass the baseline Contentful entry to
the target resolver.

### Validate content migration before code migration

Before migrating the full runtime, verify the first authored entry can resolve in the target guide's
quick path:

- The baseline entry renders when no visitor matches or links are missing.
- The all-visitors variant renders when the target guide emits the required page or request event.
- The Contentful fetch uses one locale and includes linked Optimization entries.
- No runtime code still imports the legacy Contentful mapper.

## Validate the migration

- Search the app for `@ninetailed/experience.js-utils-contentful`, `ExperienceMapper`, `nt_config`,
  and runtime `ExperienceConfiguration` construction.
- Verify one target runtime renders both baseline fallback and an authored variant.
- Confirm the same entry is fetched with a concrete locale and linked entries included.
- Confirm authors know which entries remain to be migrated in Contentful before the next runtime
  surface moves.

## Troubleshooting

| Symptom                                     | Check                                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| The target runtime always renders baseline  | Confirm the fetched baseline entry contains linked Optimization experiences and variant entries, and that the test experience targets the visitor. |
| The runtime crashes or returns empty fields | Confirm the app did not fetch all locales and that linked entries are resolved in the payload.                                                     |
| Mapper removal breaks custom fields         | Move custom application adaptation before or after SDK entry resolution; do not rebuild legacy experience arrays.                                  |

## Related guides

- [Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md)
- [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md)
- [React Web integration guide](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Node SDK integration guide](./integrating-the-node-sdk-in-a-node-app.md)
- [Contentful personalization authoring](https://www.contentful.com/developers/docs/personalization/)
