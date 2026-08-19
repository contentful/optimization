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
 * `PreviewContentfulClient` backed by `contentful.java`'s `CDAClient` ([ContentfulFetcher.client]).
 *
 * [mutex] serializes calls: `CDAClient` mutates shared instance state (its resource array, its
 * content-type cache) while a call is in flight, so concurrent `.all()` calls can interleave and
 * silently drop entries.
 */
class MockPreviewContentfulClient(
    private val client: CDAClient = ContentfulFetcher.client,
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
     * Encodes [this] like [CTEntry.toMap], restoring any Link/Array<Link> field `contentful.java`
     * dropped because it couldn't resolve the target (this endpoint returns no `includes` section).
     * The preview mappers only read `sys.id` off link fields, so the raw link stub is enough.
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
