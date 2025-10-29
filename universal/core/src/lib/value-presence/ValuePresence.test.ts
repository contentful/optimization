// ValuePresence.test.ts
import ValuePresence from './ValuePresence'

describe('ValuePresence', () => {
  it('returns false when context does not exist', () => {
    const vp = new ValuePresence()
    expect(vp.isPresent('missing', 'anything')).toBe(false)
  })

  it('initializes from defaultMap and checks presence correctly', () => {
    const vp = new ValuePresence({
      fruits: ['apple', 'banana'],
      numbers: [1, 2],
    })

    expect(vp.isPresent('fruits', 'apple')).toBe(true)
    expect(vp.isPresent('fruits', 'pear')).toBe(false)

    expect(vp.isPresent('numbers', 1)).toBe(true)
    // Type and value must match; string "1" is not the number 1
    expect(vp.isPresent('numbers', '1')).toBe(false)
  })

  it('adds a value to a new context', () => {
    const vp = new ValuePresence()

    vp.addValue('colors', 'red')
    expect(vp.isPresent('colors', 'red')).toBe(true)
    expect(vp.isPresent('colors', 'blue')).toBe(false)
  })

  it('adds a value to an existing (pre-initialized) context', () => {
    // Pre-initialize with an empty array to exercise the "existing Set" branch
    const vp = new ValuePresence({ animals: [] })

    expect(vp.isPresent('animals', 'cat')).toBe(false)
    vp.addValue('animals', 'cat')
    expect(vp.isPresent('animals', 'cat')).toBe(true)

    // Adding the same value again should still be present (Set semantics)
    vp.addValue('animals', 'cat')
    expect(vp.isPresent('animals', 'cat')).toBe(true)
  })

  it('treats object identity correctly (reference equality in Set)', () => {
    const vp = new ValuePresence()
    const obj1 = { a: 1 }
    const obj2 = { a: 1 } // distinct reference

    vp.addValue('objs', obj1)
    expect(vp.isPresent('objs', obj1)).toBe(true)
    expect(vp.isPresent('objs', obj2)).toBe(false)
  })

  it('handles duplicate values in defaultMap via Set semantics', () => {
    const vp = new ValuePresence({ dupes: ['x', 'x', 'y'] })
    expect(vp.isPresent('dupes', 'x')).toBe(true)
    expect(vp.isPresent('dupes', 'y')).toBe(true)
    expect(vp.isPresent('dupes', 'z')).toBe(false)
  })
})
