import { PageTwoPage } from '@/components/PageTwoPage'
import { loadPageEntries } from '@/lib/contentful'
import { PAGES } from 'e2e-web'

export default async function PageTwo() {
  const baselineEntries = await loadPageEntries(PAGES.home.ids)
  return <PageTwoPage baselineEntries={baselineEntries} />
}
