import { copyFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const DTS_SUFFIX = '.d.ts'

/**
 * Copies each generated root-level `*.d.ts` file to both `.d.mts` and `.d.cts`
 * variants so that the package exposes type declarations for ESM and CJS
 * consumers.
 *
 * @param distDir - Path to the distribution directory containing declaration files.
 * @returns Nothing.
 * @throws Error if no root-level `*.d.ts` files exist in `distDir`.
 *
 * @example
 * ```typescript
 * import { emitDualDts } from 'build-tools'
 *
 * emitDualDts('./dist')
 * ```
 *
 * @public
 */
export function emitDualDts(distDir: string): void {
  const declarationFiles = readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(DTS_SUFFIX))
    .map((entry) => entry.name)

  if (declarationFiles.length === 0) {
    throw new Error(`Could not find generated declaration files in dist root: ${resolve(distDir)}`)
  }

  for (const declarationFile of declarationFiles) {
    const baseName = declarationFile.slice(0, -DTS_SUFFIX.length)
    const sourceFile = resolve(distDir, declarationFile)
    const esmTypesFile = resolve(distDir, `${baseName}.d.mts`)
    const cjsTypesFile = resolve(distDir, `${baseName}.d.cts`)

    copyFileSync(sourceFile, esmTypesFile)
    copyFileSync(sourceFile, cjsTypesFile)
  }
}
