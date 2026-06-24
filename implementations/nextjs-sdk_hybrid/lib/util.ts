export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function toIdMap<T extends { sys: { id: string } }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.sys.id, item]))
}
