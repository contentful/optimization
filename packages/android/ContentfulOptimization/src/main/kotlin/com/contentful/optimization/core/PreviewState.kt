package com.contentful.optimization.core

import org.json.JSONArray
import org.json.JSONObject

data class PreviewState(
    val profile: JSONValue?,
    val consent: Boolean?,
    val persistenceConsent: Boolean?,
    val canPersonalize: Boolean,
    val changes: List<PreviewChange>?,
    val selectedPersonalizations: List<SelectedPersonalization>?,
    val previewPanelOpen: Boolean,
    val audienceOverrides: Map<String, Boolean>?,
    val variantOverrides: Map<String, Int>?,
    val defaultAudienceQualifications: Map<String, Boolean>?,
    val defaultVariantIndices: Map<String, Int>?,
    val previewModel: PreviewModelDTO?,
) {
    companion object {
        fun fromJSON(json: String): PreviewState? {
            return try {
                val obj = JSONObject(json)
                PreviewState(
                    profile = if (obj.isNull("profile")) null else JSONValue.fromAny(obj.get("profile")),
                    consent = if (obj.isNull("consent")) null else obj.optBoolean("consent"),
                    persistenceConsent = if (obj.isNull("persistenceConsent")) null else obj.optBoolean("persistenceConsent"),
                    canPersonalize = obj.optBoolean("canPersonalize", false),
                    changes = obj.optJSONArray("changes")?.let { parseChanges(it) },
                    selectedPersonalizations = obj.optJSONArray("selectedPersonalizations")?.let { parsePersonalizations(it) },
                    previewPanelOpen = obj.optBoolean("previewPanelOpen", false),
                    audienceOverrides = obj.optJSONObject("audienceOverrides")?.let { parseBoolMap(it) },
                    variantOverrides = obj.optJSONObject("variantOverrides")?.let { parseIntMap(it) },
                    defaultAudienceQualifications = obj.optJSONObject("defaultAudienceQualifications")?.let { parseBoolMap(it) },
                    defaultVariantIndices = obj.optJSONObject("defaultVariantIndices")?.let { parseIntMap(it) },
                    previewModel = obj.optJSONObject("previewModel")?.let { PreviewModelDTO.fromJSON(it) },
                )
            } catch (_: Exception) {
                null
            }
        }

        private fun parseChanges(arr: JSONArray): List<PreviewChange> =
            (0 until arr.length()).map { PreviewChange.fromJSON(arr.getJSONObject(it)) }

        private fun parsePersonalizations(arr: JSONArray): List<SelectedPersonalization> =
            (0 until arr.length()).map { SelectedPersonalization.fromJSON(arr.getJSONObject(it)) }

        private fun parseBoolMap(obj: JSONObject): Map<String, Boolean> =
            obj.keys().asSequence().associateWith { obj.getBoolean(it) }

        private fun parseIntMap(obj: JSONObject): Map<String, Int> =
            obj.keys().asSequence().associateWith { obj.getInt(it) }
    }
}

data class AudienceDefinitionDTO(
    val id: String,
    val name: String,
    val description: String?,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = AudienceDefinitionDTO(
            id = obj.getString("id"),
            name = obj.getString("name"),
            description = obj.optString("description", null),
        )
    }
}

data class VariantDistributionDTO(
    val index: Int,
    val variantRef: String,
    val percentage: Int?,
    val name: String?,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = VariantDistributionDTO(
            index = obj.getInt("index"),
            variantRef = obj.getString("variantRef"),
            percentage = if (obj.isNull("percentage")) null else obj.optInt("percentage"),
            name = obj.optString("name", null),
        )
    }
}

