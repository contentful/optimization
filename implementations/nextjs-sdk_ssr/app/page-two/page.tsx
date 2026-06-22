import { ENTRY_IDS, PAGE_TWO_AUTO_ENTRY_ID, PAGE_TWO_MANUAL_ENTRY_ID } from '@/config/entries'
import { APP_LOCALE } from '@/lib/config'
import { fetchEntries } from '@/lib/contentful-client'
import { optimization } from '@/lib/optimization-server'
import { getNextjsServerOptimizationData } from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

export default async function PageTwo() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'
  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntries(ENTRY_IDS, APP_LOCALE),
    appConsent
      ? getNextjsServerOptimizationData(optimization, {
          consent: { events: true, persistence: true },
          cookies: cookieStore,
          headers: headerStore,
          locale: APP_LOCALE,
        }).then(({ data }) => data)
      : undefined,
  ])
  const pageTwoAutoEntry = baselineEntries.find((entry) => entry.sys.id === PAGE_TWO_AUTO_ENTRY_ID)
  const pageTwoManualEntry = baselineEntries.find(
    (entry) => entry.sys.id === PAGE_TWO_MANUAL_ENTRY_ID,
  )
  const resolvedAutoEntry = pageTwoAutoEntry
    ? optimization.resolveOptimizedEntry(pageTwoAutoEntry, optimizationData?.selectedOptimizations)
        .entry
    : pageTwoAutoEntry
  const resolvedManualEntry = pageTwoManualEntry
    ? optimization.resolveOptimizedEntry(
        pageTwoManualEntry,
        optimizationData?.selectedOptimizations,
      ).entry
    : pageTwoManualEntry

  return (
    <section data-testid="page-two-view" className="grid gap-4">
      <h2 className="text-lg font-medium">Page Two</h2>

      <section data-testid="page-two-status" className="grid gap-1">
        <p>Server-rendered Next.js route</p>
      </section>

      <section data-testid="page-two-optimization" className="grid gap-3">
        <h3>Page Two Optimized Content</h3>
        <div>
          <p>Auto tracked example</p>
          <p>
            {typeof resolvedAutoEntry?.fields.text === 'string'
              ? resolvedAutoEntry.fields.text
              : ''}
          </p>
        </div>
        <div>
          <p>Manual tracked example</p>
          <p>
            {typeof resolvedManualEntry?.fields.text === 'string'
              ? resolvedManualEntry.fields.text
              : ''}
          </p>
        </div>
      </section>

      <section data-testid="page-two-conversion" className="grid gap-2">
        <h3>Conversion Step Demo</h3>
        <button data-testid="page-two-demo-cta" type="button">
          Trigger Page Two CTA Event
        </button>
      </section>

      <Link data-testid="link-back-home" href="/">
        Back to Home
      </Link>
    </section>
  )
}
