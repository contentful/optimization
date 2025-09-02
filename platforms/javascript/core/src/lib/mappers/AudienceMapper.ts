import { Audience, type AudienceType } from './audience'
import { AudienceEntry, type AudienceEntryType, type EntryType } from './entry'

const AudienceMapper = {
  isAudienceEntry(entry: EntryType): entry is AudienceEntryType {
    return AudienceEntry.safeParse(entry).success
  },

  mapAudience(audience: AudienceEntryType): AudienceType {
    return Audience.parse({
      id: audience.fields.nt_audience_id,
      name: audience.fields.nt_name,
      description: audience.fields.nt_description,
    })
  },
}

export default AudienceMapper
