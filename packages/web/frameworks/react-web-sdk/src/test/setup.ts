// React requires this flag in non-Jest environments to support manual act(...) calls.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function cleanupOptimizationSingleton(): void {
  if (typeof window !== 'undefined' && window.contentfulOptimization) {
    window.contentfulOptimization.destroy()
  }
}

void beforeEach(() => {
  cleanupOptimizationSingleton()
})

void afterEach(() => {
  cleanupOptimizationSingleton()
  document.body.innerHTML = ''
})
