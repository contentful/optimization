import { toPositiveInt, toRatio } from './number'

describe('number utils', () => {
  describe('toPositiveInt', () => {
    it('returns fallback when value is undefined', () => {
      expect(toPositiveInt(undefined, 10)).toBe(10)
    })

    it('returns fallback when value is invalid', () => {
      expect(toPositiveInt(Number.NaN, 10)).toBe(10)
      expect(toPositiveInt(0, 10)).toBe(10)
      expect(toPositiveInt(-1, 10)).toBe(10)
    })

    it('returns floored positive integer when value is valid', () => {
      expect(toPositiveInt(12.9, 10)).toBe(12)
    })
  })

  describe('toRatio', () => {
    it('returns fallback when value is undefined', () => {
      expect(toRatio(undefined, 0.2)).toBe(0.2)
    })

    it('clamps value to the [0, 1] interval', () => {
      expect(toRatio(-2, 0.2)).toBe(0)
      expect(toRatio(0.5, 0.2)).toBe(0.5)
      expect(toRatio(10, 0.2)).toBe(1)
    })
  })
})
