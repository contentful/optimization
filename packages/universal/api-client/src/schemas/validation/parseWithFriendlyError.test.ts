import * as z from 'zod/mini'

import { parseWithFriendlyError } from '.'

describe('en locale messages', () => {
  it('produces descriptive error messages instead of generic "Invalid input"', () => {
    const schema = z.object({ userId: z.string() })

    expect(() => parseWithFriendlyError(schema, { userId: 123 })).toThrow('expected string')
  })

  it('includes received type in error messages', () => {
    expect(() => parseWithFriendlyError(z.number(), 'hello')).toThrow('received string')
  })

  it('does not change error messages for schemas parsed outside the SDK', () => {
    const result = z.object({ userId: z.string() }).safeParse({ userId: 123 })

    if (result.success) throw new Error('Expected failure')

    expect(result.error.issues[0]?.message).toBe('Invalid input')
  })
})

describe('z.prettifyError', () => {
  it('formats errors with paths and descriptive messages', () => {
    const schema = z.object({
      userId: z.string(),
      count: z.number(),
    })
    const result = schema.safeParse({ count: 'bad' })

    if (result.success) throw new Error('Expected failure')

    const pretty = z.prettifyError(result.error)
    expect(pretty).toContain('userId')
    expect(pretty).toContain('count')
    expect(pretty).toContain('→ at')
  })

  it('formats nested path errors', () => {
    const schema = z.object({
      context: z.object({ locale: z.string() }),
    })
    const result = schema.safeParse({ context: { locale: 42 } })

    if (result.success) throw new Error('Expected failure')

    const pretty = z.prettifyError(result.error)
    expect(pretty).toContain('context.locale')
  })

  it('formats root-level type errors without path', () => {
    expect(() => parseWithFriendlyError(z.string(), 123)).toThrow('expected string')
    expect(() => parseWithFriendlyError(z.string(), 123)).not.toThrow('→ at')
  })
})

describe('validate', () => {
  it('returns parsed data on valid input', () => {
    const schema = z.object({ name: z.string(), age: z.number() })
    const result = parseWithFriendlyError(schema, { name: 'Alice', age: 30 })

    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('throws an Error (not ZodError) with prettified message on invalid input', () => {
    const schema = z.object({ userId: z.string(), count: z.number() })

    expect(() => parseWithFriendlyError(schema, { count: 'bad' })).toThrow(Error)

    try {
      parseWithFriendlyError(schema, { count: 'bad' })
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      if (error instanceof Error) {
        expect(error.message).toContain('userId')
        expect(error.message).toContain('count')
      }
    }
  })

  it('includes nested paths in the error message', () => {
    const schema = z.object({
      context: z.object({ locale: z.string() }),
    })

    try {
      parseWithFriendlyError(schema, { context: { locale: 42 } })
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain('context.locale')
      }
    }
  })

  it('preserves schema output types', () => {
    const schema = z.object({
      value: z.prefault(z.number(), 0),
    })
    const result = parseWithFriendlyError(schema, {})

    expect(result.value).toBe(0)
  })
})
