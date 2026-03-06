/* eslint-disable no-console -- CLI */

import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const GENERATED_FILENAME = 'contentful-generated.d.ts'
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const MOCKS_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '..')
const REPOSITORY_ROOT_DIRECTORY = path.resolve(MOCKS_DIRECTORY, '../..')
const IMPLEMENTATIONS_DIRECTORY = path.join(REPOSITORY_ROOT_DIRECTORY, 'implementations')
const GENERATED_DEFINITION_PATH = path.join(MOCKS_DIRECTORY, 'src', GENERATED_FILENAME)

function getImplementationSourceDirectories(): readonly string[] {
  const implementationEntries = readdirSync(IMPLEMENTATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))

  return implementationEntries.map((entry) => {
    const implementationDirectory = path.join(IMPLEMENTATIONS_DIRECTORY, entry.name)
    const srcDirectory = path.join(implementationDirectory, 'src')
    return existsSync(srcDirectory) ? srcDirectory : implementationDirectory
  })
}

function copyGeneratedDefinition(targetDirectories: readonly string[]): void {
  for (const targetDirectory of targetDirectories) {
    const destinationPath = path.join(targetDirectory, GENERATED_FILENAME)
    copyFileSync(GENERATED_DEFINITION_PATH, destinationPath)
    const relativePath = path.relative(REPOSITORY_ROOT_DIRECTORY, destinationPath)
    console.info(`Copied generated definition to ${relativePath}`)
  }
}

function main(): void {
  if (!existsSync(GENERATED_DEFINITION_PATH)) {
    throw new Error(
      `Missing generated definition at ${GENERATED_DEFINITION_PATH}. Run "pnpm --dir lib/mocks generate:ctfl:types" first.`,
    )
  }

  const targetDirectories = getImplementationSourceDirectories()
  copyGeneratedDefinition(targetDirectories)
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  console.error(message)
  process.exit(1)
}
