import SwiftUI

// MARK: - Badge

enum BadgeVariant {
    case api, override_, manual, info, experiment, personalization, qualified, primary

    var backgroundColor: Color {
        switch self {
        case .api: return PreviewTheme.Colors.Badge.api
        case .override_: return PreviewTheme.Colors.Badge.override_
        case .manual: return PreviewTheme.Colors.Badge.manual
        case .info: return PreviewTheme.Colors.Background.tertiary
        case .experiment: return PreviewTheme.Colors.Badge.experiment
        case .personalization: return PreviewTheme.Colors.Badge.personalization
        case .qualified: return PreviewTheme.Colors.Status.qualified
        case .primary: return PreviewTheme.Colors.CP.normal
        }
    }

    var textColor: Color {
        switch self {
        case .info: return PreviewTheme.Colors.TextColor.secondary
        default: return PreviewTheme.Colors.TextColor.inverse
        }
    }
}

struct PreviewBadge: View {
    let label: String
    let variant: BadgeVariant

    var body: some View {
        Text(label)
            .font(.system(size: PreviewTheme.FontSize.xs, weight: .medium))
            .foregroundColor(variant.textColor)
            .padding(.horizontal, PreviewTheme.Spacing.sm)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: PreviewTheme.Radius.sm)
                    .fill(variant.backgroundColor)
            )
    }
}

// MARK: - Action Button

enum ActionButtonVariant {
    case activate, deactivate, reset, primary, secondary, destructive

    var backgroundColor: Color {
        switch self {
        case .activate: return PreviewTheme.Colors.Action.activate
        case .deactivate: return PreviewTheme.Colors.Action.deactivate
        case .reset: return PreviewTheme.Colors.Action.reset
        case .primary: return PreviewTheme.Colors.CP.normal
        case .secondary: return PreviewTheme.Colors.Background.primary
        case .destructive: return PreviewTheme.Colors.Action.destructive
        }
    }

    var textColor: Color {
        switch self {
        case .secondary: return PreviewTheme.Colors.TextColor.primary
        default: return PreviewTheme.Colors.TextColor.inverse
        }
    }
}

struct PreviewActionButton: View {
    let label: String
    let variant: ActionButtonVariant
    let action: () -> Void
    var disabled: Bool = false
    var accessibilityID: String? = nil

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                .foregroundColor(variant.textColor)
                .padding(.horizontal, PreviewTheme.Spacing.md)
                .padding(.vertical, PreviewTheme.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                        .fill(variant.backgroundColor)
                )
                .overlay(
                    Group {
                        if variant == .secondary {
                            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                                .stroke(PreviewTheme.Colors.Border.secondary, lineWidth: 1)
                        }
                    }
                )
        }
        .disabled(disabled)
        .opacity(disabled ? PreviewTheme.Opacity.disabled : 1)
        .accessibilityIdentifier(accessibilityID ?? "")
    }
}

// MARK: - Audience Toggle (Three-State)

enum AudienceOverrideState: String {
    case on, off, `default`
}

struct AudienceToggle: View {
    let value: AudienceOverrideState
    let onValueChange: (AudienceOverrideState) -> Void
    var disabled: Bool = false
    var audienceId: String? = nil

    private let states: [(AudienceOverrideState, String)] = [
        (.on, "On"),
        (.default, "Default"),
        (.off, "Off"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(states, id: \.0) { state, label in
                Button(action: { onValueChange(state) }) {
                    Text(label)
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: value == state ? .semibold : .medium))
                        .foregroundColor(value == state ? PreviewTheme.Colors.TextColor.inverse : PreviewTheme.Colors.TextColor.secondary)
                        .frame(minWidth: 44)
                        .padding(.horizontal, PreviewTheme.Spacing.md)
                        .padding(.vertical, PreviewTheme.Spacing.xs)
                        .background(
                            RoundedRectangle(cornerRadius: PreviewTheme.Radius.sm)
                                .fill(value == state ? selectedColor(for: state) : Color.clear)
                        )
                }
                .disabled(disabled)
                .accessibilityIdentifier(audienceId.map { "audience-toggle-\($0)-\(state.rawValue)" } ?? "")
            }
        }
        .padding(2)
        .background(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                .fill(PreviewTheme.Colors.Background.tertiary)
        )
        .opacity(disabled ? PreviewTheme.Opacity.disabled : 1)
    }

    private func selectedColor(for state: AudienceOverrideState) -> Color {
        switch state {
        case .on: return PreviewTheme.Colors.Action.activate
        case .off: return PreviewTheme.Colors.Action.deactivate
        case .default: return PreviewTheme.Colors.CP.normal
        }
    }
}

