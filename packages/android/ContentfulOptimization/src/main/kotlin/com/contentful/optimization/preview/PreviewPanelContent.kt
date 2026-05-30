package com.contentful.optimization.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.core.JSONValue
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun PreviewPanelContent(
    contentfulClient: PreviewContentfulClient? = null,
) {
    val client = LocalOptimizationClient.current
    val context = LocalContext.current
    val viewModel = remember {
        PreviewViewModel(
            client = client,
            contentfulClient = contentfulClient,
            applicationContext = context.applicationContext,
        )
    }

    LaunchedEffect(Unit) {
        client.refreshPreviewState()
        viewModel.loadDefinitions()
    }

    PreviewPanelMain(viewModel = viewModel)
}

@Composable
private fun PreviewPanelMain(viewModel: PreviewViewModel) {
    val client = viewModel.client
    val previewState by client.previewState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val expandedAudiences by viewModel.expandedAudiences.collectAsState()
    val isLoadingDefinitions by viewModel.isLoadingDefinitions.collectAsState()
    val definitionsError by viewModel.definitionsError.collectAsState()

    val previewModel = previewState?.previewModel
    val audienceOverrides = previewState?.audienceOverrides ?: emptyMap()
    val variantOverrides = previewState?.variantOverrides ?: emptyMap()
    val audienceNameMap = previewModel?.audienceNameMap ?: emptyMap()
    val experienceNameMap = previewModel?.experienceNameMap ?: emptyMap()
    val hasOverrides = audienceOverrides.isNotEmpty() || variantOverrides.isNotEmpty()
    val filteredAudiences = viewModel.filteredAudiences(previewModel)

    var showResetAlert by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PreviewTheme.Colors.Background.secondary),
    ) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = PreviewTheme.Spacing.lg, vertical = PreviewTheme.Spacing.md),
        ) {
            Text(
                text = "Preview Panel",
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.lg,
                    fontWeight = FontWeight.SemiBold,
                    color = PreviewTheme.Colors.TextColor.primary,
                ),
            )
            Spacer(modifier = Modifier.weight(1f))
            ConsentBadge(previewState?.consent)
        }

        // Search bar
        if (previewModel?.audiencesWithExperiences?.isNotEmpty() == true) {
            Box(
                modifier = Modifier
                    .padding(horizontal = PreviewTheme.Spacing.lg)
                    .padding(bottom = PreviewTheme.Spacing.md),
            ) {
                PreviewSearchBar(
                    text = searchQuery,
                    onTextChange = { viewModel.setSearchQuery(it) },
                )
            }
        }

        // Scrollable content
        Column(
            verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.lg),
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = PreviewTheme.Spacing.lg)
                .padding(bottom = PreviewTheme.Spacing.lg)
                .semantics { contentDescription = "preview-panel-list" },
        ) {
            if (isLoadingDefinitions) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(PreviewTheme.Spacing.md),
                ) {
                    CircularProgressIndicator()
                    Text(
                        text = "Loading definitions...",
                        style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                    )
                }
            }

            if (definitionsError != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(PreviewTheme.Colors.Background.primary, RoundedCornerShape(PreviewTheme.Radius.md))
                        .padding(PreviewTheme.Spacing.md),
                ) {
                    Text(text = "⚠️", style = TextStyle(color = PreviewTheme.Colors.Action.reset))
                    Text(
                        text = definitionsError ?: "",
                        style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = PreviewTheme.Colors.TextColor.secondary),
                    )
                }
            }

            // Audience section
            AudienceSection(
                filteredAudiences = filteredAudiences,
                searchQuery = searchQuery,
                expandedAudiences = expandedAudiences,
                viewModel = viewModel,
            )

            // Profile section
            ProfileSection(previewState?.profile)

            // Debug section
            DebugSection(previewState?.consent, previewState?.canPersonalize ?: false, client)

            // Overrides section
            OverridesSection(
                audienceOverrides = audienceOverrides,
                variantOverrides = variantOverrides,
                audienceNameMap = audienceNameMap,
                experienceNameMap = experienceNameMap,
                hasOverrides = hasOverrides,
                viewModel = viewModel,
            )
        }

        // Footer
        PanelFooter(
            hasOverrides = hasOverrides,
            onResetClick = { showResetAlert = true },
        )
    }

    if (showResetAlert) {
        AlertDialog(
            onDismissRequest = { showResetAlert = false },
            title = { Text("Reset to Actual State") },
            text = { Text("This will clear all manual overrides and restore SDK state to values last received from the API. Continue?") },
            dismissButton = {
                TextButton(onClick = { showResetAlert = false }) { Text("Cancel") }
            },
            confirmButton = {
                // Stand the confirm button up as a clickable Text rather than a
                // Material3 TextButton so the `contentDescription` lives on the
                // exact node that owns the click action — mirroring the proven
                // pattern used by the panel's per-row reset controls in
                // PreviewActionButton. Wrapping a TextButton in a non-merging
                // semantics modifier instead produces a separate semantic node
                // above the click handler, which UI Automator's
                // accessibility-click then routes to the nearest clickable
                // ancestor (the AlertDialog root) and ends up dismissing the
                // dialog without invoking the reset. By.text("Reset") on its
                // own can't disambiguate either, because the panel's
                // reset-variant-* / reset-audience-* rows below the dialog
                // also render a "Reset" label.
                Text(
                    text = "Reset",
                    modifier = Modifier
                        .clickable {
                            viewModel.resetAllOverrides()
                            showResetAlert = false
                        }
                        .padding(
                            horizontal = PreviewTheme.Spacing.md,
                            vertical = PreviewTheme.Spacing.sm,
                        )
                        .semantics { contentDescription = "reset-all-confirm" },
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.sm,
                        fontWeight = FontWeight.Medium,
                        color = PreviewTheme.Colors.Action.reset,
                    ),
                )
            },
        )
    }
}

