import { PageTwoPage } from '@/components/PageTwoPage'
import { loadPageEntries } from '@/lib/contentful'
import { toIdMap } from '@/lib/util'
import { PAGES } from 'e2e-web'

export default async function PageTwo() {
  const entriesById = toIdMap(await loadPageEntries(PAGES.pageTwo.ids))

  return (
    <PageTwoPage
      autoEntry={entriesById.get(PAGES.pageTwo.auto)}
      manualEntry={entriesById.get(PAGES.pageTwo.manual)}
    />
  )
}
