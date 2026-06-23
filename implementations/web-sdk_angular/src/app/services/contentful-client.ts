import { inject, Injectable, resource, TransferState, type ResourceRef } from '@angular/core'
import type { ContentfulClientApi, Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { getOrCreateBaseClient, NG_CONTENTFUL_OPTIMIZATION_CONFIG } from '../config'
import { SERVER_RESOLVED_ENTRIES_KEY } from '../transfer-state-keys'

export interface ContentEntryFields {
  text?: EntryFieldTypes.Text | EntryFieldTypes.RichText
  nested?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<ContentEntrySkeleton>>
}

export type ContentEntrySkeleton = EntrySkeletonType<ContentEntryFields>
export type ContentfulEntry = Entry<ContentEntrySkeleton>

const INCLUDE_DEPTH = 10

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
        const handoff = this.transferState.get(SERVER_RESOLVED_ENTRIES_KEY, undefined)
        if (handoff && ids.every((id) => Object.hasOwn(handoff, id))) {
          // Hydration path: server already fetched these baselines and stamped
          // them into TransferState. Skip the duplicate CDA roundtrip.
          return new Map(ids.map((id) => [id, handoff[id].baseline as Entry<ContentEntrySkeleton>]))
        }
        const list = await this.fetchEntries<ContentEntrySkeleton>(ids)
        return new Map(list.map((entry) => [entry.sys.id, entry]))
      },
    })
}
