package com.contentful.optimization.preview

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentful.optimization.core.AudienceWithExperiencesDTO
import com.contentful.optimization.core.ExperienceDefinitionDTO
import com.contentful.optimization.core.VariantDistributionDTO

// MARK: - Badge

enum class BadgeVariant {
    API, OVERRIDE, MANUAL, INFO, EXPERIMENT, PERSONALIZATION, QUALIFIED, PRIMARY;

    val backgroundColor
        @Composable get() = when (this) {
            API -> PreviewTheme.Colors.Badge.api
            OVERRIDE -> PreviewTheme.Colors.Badge.override_
            MANUAL -> PreviewTheme.Colors.Badge.manual
            INFO -> PreviewTheme.Colors.Background.tertiary
            EXPERIMENT -> PreviewTheme.Colors.Badge.experiment
            PERSONALIZATION -> PreviewTheme.Colors.Badge.personalization
            QUALIFIED -> PreviewTheme.Colors.Status.qualified
            PRIMARY -> PreviewTheme.Colors.CP.normal
        }

    val textColor
        @Composable get() = when (this) {
            INFO -> PreviewTheme.Colors.TextColor.secondary
            else -> PreviewTheme.Colors.TextColor.inverse
        }
}

@Composable
fun PreviewBadge(label: String, variant: BadgeVariant) {
    Text(
        text = label,
        style = TextStyle(
            fontSize = PreviewTheme.FontSize.xs,
            fontWeight = FontWeight.Medium,
            color = variant.textColor,
        ),
        modifier = Modifier
            .background(variant.backgroundColor, RoundedCornerShape(PreviewTheme.Radius.sm))
            .padding(horizontal = PreviewTheme.Spacing.sm, vertical = 2.dp),
    )
}

// MARK: - Action Button

enum class ActionButtonVariant {
    ACTIVATE, DEACTIVATE, RESET, PRIMARY, SECONDARY, DESTRUCTIVE;

    val backgroundColor
        @Composable get() = when (this) {
            ACTIVATE -> PreviewTheme.Colors.Action.activate
            DEACTIVATE -> PreviewTheme.Colors.Action.deactivate
            RESET -> PreviewTheme.Colors.Action.reset
            PRIMARY -> PreviewTheme.Colors.CP.normal
            SECONDARY -> PreviewTheme.Colors.Background.primary
            DESTRUCTIVE -> PreviewTheme.Colors.Action.destructive
        }

    val textColor
        @Composable get() = when (this) {
            SECONDARY -> PreviewTheme.Colors.TextColor.primary
            else -> PreviewTheme.Colors.TextColor.inverse
        }
}

@Composable
fun PreviewActionButton(
    label: String,
    variant: ActionButtonVariant,
    onClick: () -> Unit,
    disabled: Boolean = false,
    accessibilityID: String? = null,
) {
    val modifier = Modifier
        .alpha(if (disabled) PreviewTheme.Opacity.disabled else 1f)
        .let { mod ->
            if (variant == ActionButtonVariant.SECONDARY) {
                mod
                    .border(1.dp, PreviewTheme.Colors.Border.secondary, RoundedCornerShape(PreviewTheme.Radius.md))
                    .background(variant.backgroundColor, RoundedCornerShape(PreviewTheme.Radius.md))
            } else {
                mod.background(variant.backgroundColor, RoundedCornerShape(PreviewTheme.Radius.md))
            }
        }
        .clickable(enabled = !disabled, onClick = onClick)
        .padding(horizontal = PreviewTheme.Spacing.md, vertical = PreviewTheme.Spacing.sm)
        .let { mod ->
            if (accessibilityID != null) mod.semantics { contentDescription = accessibilityID }
            else mod
        }

    Text(
        text = label,
        style = TextStyle(
            fontSize = PreviewTheme.FontSize.sm,
            fontWeight = FontWeight.Medium,
            color = variant.textColor,
        ),
        modifier = modifier,
    )
}

