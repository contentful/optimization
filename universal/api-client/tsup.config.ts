import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'tsup'

const libs = ['logger', 'mocks']
const pkgFile = readFileSync(join(__dirname, 'package.json'), 'utf-8')
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- we know the structure
const pkg = JSON.parse(pkgFile) as { dependencies?: Record<string, unknown> }
const dependencies = Object.keys(pkg.dependencies ?? {})

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: dependencies.filter((dep) => !libs.includes(dep)),
  noExternal: libs,
})