// MARK: - Search Bar

struct PreviewSearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search audiences and experiences..."

    var body: some View {
        HStack(spacing: PreviewTheme.Spacing.sm) {
            // Search icon
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundColor(PreviewTheme.Colors.TextColor.muted)

            TextField(placeholder, text: $text)
                .font(.system(size: PreviewTheme.FontSize.sm))
                .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                #if os(iOS)
                .textInputAutocapitalization(.never)
                #endif
                .disableAutocorrection(true)

            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                }
            }
        }
        .padding(.horizontal, PreviewTheme.Spacing.md)
        .frame(height: 40)
        .background(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                .fill(PreviewTheme.Colors.Background.primary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                .stroke(PreviewTheme.Colors.Border.secondary, lineWidth: 1)
        )
    }
}

// MARK: - Section Card

struct SectionCard<Content: View>: View {
    let title: String
    var collapsible: Bool = false
    var initiallyCollapsed: Bool = false
    @ViewBuilder let content: () -> Content

    @State private var isCollapsed: Bool

    init(
        title: String,
        collapsible: Bool = false,
        initiallyCollapsed: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.collapsible = collapsible
        self.initiallyCollapsed = initiallyCollapsed
        self.content = content
        self._isCollapsed = State(initialValue: initiallyCollapsed)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.sm) {
            // Header
            if collapsible {
                Button(action: { withAnimation(.easeInOut(duration: 0.25)) { isCollapsed.toggle() } }) {
                    sectionHeader
                }
                .buttonStyle(.plain)
            } else {
                sectionHeader
            }

            // Content
            if !isCollapsed {
                content()
            }
        }
        .padding(PreviewTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.lg)
                .fill(PreviewTheme.Colors.Background.primary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.lg)
                .stroke(PreviewTheme.Colors.Border.primary, lineWidth: 1)
        )
    }

    private var sectionHeader: some View {
        HStack {
            Text(title)
                .font(.system(size: PreviewTheme.FontSize.lg, weight: .semibold))
                .foregroundColor(PreviewTheme.Colors.TextColor.primary)
            Spacer()
            if collapsible {
                Text(isCollapsed ? "▶" : "▼")
                    .font(.system(size: PreviewTheme.FontSize.lg, weight: .bold))
                    .foregroundColor(PreviewTheme.Colors.CP.hover)
            }
        }
    }
}

// MARK: - Qualification Indicator

struct QualificationIndicator: View {
    var body: some View {
        HStack(spacing: PreviewTheme.Spacing.xs) {
            Circle()
                .fill(PreviewTheme.Colors.Action.activate)
                .frame(width: 8, height: 8)
            Text("Qualified")
                .font(.system(size: PreviewTheme.FontSize.xs, weight: .medium))
                .foregroundColor(PreviewTheme.Colors.Action.activate)
        }
    }
}

// MARK: - JSON Viewer

struct PreviewJsonViewer: View {
    let data: Any
    var title: String = "JSON Data"
    @State private var isExpanded = false

