import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const BASELINE = 'This is a baseline content entry for all users.'
const VARIANT = 'This is a variant content entry for new visitors.'

async function grantConsent(context: BrowserContext): Promise<void> {
  await context.addCookies([
    { name: 'astro-optimization-consent', value: 'granted', url: 'http://127.0.0.1:4321' },
  ])
}

function observeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

function observeExperience(page: Page): string[] {
  const payloads: string[] = []
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      (request.url().includes('/experience/') || request.url().includes('/insights/'))
    ) {
      payloads.push(request.postData() ?? '')
    }
  })
  return payloads
}

function renderedArticle(html: string): string {
  return /<article\b[^>]*>[\s\S]*?<\/article>/u.exec(html)?.[0] ?? ''
}

test('keeps baseline and sends no analytics without consent, including after withdrawal', async ({
  page,
}) => {
  const payloads = observeExperience(page)
  const errors = observeErrors(page)
  await page.goto('/')
  await expect(page.getByText('Optimization ready', { exact: true })).toHaveText(
    'Optimization ready',
  )
  await expect(page.getByTestId('personalized-entry')).toContainText(BASELINE)
  await page.getByRole('button', { name: 'Explore this offer' }).click()
  await expect(page.getByTestId('events')).toHaveText('None')
  expect(payloads).toEqual([])
  await page.getByRole('button', { name: 'Allow personalization and analytics' }).click()
  await expect(page.getByTestId('personalized-entry')).toContainText(VARIANT)
  await page.getByRole('button', { name: 'Withdraw consent' }).click()
  await expect(page.getByText('Optimization ready', { exact: true })).toHaveText(
    'Optimization ready',
  )
  await expect(page.getByTestId('personalized-entry')).toContainText(BASELINE)
  await expect(page.getByTestId('events')).toHaveText('None')
  expect(errors).toEqual([])
})

test('serves personalized HTML, hydrates once, sends Insights, and retains identity across documents', async ({
  context,
  page,
}) => {
  await grantConsent(context)
  const errors = observeErrors(page)
  const payloads = observeExperience(page)
  const response = await page.goto('/?campaign=astro')
  if (!response) throw new Error('Expected a document response')
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(renderedArticle(await response.text())).toContain(VARIANT)
  await expect(page.getByText('Optimization ready', { exact: true })).toHaveText(
    'Optimization ready',
  )
  await expect(page.getByTestId('personalized-entry')).toContainText(VARIANT)
  await expect.poll(() => payloads.join('').match(/"type":"page"/gu)?.length ?? 0).toBe(1)
  const cookie = (await context.cookies()).find(({ name }) => name === 'ctfl-opt-aid')
  expect(cookie?.value).toBeTruthy()
  const clickResponse = page.waitForResponse(
    (item) =>
      item.url().includes('/insights/') &&
      (item.request().postData()?.includes('component_click') ?? false),
  )
  await page.getByRole('button', { name: 'Explore this offer' }).click()
  expect((await clickResponse).status()).toBe(204)
  await expect(page.getByTestId('events')).toContainText('track')
  await page.getByRole('button', { name: 'Independent React island: 0' }).click()
  await expect(page.getByRole('button', { name: 'Independent React island: 1' })).toBeVisible()
  await page.getByRole('link', { name: 'Static page', exact: true }).click()
  await expect(page.getByTestId('personalized-entry')).toContainText(VARIANT)
  expect((await context.cookies()).find(({ name }) => name === 'ctfl-opt-aid')?.value).toBe(
    cookie?.value,
  )
  await expect.poll(() => payloads.join('').match(/"type":"page"/gu)?.length ?? 0).toBe(2)
  expect(errors).toEqual([])
})

test('prerenders baseline HTML and personalizes the static route after hydration', async ({
  context,
  page,
}) => {
  await grantConsent(context)
  const errors = observeErrors(page)
  const payloads = observeExperience(page)
  const response = await page.goto('/static?campaign=static')
  if (!response) throw new Error('Expected a document response')
  expect(renderedArticle(await response.text())).toContain(BASELINE)
  await expect(page.getByTestId('personalized-entry')).toContainText(VARIANT)
  await expect.poll(() => payloads.join('').match(/"type":"page"/gu)?.length ?? 0).toBe(1)
  expect(errors).toEqual([])
})

test('identifies a visitor and accepts a custom event through the hydrated SDK', async ({
  context,
  page,
}) => {
  await grantConsent(context)
  const errors = observeErrors(page)
  await page.goto('/')
  await expect(page.getByText('Optimization ready', { exact: true })).toHaveText(
    'Optimization ready',
  )
  await expect(page.getByTestId('personalized-entry')).toContainText(VARIANT)
  const identifyResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/experience/') &&
      (response.request().postData()?.includes('"type":"identify"') ?? false),
  )
  await page.getByRole('button', { name: 'Identify example visitor' }).click()
  expect((await identifyResponse).ok()).toBe(true)
  await expect(page.getByTestId('events')).toContainText('identify')
  await page.getByRole('button', { name: 'Explore this offer' }).click()
  await expect(page.getByTestId('events')).toContainText('track')
  const cookie = (await context.cookies()).find(({ name }) => name === 'ctfl-opt-aid')
  await page.getByRole('link', { name: 'Static page', exact: true }).click()
  await expect(page.getByText('Optimization ready', { exact: true })).toBeVisible()
  await expect(page.getByTestId('events')).toContainText('page')
  expect((await context.cookies()).find(({ name }) => name === 'ctfl-opt-aid')?.value).toBe(
    cookie?.value,
  )
  await page.reload()
  await expect(page.getByTestId('events')).toContainText('page')
  expect((await context.cookies()).find(({ name }) => name === 'ctfl-opt-aid')?.value).toBe(
    cookie?.value,
  )
  expect(errors).toEqual([])
})
