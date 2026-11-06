import * as z from 'zod/mini'
import { GeoLocation } from '../event/properties'
import { Traits } from '../event/properties/Traits'
import { SessionStatistics } from './properties'

/**
 * Zod schema describing a user profile returned by the Experience API and sent to Insights.
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
   * List of audience identifiers that this profile belongs to.
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

  /**
   * Data-residency jurisdiction of the profile's storage, when the Experience API reports it.
   *
   * @remarks
   * Set by the Experience API host the profile was written through
   * (`experience.eu.ninetailed.co` stores it in the EU).
   */
  jurisdiction: z.optional(z.enum(['US', 'EU'])),
})

/**
 * TypeScript type inferred from {@link Profile}.
 *
 * @public
 */
export type Profile = z.infer<typeof Profile>
