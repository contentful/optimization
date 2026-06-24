export function updateConsentUI(sdk, consent, suffix) {
  const s = suffix ? `-${suffix}` : ''
  const statusEl = document.getElementById(`consent-status${s}`)
  const actionsEl = document.getElementById(`consent-actions${s}`)
  if (!statusEl || !actionsEl) return

  statusEl.textContent = consent === true ? 'Yes' : consent === false ? 'No' : 'undefined'
  actionsEl.innerHTML = ''

  const btn = document.createElement('button')
  if (consent === true) {
    btn.className = 'btn btn--danger btn--sm'
    btn.dataset.testid = 'unconsent-button'
    btn.textContent = 'Revoke'
    btn.addEventListener('click', () => sdk.consent(false))
  } else {
    btn.className = 'btn btn--secondary btn--sm'
    btn.dataset.testid = 'consent-button'
    btn.textContent = 'Grant'
    btn.addEventListener('click', () => sdk.consent(true))
  }
  actionsEl.appendChild(btn)
}

export function updateIdentityUI(sdk, isIdentified, suffix) {
  const s = suffix ? `-${suffix}` : ''
  const statusEl = document.getElementById(`identified-status${s}`)
  const actionsEl = document.getElementById(`identify-actions${s}`)
  if (!statusEl || !actionsEl) return

  statusEl.textContent = isIdentified ? 'Yes' : 'No'
  actionsEl.innerHTML = ''

  const btn = document.createElement('button')
  if (isIdentified) {
    btn.className = 'btn btn--danger btn--sm'
    btn.dataset.testid = 'reset-button'
    btn.textContent = 'Reset'
    btn.addEventListener('click', () => {
      sdk.reset()
      void sdk.page()
    })
  } else {
    btn.className = 'btn btn--secondary btn--sm'
    btn.dataset.testid = 'identify-button'
    btn.textContent = 'Identify'
    btn.addEventListener('click', async () => {
      await sdk.identify({ userId: 'charles', traits: { identified: true } })
    })
  }
  actionsEl.appendChild(btn)
}

export function updateLiveUpdatesUI(enabled, suffix) {
  const s = suffix ? `-${suffix}` : ''
  const statusEl = document.getElementById(`global-live-updates-status${s}`)
  const btn = document.getElementById(`toggle-global-live-updates-button${s}`)
  if (!statusEl || !btn) return
  statusEl.textContent = enabled ? 'ON' : 'OFF'
  btn.textContent = enabled ? 'OFF' : 'ON'
  btn.className = `btn btn--sm ${enabled ? 'btn--danger' : 'btn--secondary'}`
}

export function updatePreviewPanelUI(isOpen, suffix) {
  const s = suffix ? `-${suffix}` : ''
  const statusEl = document.getElementById(`preview-panel-status${s}`)
  const btn = document.getElementById(`simulate-preview-panel-button${s}`)
  if (!statusEl || !btn) return
  statusEl.textContent = isOpen ? 'Open' : 'Closed'
  btn.textContent = isOpen ? 'Close Preview Panel' : 'Open Preview Panel'
}

export function updateOptimizationCount(count, suffix) {
  const s = suffix ? `-${suffix}` : ''
  const el = document.getElementById(`selected-optimizations-count${s}`)
  if (el) el.textContent = String(count)
}

export function updateBooleanFlag(val, suffix) {
  const s = suffix ? `-${suffix}` : ''
  const el = document.getElementById(`boolean-flag-value${s}`)
  if (el) el.textContent = val === undefined ? 'undefined' : String(val)
}

export function wireControlPanel(
  sdk,
  optimizationRoot,
  currentConsent,
  currentIsIdentified,
  suffix,
) {
  updateConsentUI(sdk, currentConsent, suffix)
  updateIdentityUI(sdk, currentIsIdentified, suffix)

  const s = suffix ? `-${suffix}` : ''

  const toggleLUBtn = document.getElementById(`toggle-global-live-updates-button${s}`)
  if (toggleLUBtn) {
    toggleLUBtn.addEventListener('click', () => {
      if (optimizationRoot) optimizationRoot.liveUpdates = !optimizationRoot.liveUpdates
    })
  }

  const simPPBtn = document.getElementById(`simulate-preview-panel-button${s}`)
  if (simPPBtn) {
    simPPBtn.addEventListener('click', () => {
      const panel = document.querySelector('ctfl-opt-preview-panel')
      const btn = panel?.shadowRoot?.querySelector('button.toggle-drawer')
      if (btn) btn.click()
    })
  }
}