// MARK: - Audience Toggle (Three-State)

enum class AudienceOverrideState(val value: String) {
    ON("on"), OFF("off"), DEFAULT("default");

    companion object {
        fun from(raw: String) = entries.find { it.value == raw } ?: DEFAULT
    }
}

@Composable
fun AudienceToggle(
    value: AudienceOverrideState,
    onValueChange: (AudienceOverrideState) -> Unit,
    disabled: Boolean = false,
    audienceId: String? = null,
) {
    val states = listOf(
        AudienceOverrideState.ON to "On",
        AudienceOverrideState.DEFAULT to "Default",
        AudienceOverrideState.OFF to "Off",
    )

    Row(
        modifier = Modifier
            .alpha(if (disabled) PreviewTheme.Opacity.disabled else 1f)
            .background(PreviewTheme.Colors.Background.tertiary, RoundedCornerShape(PreviewTheme.Radius.md))
            .padding(2.dp),
    ) {
        states.forEach { (state, label) ->
            val isSelected = value == state
            val bgColor = if (isSelected) {
                when (state) {
                    AudienceOverrideState.ON -> PreviewTheme.Colors.Action.activate
                    AudienceOverrideState.OFF -> PreviewTheme.Colors.Action.deactivate
                    AudienceOverrideState.DEFAULT -> PreviewTheme.Colors.CP.normal
                }
            } else {
                PreviewTheme.Colors.Background.tertiary
            }
            val textColor = if (isSelected) PreviewTheme.Colors.TextColor.inverse else PreviewTheme.Colors.TextColor.secondary

            Text(
                text = label,
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.sm,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                    color = textColor,
                ),
                modifier = Modifier
                    .clickable(enabled = !disabled) { onValueChange(state) }
                    .background(bgColor, RoundedCornerShape(PreviewTheme.Radius.sm))
                    .padding(horizontal = PreviewTheme.Spacing.md, vertical = PreviewTheme.Spacing.xs)
                    .let { mod ->
                        val aid = audienceId
                        if (aid != null) mod.semantics { contentDescription = "audience-toggle-$aid-${state.value}" }
                        else mod
                    },
            )
        }
    }
}

// MARK: - Search Bar

@Composable
fun PreviewSearchBar(
    text: String,
    onTextChange: (String) -> Unit,
    placeholder: String = "Search audiences and experiences...",
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .height(40.dp)
            .background(PreviewTheme.Colors.Background.primary, RoundedCornerShape(PreviewTheme.Radius.md))
            .border(1.dp, PreviewTheme.Colors.Border.secondary, RoundedCornerShape(PreviewTheme.Radius.md))
            .padding(horizontal = PreviewTheme.Spacing.md),
    ) {
        Text(
            text = "🔍",
            style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
        )
        Spacer(modifier = Modifier.width(PreviewTheme.Spacing.sm))
        Box(modifier = Modifier.weight(1f)) {
            if (text.isEmpty()) {
                Text(
                    text = placeholder,
                    style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                )
            }
            BasicTextField(
                value = text,
                onValueChange = onTextChange,
                textStyle = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.primary),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (text.isNotEmpty()) {
            Text(
                text = "✕",
                style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                modifier = Modifier.clickable { onTextChange("") },
            )
        }
    }
}

// MARK: - Section Card

