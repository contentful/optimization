import { z } from 'zod/mini'
import { GeoLocation } from '../event/properties'
import { Traits } from '../event/properties/Traits'
import { SessionStatistics } from './properties'

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
