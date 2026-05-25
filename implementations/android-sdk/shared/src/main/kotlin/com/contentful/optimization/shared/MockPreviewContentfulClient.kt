package com.contentful.optimization.shared

import com.contentful.optimization.preview.ContentfulEntriesResult
import com.contentful.optimization.preview.ContentfulIncludes
import com.contentful.optimization.preview.PreviewContentfulClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

class MockPreviewContentfulClient(
    private val baseUrl: String = AppConfig.contentfulBaseUrl,
    private val spaceId: String = AppConfig.contentfulSpaceId,
    private val environment: String = AppConfig.environment,
    private val httpClient: OkHttpClient = OkHttpClient(),
) : PreviewContentfulClient {

    @Suppress("UNCHECKED_CAST")
    override suspend fun getEntries(
        contentType: String,
        include: Int,
        skip: Int,
        limit: Int,
    ): ContentfulEntriesResult = withContext(Dispatchers.IO) {
        val url = "${baseUrl}spaces/$spaceId/environments/$environment/entries" +
            "?content_type=$contentType&include=$include&skip=$skip&limit=$limit"

        val request = Request.Builder().url(url).build()
        val response = httpClient.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Empty response")
        val json = JSONObject(body)

        val includedEntries = json.optJSONArray("Entry")?.let { arr ->
            (0 until arr.length()).map { jsonObjectToMap(arr.getJSONObject(it)) }
        } ?: run {
            val includesObj = json.optJSONObject("includes")
            includesObj?.optJSONArray("Entry")?.let { arr ->
                (0 until arr.length()).map { jsonObjectToMap(arr.getJSONObject(it)) }
            } ?: emptyList()
        }

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
