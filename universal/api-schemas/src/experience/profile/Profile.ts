import * as z from 'zod/mini'
import { GeoLocation } from '../event/properties'
import { Traits } from '../event/properties/Traits'
import { SessionStatistics } from './properties'

// Received from the Experience API
export const Profile = z.object({
  id: z.string(),
  stableId: z.string(),
  random: z.number(),
  audiences: z.array(z.string()),
  traits: Traits,
  location: GeoLocation,
  session: SessionStatistics,
})
export type Profile = z.infer<typeof Profile>

// Used for sending events to the Experience & Insights APIs
export const PartialProfile = z.catchall(
  z.object({
    id: z.string(),
  }),
  z.json(),
)
export type PartialProfile = z.infer<typeof PartialProfile>
