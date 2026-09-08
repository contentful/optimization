# Mock server

This private workspace composes the reusable handlers from `mocks` into the HTTP mock server used
by local development and reference implementations. Handler behavior, fixtures, mock state, and
Contentful fixture fetching belong in `lib/mocks`.

Run the server with:

```sh
pnpm --filter mock-server serve
```

To fetch Contentful fixtures, run `pnpm --filter mocks fetch:ctfl` from the repository root. This
package does not provide fixture-fetch commands.
