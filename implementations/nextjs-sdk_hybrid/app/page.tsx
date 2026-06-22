import { HomePage } from '@/components/HomePage'
import { ENTRY_IDS } from '@/config/entries'
import { APP_LOCALE } from '@/lib/config'
import { fetchEntries } from '@/lib/contentful-client'
import { getOptimizationData } from '@/lib/optimization-server'

export default async function Home() {
  const [baselineEntries] = await Promise.all([
    fetchEntries(ENTRY_IDS, APP_LOCALE),
    getOptimizationData(),
  ])

  return <HomePage baselineEntries={baselineEntries} />
}
