import {
  updateBooleanFlag,
  updateConsentUI,
  updateIdentityUI,
  updateLiveUpdatesUI,
  updateOptimizationCount,
  updatePreviewPanelUI,
  wireControlPanel,
} from './control-panel.js'
import { initializeAllOptimizedEntries } from './entries.js'
import { onAnalyticsEvent } from './tracking.js'

/* ── SDK initialization ──────────────────────────────────────────────── */

window.contentfulClient = contentful.createClient({
  accessToken: window.ENVIRONMENT.PUBLIC_CONTENTFUL_TOKEN,
  environment: window.ENVIRONMENT.PUBLIC_CONTENTFUL_ENVIRONMENT,
  space: window.ENVIRONMENT.PUBLIC_CONTENTFUL_SPACE_ID,
  host: window.ENVIRONMENT.PUBLIC_CONTENTFUL_CDA_HOST,
  basePath: window.ENVIRONMENT.PUBLIC_CONTENTFUL_BASE_PATH,
  insecure: Boolean(window.ENVIRONMENT.PUBLIC_CONTENTFUL_CDA_HOST),
})

window.contentfulOptimization = new ContentfulOptimization({
  clientId: window.ENVIRONMENT.PUBLIC_NINETAILED_CLIENT_ID,
  environment: window.ENVIRONMENT.PUBLIC_NINETAILED_ENVIRONMENT,
  logLevel: 'debug',
  autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
  locale: 'en-US',
  app: { name: document.title, version: '0.0.0' },
  api: {
    insightsBaseUrl: window.ENVIRONMENT.PUBLIC_INSIGHTS_API_BASE_URL,
    experienceBaseUrl: window.ENVIRONMENT.PUBLIC_EXPERIENCE_API_BASE_URL,
  },
})

if (window.ENVIRONMENT.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true') {
  attachOptimizationPreviewPanel({
    contentful: window.contentfulClient,
    optimization: window.contentfulOptimization,
    nonce: 'nonce-string',
  })
}

ContentfulOptimizationWebComponents.defineContentfulOptimizationElements()

/* ── Constants ───────────────────────────────────────────────────────── */

const HOME_AUTO_IDS = [
  '1JAU028vQ7v6nB2swl3NBo',
  '1MwiFl4z7gkwqGYdvCmr8c',
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
]

const HOME_MANUAL_IDS = [
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
]

const PAGE_TWO_AUTO_ID = '2Z2WLOx07InSewC3LUB3eX'
const PAGE_TWO_MANUAL_ID = '5XHssysWUDECHzKLzoIsg1'

/* ── SDK refs ────────────────────────────────────────────────────────── */

const sdk = window.contentfulOptimization
const optimizationRoot = document.getElementById('optimization-root')

/* ── State ───────────────────────────────────────────────────────────── */

let currentConsent = undefined
let currentIsIdentified = false

/* ── State subscriptions ─────────────────────────────────────────────── */

sdk.states.consent.subscribe((consent) => {
  currentConsent = consent
  updateConsentUI(sdk, consent, '')
  updateConsentUI(sdk, consent, 'p2')
})

sdk.states.profile.subscribe((profile) => {
  currentIsIdentified = Boolean(profile?.traits && Object.keys(profile.traits).length)
  updateIdentityUI(sdk, currentIsIdentified, '')
  updateIdentityUI(sdk, currentIsIdentified, 'p2')
})

sdk.states.selectedOptimizations.subscribe((opts) => {
  const count = Array.isArray(opts) ? opts.length : 0
  updateOptimizationCount(count, '')
  updateOptimizationCount(count, 'p2')
})

sdk.states.flag('boolean').subscribe((val) => {
  updateBooleanFlag(val, '')
  updateBooleanFlag(val, 'p2')
})

sdk.states.eventStream.subscribe(onAnalyticsEvent)

