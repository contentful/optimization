const CLICK_SCENARIOS = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

const entryCache = new Map()
const configuredEntryElements = new WeakSet()

export async function fetchEntry(entryId) {
  if (entryCache.has(entryId)) return entryCache.get(entryId)
  try {
    const entry = await window.contentfulClient.getEntry(entryId, { include: 10, locale: 'en-US' })
    entryCache.set(entryId, entry)
    return entry
  } catch {
    console.warn(`Entry "${entryId}" not found`)
    return undefined
  }
}

/* ── Rich text ───────────────────────────────────────────────────────── */

function isRichText(field) {
  return field && typeof field === 'object' && field.content !== undefined
}

function simpleRenderRichText(node, parent) {
  if (!node || typeof node !== 'object') return
  if (node.nodeType === 'document') {
    node.content.forEach((n) => simpleRenderRichText(n, parent))
  } else if (node.nodeType === 'paragraph') {
    const p = document.createElement('p')
    node.content.forEach((n) => simpleRenderRichText(n, p))
    parent.appendChild(p)
  } else if (node.nodeType === 'text') {
    parent.appendChild(document.createTextNode(node.value))
  } else if (node.nodeType === 'embedded-entry-inline') {
    parent.appendChild(
      document.createTextNode(window.contentfulOptimization.getMergeTagValue(node.data.target)),
    )
  }
}

function getEntryText(entry) {
  return typeof entry.fields?.text === 'string' ? entry.fields.text : 'No content'
}

/* ── Entry card builder ──────────────────────────────────────────────── */

function buildEntryCard(resolvedEntry, baselineEntryId, observation, clickScenario) {
  const card = document.createElement('div')
  card.className = 'entry-card'
  card.dataset.testid = `content-${baselineEntryId}`
  card.dataset.testEntryId = resolvedEntry.sys.id

  if (observation === 'auto') {
    card.dataset.ctflEntryId = resolvedEntry.sys.id
    card.dataset.ctflBaselineId = baselineEntryId
    card.dataset.ctflHoverDurationUpdateIntervalMs = '1000'
    if (clickScenario === 'direct') card.dataset.ctflClickable = 'true'
  } else {
    card.dataset.entryId = baselineEntryId
  }

  const idsDiv = document.createElement('div')
  idsDiv.className = 'entry-card__ids'
  const mkId = (label, val) => {
    const p = document.createElement('p')
    p.className = 'entry-card__id'
    p.innerHTML = `<span class="entry-card__id-label">${label}</span><span class="entry-card__id-value">${val}</span>`
    return p
  }
  idsDiv.append(
    mkId('base', baselineEntryId),
    mkId('var', resolvedEntry.sys.id !== baselineEntryId ? resolvedEntry.sys.id : '—'),
  )
  const headerDiv = document.createElement('div')
  headerDiv.className = 'entry-card__header'
  headerDiv.appendChild(idsDiv)
  card.appendChild(headerDiv)

  const textDiv = document.createElement('div')
  textDiv.dataset.testid = `entry-text-${baselineEntryId}`
  textDiv.setAttribute('aria-label', `Entry: ${resolvedEntry.sys.id}`)

  if (isRichText(resolvedEntry.fields?.text)) {
    const richDiv = document.createElement('div')
    richDiv.className = 'rich-text'
    simpleRenderRichText(resolvedEntry.fields.text, richDiv)
    textDiv.appendChild(richDiv)
  } else {
    const p = document.createElement('p')
    p.textContent = getEntryText(resolvedEntry)
    textDiv.appendChild(p)
  }
  const entryIdP = document.createElement('p')
  entryIdP.textContent = `[Entry: ${resolvedEntry.sys.id}]`
  textDiv.appendChild(entryIdP)
  card.appendChild(textDiv)

  if (clickScenario === 'descendant') {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.testid = 'entry-click-descendant-button'
    btn.textContent = 'Trigger entry click tracking from descendant button'
    card.appendChild(btn)
  }

  const nested = Array.isArray(resolvedEntry.fields?.nested) ? resolvedEntry.fields.nested : []
  if (nested.length > 0) {
    const nestedDiv = document.createElement('div')
    nestedDiv.className = 'entry-card__nested-children'
    for (const child of nested) {
      if (child?.sys?.id) {
        const childEl = document.createElement('ctfl-optimized-entry')
        childEl.dataset.entryId = child.sys.id
        nestedDiv.appendChild(childEl)
        configureOptimizedEntry(childEl, child)
      }
    }
    card.appendChild(nestedDiv)
  }

  return card
}

