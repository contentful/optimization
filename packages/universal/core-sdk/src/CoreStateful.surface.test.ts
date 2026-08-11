import { expect, it } from '@rstest/core'
import CoreStateful from './CoreStateful'

class CoreStatefulSurfaceProbe extends CoreStateful {
  assertInternalMutationIsPrivate(): void {
    // @ts-expect-error -- Subclasses must not access the mutable current-state coordinator.
    void this.currentStateCoordinator
    // @ts-expect-error -- Subclasses must not access the mutable Experience queue.
    void this.experienceQueue
  }
}

it('keeps mutable current-state internals out of the subclass surface', () => {
  expect(CoreStatefulSurfaceProbe).toBeDefined()
})
