import { array, number, object, string, type infer as zInfer } from 'zod/mini'
import { GeoLocation } from '../event/properties'
import { SessionStatistics } from './properties'
import { Traits } from '../event/properties/Traits'

export const Profile = object({
  id: string(),
  stableId: string(),
  random: number(),
  audiences: array(string()),
  traits: Traits,
  location: GeoLocation,
  session: SessionStatistics,
})
export type ProfileType = zInfer<typeof Profile>