/* ── Live updates entry renderer ─────────────────────────────────────── */

function renderLiveUpdatesEntry(element, entry) {
  const prefix = element.dataset.liveUpdatesPrefix
  if (!prefix) return false

  const text = getEntryText(entry)
  const content = document.createElement('div')
  content.className = 'entry-card'
  content.dataset.testid = `content-${prefix}`
  content.dataset.testEntryId = entry.sys.id

  const textEl = document.createElement('p')
  textEl.dataset.testid = `entry-text-${prefix}`
  textEl.setAttribute('aria-label', `${text} [Entry: ${entry.sys.id}]`)
  textEl.textContent = text

  const idEl = document.createElement('p')
  idEl.dataset.testid = `entry-id-${prefix}`
  idEl.textContent = `Entry: ${entry.sys.id}`

  content.append(textEl, idEl)
  element.replaceChildren(content)
  return true
}

/* ── Manual view tracking ────────────────────────────────────────────── */

function enableManualViewTracking(element, resolvedEntry, selectedOptimization) {
  const sdk = window.contentfulOptimization
  sdk.tracking.clearElement('views', element)
  sdk.tracking.enableElement('views', element, {
    data: {
      entryId: resolvedEntry.sys.id,
      optimizationId: selectedOptimization?.experienceId,
      sticky: selectedOptimization?.sticky,
      variantIndex: selectedOptimization?.variantIndex,
    },
  })
}

/* ── ctfl-entry-resolved handler ─────────────────────────────────────── */

function handleEntryResolved(event) {
  if (event.target !== event.currentTarget) return
  const element = event.currentTarget
  const rawEntry = element.baselineEntry
  if (!rawEntry) return

  const { entry, selectedOptimization } = event.detail
  const baselineEntryId = element.dataset.entryId ?? rawEntry.sys.id
  const clickScenario = CLICK_SCENARIOS[baselineEntryId]

  if (renderLiveUpdatesEntry(element, entry)) return

  const observation = element.dataset.manualViewTracking === 'true' ? 'manual' : 'auto'
  const card = buildEntryCard(entry, baselineEntryId, observation, clickScenario)

  const section = document.createElement('section')
  section.dataset.testid = `content-entry-${baselineEntryId}`

  if (clickScenario === 'ancestor' && observation === 'auto') {
    const wrapper = document.createElement('div')
    wrapper.dataset.ctflClickable = 'true'
    wrapper.dataset.testid = 'entry-click-ancestor-wrapper'
    wrapper.appendChild(card)
    section.appendChild(wrapper)
  } else {
    section.appendChild(card)
  }

  element.replaceChildren(section)

  if (observation === 'manual') {
    enableManualViewTracking(card, entry, selectedOptimization)
  }
}

function configureOptimizedEntry(element, baselineEntry) {
  if (!configuredEntryElements.has(element)) {
    element.addEventListener('ctfl-entry-resolved', handleEntryResolved)
    configuredEntryElements.add(element)
  }
  element.baselineEntry = baselineEntry
}

export async function initializeAllOptimizedEntries() {
  const elements = Array.from(document.querySelectorAll('ctfl-optimized-entry[data-entry-id]'))
  await Promise.all(
    elements.map(async (el) => {
      if (configuredEntryElements.has(el)) return
      const entryId = el.dataset.entryId
      if (!entryId) return
      const entry = await fetchEntry(entryId)
      if (!entry) return
      configureOptimizedEntry(el, entry)
    }),
  )
}
