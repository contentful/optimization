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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.core.JSONValue
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
                TextButton(onClick = {
                    viewModel.resetAllOverrides()
                    showResetAlert = false
                }) { Text("Reset") }
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
                filteredAudiences.forEach { audience ->
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

@Composable
private fun ProfileSection(profile: JSONValue?) {
    SectionCard(title = "Profile", collapsible = true) {
        val profileMap = profile?.let { jsonValueToMap(it) }

        if (profileMap != null) {
            Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.md)) {
                profileMap.keys.sorted().forEach { key ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .semantics { contentDescription = "profile-item-$key" },
                    ) {
                        Text(
                            text = key,
                            style = TextStyle(
                                fontSize = PreviewTheme.FontSize.xs,
                                fontWeight = FontWeight.SemiBold,
                                color = PreviewTheme.Colors.TextColor.primary,
                            ),
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            text = stringValue(profileMap[key]),
                            style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = PreviewTheme.Colors.TextColor.secondary),
                            maxLines = 2,
                        )
                    }
                }

                HorizontalDivider()

                val profileJson = try {
                    JSONObject(profileMap).toString(2)
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

@Suppress("UNCHECKED_CAST")
private fun jsonValueToMap(value: JSONValue): Map<String, Any>? {
    return when (value) {
        is JSONValue.Obj -> value.value.mapValues { jsonValueToAny(it.value) }
        else -> null
    }
}

private fun jsonValueToAny(value: JSONValue): Any {
    return when (value) {
        is JSONValue.Str -> value.value
        is JSONValue.Number -> value.value
        is JSONValue.Bool -> value.value
        is JSONValue.Array -> value.value.map { jsonValueToAny(it) }
        is JSONValue.Obj -> value.value.mapValues { jsonValueToAny(it.value) }
        JSONValue.Null -> "null"
    }
}

private fun stringValue(value: Any?): String {
    if (value == null) return "nil"
    return when (value) {
        is String -> value
        is Boolean -> if (value) "true" else "false"
        is Number -> value.toString()
        else -> value.toString()
    }
}