    private var jsonString: String {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted, .sortedKeys]),
              let str = String(data: jsonData, encoding: .utf8)
        else { return "{}" }
        return str
    }

    private var previewString: String {
        let lines = jsonString.split(separator: "\n", maxSplits: 4, omittingEmptySubsequences: false)
        if lines.count > 3 {
            return lines.prefix(3).joined(separator: "\n") + "\n  ..."
        }
        return jsonString
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.sm) {
            Button(action: { withAnimation { isExpanded.toggle() } }) {
                HStack {
                    Text(title)
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                        .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                    Spacer()
                    Text(isExpanded ? "▼" : "▶")
                        .font(.system(size: PreviewTheme.FontSize.lg, weight: .bold))
                        .foregroundColor(PreviewTheme.Colors.CP.hover)
                }
            }
            .buttonStyle(.plain)

            Text(isExpanded ? jsonString : previewString)
                .font(.system(size: PreviewTheme.FontSize.xs, design: .monospaced))
                .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                .padding(PreviewTheme.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: PreviewTheme.Radius.sm)
                        .fill(PreviewTheme.Colors.Background.tertiary)
                )

            if isExpanded {
                Button(action: { withAnimation { isExpanded = false } }) {
                    Text("Close")
                        .font(.system(size: PreviewTheme.FontSize.md, weight: .semibold))
                        .foregroundColor(PreviewTheme.Colors.CP.hover)
                        .padding(.vertical, PreviewTheme.Spacing.sm)
                        .padding(.horizontal, PreviewTheme.Spacing.lg)
                        .background(
                            RoundedRectangle(cornerRadius: PreviewTheme.Radius.sm)
                                .fill(PreviewTheme.Colors.Background.tertiary)
                        )
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - List Item Row

struct ListItemRow: View {
    let label: String
    var value: String?
    var subtitle: String?
    var badge: (label: String, variant: BadgeVariant)?
    var action: (label: String, variant: ActionButtonVariant, handler: () -> Void)?
    var actionAccessibilityID: String? = nil
    var onLongPress: (() -> Void)?

    var body: some View {
        HStack(alignment: .center, spacing: PreviewTheme.Spacing.md) {
            VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                HStack(spacing: PreviewTheme.Spacing.sm) {
                    Text(label)
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                        .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                    if let badge = badge {
                        PreviewBadge(label: badge.label, variant: badge.variant)
                    }
                }
                if let value = value {
                    Text(value)
                        .font(.system(size: PreviewTheme.FontSize.xs))
                        .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                        .lineLimit(2)
                }
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.system(size: PreviewTheme.FontSize.xs, design: .monospaced))
                        .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                }
            }

            Spacer()

            if let action = action {
                PreviewActionButton(
                    label: action.label,
                    variant: action.variant,
                    action: action.handler,
                    accessibilityID: actionAccessibilityID
                )
            }
        }
        .padding(.vertical, PreviewTheme.Spacing.sm)
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: 0.5) {
            onLongPress?()
        }
    }
}

// MARK: - Collapse Toggle Button

struct CollapseToggleButton: View {
    let allExpanded: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Text(allExpanded ? "Collapse all" : "Expand all")
                .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                .foregroundColor(PreviewTheme.Colors.CP.normal)
        }
    }
}

// MARK: - Variant Selector

struct VariantSelector: View {
    let experience: ExperienceDefinitionDTO
    let isAudienceActive: Bool
    let onSelectVariant: (Int) -> Void

    private var isExperiment: Bool { experience.type == "nt_experiment" }

    var body: some View {
        VStack(spacing: PreviewTheme.Spacing.sm) {
            ForEach(variants, id: \.index) { variant in
                Button(action: { onSelectVariant(variant.index) }) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(variantLabel(for: variant))
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                                .foregroundColor(isAudienceActive ? PreviewTheme.Colors.TextColor.primary : PreviewTheme.Colors.TextColor.muted)
                        }

                        // Percentage for experiments
                        if isExperiment, let percentage = variant.percentage {
                            Text("\(percentage)%")
                                .font(.system(size: PreviewTheme.FontSize.sm))
                                .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                        }

                        if let natural = experience.naturalVariantIndex, natural == variant.index {
                            QualificationIndicator()
                        }

                        Spacer()

                        // Radio button
                        ZStack {
                            Circle()
                                .stroke(
                                    experience.currentVariantIndex == variant.index ? PreviewTheme.Colors.CP.normal : PreviewTheme.Colors.Border.secondary,
                                    lineWidth: 2
                                )
                                .frame(width: 20, height: 20)

                            if experience.currentVariantIndex == variant.index {
                                Circle()
                                    .fill(PreviewTheme.Colors.CP.normal)
                                    .frame(width: 10, height: 10)
                            }
                        }
                    }
                    .padding(.horizontal, PreviewTheme.Spacing.lg)
                    .padding(.vertical, PreviewTheme.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: PreviewTheme.Radius.lg)
                            .fill(PreviewTheme.Colors.Background.primary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: PreviewTheme.Radius.lg)
                            .stroke(
                                experience.currentVariantIndex == variant.index ? PreviewTheme.Colors.CP.normal : PreviewTheme.Colors.Border.primary,
                                lineWidth: experience.currentVariantIndex == variant.index ? 2 : 1
                            )
                    )
                }
                .buttonStyle(.plain)
                .opacity(isAudienceActive ? 1.0 : PreviewTheme.Opacity.muted)
                .accessibilityIdentifier("variant-picker-\(experience.id)-\(variant.index)")
            }
        }
    }

    /// Use distribution data if available, otherwise generate from current variant index.
    private var variants: [VariantDistributionDTO] {
        if !experience.distribution.isEmpty {
            return experience.distribution
        }
        // Fallback: generate basic variant list
        let count = max(experience.currentVariantIndex + 1, 2)
        return (0..<count).map { VariantDistributionDTO(index: $0, variantRef: "", percentage: nil, name: nil) }
    }

    private func variantLabel(for variant: VariantDistributionDTO) -> String {
        if let name = variant.name, !name.isEmpty {
            return name
        }
        return variant.index == 0 ? "Baseline" : "Variant \(variant.index)"
    }
}

