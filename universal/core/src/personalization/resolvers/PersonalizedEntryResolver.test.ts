// PersonalizedEntryResolver.test.ts
import {
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isPersonalizationEntry,
  isPersonalizedEntry,
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  type PersonalizationEntry,
  type PersonalizedEntry,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import type { Entry } from 'contentful'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { personalizedEntry as personalizedEntryFixture } from '../../test/fixtures/personalizedEntry'
import { selectedPersonalizations as selectedPersonalizationsFixture } from '../../test/fixtures/selectedPersonalizations'
import PersonalizedEntryResolver from './PersonalizedEntryResolver'

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
}))

vi.mock('logger', async () => {
  const { createLoggerMock } = await import('mocks')
  return createLoggerMock(mockLogger)
})

const mockedLogger = vi.mocked(mockLogger)

const RESOLUTION_WARNING_BASE = 'Could not resolve personalized entry variant:'

const getPersonalizedEntry = (): PersonalizedEntry => {
  if (!isPersonalizedEntry(personalizedEntryFixture)) {
    throw new Error('Fixture personalizedEntry is not a PersonalizedEntry')
  }

  return personalizedEntryFixture
}

const getSelectedPersonalizations = (): SelectedPersonalizationArray =>
  selectedPersonalizationsFixture

const getEuropePersonalizationEntry = (): PersonalizationEntry => {
  const personalizedEntry = getPersonalizedEntry()
  const experience = personalizedEntry.fields.nt_experiences.find(
    (maybeExperience): maybeExperience is PersonalizationEntry =>
      isPersonalizationEntry(maybeExperience) &&
      maybeExperience.fields.nt_experience_id === '2qVK4T5lnScbswoyBuGipd',
  )

  if (!experience) {
    throw new Error('Could not find Europe PersonalizationEntry in fixture')
  }

  return experience
}

const getEuropeVariantConfig = (): EntryReplacementVariant => {
  const personalizationEntry = getEuropePersonalizationEntry()
  const components = personalizationEntry.fields.nt_config?.components ?? []

  const component = components.find(
    (candidate): candidate is EntryReplacementComponent =>
      isEntryReplacementComponent(candidate) &&
      candidate.baseline.id === personalizedEntryFixture.sys.id,
  )

  const maybeVariant = component?.variants[0]

  if (!maybeVariant || !isEntryReplacementVariant(maybeVariant)) {
    throw new Error('Could not find EntryReplacementVariant for Europe personalization')
  }

  return maybeVariant
}

beforeEach(() => {
  mockedLogger.info.mockClear()
  mockedLogger.warn.mockClear()
})

