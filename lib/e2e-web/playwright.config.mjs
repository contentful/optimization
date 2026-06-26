import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'path'

const isCI = Boolean(process.env.CI)

const IMPLEMENTATION = process.env.IMPLEMENTATION ?? null
if (IMPLEMENTATION && !/^[a-z0-9_-]+$/.test(IMPLEMENTATION)) {
  throw new Error(`Invalid IMPLEMENTATION: ${IMPLEMENTATION}`)
}

const IMPL_DIR = IMPLEMENTATION
  ? resolve(import.meta.dirname, '../../implementations', IMPLEMENTATION)
  : null

if (IMPL_DIR) {
  try {
    process.loadEnvFile(resolve(IMPL_DIR, '.env'))
  } catch {
    // .env not present is fine
  }
}

const PORT = process.env.APP_PORT ?? '3000'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10_000 },
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // 'on-first-retry' never writes traces locally (0 retries) — the UI trace viewer
    // hits 404/500 on every snapshot load. Always capture locally so the viewer works.
    trace: isCI ? 'on-first-retry' : 'on',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      name: 'Mocks',
      command: 'pnpm --dir ../mocks serve',
      url: 'http://localhost:8000/health',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'App',
      command: IMPL_DIR ? `pnpm --dir ${IMPL_DIR} serve:e2e` : 'tail -f /dev/null',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
