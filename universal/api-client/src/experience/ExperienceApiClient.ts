import {
  BatchExperienceResponse,
  ExperienceEventArray,
  ExperienceResponse,
  type BatchExperienceData,
  type BatchExperienceEventArray,
  type ExperienceRequestData,
  type ExperienceRequestOptions,
  type OptimizationData,
} from '@contentful/optimization-api-schemas'
import { logger } from 'logger'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'

/**
 * Default base URL for the Experience API.
 *
 * @public
 */
export const EXPERIENCE_BASE_URL = 'https://experience.ninetailed.co/'

/**
 * Feature flags supported by the Experience API.
 */
type Feature = 'ip-enrichment' | 'location'

/**
 * Options that control how requests to the Experience API are handled.
 */
interface RequestOptions {
  /**
   * Enabled features (for example, `"ip-enrichment"`) which the API should use for this request.
   *
   * @remarks
   * When omitted, a default set of features may be applied.
   */
  enabledFeatures?: Feature[]

  /**
   * IP address to override the API behavior for IP analysis.
   *
   * @remarks
   * Commonly used in ESR or SSR environments, as the API would otherwise use
   * the server IP.
   */
  ip?: string

  /**
   * Locale used to translate `location.city` and `location.country`.
   *
   * @remarks
   * When omitted, a server-side default may be used.
   */
  locale?: string

  /**
   * When `true`, sends performance-critical endpoints in plain text.
   *
   * @remarks
   * The Ninetailed API accepts certain endpoints in plain text to avoid CORS
   * preflight requests, which can improve performance in browser environments.
   */
  plainText?: boolean

  /**
   * When `true`, instructs the API to aggregate a new profile state but not store it.
   *
   * @remarks
   * This is commonly used in ESR or SSR environments where you want to
   * preview the result without persisting changes.
   */
  preflight?: boolean
}

/**
 * Internal options for profile mutation requests.
 *
 * @internal
 */
interface ProfileMutationRequestOptions {
  url: string
  body: unknown
  options: RequestOptions
}

/**
 * Parameters used when creating a profile.
 */
interface CreateProfileParams {
  /**
   * Events used to aggregate the profile state.
   */
  events: ExperienceEventArray
}

/**
 * Parameters used when updating an existing profile.
 */
interface UpdateProfileParams extends CreateProfileParams {
  /**
   * ID of the profile to update.
   */
  profileId: string
}

/**
 * Parameters used when creating or updating a profile.
 */
interface UpsertProfileParams extends CreateProfileParams {
  /**
   * Optional ID of the profile; when omitted, a new profile is created.
   */
  profileId?: string
}

/**
 * Parameters used when performing a batch profile update.
 */
interface BatchUpdateProfileParams {
  /**
   * Batch of events to process.
   */
  events: BatchExperienceEventArray
}

/**
 * Configuration for {@link ExperienceApiClient}.
 */
export interface ExperienceApiClientConfig extends ApiConfig, RequestOptions {}

/**
 * Client for interacting with the Experience API.
 *
 * @public
 *
 * @remarks
 * This client is responsible for reading and mutating Ninetailed profiles
 * using the Experience API.
 *
 * @example
 * ```ts
 * const client = new ExperienceApiClient({
 *   clientId: 'org-id',
 *   environment: 'main',
 * })
 *
 * const profile = await client.getProfile('profile-id')
 * ```
 */
export default class ExperienceApiClient extends ApiClientBase {
  /**
   * Base URL used for Experience API requests.
   */
  protected readonly baseUrl: string

  private readonly enabledFeatures?: RequestOptions['enabledFeatures']
  private readonly ip?: RequestOptions['ip']
  private readonly locale?: RequestOptions['locale']
  private readonly plainText?: RequestOptions['plainText']
  private readonly preflight?: RequestOptions['preflight']

  /**
   * Creates a new {@link ExperienceApiClient} instance.
   *
   * @param config - Configuration for the Experience API client.
   */
  constructor(config: ExperienceApiClientConfig) {
    super('Experience', config)

    const { baseUrl, enabledFeatures, ip, locale, plainText, preflight } = config

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Set default for anything falsey
    this.baseUrl = baseUrl || EXPERIENCE_BASE_URL
    this.enabledFeatures = enabledFeatures
    this.ip = ip
    this.locale = locale
    this.plainText = plainText
    this.preflight = preflight
  }

