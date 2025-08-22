import { length, number, object, optional, string, type infer as zInfer } from 'zod/mini'

const COUNTRY_CODE_LENGTH = 2

const Coordinates = object({
  latitude: number(),
  longitude: number(),
})

export const GeoLocation = object({
  coordinates: optional(Coordinates),
  city: optional(string()),
  postalCode: optional(string()),
  region: optional(string()),
  regionCode: optional(string()),
  country: optional(string()),
  countryCode: optional(string().check(length(COUNTRY_CODE_LENGTH))),
  continent: optional(string()),
  timezone: optional(string()),
})
export type GeoLocationType = zInfer<typeof GeoLocation>