@Composable
fun SectionCard(
    title: String,
    collapsible: Boolean = false,
    initiallyCollapsed: Boolean = false,
    content: @Composable () -> Unit,
) {
    var isCollapsed by remember { mutableStateOf(initiallyCollapsed) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(PreviewTheme.Colors.Background.primary, RoundedCornerShape(PreviewTheme.Radius.lg))
            .border(1.dp, PreviewTheme.Colors.Border.primary, RoundedCornerShape(PreviewTheme.Radius.lg))
            .padding(PreviewTheme.Spacing.md),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .let { if (collapsible) it.clickable { isCollapsed = !isCollapsed } else it },
        ) {
            Text(
                text = title,
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.lg,
                    fontWeight = FontWeight.SemiBold,
                    color = PreviewTheme.Colors.TextColor.primary,
                ),
            )
            Spacer(modifier = Modifier.weight(1f))
            if (collapsible) {
                Text(
                    text = if (isCollapsed) "▶" else "▼",
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.lg,
                        fontWeight = FontWeight.Bold,
                        color = PreviewTheme.Colors.CP.hover,
                    ),
                )
            }
        }

        AnimatedVisibility(
            visible = !isCollapsed,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            Column(modifier = Modifier.padding(top = PreviewTheme.Spacing.sm)) {
                content()
            }
        }
    }
}

// MARK: - Qualification Indicator

@Composable
fun QualificationIndicator() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.xs),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(PreviewTheme.Colors.Action.activate, CircleShape),
        )
        Text(
            text = "Qualified",
            style = TextStyle(
                fontSize = PreviewTheme.FontSize.xs,
                fontWeight = FontWeight.Medium,
                color = PreviewTheme.Colors.Action.activate,
            ),
        )
    }
}

// MARK: - JSON Viewer

@Composable
fun PreviewJsonViewer(data: String, title: String = "JSON Data") {
    var isExpanded by remember { mutableStateOf(false) }
    val previewText = if (isExpanded) data else {
        val lines = data.split("\n")
        if (lines.size > 3) lines.take(3).joinToString("\n") + "\n  ..." else data
    }

    Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().clickable { isExpanded = !isExpanded },
        ) {
            Text(
                text = title,
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.sm,
                    fontWeight = FontWeight.SemiBold,
                    color = PreviewTheme.Colors.TextColor.primary,
                ),
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = if (isExpanded) "▼" else "▶",
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.lg,
                    fontWeight = FontWeight.Bold,
                    color = PreviewTheme.Colors.CP.hover,
                ),
            )
        }

        Text(
            text = previewText,
            style = TextStyle(
                fontSize = PreviewTheme.FontSize.xs,
                fontFamily = FontFamily.Monospace,
                color = PreviewTheme.Colors.TextColor.secondary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .background(PreviewTheme.Colors.Background.tertiary, RoundedCornerShape(PreviewTheme.Radius.sm))
                .padding(PreviewTheme.Spacing.sm),
        )

        if (isExpanded) {
            Text(
                text = "Close",
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.md,
                    fontWeight = FontWeight.SemiBold,
                    color = PreviewTheme.Colors.CP.hover,
                ),
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .clickable { isExpanded = false }
                    .background(PreviewTheme.Colors.Background.tertiary, RoundedCornerShape(PreviewTheme.Radius.sm))
                    .padding(vertical = PreviewTheme.Spacing.sm, horizontal = PreviewTheme.Spacing.lg),
            )
        }
    }
}

// MARK: - List Item Row

@Composable
fun ListItemRow(
    label: String,
    value: String? = null,
    subtitle: String? = null,
    badge: Pair<String, BadgeVariant>? = null,
    action: Triple<String, ActionButtonVariant, () -> Unit>? = null,
    actionAccessibilityID: String? = null,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.md),
        modifier = Modifier.fillMaxWidth().padding(vertical = PreviewTheme.Spacing.sm),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.xs)) {
            Row(horizontalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm)) {
                Text(
                    text = label,
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.sm,
                        fontWeight = FontWeight.Medium,
                        color = PreviewTheme.Colors.TextColor.primary,
                    ),
                )
                if (badge != null) {
                    PreviewBadge(label = badge.first, variant = badge.second)
                }
            }
            if (value != null) {
                Text(
                    text = value,
                    style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = PreviewTheme.Colors.TextColor.secondary),
                    maxLines = 2,
                )
            }
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.xs,
                        fontFamily = FontFamily.Monospace,
                        color = PreviewTheme.Colors.TextColor.muted,
                    ),
                )
            }
        }

        if (action != null) {
            PreviewActionButton(
                label = action.first,
                variant = action.second,
                onClick = action.third,
                accessibilityID = actionAccessibilityID,
            )
        }
    }
}

