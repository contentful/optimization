import {
  inject,
  Injectable,
  makeStateKey,
  resource,
  TransferState,
  type ResourceRef,
  type StateKey,
} from '@angular/core'
import type { ContentfulClientApi, Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { getOrCreateBaseClient, NG_CONTENTFUL_OPTIMIZATION_CONFIG } from '../config'

export interface ContentEntryFields {
  text?: EntryFieldTypes.Text | EntryFieldTypes.RichText
  nested?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<ContentEntrySkeleton>>
}

export type ContentEntrySkeleton = EntrySkeletonType<ContentEntryFields>
export type ContentfulEntry = Entry<ContentEntrySkeleton>

const INCLUDE_DEPTH = 10

/**
 * Baseline CDA entries keyed by id. Stamped by the SSR preflight so the
 * browser can skip a duplicate CDA fetch on hydration. Lives next to
 * {@link NgContentfulClient} because that class is the sole reader.
 */
export const SERVER_BASELINES_KEY: StateKey<Record<string, Entry>> =
  makeStateKey<Record<string, Entry>>('ssr-baselines')

@Injectable({ providedIn: 'root' })
export class NgContentfulClient {
  private readonly client: ContentfulClientApi<undefined>
  private readonly transferState = inject(TransferState)
  readonly locale: string

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    this.client = getOrCreateBaseClient(config)
    ;({ locale: this.locale } = config)
  }

  async fetchEntry<T extends EntrySkeletonType>(entryId: string): Promise<Entry<T> | undefined> {
    try {
      return await this.client.getEntry<T>(entryId, { include: INCLUDE_DEPTH, locale: this.locale })
    } catch {
      return undefined
    }
  }

  async fetchEntries<T extends EntrySkeletonType>(
    entryIds: readonly string[],
  ): Promise<Array<Entry<T>>> {
    const results = await Promise.all(entryIds.map(async (id) => await this.fetchEntry<T>(id)))
    return results.filter((e): e is Entry<T> => e !== undefined)
  }

  loadEntries = (ids: readonly string[]): ResourceRef<Map<string, ContentfulEntry> | undefined> =>
    resource({
      loader: async (): Promise<Map<string, ContentfulEntry>> => {
        const baselines = this.transferState.get(SERVER_BASELINES_KEY, undefined)
        if (baselines && ids.every((id) => Object.hasOwn(baselines, id))) {
          // Hydration path: server already fetched these baselines and stamped
          // them into TransferState. Skip the duplicate CDA roundtrip.
          return new Map(ids.map((id) => [id, baselines[id] as Entry<ContentEntrySkeleton>]))
        }
        const list = await this.fetchEntries<ContentEntrySkeleton>(ids)
        return new Map(list.map((entry) => [entry.sys.id, entry]))
      },
    })
}
