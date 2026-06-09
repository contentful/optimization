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
  untracked,
} from '@angular/core'
import { NgContentfulLiveEntry, NgContentfulOptimization } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ContentfulEntry, RichTextDocument } from '../../types/contentful'
import { RichTextRenderer } from '../rich-text-renderer/rich-text-renderer'

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

@Component({
  selector: 'app-content-entry',
  imports: [NgTemplateOutlet, RichTextRenderer],
  templateUrl: './content-entry.html',
  providers: [NgContentfulLiveEntry],
})
export class ContentEntry implements OnDestroy {
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input.required<'auto' | 'manual'>()
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  // Passed down from Home so re-resolution happens whenever selectedOptimizations changes.
  readonly selectedOptimizations = input<SelectedOptimizationArray | undefined>(undefined)
  // undefined = follow global toggle; true = always live; false = always locked
  readonly liveUpdates = input<boolean | undefined>(undefined)

  private readonly optimization = inject(NgContentfulOptimization)
  private readonly elementRef = inject<ElementRef<Element>>(ElementRef)
  private readonly liveEntry = inject(NgContentfulLiveEntry)

  private readonly domReady = signal(false)
  private manualTrackingActive = false

  constructor() {
    effect(() => {
      this.liveEntry.setEntry(this.entry())
      this.liveEntry.setSelectedOptimizations(this.selectedOptimizations())
      this.liveEntry.setLiveUpdatesOverride(this.liveUpdates())
    })

    effect(() => {
      const live = this.liveEntry.isLive()
      if (live) {
        untracked(() => {
          this.liveEntry.clearSnapshot()
        })
      } else {
        untracked(() => {
          this.liveEntry.lockSnapshot()
        })
      }
    })

    afterNextRender(() => {
      this.domReady.set(true)
    })

    effect(() => {
      const ready = this.domReady()
      const mode = this.observation()
      if (!ready || mode !== 'manual' || this.optimization.sdk === undefined) return

      const resolved = this.liveEntry.resolved()
      if (resolved === undefined) return

      if (this.manualTrackingActive) {
        this.optimization.sdk.tracking.clearElement('views', this.elementRef.nativeElement)
        this.manualTrackingActive = false
      }

      this.optimization.sdk.tracking.enableElement('views', this.elementRef.nativeElement, {
        data: {
          entryId: resolved.resolvedId,
          optimizationId: resolved.meta.experienceId,
          sticky: resolved.meta.sticky,
          variantIndex: resolved.meta.variantIndex,
        },
      })
      this.manualTrackingActive = true
    })
  }

  protected readonly resolved = this.liveEntry.resolved

  protected readonly richTextField = computed(() =>
    Object.values(this.liveEntry.resolved()?.resolvedEntry.fields ?? {}).find(isRichTextField),
  )

  protected readonly hasMergeTag = computed(() => {
    const rt = this.richTextField()
    if (!rt) return false
    return JSON.stringify(rt).includes('"nt_mergetag"')
  })

  protected readonly entryText = computed(() => {
    const text: unknown = this.liveEntry.resolved()?.resolvedEntry.fields.text
    return typeof text === 'string' ? text : 'No content'
  })

  ngOnDestroy(): void {
    if (this.manualTrackingActive) {
      this.optimization.sdk?.tracking.clearElement('views', this.elementRef.nativeElement)
      this.manualTrackingActive = false
    }
  }
}
