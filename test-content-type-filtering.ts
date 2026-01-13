/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-magic-numbers, complexity, promise/avoid-new, @typescript-eslint/use-unknown-in-catch-callback-variable, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-destructuring -- throwaway script */

import { spawn } from 'node:child_process'
import process from 'node:process'

const PORT = 8000
const CONTENTFUL_BASE_URL = `http://localhost:${PORT}/contentful`
const SPACE_ID = 'uelxcuo7v97l'
const ENVIRONMENT_ID = 'master'

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function testContentType(contentType: string): Promise<void> {
  const url = `${CONTENTFUL_BASE_URL}/spaces/${SPACE_ID}/environments/${ENVIRONMENT_ID}/entries?content_type=${contentType}`
  console.log(`\nTesting: ${url}`)

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (response.ok && 'items' in data) {
      console.log(`✓ Success: Found ${data.total} entries of type "${contentType}"`)
      if (data.items && data.items.length > 0) {
        const firstEntry = data.items[0]
        if (firstEntry?.sys?.contentType?.sys?.id) {
          console.log(`  First entry ID: ${firstEntry.sys.id}`)
          console.log(`  Content type verified: ${firstEntry.sys.contentType.sys.id}`)
        }
      }
    } else {
      console.log(`✗ Failed: ${JSON.stringify(data, null, 2)}`)
    }
  } catch (err) {
    console.error(`✗ Error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function main(): Promise<void> {
  console.log('Starting mock server...')
  const serverProcess = spawn('pnpm', ['--filter', 'mocks', 'serve'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  })

  let serverOutput = ''
  serverProcess.stdout?.on('data', (data) => {
    serverOutput += data.toString()
    if (serverOutput.includes('Mock Contentful CDA running')) {
      console.log('Server started!')
    }
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server error: ${data.toString()}`)
  })

  await sleep(3000)

  console.log('\n=== Testing Content Type Filtering ===')

  await testContentType('nt_audience')
  await testContentType('nt_experience')
  await testContentType('mergeTagContent')
  await testContentType('content')
  await testContentType('nonexistent_type')

  console.log('\n=== Testing sys.id (should still work) ===')
  const entryIdUrl = `${CONTENTFUL_BASE_URL}/spaces/${SPACE_ID}/environments/${ENVIRONMENT_ID}/entries?sys.id=7pa5bOx8Z9NmNcr7mISvD`
  console.log(`Testing: ${entryIdUrl}`)
  try {
    const response = await fetch(entryIdUrl)
    const data = await response.json()
    if (response.ok && 'items' in data) {
      console.log(`✓ Success: Found entry by sys.id`)
    } else {
      console.log(`✗ Failed: ${JSON.stringify(data, null, 2)}`)
    }
  } catch (err) {
    console.error(`✗ Error: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log('\n=== Tests Complete ===')
  console.log('Stopping server...')
  serverProcess.kill()
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