@Composable
private fun ConsentBadge(consent: Boolean?) {
    val text = when (consent) {
        true -> "Yes"
        false -> "No"
        null -> "—"
    }
    Text(
        text = "Consent: $text",
        style = TextStyle(
            fontSize = PreviewTheme.FontSize.xs,
            fontWeight = FontWeight.Medium,
            color = PreviewTheme.Colors.TextColor.secondary,
        ),
        modifier = Modifier
            .background(PreviewTheme.Colors.Background.tertiary, RoundedCornerShape(PreviewTheme.Radius.sm))
            .padding(horizontal = PreviewTheme.Spacing.md, vertical = PreviewTheme.Spacing.xs),
    )
}

@Composable
private fun AudienceSection(
    filteredAudiences: List<com.contentful.optimization.core.AudienceWithExperiencesDTO>,
    searchQuery: String,
    expandedAudiences: Set<String>,
    viewModel: PreviewViewModel,
) {
    SectionCard(title = "Audiences & Experiences (${filteredAudiences.size})") {
        if (filteredAudiences.size > 1) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(modifier = Modifier.weight(1f))
                CollapseToggleButton(
                    allExpanded = viewModel.allExpanded(filteredAudiences),
                    onToggle = { viewModel.toggleExpandAll(filteredAudiences) },
                )
            }
        }

        if (filteredAudiences.isEmpty()) {
            val message = if (searchQuery.isEmpty()) "No audience data"
            else "No results found for \"$searchQuery\""
            Text(
                text = message,
                style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = PreviewTheme.Spacing.lg),
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm)) {
                // `key` ties each AudienceItem's slot identity to the audience id
                // rather than its list position. Without it, `sortAudiences` reorder
                // after an override would have Compose reuse slots by position and
                // splice modifier values (Text contentDescription, clickable callback)
                // across audiences within the same recomposition window, routing a
                // tap on one audience-toggle to a different audience's callback.
                filteredAudiences.forEach { audience ->
                    key(audience.audience.id) {
                        AudienceItem(
                            audience = audience,
                            isExpanded = expandedAudiences.contains(audience.audience.id),
                            onToggleExpand = { viewModel.toggleExpand(audience.audience.id) },
                            onToggleOverride = { state ->
                                viewModel.setAudienceOverride(
                                    audienceId = audience.audience.id,
                                    state = state,
                                    experienceIds = audience.experiences.map { it.id },
                                )
                            },
                            onSelectVariant = { expId, variant ->
                                viewModel.setVariantOverride(experienceId = expId, variantIndex = variant)
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileSection(profile: JSONValue?) {
    SectionCard(title = "Profile", collapsible = true) {
        val profileObj = profile?.objectValue

        if (profileObj != null) {
            val id = profileObj["id"]?.stringValue
            val traits = profileObj["traits"]?.objectValue ?: emptyMap()
            val audiences = profileObj["audiences"]?.arrayValue ?: emptyList()

            Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.md)) {
                // Flat per-key rows keep the profile shape test-addressable via
                // `profile-item-<key>` identifiers — matches the shared contract the
                // UiAutomator suite drives, mirroring iOS. The curated subsections below
                // add the organized, human-readable view aligned with React Native.
                profileObj.keys.sorted().forEach { profileKey ->
                    key(profileKey) {
                        ProfileKeyValueRow(
                            label = profileKey,
                            value = traitDisplayValue(profileObj.getValue(profileKey)),
                            labelColor = PreviewTheme.Colors.TextColor.primary,
                            labelWeight = FontWeight.SemiBold,
                            valueColor = PreviewTheme.Colors.TextColor.secondary,
                            modifier = Modifier.semantics { contentDescription = "profile-item-$profileKey" },
                        )
                    }
                }

                HorizontalDivider()

                // Profile ID
                ListItemRow(label = "Profile ID", value = id ?: "—")

                HorizontalDivider()

                // Traits
                Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.xs)) {
                    ProfileSubsectionTitle("Traits (${traits.size})")
                    if (traits.isNotEmpty()) {
                        traits.entries.sortedBy { it.key }.forEach { entry ->
                            key("trait-${entry.key}") {
                                ProfileKeyValueRow(
                                    label = entry.key,
                                    value = traitDisplayValue(entry.value),
                                    labelColor = PreviewTheme.Colors.TextColor.secondary,
                                    labelWeight = FontWeight.Normal,
                                    valueColor = PreviewTheme.Colors.TextColor.primary,
                                )
                            }
                        }
                    } else {
                        ProfileEmptyText("No traits available")
                    }
                }

                HorizontalDivider()

                // Audiences
                Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.xs)) {
                    ProfileSubsectionTitle("Audiences (${audiences.size})")
                    if (audiences.isNotEmpty()) {
                        audiences.forEachIndexed { index, value ->
                            val audienceId = value.stringValue ?: ""
                            key(audienceId.ifEmpty { "audience-$index" }) {
                                ListItemRow(label = audienceId, badge = "API" to BadgeVariant.API)
                            }
                        }
                    } else {
                        ProfileEmptyText("No audiences assigned")
                    }
                }

                HorizontalDivider()

                val profileJson = try {
                    (jsonValueToOrgJson(JSONValue.Obj(profileObj)) as JSONObject).toString(2)
                } catch (_: Exception) {
                    "{}"
                }
                PreviewJsonViewer(data = profileJson, title = "Full Profile JSON")
            }
        } else {
            Text(
                text = "No profile data",
                style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = PreviewTheme.Spacing.lg)
                    .semantics { contentDescription = "no-profile-data" },
            )
        }
    }
}