// MARK: - Experience Card

struct ExperienceCard: View {
    let experience: ExperienceDefinitionDTO
    let isAudienceActive: Bool
    let onSelectVariant: (Int) -> Void

    private var isExperiment: Bool { experience.type == "nt_experiment" }

    var body: some View {
        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.sm) {
            // Header with type badge and override badge
            HStack(spacing: PreviewTheme.Spacing.sm) {
                PreviewBadge(
                    label: isExperiment ? "Experiment" : "Personalization",
                    variant: isExperiment ? .experiment : .personalization
                )
                if experience.isOverridden {
                    PreviewBadge(label: "Override", variant: .override_)
                }
            }

            // Experience name
            Text(experience.name)
                .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                .lineLimit(2)

            // Variant selector
            VariantSelector(
                experience: experience,
                isAudienceActive: isAudienceActive,
                onSelectVariant: onSelectVariant
            )
        }
        .padding(PreviewTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                .fill(PreviewTheme.Colors.Background.primary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                .stroke(PreviewTheme.Colors.Border.primary, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Audience Item Header

struct AudienceItemHeader: View {
    let audience: AudienceWithExperiencesDTO
    let isExpanded: Bool
    let onToggleExpand: () -> Void
    let onToggleOverride: (AudienceOverrideState) -> Void
    let onCopyId: () -> Void

    private var overrideState: AudienceOverrideState {
        AudienceOverrideState(rawValue: audience.overrideState) ?? .default
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.sm) {
            // Name row with qualification indicator
            Button(action: onToggleExpand) {
                HStack(spacing: PreviewTheme.Spacing.sm) {
                    Text(isExpanded ? "▼" : "▶")
                        .font(.system(size: PreviewTheme.FontSize.xl))
                        .foregroundColor(PreviewTheme.Colors.CP.hover)

                    Text(audience.audience.name)
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                        .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                        .lineLimit(1)

                    if audience.isQualified {
                        QualificationIndicator()
                    }

                    Spacer()

                    Text("\(audience.experiences.count) experience\(audience.experiences.count == 1 ? "" : "s")")
                        .font(.system(size: PreviewTheme.FontSize.xs))
                        .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                }
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 0.5, perform: onCopyId)

            // Description
            if let description = audience.audience.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: PreviewTheme.FontSize.xs))
                    .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
            }

            // Toggle row
            AudienceToggle(
                value: overrideState,
                onValueChange: onToggleOverride,
                audienceId: audience.audience.id
            )
        }
        .padding(.horizontal, PreviewTheme.Spacing.md)
        .padding(.vertical, PreviewTheme.Spacing.sm)
    }
}

// MARK: - Audience Item

struct AudienceItem: View {
    let audience: AudienceWithExperiencesDTO
    let isExpanded: Bool
    let onToggleExpand: () -> Void
    let onToggleOverride: (AudienceOverrideState) -> Void
    let onSelectVariant: (String, Int) -> Void
    let onCopyId: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AudienceItemHeader(
                audience: audience,
                isExpanded: isExpanded,
                onToggleExpand: onToggleExpand,
                onToggleOverride: onToggleOverride,
                onCopyId: onCopyId
            )

            if isExpanded {
                VStack(spacing: PreviewTheme.Spacing.sm) {
                    ForEach(audience.experiences, id: \.id) { experience in
                        ExperienceCard(
                            experience: experience,
                            isAudienceActive: audience.isQualified,
                            onSelectVariant: { variantIndex in
                                onSelectVariant(experience.id, variantIndex)
                            }
                        )
                    }
                }
                .padding(.horizontal, PreviewTheme.Spacing.md)
                .padding(.bottom, PreviewTheme.Spacing.md)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(
            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                .fill(PreviewTheme.Colors.Background.secondary)
        )
        .clipShape(RoundedRectangle(cornerRadius: PreviewTheme.Radius.md))
    }
}
