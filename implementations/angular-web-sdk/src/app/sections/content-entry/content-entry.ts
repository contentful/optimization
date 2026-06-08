import { NgTemplateOutlet } from '@angular/common'
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  type OnDestroy,
  signal,
} from '@angular/core'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Optimization } from '../../optimization/optimization'
import { OptimizationResolver } from '../../optimization/optimization-resolver'
import type { ContentfulEntry, RichTextDocument } from '../../types/contentful'
import { isRecord } from '../../utils/type-guards'

export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

function isRichTextField(field: unknown): field is RichTextDocument {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    (field as { nodeType: unknown }).nodeType === 'document' &&
    'content' in field &&
    Array.isArray((field as { content: unknown }).content)
  )
}

function getSelectedOptimizationMeta(value: unknown): {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
} {
  if (!isRecord(value))
    return { experienceId: undefined, sticky: undefined, variantIndex: undefined }
  return {
    experienceId: typeof value.experienceId === 'string' ? value.experienceId : undefined,
    sticky: typeof value.sticky === 'boolean' ? value.sticky : undefined,
    variantIndex: typeof value.variantIndex === 'number' ? value.variantIndex : undefined,
  }
}

@Component({
  selector: 'app-content-entry',
  imports: [NgTemplateOutlet],
  templateUrl: './content-entry.html',
})
export class ContentEntry implements OnDestroy {
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input.required<'auto' | 'manual'>()
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  // Passed down from Home so re-resolution happens whenever selectedOptimizations changes.
  readonly selectedOptimizations = input<SelectedOptimizationArray | undefined>(undefined)

  private readonly optimization = inject(Optimization)
  private readonly resolver = inject(OptimizationResolver)
  private readonly elementRef = inject<ElementRef<Element>>(ElementRef)

  private readonly resolved = computed(() =>
    this.resolver.resolveEntry(this.entry(), this.selectedOptimizations()),
  )

  protected readonly resolvedEntry = computed(() => this.resolved().entry as ContentfulEntry)
  protected readonly meta = computed(() =>
    getSelectedOptimizationMeta(this.resolved().selectedOptimization),
  )

  protected readonly baselineId = computed(() => this.entry().sys.id)
  protected readonly resolvedId = computed(() => this.resolvedEntry().sys.id)
  protected readonly isVariant = computed(() => this.meta().experienceId !== undefined)

  protected readonly richTextField = computed(() =>
    Object.values(this.resolvedEntry().fields).find(isRichTextField),
  )

  protected readonly entryText = computed(() => {
    const text: unknown = this.resolvedEntry().fields.text
    return typeof text === 'string' ? text : 'No content'
  })

  // null removes the attribute; String() ensures no literal "undefined" or "false" leaks.
  protected readonly stickyAttr = computed(() => {
    const { sticky } = this.meta()
    return sticky === undefined ? null : String(sticky)
  })

  protected readonly variantIndexAttr = computed(() => {
    const { variantIndex } = this.meta()
    return variantIndex === undefined ? null : String(variantIndex)
  })

  // Tracks whether the DOM is mounted so the manual-tracking effect can safely attach.
  private readonly domReady = signal(false)
  // Guards clearElement — only call it when enableElement was previously called on this element.
  private manualTrackingActive = false

  constructor() {
    afterNextRender(() => {
      this.domReady.set(true)
    })

    // Re-run whenever the resolved entry changes so manual tracking stays in sync with live updates.
    effect(() => {
      const ready = this.domReady()
      const mode = this.observation()
      if (!ready || mode !== 'manual' || this.optimization.sdk === undefined) return

      const meta = this.meta()

      if (this.manualTrackingActive) {
        this.optimization.sdk.tracking.clearElement('views', this.elementRef.nativeElement)
        this.manualTrackingActive = false
      }

      this.optimization.sdk.tracking.enableElement('views', this.elementRef.nativeElement, {
        data: {
          entryId: this.resolvedId(),
          optimizationId: meta.experienceId,
          sticky: meta.sticky,
          variantIndex: meta.variantIndex,
        },
      })
      this.manualTrackingActive = true
    })
  }

  ngOnDestroy(): void {
    if (this.manualTrackingActive) {
      this.optimization.sdk?.tracking.clearElement('views', this.elementRef.nativeElement)
      this.manualTrackingActive = false
    }
  }
}
