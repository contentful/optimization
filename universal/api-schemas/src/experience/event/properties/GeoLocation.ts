import * as z from 'zod/mini'

const COUNTRY_CODE_LENGTH = 2

const Coordinates = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

export const GeoLocation = z.object({
  coordinates: z.optional(Coordinates),
  city: z.optional(z.string()),
  postalCode: z.optional(z.string()),
  region: z.optional(z.string()),
  regionCode: z.optional(z.string()),
  country: z.optional(z.string()),
  countryCode: z.optional(z.string().check(z.length(COUNTRY_CODE_LENGTH))),
  continent: z.optional(z.string()),
  timezone: z.optional(z.string()),
})
export type GeoLocation = z.infer<typeof GeoLocation>
