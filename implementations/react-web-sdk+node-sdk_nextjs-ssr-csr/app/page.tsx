import { HybridEntryList } from '@/components/HybridEntryList'
import { InteractiveControls } from '@/components/InteractiveControls'
import { ENTRY_IDS } from '@/config/entries'
import { fetchEntries } from '@/lib/contentful-client'
import { getOptimizationData, sdk } from '@/lib/optimization-server'
import type { ContentEntry } from '@/types/contentful'

export default async function Home() {
  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntries(ENTRY_IDS),
    getOptimizationData(),
  ])

  const resolvedEntries = baselineEntries.map((entry: ContentEntry) => {
    const { entry: resolved } = sdk.resolveOptimizedEntry(
      entry,
      optimizationData.selectedOptimizations,
    )
    return resolved
  })

  return (
    <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-2">Next.js Hybrid SSR + CSR Takeover</h1>
      <p className="text-zinc-500 mb-6">
        This page is server-resolved on first paint. After hydration, the React Web SDK takes over
        and re-resolves entries client-side on identify, consent, or reset.
      </p>

      <InteractiveControls />

      <section className="mt-6">
        <h2 className="text-lg font-medium mb-3">Entries</h2>
        <HybridEntryList
          baselineEntries={baselineEntries}
          serverResolvedEntries={resolvedEntries}
        />
      </section>
    </main>
  )
}
