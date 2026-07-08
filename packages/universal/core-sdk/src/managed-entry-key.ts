import type { ContentfulEntryQuery } from './CoreBase'

export const getOptimizedEntrySourceKey = (
  entryId: string,
  query: ContentfulEntryQuery | undefined,
): string =>
  `${entryId}:${JSON.stringify(Object.entries(query ?? {}).sort(([left], [right]) => (left > right ? 1 : -1)))}`
