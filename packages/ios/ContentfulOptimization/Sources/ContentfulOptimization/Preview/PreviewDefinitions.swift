import Foundation

// MARK: - Constants

let allVisitorsAudienceId = "ALL_VISITORS"
let allVisitorsAudienceName = "All Visitors"
let allVisitorsAudienceDescription = "Experiences that apply to all visitors regardless of audience membership"

// MARK: - Definition Types (from Contentful entries)

enum ExperienceType: String {
    case personalization = "nt_personalization"
    case experiment = "nt_experiment"
}

struct AudienceDefinition {
    let id: String
    let name: String
    let description: String?
}

struct VariantDistribution {
    let index: Int
    let variantRef: String
    let percentage: Int?
    let name: String?
}

struct ExperienceDefinition: Identifiable {
    let id: String
    let name: String
    let type: ExperienceType
    let distribution: [VariantDistribution]
    let audienceId: String?
}

// MARK: - Display Models (combined definitions + SDK state)

struct PreviewAudience: Identifiable {
    let id: String
    let name: String
    let description: String?
    var isQualified: Bool
    var isActive: Bool
    var experiences: [PreviewExperience]
    var overrideState: AudienceOverrideState
}

struct PreviewExperience: Identifiable {
    let id: String
    let name: String
    let type: ExperienceType
    var distribution: [VariantDistribution]
    var currentVariantIndex: Int
    var isOverridden: Bool
    var naturalVariantIndex: Int?
}

// MARK: - Entry Mappers

/// Creates audience definitions from Contentful `nt_audience` entries.
/// Matches RN `createAudienceDefinitions` in entryMappers.ts.
func createAudienceDefinitions(from entries: [[String: Any]]) -> [AudienceDefinition] {
    entries.compactMap { entry in
        let fields = entry["fields"] as? [String: Any] ?? [:]
        let sysId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""

        let id = fields["nt_audience_id"] as? String ?? sysId
        let name = fields["nt_name"] as? String ?? id
        let description = fields["nt_description"] as? String

        return AudienceDefinition(id: id, name: name, description: description)
    }
}

/// Creates experience definitions from Contentful `nt_experience` entries.
/// Matches RN `createExperienceDefinitions` in entryMappers.ts.
func createExperienceDefinitions(from entries: [[String: Any]], includedEntries: [[String: Any]]) -> [ExperienceDefinition] {
    // Build variant entry map for name resolution
    let variantEntryMap = buildVariantEntryMap(from: includedEntries)

    return entries.compactMap { entry in
        let fields = entry["fields"] as? [String: Any] ?? [:]
        let sysId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""

        let id = fields["nt_experience_id"] as? String ?? sysId
        let name = fields["nt_name"] as? String ?? sysId
        let typeStr = fields["nt_type"] as? String ?? "nt_personalization"
        let type = ExperienceType(rawValue: typeStr) ?? .personalization

        // Extract audience link
        let audienceLink = fields["nt_audience"] as? [String: Any]
        let audienceSys = audienceLink?["sys"] as? [String: Any]
        let audienceId = audienceSys?["id"] as? String

        // Extract distribution from config
        let config = fields["nt_config"] as? [String: Any]
        let distribution = extractDistribution(from: config, variantEntryMap: variantEntryMap)

        return ExperienceDefinition(
            id: id,
            name: name,
            type: type,
            distribution: distribution,
            audienceId: audienceId
        )
    }
}

/// Creates a name lookup map from experience entries: experienceId → name.
func createExperienceNameMap(from entries: [[String: Any]]) -> [String: String] {
    var map: [String: String] = [:]
    for entry in entries {
        let fields = entry["fields"] as? [String: Any] ?? [:]
        let sysId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""
        let id = fields["nt_experience_id"] as? String ?? sysId
        let name = fields["nt_name"] as? String ?? sysId
        map[id] = name
    }
    return map
}

/// Creates a name lookup map from audience entries: audienceId → name.
func createAudienceNameMap(from definitions: [AudienceDefinition]) -> [String: String] {
    var map: [String: String] = [:]
    for def in definitions {
        map[def.id] = def.name
    }
    return map
}

// MARK: - Distribution Extraction

/// Extracts variant distribution from an experience config.
/// Matches RN `extractDistributionFromConfig` in entryMappers.ts.
private func extractDistribution(from config: [String: Any]?, variantEntryMap: [String: [String: Any]]) -> [VariantDistribution] {
    guard let config = config else { return [] }

    let percentages = config["distribution"] as? [Any] ?? []
    let components = config["components"] as? [[String: Any]] ?? []
    guard let firstComponent = components.first else { return [] }

    var variants: [VariantDistribution] = []

    // Baseline (index 0)
    if let baseline = firstComponent["baseline"] as? [String: Any],
       let baselineId = baseline["id"] as? String {
        let percentage = percentages.first.flatMap { asInt($0) }
        let name = resolveVariantName(variantRef: baselineId, variantEntryMap: variantEntryMap)
        variants.append(VariantDistribution(index: 0, variantRef: baselineId, percentage: percentage, name: name))
    }

    // Variants (index 1+)
    let variantRefs = firstComponent["variants"] as? [[String: Any]] ?? []
    for (i, variantRef) in variantRefs.enumerated() {
        guard let variantId = variantRef["id"] as? String else { continue }
        let hidden = variantRef["hidden"] as? Bool ?? false
        if hidden { continue }

        let percentageIndex = i + 1
        let rawPercentage = percentageIndex < percentages.count ? percentages[percentageIndex] : nil
        let percentage = rawPercentage.flatMap { asPercentage($0) }
        let name = resolveVariantName(variantRef: variantId, variantEntryMap: variantEntryMap)

        variants.append(VariantDistribution(
            index: i + 1,
            variantRef: variantId,
            percentage: percentage,
            name: name
        ))
    }

    return variants
}

// MARK: - Variant Name Resolution

/// Builds a map from entry sys.id to the full entry object for name resolution.
private func buildVariantEntryMap(from includedEntries: [[String: Any]]) -> [String: [String: Any]] {
    var map: [String: [String: Any]] = [:]
    for entry in includedEntries {
        if let sys = entry["sys"] as? [String: Any],
           let id = sys["id"] as? String {
            map[id] = entry
        }
    }
    return map
}

/// Resolves a variant name from an included entry.
/// Checks fields: internalTitle → title → name (matching RN `getVariantName`).
private func resolveVariantName(variantRef: String, variantEntryMap: [String: [String: Any]]) -> String? {
    guard let entry = variantEntryMap[variantRef],
          let fields = entry["fields"] as? [String: Any]
    else { return nil }

    if let name = fields["internalTitle"] as? String, !name.isEmpty { return name }
    if let name = fields["title"] as? String, !name.isEmpty { return name }
    if let name = fields["name"] as? String, !name.isEmpty { return name }
    return nil
}

// MARK: - Helpers

private func asInt(_ value: Any) -> Int? {
    if let n = value as? Int { return n }
    if let n = value as? Double { return Int(round(n * 100)) }
    if let n = value as? NSNumber { return Int(round(n.doubleValue * 100)) }
    return nil
}

private func asPercentage(_ value: Any) -> Int? {
    if let n = value as? Double { return Int(round(n * 100)) }
    if let n = value as? NSNumber { return Int(round(n.doubleValue * 100)) }
    if let n = value as? Int { return n }
    return nil
}
