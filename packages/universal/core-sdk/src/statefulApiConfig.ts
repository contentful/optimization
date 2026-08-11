import type { ApiClientConfig } from '@contentful/optimization-api-client'
import type { CoreStatefulApiConfig } from './CoreApiConfig'

const hasDefinedValues = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => value !== undefined)

export const createStatefulExperienceApiConfig = (
  api: CoreStatefulApiConfig | undefined,
  locale: string | undefined,
): ApiClientConfig['experience'] => {
  if (api === undefined && locale === undefined) return undefined

  const experienceConfig = {
    baseUrl: api?.experienceBaseUrl,
    enabledFeatures: api?.enabledFeatures,
    ip: api?.ip,
    locale,
    plainText: api?.plainText,
    preflight: api?.preflight,
  }

  return hasDefinedValues(experienceConfig) ? experienceConfig : undefined
}

export const createStatefulInsightsApiConfig = (
  api: CoreStatefulApiConfig | undefined,
): ApiClientConfig['insights'] => {
  if (api === undefined) return undefined

  const insightsConfig = { baseUrl: api.insightsBaseUrl }
  return hasDefinedValues(insightsConfig) ? insightsConfig : undefined
}
