package com.contentful.optimization.shared

import android.util.Log
import com.contentful.java.cda.CDAClient
import com.contentful.java.cda.CDAEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

// Shared CDAClient for every CDA read: home-screen entries here, plus the preview panel's
// audience/experience fetch in MockPreviewContentfulClient. `setEndpoint` points it at the mock
// server's `/contentful/` mount instead of `cdn.contentful.com`; `setToken` is required by the
// builder even though the mock ignores auth.
object ContentfulFetcher {

    private const val TAG = "ContentfulFetcher"
    private const val MAX_ATTEMPTS = 3
    private const val RETRY_BACKOFF_MS = 250L
    private const val MOCK_ACCESS_TOKEN = "mock-access-token"

    // Matches the `include=10` CDA contract: linked entries are resolved by contentful.java up to
    // ten levels deep.
    private const val INCLUDE_DEPTH = 10

    val client: CDAClient by lazy {
        val httpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .callTimeout(45, TimeUnit.SECONDS)
            .build()

        CDAClient.builder()
            .setSpace(AppConfig.contentfulSpaceId)
            .setEnvironment(AppConfig.environment)
            .setToken(MOCK_ACCESS_TOKEN)
            .setEndpoint(AppConfig.contentfulBaseUrl)
            .setCallFactory(httpClient)
            .build()
    }

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
                val array = client
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
