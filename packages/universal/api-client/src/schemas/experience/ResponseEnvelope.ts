import * as z from 'zod/mini'

/**
 * Zod schema describing the common envelope structure of responses
 * from the Experience API.
 *
 * @remarks
 * Concrete responses extend this schema and refine the `data` property
 * to a more specific shape.
 *
 * @public
 */
export const ResponseEnvelope = z.object({
  /**
   * Response payload.
   *
   * @remarks
   * The base schema uses an empty object; specific responses extend this
   * with more detailed structures.
   */
  data: z.object(),

  /**
   * Human-readable message accompanying the response.
   */
  message: z.string(),

  /**
   * Error details, or `null` when the request succeeded.
   */
  error: z.nullable(z.object({ code: z.string() })),
})

/**
 * TypeScript type inferred from {@link ResponseEnvelope}.
 *
 * @public
 */
export type ResponseEnvelope = z.infer<typeof ResponseEnvelope>
