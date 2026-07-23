import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import type { PagesRouterOptimizationProps } from '@/lib/optimization-server'
import 'e2e-web/theme.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { JSX } from 'react'

type OptimizationAppPageProps = Partial<PagesRouterOptimizationProps>

function createRoutePagePayload(routeKey: string): {
  readonly properties: {
    readonly path: string
    readonly search: string
    readonly url: string
  }
} {
  const [path = '/', search = ''] = routeKey.split('?')

  return {
    properties: {
      path,
      search: search ? `?${search}` : '',
      url: routeKey,
    },
  }
}

export default function App({
  Component,
  pageProps,
}: AppProps<OptimizationAppPageProps>): JSX.Element {
  const contentfulOptimization = pageProps.contentfulOptimization
  const router = useRouter()
  const routeKey = router.asPath || router.pathname
  const pagePayload = createRoutePagePayload(routeKey)

  return (
    <>
      <Head>
        <title>Optimization Next.js SDK Pages Router</title>
        <meta
          content="Next.js Pages Router reference: the Next.js SDK resolves entries in getServerSideProps and hands Optimization request state to the browser."
          name="description"
        />
      </Head>
      <OptimizationRoot
        buildPagePayload={() => pagePayload}
        handoff={contentfulOptimization?.handoff}
        routeKey={routeKey}
      >
        <GlobalLiveUpdatesProvider>
          <PreviewPanel />
          <NextPagesAutoPageTracker
            initialPageEvent={contentfulOptimization?.handoff.initialPageEvent}
          />
          <div className="app-shell">
            <nav>
              <Link data-testid="link-home" href="/">
                Home
              </Link>
              <Link data-testid="link-page-two" href="/page-two">
                Page Two
              </Link>
            </nav>
            <div className="app-body">
              <aside className="app-sidebar">
                <TrackingLog />
              </aside>
              <main>
                <Component {...pageProps} />
              </main>
            </div>
          </div>
        </GlobalLiveUpdatesProvider>
      </OptimizationRoot>
    </>
  )
}
