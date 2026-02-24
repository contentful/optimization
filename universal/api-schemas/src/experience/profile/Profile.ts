import * as z from 'zod/mini'
import { GeoLocation } from '../event/properties'
import { Traits } from '../event/properties/Traits'
import { SessionStatistics } from './properties'

/**
 * Zod schema describing a full user profile as received from the Experience API.
 *
 * @remarks
 * Represents the server-side view of a profile, including identifiers,
 * traits, audiences, location, and session statistics.
 *
 * @public
 */
export const Profile = z.object({
  /**
   * Primary identifier of the profile.
   */
  id: z.string(),

  /**
   * Stable, long-lived identifier of the profile.
   *
   * @remarks
   * Intended to remain constant across sessions and devices when possible.
   * Usually equal to `id`.
   */
  stableId: z.string(),

  /**
   * Random value associated with the profile.
   *
   * @remarks
   * Often used for deterministic bucketing (e.g., in experiments).
   */
  random: z.number(),

  /**
   * List of audience identifiers that this profile currently belongs to.
   */
  audiences: z.array(z.string()),

  /**
   * Traits describing the profile (user-level attributes).
   *
   * @see {@link Traits}
   */
  traits: Traits,

  /**
   * Geo-location information associated with the profile.
   *
   * @see {@link GeoLocation}
   */
  location: GeoLocation,

  /**
   * Aggregated session statistics for the profile.
   *
   * @see {@link SessionStatistics}
   */
  session: SessionStatistics,
})

/**
 * TypeScript type inferred from {@link Profile}.
 *
 * @public
 */
export type Profile = z.infer<typeof Profile>

/**
 * Zod schema describing a partial profile payload used for sending events
 * to the Experience & Insights APIs.
 *
 * @remarks
 * This schema enforces the presence of an `id` field and allows additional
 * JSON-serializable properties via `z.catchall`.
 *
 * @public
 */
export const PartialProfile = z.catchall(
  z.object({
    /**
     * Identifier of the profile.
     *
     * @remarks
     * Used to associate events with an existing profile.
     */
    id: z.string(),
  }),
  z.json(),
)

/**
 * TypeScript type inferred from {@link PartialProfile}.
 *
 * @public
 */
export type PartialProfile = z.infer<typeof PartialProfile>
