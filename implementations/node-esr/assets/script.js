/* --- Standard Rendering Code --- */

window.optimization = optimization
optimization.personalization.page();


function isRichText(field) {
  return field && typeof field === 'object' && field.content !== undefined
}

// Barebones "Rich Text" renderer
// Full renderer must be customer-supplied, or rendered via ctfl Rich Text libs where possible
function simpleRenderRichText(field, parent) {
  if (!field || typeof field !== 'object') return
  if (!parent || !(parent instanceof HTMLElement)) return

  if (field.nodeType === 'document') {
    field.content.forEach((content) => simpleRenderRichText(content, parent))
  } else if (field.nodeType === 'paragraph') {
    const p = document.createElement('p')
    field.content.forEach((content) => simpleRenderRichText(content, p))
    parent.appendChild(p)
  } else if (field.nodeType === 'text') {
    const span = document.createElement('span')
    span.innerText = field.value
    parent.appendChild(span)
  } else if (field.nodeType === 'embedded-entry-inline') {
    const span = document.createElement('span')

    // This is how we can inject MergeTag data into Rich Text
    span.innerText = optimization.personalization.getMergeTagValue(field.data.target)

    parent.appendChild(span)
  } else {
    const span = document.createElement('span')
    span.innerText = '[unknown rich text fragment]'
    parent.appendChild(span)
  }
}

// Render personalized entries
async function renderPersonalizedEntry(rawEntry, element, autoObserve = true) {
  const { entry, personalization } = optimization.personalization.personalizeEntry(rawEntry)

  if (isRichText(entry.fields?.text)) {
    const div = document.createElement('div')
    simpleRenderRichText(entry.fields.text, div)
    element.replaceChildren(div)
  } else {
    const p = document.createElement('p')
    p.innerText = entry.fields?.text
    element.replaceChildren(p)
  }

  if (entry.fields?.nested) {
    const div = document.createElement('div')
    div.className = 'nested'
    entry.fields.nested.forEach((nestedEntry) =>
      renderPersonalizedEntry(nestedEntry, div, autoObserve),
    )
    element.appendChild(div)
  }

  // NOTE: Elements that are not auto-observed may still be auto-tracked (see below)
  if (autoObserve) {
    // The `data-ctfl - entry - id` data attribute is required for auto-observing
    element.dataset.ctflEntryId = entry.sys?.id

    // Other standard auto-observing attributes are optional
    if (personalization) {
      element.dataset.ctflPersonalizationId = personalization?.experienceId
      element.dataset.ctflSticky = personalization?.sticky
      element.dataset.ctflVariantIndex = personalization?.variantIndex
    }
  }

  return [entry, personalization]
}

// Get the personalized entry to render
async function addPersonalizedEntry(entryId, element, autoObserve = true) {
  try {
    const entry = await contentfulClient.getEntry(entryId, { include: 10 })
    return renderPersonalizedEntry(entry, element, autoObserve)
  } catch (error) {
    console.warn(`Entry "${entryId}" could not be found in the current space`)
    return []
  }
}

// Manually observe view elements for auto-tracking
async function manuallyObserveEntryElement(element) {
  const [entry, personalization] = await addPersonalizedEntry(
    element.dataset.entryId,
    element,
    false,
  )

  optimization.untrackEntryViewForElement(element)

  // Manually observe the element for auto-tracking (does not use `data - ctfl -* ` attributes)
  optimization.trackEntryViewForElement(element, {
    data: {
      // The `entryId` property is required for auto-tracking
      entryId: entry.sys.id,
      personalizationId: personalization?.experienceId,
      sticky: personalization?.sticky,
      variantIndex: personalization?.variantIndex,
    },
  })
}

// Subscribe to profile state, find entries in the markup, and render them
optimization.states.profile.subscribe((profile) => {
  if (!profile) return

  document.querySelectorAll('[data-ctfl-entry-id]').forEach((element) => addPersonalizedEntry(element.dataset.ctflEntryId, element))

  document.querySelectorAll('[data-entry-id]').forEach(manuallyObserveEntryElement)
})
