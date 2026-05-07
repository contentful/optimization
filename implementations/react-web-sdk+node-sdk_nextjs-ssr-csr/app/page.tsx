import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { HybridEntryList } from '@/components/HybridEntryList'
import { InteractiveControls } from '@/components/InteractiveControls'
import { ENTRY_IDS } from '@/config/entries'
import { fetchEntries } from '@/lib/contentful-client'
import { sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { cookies, headers } from 'next/headers'

export default async function Home() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntries(ENTRY_IDS),
    sdk.page({
      locale: headerStore.get('accept-language')?.split(',')[0] ?? 'en-US',
      userAgent: headerStore.get('user-agent') ?? 'next-js-server',
      profile,
    }),
  ])

  const resolvedEntries = baselineEntries.map((entry) => {
    const { entry: resolved } = sdk.resolveOptimizedEntry(
      entry,
      optimizationData.selectedOptimizations,
    )
    return resolved
  })

  return (
    <ClientProviderWrapper
      defaults={{
        profile: optimizationData.profile,
        selectedOptimizations: optimizationData.selectedOptimizations,
        changes: optimizationData.changes,
      }}
    >
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
    </ClientProviderWrapper>
  )
}