@Composable
private fun ProfileSubsectionTitle(text: String) {
    Text(
        text = text,
        style = TextStyle(
            fontSize = PreviewTheme.FontSize.sm,
            fontWeight = FontWeight.SemiBold,
            color = PreviewTheme.Colors.TextColor.primary,
        ),
    )
}

/** A label/value row with the label on the left and the value pinned to the right (2-line clamp). */
@Composable
private fun ProfileKeyValueRow(
    label: String,
    value: String,
    labelColor: Color,
    labelWeight: FontWeight,
    valueColor: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        verticalAlignment = Alignment.Top,
        modifier = modifier.fillMaxWidth(),
    ) {
        Text(
            text = label,
            style = TextStyle(
                fontSize = PreviewTheme.FontSize.xs,
                fontWeight = labelWeight,
                color = labelColor,
            ),
        )
        Spacer(modifier = Modifier.width(PreviewTheme.Spacing.sm))
        Text(
            text = value,
            style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = valueColor),
            maxLines = 2,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ProfileEmptyText(text: String) {
    Text(
        text = text,
        style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = PreviewTheme.Spacing.sm),
    )
}

@Composable
private fun DebugSection(
    consent: Boolean?,
    canPersonalize: Boolean,
    client: com.contentful.optimization.core.OptimizationClient,
) {
    val scope = rememberCoroutineScope()

    SectionCard(title = "Debug", collapsible = true) {
        Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.md)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = "debug-consent" },
            ) {
                Text(
                    text = "Consent",
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.sm,
                        fontWeight = FontWeight.Medium,
                        color = PreviewTheme.Colors.TextColor.primary,
                    ),
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = when (consent) {
                        true -> "Accepted"
                        false -> "Declined"
                        null -> "Pending"
                    },
                    style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.secondary),
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = "debug-can-personalize" },
            ) {
                Text(
                    text = "Can Personalize",
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.sm,
                        fontWeight = FontWeight.Medium,
                        color = PreviewTheme.Colors.TextColor.primary,
                    ),
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = if (canPersonalize) "Yes" else "No",
                    style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.secondary),
                )
            }

            Text(
                text = "Refresh",
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.sm,
                    fontWeight = FontWeight.SemiBold,
                    color = PreviewTheme.Colors.TextColor.inverse,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PreviewTheme.Colors.CP.normal, RoundedCornerShape(PreviewTheme.Radius.md))
                    .clickable { scope.launch { client.refreshPreviewState() } }
                    .padding(vertical = PreviewTheme.Spacing.sm)
                    .semantics { contentDescription = "preview-refresh-button" },
            )
        }
    }
}

