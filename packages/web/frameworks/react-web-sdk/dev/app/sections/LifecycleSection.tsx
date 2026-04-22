import { useEffect, useState, type ReactElement } from 'react'
import type { OptimizationSdk } from '../../../src/context/OptimizationContext'

interface LifecycleSectionProps {
  sdk: OptimizationSdk
}

export function LifecycleSection({ sdk }: LifecycleSectionProps): ReactElement {
  const [canOptimize, setCanOptimize] = useState(sdk.states.canOptimize.current)

  useEffect(() => {
    const sub = sdk.states.canOptimize.subscribe(setCanOptimize)
    return () => {
      sub.unsubscribe()
    }
  }, [sdk])

  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>Lifecycle</h2>
        <p>{`canOptimize: ${String(canOptimize)}`}</p>
        <div className="dashboard__actions">
          <button
            onClick={() => {
              sdk.destroy()
            }}
            type="button"
          >
            destroy()
          </button>
        </div>
      </article>
    </section>
  )
}
