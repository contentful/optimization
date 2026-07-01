import type { Entry } from 'contentful'
import type { ContentfulEntryQuery } from './CoreBase'

export interface OptimizedEntrySourceControllerOptions {
  /** Baseline entry supplied by the application. Takes precedence over `entryId`. */
  readonly baselineEntry?: Entry
  /** Contentful entry ID fetched through the SDK-managed Contentful client. */
  readonly entryId?: string
  /** Per-entry Contentful `getEntry()` query overrides. */
  readonly entryQuery?: ContentfulEntryQuery
  /** SDK surface required for managed entry fetching. */
  readonly sdk?: {
    fetchContentfulEntry: (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>
  }
  /** Whether SDK state is ready for managed entry fetching. */
  readonly isSdkStateReady?: boolean
}

export interface OptimizedEntrySourceSnapshot {
  /** Current baseline entry, either supplied directly or fetched by `entryId`. */
  readonly baselineEntry?: Entry
  /** Managed entry ID currently being fetched or resolved. */
  readonly entryId?: string
  /** Managed fetch error, normalized to `Error`. */
  readonly error?: Error
  /** Whether a managed entry source is waiting for SDK readiness or fetch resolution. */
  readonly isLoading: boolean
}

export type OptimizedEntrySourceSnapshotListener = (snapshot: OptimizedEntrySourceSnapshot) => void

type OptimizedEntrySourceSdk = NonNullable<OptimizedEntrySourceControllerOptions['sdk']>

const LOADING_ENTRY_CONTENT_TYPE_ID = 'contentful-loading-entry'
const LOADING_ENTRY_TIMESTAMP = '2024-01-01T00:00:00Z'
const REQUEST_IDLE = 0
const REQUEST_LOADING = 1
const REQUEST_SUCCESS = 2
const REQUEST_ERROR = REQUEST_SUCCESS + REQUEST_LOADING

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function getFetchKey(entryId: string, query: ContentfulEntryQuery | undefined): string {
  return `${entryId}:${JSON.stringify(query ?? {})}`
}

function areSourceSnapshotsEqual(
  left: OptimizedEntrySourceSnapshot,
  right: OptimizedEntrySourceSnapshot,
): boolean {
  return (
    left.baselineEntry === right.baselineEntry &&
    left.entryId === right.entryId &&
    left.error === right.error &&
    left.isLoading === right.isLoading
  )
}

/** Creates a stable placeholder entry while framework wrappers wait for a managed fetch. */
export function createOptimizedEntryLoadingEntry(entryId: string): Entry {
  return {
    fields: {},
    metadata: { tags: [] },
    sys: {
      contentType: {
        sys: { id: LOADING_ENTRY_CONTENT_TYPE_ID, linkType: 'ContentType', type: 'Link' },
      },
      createdAt: LOADING_ENTRY_TIMESTAMP,
      environment: { sys: { id: '', linkType: 'Environment', type: 'Link' } },
      id: entryId,
      publishedVersion: 0,
      revision: 0,
      space: { sys: { id: '', linkType: 'Space', type: 'Link' } },
      type: 'Entry',
      updatedAt: LOADING_ENTRY_TIMESTAMP,
    },
  }
}

/** Coordinates direct baseline entries and SDK-managed `entryId` fetching for framework wrappers. */
export class OptimizedEntrySourceController {
  private key: string | undefined
  private sdk: OptimizedEntrySourceSdk | undefined
  private version = 0
  private listener: OptimizedEntrySourceSnapshotListener | undefined
  private status = REQUEST_IDLE
  private snapshot: OptimizedEntrySourceSnapshot = { isLoading: false }

  updateOptions(options: OptimizedEntrySourceControllerOptions): void {
    if (options.baselineEntry !== undefined) {
      this.resetSource({ baselineEntry: options.baselineEntry, isLoading: false })
      return
    }

    const { entryId } = options
    if (entryId === undefined) {
      this.resetSource({ isLoading: false })
      return
    }

    const key = getFetchKey(entryId, options.entryQuery)
    const { sdk } = options
    const sourceChanged = this.key !== key || this.sdk !== sdk

    if (sourceChanged) {
      this.version += 1
      this.key = key
      this.sdk = sdk
      this.status = REQUEST_IDLE
    }

    if (sdk === undefined || options.isSdkStateReady !== true) {
      if (this.status !== REQUEST_IDLE) {
        this.version += 1
        this.status = REQUEST_IDLE
      }
      this.setSnapshot({ entryId, isLoading: true })
      return
    }

    if (this.status !== REQUEST_IDLE) {
      return
    }

    const version = ++this.version
    this.status = REQUEST_LOADING
    this.setSnapshot({ entryId, isLoading: true }, true)

    void sdk.fetchContentfulEntry(entryId, options.entryQuery).then(
      (entry) => {
        if (!this.isCurrent(version, key, sdk)) return

        this.status = REQUEST_SUCCESS
        this.setSnapshot({ baselineEntry: entry, entryId, isLoading: false })
      },
      (error: unknown) => {
        if (!this.isCurrent(version, key, sdk)) return

        this.status = REQUEST_ERROR
        this.setSnapshot({ entryId, error: toError(error), isLoading: false })
      },
    )
  }

  private resetSource(snapshot: OptimizedEntrySourceSnapshot): void {
    if (this.key !== undefined || this.status !== REQUEST_IDLE) {
      this.version += 1
    }
    this.key = undefined
    this.sdk = undefined
    this.status = REQUEST_IDLE
    this.setSnapshot(snapshot)
  }

  private isCurrent(version: number, key: string, sdk: OptimizedEntrySourceSdk): boolean {
    return (
      this.version === version &&
      this.key === key &&
      this.sdk === sdk &&
      this.status === REQUEST_LOADING
    )
  }

  getSnapshot(): OptimizedEntrySourceSnapshot {
    return this.snapshot
  }

  setSnapshotListener(listener: OptimizedEntrySourceSnapshotListener | undefined): void {
    this.listener = listener
  }

  disconnect(): void {
    this.version += 1
    if (this.status === REQUEST_LOADING) {
      this.status = REQUEST_IDLE
    }
  }

  private setSnapshot(snapshot: OptimizedEntrySourceSnapshot, forceNotify = false): void {
    if (!forceNotify && areSourceSnapshotsEqual(this.snapshot, snapshot)) {
      return
    }

    this.snapshot = snapshot
    this.listener?.(snapshot)
  }
}
