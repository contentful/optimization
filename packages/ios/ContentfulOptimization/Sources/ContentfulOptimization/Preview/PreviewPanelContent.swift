import Combine
import SwiftUI

/// ID used by core's `buildPreviewModel` to bucket experiences that don't
/// target any defined audience.
let allVisitorsAudienceId = "ALL_VISITORS"

// MARK: - View Model

/// Thin UI-state holder. All bridge-derived data is observed directly from
/// ``OptimizationClient/previewState``; the view model owns only genuinely
/// iOS-side concerns (search text, expansion state, async-fetch flags) plus
/// action delegation.
@MainActor
final class PreviewViewModel: ObservableObject {
    let client: OptimizationClient
    let contentfulClient: PreviewContentfulClient?

    @Published var searchQuery: String = ""
    @Published var expandedAudiences: Set<String> = []
    @Published var isLoadingDefinitions: Bool = false
    @Published var definitionsError: String?

    private var hasLoadedDefinitions = false

    init(client: OptimizationClient, contentfulClient: PreviewContentfulClient? = nil) {
        self.client = client
        self.contentfulClient = contentfulClient
    }

    // MARK: - Contentful Data Loading

    func loadDefinitions() async {
        guard let contentfulClient = contentfulClient, !hasLoadedDefinitions else { return }

        isLoadingDefinitions = true
        definitionsError = nil

        do {
            let results = try await fetchAudienceAndExperienceEntries(client: contentfulClient)

            // Embed per-entry includes so JS `buildVariantEntryMap` can resolve
            // variant entry names from linked references. Contentful CDA returns
            // includes at the top level; JS expects them nested under each entry.
            let experienceEntriesWithIncludes: [[String: Any]] = results.experiences.items.map { item in
                var copy = item
                copy["includes"] = ["Entry": results.experiences.includes.entries]
                return copy
            }

            try client.loadDefinitions(
                audiences: results.audiences.items,
                experiences: experienceEntriesWithIncludes
            )

            hasLoadedDefinitions = true
            isLoadingDefinitions = false
        } catch {
            definitionsError = error.localizedDescription
            isLoadingDefinitions = false
        }
    }

    // MARK: - Filtering

    func filteredAudiences(from model: PreviewModelDTO?) -> [AudienceWithExperiencesDTO] {
        let audiences = model?.audiencesWithExperiences ?? []
        guard !searchQuery.isEmpty else { return audiences }
        let query = searchQuery.lowercased()
        return audiences.filter { dto in
            dto.audience.name.lowercased().contains(query)
                || (dto.audience.description?.lowercased().contains(query) ?? false)
                || dto.experiences.contains { $0.name.lowercased().contains(query) }
        }
    }

    // MARK: - Expand/Collapse

    func allExpanded(for audiences: [AudienceWithExperiencesDTO]) -> Bool {
        !audiences.isEmpty && audiences.allSatisfy { expandedAudiences.contains($0.audience.id) }
    }

    func toggleExpand(_ audienceId: String) {
        withAnimation(.easeInOut(duration: 0.25)) {
            if expandedAudiences.contains(audienceId) {
                expandedAudiences.remove(audienceId)
            } else {
                expandedAudiences.insert(audienceId)
            }
        }
    }

    func toggleExpandAll(for audiences: [AudienceWithExperiencesDTO]) {
        withAnimation(.easeInOut(duration: 0.25)) {
            if allExpanded(for: audiences) {
                expandedAudiences.removeAll()
            } else {
                expandedAudiences = Set(audiences.map(\.audience.id))
            }
        }
    }

    // MARK: - Override Actions

    func setAudienceOverride(
        audienceId: String,
        state: AudienceOverrideState,
        experienceIds: [String]
    ) {
        switch state {
        case .on:
            client.overrideAudience(id: audienceId, qualified: true, experienceIds: experienceIds)
        case .off:
            client.overrideAudience(id: audienceId, qualified: false, experienceIds: experienceIds)
        case .default:
            client.resetAudienceOverride(id: audienceId)
        }
    }

