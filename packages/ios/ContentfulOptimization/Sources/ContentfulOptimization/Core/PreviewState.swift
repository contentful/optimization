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

    /// Pre-baked UI model assembled by the JS core SDK. Non-nil once the host has
    /// loaded Contentful definitions via ``OptimizationClient/loadDefinitions(audiences:experiences:)``.
    /// Native layers render from this directly rather than recomputing audience/experience shape.
    public let previewModel: PreviewModelDTO?
}

/// DTO for a single audience definition as shaped by core's `createAudienceDefinitions`.
public struct AudienceDefinitionDTO: Codable, Sendable {
    public let id: String
    public let name: String
    public let description: String?
}

/// DTO for a variant within an experience's distribution.
public struct VariantDistributionDTO: Codable, Sendable {
    public let index: Int
    public let variantRef: String
    public let percentage: Int?
    public let name: String?
}

/// DTO for an experience definition, enriched by core's `buildPreviewModel`
/// with the current selection state needed to render variant chips and
/// override indicators without Swift-side derivation.
public struct ExperienceDefinitionDTO: Codable, Sendable {
    public let id: String
    public let name: String
    /// Raw string from JS: `"nt_personalization"` or `"nt_experiment"`.
    public let type: String
    public let distribution: [VariantDistributionDTO]
    public let audience: AudienceRef?

    /// Current variant selected by the SDK (with any active overrides applied).
    public let currentVariantIndex: Int
    /// True when an active variant override exists for this experience.
    public let isOverridden: Bool
    /// Pre-override natural variant index; present only when `isOverridden` is true.
    public let naturalVariantIndex: Int?

    public struct AudienceRef: Codable, Sendable {
        public let id: String
    }
}

/// DTO for an audience combined with its experiences and computed override state.
public struct AudienceWithExperiencesDTO: Codable, Sendable {
    public let audience: AudienceDefinitionDTO
    public let experiences: [ExperienceDefinitionDTO]
    public let isQualified: Bool
    public let isActive: Bool
    /// Raw string from JS: `"on"`, `"off"`, or `"default"`.
    public let overrideState: String
}

/// DTO for the pre-baked preview UI model.
public struct PreviewModelDTO: Codable, Sendable {
    public let audiencesWithExperiences: [AudienceWithExperiencesDTO]
    public let unassociatedExperiences: [ExperienceDefinitionDTO]
    public let hasData: Bool
    public let sdkVariantIndices: [String: Int]
    public let audienceNameMap: [String: String]
    public let experienceNameMap: [String: String]
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