@Composable
private fun OverridesSection(
    audienceOverrides: Map<String, Boolean>,
    variantOverrides: Map<String, Int>,
    audienceNameMap: Map<String, String>,
    experienceNameMap: Map<String, String>,
    hasOverrides: Boolean,
    viewModel: PreviewViewModel,
) {
    SectionCard(title = "Overrides", collapsible = true) {
        if (hasOverrides) {
            Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.md)) {
                Text(
                    text = "${audienceOverrides.size} audience override${if (audienceOverrides.size == 1) "" else "s"}, " +
                        "${variantOverrides.size} optimization override${if (variantOverrides.size == 1) "" else "s"}",
                    style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = PreviewTheme.Colors.TextColor.secondary),
                )

                if (audienceOverrides.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.xs)) {
                        Text(
                            text = "Audience Overrides",
                            style = TextStyle(
                                fontSize = PreviewTheme.FontSize.sm,
                                fontWeight = FontWeight.SemiBold,
                                color = PreviewTheme.Colors.TextColor.primary,
                            ),
                        )
                        audienceOverrides.entries.sortedBy { audienceNameMap[it.key] ?: it.key }.forEach { (id, qualified) ->
                            key(id) {
                                ListItemRow(
                                    label = audienceNameMap[id] ?: id,
                                    value = if (qualified) "Activated" else "Deactivated",
                                    action = Triple("Reset", ActionButtonVariant.RESET) {
                                        viewModel.resetAudienceOverride(id)
                                    },
                                    actionAccessibilityID = "reset-audience-$id",
                                )
                            }
                        }
                    }
                }

                if (variantOverrides.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.xs)) {
                        Text(
                            text = "Optimization Overrides",
                            style = TextStyle(
                                fontSize = PreviewTheme.FontSize.sm,
                                fontWeight = FontWeight.SemiBold,
                                color = PreviewTheme.Colors.TextColor.primary,
                            ),
                        )
                        variantOverrides.entries.sortedBy { experienceNameMap[it.key] ?: it.key }.forEach { (expId, variant) ->
                            key(expId) {
                                ListItemRow(
                                    label = experienceNameMap[expId] ?: expId,
                                    value = if (variant == 0) "Baseline" else "Variant $variant",
                                    action = Triple("Reset", ActionButtonVariant.RESET) {
                                        viewModel.resetVariantOverride(expId)
                                    },
                                    actionAccessibilityID = "reset-variant-$expId",
                                )
                            }
                        }
                    }
                }
            }
        } else {
            Text(
                text = "No active overrides",
                style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = PreviewTheme.Spacing.lg),
            )
        }
    }
}

@Composable
private fun PanelFooter(hasOverrides: Boolean, onResetClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(PreviewTheme.Colors.Background.primary),
    ) {
        HorizontalDivider()
        Text(
            text = "Reset to Actual State",
            style = TextStyle(
                fontSize = PreviewTheme.FontSize.sm,
                fontWeight = FontWeight.SemiBold,
                color = PreviewTheme.Colors.TextColor.inverse,
                textAlign = TextAlign.Center,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(PreviewTheme.Spacing.lg)
                .alpha(if (hasOverrides) 1f else PreviewTheme.Opacity.disabled)
                .background(PreviewTheme.Colors.Action.destructive, RoundedCornerShape(PreviewTheme.Radius.md))
                .clickable(enabled = hasOverrides, onClick = onResetClick)
                .padding(vertical = PreviewTheme.Spacing.md)
                .semantics { contentDescription = "reset-all-overrides" },
        )
    }
}

/** Converts a [JSONValue] tree into org.json types (JSONObject/JSONArray/scalars) for serialization. */
private fun jsonValueToOrgJson(value: JSONValue): Any {
    return when (value) {
        is JSONValue.Str -> value.value
        is JSONValue.Number -> value.value
        is JSONValue.Bool -> value.value
        is JSONValue.Array -> JSONArray().apply { value.value.forEach { put(jsonValueToOrgJson(it)) } }
        is JSONValue.Obj -> JSONObject().apply {
            value.value.forEach { (entryKey, entryValue) -> put(entryKey, jsonValueToOrgJson(entryValue)) }
        }
        JSONValue.Null -> JSONObject.NULL
    }
}

/**
 * Renders a single trait value for display: scalars are stringified, objects and arrays are
 * serialized to compact JSON, mirroring the React Native profile section.
 */
private fun traitDisplayValue(value: JSONValue): String {
    return when (value) {
        is JSONValue.Str -> value.value
        is JSONValue.Bool -> value.value.toString()
        is JSONValue.Number -> {
            val number = value.value
            if (number % 1.0 == 0.0 && !number.isInfinite()) number.toLong().toString() else number.toString()
        }
        JSONValue.Null -> "null"
        is JSONValue.Array, is JSONValue.Obj -> jsonValueToOrgJson(value).toString()
    }
}
