import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { NextPagesAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import type { NextjsPagesRouterOptimizationPageProps } from '@contentful/optimization-nextjs/pages-router/server'
import 'e2e-web/theme.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import type { JSX } from 'react'

interface OptimizationAppPageProps {
  readonly contentfulOptimization?: NextjsPagesRouterOptimizationPageProps
}

export default function App({
  Component,
  pageProps,
}: AppProps<OptimizationAppPageProps>): JSX.Element {
  const contentfulOptimization = pageProps.contentfulOptimization

  return (
    <>
      <Head>
        <title>Optimization Next.js SDK Pages Router</title>
        <meta
          content="Next.js Pages Router reference: the Next.js SDK resolves entries in getServerSideProps and hands Optimization state to the browser."
          name="description"
        />
      </Head>
      <OptimizationRoot
        clientDefaults={contentfulOptimization?.clientDefaults}
        serverOptimizationState={contentfulOptimization?.serverOptimizationState}
      >
        <GlobalLiveUpdatesProvider>
          <PreviewPanel />
          <NextPagesAutoPageTracker initialPageEvent={contentfulOptimization?.initialPageEvent} />
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
