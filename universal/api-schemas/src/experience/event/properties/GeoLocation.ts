import * as z from 'zod/mini'

/**
 * Length (in characters) of the expected country code.
 *
 * @remarks
 * Typically corresponds to ISO 3166-1 alpha-2 country codes.
 */
const COUNTRY_CODE_LENGTH = 2

/**
 * Zod schema describing geographical coordinates.
 *
 * @remarks
 * Latitude and longitude are expressed in decimal degrees.
 */
const Coordinates = z.object({
  /**
   * Latitude component of the coordinates.
   */
  latitude: z.number(),

  /**
   * Longitude component of the coordinates.
   */
  longitude: z.number(),
})

/**
 * Zod schema describing geo-location properties associated with an event.
 *
 * @remarks
 * All properties are optional and may be derived from IP or device data.
 */
export const GeoLocation = z.object({
  /**
   * Geographical coordinates for the location.
   */
  coordinates: z.optional(Coordinates),

  /**
   * City name associated with the location.
   */
  city: z.optional(z.string()),

  /**
   * Postal or ZIP code associated with the location.
   */
  postalCode: z.optional(z.string()),

  /**
   * Region or state name associated with the location.
   */
  region: z.optional(z.string()),

  /**
   * Region or state code associated with the location.
   */
  regionCode: z.optional(z.string()),

  /**
   * Country name associated with the location.
   */
  country: z.optional(z.string()),

  /**
   * Country code associated with the location.
   *
   * @remarks
   * Validated to exactly COUNTRY_CODE_LENGTH characters, typically
   * an ISO 3166-1 alpha-2 code.
   */
  countryCode: z.optional(z.string().check(z.length(COUNTRY_CODE_LENGTH))),

  /**
   * Continent name associated with the location.
   */
  continent: z.optional(z.string()),

  /**
   * Time zone identifier associated with the location.
   *
   * @remarks
   * Typically an IANA time zone string (e.g., `"Europe/Berlin"`).
   */
  timezone: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link GeoLocation}.
 */
export type GeoLocation = z.infer<typeof GeoLocation>