// MARK: - Collapse Toggle Button

@Composable
fun CollapseToggleButton(allExpanded: Boolean, onToggle: () -> Unit) {
    Text(
        text = if (allExpanded) "Collapse all" else "Expand all",
        style = TextStyle(
            fontSize = PreviewTheme.FontSize.sm,
            fontWeight = FontWeight.Medium,
            color = PreviewTheme.Colors.CP.normal,
        ),
        modifier = Modifier.clickable(onClick = onToggle),
    )
}

// MARK: - Variant Selector

@Composable
fun VariantSelector(
    experience: ExperienceDefinitionDTO,
    isAudienceActive: Boolean,
    onSelectVariant: (Int) -> Unit,
) {
    val isExperiment = experience.type == "nt_experiment"
    val variants = if (experience.distribution.isNotEmpty()) {
        experience.distribution
    } else {
        val count = maxOf(experience.currentVariantIndex + 1, 2)
        (0 until count).map { VariantDistributionDTO(index = it, variantRef = "", percentage = null, name = null) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm)) {
        variants.forEach { variant ->
            val isSelected = experience.currentVariantIndex == variant.index
            val borderColor = if (isSelected) PreviewTheme.Colors.CP.normal else PreviewTheme.Colors.Border.primary
            val borderWidth = if (isSelected) 2.dp else 1.dp

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(if (isAudienceActive) 1f else PreviewTheme.Opacity.muted)
                    .background(PreviewTheme.Colors.Background.primary, RoundedCornerShape(PreviewTheme.Radius.lg))
                    .border(borderWidth, borderColor, RoundedCornerShape(PreviewTheme.Radius.lg))
                    .clickable { onSelectVariant(variant.index) }
                    .padding(horizontal = PreviewTheme.Spacing.lg, vertical = PreviewTheme.Spacing.md)
                    .semantics { contentDescription = "variant-picker-${experience.id}-${variant.index}" },
            ) {
                val variantLabel = if (!variant.name.isNullOrEmpty()) variant.name else {
                    if (variant.index == 0) "Baseline" else "Variant ${variant.index}"
                }
                Text(
                    text = variantLabel,
                    style = TextStyle(
                        fontSize = PreviewTheme.FontSize.sm,
                        fontWeight = FontWeight.Medium,
                        color = if (isAudienceActive) PreviewTheme.Colors.TextColor.primary else PreviewTheme.Colors.TextColor.muted,
                    ),
                )

                if (isExperiment && variant.percentage != null) {
                    Spacer(modifier = Modifier.width(PreviewTheme.Spacing.sm))
                    Text(
                        text = "${variant.percentage}%",
                        style = TextStyle(fontSize = PreviewTheme.FontSize.sm, color = PreviewTheme.Colors.TextColor.muted),
                    )
                }

                if (experience.naturalVariantIndex == variant.index) {
                    Spacer(modifier = Modifier.width(PreviewTheme.Spacing.sm))
                    QualificationIndicator()
                }

                Spacer(modifier = Modifier.weight(1f))

                // Radio button
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .border(
                            2.dp,
                            if (isSelected) PreviewTheme.Colors.CP.normal else PreviewTheme.Colors.Border.secondary,
                            CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isSelected) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .background(PreviewTheme.Colors.CP.normal, CircleShape),
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Experience Card

@Composable
fun ExperienceCard(
    experience: ExperienceDefinitionDTO,
    isAudienceActive: Boolean,
    onSelectVariant: (Int) -> Unit,
) {
    val isExperiment = experience.type == "nt_experiment"

    Column(
        verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm),
        modifier = Modifier
            .fillMaxWidth()
            .shadow(1.dp, RoundedCornerShape(PreviewTheme.Radius.md))
            .background(PreviewTheme.Colors.Background.primary, RoundedCornerShape(PreviewTheme.Radius.md))
            .border(1.dp, PreviewTheme.Colors.Border.primary, RoundedCornerShape(PreviewTheme.Radius.md))
            .padding(PreviewTheme.Spacing.md),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm)) {
            PreviewBadge(
                label = if (isExperiment) "Experiment" else "Personalization",
                variant = if (isExperiment) BadgeVariant.EXPERIMENT else BadgeVariant.PERSONALIZATION,
            )
            if (experience.isOverridden) {
                PreviewBadge(label = "Override", variant = BadgeVariant.OVERRIDE)
            }
        }

        Text(
            text = experience.name,
            style = TextStyle(
                fontSize = PreviewTheme.FontSize.sm,
                fontWeight = FontWeight.Medium,
                color = PreviewTheme.Colors.TextColor.primary,
            ),
            maxLines = 2,
        )

        VariantSelector(
            experience = experience,
            isAudienceActive = isAudienceActive,
            onSelectVariant = onSelectVariant,
        )
    }
}