data class ExperienceDefinitionDTO(
    val id: String,
    val name: String,
    val type: String,
    val distribution: List<VariantDistributionDTO>,
    val audience: AudienceRef?,
    val currentVariantIndex: Int,
    val isOverridden: Boolean,
    val naturalVariantIndex: Int?,
) {
    data class AudienceRef(val id: String) {
        companion object {
            fun fromJSON(obj: JSONObject) = AudienceRef(id = obj.getString("id"))
        }
    }

    companion object {
        fun fromJSON(obj: JSONObject) = ExperienceDefinitionDTO(
            id = obj.getString("id"),
            name = obj.getString("name"),
            type = obj.getString("type"),
            distribution = obj.getJSONArray("distribution").let { arr ->
                (0 until arr.length()).map { VariantDistributionDTO.fromJSON(arr.getJSONObject(it)) }
            },
            audience = obj.optJSONObject("audience")?.let { AudienceRef.fromJSON(it) },
            currentVariantIndex = obj.getInt("currentVariantIndex"),
            isOverridden = obj.getBoolean("isOverridden"),
            naturalVariantIndex = if (obj.isNull("naturalVariantIndex")) null else obj.optInt("naturalVariantIndex"),
        )
    }
}

data class AudienceWithExperiencesDTO(
    val audience: AudienceDefinitionDTO,
    val experiences: List<ExperienceDefinitionDTO>,
    val isQualified: Boolean,
    val isActive: Boolean,
    val overrideState: String,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = AudienceWithExperiencesDTO(
            audience = AudienceDefinitionDTO.fromJSON(obj.getJSONObject("audience")),
            experiences = obj.getJSONArray("experiences").let { arr ->
                (0 until arr.length()).map { ExperienceDefinitionDTO.fromJSON(arr.getJSONObject(it)) }
            },
            isQualified = obj.getBoolean("isQualified"),
            isActive = obj.getBoolean("isActive"),
            overrideState = obj.getString("overrideState"),
        )
    }
}

data class PreviewModelDTO(
    val audiencesWithExperiences: List<AudienceWithExperiencesDTO>,
    val unassociatedExperiences: List<ExperienceDefinitionDTO>,
    val hasData: Boolean,
    val sdkVariantIndices: Map<String, Int>,
    val audienceNameMap: Map<String, String>,
    val experienceNameMap: Map<String, String>,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = PreviewModelDTO(
            audiencesWithExperiences = obj.getJSONArray("audiencesWithExperiences").let { arr ->
                (0 until arr.length()).map { AudienceWithExperiencesDTO.fromJSON(arr.getJSONObject(it)) }
            },
            unassociatedExperiences = obj.getJSONArray("unassociatedExperiences").let { arr ->
                (0 until arr.length()).map { ExperienceDefinitionDTO.fromJSON(arr.getJSONObject(it)) }
            },
            hasData = obj.getBoolean("hasData"),
            sdkVariantIndices = obj.getJSONObject("sdkVariantIndices").let { m ->
                m.keys().asSequence().associateWith { m.getInt(it) }
            },
            audienceNameMap = obj.getJSONObject("audienceNameMap").let { m ->
                m.keys().asSequence().associateWith { m.getString(it) }
            },
            experienceNameMap = obj.getJSONObject("experienceNameMap").let { m ->
                m.keys().asSequence().associateWith { m.getString(it) }
            },
        )
    }
}

data class SelectedPersonalization(
    val experienceId: String,
    val variantIndex: Int,
    val variants: Map<String, String>?,
    val sticky: Boolean?,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = SelectedPersonalization(
            experienceId = obj.getString("experienceId"),
            variantIndex = obj.getInt("variantIndex"),
            variants = obj.optJSONObject("variants")?.let { m ->
                m.keys().asSequence().associateWith { m.getString(it) }
            },
            sticky = if (obj.isNull("sticky")) null else obj.optBoolean("sticky"),
        )
    }
}

data class PreviewChange(
    val audienceId: String?,
    val qualified: Boolean?,
    val name: String?,
    val key: String?,
    val type: String?,
    val meta: PreviewChangeMeta?,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = PreviewChange(
            audienceId = obj.optString("audienceId", null),
            qualified = if (obj.isNull("qualified")) null else obj.optBoolean("qualified"),
            name = obj.optString("name", null),
            key = obj.optString("key", null),
            type = obj.optString("type", null),
            meta = obj.optJSONObject("meta")?.let { PreviewChangeMeta.fromJSON(it) },
        )
    }
}

data class PreviewChangeMeta(
    val experienceId: String,
    val variantIndex: Int,
) {
    companion object {
        fun fromJSON(obj: JSONObject) = PreviewChangeMeta(
            experienceId = obj.getString("experienceId"),
            variantIndex = obj.getInt("variantIndex"),
        )
    }
}
