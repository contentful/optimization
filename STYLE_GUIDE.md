# Contentful documentation style guide

Use this guide when writing or editing human-authored documentation in this repository. It adapts
Contentful's technical writing guidance for agents working on the Optimization SDK Suite, while
preserving rules that can be useful for future docs.

This guide intentionally excludes only source-guide mechanics that depend on Contentful's internal
Help Center authoring UI, internal writer peer-review process, or internal ticketing workflow.

## Scope

Follow this guide for:

- Root, package, implementation, and support `README.md` files.
- Authored Markdown under `documentation/**`.
- Explanatory prose in TSDoc, JSDoc, examples, and comments when that prose is user-facing or
  documentation-like.
- Future FAQs, concepts, guides, troubleshooting pages, reference-implementation notes, release
  notes, and changelog prose when they are maintained in this repository.

Do not apply this guide blindly to generated TypeDoc output, generated files, code symbols, API
signatures, package names, UI labels copied from a product, or literal values.

If this guide conflicts with an `AGENTS.md`, follow the nearest applicable `AGENTS.md` for document
structure, repository terminology, commands, validation, and local exceptions. This guide owns prose
style.

For a style question not covered here, follow the Google Developer Documentation Style Guide. For
spelling questions, use Merriam-Webster's Collegiate Dictionary.

## Core principles

- **Meaningfulness** - Keep documentation focused, specific, and to the point.
- **Comprehensiveness** - Include enough information for the reader to use the product or SDK and
  achieve the documented goal.
- **Consistency** - Keep terminology, syntax, and formatting consistent to reduce ambiguity.
- **Context** - Provide the context the reader needs to understand the task, decision, or concept.
- **Structure** - Break text into scannable building blocks with descriptive headings, lists,
  tables, notes, and links where they help.
- Prefer concrete implementation guidance over marketing language.
- Do not repeat generated API reference material unless the detail is necessary to avoid an
  integration mistake.

## Timeless documentation

Write docs so they still read correctly after a feature, SDK, or workflow has been available for a
long time. Avoid words or phrases that anchor the document to the publication date or assume prior
or future product updates.

Avoid time-bound words unless the document is explicitly date-stamped:

- new
- latest
- old
- now
- currently
- presently
- at present
- eventually
- future
- in the future
- soon

When timing matters, use a durable reference such as a package version, release date, API version,
or documented support boundary.

This principle does not apply to time-stamped documentation intended to describe product updates,
such as release notes and changelog entries.

## Voice and tone

- Use American English spelling.
- Use present tense for general behavior that is not tied to a specific time.
- Use active voice by default so the actor is clear.
- Use passive voice only when the actor is unknown, unimportant, or the result matters more than the
  actor.
- In procedures, it is acceptable to use passive voice for the result of the reader's action, such
  as "The preview panel is displayed."
- Address the reader as `you` and `your`.
- For instructions, use the imperative mood and omit the pronoun: "Install the package", not "You
  install the package."
- Avoid first person singular.
- Use first person plural only when referring to Contentful, the SDK, or the maintainers.
- In FAQs, first person can be acceptable when phrasing a reader's question.
- Use singular `they`, `them`, and `their` instead of gendered pronouns.

## Headings

- Use sentence case for headings, preserving official product, package, API, component, hook, file,
  and UI casing.
- Make headings short, focused, descriptive, and useful for navigation.
- Keep headings unique within a document. Avoid reusing identical headings for different purposes
  across nearby docs when that would confuse navigation or generated anchors.
- Use subheadings to introduce conceptual blocks.
- Use a subheading before each flow when a document includes multiple action flows.
- Do not add a subheading when the document has only one subtopic.
- Use one `#` heading for the document title, `##` for main sections, and deeper levels only when a
  section is broken into real subtopics.
- Do not skip heading levels.
- Do not put a period at the end of a heading.
- For overview sections, use a noun phrase that names the feature, concept, or functionality.
- For task sections, use a task-based verb phrase that starts with the action.
- Avoid question headings. Prefer the answer or task name.
- Do not use camel case in prose headings unless the heading includes an official API, component,
  hook, package, or product name that uses camel case.

