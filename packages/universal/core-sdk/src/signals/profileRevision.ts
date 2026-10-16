import { profile } from './signals'

let revision = 0

// Follow the shared profile signal, including hydration and preview bridge writes.
profile.subscribe(advanceProfileRevision)

export function advanceProfileRevision(): void {
  revision += 1
}

export function getProfileRevision(): number {
  return revision
}
