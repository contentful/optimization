import Combine
import SwiftUI

// MARK: - View Model

@MainActor
final class PreviewViewModel: ObservableObject {
    let client: OptimizationClient
    let contentfulClient: PreviewContentfulClient?

    @Published var audiences: [PreviewAudience] = []
    @Published var profile: [String: Any]?
    @Published var consent: Bool?
    @Published var canPersonalize: Bool = false
    @Published var searchQuery: String = ""
    @Published var expandedAudiences: Set<String> = []
    @Published var isLoadingDefinitions: Bool = false
    @Published var definitionsError: String?

    // Definitions from Contentful
    private var audienceDefinitions: [AudienceDefinition] = []
    private var experienceDefinitions: [ExperienceDefinition] = []
    private var audienceNameMap: [String: String] = [:]
    private var experienceNameMap: [String: String] = [:]
    private var hasLoadedDefinitions = false

    // Override state read from the JS bridge (single source of truth)
    private var bridgeAudienceOverrides: [String: Bool] = [:]
    private var bridgeVariantOverrides: [String: Int] = [:]
    private var bridgeDefaultVariantIndices: [String: Int] = [:]

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

            audienceDefinitions = createAudienceDefinitions(from: results.audiences.items)
            experienceDefinitions = createExperienceDefinitions(
                from: results.experiences.items,
                includedEntries: results.experiences.includes.entries
            )
            audienceNameMap = createAudienceNameMap(from: audienceDefinitions)
            experienceNameMap = createExperienceNameMap(from: results.experiences.items)
            hasLoadedDefinitions = true
            isLoadingDefinitions = false

