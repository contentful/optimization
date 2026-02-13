import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PackageJson } from 'type-fest'

export function hasPackageName(
  packageJson: unknown,
): packageJson is PackageJson & { name: string } {
  return (
    typeof packageJson === 'object' &&
    packageJson !== null &&
    typeof Reflect.get(packageJson, 'name') === 'string'
  )
}

export function getPackageName(packageDir: string, fallbackName: string): string {
  const packageJsonContent: unknown = JSON.parse(
    readFileSync(resolve(packageDir, 'package.json'), 'utf-8'),
  )

  if (hasPackageName(packageJsonContent)) {
    return packageJsonContent.name
  }

  return fallbackName
}
