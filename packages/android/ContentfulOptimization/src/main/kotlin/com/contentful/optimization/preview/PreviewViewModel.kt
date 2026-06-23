package com.contentful.optimization.preview

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.contentful.optimization.core.AudienceWithExperiencesDTO
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.core.PreviewModelDTO
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

internal class PreviewViewModel(
    val client: OptimizationClient,
    private val contentfulClient: PreviewContentfulClient?,
    private val applicationContext: Context,
) {
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _expandedAudiences = MutableStateFlow<Set<String>>(emptySet())
    val expandedAudiences: StateFlow<Set<String>> = _expandedAudiences.asStateFlow()

    private val _isLoadingDefinitions = MutableStateFlow(false)
    val isLoadingDefinitions: StateFlow<Boolean> = _isLoadingDefinitions.asStateFlow()

    private val _definitionsError = MutableStateFlow<String?>(null)
    val definitionsError: StateFlow<String?> = _definitionsError.asStateFlow()

    private var hasLoadedDefinitions = false

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    suspend fun loadDefinitions() {
        val contentful = contentfulClient ?: return
        if (hasLoadedDefinitions) return

        _isLoadingDefinitions.value = true
        _definitionsError.value = null

        try {
            val (audiences, experiences) = fetchAudienceAndExperienceEntries(contentful)

            @Suppress("UNCHECKED_CAST")
            val experienceEntriesWithIncludes = experiences.items.map { item ->
                val copy = item.toMutableMap()
                copy["includes"] = mapOf("Entry" to experiences.includes.entries)
                copy
            }

            client.loadDefinitions(
                audiences = audiences.items,
                experiences = experienceEntriesWithIncludes,
            )
            client.refreshPreviewState()

            hasLoadedDefinitions = true
            _isLoadingDefinitions.value = false
        } catch (e: Exception) {
            _definitionsError.value = e.message ?: "Unknown error"
            _isLoadingDefinitions.value = false
        }
    }

    fun filteredAudiences(model: PreviewModelDTO?): List<AudienceWithExperiencesDTO> {
        val audiences = model?.audiencesWithExperiences ?: emptyList()
        val query = _searchQuery.value.lowercase()
        if (query.isEmpty()) return audiences
        return audiences.filter { dto ->
            dto.audience.name.lowercase().contains(query)
                || (dto.audience.description?.lowercase()?.contains(query) == true)
                || dto.experiences.any { it.name.lowercase().contains(query) }
        }
    }

    fun allExpanded(audiences: List<AudienceWithExperiencesDTO>): Boolean {
        return audiences.isNotEmpty() && audiences.all { _expandedAudiences.value.contains(it.audience.id) }
    }

    fun toggleExpand(audienceId: String) {
        val current = _expandedAudiences.value.toMutableSet()
        if (current.contains(audienceId)) current.remove(audienceId) else current.add(audienceId)
        _expandedAudiences.value = current
    }

    fun toggleExpandAll(audiences: List<AudienceWithExperiencesDTO>) {
        _expandedAudiences.value = if (allExpanded(audiences)) {
            emptySet()
        } else {
            audiences.map { it.audience.id }.toSet()
        }
    }

    fun setAudienceOverride(
        audienceId: String,
        state: AudienceOverrideState,
        experienceIds: List<String>,
    ) {
        when (state) {
            AudienceOverrideState.ON -> client.overrideAudience(id = audienceId, qualified = true, experienceIds = experienceIds)
            AudienceOverrideState.OFF -> client.overrideAudience(id = audienceId, qualified = false, experienceIds = experienceIds)
            AudienceOverrideState.DEFAULT -> client.resetAudienceOverride(id = audienceId)
        }
    }

    fun setVariantOverride(experienceId: String, variantIndex: Int) {
        client.overrideVariant(experienceId = experienceId, variantIndex = variantIndex)
    }

    fun resetAudienceOverride(audienceId: String) {
        client.resetAudienceOverride(id = audienceId)
    }

    fun resetVariantOverride(experienceId: String) {
        client.resetVariantOverride(experienceId = experienceId)
    }

    fun resetAllOverrides() {
        client.resetAllOverrides()
    }

    fun copyToClipboard(text: String, label: String) {
        val clipboard = applicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
    }
}
