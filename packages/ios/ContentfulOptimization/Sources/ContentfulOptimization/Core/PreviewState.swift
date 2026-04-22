import Foundation

/// Typed snapshot of the preview/debug state from the JS bridge.
///
/// Decoded from the JSON string returned by the bridge's `getPreviewState()` method.
/// The shape mirrors the object built in `ios-jsc-bridge/src/index.ts`.
public struct PreviewState: Codable, Sendable {
    public let profile: JSONValue?
    public let consent: Bool?
    public let canPersonalize: Bool
    public let changes: [PreviewChange]?
    public let selectedPersonalizations: [SelectedPersonalization]?
    public let previewPanelOpen: Bool

    /// Active audience overrides set via the preview panel (audienceId → qualified).
    public let audienceOverrides: [String: Bool]?
    /// Active variant overrides set via the preview panel (experienceId → variantIndex).
    public let variantOverrides: [String: Int]?
    /// Natural audience qualification values captured before any overrides were applied.
    public let defaultAudienceQualifications: [String: Bool]?
    /// Natural variant indices captured before any overrides were applied.
    public let defaultVariantIndices: [String: Int]?
}

/// A selected optimization/personalization variant from the bridge.
///
/// Mirrors the `SelectedOptimization` Zod schema from `api-schemas`.
public struct SelectedPersonalization: Codable, Equatable, Sendable {
    public let experienceId: String
    public let variantIndex: Int
    public let variants: [String: String]?
    public let sticky: Bool?
}

/// A change entry from the bridge, covering both standard variable changes
/// and audience override entries.
///
/// All fields are optional because the runtime shape varies:
/// standard changes have `key`, `type`, `meta`, and `value`;
/// audience overrides have `audienceId`, `qualified`, and `name`.
public struct PreviewChange: Codable, Sendable {
    public let audienceId: String?
    public let qualified: Bool?
    public let name: String?
    public let key: String?
    public let type: String?
    public let meta: PreviewChangeMeta?
}

/// Metadata on a change entry identifying the originating experience and variant.
public struct PreviewChangeMeta: Codable, Sendable {
    public let experienceId: String
    public let variantIndex: Int
}
