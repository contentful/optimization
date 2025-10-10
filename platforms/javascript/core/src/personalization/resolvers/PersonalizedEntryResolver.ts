import type { Entry } from 'contentful'
import type { SelectedPersonalizationArray } from '../../lib/api-client'
import { logger } from '../../lib/logger'
import { personalizations as personalizationsSignal } from '../../signals'
import {
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isPersonalizationEntry,
  isPersonalizedEntry,
  type PersonalizationEntry,
  type PersonalizedEntry,
} from './personalized-entry'

const RESOLUTION_WARNING_BASE = '[Personalization] Could not resolve personalized entry variant:'

const PersonalizedEntryResolver = {
  getPersonalizationEntry(
    {
      personalizedEntry,
      personalizations,
    }: {
      personalizedEntry: PersonalizedEntry
      personalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): PersonalizationEntry | undefined {
    if (!skipValidation && (!personalizations.length || !isPersonalizedEntry(personalizedEntry)))
      return

    const personalizationEntry = personalizedEntry.fields.nt_experiences
      .filter((maybePersonalization) => isPersonalizationEntry(maybePersonalization))
      .find((personalization) =>
        personalizations.some(
          (selectedPersonalization) =>
            selectedPersonalization.experienceId === personalization.sys.id,
        ),
      )

    personalizedEntry.fields.nt_sticky = personalizationEntry?.fields.nt_config?.sticky ?? false

    return personalizationEntry
  },

  getSelectedVariantIndex(
    {
      personalizationEntry,
      personalizations,
    }: {
      personalizationEntry: PersonalizationEntry
      personalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ) {
    if (
      !skipValidation &&
      (!personalizations.length || !isPersonalizationEntry(personalizationEntry))
    )
      return 0

    const selectedPersonalization = personalizations.find(
      ({ experienceId }) => experienceId === personalizationEntry.sys.id,
    )

    return selectedPersonalization?.variantIndex ?? 0
  },

  getSelectedVariant(
    {
      personalizedEntry,
      personalizationEntry,
      selectedVariantIndex,
    }: {
      personalizedEntry: PersonalizedEntry
      personalizationEntry: PersonalizationEntry
      selectedVariantIndex: number
    },
    skipValidation = false,
  ): EntryReplacementVariant | undefined {
    if (
      !skipValidation &&
      (!isPersonalizedEntry(personalizedEntry) || !isPersonalizationEntry(personalizationEntry))
    )
      return

    const relevantVariants = personalizationEntry.fields.nt_config?.components
      ?.filter(
        (component): component is EntryReplacementComponent =>
          isEntryReplacementComponent(component) && !component.baseline.hidden,
      )
      .find((component) => component.baseline.id === personalizedEntry.sys.id)?.variants

    if (!relevantVariants?.length) return

    return relevantVariants.at(selectedVariantIndex - 1)
  },

  getSelectedVariantEntry(
    {
      personalizationEntry,
      selectedVariant,
    }: {
      personalizationEntry: PersonalizationEntry
      selectedVariant: EntryReplacementVariant
    },
    skipValidation = false,
  ): Entry | undefined {
    if (
      !skipValidation &&
      (!isPersonalizationEntry(personalizationEntry) || !isEntryReplacementVariant(selectedVariant))
    )
      return

    const selectedVariantEntry = personalizationEntry.fields.nt_variants?.find(
      (variant) => variant.sys.id === selectedVariant.id,
    )

    const {
      fields: { nt_config: originalEntryConfig },
    } = personalizationEntry

    if (selectedVariantEntry) selectedVariantEntry.fields.nt_config = originalEntryConfig

    return selectedVariantEntry
  },

  resolve(entry: Entry): Entry {
    logger.info('[Personalization] Resolving personalized entry for baseline entry', entry.sys.id)

    const { value: personalizations } = personalizationsSignal

    if (!personalizations?.length) {
      logger.warn(RESOLUTION_WARNING_BASE, 'no personalizations exist for the current profile')
      return entry
    }

    if (!isPersonalizedEntry(entry)) {
      logger.warn(RESOLUTION_WARNING_BASE, `entry ${entry.sys.id} is not personalized`)
      return entry
    }

    const personalizationEntry = PersonalizedEntryResolver.getPersonalizationEntry(
      {
        personalizedEntry: entry,
        personalizations,
      },
      true,
    )

    if (!personalizationEntry) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        `could not find a personalization entry for ${entry.sys.id}`,
      )
      return entry
    }

    const selectedVariantIndex = PersonalizedEntryResolver.getSelectedVariantIndex(
      {
        personalizationEntry,
        personalizations,
      },
      true,
    )

    if (selectedVariantIndex === 0) {
      logger.info(
        `[Personalization] Resolved personalization entry for entry ${entry.sys.id} is baseline`,
      )

      return entry
    }

    const selectedVariant = PersonalizedEntryResolver.getSelectedVariant(
      {
        personalizedEntry: entry,
        personalizationEntry,
        selectedVariantIndex,
      },
      true,
    )

    if (!selectedVariant) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        `could not find a valid replacement variant entry for ${entry.sys.id}`,
      )
      return entry
    }

    const selectedVariantEntry = PersonalizedEntryResolver.getSelectedVariantEntry(
      {
        personalizationEntry,
        selectedVariant,
      },
      true,
    )

    if (!selectedVariantEntry) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        `could not find a valid replacement variant entry for ${entry.sys.id}`,
      )
      return entry
    } else {
      logger.info(
        `[Personalization] Entry ${entry.sys.id} has been resolved to variant entry ${selectedVariantEntry.sys.id}`,
      )
    }

    return selectedVariantEntry
  },
}

export default PersonalizedEntryResolver
