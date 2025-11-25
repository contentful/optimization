import * as z from 'zod/mini'

/**
 * Zod schema describing app-level properties.
 *
 * @remarks
 * These properties typically describe the application that is emitting
 * analytics events, such as its name and version.
 *
 * The entire object is optional; when omitted, no app context is attached.
 */
export const App = z.optional(
  z.object({
    /**
     * Name of the application.
     */
    name: z.string(),

    /**
     * Version of the application.
     */
    version: z.string(),
  }),
)

/**
 * TypeScript type inferred from {@link App}.
 */
export type App = z.infer<typeof App>
