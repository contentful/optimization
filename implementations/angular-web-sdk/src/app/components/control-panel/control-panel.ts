import { Component, computed, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { LiveUpdates, Optimization, togglePreviewPanel } from '@contentful/optimization-angular'

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.html',
})
export class ControlPanel {
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  private readonly optimization = inject(Optimization)
  protected readonly liveUpdatesService = inject(LiveUpdates)

  protected readonly consent = toSignal(this.optimization.consent$)
  protected readonly profile = toSignal(this.optimization.profile$)

  protected readonly isIdentified = computed(() => {
    const p = this.profile()
    if (p === null || typeof p !== 'object') return false
    if (!('traits' in p)) return false
    const { traits } = p as { traits: unknown }
    if (traits === null || typeof traits !== 'object') return false
    if (!('identified' in traits)) return false
    return Boolean((traits as { identified: unknown }).identified)
  })

  protected readonly selectedOptimizationCount = toSignal(
    this.optimization.selectedOptimizations$,
    { initialValue: undefined },
  )

  protected readonly optimizationCount = computed(
    () => this.selectedOptimizationCount()?.length ?? 0,
  )

  protected readonly booleanFlag = toSignal(this.optimization.booleanFlag$)

  protected toggleConsent(): void {
    this.optimization.setConsent(this.consent() !== true)
  }

  protected identify(): void {
    this.optimization.identify()
  }

  protected reset(): void {
    this.optimization.reset()
  }

  protected toggleGlobalLiveUpdates(): void {
    this.liveUpdatesService.toggle()
  }

  protected readonly togglePreviewPanel = togglePreviewPanel
}
