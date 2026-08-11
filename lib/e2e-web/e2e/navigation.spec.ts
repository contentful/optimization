import { type Page, expect, test } from '@playwright/test'

import { PAGES } from '../src/fixtures'
import { hasFlag, implementation, runIfImplementation, skipIf } from './utils'

async function getRecentPageEventUrls(page: Page): Promise<string[]> {
  const pageEvents = page.locator('[data-testid^="event-page-"]')
  const count = await pageEvents.count()
  const urls: string[] = []

  for (let index = 0; index < count; index += 1) {
    const url = await pageEvents.nth(index).getAttribute('data-page-url')
    if (url !== null) {
      urls.push(url)
    }
  }

  return urls
}

test.describe('Navigation', () => {
  skipIf('EDGE')

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('records ordered route sequence including revisits', async ({ page }) => {
    const pageEventLocator = page.locator('[data-testid^="event-page-"]')

    if (!hasFlag('SSR')) {
      await expect(pageEventLocator.first()).toBeVisible()
    }

    const initialUrls = await getRecentPageEventUrls(page)
    const initialPageEventCount = initialUrls.length
    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()

    await expect
      .poll(async () => await pageEventLocator.count())
      .toBeGreaterThan(initialPageEventCount)

    await page.getByTestId('link-back-home').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()

    await expect
      .poll(async () => {
        const urls = await getRecentPageEventUrls(page)
        return urls.slice(0, 3)
      })
      .toEqual(['/page-two', '/', '/page-two'])
  })

  test.describe('client route rendering', () => {
    runIfImplementation(
      'nextjs-sdk_app-router',
      'nextjs-sdk_pages-router',
      'react-web-sdk',
      'web-sdk',
      'web-sdk_angular',
      'web-sdk_react',
    )

    test('waits for page selections before rendering the next route', async ({ page }) => {
      const pageResponse = Promise.withResolvers<undefined>()
      const pageRequest = Promise.withResolvers<undefined>()
      const delaysExperienceResponse =
        implementation === 'react-web-sdk' ||
        implementation === 'web-sdk' ||
        implementation === 'web-sdk_angular' ||
        implementation === 'web-sdk_react'
      const delayedRequestUrl = delaysExperienceResponse
        ? '**/experience/**'
        : implementation === 'nextjs-sdk_app-router'
          ? /\/page-two(?:\?.*)?$/
          : /\/_next\/data\/[^/]+\/page-two\.json(?:\?.*)?$/

      await page.route(delayedRequestUrl, async (route) => {
        if (delaysExperienceResponse && !route.request().postData()?.includes('/page-two')) {
          await route.continue()
          return
        }

        pageRequest.resolve(undefined)
        await pageResponse.promise
        await route.continue()
      })

      if (!delaysExperienceResponse) {
        await page.reload()
        await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
      }

      await page.getByTestId('link-page-two').click()
      await pageRequest.promise
      try {
        const pageTwoView = page.getByTestId('page-two-view')

        if (implementation === 'react-web-sdk') {
          await expect(pageTwoView).toBeVisible()
          await expect(
            pageTwoView.locator('[data-ctfl-loading-layout-target="true"]').first(),
          ).toHaveCSS('visibility', 'hidden')
        } else {
          await expect(pageTwoView).toHaveCount(0)
        }
      } finally {
        pageResponse.resolve(undefined)
      }

      await expect(page).toHaveURL(/\/page-two$/)
      await expect(page.getByTestId('page-two-view')).toBeVisible()
      await expect(
        page.getByTestId('page-two-view').getByTestId(`content-${PAGES.pageTwo.auto}`),
      ).toBeVisible()
    })
  })

  test.describe('Angular active request settlement', () => {
    runIfImplementation('web-sdk_angular')

    test('waits for a newer Experience request before finishing navigation', async ({ page }) => {
      const pageResponse = Promise.withResolvers<undefined>()
      const pageRequest = Promise.withResolvers<undefined>()
      const identifyResponse = Promise.withResolvers<undefined>()
      const identifyRequest = Promise.withResolvers<undefined>()

      await page.route('**/experience/**', async (route) => {
        const requestBody = route.request().postData()
        if (requestBody?.includes('"type":"page"') && requestBody.includes('/page-two')) {
          pageRequest.resolve(undefined)
          await pageResponse.promise
        } else if (requestBody?.includes('"type":"identify"')) {
          identifyRequest.resolve(undefined)
          await identifyResponse.promise
        }
        await route.continue()
      })

      try {
        await page.getByTestId('link-page-two').click()
        await pageRequest.promise
        await page.getByTestId('identify-button').click()
        await identifyRequest.promise

        pageResponse.resolve(undefined)
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                resolve()
              }),
            )
          })
        })

        await expect(page).toHaveURL(/\/$/)
        await expect(page.getByTestId('page-two-view')).toHaveCount(0)

        identifyResponse.resolve(undefined)
        await expect(page).toHaveURL(/\/page-two$/)
        await expect(page.getByTestId('page-two-view')).toBeVisible()
      } finally {
        pageResponse.resolve(undefined)
        identifyResponse.resolve(undefined)
      }
    })
  })

  test.describe('baseline-safe client route rendering', () => {
    runIfImplementation('web-sdk', 'web-sdk_angular', 'web-sdk_react')

    test('renders the next route when its page request fails', async ({ page }) => {
      const isDirectWebSdk = implementation === 'web-sdk' || implementation === 'web-sdk_react'
      await page.route('**/experience/**', async (route) => {
        const requestBody = route.request().postData()
        const failsDirectHomeRoute = isDirectWebSdk && requestBody?.includes('"url":"/"')
        if (requestBody?.includes('/page-two') === true || failsDirectHomeRoute) {
          await route.abort()
          return
        }

        await route.continue()
      })

      if (isDirectWebSdk) {
        await page.getByTestId('consent-button').click()
        await expect(page.getByTestId('unconsent-button')).toBeVisible()
      }

      await page.getByTestId('link-page-two').click()

      await expect(page).toHaveURL(/\/page-two$/)
      await expect(page.getByTestId('page-two-view')).toBeVisible()
      await expect(page.getByTestId(`entry-text-${PAGES.pageTwo.auto}`)).toContainText(
        'This is a baseline content entry for all users.',
      )
      await expect(page.getByTestId(`entry-text-${PAGES.pageTwo.manual}`)).toContainText(
        'This is a baseline content entry for an A/B/C experiment: A',
      )
      await expect(page.getByTestId(`content-${PAGES.pageTwo.auto}`)).not.toHaveAttribute(
        'data-ctfl-optimization-id',
        /.+/,
      )
      await expect(page.getByTestId(`content-${PAGES.pageTwo.manual}`)).not.toHaveAttribute(
        'data-ctfl-optimization-id',
        /.+/,
      )

      if (isDirectWebSdk) {
        await page.getByTestId('link-back-home').click()

        await expect(page).toHaveURL(/\/$/)
        await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
        await expect(page.getByTestId(`entry-text-${PAGES.home.auto[1]}`)).toContainText('Nowhere')
      }
    })
  })

  test.describe('direct Web SDK responses', () => {
    runIfImplementation('web-sdk', 'web-sdk_react')

    test('does not render a stale route when page responses finish out of order', async ({
      page,
    }) => {
      const homeResponse = Promise.withResolvers<undefined>()
      const homeRequest = Promise.withResolvers<undefined>()
      const pageTwoResponse = Promise.withResolvers<undefined>()
      const pageTwoRequest = Promise.withResolvers<undefined>()

      await page.route('**/experience/**', async (route) => {
        const requestBody = route.request().postData()
        if (requestBody?.includes('"url":"/page-two"')) {
          pageTwoRequest.resolve(undefined)
          await pageTwoResponse.promise
        } else if (requestBody?.includes('"url":"/"')) {
          homeRequest.resolve(undefined)
          await homeResponse.promise
        }

        await route.continue()
      })

      await page.getByTestId('link-page-two').click()
      await pageTwoRequest.promise
      await page.getByTestId('link-home').click()
      await homeRequest.promise

      const completedHomeResponse = page.waitForResponse(
        (response) => response.request().postData()?.includes('"url":"/"') ?? false,
      )
      homeResponse.resolve(undefined)
      await (await completedHomeResponse).finished()

      const completedPageTwoResponse = page.waitForResponse(
        (response) => response.request().postData()?.includes('"url":"/page-two"') ?? false,
      )
      pageTwoResponse.resolve(undefined)
      await (await completedPageTwoResponse).finished()
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      })

      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
      await expect(page.getByTestId('page-two-view')).toHaveCount(0)
    })
  })
})
