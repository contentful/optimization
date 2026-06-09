import { Component, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NgContentfulLiveUpdates, NgContentfulOptimization } from '@contentful/optimization-angular'
import { map } from 'rxjs'

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.html',
})
export class ControlPanel {
  // inputs
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  // injected dependencies
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly liveUpdatesService = inject(NgContentfulLiveUpdates)

  // protected state
  protected readonly consent = toSignal(this.optimization.consent$)
  protected readonly isIdentified = toSignal(
    this.optimization.profile$.pipe(
      map((p) => {
        if (p === null || typeof p !== 'object') return false
        if (!('traits' in p)) return false
        const { traits } = p as { traits: unknown }
        if (traits === null || typeof traits !== 'object') return false
        if (!('identified' in traits)) return false
        return Boolean((traits as { identified: unknown }).identified)
      }),
    ),
    { initialValue: false },
  )
  protected readonly optimizationCount = toSignal(
    this.optimization.selectedOptimizations$.pipe(map((s) => s?.length ?? 0)),
    { initialValue: 0 },
  )
  protected readonly booleanFlag = toSignal(this.optimization.booleanFlag$)

  // public methods
  protected toggleConsent(): void {
    this.optimization.setConsent(this.consent() !== true)
  }

  protected identify(): void {
    this.optimization.identify('charles', { identified: true })
  }

  protected reset(): void {
    this.optimization.reset()
  }
}