if (optimizationRoot?.subscribeOptimizationContext) {
  optimizationRoot.subscribeOptimizationContext((context) => {
    updateLiveUpdatesUI(context.rootLiveUpdatesEnabled, '')
    updateLiveUpdatesUI(context.rootLiveUpdatesEnabled, 'p2')
    updatePreviewPanelUI(context.isPreviewPanelOpen, '')
    updatePreviewPanelUI(context.isPreviewPanelOpen, 'p2')
  })
}

/* ── Router ──────────────────────────────────────────────────────────── */

const appMain = document.getElementById('app-main')
const appNav = document.getElementById('app-nav')

function renderNav(activePath) {
  appNav.innerHTML = ''

  const homeA = document.createElement('a')
  homeA.dataset.testid = 'link-home'
  homeA.href = '/'
  homeA.textContent = 'Home'
  if (activePath === '/') homeA.classList.add('active')

  const p2A = document.createElement('a')
  p2A.dataset.testid = 'link-page-two'
  p2A.href = '/page-two'
  p2A.textContent = 'Page Two'
  if (activePath === '/page-two') p2A.classList.add('active')

  appNav.append(homeA, p2A)
}

async function navigateTo(path, pushState = true) {
  if (pushState) history.pushState(null, '', path)
  await renderRoute(path)
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href.startsWith('http') || href.startsWith('//')) return
  e.preventDefault()
  void navigateTo(href)
})

window.addEventListener('popstate', () => void renderRoute(location.pathname))

async function renderRoute(path) {
  renderNav(path)
  void sdk.page({ properties: { url: path } })
  if (path === '/page-two') {
    await renderPageTwo()
  } else {
    await renderHome()
  }
}

/* ── Home page ───────────────────────────────────────────────────────── */

async function renderHome() {
  const tpl = document.getElementById('tpl-home')
  appMain.replaceChildren(tpl.content.cloneNode(true))
  wireControlPanel(sdk, optimizationRoot, currentConsent, currentIsIdentified, '')

  const autoGrid = document.getElementById('auto-observed')
  const manualGrid = document.getElementById('manually-observed')

  if (autoGrid) {
    for (const entryId of HOME_AUTO_IDS) {
      const el = document.createElement('ctfl-optimized-entry')
      el.dataset.entryId = entryId
      autoGrid.appendChild(el)
    }
  }

  if (manualGrid) {
    for (const entryId of HOME_MANUAL_IDS) {
      const el = document.createElement('ctfl-optimized-entry')
      el.dataset.entryId = entryId
      el.dataset.manualViewTracking = 'true'
      manualGrid.appendChild(el)
    }
  }

  await initializeAllOptimizedEntries()
}

/* ── Page Two ────────────────────────────────────────────────────────── */

async function renderPageTwo() {
  const tpl = document.getElementById('tpl-page-two')
  appMain.replaceChildren(tpl.content.cloneNode(true))
  wireControlPanel(sdk, optimizationRoot, currentConsent, currentIsIdentified, 'p2')

  const trackConvBtn = document.getElementById('track-conversion-button')
  if (trackConvBtn) {
    trackConvBtn.addEventListener('click', () => {
      void sdk.trackView({
        componentId: 'track-conversion-button',
        viewId: crypto.randomUUID(),
        viewDurationMs: 0,
      })
    })
  }

  void sdk.trackView({
    componentId: 'page-two-hero',
    viewId: crypto.randomUUID(),
    viewDurationMs: 0,
  })

  const autoGrid = document.getElementById('page-two-auto-grid')
  const manualGrid = document.getElementById('page-two-manual-grid')

  if (autoGrid) {
    const el = document.createElement('ctfl-optimized-entry')
    el.dataset.entryId = PAGE_TWO_AUTO_ID
    autoGrid.appendChild(el)
  }

  if (manualGrid) {
    const el = document.createElement('ctfl-optimized-entry')
    el.dataset.entryId = PAGE_TWO_MANUAL_ID
    el.dataset.manualViewTracking = 'true'
    manualGrid.appendChild(el)
  }

  await initializeAllOptimizedEntries()
}

/* ── Boot ────────────────────────────────────────────────────────────── */

void renderRoute(location.pathname)
