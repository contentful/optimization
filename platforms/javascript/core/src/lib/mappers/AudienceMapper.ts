import { Audience } from './audience'
import { AudienceEntry, type Entry } from './entry'

const AudienceMapper = {
  isAudienceEntry(entry: Entry): entry is AudienceEntry {
    return AudienceEntry.safeParse(entry).success
  },

  mapAudience(audience: AudienceEntry): Audience {
    return Audience.parse({
      id: audience.fields.nt_audience_id,
      name: audience.fields.nt_name,
      description: audience.fields.nt_description,
    })
  },
}

export default AudienceMapper
