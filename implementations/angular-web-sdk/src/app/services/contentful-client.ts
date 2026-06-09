import { inject, Injectable } from '@angular/core'
import { Optimization } from '@contentful/optimization-angular'
import { createClient } from 'contentful'
import { CONFIG } from '../config/config.token'
import type { ContentEntrySkeleton, ContentfulEntry } from '../types/contentful'

const INCLUDE_DEPTH = 10

@Injectable({ providedIn: 'root' })
export class ContentfulClient {
  private readonly client: ReturnType<typeof createClient>
  private readonly localizedClient: ReturnType<typeof createClient> | undefined = undefined

  constructor() {
    const config = inject(CONFIG)
    const { sdk } = inject(Optimization)

    this.client = createClient({
      accessToken: config.contentfulToken,
      environment: config.contentfulEnvironment,
      space: config.contentfulSpaceId,
      host: config.contentfulCdaHost,
      // Contentful SDK requires http for localhost
      insecure: config.contentfulCdaHost.includes('localhost'),
      basePath: config.contentfulBasePath,
    })

    // Wrapping the client ensures the SDK and CDA always use the same locale.
    // Without this, personalisation breaks when the SDK resolves a different locale
    // than what the CDA fetches entries with.
    if (sdk !== undefined) {
      this.localizedClient = sdk.withOptimizationLocale(this.client)
    }
  }

  private get resolvedClient(): ReturnType<typeof createClient> {
    return this.localizedClient ?? this.client
  }

  async fetchEntry(entryId: string): Promise<ContentfulEntry | undefined> {
    try {
      return await this.resolvedClient.getEntry<ContentEntrySkeleton>(entryId, {
        include: INCLUDE_DEPTH,
      })
    } catch {
      return undefined
    }
  }

  async fetchEntries(entryIds: readonly string[]): Promise<ContentfulEntry[]> {
    const results = await Promise.all(entryIds.map(async (id) => await this.fetchEntry(id)))
    return results.filter((e): e is ContentfulEntry => e !== undefined)
  }
}
