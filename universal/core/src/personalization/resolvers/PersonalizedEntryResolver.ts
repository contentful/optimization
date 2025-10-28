import {
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isPersonalizationEntry,
  isPersonalizedEntry,
  type PersonalizationEntry,
  type PersonalizedEntry,
  type SelectedPersonalization,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import type { Entry } from 'contentful'
import { logger } from 'logger'

const RESOLUTION_WARNING_BASE = '[Personalization] Could not resolve personalized entry variant:'

const PersonalizedEntryResolver = {
  getPersonalizationEntry(
    {
      personalizedEntry,
      selectedPersonalizations,
    }: {
      personalizedEntry: PersonalizedEntry
      selectedPersonalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): PersonalizationEntry | undefined {
    if (
      !skipValidation &&
      (!selectedPersonalizations.length || !isPersonalizedEntry(personalizedEntry))
    )
      return

    const personalizationEntry = personalizedEntry.fields.nt_experiences
      .filter((maybePersonalization) => isPersonalizationEntry(maybePersonalization))
      .find((personalization) =>
        selectedPersonalizations.some(
          (selectedPersonalization) =>
            selectedPersonalization.experienceId === personalization.sys.id,
        ),
      )

    return personalizationEntry
  },

  getSelectedPersonalization(
    {
      personalizationEntry,
      selectedPersonalizations,
    }: {
      personalizationEntry: PersonalizationEntry
      selectedPersonalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): SelectedPersonalization | undefined {
    if (
      !skipValidation &&
      (!selectedPersonalizations.length || !isPersonalizationEntry(personalizationEntry))
    )
      return

    const selectedPersonalization = selectedPersonalizations.find(
      ({ experienceId }) => experienceId === personalizationEntry.sys.id,
    )

    return selectedPersonalization
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

    return selectedVariantEntry
  },

  decorateSelectedVariantFields(
    selectedVariantEntry: Entry,
    selectedPersonalization: SelectedPersonalization | undefined,
  ) {
    selectedVariantEntry.fields.nt_personalization = selectedPersonalization ?? {}
  },

  resolve(entry: Entry, selectedPersonalizations?: SelectedPersonalizationArray): Entry {
    logger.info('[Personalization] Resolving personalized entry for baseline entry', entry.sys.id)

    if (!selectedPersonalizations?.length) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        'no selectedPersonalizations exist for the current profile',
      )
      return entry
    }

    if (!isPersonalizedEntry(entry)) {
      logger.warn(RESOLUTION_WARNING_BASE, `entry ${entry.sys.id} is not personalized`)
      return entry
    }

    const personalizationEntry = PersonalizedEntryResolver.getPersonalizationEntry(
      {
        personalizedEntry: entry,
        selectedPersonalizations,
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

    const selectedPersonalization = PersonalizedEntryResolver.getSelectedPersonalization(
      {
        personalizationEntry,
        selectedPersonalizations,
      },
      true,
    )

    const selectedVariantIndex = selectedPersonalization?.variantIndex ?? 0

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

    PersonalizedEntryResolver.decorateSelectedVariantFields(
      selectedVariantEntry,
      selectedPersonalization,
    )

    return selectedVariantEntry
  },
}

export default PersonalizedEntryResolver
