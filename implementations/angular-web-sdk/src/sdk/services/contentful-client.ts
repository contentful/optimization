import { inject, Injectable } from '@angular/core'
import type { Entry, EntrySkeletonType } from 'contentful'
import { createClient } from 'contentful'
import { NG_CONTENTFUL_OPTIMIZATION_CONFIG } from '../config'
import { NgContentfulOptimization } from './optimization'

const INCLUDE_DEPTH = 10

@Injectable({ providedIn: 'root' })
export class NgContentfulClient {
  private readonly resolvedClient: ReturnType<typeof createClient>

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const { sdk } = inject(NgContentfulOptimization)

    const client = createClient({
      accessToken: config.contentful.accessToken,
      environment: config.contentful.environment,
      space: config.contentful.spaceId,
      host: config.contentful.cdaHost,
      insecure: config.contentful.cdaHost.includes('localhost'),
      basePath: config.contentful.basePath,
    })

    // Wrapping the client ensures the SDK and CDA always use the same locale.
    // Without this, personalisation breaks when the SDK resolves a different locale
    // than what the CDA fetches entries with.
    this.resolvedClient = sdk.withOptimizationLocale(client)
  }

  async fetchEntry<T extends EntrySkeletonType>(entryId: string): Promise<Entry<T> | undefined> {
    try {
      return await this.resolvedClient.getEntry<T>(entryId, { include: INCLUDE_DEPTH })
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
}