describe('PersonalizedEntryResolver', () => {
  describe('getPersonalizationEntry', () => {
    it('returns the matching personalization entry for a selected experience', () => {
      const personalizedEntry = getPersonalizedEntry()
      const selectedPersonalizations = getSelectedPersonalizations()

      const result = PersonalizedEntryResolver.getPersonalizationEntry(
        {
          personalizedEntry,
          selectedPersonalizations,
        },
        false,
      )

      expect(result).toBeDefined()
      expect(result?.fields.nt_experience_id).toBe('2qVK4T5lnScbswoyBuGipd')
    })

    it('returns undefined when there are no selected personalizations', () => {
      const personalizedEntry = getPersonalizedEntry()

      const result = PersonalizedEntryResolver.getPersonalizationEntry(
        {
          personalizedEntry,
          selectedPersonalizations: [],
        },
        false,
      )

      expect(result).toBeUndefined()
    })

    it('returns undefined when no experiences match the selected personalizations', () => {
      const personalizedEntry = getPersonalizedEntry()

      // Drop selections that match the fixture’s experiences
      const selectedPersonalizations: SelectedPersonalizationArray =
        getSelectedPersonalizations().filter(
          (selection) =>
            selection.experienceId !== '2qVK4T5lnScbswoyBuGipd' &&
            selection.experienceId !== '6KfLDCdA75BGwr5HfSeXac',
        )

      const result = PersonalizedEntryResolver.getPersonalizationEntry(
        {
          personalizedEntry,
          selectedPersonalizations,
        },
        true,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('getSelectedPersonalization', () => {
    it('returns the selected personalization for a matching personalization entry', () => {
      const personalizationEntry = getEuropePersonalizationEntry()
      const selectedPersonalizations = getSelectedPersonalizations()

      const result = PersonalizedEntryResolver.getSelectedPersonalization(
        {
          personalizationEntry,
          selectedPersonalizations,
        },
        false,
      )

      expect(result).toBeDefined()
      expect(result?.experienceId).toBe(personalizationEntry.fields.nt_experience_id)
      expect(result?.variantIndex).toBe(1)
    })

    it('returns undefined when no selected personalizations are provided', () => {
      const personalizationEntry = getEuropePersonalizationEntry()

      const result = PersonalizedEntryResolver.getSelectedPersonalization(
        {
          personalizationEntry,
          selectedPersonalizations: [],
        },
        false,
      )

      expect(result).toBeUndefined()
    })

    it('returns undefined when there is no selection for the given personalization entry', () => {
      const personalizationEntry = getEuropePersonalizationEntry()

      const selectedPersonalizations: SelectedPersonalizationArray =
        getSelectedPersonalizations().filter(
          (selection) => selection.experienceId !== personalizationEntry.fields.nt_experience_id,
        )

      const result = PersonalizedEntryResolver.getSelectedPersonalization(
        {
          personalizationEntry,
          selectedPersonalizations,
        },
        true,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('getSelectedVariant', () => {
    it('returns the configured replacement variant for the given variant index', () => {
      const personalizedEntry = getPersonalizedEntry()
      const personalizationEntry = getEuropePersonalizationEntry()

      const result = PersonalizedEntryResolver.getSelectedVariant(
        {
          personalizedEntry,
          personalizationEntry,
          selectedVariantIndex: 1,
        },
        false,
      )

      expect(result).toBeDefined()
      expect(result?.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    })

    it('returns undefined when there are no relevant variants for the entry (no components)', () => {
      const personalizedEntry = getPersonalizedEntry()
      const personalizationEntry = getEuropePersonalizationEntry()
      const originalConfig = personalizationEntry.fields.nt_config

      if (!originalConfig) {
        throw new Error('Expected nt_config on personalizationEntry fixture')
      }

      const originalComponents = originalConfig.components

      // Temporarily clear components so no relevant variants can be found
      originalConfig.components = []

      try {
        const result = PersonalizedEntryResolver.getSelectedVariant(
          {
            personalizedEntry,
            personalizationEntry,
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
      const personalizedEntry = getPersonalizedEntry()
      const personalizationEntry = getEuropePersonalizationEntry()

      const result = PersonalizedEntryResolver.getSelectedVariant(
        {
          personalizedEntry,
          personalizationEntry,
          selectedVariantIndex: 999,
        },
        true,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('getSelectedVariantEntry', () => {
    it('returns the variant entry corresponding to the selected replacement variant', () => {
      const personalizationEntry = getEuropePersonalizationEntry()
      const selectedVariant = getEuropeVariantConfig()

      const result = PersonalizedEntryResolver.getSelectedVariantEntry({
        personalizationEntry,
        selectedVariant,
      })

      expect(result).toBeDefined()
      expect(result?.sys.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    })

    it('returns undefined when the variant entry cannot be found by id', () => {
      const personalizationEntry = getEuropePersonalizationEntry()
      const selectedVariant = getEuropeVariantConfig()

      const nonMatchingVariant: EntryReplacementVariant = {
        ...selectedVariant,
        id: 'non-existing-variant-id',
      }

      const result = PersonalizedEntryResolver.getSelectedVariantEntry({
        personalizationEntry,
        selectedVariant: nonMatchingVariant,
      })

      expect(result).toBeUndefined()
    })
  })

  describe('resolve', () => {
    it('returns the baseline entry and warns when no selected personalizations are provided', () => {
      const result = PersonalizedEntryResolver.resolve(personalizedEntryFixture)

      expect(result.entry).toBe(personalizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Personalization',
        `Resolving personalized entry for baseline entry ${personalizedEntryFixture.sys.id}`,
      )
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Personalization',
        `${RESOLUTION_WARNING_BASE} no selectedPersonalizations exist for the current profile`,
      )
    })

    it('returns the baseline entry and warns when the entry is not personalized', () => {
      const nonPersonalizedEntry: Entry = {
        ...personalizedEntryFixture,
        fields: {
          internalTitle: 'Non-personalized entry',
          text: 'No nt_experiences field on this entry',
        },
      }

      const result = PersonalizedEntryResolver.resolve(
        nonPersonalizedEntry,
        getSelectedPersonalizations(),
      )

      expect(result.entry).toBe(nonPersonalizedEntry)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Personalization',
        `${RESOLUTION_WARNING_BASE} entry ${nonPersonalizedEntry.sys.id} is not personalized`,
      )
    })

    it('returns the baseline entry and warns when no personalization entry is found', () => {
      const selectedPersonalizations: SelectedPersonalizationArray =
        getSelectedPersonalizations().filter(
          (selection) =>
            selection.experienceId !== '2qVK4T5lnScbswoyBuGipd' &&
            selection.experienceId !== '6KfLDCdA75BGwr5HfSeXac',
        )

      const result = PersonalizedEntryResolver.resolve(
        personalizedEntryFixture,
        selectedPersonalizations,
      )

      expect(result.entry).toBe(personalizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Personalization',
        `${RESOLUTION_WARNING_BASE} could not find a personalization entry for ${personalizedEntryFixture.sys.id}`,
      )
    })

    it('returns the baseline entry and logs when the selected variant index is 0 (baseline)', () => {
      const selections: SelectedPersonalizationArray = [
        {
          experienceId: '2qVK4T5lnScbswoyBuGipd',
          variantIndex: 0,
          variants: {
            [personalizedEntryFixture.sys.id]: personalizedEntryFixture.sys.id,
          },
          sticky: false,
        },
      ]

      const result = PersonalizedEntryResolver.resolve(personalizedEntryFixture, selections)

      expect(result.entry).toBe(personalizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Personalization',
        `Resolved personalization entry for entry ${personalizedEntryFixture.sys.id} is baseline`,
      )
    })

    it('returns the baseline entry and warns when no valid replacement variant config exists (index out of range)', () => {
      const selections: SelectedPersonalizationArray = [
        {
          experienceId: '2qVK4T5lnScbswoyBuGipd',
          variantIndex: 2, // only one variant exists; out of range
          variants: {
            [personalizedEntryFixture.sys.id]: 'non-existing',
          },
          sticky: false,
        },
      ]

      const result = PersonalizedEntryResolver.resolve(personalizedEntryFixture, selections)

      expect(result.entry).toBe(personalizedEntryFixture)
      expect(result.personalization).toBeUndefined()

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Personalization',
        `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${personalizedEntryFixture.sys.id}`,
      )
    })

    it('returns the baseline entry and warns when the variant entry cannot be resolved', () => {
      const personalizedEntry = getPersonalizedEntry()
      const personalizationEntry = getEuropePersonalizationEntry()
      const originalVariants = personalizationEntry.fields.nt_variants

      // Remove the linked variant entries so getSelectedVariantEntry cannot resolve
      personalizationEntry.fields.nt_variants = []

      try {
        const result = PersonalizedEntryResolver.resolve(
          personalizedEntry,
          getSelectedPersonalizations(),
        )

        expect(result.entry).toBe(personalizedEntry)
        expect(result.personalization).toBeUndefined()

        expect(mockedLogger.warn).toHaveBeenCalledWith(
          'Personalization',
          `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${personalizedEntry.sys.id}`,
        )
      } finally {
        // Restore variants for other tests
        personalizationEntry.fields.nt_variants = originalVariants
      }
    })

    it('resolves to the variant entry and returns the selected personalization on success', () => {
      const result = PersonalizedEntryResolver.resolve(
        personalizedEntryFixture,
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
        'Personalization',
        `Resolving personalized entry for baseline entry ${personalizedEntryFixture.sys.id}`,
      )
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        'Personalization',
        `Entry ${personalizedEntryFixture.sys.id} has been resolved to variant entry 4k6ZyFQnR2POY5IJLLlJRb`,
      )
    })
  })
})
