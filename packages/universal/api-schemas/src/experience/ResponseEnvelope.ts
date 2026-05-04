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
   * Indicates whether an error occurred.
   *
   * @remarks
   * Can be `null` when the error state is unknown or not applicable.
   */
  error: z.nullable(z.boolean()),
})

/**
 * TypeScript type inferred from {@link ResponseEnvelope}.
 *
 * @public
 */
export type ResponseEnvelope = z.infer<typeof ResponseEnvelope>
