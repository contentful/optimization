const rawEventsCountEl = document.getElementById('raw-events-count')
const noEventsMsg = document.getElementById('no-events-message')
const trackingTable = document.getElementById('tracking-table')
const trackingTbody = document.getElementById('tracking-tbody')

let rawEventCount = 0
const viewEventRows = new Map()
const hoverEventRows = new Map()

function timeAgo(startMs) {
  const s = Math.floor((Date.now() - startMs) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`
}

function toTestId(event, rowCount) {
  if (typeof event.viewId === 'string') return `event-view-${event.viewId}`
  if (typeof event.hoverId === 'string') return `event-${event.type}-hover-${event.hoverId}`
  if (typeof event.componentId === 'string') return `event-${event.type}-${event.componentId}`
  if (event.type === 'page') return `event-page-${event.messageId ?? rowCount}`
  return `event-${event.type ?? 'unknown'}-${event.messageId ?? rowCount}`
}

function toBadgeType(event) {
  if (event.type === 'component' && event.viewId) return 'view'
  if (event.type === 'component_hover') return 'hover'
  if (event.type === 'page') return 'page'
  if (event.type === 'component') return 'comp'
  return event.type
}

function toValue(event) {
  if (event.componentId) return event.componentId
  if (event.type === 'page' && event.properties?.url) {
    try {
      return new URL(event.properties.url, window.location.origin).pathname
    } catch {
      return event.properties.url
    }
  }
  return event.type
}

function toDurationText(event) {
  const ms = event.hoverDurationMs ?? event.viewDurationMs
  return ms !== undefined ? `${(ms / 1000).toFixed(1)}s` : ''
}

function createTrackingRow(event) {
  const rowCount = trackingTbody.rows.length
  const tr = document.createElement('tr')
  tr.dataset.testid = toTestId(event, rowCount)
  if (event.hoverId) tr.dataset.hoverId = event.hoverId
  if (event.hoverDurationMs !== undefined)
    tr.dataset.hoverDurationMs = String(event.hoverDurationMs)
  if (event.viewDurationMs !== undefined) tr.dataset.viewDurationMs = String(event.viewDurationMs)
  if (event.type === 'page' && event.properties?.url) {
    try {
      tr.dataset.pageUrl = new URL(event.properties.url, window.location.origin).pathname
    } catch {
      tr.dataset.pageUrl = event.properties.url
    }
  }
  const badgeType = toBadgeType(event)
  tr.innerHTML = `
    <td><span class="tracking-log__type tracking-log__type--${badgeType}">${badgeType}</span></td>
    <td class="tracking-log__label">${toValue(event)}</td>
    <td class="tracking-log__duration">${toDurationText(event)}</td>
    <td class="tracking-log__time">${timeAgo(Date.now())}</td>
    <td class="tracking-log__count"></td>`
  return tr
}

function updateTrackingRow(tr, event) {
  tr.dataset.testid = toTestId(event, 0)
  if (event.hoverId) tr.dataset.hoverId = event.hoverId
  if (event.hoverDurationMs !== undefined)
    tr.dataset.hoverDurationMs = String(event.hoverDurationMs)
  if (event.viewDurationMs !== undefined) tr.dataset.viewDurationMs = String(event.viewDurationMs)
  if (tr.cells[2]) tr.cells[2].textContent = toDurationText(event)
}

export function onAnalyticsEvent(event) {
  if (!event) return
  rawEventCount += 1
  rawEventsCountEl.textContent = String(rawEventCount)
  noEventsMsg.style.display = 'none'
  trackingTable.style.display = ''

  const isViewHeartbeat =
    event.type === 'component' &&
    typeof event.viewId === 'string' &&
    typeof event.viewDurationMs === 'number'
  const isHoverHeartbeat =
    event.type === 'component_hover' &&
    typeof event.hoverId === 'string' &&
    typeof event.hoverDurationMs === 'number'

  if (isViewHeartbeat) {
    const existing = viewEventRows.get(event.viewId)
    if (existing) {
      updateTrackingRow(existing, event)
      return
    }
    const tr = createTrackingRow(event)
    viewEventRows.set(event.viewId, tr)
    trackingTbody.prepend(tr)
    return
  }

  if (isHoverHeartbeat) {
    const existing = hoverEventRows.get(event.hoverId)
    if (existing) {
      updateTrackingRow(existing, event)
      return
    }
    const tr = createTrackingRow(event)
    hoverEventRows.set(event.hoverId, tr)
    trackingTbody.prepend(tr)
    return
  }

  trackingTbody.prepend(createTrackingRow(event))
}
