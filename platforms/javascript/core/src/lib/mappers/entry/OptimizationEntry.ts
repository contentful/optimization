import { z } from 'zod/mini'
import { AudienceEntry } from './AudienceEntry'
import { Entry, EntryFields } from './Entry'
import { OptimizationEntryConfig } from './OptimizationEntryConfig'

export const OptimizationEntryType = z.union([
  z.literal('nt_experiment'),
  z.literal('nt_personalization'),
])
export type OptimizationEntryType = z.infer<typeof OptimizationEntryType>

export const OptimizationEntryFields = z.extend(EntryFields, {
  /**
   * The name of the experience (Short Text)
   */
  nt_name: z.string(),

  /**
   * The description of the experience (Short Text)
   */
  nt_description: z.optional(z.nullable(z.string())),

  /**
   * The type if the experience (nt_experiment | nt_personalization)
   */
  nt_type: OptimizationEntryType,

  /**
   * The config of the experience (JSON)
   */
  nt_config: z.pipe(
    z.optional(z.prefault(z.nullable(OptimizationEntryConfig), null)),
    z.transform<OptimizationEntryConfig | null>(
      (v) =>
        v ?? {
          traffic: 0,
          distribution: [0.5, 0.5],
          components: [],
          sticky: false,
        },
    ),
  ),

  /**
   * The audience of the experience (Audience)
   */
  nt_audience: z.optional(z.nullable(AudienceEntry)),

  /**
   * All used variants of the experience (Contentful references to other Content Types)
   */
  nt_variants: z.optional(z.prefault(z.array(Entry), [])),
})
export type OptimizationEntryFields = z.infer<typeof OptimizationEntryFields>

export const OptimizationEntry = z.extend(Entry, {
  fields: OptimizationEntryFields,
})
export type OptimizationEntry = z.infer<typeof OptimizationEntry>
