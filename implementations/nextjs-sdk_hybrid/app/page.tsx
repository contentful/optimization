import { HomePage } from '@/components/HomePage'
import { loadPageEntries } from '@/lib/contentful'
import { toIdMap } from '@/lib/util'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'

const NESTED_CONTENT_TYPE = 'nestedContent'

export default async function Home() {
  const entriesById = toIdMap(await loadPageEntries(PAGES.home.ids))

  return (
    <HomePage
      liveUpdatesEntry={entriesById.get(PAGES.home.liveUpdates)}
      autoEntries={PAGES.home.auto.flatMap((id) => {
        const entry = entriesById.get(id)
        return entry
          ? [
              {
                entry,
                clickScenario: CLICK_SCENARIOS[id],
                nested: entry.sys.contentType.sys.id === NESTED_CONTENT_TYPE,
              },
            ]
          : []
      })}
      manualEntries={PAGES.home.manual.flatMap((id) => {
        const entry = entriesById.get(id)
        return entry ? [entry] : []
      })}
    />
  )
}
