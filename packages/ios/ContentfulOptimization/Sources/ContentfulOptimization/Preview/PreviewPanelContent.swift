import Combine
import SwiftUI

/// The content displayed in the preview panel sheet.
///
/// Shows current profile, audiences, experiences, and debug controls.
public struct PreviewPanelContent: View {
    @EnvironmentObject private var client: OptimizationClient
    @State private var previewState: [String: Any]?

    public init() {}

    public var body: some View {
        NavigationView {
            List {
                profileSection
                audiencesSection
                personalizationsSection
                debugSection
            }
            .accessibilityIdentifier("preview-panel-list")
            .navigationTitle("Preview Panel")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .onAppear { refreshState() }
            .onReceive(client.$state) { _ in refreshState() }
        }
    }

    // MARK: - Sections

    private var profileSection: some View {
        Section("Profile") {
            if let profile = previewState?["profile"] as? [String: Any] {
                ForEach(Array(profile.keys.sorted()), id: \.self) { key in
                    HStack {
                        Text(key).font(.caption).foregroundColor(.secondary)
                        Spacer()
                        Text(stringValue(profile[key]))
                            .font(.caption)
                            .lineLimit(2)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("profile-item-\(key)")
                }
            } else {
                Text("No profile data")
                    .foregroundColor(.secondary)
                    .accessibilityIdentifier("no-profile-data")
            }
        }
    }

    private var audiencesSection: some View {
        Section("Audiences") {
            if let changes = previewState?["changes"] as? [[String: Any]] {
                ForEach(Array(changes.enumerated()), id: \.offset) { _, change in
                    if let audienceId = change["audienceId"] as? String {
                        let name = change["name"] as? String ?? audienceId
                        let qualified = change["qualified"] as? Bool ?? false
                        Toggle(name, isOn: Binding(
                            get: { qualified },
                            set: { newValue in
                                client.overrideAudience(id: audienceId, qualified: newValue)
                                refreshState()
                            }
                        ))
                        .accessibilityIdentifier("audience-toggle-\(audienceId)")
                    }
                }
            } else {
                Text("No audience data").foregroundColor(.secondary)
            }
        }
    }

    private var personalizationsSection: some View {
        Section("Personalizations") {
            if let personalizations = previewState?["selectedPersonalizations"] as? [[String: Any]] {
                ForEach(Array(personalizations.enumerated()), id: \.offset) { _, p in
                    if let experienceId = p["experienceId"] as? String {
                        let variantIndex = p["variantIndex"] as? Int ?? 0
                        HStack {
                            Text(experienceId).font(.caption).lineLimit(1)
                            Spacer()
                            Stepper("Variant \(variantIndex)", value: Binding(
                                get: { variantIndex },
                                set: { newValue in
                                    client.overrideVariant(experienceId: experienceId, variantIndex: newValue)
                                    refreshState()
                                }
                            ), in: 0...10)
                            .accessibilityIdentifier("variant-stepper-\(experienceId)")
                        }
                    }
                }
            } else {
                Text("No personalization data").foregroundColor(.secondary)
            }
        }
    }

    private var debugSection: some View {
        Section("Debug") {
            HStack {
                Text("Can Personalize")
                Spacer()
                Text(previewState?["canPersonalize"] as? Bool == true ? "Yes" : "No")
                    .foregroundColor(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("debug-can-personalize")
            HStack {
                Text("Consent")
                Spacer()
                Text(previewState?["consent"] as? Bool == true ? "Accepted" : "Pending")
                    .foregroundColor(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("debug-consent")
            Button("Refresh") { refreshState() }
                .accessibilityIdentifier("preview-refresh-button")
        }
    }

    // MARK: - Helpers

    private func refreshState() {
        previewState = client.getPreviewState()
    }

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
