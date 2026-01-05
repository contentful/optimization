import * as z from 'zod/mini'
import { Page } from '../../event/properties'

/**
 * Zod schema describing aggregated statistics for a user session.
 *
 * @remarks
 * Captures both per-session metrics (such as `activeSessionLength`) and
 * aggregate metrics (such as `averageSessionLength`) for a given profile.
 */
export const SessionStatistics = z.object({
  /**
   * Unique identifier for this session statistics record.
   */
  id: z.string(),

  /**
   * Indicates whether the visitor has been seen before.
   *
   * @remarks
   * `true` typically means the visitor has at least one prior session.
   */
  isReturningVisitor: z.boolean(),

  /**
   * Landing page for the session.
   *
   * @remarks
   * Represents the first page the user visited in this session.
   *
   * @see Page
   */
  landingPage: Page,

  /**
   * Number of sessions associated with this profile or identifier.
   *
   * @remarks
   * Often used in combination with {@link SessionStatistics.averageSessionLength}.
   */
  count: z.number(),

  /**
   * Duration of the active session.
   */
  activeSessionLength: z.number(),

  /**
   * Average session duration across all sessions represented by this record.
   *
   * @remarks
   * The unit should match {@link SessionStatistics.activeSessionLength}.
   */
  averageSessionLength: z.number(),
})

/**
 * TypeScript type inferred from {@link SessionStatistics}.
 */
export type SessionStatistics = z.infer<typeof SessionStatistics>