## Terminology

Use the repository-standard product names and terms from `AGENTS.md`, including:

- Optimization SDK Suite
- Personalization
- Analytics
- Experience API
- Insights API
- reference implementation
- exact package names, such as `@contentful/optimization-web`

Use Contentful product terms consistently when they apply:

- `app` - An HTML5 application that extends the functionality of the Contentful web app or
  Contentful apps and can be installed at the organization or space level.
- `asset` - A media file such as an image, video, audio file, or PDF.
- `Compose` - A Contentful app that provides a simplified interface for creating and publishing web
  pages, mainly for content creators.
- `content` - A collective term for entries.
- `Contentful apps` - A collective term for apps such as Compose and Launch.
- `Contentful web app` - See `web app`.
- `content model` - A structure for content in a space that consists of content types and defines
  connections between them.
- `content type` - An entity that serves as a template for an entry and defines its structure. A
  content type is created on the space level and consists of fields.
- `editor` or `editor page` - A page in the web app or Contentful apps where a user can make changes
  to an entity in editing mode and save them.
- `embargoed assets` - A functionality that protects assets at a space level by making them
  accessible only to authorized users.
- `entity` - A single object that can be uniquely identified. Contentful entities include
  organizations, spaces, environments, content types, assets, entries, tags, locales, users, roles,
  and teams.
- `entry` - A single record of content based on a specific content type.
- `environment` - An entity within a space that keeps a version of space-specific data so changes
  can be made in isolation from other environments.
- `environment alias` - An entity that points to a target environment and can be switched to a
  different target environment.
- `field` - A building block of a content type with a defined format and customizable settings.
- `Launch` - A Contentful app that lets content creators group content into releases and publish,
  schedule publishing, or schedule unpublishing.
- `locale` - A region-language pair that can be enabled for entries, fields, and assets.
- `media` - A collective term for assets.
- `organization` - A top-level company account used for administration. It contains one or multiple
  spaces.
- `organization role` - A role that defines a user's access to an organization.
- `page type` - A custom content type that serves as a template for a page in Compose.
- `reference` - A field type used to link one or multiple entries inside another entry.
- `release` - An entity used to group entries and assets for simultaneous publishing.
- `role` - A set of permissions that enables a user or team to perform tasks related to their job.
- `space` - A workspace that contains content and media for a project and has its own content model.
- `space role` - A role that defines a user's access to a space.
- `tag` - An entity used to mark content and media for more granular governance.
- `team` - An entity used to group users in the same organization based on business function,
  geography, or another grouping.
- `user` - An account used to access the web app or Contentful apps.
- `web app` or `Contentful web app` - A web application that provides a user interface for
  interacting with Contentful software.
- `webhook` - An HTTP callback sent when data in Contentful changes.

Do not introduce glossary terms for unrelated Contentful products unless the document actually
integrates with those products or the term helps future maintainers understand a cross-product
relationship.

## Word choice

Prefer clear, direct words:

- Use `use`, not `utilize` or `leverage`.
- Use `log in to`, not `log into` or `login to`.
- Use `version` or lowercase `v` for an abbreviated version.

Reduce adjectives and adverbs that do not add concrete information. Either remove them or replace
them with specifics.

Avoid vague intensifiers unless the sentence gives a specific measure or explanation:

- fast
- fastly
- simple
- simply
- easy
- easily
- efficient
- efficiently
- effective
- effectively
- quick
- quickly
- quite
- very

## Modal verbs

Use modal verbs consistently:

- Use `can` for an option, permission, or possibility.
- Use `must` for a requirement.
- Use `might` for an uncertain outcome.
- Use `we recommend` for a recommendation.

Avoid these modal verbs in public documentation when one of the terms above is clearer:

- `should` - Use `must`, `can`, or `we recommend`.
- `could` - Use `can`.
- `would` - Use present tense or `can`.
- `may` - Use `can`.

