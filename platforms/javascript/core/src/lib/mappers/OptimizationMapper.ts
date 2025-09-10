import { logger } from '../logger'
import AudienceMapper from './AudienceMapper'
import {
  type Entry,
  type EntryReplacementVariant,
  ExperimentEntry,
  isEntryReplacementComponent,
  isInlineVariableComponent,
  OptimizationEntry,
  PersonalizationEntry,
} from './entry'
import type { OptimizationConfig } from './optimization'

const OptimizationMapper = {
  isOptimizationEntry(entry: Entry): entry is OptimizationEntry {
    return OptimizationEntry.safeParse(entry).success
  },

  isExperimentEntry(entry: OptimizationEntry): entry is ExperimentEntry {
    return ExperimentEntry.safeParse(entry).success
  },

  isPersonalizationEntry(entry: OptimizationEntry): entry is PersonalizationEntry {
    return PersonalizationEntry.safeParse(entry).success
  },

  mapOptimization(entry: OptimizationEntry): OptimizationConfig {
    const parsedEntry = OptimizationEntry.safeParse(entry)

    if (!parsedEntry.success) {
      logger.warn(
        '[OptimizationMapper]',
        'Error parsing optimization entry',
        parsedEntry.error.message,
      )
      throw new Error(
        `[OptimizationMapper] The optimization entry is not valid. Please filter data first with "OptimizationMApper.isOptimizationEntry".\n${JSON.stringify(
          parsedEntry.error.message,
          null,
          2,
        )}`,
      )
    }

    const {
      data: {
        sys: { id },
        fields: {
          nt_audience: audience,
          nt_config: config,
          nt_description: description,
          nt_name: name,
          nt_type: type,
          nt_variants: variants,
        },
      },
    } = parsedEntry

    const { components, traffic, sticky, distribution } = config ?? {}

    return {
      id,
      type,
      name,
      ...(description ? { description } : {}),
      ...(audience ? { audience: AudienceMapper.mapAudience(audience) } : {}),
      trafficAllocation: traffic ?? 0,
      distribution:
        distribution?.map((_percentage, index) => ({
          index,
          start: distribution.slice(0, index).reduce((a, b) => a + b, 0),
          end: distribution.slice(0, index + 1).reduce((a, b) => a + b, 0),
        })) ?? [],
      sticky,
      components: components
        ? components.map((component) => {
            if (isEntryReplacementComponent(component)) {
              const processedVariants = component.variants
                .map((variantRef) => {
                  if (variantRef.hidden) {
                    return variantRef
                  }

                  const matchingVariant = variants?.find(
                    (variant) => variant.sys.id === variantRef.id,
                  )

                  return matchingVariant ?? null
                })
                .filter((variant): variant is EntryReplacementVariant => variant !== null)

              return {
                type: 'EntryReplacement',
                baseline: component.baseline,
                variants: processedVariants,
              }
            }

            if (isInlineVariableComponent(component)) {
              return component
            }

            throw new Error(`[OptimizationMapper] Unsupported component type encountered`)
          })
        : [],
    }
  },
}

export default OptimizationMapper
