import { createClient, type ContentfulClientApi, type Entry, type EntryQueries } from 'contentful'
import { logger } from '../lib/logger'
import { OptimizationMapper } from '../personalization/mappers'
import { isOptimizedEntry } from '../personalization/mappers/entry'
import { EntryReplacementSelector } from '../personalization/selectors'
import { variants as variantsSignal } from '../signals'

export interface ContentfulClientConfig {
  contentEnv: string
  contentSpaceId: string
  contentToken: string
}

// TODO: Better typing
class Content {
  readonly client: ContentfulClientApi<undefined>

  constructor(config: ContentfulClientConfig) {
    this.client = createClient({
      accessToken: config.contentToken,
      environment: config.contentEnv,
      space: config.contentSpaceId,
    })
  }

  async getPersonalizedEntry(
    id: string,
    query?: EntryQueries<undefined>,
  ): Promise<Entry | undefined> {
    try {
      const baseline = await this.client.getEntry(id, {
        ...query,
        include: 10,
      })
      logger.debug(`[Personalization] Entry fetched for ID ${id} and query`, query, ':', baseline)

      return Content.resolvePersonalizedEntry(baseline)
    } catch (error) {
      logger.error(
        `[Personalization] Entry for ID ${id} and query`,
        query,
        'could not be found',
        error instanceof Error ? error.message : error,
      )
    }
  }

  async findPersonalizedEntry(query: EntryQueries<undefined>): Promise<Entry | undefined> {
    const entries = await this.client.getEntries({
      ...query,
      include: 10,
      limit: 1,
    })
    logger.debug('[Personalization] Entries fetched for query', query, ':', entries)

    const {
      items: [baseline],
    } = entries

    if (!baseline) {
      logger.error(`[Personalization] Entry for query`, query, 'could not be found')
      return
    }

    return Content.resolvePersonalizedEntry(baseline)
  }

  // TODO: Reduce some steps?
  // TODO: Determine necessary integration points?
  static resolvePersonalizedEntry(baseline: Entry): Entry {
    // Ensure the entry is optimized
    if (!isOptimizedEntry(baseline)) return baseline
    logger.debug(`[Personalization] Entry ${baseline.sys.id} is optimized`)

    // Gather possible optimization configuraitons from the entry
    const optimizationConfigs = baseline.fields.nt_experiences
      .filter((entry) => OptimizationMapper.isOptimizationEntry(entry))
      .map((entry) => OptimizationMapper.mapOptimization(entry))
    logger.debug(`[Personalization] Entry ${baseline.sys.id} optimizations`, optimizationConfigs)

    // Ensure we have selected variant configurations loaded from the Experiences API
    const { value: variantConfigs } = variantsSignal
    logger.debug(`[Personalization] Current selected variants`, variantConfigs)

    if (!variantConfigs) return baseline

    // Find the first variant configuration that matches an optimization configuration
    const optimizationConfig = optimizationConfigs.find((experience) =>
      variantConfigs.some(
        (selectedExperience) => selectedExperience.experienceId === experience.id,
      ),
    )
    logger.debug(
      `[Personalization] Entry ${baseline.sys.id} optimization configuration`,
      optimizationConfig,
    )

    // Find the variant configuration that matches the optimization configuration
    const variantConfig = variantConfigs.find(
      ({ experienceId }) => experienceId === optimizationConfig?.id,
    )
    logger.debug(
      `[Personalization] Selected optimization for configured optimization ID ${optimizationConfig?.id}`,
      variantConfig,
    )

    if (!optimizationConfig || !variantConfig) return baseline

    const { sticky } = variantConfig

    optimizationConfig.sticky = sticky

    // Select all variants relevant to the optimization configuration
    const relevantVariants = EntryReplacementSelector.selectRelevantVariants(
      optimizationConfig,
      baseline,
    )
    logger.debug(`[Personalization] Relevant variants`, relevantVariants)

    if (!relevantVariants.length) return baseline

    const { variantIndex } = variantConfig

    // Get the variant at the configured variant index
    const personalizedEntry = [baseline, ...relevantVariants].at(variantIndex)
    logger.debug(`[Personalization] Personalized entry`, personalizedEntry)

    if (!personalizedEntry) return baseline

    return personalizedEntry
  }
}

export default Content
