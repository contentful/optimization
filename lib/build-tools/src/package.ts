import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PackageJson } from 'type-fest'

/**
 * Type guard that checks whether a value is a `PackageJson` object with a `name` field.
 *
 * @param packageJson - The value to check.
 * @returns `true` if the value is a `PackageJson` with a string `name` property.
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(raw)
 * if (hasPackageName(data)) {
 *   console.log(data.name)
 * }
 * ```
 *
 * @public
 */
export function hasPackageName(
  packageJson: unknown,
): packageJson is PackageJson & { name: string } {
  return (
    typeof packageJson === 'object' &&
    packageJson !== null &&
    typeof Reflect.get(packageJson, 'name') === 'string'
  )
}

/**
 * Reads `package.json` from the given directory and returns its `name` field,
 * falling back to `fallbackName` when the name is absent.
 *
 * @param packageDir - Directory containing `package.json`.
 * @param fallbackName - Value returned when the package has no `name` field.
 * @returns The resolved package name.
 *
 * @example
 * ```typescript
 * const name = getPackageName('./packages/foo', 'unknown-package')
 * ```
 *
 * @public
 */
export function getPackageName(packageDir: string, fallbackName: string): string {
  const packageJsonContent: unknown = JSON.parse(
    readFileSync(resolve(packageDir, 'package.json'), 'utf-8'),
  )

  if (hasPackageName(packageJsonContent)) {
    return packageJsonContent.name
  }

  return fallbackName
}
