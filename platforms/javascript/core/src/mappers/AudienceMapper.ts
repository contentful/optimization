import { Audience } from './audience'
import { AudienceEntry, type Entry } from './entry'

function isAudienceEntry(entry: Entry): entry is AudienceEntry {
  return AudienceEntry.safeParse(entry).success
}

function mapAudience(entry: AudienceEntry): Audience {
  return Audience.parse({
    id: entry.fields.nt_audience_id,
    name: entry.fields.nt_name,
    description: entry.fields.nt_description,
  })
}

function mapAudiences(entries: Entry[]): Audience[] {
  return entries.filter(isAudienceEntry).map(mapAudience)
}

const AudienceMapper = {
  isAudienceEntry,
  mapAudience,
  mapAudiences,
}

export default AudienceMapper
