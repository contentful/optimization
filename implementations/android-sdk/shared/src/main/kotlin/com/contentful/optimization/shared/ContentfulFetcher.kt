package com.contentful.optimization.shared

import android.util.Log
import com.contentful.java.cda.CDAEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Fetches the home screen's content entries from the Contentful Delivery API.
 *
 * Entry-ID lookup is app-owned: the Optimization SDK resolves personalization against entries the
 * app supplies, it does not fetch them. The returned [CDAEntry] values go straight into the SDK's
 * typed entry points (`OptimizedEntry(entry: CDAEntry, ...)`, `OptimizedEntryView.setEntry(entry:
 * CDAEntry, ...)`, `CTEntry.from(CDAEntry)`), which encode them through `CTEntry` — this object does
 * no CDA JSON parsing or link resolution of its own; that comes from `contentful.java`'s `CDAClient`
 * via [MockContentfulClient].
 */
object ContentfulFetcher {

    private const val TAG = "ContentfulFetcher"
    private const val MAX_ATTEMPTS = 3
    private const val RETRY_BACKOFF_MS = 250L

    // Matches the `include=10` CDA contract: linked entries are resolved by contentful.java up to
    // ten levels deep.
    private const val INCLUDE_DEPTH = 10

    suspend fun fetchEntries(ids: List<String>, locale: String): List<CDAEntry> {
        val entries = mutableListOf<CDAEntry>()
        for (id in ids) {
            val entry = fetchEntry(id, locale)
            if (entry != null) {
                entries.add(entry)
            } else {
                Log.w(TAG, "fetchEntries: dropped entry id=$id (all attempts returned null)")
            }
        }
        return entries
    }

    private suspend fun fetchEntry(id: String, locale: String): CDAEntry? {
        repeat(MAX_ATTEMPTS) { attempt ->
            val result = fetchEntryOnce(id, locale, attempt)
            if (result != null) return result
            if (attempt < MAX_ATTEMPTS - 1) {
                delay(RETRY_BACKOFF_MS * (attempt + 1))
            }
        }
        return null
    }

    // Single-locale request. Entry resolution expects direct fields such as
    // `fields.nt_experiences`, so all-locale responses must not be used.
    private suspend fun fetchEntryOnce(id: String, locale: String, attempt: Int): CDAEntry? =
        withContext(Dispatchers.IO) {
            try {
                val array = MockContentfulClient.shared
                    .fetch(CDAEntry::class.java)
                    .where("sys.id", id)
                    .include(INCLUDE_DEPTH)
                    .withLocale(locale)
                    .all()

                val entry = array.items().firstOrNull() as? CDAEntry
                if (entry == null) {
                    Log.w(TAG, "fetchEntry[$id] attempt=$attempt: no items")
                }
                entry
            } catch (e: Exception) {
                Log.w(TAG, "fetchEntry[$id] attempt=$attempt: ${e.javaClass.simpleName}: ${e.message}", e)
                null
            }
        }
}
