import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

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