## UI labels and actions

- Spell UI labels exactly as they appear in the UI.
- Preserve UI capitalization, title case, punctuation, and spelling.
- Bold UI labels when the reader interacts with them.
- Use regular text when a UI label is mentioned only for context and no action is applied to it.
- Use `click` for desktop buttons and controls used with a mouse or trackpad.
- Use `tap` for mobile controls.
- Use `enter` for adding text to a field.
- Use `select` for choosing one or multiple options, choosing list items, marking checkboxes, and
  checking radio buttons.
- Use `go to` or `navigate to` for tabs, screens, pages, entities in a list, websites, and apps. Use
  `go to` for websites and apps.
- Avoid `hit`, `pick`, `choose`, `open`, and `type` when one of the standard verbs above is more
  precise.

## Procedures

- Use a procedure for a sequence of actions the reader must perform to complete a task.
- Introduce the procedure with the goal, prerequisite, or context the reader needs before starting.
- Use numbered lists for the steps.
- Start each step with an imperative verb.
- Keep one primary action per step when possible.
- Bold UI labels only when the step requires interaction with that UI element.
- Use `Optional` or `Mandatory` labels only when the distinction changes what the reader must do.
- State the result of a step when the result helps the reader confirm progress. The standard result
  phrasing can use passive voice, such as "The entry editor is displayed."
- Use nested bullets inside a step only for choices, options, or a hierarchy that belongs to that
  step.

## Lists

- Use numbered lists only for ordered steps.
- Use bulleted lists for related items, options, capabilities, unordered requirements, or sets where
  order does not matter.
- Do not use a numbered list for a set of related items.
- Do not use a bulleted list for a sequence of steps.
- Precede a list with an opening sentence that ends with a colon when the list completes or expands
  that sentence.
- Keep list items parallel.
- Start each list item with a capital letter.
- End complete-sentence list items with a period.
- Use fragments without periods only when every item in the list is a short fragment.
- For named option lists, use `- **Name** - Description.` Capitalize the name, bold it, add a
  hyphen, start the description with a capital letter, and end the item with a period.
- In numbered steps, start each item with a capital letter and end it with a period.
- If a step begins with `Optional` or `Mandatory`, bold that label and follow it with a colon.
- Use a bulleted list inside a numbered step for options that belong to that step.
- Use multiple-level bulleted lists only for true hierarchies.
- Avoid deep nesting when a table or separate section would be easier to scan.

## Tables

Use a table when similar items have characteristics that fit shared columns. Do not use a table when
a short list or paragraph is easier to scan.

- Precede a table with an opening sentence that ends with a colon when the table completes or
  expands that sentence.
- Include a header row.
- Keep column names short.
- Bold item names in the first column when that helps the reader scan the table.
- Apply the same punctuation, note, list, and code-formatting rules inside table cells that apply in
  the rest of the document.
- Use complete sentences in cells only when the detail needs sentence form.
- End complete sentences in table cells with periods.
- Do not put periods in table headings or short table-cell fragments.

## Notes and admonitions

Use GitHub admonitions for notes, warnings, and important information:

```md
> [!NOTE]
>
> Use a note for helpful context that is not required to complete the task.
```

- Use notes to highlight information that is not structurally part of the surrounding prose but is
  important for the reader to notice.
- Use `IMPORTANT` when the reader must act on the information to complete the documented goal.
- Use `WARNING` or `CAUTION` for destructive, unsafe, pre-release-sensitive, or otherwise risky
  flows.
- Use one idea per admonition.
- If an admonition must contain multiple ideas, separate them into separate paragraphs.
- Do not use block quotes only for visual emphasis.

## Links

- Add links when the reader needs more context to understand the document or when another document
  owns deeper implementation details.
- Link the exact phrase that needs context or the exact document title.
- Avoid vague link text such as `here`, `this page`, or raw URLs.
- Link to source-of-truth repository files, generated reference docs, package READMEs,
  implementation READMEs, or authored docs as required by the nearest `AGENTS.md`.
