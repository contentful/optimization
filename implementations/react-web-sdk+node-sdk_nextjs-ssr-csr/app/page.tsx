import { InteractiveControls } from '@/components/InteractiveControls'
import { ENTRY_IDS } from '@/config/entries'
import { fetchEntries } from '@/lib/contentful-client'
import { sdk } from '@/lib/optimization-server'
import type { ContentEntry } from '@/types/contentful'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'

function getEntryText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

function ServerRenderedEntry({
  baselineEntry,
  resolvedEntry,
}: {
  baselineEntry: ContentEntry
  resolvedEntry: ContentEntry
}) {
  return (
    <div
      data-testid={`content-${baselineEntry.sys.id}`}
      data-ctfl-entry-id={resolvedEntry.sys.id}
      data-ctfl-baseline-id={baselineEntry.sys.id}
      className="rounded-lg border border-zinc-200 p-4"
    >
      <p data-testid={`entry-text-${baselineEntry.sys.id}`}>{getEntryText(resolvedEntry)}</p>
      <p className="text-xs text-zinc-400 mt-2">{`[Entry: ${baselineEntry.sys.id} — Server-Resolved]`}</p>
    </div>
  )
}

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
    <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-2">Next.js Hybrid SSR + CSR Takeover</h1>
      <p className="text-zinc-500 mb-6">
        This page is server-resolved (Setup 2 first paint). Entries below are personalized in the
        HTML with zero client JS. Navigate to the interactive page to see CSR takeover.
      </p>

      <nav className="mb-6 flex gap-3">
        <span className="rounded border border-zinc-300 px-3 py-1.5 text-sm bg-zinc-100">
          Home (SSR)
        </span>
        <Link
          href="/interactive"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Interactive (CSR) →
        </Link>
      </nav>

      <InteractiveControls />

      <section className="mt-6">
        <h2 className="text-lg font-medium mb-3">Entries (Server-Resolved)</h2>
        {baselineEntries.length === 0 ? (
          <p data-testid="entries-empty">No entries found.</p>
        ) : (
          <div className="grid gap-3">
            {baselineEntries.map((entry, index) => (
              <ServerRenderedEntry
                key={entry.sys.id}
                baselineEntry={entry}
                resolvedEntry={resolvedEntries[index] ?? entry}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
