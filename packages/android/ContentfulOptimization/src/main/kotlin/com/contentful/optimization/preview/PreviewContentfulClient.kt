package com.contentful.optimization.preview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException

public interface PreviewContentfulClient {
    suspend fun getEntries(contentType: String, include: Int, skip: Int, limit: Int): ContentfulEntriesResult
}

public data class ContentfulEntriesResult(
    val items: List<Map<String, Any>>,
    val total: Int,
    val skip: Int,
    val limit: Int,
    val includes: ContentfulIncludes = ContentfulIncludes(),
)

public data class ContentfulIncludes(
    val entries: List<Map<String, Any>> = emptyList(),
)

public sealed class ContentfulPreviewError(message: String) : Exception(message) {
    class InvalidURL : ContentfulPreviewError("Invalid Contentful API URL")
    class InvalidResponse : ContentfulPreviewError("Invalid response from Contentful API")
    class HttpError(val statusCode: Int) : ContentfulPreviewError("Contentful API returned HTTP $statusCode")
    class InvalidJSON : ContentfulPreviewError("Failed to parse Contentful API response")
}

public class ContentfulHTTPPreviewClient(
    private val spaceId: String,
    private val accessToken: String,
    private val environment: String = "master",
    private val httpClient: OkHttpClient = OkHttpClient(),
) : PreviewContentfulClient {

    @Suppress("UNCHECKED_CAST")
    override suspend fun getEntries(
        contentType: String,
        include: Int,
        skip: Int,
        limit: Int,
    ): ContentfulEntriesResult = withContext(Dispatchers.IO) {
        val url = "https://cdn.contentful.com/spaces/$spaceId/environments/$environment/entries" +
            "?content_type=$contentType&include=$include&skip=$skip&limit=$limit"

        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .build()

        val response = try {
            httpClient.newCall(request).execute()
        } catch (e: IOException) {
            throw ContentfulPreviewError.InvalidResponse()
        }

        if (!response.isSuccessful) {
            throw ContentfulPreviewError.HttpError(response.code)
        }

        val body = response.body?.string() ?: throw ContentfulPreviewError.InvalidJSON()
        val json = try {
            JSONObject(body)
        } catch (_: Exception) {
            throw ContentfulPreviewError.InvalidJSON()
        }

        val includesJSON = json.optJSONObject("includes")
        val includedEntries = includesJSON?.optJSONArray("Entry")?.let { arr ->
            (0 until arr.length()).map { jsonObjectToMap(arr.getJSONObject(it)) }
        } ?: emptyList()

        val items = json.optJSONArray("items")?.let { arr ->
            (0 until arr.length()).map { jsonObjectToMap(arr.getJSONObject(it)) }
        } ?: emptyList()

        ContentfulEntriesResult(
            items = items,
            total = json.optInt("total", 0),
            skip = json.optInt("skip", 0),
            limit = json.optInt("limit", 0),
            includes = ContentfulIncludes(entries = includedEntries),
        )
    }

    private fun jsonObjectToMap(obj: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        obj.keys().forEach { key ->
            val value = obj.get(key)
            map[key] = convertJSONValue(value)
        }
        return map
    }

    private fun convertJSONValue(value: Any): Any {
        return when (value) {
            is JSONObject -> jsonObjectToMap(value)
            is org.json.JSONArray -> (0 until value.length()).map { convertJSONValue(value.get(it)) }
            JSONObject.NULL -> "null"
            else -> value
        }
    }
}

private const val BATCH_SIZE = 100

internal suspend fun fetchAllEntries(
    client: PreviewContentfulClient,
    contentType: String,
    include: Int = 10,
): ContentfulEntriesResult {
    val allItems = mutableListOf<Map<String, Any>>()
    val allIncludes = mutableListOf<Map<String, Any>>()
    var skip = 0
    var total: Int

    do {
        val result = client.getEntries(contentType = contentType, include = include, skip = skip, limit = BATCH_SIZE)
        allItems.addAll(result.items)
        allIncludes.addAll(result.includes.entries)
        total = result.total
        skip += result.items.size
    } while (skip < total)

    return ContentfulEntriesResult(
        items = allItems,
        total = total,
        skip = 0,
        limit = allItems.size,
        includes = ContentfulIncludes(entries = allIncludes),
    )
}

internal suspend fun fetchAudienceAndExperienceEntries(
    client: PreviewContentfulClient,
): Pair<ContentfulEntriesResult, ContentfulEntriesResult> = coroutineScope {
    val audiences = async { fetchAllEntries(client, "nt_audience") }
    val experiences = async { fetchAllEntries(client, "nt_experience", include = 10) }
    Pair(audiences.await(), experiences.await())
}
