package com.contentful.optimization.shared

import com.contentful.java.cda.CDAClient
import com.contentful.java.cda.CDAEntry
import com.contentful.optimization.contentful.CTEntry
import com.contentful.optimization.preview.ContentfulEntriesResult
import com.contentful.optimization.preview.ContentfulIncludes
import com.contentful.optimization.preview.PreviewContentfulClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * `PreviewContentfulClient` backed by `contentful.java`'s `CDAClient` ([MockContentfulClient]),
 * targeting the local mock server rather than Contentful's production CDA.
 *
 * Wrapping an existing Contentful SDK client is the integration the protocol documents, as opposed
 * to the built-in `ContentfulHTTPPreviewClient`. The protocol is dictionary-shaped, so fetched
 * entries are encoded back down with `CTEntry.toMap()`.
 *
 * `fetchAudienceAndExperienceEntries` issues its `nt_audience` and `nt_experience` requests
 * concurrently against the same [CDAClient] instance. `CDAClient` builds each response's array of
 * resources (and its own content-type cache) on shared instance state while a call is in flight, so
 * two concurrent `.all()` calls on one client can interleave and silently drop entries from
 * whichever response finishes parsing "in the middle" of the other. [getEntries] takes a [mutex] to
 * serialize calls against this client and avoid that corruption; the built-in
 * `ContentfulHTTPPreviewClient` doesn't need this because each of its requests is an independent
 * stateless `OkHttp` call.
 */
class MockPreviewContentfulClient(
    private val client: CDAClient = MockContentfulClient.shared,
) : PreviewContentfulClient {

    private val mutex = Mutex()

    override suspend fun getEntries(
        contentType: String,
        include: Int,
        skip: Int,
        limit: Int,
    ): ContentfulEntriesResult = mutex.withLock {
        withContext(Dispatchers.IO) {
            val array = client.fetch(CDAEntry::class.java)
                .withContentType(contentType)
                .include(include)
                .skip(skip)
                .limit(limit)
                .all()

            val entries = array.items().filterIsInstance<CDAEntry>()
            val items = entries.map { it.toPreviewMap() }
            val itemIds = items.mapNotNull { (it["sys"] as? Map<*, *>)?.get("id") as? String }.toSet()

            // contentful.java resolves links in place, so `items` carry expanded linked entries where
            // the raw CDA response carried link stubs. The preview mappers read linked entries by
            // `sys.id`, which both shapes provide, and `includes.Entry` is still populated for
            // lookups by excluding the top-level items from the entries the array collected while
            // resolving links.
            val includedEntries = array.entries().values
                .filterNot { it.id() in itemIds }
                .map { CTEntry.from(it).toMap() }

            ContentfulEntriesResult(
                items = items,
                total = array.total(),
                skip = array.skip(),
                limit = array.limit(),
                includes = ContentfulIncludes(entries = includedEntries),
            )
        }
    }

    /**
     * Encodes [this] the same way [CTEntry.toMap] does, but restores any Link/Array<Link> field
     * `contentful.java` dropped because its target couldn't be resolved.
     *
     * The mock server's content-type-filtered `entries` endpoint (used here, unlike the by-id
     * endpoint [ContentfulFetcher] uses) never returns an `includes` section, so `contentful.java`
     * can't resolve any of an entry's linked entries and silently removes those fields rather than
     * keeping them as link stubs the way the raw Contentful REST response would. The preview
     * mappers (`entryMappers.ts`) only ever read `sys.id` off such fields, so restoring the raw
     * `{sys: {type: "Link", ...}}` stub `contentful.java` parsed before resolution is enough to
     * unblock them, without needing the target entry's fields.
     */
    @Suppress("UNCHECKED_CAST")
    private fun CDAEntry.toPreviewMap(): Map<String, Any> {
        val encoded = CTEntry.from(this).toMap()
        val encodedFields = (encoded["fields"] as? Map<String, Any?>).orEmpty()
        val rawFields = rawFields()
        val locale = getAttribute<String?>("locale")

        val missingLinkFields: Map<String, Any> = rawFields.keys
            .filterNot { it in encodedFields }
            .mapNotNull { key ->
                val localized = rawFields[key] as? Map<*, *>
                val value = localized?.get(locale) ?: localized?.values?.firstOrNull()
                value?.let { key to it }
            }
            .toMap() as Map<String, Any>

        if (missingLinkFields.isEmpty()) return encoded

        val patchedFields: Map<String, Any?> = encodedFields + missingLinkFields
        return encoded + ("fields" to patchedFields)
    }
}
