/**
 * Network Connectivity Test
 *
 * This test runs FIRST (due to alphabetical ordering) to verify that the
 * mock server is reachable from the app. If this fails, all other tests
 * will likely fail due to network issues.
 */

describe('network connectivity', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  it('should verify mock server is reachable', async () => {
    // Wait for the app to start loading
    // If the app can't reach the mock server, it will show "Loading..." indefinitely
    // or show an error message

    // First, wait for either the loading text or an error
    await waitFor(element(by.text('Loading...')))
      .toBeVisible()
      .withTimeout(10000)

    // Now wait for the loading to complete (identify button appears)
    // This means the SDK initialized and fetched data from the mock server
    await waitFor(element(by.id('identify-button')))
      .toBeVisible()
      .withTimeout(30000)

    // If we get here, the network is working!
    console.log('✅ Network connectivity verified - mock server is reachable')
  })

  it('should display content entries from mock server', async () => {
    // Verify at least one content entry is displayed
    // This confirms the Contentful mock is also working
    await waitFor(element(by.id('entry-text-1MwiFl4z7gkwqGYdvCmr8c')))
      .toBeVisible()
      .withTimeout(30000)

    console.log('✅ Content entries loaded from mock server')
  })
})
