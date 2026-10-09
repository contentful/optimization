import { expect, test, type Page } from '@playwright/test'
import { CUSTOMER_SEGMENTS } from '../src/fixtures'
import { CONSENT_COOKIE, PROFILE_COOKIE, runIf, runIfImplementation } from './utils'

const newVisitor = CUSTOMER_SEGMENTS['new-visitor']
const baseline = CUSTOMER_SEGMENTS.baseline

async function expectSelectedEntry(
  page: Page,
  segment: typeof newVisitor | typeof baseline,
): Promise<void> {
  const entry = page.getByTestId('edge-rendered-entry')
  await expect(entry).toContainText(segment.resolvedEntryText)
  await expect(entry).toHaveAttribute('data-ctfl-baseline-id', segment.baselineEntryId)
  await expect(entry).toHaveAttribute('data-ctfl-entry-id', segment.variantEntryId)

  const selection = segment.selectedOptimizations.find((candidate) =>
    Object.prototype.hasOwnProperty.call(candidate.variants, segment.baselineEntryId),
  )
  if (selection === undefined) {
    await expect(entry).not.toHaveAttribute('data-ctfl-optimization-id', /.+/)
    await expect(entry).toHaveAttribute('data-ctfl-variant-index', '0')
    return
  }
  await expect(entry).toHaveAttribute('data-ctfl-optimization-id', selection.experienceId)
  await expect(entry).toHaveAttribute('data-ctfl-variant-index', String(selection.variantIndex))
}

test.describe('Edge rendered consumer', () => {
  runIf('EDGE')
  runIfImplementation('nextjs-sdk_app-router_edge-runtime')

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('renders request-selected content before consent without persisting a profile', async ({
      context,
      page,
    }) => {
      const response = await page.goto('/edge-render/private?utm_source=edge-reference')
      expect(response?.ok()).toBe(true)
      await expect(page).toHaveURL(/\/edge-render\/private\?utm_source=edge-reference$/)
      await expect(page.getByRole('heading', { name: 'Personalized Edge request' })).toBeVisible()
      await expectSelectedEntry(page, newVisitor)
      expect((await context.cookies()).some(({ name }) => name === PROFILE_COOKIE)).toBe(false)
    })

    for (const segment of [newVisitor, baseline]) {
      test(`renders the ${segment.slug} public permutation`, async ({ page }) => {
        const response = await page.goto(`/edge-render/public/${segment.slug}`)
        expect(response?.ok()).toBe(true)
        await expectSelectedEntry(page, segment)
      })
    }
  })

  test('preserves the Edge-issued profile cookie and selected content through browser commitment', async ({
    baseURL,
    context,
    page,
  }) => {
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    await context.addCookies([{ name: CONSENT_COOKIE, value: 'granted', url: baseURL }])
    const handoffResponse = await context.request.get('/edge-request')
    expect(handoffResponse.ok()).toBe(true)
    const profileId = (await context.cookies()).find(({ name }) => name === PROFILE_COOKIE)?.value
    expect(profileId).toBeTruthy()

    const delivery = page.waitForResponse(
      (response) =>
        response.url().includes('/experience/') &&
        response.request().method() === 'POST' &&
        response.ok(),
    )
    await page.goto('/edge-render/private?utm_source=edge-reference')
    await expect(page).toHaveURL(/\/edge-render\/private\?utm_source=edge-reference$/)
    await expectSelectedEntry(page, newVisitor)
    await expect(page.getByTestId('edge-consent-status')).toHaveText('Consent: Yes')
    await delivery
    await expect(page.getByTestId('edge-last-event')).toHaveText('Latest event: page')
    await expect
      .poll(
        async () => (await context.cookies()).find(({ name }) => name === PROFILE_COOKIE)?.value,
      )
      .toBe(profileId)
    await expectSelectedEntry(page, newVisitor)
    expect(browserErrors).toEqual([])
  })

  test('keeps public selection visible while the browser root handles consent and navigation', async ({
    context,
    page,
  }) => {
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    await page.goto('/edge-render/public/new-visitor')
    await expectSelectedEntry(page, newVisitor)
    await page.getByRole('button', { name: 'Grant personalization consent' }).click()
    await expect(page.getByTestId('edge-consent-status')).toHaveText('Consent: Yes')
    await expectSelectedEntry(page, newVisitor)

    await page.getByRole('link', { name: 'View personalized Edge request' }).click()
    await expect(page).toHaveURL(/\/edge-render\/private$/)
    await expectSelectedEntry(page, newVisitor)
    await expect
      .poll(
        async () => (await context.cookies()).find(({ name }) => name === PROFILE_COOKIE)?.value,
      )
      .toBeTruthy()
    const profileId = (await context.cookies()).find(({ name }) => name === PROFILE_COOKIE)?.value
    await page.reload()
    await expectSelectedEntry(page, newVisitor)
    await expect
      .poll(
        async () => (await context.cookies()).find(({ name }) => name === PROFILE_COOKIE)?.value,
      )
      .toBe(profileId)

    await page.getByRole('link', { name: 'View public Edge selection' }).click()
    await expect(page).toHaveURL(/\/edge-render\/public\/new-visitor$/)
    await expectSelectedEntry(page, newVisitor)
    await expect(page.getByTestId('edge-consent-status')).toHaveText('Consent: Yes')
    expect(browserErrors).toEqual([])
  })
})