- Verify relative links when adding, moving, or renaming documents.
- Do not use links as a replacement for essential context. The reader must understand the current
  document's purpose without following every link.

## Code, commands, and examples

- Use fenced code blocks with language tags.
- Use inline code for package names, commands, file paths, environment variables, code identifiers,
  API names, literal values, and placeholders.
- Prefer `pnpm` commands and repository wrapper scripts.
- Keep examples minimal but complete enough to run or adapt.
- Keep code examples aligned with package exports and current SDK behavior.
- Do not mix API reference detail into guides or READMEs when generated TypeDoc owns that detail.
- Do not use npm, Yarn, or undocumented global-tool commands unless the surrounding repo guidance
  explicitly requires them.

## Quotation marks

- Use double quotation marks for direct quotations.
- Use double quotation marks around proper names of entities or records in Contentful when the
  context needs quotation marks for clarity.
- Use single quotation marks only for a quotation nested inside another quotation.
- Do not use quotation marks around UI labels only to distinguish them from prose. Use bold
  formatting for actionable UI labels.

## Periods

Use a period:

- At the end of a complete sentence, unless it is a question.
- At the end of a complete-sentence list item.
- At the end of a complete sentence in a table cell.
- At the end of table-cell content that mixes fragments and complete sentences.
- As a decimal point.

Do not use a period:

- In headings.
- In UI labels.
- In table headings.
- In table-cell fragments that are not complete sentences.
- In short list fragments when every item in the list is a fragment.

## Hyphens and dashes

- Use a hyphen for compound adjectives before a noun when the hyphen improves clarity.
- Do not hyphenate a compound adjective when it appears after the noun.
- The source Contentful guide allows a spaced em dash for a sentence break. In this repository,
  prefer commas, parentheses, colons, or sentence breaks unless the surrounding document already
  uses em dashes intentionally.
- Do not use an en dash.
- For date or number ranges, use `to` when that is clearer than a hyphen.

## Commas

- Use the serial comma before the final `and` or `or` in a series of three or more items.
- For comma cases not covered here, follow the Google Developer Documentation Style Guide.

## Alternatives

- Use `and/or` only when both separate and combined options are valid.
- Do not use a slash to separate alternatives unless the term is an established technical form.
- Use `and` or `or` when only one meaning applies.
- Do not put optional plurals in parentheses, such as `role(s)`.
- Use singular or plural consistently.
- If both singular and plural matter, use `one or multiple`.

## Contractions

- Use negative contractions such as `don't`, `can't`, and `aren't` when they improve readability.
  They are harder to misread than `do not`, `cannot`, or `are not`.
- Avoid noun-plus-verb contractions such as `you're`, `we'll`, and `they're` in formal docs.
- `It's` and `it is` are both acceptable when they read naturally.
- Do not confuse possessive `its` with the noun-plus-verb phrase `it's`.

## Fractions and decimals

- Spell out fractions fully when they are concise.
- If a fraction cannot be written concisely, use a decimal number.
- Limit decimals to three places or fewer.
- Write decimals only when the number after the decimal point is greater than zero.

## Numbers

- Spell out zero through nine unless referring to a numbered step, version, dimension, or literal
  value where digits are clearer.
- Use digits for 10 and higher.
- Use digits for measurements, versions, command arguments, option values, ports, HTTP status codes,
  IDs, and other technical literals.

## Capitalization

- Use sentence-style capitalization in prose.
- Capitalize the first letter of a sentence.
- Capitalize official product names, company names, API names, package names, and proper nouns
  exactly as they are officially written.
- Preserve product casing such as `iPad` or `iA Writer` when a product name begins with a lowercase
  letter.
- Capitalize UI labels exactly as they appear in the UI.
- Capitalize the first word of each list item.
- Capitalize the first word of a named list-item description.
- Capitalize the first word in every table cell.
- Do not capitalize general Contentful concepts such as spaces, content types, entries,
  environments, assets, locales, roles, tags, web publishing tools, or space templates unless they
  begin a sentence or appear in a UI label.
