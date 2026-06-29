import type { FetchMethod } from './Fetch'

export const fetchInputToString = (input: Parameters<FetchMethod>[0]): string => {
  if (typeof input === 'string') return input

  return input.url
}
