import { HomePage } from '@/components/HomePage'
import { loadPageEntries } from '@/lib/contentful'
import { PAGES } from 'e2e-web'

export default async function Home() {
  const baselineEntries = await loadPageEntries(PAGES.home.ids)
  return <HomePage baselineEntries={baselineEntries} />
}
