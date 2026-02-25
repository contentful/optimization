import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Copies the generated `index.d.ts` to both `.d.mts` and `.d.cts` variants so
 * that the package exposes type declarations for ESM and CJS consumers.
 *
 * @param distDir - Path to the distribution directory containing `index.d.ts`.
 * @returns Nothing.
 * @throws Error if `index.d.ts` does not exist in `distDir`.
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
  const sourceFile = resolve(distDir, 'index.d.ts')
  const esmTypesFile = resolve(distDir, 'index.d.mts')
  const cjsTypesFile = resolve(distDir, 'index.d.cts')

  if (!existsSync(sourceFile)) {
    throw new Error(`Could not find generated declaration file: ${sourceFile}`)
  }

  copyFileSync(sourceFile, esmTypesFile)
  copyFileSync(sourceFile, cjsTypesFile)
}