    func setVariantOverride(experienceId: String, variantIndex: Int) {
        client.overrideVariant(experienceId: experienceId, variantIndex: variantIndex)
    }

    func resetAudienceOverride(audienceId: String) {
        client.resetAudienceOverride(id: audienceId)
    }

    func resetVariantOverride(experienceId: String) {
        client.resetVariantOverride(experienceId: experienceId)
    }

    func resetAllOverrides() {
        client.resetAllOverrides()
    }

    // MARK: - Clipboard

    #if canImport(UIKit)
    func copyToClipboard(_ text: String, label: String) {
        UIPasteboard.general.string = text
    }
    #endif
}

// MARK: - Preview Panel Content

public struct PreviewPanelContent: View {
    @EnvironmentObject private var client: OptimizationClient
    private let contentfulClient: PreviewContentfulClient?

    @State private var viewModel: PreviewViewModel?

    public init(contentfulClient: PreviewContentfulClient? = nil) {
        self.contentfulClient = contentfulClient
    }

    public var body: some View {
        Group {
            if let vm = viewModel {
                PreviewPanelMain(viewModel: vm)
            } else {
                ProgressView("Loading...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            // Pull the current bridge snapshot so the panel never renders a blank
            // initial state. `client.previewState` only updates when the JS side
            // fires `notifyChanged` — which happens on API refreshes and override
            // mutations, neither of which may have occurred by the time the user
            // opens the panel for the first time.
            client.refreshPreviewState()
            if viewModel == nil {
                let vm = PreviewViewModel(client: client, contentfulClient: contentfulClient)
                viewModel = vm
                Task { await vm.loadDefinitions() }
            }
        }
    }
}

// MARK: - Main Panel View

struct PreviewPanelMain: View {
    @ObservedObject var viewModel: PreviewViewModel
    @EnvironmentObject private var client: OptimizationClient
    @State private var showResetAlert = false

    private var previewModel: PreviewModelDTO? { client.previewState?.previewModel }
    private var audienceOverrides: [String: Bool] { client.previewState?.audienceOverrides ?? [:] }
    private var variantOverrides: [String: Int] { client.previewState?.variantOverrides ?? [:] }
    private var audienceNameMap: [String: String] { previewModel?.audienceNameMap ?? [:] }
    private var experienceNameMap: [String: String] { previewModel?.experienceNameMap ?? [:] }
    private var hasOverrides: Bool { !audienceOverrides.isEmpty || !variantOverrides.isEmpty }

    private var filteredAudiences: [AudienceWithExperiencesDTO] {
        viewModel.filteredAudiences(from: previewModel)
    }

    var body: some View {
        VStack(spacing: 0) {
            panelHeader
                .padding(.horizontal, PreviewTheme.Spacing.lg)
                .padding(.vertical, PreviewTheme.Spacing.md)

            if !(previewModel?.audiencesWithExperiences.isEmpty ?? true) {
                PreviewSearchBar(text: $viewModel.searchQuery)
                    .padding(.horizontal, PreviewTheme.Spacing.lg)
                    .padding(.bottom, PreviewTheme.Spacing.md)
            }

            ScrollView {
                VStack(spacing: PreviewTheme.Spacing.lg) {
                    if viewModel.isLoadingDefinitions {
                        HStack(spacing: PreviewTheme.Spacing.sm) {
                            ProgressView()
                            Text("Loading definitions...")
                                .font(.system(size: PreviewTheme.FontSize.sm))
                                .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                        }
                        .padding(PreviewTheme.Spacing.md)
                    }

                    if let error = viewModel.definitionsError {
                        HStack(spacing: PreviewTheme.Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(PreviewTheme.Colors.Action.reset)
                            Text(error)
                                .font(.system(size: PreviewTheme.FontSize.xs))
                                .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                        }
                        .padding(PreviewTheme.Spacing.md)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                                .fill(PreviewTheme.Colors.Background.primary)
                        )
                    }

                    audienceSection
                    profileSection
                    debugSection
                    overridesSection
                }
                .padding(.horizontal, PreviewTheme.Spacing.lg)
                .padding(.bottom, PreviewTheme.Spacing.lg)
            }
            .accessibilityIdentifier("preview-panel-list")

            panelFooter
        }
        .background(PreviewTheme.Colors.Background.secondary.ignoresSafeArea())
    }

    // MARK: - Header

    private var panelHeader: some View {
        HStack {
            Text("Preview Panel")
                .font(.system(size: PreviewTheme.FontSize.lg, weight: .semibold))
                .foregroundColor(PreviewTheme.Colors.TextColor.primary)
            Spacer()
            consentBadge
        }
    }

    private var consentBadge: some View {
        Text("Consent: \(consentText)")
            .font(.system(size: PreviewTheme.FontSize.xs, weight: .medium))
            .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
            .padding(.horizontal, PreviewTheme.Spacing.md)
            .padding(.vertical, PreviewTheme.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: PreviewTheme.Radius.sm)
                    .fill(PreviewTheme.Colors.Background.tertiary)
            )
    }

