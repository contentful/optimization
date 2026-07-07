# `## Before you start` — what belongs here

This section replaces the old mandated "Required setup" table. That table failed the reader: ~20
rows with `Category` and `Required for quick start` columns that described the _document's_
structure, and most rows just restated a walkthrough step or pointed at a later section. A newcomer
met the entire production surface before writing a line of code — the exact overwhelm the guides are
meant to avoid.

## The rule

List only what the reader must **gather from outside the guide** before they begin. If a sequenced
section teaches it, it does not go here. The feature sections own "where to configure."

Include, at most:

- **Runtime prerequisites** — the framework/app and its peer dependencies, and that the reader's own
  Contentful fetching already works.
- **Credentials** — the delivery/API tokens, space, environment, and Optimization project values the
  reader retrieves from a dashboard or settings, not from this guide.
- **Authored Contentful data** — the content the reader must create so the integration has something
  to do. See the gotcha below; every SDK guide must include it.
- **A one-line env-var convention note** — tell the reader to match the prefix/convention their app
  already uses for browser-visible variables, and keep it consistent. Do not invent a convention
  that conflicts with real apps.

Close with one sentence: everything else is introduced by the section that needs it; there is no
setup inventory to work through up front.

## The authored-variant gotcha (mandatory in every guide)

Without an authored variant attached to an experience, the integration runs but every visitor sees
the baseline — so the reader cannot tell working personalization from a bug, and concludes it is
broken. State plainly that they must author at least one variant + experience, and that for a first
test an **experience targeting all visitors** is easiest because they match it automatically. This
ties directly to the quick start's verify step.

## Anti-patterns

- A multi-column setup-inventory table.
- Rows that restate quick-start steps ("mount the root", "install the package").
- Rows that only say "there is a section for this below" — the TOC already does that.
- `Category` / `Required for quick start` columns — they describe the doc, not the reader's task.
- Listing values the quick start never uses as if they are required up front (e.g. an API base URL
  that defaults correctly). If it defaults, say so and defer it.

## Shape to copy

```md
## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **<runtime prerequisite>.**
- **<credentials>.**
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant the integration still runs, but every visitor sees the baseline, so you cannot
  tell personalization from a bug. For a first test, an experience that targets all visitors is
  easiest to verify because you match it automatically.
- **<Optimization project values>** — <which default, which you must set>.

You do not need a setup inventory up front. Everything else is introduced by the section that needs
it.

> [!NOTE]
>
> <one-line env-var-convention note>
```
