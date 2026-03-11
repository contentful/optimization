// Timeout value for waiting for elements to become visible (in milliseconds)
const ELEMENT_VISIBILITY_TIMEOUT = process.env.CI ? 5000 : 10000

function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout))
}

async function isVisibleById(testId, timeout = 750) {
  try {
    await waitFor(element(by.id(testId)))
      .toBeVisible()
      .withTimeout(timeout)
    return true
  } catch {
    return false
  }
}

async function tapIfVisibleById(testId, timeout = 750) {
  if (!(await isVisibleById(testId, timeout))) {
    return false
  }

  await element(by.id(testId)).tap()
  return true
}

async function getElementTextById(testId) {
  const attributes = await element(by.id(testId)).getAttributes()
  return attributes.text || attributes.label || ''
}

async function waitForElementTextById(testId, predicate, timeout = ELEMENT_VISIBILITY_TIMEOUT) {
  const deadline = Date.now() + timeout
  let lastText = ''

  while (Date.now() < deadline) {
    try {
      await waitFor(element(by.id(testId)))
        .toBeVisible()
        .withTimeout(500)
      const currentText = await getElementTextById(testId)
      lastText = currentText

      if (predicate(currentText)) {
        return currentText
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(150)
  }

  throw new Error(`Timed out waiting for text condition on "${testId}". Last text: "${lastText}"`)
}

async function waitForTextEqualsById(testId, expectedText, timeout = ELEMENT_VISIBILITY_TIMEOUT) {
  return waitForElementTextById(testId, (text) => text === expectedText, timeout)
}

async function waitForTextChangeById(testId, baselineText, timeout = ELEMENT_VISIBILITY_TIMEOUT) {
  return waitForElementTextById(testId, (text) => text !== baselineText, timeout)
}

async function waitForEventsCountAtLeast(minCount, timeout = ELEMENT_VISIBILITY_TIMEOUT) {
  await waitForElementTextById(
    'events-count',
    (text) => {
      const match = /Events:\s*(\d+)/.exec(text)
      if (!match || !match[1]) {
        return false
      }

      return Number(match[1]) >= minCount
    },
    timeout,
  )
}

async function relaunchCleanApp() {
  await device.terminateApp()
  await device.launchApp({ delete: true })
  await waitFor(element(by.id('identify-button')))
    .toBeVisible()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
}

async function clearProfileState(options = {}) {
  const { requireFreshAppInstance = false } = options

  try {
    await tapIfVisibleById('close-live-updates-test-button')
    await tapIfVisibleById('close-navigation-test-button')

    if (requireFreshAppInstance) {
      await relaunchCleanApp()
      return
    }

    // Fast path: reset in-app and keep the current app instance.
    if (await tapIfVisibleById('reset-button', 1500)) {
      await waitFor(element(by.id('identify-button')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      return
    }

    if (await isVisibleById('identify-button', 1500)) {
      return
    }
  } catch {
    // Continue into fallback relaunch below.
  }

  // Fallback if app state is unrecoverable: hard relaunch with clean storage.
  await relaunchCleanApp()
}

async function waitForComponentEventCount(
  componentId,
  minCount,
  timeout = ELEMENT_VISIBILITY_TIMEOUT,
) {
  const testId = `event-count-${componentId}`

  // Ensure the stats section is scrolled into view
  try {
    await element(by.id('main-scroll-view')).scrollTo('top')
  } catch {
    // Scroll may not be possible if view is not scrollable
  }

  try {
    await waitFor(element(by.id(testId)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')
  } catch {
    // May already be visible
  }

  await waitForElementTextById(
    testId,
    (text) => {
      const match = /Count:\s*(\d+)/.exec(text)
      if (!match || !match[1]) {
        return false
      }
      return Number(match[1]) >= minCount
    },
    timeout,
  )
}

async function getComponentViewDuration(componentId) {
  const testId = `event-duration-${componentId}`
  const text = await getElementTextById(testId)
  const match = /Duration:\s*(\d+)/.exec(text)
  return match && match[1] ? Number(match[1]) : null
}

async function getComponentViewId(componentId) {
  const testId = `event-view-id-${componentId}`
  const text = await getElementTextById(testId)
  const match = /ViewId:\s*(.+)/.exec(text)
  return match && match[1] && match[1] !== 'N/A' ? match[1].trim() : null
}

module.exports = {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getComponentViewDuration,
  getComponentViewId,
  getElementTextById,
  isVisibleById,
  sleep,
  tapIfVisibleById,
  waitForComponentEventCount,
  waitForElementTextById,
  waitForEventsCountAtLeast,
  waitForTextChangeById,
  waitForTextEqualsById,
}
