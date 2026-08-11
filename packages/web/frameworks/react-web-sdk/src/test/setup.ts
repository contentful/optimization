import {
  ANONYMOUS_ID_COOKIE,
  ANONYMOUS_ID_COOKIE_LEGACY,
  batch,
  signals,
} from '@contentful/optimization-web/core-sdk'

// React requires this flag in non-Jest environments to support manual act(...) calls.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const EXPIRED_COOKIE = '; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'

function cleanupOptimizationSingleton(): void {
  if (typeof window !== 'undefined' && window.contentfulOptimization) {
    window.contentfulOptimization.destroy()
  }
}

function resetOptimizationBrowserState(): void {
  localStorage.clear()
  document.cookie = `${ANONYMOUS_ID_COOKIE}=${EXPIRED_COOKIE}`
  document.cookie = `${ANONYMOUS_ID_COOKIE_LEGACY}=${EXPIRED_COOKIE}`

  batch(() => {
    signals.blockedEvent.value = undefined
    signals.changes.value = undefined
    signals.consent.value = undefined
    signals.event.value = undefined
    signals.experienceRequestState.value = { status: 'idle' }
    signals.locale.value = undefined
    signals.online.value = true
    signals.persistenceConsent.value = undefined
    signals.previewPanelAttached.value = false
    signals.previewPanelOpen.value = false
    signals.profile.value = undefined
    signals.selectedOptimizations.value = undefined
  })
}

void beforeEach(() => {
  cleanupOptimizationSingleton()
  resetOptimizationBrowserState()
})

void afterEach(() => {
  cleanupOptimizationSingleton()
  resetOptimizationBrowserState()
  document.body.innerHTML = ''
})
