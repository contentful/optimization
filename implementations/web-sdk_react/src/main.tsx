import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { OptimizationProvider } from './optimization/OptimizationProvider'
import { useOptimization } from './optimization/hooks/useOptimization'
import { LiveUpdatesProvider } from './optimization/liveUpdates/LiveUpdatesContext'
import { getContentfulClient } from './services/contentfulClient'

function RootApp(): React.JSX.Element {
  const { sdk, isReady } = useOptimization()
  const [globalLiveUpdates, setGlobalLiveUpdates] = React.useState(false)

  const handleToggleGlobalLiveUpdates = React.useCallback(() => {
    setGlobalLiveUpdates((previous) => !previous)
  }, [])

  const app = (
    <App
      globalLiveUpdates={globalLiveUpdates}
      onToggleGlobalLiveUpdates={handleToggleGlobalLiveUpdates}
    />
  )

  if (!isReady || sdk === undefined) {
    return app
  }

  return (
    <LiveUpdatesProvider
      globalLiveUpdates={globalLiveUpdates}
      previewPanel={{ contentful: getContentfulClient(), optimization: sdk }}
    >
      {app}
    </LiveUpdatesProvider>
  )
}

function main(): void {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element not found')
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <OptimizationProvider>
          <RootApp />
        </OptimizationProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

main()
