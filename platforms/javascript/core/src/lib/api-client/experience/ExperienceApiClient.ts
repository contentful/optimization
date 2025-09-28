import { logger } from '../../logger'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'
import {
  BatchExperienceResponse,
  ExperienceResponse,
  type BatchExperienceData,
  type ExperienceRequestData,
  type ExperienceRequestOptions,
  type OptimizationData,
} from './dto'
import { ExperienceEventArray, type BatchExperienceEventArray } from './dto/event'

type Feature = 'ip-enrichment' | 'location'

interface RequestOptions {
  /**
   * Activated features (e.g. "ip-enrichment") which the API should use for this request.
   */
  enabledFeatures?: Feature[]

  /**
   * A ip address to override the API behavior for ip analysis (if used/activated)
   * This is commonly used in ESR or SSR environments, as the API would use the Server IP otherwise
   */
  ip?: string

  /**
   * The locale parameter determines the language to which the location.city & location.country will get translated
   */
  locale?: string

  /**
   * The Ninetailed API accepts the performance critical endpoints in plaintext.
   * By sending plaintext no CORS preflight request is needed.
   * This way the "real" request is sent out much faster.
   */
  plainText?: boolean

  /**
   * Setting the preflight mode will make the api aggregate a new state o the profile,
   * but not store the state.
   * This is commonly used in ESR or SSR environments
   */
  preflight?: boolean
}

interface ProfileMutationRequestOptions {
  url: string
  body: unknown
  options: RequestOptions
}

interface CreateProfileParams {
  events: ExperienceEventArray
}

interface UpdateProfileParams extends CreateProfileParams {
  profileId: string
}

interface UpsertProfileParams extends CreateProfileParams {
  profileId?: string
}

interface BatchUpdateProfileParams {
  events: BatchExperienceEventArray
}

export interface ExperienceApiClientConfig extends ApiConfig, RequestOptions {}

export const EXPERIENCE_BASE_URL = 'https://experience.ninetailed.co/'

export default class ExperienceApiClient extends ApiClientBase {
  protected readonly baseUrl: string
  private readonly enabledFeatures?: RequestOptions['enabledFeatures']
  private readonly ip?: RequestOptions['ip']
  private readonly locale?: RequestOptions['locale']
  private readonly plainText?: RequestOptions['plainText']
  private readonly preflight?: RequestOptions['preflight']

  constructor(config: ExperienceApiClientConfig) {
    super('Experience', config)

    const { baseUrl, enabledFeatures, ip, locale, plainText, preflight } = config

    this.baseUrl = baseUrl ?? EXPERIENCE_BASE_URL
    this.enabledFeatures = enabledFeatures
    this.ip = ip
    this.locale = locale
    this.plainText = plainText
    this.preflight = preflight
  }

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
          `v2/organizations/${this.optimizationKey}/environments/${this.optimizationEnv}/profiles/${id}`,
          options,
        ),
        {
          method: 'GET',
        },
      )

      const {
        data: { changes, experiences, profile },
      } = ExperienceResponse.parse(await response.json())

      const data = { changes, variants: experiences, profile }

      logger.debug(`${this.name} API "${requestName}" request succesfully completed.`)

      return data
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

  private async makeProfileMutationRequest({
    url,
    body,
    options,
  }: ProfileMutationRequestOptions): Promise<Response> {
    return await this.fetch(this.constructUrl(url, options), {
      method: 'POST',
      headers: this.constructHeaders(options),
      body: JSON.stringify(body),
    })
  }

  /**
   * Creates a profile and returns it.
   * Use the given profileId for subsequent update requests.
   * The events will be used to aggregate the new Profile state.
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
        url: `v2/organizations/${this.optimizationKey}/environments/${this.optimizationEnv}/profiles`,
        body,
        options,
      })

      const {
        data: { changes, experiences, profile },
      } = ExperienceResponse.parse(await response.json())

      const data = { changes, variants: experiences, profile }

      logger.debug(`${this.name} API "${requestName}" request succesfully completed.`)

      return data
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

  /**
   * Updates a profile with the given profileId.
   * The events will be used to aggregate the new Profile state.
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
        url: `v2/organizations/${this.optimizationKey}/environments/${this.optimizationEnv}/profiles/${profileId}`,
        body,
        options,
      })

      const {
        data: { changes, experiences, profile },
      } = ExperienceResponse.parse(await response.json())

      const data = { changes, variants: experiences, profile }

      logger.debug(`${this.name} API "${requestName}" request successfully completed.`)

      return data
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }

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
   * Sends multiple events to the Ninetailed API.
   * Every events needs to have a anonymous ID.
   * Profiles will get created or updated according to the set anonymous ID.
   *
   * This method is intended to be used from server environments.
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
        url: `v2/organizations/${this.optimizationKey}/environments/${this.optimizationEnv}/events`,
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
