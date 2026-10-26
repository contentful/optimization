<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Astro + React Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

Exploratory hybrid web app using `@contentful/optimization-node` for request-time personalization
and `@contentful/optimization-react-web` for hydration, browser personalization, and analytics.
Read the [compatibility and developer experience report](./COMPATIBILITY.md) for findings and limits.

## What this covers

| Surface             | Behavior                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/`                 | On-demand Node rendering with a private request handoff and personalized first paint after consent.                 |
| `/static`           | Prerendered baseline HTML with personalization after React hydration and consent.                                   |
| React island        | One `OptimizationRoot` owns the browser SDK, entry rendering, and interaction tracking.                             |
| Other React content | An independent counter island hydrates without creating another SDK instance.                                       |
| Consent             | Explicit allow and withdraw controls synchronize an application cookie with SDK event and persistence consent.      |
| Analytics           | Prepared page replay, ordinary page tracking, identification, a custom CTA event, and automatic entry interactions. |
| Navigation          | Ordinary links load complete documents and preserve the SDK identity cookie after consent.                          |

Astro uses `output: 'static'` with the Node adapter and an explicit `prerender = false` on the
personalized route. `output: 'hybrid'` is not a valid setting in the Astro version used here.
The app deliberately uses full-document navigation; Astro ClientRouter is outside this exploration.

## CDA locale handling

`fetchBaseline()` fetches one entry with linked variants using `include: 10` and `locale: 'en-US'`.
The SDK uses the same locale. Application-owned fetching keeps the CDA token on the server and
passes a serializable baseline entry to the React island. Do not use `locale=*` or
`withAllLocales` for SDK entry resolution. The static route fetches its baseline at build time;
CDA availability is therefore a build prerequisite.

## Prerequisites

- The Node version in the repository `.nvmrc` and the pnpm version in the root `package.json`.
- Root dependencies installed with `pnpm install`.
- Shared mock data already present, as for the other web implementations.
- Chromium installed for the focused browser suite.

The example environment points only at local mock APIs. To use a Contentful space, replace the
space, environment, CDA token, and baseline entry ID, remove the mock CDA host/base path, and remove
the mock Experience and Insights URL overrides. The example entry must contain Optimization
metadata and linked variants. The **Identify example visitor** control uses a fixed illustrative
user ID; replace it with the application's authenticated identity integration when adapting the app.

## Setup

From the repository root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- astro-react implementation:install
test -f implementations/astro-react/.env || cp implementations/astro-react/.env.example implementations/astro-react/.env
```

Implementation dependencies consume local SDK tarballs through `pnpm-workspace.yaml` overrides,
including transitive SDK dependencies. Rebuild and reinstall after SDK changes.

## Running locally

Start the mock server in one terminal:

```sh
pnpm serve:mocks
```

Start the app in another terminal:

```sh
pnpm implementation:run -- astro-react dev
```

Open [the app](http://127.0.0.1:4321). Initially, content remains at baseline and events are blocked.
Select **Allow personalization and analytics** to reload with consent. On `/`, the response contains
personalized HTML; on `/static`, baseline HTML changes after hydration. Select **Explore this offer**
to emit a custom event and automatically track the entry click. The event log shows accepted SDK
events; acceptance alone does not prove delivery to the API. Select **Withdraw consent** to clear
SDK continuity and reload at baseline.

For a production build, keep the mock server running, then run:

```sh
pnpm implementation:run -- astro-react build
pnpm implementation:run -- astro-react serve
```

Stop foreground commands with Ctrl+C in their own terminals. This implementation does not use PM2.
The production server reads `.env` using Node's `--env-file`; Astro also reads `.env` when building.
`PUBLIC_` values are included in the client bundle, so rebuild when changing them. Keep CDA
credentials in the non-public `CONTENTFUL_TOKEN` variable.

## Running E2E tests

```sh
pnpm implementation:run -- astro-react typecheck
pnpm implementation:run -- astro-react lint
pnpm implementation:run -- astro-react test:e2e
```

The focused Chromium suite starts mocks, builds the production app (including the static page),
starts the Node server, and cleans up its child servers. Port 4321 must be available. It may reuse
an existing local mock server on port 8000. If Chromium is missing, install that confirmed prerequisite:

```sh
pnpm implementation:run -- astro-react implementation:playwright:install -- chromium
```

This exploration has a small local smoke suite rather than the shared web scenario matrix. It does
not add a dedicated Astro E2E job to CI. Aggregate implementation installation and lint discover
the app automatically; repository formatting includes Astro files.

## Related

- [Compatibility and developer experience report](./COMPATIBILITY.md)
- [Node SDK](../../packages/node/node-sdk/README.md)
- [React Web SDK](../../packages/web/frameworks/react-web-sdk/README.md)
- [Node + Web reference implementation](../node-sdk+web-sdk/README.md)
- [React Web reference implementation](../react-web-sdk/README.md)
- [Shared mocks](../../lib/mocks/README.md)
- [Astro on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
