import { Injectable, signal } from '@angular/core'
import { ENTRY_NAMES } from '../fixtures'

@Injectable({ providedIn: 'root' })
export class NgEntryRegistry {
  private readonly registry = signal<Record<string, string>>({})

  register(resolvedId: string, baselineId: string): void {
    const name = ENTRY_NAMES[baselineId] ?? ENTRY_NAMES[resolvedId]
    if (name === undefined) return
    this.registry.update((r) => ({ ...r, [resolvedId]: name }))
  }

  resolve(id: string): string | undefined {
    return ENTRY_NAMES[id] ?? this.registry()[id]
  }
}
