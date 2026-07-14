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
 * Type guard that checks whether a value is a `PackageJson` object with a `version` field.
 *
 * @param packageJson - The value to check.
 * @returns `true` if the value is a `PackageJson` with a string `version` property.
 *
 * @public
 */
export function hasPackageVersion(
  packageJson: unknown,
): packageJson is PackageJson & { version: string } {
  return (
    typeof packageJson === 'object' &&
    packageJson !== null &&
    typeof Reflect.get(packageJson, 'version') === 'string'
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
  const packageJsonContent = readPackageJson(packageDir)

  if (hasPackageName(packageJsonContent)) {
    return packageJsonContent.name
  }

  return fallbackName
}

/**
 * Reads `package.json` from the given directory and returns its `version` field,
 * falling back to `fallbackVersion` when the version is absent.
 *
 * @param packageDir - Directory containing `package.json`.
 * @param fallbackVersion - Value returned when the package has no `version` field.
 * @returns The resolved package version.
 *
 * @public
 */
export function getPackageVersion(packageDir: string, fallbackVersion: string): string {
  const packageJsonContent = readPackageJson(packageDir)

  if (hasPackageVersion(packageJsonContent)) {
    return packageJsonContent.version
  }

  return fallbackVersion
}

function readPackageJson(packageDir: string): unknown {
  return JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf-8'))
}