            // Rebuild audiences with rich data
            refreshState()
        } catch {
            definitionsError = error.localizedDescription
            isLoadingDefinitions = false
        }
    }

    // MARK: - State Management

    func refreshState() {
        guard let state = client.getPreviewState() else { return }

        profile = state.profile?.toFoundation() as? [String: Any]
        consent = state.consent
        canPersonalize = state.canPersonalize

        // Read override tracking from the bridge (single source of truth)
        bridgeAudienceOverrides = state.audienceOverrides ?? [:]
        bridgeVariantOverrides = state.variantOverrides ?? [:]
        bridgeDefaultVariantIndices = state.defaultVariantIndices ?? [:]

        let selectedPersonalizations = state.selectedPersonalizations ?? []
        let changes = state.changes ?? []
        let qualifiedAudienceIds = Set(state.profile?["audiences"]?.toStringArray() ?? [])

        // Build experience variant lookup from selectedPersonalizations
        var sdkVariantIndices: [String: Int] = [:]
        for p in selectedPersonalizations {
            sdkVariantIndices[p.experienceId] = p.variantIndex
        }

        if hasLoadedDefinitions {
            buildAudiencesFromDefinitions(
                changes: changes,
                sdkVariantIndices: sdkVariantIndices,
                qualifiedAudienceIds: qualifiedAudienceIds
            )
        } else {
            buildAudiencesFromChanges(
                changes: changes,
                sdkVariantIndices: sdkVariantIndices,
                selectedPersonalizations: selectedPersonalizations
            )
        }
    }

    /// Derive the AudienceOverrideState for a given audience from the bridge's override map.
    private func audienceOverrideState(for audienceId: String) -> AudienceOverrideState {
        guard let qualified = bridgeAudienceOverrides[audienceId] else {
            return .default
        }
        return qualified ? .on : .off
    }

    // MARK: - Build Audiences from Contentful Definitions (rich data)

    private func buildAudiencesFromDefinitions(
        changes: [PreviewChange],
        sdkVariantIndices: [String: Int],
        qualifiedAudienceIds: Set<String>
    ) {
        let audienceIds = Set(audienceDefinitions.map(\.id))

        // Find experiences not associated with any defined audience
        let unassociatedExperiences = experienceDefinitions.filter { exp in
            guard let audienceId = exp.audienceId else { return true }
            return !audienceIds.contains(audienceId)
        }

        // Build change qualification lookup
        var changeQualification: [String: Bool] = [:]
        for change in changes {
            if let audienceId = change.audienceId,
               let qualified = change.qualified {
                changeQualification[audienceId] = qualified
            }
        }

        var result: [PreviewAudience] = []

        for audienceDef in audienceDefinitions {
            let experiences = experienceDefinitions.filter { $0.audienceId == audienceDef.id }
            guard !experiences.isEmpty else { continue }

            let isQualified = qualifiedAudienceIds.contains(audienceDef.id)
            let overrideState = audienceOverrideState(for: audienceDef.id)
            let isActive: Bool
            switch overrideState {
            case .on: isActive = true
            case .off: isActive = false
            case .default: isActive = changeQualification[audienceDef.id] ?? isQualified
            }

            let previewExperiences = experiences.map { exp -> PreviewExperience in
                let currentVariant = sdkVariantIndices[exp.id] ?? 0
                let isOverridden = bridgeVariantOverrides[exp.id] != nil
                let naturalVariant = bridgeDefaultVariantIndices[exp.id]

                return PreviewExperience(
                    id: exp.id,
                    name: exp.name,
                    type: exp.type,
                    distribution: exp.distribution,
                    currentVariantIndex: currentVariant,
                    isOverridden: isOverridden,
                    naturalVariantIndex: naturalVariant
                )
            }

            result.append(PreviewAudience(
                id: audienceDef.id,
                name: audienceDef.name,
                description: audienceDef.description,
                isQualified: isQualified,
                isActive: isActive,
                experiences: previewExperiences,
                overrideState: overrideState
            ))
        }

        // Add "All Visitors" for unassociated experiences
        if !unassociatedExperiences.isEmpty {
            let allVisitorsOverride = audienceOverrideState(for: allVisitorsAudienceId)
            let previewExperiences = unassociatedExperiences.map { exp -> PreviewExperience in
                let currentVariant = sdkVariantIndices[exp.id] ?? 0
                return PreviewExperience(
                    id: exp.id,
                    name: exp.name,
                    type: exp.type,
                    distribution: exp.distribution,
                    currentVariantIndex: currentVariant,
                    isOverridden: bridgeVariantOverrides[exp.id] != nil,
                    naturalVariantIndex: bridgeDefaultVariantIndices[exp.id]
                )
            }

            result.insert(PreviewAudience(
                id: allVisitorsAudienceId,
                name: allVisitorsAudienceName,
                description: allVisitorsAudienceDescription,
                isQualified: true,
                isActive: true,
                experiences: previewExperiences,
                overrideState: allVisitorsOverride
            ), at: 0)
        }

        // Sort: qualified first, then alphabetically
        result.sort { a, b in
            if a.id == allVisitorsAudienceId { return true }
            if b.id == allVisitorsAudienceId { return false }
            if a.isQualified != b.isQualified { return a.isQualified }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }

        audiences = result
    }

    // MARK: - Build Audiences from Changes (fallback without Contentful)

    private func buildAudiencesFromChanges(
        changes: [PreviewChange],
        sdkVariantIndices: [String: Int],
        selectedPersonalizations: [SelectedPersonalization]
    ) {
        var audienceMap: [String: (name: String, qualified: Bool, experiences: [String: Int])] = [:]
        for change in changes {
            guard let audienceId = change.audienceId else { continue }
            let name = change.name ?? audienceId
            let qualified = change.qualified ?? false

            var entry = audienceMap[audienceId] ?? (name: name, qualified: qualified, experiences: [:])
            entry.qualified = qualified
            entry.name = name

            if let expId = change.meta?.experienceId {
                let variant = sdkVariantIndices[expId] ?? (change.meta?.variantIndex ?? 0)
                entry.experiences[expId] = variant
            }
            audienceMap[audienceId] = entry
        }

        // Add experiences from selectedPersonalizations not in any audience
        for p in selectedPersonalizations {
            let found = audienceMap.values.contains { $0.experiences.keys.contains(p.experienceId) }
            if !found {
                var entry = audienceMap[allVisitorsAudienceId] ?? (name: allVisitorsAudienceName, qualified: true, experiences: [:])
                entry.experiences[p.experienceId] = p.variantIndex
                audienceMap[allVisitorsAudienceId] = entry
            }
        }

        audiences = audienceMap.map { audienceId, data in
            let overrideState = audienceOverrideState(for: audienceId)
            let experiences = data.experiences.map { expId, variant in
                let isOverridden = bridgeVariantOverrides[expId] != nil
                let naturalVariant = bridgeDefaultVariantIndices[expId]
                let distribution: [VariantDistribution]
                let maxCount = max(variant + 1, naturalVariant.map { $0 + 1 } ?? 0, 2)
                distribution = (0..<maxCount).map { VariantDistribution(index: $0, variantRef: "", percentage: nil, name: nil) }

                return PreviewExperience(
                    id: expId,
                    name: experienceNameMap[expId] ?? expId,
                    type: .personalization,
                    distribution: distribution,
                    currentVariantIndex: variant,
                    isOverridden: isOverridden,
                    naturalVariantIndex: naturalVariant
                )
            }.sorted { $0.id < $1.id }

            return PreviewAudience(
                id: audienceId,
                name: data.name,
                description: nil,
                isQualified: data.qualified,
                isActive: data.qualified,
                experiences: experiences,
                overrideState: overrideState
            )
        }

        audiences.sort { a, b in
            if a.id == allVisitorsAudienceId { return true }
            if b.id == allVisitorsAudienceId { return false }
            if a.isQualified != b.isQualified { return a.isQualified }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    // MARK: - Filtering

    var filteredAudiences: [PreviewAudience] {
        guard !searchQuery.isEmpty else { return audiences }
        let query = searchQuery.lowercased()
        return audiences.filter { audience in
            audience.name.lowercased().contains(query) ||
            (audience.description?.lowercased().contains(query) ?? false) ||
            audience.experiences.contains { $0.name.lowercased().contains(query) }
        }
    }

    // MARK: - Expand/Collapse

    var allExpanded: Bool {
        !filteredAudiences.isEmpty && filteredAudiences.allSatisfy { expandedAudiences.contains($0.id) }
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

    func toggleExpandAll() {
        withAnimation(.easeInOut(duration: 0.25)) {
            if allExpanded {
                expandedAudiences.removeAll()
            } else {
                expandedAudiences = Set(filteredAudiences.map(\.id))
            }
        }
    }

    // MARK: - Override Actions

    func setAudienceOverride(audienceId: String, state: AudienceOverrideState) {
        let experienceIds = audiences.first(where: { $0.id == audienceId })?.experiences.map(\.id) ?? []

        switch state {
        case .on:
            client.overrideAudience(id: audienceId, qualified: true, experienceIds: experienceIds)
        case .off:
            client.overrideAudience(id: audienceId, qualified: false, experienceIds: experienceIds)
        case .default:
            client.resetAudienceOverride(id: audienceId)
        }

        refreshState()
    }

    func setVariantOverride(experienceId: String, variantIndex: Int) {
        client.overrideVariant(experienceId: experienceId, variantIndex: variantIndex)
        refreshState()
    }

    func resetAudienceOverride(audienceId: String) {
        setAudienceOverride(audienceId: audienceId, state: .default)
    }

    func resetVariantOverride(experienceId: String) {
        client.resetVariantOverride(experienceId: experienceId)
        refreshState()
    }

    func resetAllOverrides() {
        client.resetAllOverrides()
        refreshState()
    }

    // MARK: - Override Summary

    var audienceOverrideCount: Int {
        bridgeAudienceOverrides.count
    }

    var variantOverrideCount: Int {
        bridgeVariantOverrides.count
    }

    var hasOverrides: Bool {
        audienceOverrideCount > 0 || variantOverrideCount > 0
    }

    var activeAudienceOverrides: [(id: String, name: String, state: AudienceOverrideState)] {
        bridgeAudienceOverrides.map { audienceId, qualified in
            let name = audienceNameMap[audienceId]
                ?? audiences.first(where: { $0.id == audienceId })?.name
                ?? audienceId
            let state: AudienceOverrideState = qualified ? .on : .off
            return (id: audienceId, name: name, state: state)
        }.sorted { $0.name < $1.name }
    }

    var activeVariantOverrides: [(experienceId: String, name: String, variantIndex: Int)] {
        bridgeVariantOverrides.map { expId, variant in
            let name = experienceNameMap[expId] ?? expId
            return (experienceId: expId, name: name, variantIndex: variant)
        }.sorted { $0.name < $1.name }
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
            if viewModel == nil {
                let vm = PreviewViewModel(client: client, contentfulClient: contentfulClient)
                viewModel = vm
                vm.refreshState()
                Task { await vm.loadDefinitions() }
            }
        }
        .onReceive(client.$state) { _ in
            viewModel?.refreshState()
        }
    }
}

// MARK: - Main Panel View

struct PreviewPanelMain: View {
    @ObservedObject var viewModel: PreviewViewModel
    @State private var showResetAlert = false

    var body: some View {
        VStack(spacing: 0) {
            panelHeader
                .padding(.horizontal, PreviewTheme.Spacing.lg)
                .padding(.vertical, PreviewTheme.Spacing.md)

            if !viewModel.audiences.isEmpty {
                PreviewSearchBar(text: $viewModel.searchQuery)
                    .padding(.horizontal, PreviewTheme.Spacing.lg)
                    .padding(.bottom, PreviewTheme.Spacing.md)
            }

            ScrollView {
                VStack(spacing: PreviewTheme.Spacing.lg) {
                    // Loading indicator for definitions
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
                    overridesSection
                }
                .padding(.horizontal, PreviewTheme.Spacing.lg)
                .padding(.bottom, PreviewTheme.Spacing.lg)
            }

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
        guard let consent = viewModel.consent else { return "—" }
        return consent ? "Yes" : "No"
    }

    // MARK: - Audience Section

    private var audienceSection: some View {
        SectionCard(title: "Audiences & Experiences (\(viewModel.filteredAudiences.count))") {
            if viewModel.filteredAudiences.count > 1 {
                HStack {
                    Spacer()
                    CollapseToggleButton(
                        allExpanded: viewModel.allExpanded,
                        onToggle: { viewModel.toggleExpandAll() }
                    )
                }
            }

            if viewModel.filteredAudiences.isEmpty {
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
                    ForEach(viewModel.filteredAudiences) { audience in
                        AudienceItem(
                            audience: audience,
                            isExpanded: viewModel.expandedAudiences.contains(audience.id),
                            onToggleExpand: { viewModel.toggleExpand(audience.id) },
                            onToggleOverride: { state in
                                viewModel.setAudienceOverride(audienceId: audience.id, state: state)
                            },
                            onSelectVariant: { expId, variant in
                                viewModel.setVariantOverride(experienceId: expId, variantIndex: variant)
                            },
                            onCopyId: {
                                #if canImport(UIKit)
                                viewModel.copyToClipboard(audience.id, label: "Audience ID")
                                #endif
                            }
                        )
                    }
                }
            }
        }
        .accessibilityIdentifier("preview-panel-list")
    }

    // MARK: - Profile Section

    private var profileSection: some View {
        SectionCard(title: "Profile", collapsible: true, initiallyCollapsed: true) {
            if let profile = viewModel.profile {
                VStack(alignment: .leading, spacing: PreviewTheme.Spacing.md) {
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
            }
        }
    }

    // MARK: - Overrides Section

    private var overridesSection: some View {
        SectionCard(title: "Overrides", collapsible: true) {
            if viewModel.hasOverrides {
                VStack(alignment: .leading, spacing: PreviewTheme.Spacing.md) {
                    Text("\(viewModel.audienceOverrideCount) audience override\(viewModel.audienceOverrideCount == 1 ? "" : "s"), \(viewModel.variantOverrideCount) optimization override\(viewModel.variantOverrideCount == 1 ? "" : "s")")
                        .font(.system(size: PreviewTheme.FontSize.xs))
                        .foregroundColor(PreviewTheme.Colors.TextColor.secondary)

                    if !viewModel.activeAudienceOverrides.isEmpty {
                        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                            Text("Audience Overrides")
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)

                            ForEach(viewModel.activeAudienceOverrides, id: \.id) { override_ in
                                ListItemRow(
                                    label: override_.name,
                                    value: override_.state == .on ? "Activated" : "Deactivated",
                                    action: (
                                        label: "Reset",
                                        variant: .reset,
                                        handler: { viewModel.resetAudienceOverride(audienceId: override_.id) }
                                    )
                                )
                            }
                        }
                    }

                    if !viewModel.activeVariantOverrides.isEmpty {
                        VStack(alignment: .leading, spacing: PreviewTheme.Spacing.xs) {
                            Text("Optimization Overrides")
                                .font(.system(size: PreviewTheme.FontSize.sm, weight: .semibold))
                                .foregroundColor(PreviewTheme.Colors.TextColor.primary)

                            ForEach(viewModel.activeVariantOverrides, id: \.experienceId) { override_ in
                                ListItemRow(
                                    label: override_.name,
                                    value: override_.variantIndex == 0 ? "Baseline" : "Variant \(override_.variantIndex)",
                                    action: (
                                        label: "Reset",
                                        variant: .reset,
                                        handler: { viewModel.resetVariantOverride(experienceId: override_.experienceId) }
                                    )
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
            .opacity(viewModel.hasOverrides ? 1.0 : PreviewTheme.Opacity.disabled)
            .disabled(!viewModel.hasOverrides)
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
