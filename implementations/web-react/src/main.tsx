import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { OptimizationProvider } from './optimization/OptimizationProvider'

function main(): void {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element not found')
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <OptimizationProvider>
        <App />
      </OptimizationProvider>
    </React.StrictMode>,
  )
}

main()
