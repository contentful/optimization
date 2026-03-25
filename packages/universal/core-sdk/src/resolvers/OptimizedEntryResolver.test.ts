// OptimizedEntryResolver.test.ts
import {
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isOptimizationEntry,
  isOptimizedEntry,
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  type OptimizationEntry,
  type OptimizedEntry,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { describe, expect, it, rs } from '@rstest/core'
import type { Entry } from 'contentful'

import { mockLogger } from 'mocks'
import { optimizedEntry as optimizedEntryFixture } from '../test/fixtures/optimizedEntry'
import { selectedPersonalizations as selectedPersonalizationsFixture } from '../test/fixtures/selectedPersonalizations'
import OptimizedEntryResolver from './OptimizedEntryResolver'

const mockedLogger = rs.mocked(mockLogger)

const RESOLUTION_WARNING_BASE = 'Could not resolve optimized entry variant:'

const getOptimizedEntry = (): OptimizedEntry => {
  if (!isOptimizedEntry(optimizedEntryFixture)) {
    throw new Error('Fixture optimizedEntry is not an OptimizedEntry')
  }

  return optimizedEntryFixture
}

const getSelectedPersonalizations = (): SelectedPersonalizationArray =>
  selectedPersonalizationsFixture

const getEuropeOptimizationEntry = (): OptimizationEntry => {
  const optimizedEntry = getOptimizedEntry()
  const experience = optimizedEntry.fields.nt_experiences.find(
    (maybeExperience): maybeExperience is OptimizationEntry =>
      isOptimizationEntry(maybeExperience) &&
      maybeExperience.fields.nt_experience_id === '2qVK4T5lnScbswoyBuGipd',
  )

  if (!experience) {
    throw new Error('Could not find Europe OptimizationEntry in fixture')
  }

  return experience
}

const getEuropeVariantConfig = (): EntryReplacementVariant => {
  const optimizationEntry = getEuropeOptimizationEntry()
  const components = optimizationEntry.fields.nt_config?.components ?? []

  const component = components.find(
    (candidate): candidate is EntryReplacementComponent =>
      isEntryReplacementComponent(candidate) &&
      candidate.baseline.id === optimizedEntryFixture.sys.id,
  )

  const maybeVariant = component?.variants[0]

  if (!maybeVariant || !isEntryReplacementVariant(maybeVariant)) {
    throw new Error('Could not find EntryReplacementVariant for Europe optimization')
  }

  return maybeVariant
}

describe('OptimizedEntryResolver', () => {
  describe('getOptimizationEntry', () => {
    it('returns the matching optimization entry for a selected experience', () => {
      const optimizedEntry = getOptimizedEntry()
      const selectedPersonalizations = getSelectedPersonalizations()

      const result = OptimizedEntryResolver.getOptimizationEntry(
        {
          optimizedEntry,
          selectedPersonalizations,
        },
        false,
      )

      expect(result).toBeDefined()
      expect(result?.fields.nt_experience_id).toBe('2qVK4T5lnScbswoyBuGipd')
    })

    it('returns undefined when there are no selected personalizations', () => {
      const optimizedEntry = getOptimizedEntry()

      const result = OptimizedEntryResolver.getOptimizationEntry(
        {
          optimizedEntry,
          selectedPersonalizations: [],
        },
        false,
      )

      expect(result).toBeUndefined()
    })

    it('returns undefined when no experiences match the selected personalizations', () => {
      const optimizedEntry = getOptimizedEntry()

      // Drop selections that match the fixture’s experiences
      const selectedPersonalizations: SelectedPersonalizationArray =
        getSelectedPersonalizations().filter(
          (selection) =>
            selection.experienceId !== '2qVK4T5lnScbswoyBuGipd' &&
            selection.experienceId !== '6KfLDCdA75BGwr5HfSeXac',
        )

      const result = OptimizedEntryResolver.getOptimizationEntry(
        {
          optimizedEntry,
          selectedPersonalizations,
        },
        true,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('getSelectedPersonalization', () => {
    it('returns the selected personalization for a matching optimization entry', () => {
      const optimizationEntry = getEuropeOptimizationEntry()
      const selectedPersonalizations = getSelectedPersonalizations()

      const result = OptimizedEntryResolver.getSelectedPersonalization(
        {
          optimizationEntry,
          selectedPersonalizations,
        },
        false,
      )

      expect(result).toBeDefined()
      expect(result?.experienceId).toBe(optimizationEntry.fields.nt_experience_id)
      expect(result?.variantIndex).toBe(1)
    })

    it('returns undefined when no selected personalizations are provided', () => {
      const optimizationEntry = getEuropeOptimizationEntry()

      const result = OptimizedEntryResolver.getSelectedPersonalization(
        {
          optimizationEntry,
          selectedPersonalizations: [],
        },
        false,
      )

      expect(result).toBeUndefined()
    })

    it('returns undefined when there is no selection for the given optimization entry', () => {
      const optimizationEntry = getEuropeOptimizationEntry()

      const selectedPersonalizations: SelectedPersonalizationArray =
        getSelectedPersonalizations().filter(
          (selection) => selection.experienceId !== optimizationEntry.fields.nt_experience_id,
        )

      const result = OptimizedEntryResolver.getSelectedPersonalization(
        {
          optimizationEntry,
          selectedPersonalizations,
        },
        true,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('getSelectedVariant', () => {
    it('returns the configured replacement variant for the given variant index', () => {
      const optimizedEntry = getOptimizedEntry()
      const optimizationEntry = getEuropeOptimizationEntry()

      const result = OptimizedEntryResolver.getSelectedVariant(
        {
          optimizedEntry,
          optimizationEntry,
          selectedVariantIndex: 1,
        },
        false,
      )

      expect(result).toBeDefined()
      expect(result?.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    })

    it('returns undefined when there are no relevant variants for the entry (no components)', () => {
      const optimizedEntry = getOptimizedEntry()
      const optimizationEntry = getEuropeOptimizationEntry()
      const originalConfig = optimizationEntry.fields.nt_config

      if (!originalConfig) {
        throw new Error('Expected nt_config on optimizationEntry fixture')
      }

      const originalComponents = originalConfig.components

      // Temporarily clear components so no relevant variants can be found
      originalConfig.components = []

      try {
        const result = OptimizedEntryResolver.getSelectedVariant(
          {
            optimizedEntry,
            optimizationEntry,
            selectedVariantIndex: 1,
          },
          true,
        )

        expect(result).toBeUndefined()
      } finally {
        // Restore original components to avoid cross-test interference
        originalConfig.components = originalComponents
      }
    })

    it('returns undefined when the selected variant index is out of range', () => {
      const optimizedEntry = getOptimizedEntry()
      const optimizationEntry = getEuropeOptimizationEntry()

      const result = OptimizedEntryResolver.getSelectedVariant(
        {
          optimizedEntry,
          optimizationEntry,
          selectedVariantIndex: 999,
        },
        true,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('getSelectedVariantEntry', () => {
    it('returns the variant entry corresponding to the selected replacement variant', () => {
      const optimizationEntry = getEuropeOptimizationEntry()
      const selectedVariant = getEuropeVariantConfig()

      const result = OptimizedEntryResolver.getSelectedVariantEntry({
        optimizationEntry,
        selectedVariant,
      })

      expect(result).toBeDefined()
      expect(result?.sys.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    })

    it('returns undefined when the variant entry cannot be found by id', () => {
      const optimizationEntry = getEuropeOptimizationEntry()
      const selectedVariant = getEuropeVariantConfig()

      const nonMatchingVariant: EntryReplacementVariant = {
        ...selectedVariant,
        id: 'non-existing-variant-id',
      }

      const result = OptimizedEntryResolver.getSelectedVariantEntry({
        optimizationEntry,
        selectedVariant: nonMatchingVariant,
      })

      expect(result).toBeUndefined()
    })
  })

  describe('resolve', () => {
    it('returns the baseline entry and warns when no selected personalizations are provided', () => {
      const result = OptimizedEntryResolver.resolve(optimizedEntryFixture)

      expect(result.entry).toBe(optimizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Optimization',
        `Resolving optimized entry for baseline entry ${optimizedEntryFixture.sys.id}`,
      )
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Optimization',
        `${RESOLUTION_WARNING_BASE} no selectedPersonalizations exist for the current profile`,
      )
    })

    it('returns the baseline entry and warns when the entry is not optimized', () => {
      const nonOptimizedEntry: Entry = {
        ...optimizedEntryFixture,
        fields: {
          internalTitle: 'Non-optimized entry',
          text: 'No nt_experiences field on this entry',
        },
      }

      const result = OptimizedEntryResolver.resolve(
        nonOptimizedEntry,
        getSelectedPersonalizations(),
      )

      expect(result.entry).toBe(nonOptimizedEntry)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Optimization',
        `${RESOLUTION_WARNING_BASE} entry ${nonOptimizedEntry.sys.id} is not optimized`,
      )
    })

    it('returns the baseline entry and warns when no optimization entry is found', () => {
      const selectedPersonalizations: SelectedPersonalizationArray =
        getSelectedPersonalizations().filter(
          (selection) =>
            selection.experienceId !== '2qVK4T5lnScbswoyBuGipd' &&
            selection.experienceId !== '6KfLDCdA75BGwr5HfSeXac',
        )

      const result = OptimizedEntryResolver.resolve(optimizedEntryFixture, selectedPersonalizations)

      expect(result.entry).toBe(optimizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Optimization',
        `${RESOLUTION_WARNING_BASE} could not find an optimization entry for ${optimizedEntryFixture.sys.id}`,
      )
    })

    it('returns the baseline entry and logs when the selected variant index is 0 (baseline)', () => {
      const selections: SelectedPersonalizationArray = [
        {
          experienceId: '2qVK4T5lnScbswoyBuGipd',
          variantIndex: 0,
          variants: {
            [optimizedEntryFixture.sys.id]: optimizedEntryFixture.sys.id,
          },
          sticky: false,
        },
      ]

      const result = OptimizedEntryResolver.resolve(optimizedEntryFixture, selections)

      expect(result.entry).toBe(optimizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Optimization',
        `Resolved optimization entry for entry ${optimizedEntryFixture.sys.id} is baseline`,
      )
    })

    it('returns the baseline entry and warns when no valid replacement variant config exists (index out of range)', () => {
      const selections: SelectedPersonalizationArray = [
        {
          experienceId: '2qVK4T5lnScbswoyBuGipd',
          variantIndex: 2, // only one variant exists; out of range
          variants: {
            [optimizedEntryFixture.sys.id]: 'non-existing',
          },
          sticky: false,
        },
      ]

      const result = OptimizedEntryResolver.resolve(optimizedEntryFixture, selections)

      expect(result.entry).toBe(optimizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Optimization',
        `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${optimizedEntryFixture.sys.id}`,
      )
    })

    it('returns the baseline entry and warns when the variant entry cannot be resolved', () => {
      const optimizedEntry = getOptimizedEntry()
      const optimizationEntry = getEuropeOptimizationEntry()
      const originalVariants = optimizationEntry.fields.nt_variants

      // Remove the linked variant entries so getSelectedVariantEntry cannot resolve
      optimizationEntry.fields.nt_variants = []

      try {
        const result = OptimizedEntryResolver.resolve(optimizedEntry, getSelectedPersonalizations())

        expect(result.entry).toBe(optimizedEntry)
        expect(result.personalization).toBeUndefined()

        expect(mockedLogger.warn).toHaveBeenCalledWith(
          'Optimization',
          `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${optimizedEntry.sys.id}`,
        )
      } finally {
        // Restore variants for other tests
        optimizationEntry.fields.nt_variants = originalVariants
      }
    })

    it('resolves to the variant entry and returns the selected personalization on success', () => {
      const result = OptimizedEntryResolver.resolve(
        optimizedEntryFixture,
        getSelectedPersonalizations(),
      )

      expect(result.entry.sys.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
      expect(result.personalization).toEqual(
        expect.objectContaining({
          experienceId: '2qVK4T5lnScbswoyBuGipd',
          variantIndex: 1,
        }),
      )

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Optimization',
        `Resolving optimized entry for baseline entry ${optimizedEntryFixture.sys.id}`,
      )
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Optimization',
        `Entry ${optimizedEntryFixture.sys.id} has been resolved to variant entry 4k6ZyFQnR2POY5IJLLlJRb`,
      )
    })
  })
})
