import type { ReactElement } from 'react'
import { isRecord } from './typeGuards'

export interface TestRendererModule<TRenderer> {
  create: (element: ReactElement) => TRenderer
}

export function isTestRendererModule<TRenderer>(
  value: unknown,
): value is TestRendererModule<TRenderer> {
  return isRecord(value) && typeof Reflect.get(value, 'create') === 'function'
}

export async function loadTestRenderer<TRenderer>(): Promise<TestRendererModule<TRenderer>> {
  const moduleName = 'react-test-renderer'
  const testRendererModule: unknown = await import(moduleName)

  if (!isTestRendererModule<TRenderer>(testRendererModule)) {
    throw new Error('Expected react-test-renderer to expose create().')
  }

  return testRendererModule
}
