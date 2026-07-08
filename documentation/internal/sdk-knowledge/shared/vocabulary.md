# Shared vocabulary (web family)

Canonical term → one-line meaning. Use verbatim across the web-family guides so they do not drift.
Facts only; source pointers where a term maps to a concrete symbol.

| Term                     | One-line meaning                                                                                                                            | source                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| variant                  | An authored alternative of an entry.                                                                                                        | product concept                                    |
| experience               | A rule that decides which visitors see which variant.                                                                                       | product concept                                    |
| Experience API           | Contentful service that, per request/visitor, picks the variant for each experience.                                                        | product concept                                    |
| resolving (an entry)     | Swapping a fetched entry for its picked variant (or leaving the original when none applies).                                                | product concept                                    |
| baseline fallback        | The original entry the render prop receives when no variant applies, consent is denied, links are unresolved, or the payload is all-locale. | react-web `OptimizedEntry`                         |
| consent                  | Permission for the SDK to personalize and send events for this visitor.                                                                     | factory `defaults.consent`                         |
| persistenceConsent       | Permission for the SDK to store the profile-id cookie so results stay consistent.                                                           | factory `defaults.persistenceConsent`              |
| profile                  | The anonymous id the SDK uses to keep the same visitor consistent across requests.                                                          | cookie `ctfl-opt-aid` (`core-sdk/constants.ts:38`) |
| page event               | A signal that a page/route was viewed, emitted as the visitor navigates.                                                                    | react-web auto-page trackers                       |
| browser takeover         | After first paint, the browser SDK owns personalization from the server-resolved state.                                                     | react-web `OptimizationRoot`                       |
| live updates             | Opt-in re-resolution of entries after load when consent/identity/profile change, without a reload.                                          | react-web `LiveUpdatesProvider`                    |
| you-fetch / SDK-resolves | The boundary: the app fetches Contentful entries; the SDK only resolves them. See concepts.                                                 | see `concepts.md`                                  |

</content>