  /**
   * Retrieves a profile by ID.
   *
   * @param id - The profile ID to retrieve.
   * @param options - Optional request options. `preflight` and `plainText` are not allowed here.
   * @returns The current optimization data for the profile.
   *
   * @throws {@link Error}
   * Thrown if `id` is missing or the underlying request fails.
   *
   * @example
   * ```ts
   * const profile = await client.getProfile('profile-id', {
   *   locale: 'en-US',
   * })
   * ```
   */
  public async getProfile(
    id: string,
    options: Omit<RequestOptions, 'preflight' | 'plainText'> = {},
  ): Promise<OptimizationData> {
    if (!id) throw new Error('Valid profile ID required.')

    const requestName = 'Get Profile'

    logger.info(`Sending ${this.name} API "${requestName}" request.`)

    try {
      const response = await this.fetch(
        this.constructUrl(
          `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${id}`,
          options,
        ),
        {
          method: 'GET',
        },
      )

      const {
        data: { changes, experiences, profile },
      } = ExperienceResponse.parse(await response.json())

      const data = { changes, personalizations: experiences, profile }

      logger.debug(`${this.name} API "${requestName}" request succesfully completed.`)

      return data
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

  /**
   * Sends a POST request to mutate a profile or profiles.
   *
   * @param request - Mutation request options including URL, body, and request options.
   * @returns The raw {@link Response} from the underlying fetch.
   *
   * @internal
   */
  private async makeProfileMutationRequest({
    url,
    body,
    options,
  }: ProfileMutationRequestOptions): Promise<Response> {
    return await this.fetch(this.constructUrl(url, options), {
      method: 'POST',
      headers: this.constructHeaders(options),
      body: JSON.stringify(body),
      keepalive: true,
    })
  }

  /**
   * Creates a profile and returns the resulting optimization data.
   *
   * @param params - Parameters containing the events to aggregate into the profile.
   * @param options - Optional request options.
   * @returns The optimization data for the newly created profile.
   *
   * @remarks
   * The returned profile ID can be used for subsequent update requests.
   *
   * @example
   * ```ts
   * const data = await client.createProfile({
   *   events: [{ type: 'identify', userId: 'user-123' }],
   * })
   * ```
   */
  public async createProfile(
    { events }: CreateProfileParams,
    options: RequestOptions = {},
  ): Promise<OptimizationData> {
    const requestName = 'Create Profile'

    logger.info(`Sending ${this.name} API "${requestName}" request.`)

    const body: ExperienceRequestData = {
      events: ExperienceEventArray.parse(events),
      options: this.constructBodyOptions(options),
    }

    logger.debug(`${this.name} API "${requestName}" request body: `, body)

    try {
      const response = await this.makeProfileMutationRequest({
        url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles`,
        body,
        options,
      })

      const {
        data: { changes, experiences, profile },
      } = ExperienceResponse.parse(await response.json())

      const data = { changes, personalizations: experiences, profile }

      logger.debug(`${this.name} API "${requestName}" request succesfully completed.`)

      return data
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

  /**
   * Updates an existing profile with the given profile ID.
   *
   * @param params - Parameters including the profile ID and events.
   * @param options - Optional request options.
   * @returns The updated optimization data for the profile.
   *
   * @throws {@link Error}
   * Thrown if `profileId` is missing or the underlying request fails.
   *
   * @example
   * ```ts
   * const data = await client.updateProfile({
   *   profileId: 'profile-id',
   *   events: [{ type: 'track', event: 'viewed_video' }],
   * })
   * ```
   */
  public async updateProfile(
    { profileId, events }: UpdateProfileParams,
    options: RequestOptions = {},
  ): Promise<OptimizationData> {
    if (!profileId) throw new Error('Valid profile ID required.')

    const requestName = 'Update Profile'

    logger.info(`Sending ${this.name} API "${requestName}" request.`)

    const body: ExperienceRequestData = {
      events: ExperienceEventArray.parse(events),
      options: this.constructBodyOptions(options),
    }

    logger.debug(`${this.name} API "${requestName}" request Body: `, body)

    try {
      const response = await this.makeProfileMutationRequest({
        url: `v2/organizations/${this.clientId}/environments/${this.environment}/profiles/${profileId}`,
        body,
        options,
      })

      const {
        data: { changes, experiences, profile },
      } = ExperienceResponse.parse(await response.json())

      const data = { changes, personalizations: experiences, profile }

      logger.debug(`${this.name} API "${requestName}" request successfully completed.`)

      return data
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

  /**
   * Creates or updates a profile depending on whether a `profileId` is provided.
   *
   * @param params - Parameters including optional profile ID and events.
   * @param options - Optional request options.
   * @returns The resulting optimization data.
   *
   * @example
   * ```ts
   * // Create
   * await client.upsertProfile({ events })
   *
   * // Update
   * await client.upsertProfile({ profileId: 'profile-id', events })
   * ```
   */
  public async upsertProfile(
    { profileId, events }: UpsertProfileParams,
    options?: RequestOptions,
  ): Promise<OptimizationData> {
    if (!profileId) {
      return await this.createProfile({ events }, options)
    } else {
      return await this.updateProfile({ profileId, events }, options)
    }
  }

  /**
   * Sends multiple events to the Ninetailed Experience API to upsert many profiles.
   *
   * @param params - Parameters containing the batch of events.
   * @param options - Optional request options.
   * @returns The list of profiles affected by the batch operation.
   *
   * @remarks
   * Every event must contain an anonymous ID. Profiles will be created or
   * updated according to the anonymous ID.
   *
   * This method is intended to be used from server environments.
   *
   * @example
   * ```ts
   * const profiles = await client.upsertManyProfiles({
   *   events: [
   *     [{ type: 'identify', userId: 'user-1' }],
   *     [{ type: 'identify', userId: 'user-2' }],
   *   ],
   * })
   * ```
   */
  public async upsertManyProfiles(
    { events }: BatchUpdateProfileParams,
    options: RequestOptions = {},
  ): Promise<BatchExperienceData['profiles']> {
    const requestName = 'Upsert Many Profiles'

    logger.info(`Sending ${this.name} API "${requestName}" request.`)

    const body: ExperienceRequestData = {
      events: ExperienceEventArray.parse(events),
      options: this.constructBodyOptions(options),
    }

    logger.debug(`${this.name} API "${requestName}" request Body: `, body)

    try {
      const response = await this.makeProfileMutationRequest({
        url: `v2/organizations/${this.clientId}/environments/${this.environment}/events`,
        body,
        options: { plainText: false, ...options },
      })

      const {
        data: { profiles },
      } = BatchExperienceResponse.parse(await response.json())

      logger.debug(`${this.name} API "${requestName}" request successfully completed.`)

      return profiles
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

  /**
   * Constructs a request URL with query parameters derived from request options.
   *
   * @param path - Path relative to the Experience API base URL.
   * @param options - Request options that may influence query parameters.
   * @returns The fully constructed URL as a string.
   *
   * @internal
   */
  private constructUrl(path: string, options: RequestOptions): string {
    const url = new URL(path, this.baseUrl)
    const locale = options.locale ?? this.locale
    const preflight = options.preflight ?? this.preflight

    if (locale) {
      url.searchParams.set('locale', locale)
    }

    if (preflight) {
      url.searchParams.set('type', 'preflight')
    }

    return url.toString()
  }

  /**
   * Constructs request headers based on request options and default configuration.
   *
   * @param options - Request options that may influence headers.
   * @returns A record of HTTP headers to send with the request.
   *
   * @internal
   */
  private constructHeaders({
    ip = this.ip,
    plainText = this.plainText,
  }: RequestOptions): Record<string, string> {
    const headers = new Map<string, string>()

    if (ip) {
      headers.set('X-Force-IP', ip)
    }

    if (plainText ?? this.plainText ?? true) {
      headers.set('Content-Type', 'text/plain')
    } else {
      headers.set('Content-Type', 'application/json')
    }

    return Object.fromEntries(headers)
  }

  /**
   * Constructs the `options` section of the request body for profile mutations.
   *
   * @param options - Request options that may specify enabled features.
   * @returns Experience API body options including feature flags.
   *
   * @internal
   */
  private readonly constructBodyOptions = ({
    enabledFeatures = this.enabledFeatures,
  }: RequestOptions): ExperienceRequestOptions => {
    const bodyOptions: ExperienceRequestOptions = {}

    if (enabledFeatures && Array.isArray(enabledFeatures) && enabledFeatures.length > 0) {
      bodyOptions.features = enabledFeatures
    } else {
      bodyOptions.features = ['ip-enrichment', 'location']
    }

    return bodyOptions
  }
}
