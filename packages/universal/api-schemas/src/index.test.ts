import * as z from 'zod/mini'

import * as apiSchemas from '.'

function isZodSchema(value: unknown): value is z.ZodMiniType {
  return typeof value === 'object' && value !== null && '_zod' in value
}

describe('public schema exports', () => {
  it('all export to JSON Schema', () => {
    const failures = Object.entries(apiSchemas).flatMap(([name, value]) => {
      if (!isZodSchema(value)) return []

      try {
        z.toJSONSchema(value, {
          cycles: 'ref',
          reused: 'ref',
          target: 'draft-2020-12',
          unrepresentable: 'throw',
        })

        return []
      } catch (error) {
        return [`${name}: ${error instanceof Error ? error.message : String(error)}`]
      }
    })

    expect(failures).toEqual([])
  })
})