    private var consentText: String {
        guard let consent = client.previewState?.consent else { return "—" }
        return consent ? "Yes" : "No"
    }

    // MARK: - Audience Section

    private var audienceSection: some View {
        SectionCard(title: "Audiences & Experiences (\(filteredAudiences.count))") {
            if filteredAudiences.count > 1 {
                HStack {
                    Spacer()
                    CollapseToggleButton(
                        allExpanded: viewModel.allExpanded(for: filteredAudiences),
                        onToggle: { viewModel.toggleExpandAll(for: filteredAudiences) }
                    )
                }
            }

            if filteredAudiences.isEmpty {
                if viewModel.searchQuery.isEmpty {
                    Text("No audience data")
                        .font(.system(size: PreviewTheme.FontSize.sm))
                        .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, PreviewTheme.Spacing.lg)
                } else {
                    Text("No results found for \"\(viewModel.searchQuery)\"")
                        .font(.system(size: PreviewTheme.FontSize.sm))
                        .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, PreviewTheme.Spacing.lg)
                }
            } else {
                VStack(spacing: PreviewTheme.Spacing.sm) {
                    ForEach(filteredAudiences, id: \.audience.id) { audience in
                        AudienceItem(
                            audience: audience,
                            isExpanded: viewModel.expandedAudiences.contains(audience.audience.id),
                            onToggleExpand: { viewModel.toggleExpand(audience.audience.id) },
                            onToggleOverride: { state in
                                viewModel.setAudienceOverride(
                                    audienceId: audience.audience.id,
                                    state: state,
                                    experienceIds: audience.experiences.map(\.id)
                                )
                            },
                            onSelectVariant: { expId, variant in
                                viewModel.setVariantOverride(experienceId: expId, variantIndex: variant)
                            },
                            onCopyId: {
                                #if canImport(UIKit)
                                viewModel.copyToClipboard(audience.audience.id, label: "Audience ID")
                                #endif
                            }
                        )
                    }
                }
            }
        }
    }

    // MARK: - Profile Section

    private var profileSection: some View {
        SectionCard(title: "Profile", collapsible: true, initiallyCollapsed: false) {
            if let profile = client.previewState?.profile?.toFoundation() as? [String: Any] {
                VStack(alignment: .leading, spacing: PreviewTheme.Spacing.md) {
                    // Flat per-key rows keep the profile shape test-addressable via
                    // `profile-item-<key>` identifiers — matches the shared contract
                    // the XCUITest suite drives.
                    ForEach(Array(profile.keys.sorted()), id: \.self) { key in
                        HStack(alignment: .top) {
                            Text(key)
                                .font(.system(size: PreviewTheme.FontSize.xs, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                            Spacer()
                            Text(stringValue(profile[key]))
                                .font(.system(size: PreviewTheme.FontSize.xs))
                                .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                                .lineLimit(2)
                                .multilineTextAlignment(.trailing)
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityIdentifier("profile-item-\(key)")
                    }
                    Divider()

                    if let profileId = profile["id"] as? String {
                        ListItemRow(
                            label: "Profile ID",
                            value: profileId,
                            onLongPress: {
                                #if canImport(UIKit)
                                viewModel.copyToClipboard(profileId, label: "Profile ID")
                                #endif
                            }
                        )
                        Divider()
                    }

                    if let traits = profile["traits"] as? [String: Any], !traits.isEmpty {
                        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                            Text("Traits (\(traits.count))")
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)

                            ForEach(Array(traits.keys.sorted()), id: \.self) { key in
                                HStack {
                                    Text(key)
                                        .font(.system(size: PreviewTheme.FontSize.xs))
                                        .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                                    Spacer()
                                    Text(stringValue(traits[key]))
                                        .font(.system(size: PreviewTheme.FontSize.xs))
                                        .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                                        .lineLimit(2)
                                }
                            }
                        }
                        Divider()
                    }

                    if let profileAudiences = profile["audiences"] as? [String], !profileAudiences.isEmpty {
                        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                            Text("Audiences (\(profileAudiences.count))")
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)

                            ForEach(profileAudiences, id: \.self) { audienceId in
                                ListItemRow(
                                    label: audienceId,
                                    badge: (label: "API", variant: .api),
                                    onLongPress: {
                                        #if canImport(UIKit)
                                        viewModel.copyToClipboard(audienceId, label: "Audience ID")
                                        #endif
                                    }
                                )
                            }
                        }
                        Divider()
                    }

                    PreviewJsonViewer(data: profile, title: "Full Profile JSON")
                }
            } else {
                Text("No profile data")
                    .font(.system(size: PreviewTheme.FontSize.sm))
                    .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, PreviewTheme.Spacing.lg)
                    .accessibilityIdentifier("no-profile-data")
            }
        }
    }

    // MARK: - Debug Section

    private var debugSection: some View {
        SectionCard(title: "Debug", collapsible: true) {
            VStack(alignment: .leading, spacing: PreviewTheme.Spacing.md) {
                HStack {
                    Text("Consent")
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                        .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                    Spacer()
                    Text(consentLabel)
                        .font(.system(size: PreviewTheme.FontSize.sm))
                        .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("debug-consent")

                HStack {
                    Text("Can Personalize")
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: .medium))
                        .foregroundColor(PreviewTheme.Colors.TextColor.primary)
                    Spacer()
                    Text(canPersonalizeLabel)
                        .font(.system(size: PreviewTheme.FontSize.sm))
                        .foregroundColor(PreviewTheme.Colors.TextColor.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("debug-can-personalize")

                Button(action: { client.refreshPreviewState() }) {
                    Text("Refresh")
                        .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                        .foregroundColor(PreviewTheme.Colors.TextColor.inverse)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, PreviewTheme.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                                .fill(PreviewTheme.Colors.CP.normal)
                        )
                }
                .accessibilityIdentifier("preview-refresh-button")
            }
        }
    }

    private var consentLabel: String {
        switch client.previewState?.consent {
        case .some(true): return "Accepted"
        case .some(false): return "Declined"
        case .none: return "Pending"
        }
    }

    private var canPersonalizeLabel: String {
        (client.previewState?.canPersonalize ?? false) ? "Yes" : "No"
    }

    // MARK: - Overrides Section

    private var overridesSection: some View {
        SectionCard(title: "Overrides", collapsible: true) {
            if hasOverrides {
                VStack(alignment: .leading, spacing: PreviewTheme.Spacing.md) {
                    Text("\(audienceOverrides.count) audience override\(audienceOverrides.count == 1 ? "" : "s"), \(variantOverrides.count) optimization override\(variantOverrides.count == 1 ? "" : "s")")
                        .font(.system(size: PreviewTheme.FontSize.xs))
                        .foregroundColor(PreviewTheme.Colors.TextColor.secondary)

                    if !audienceOverrides.isEmpty {
                        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                            Text("Audience Overrides")
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)

                            ForEach(activeAudienceOverrides, id: \.id) { override_ in
                                ListItemRow(
                                    label: override_.name,
                                    value: override_.state == .on ? "Activated" : "Deactivated",
                                    action: (
                                        label: "Reset",
                                        variant: .reset,
                                        handler: { viewModel.resetAudienceOverride(audienceId: override_.id) }
                                    ),
                                    actionAccessibilityID: "reset-audience-\(override_.id)"
                                )
                            }
                        }
                    }

                    if !variantOverrides.isEmpty {
                        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                            Text("Optimization Overrides")
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)

                            ForEach(activeVariantOverrides, id: \.experienceId) { override_ in
                                ListItemRow(
                                    label: override_.name,
                                    value: override_.variantIndex == 0 ? "Baseline" : "Variant \(override_.variantIndex)",
                                    action: (
                                        label: "Reset",
                                        variant: .reset,
                                        handler: { viewModel.resetVariantOverride(experienceId: override_.experienceId) }
                                    ),
                                    actionAccessibilityID: "reset-variant-\(override_.experienceId)"
                                )
                            }
                        }
                    }
                }
            } else {
                Text("No active overrides")
                    .font(.system(size: PreviewTheme.FontSize.sm))
                    .foregroundColor(PreviewTheme.Colors.TextColor.muted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, PreviewTheme.Spacing.lg)
            }
        }
    }

    // MARK: - Footer

    private var panelFooter: some View {
        VStack(spacing: 0) {
            Divider()
            Button(action: { showResetAlert = true }) {
                Text("Reset to Actual State")
                    .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                    .foregroundColor(PreviewTheme.Colors.TextColor.inverse)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, PreviewTheme.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: PreviewTheme.Radius.md)
                            .fill(PreviewTheme.Colors.Action.destructive)
                    )
            }
            .padding(PreviewTheme.Spacing.lg)
            .opacity(hasOverrides ? 1.0 : PreviewTheme.Opacity.disabled)
            .disabled(!hasOverrides)
            .accessibilityIdentifier("reset-all-overrides")
        }
        .background(PreviewTheme.Colors.Background.primary)
        .alert("Reset to Actual State", isPresented: $showResetAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                viewModel.resetAllOverrides()
            }
        } message: {
            Text("This will clear all manual overrides and restore SDK state to values last received from the API. Continue?")
        }
    }

    // MARK: - Derived override summaries

    private var activeAudienceOverrides: [(id: String, name: String, state: AudienceOverrideState)] {
        audienceOverrides.map { audienceId, qualified in
            let name = audienceNameMap[audienceId] ?? audienceId
            let state: AudienceOverrideState = qualified ? .on : .off
            return (id: audienceId, name: name, state: state)
        }.sorted { $0.name < $1.name }
    }

    private var activeVariantOverrides: [(experienceId: String, name: String, variantIndex: Int)] {
        variantOverrides.map { expId, variant in
            let name = experienceNameMap[expId] ?? expId
            return (experienceId: expId, name: name, variantIndex: variant)
        }.sorted { $0.name < $1.name }
    }

    // MARK: - Helpers

    private func stringValue(_ value: Any?) -> String {
        guard let value = value else { return "nil" }
        if let str = value as? String { return str }
        if let bool = value as? Bool { return bool ? "true" : "false" }
        if let num = value as? NSNumber { return num.stringValue }
        if let data = try? JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed) {
            return String(data: data, encoding: .utf8) ?? "\(value)"
        }
        return "\(value)"
    }
}