// MARK: - Audience Item Header

@Composable
fun AudienceItemHeader(
    audience: AudienceWithExperiencesDTO,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onToggleOverride: (AudienceOverrideState) -> Unit,
) {
    val overrideState = AudienceOverrideState.from(audience.overrideState)

    Column(
        verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm),
        modifier = Modifier
            .padding(horizontal = PreviewTheme.Spacing.md, vertical = PreviewTheme.Spacing.sm),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggleExpand)
                .semantics { contentDescription = "audience-expand-${audience.audience.id}" },
        ) {
            Text(
                text = if (isExpanded) "▼" else "▶",
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.xl,
                    color = PreviewTheme.Colors.CP.hover,
                ),
            )
            Spacer(modifier = Modifier.width(PreviewTheme.Spacing.sm))
            Text(
                text = audience.audience.name,
                style = TextStyle(
                    fontSize = PreviewTheme.FontSize.sm,
                    fontWeight = FontWeight.Medium,
                    color = PreviewTheme.Colors.TextColor.primary,
                ),
                maxLines = 1,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (audience.isQualified) {
                Spacer(modifier = Modifier.width(PreviewTheme.Spacing.sm))
                QualificationIndicator()
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "${audience.experiences.size} experience${if (audience.experiences.size == 1) "" else "s"}",
                style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = PreviewTheme.Colors.TextColor.muted),
            )
        }

        if (!audience.audience.description.isNullOrEmpty()) {
            Text(
                text = audience.audience.description,
                style = TextStyle(fontSize = PreviewTheme.FontSize.xs, color = PreviewTheme.Colors.TextColor.secondary),
            )
        }

        AudienceToggle(
            value = overrideState,
            onValueChange = onToggleOverride,
            audienceId = audience.audience.id,
        )
    }
}

// MARK: - Audience Item

@Composable
fun AudienceItem(
    audience: AudienceWithExperiencesDTO,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onToggleOverride: (AudienceOverrideState) -> Unit,
    onSelectVariant: (String, Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(PreviewTheme.Radius.md))
            .background(PreviewTheme.Colors.Background.secondary),
    ) {
        AudienceItemHeader(
            audience = audience,
            isExpanded = isExpanded,
            onToggleExpand = onToggleExpand,
            onToggleOverride = onToggleOverride,
        )

        AnimatedVisibility(
            visible = isExpanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(PreviewTheme.Spacing.sm),
                modifier = Modifier
                    .padding(horizontal = PreviewTheme.Spacing.md)
                    .padding(bottom = PreviewTheme.Spacing.md),
            ) {
                audience.experiences.forEach { experience ->
                    ExperienceCard(
                        experience = experience,
                        isAudienceActive = audience.isQualified,
                        onSelectVariant = { variantIndex ->
                            onSelectVariant(experience.id, variantIndex)
                        },
                    )
                }
            }
        }
    }
}
