import Combine
import Foundation

/// Manages variant locking for a single entry in UIKit.
///
/// By default, `OptimizedEntry` (SwiftUI) freezes to the first resolved variant
/// to prevent UI flashing during personalization updates. `VariantLock` provides
/// the same behavior for UIKit.
///
/// Usage:
/// ```swift
/// let lock = VariantLock(client: client)
///
/// // In your data binding / cell configuration:
/// let result = lock.personalizeEntry(baseline: entry)
/// titleLabel.text = result.entry["title"] as? String
///
/// // Reset when the entry is recycled (e.g., prepareForReuse):
/// lock.reset()
/// ```
@MainActor
public final class VariantLock {
    private weak var client: OptimizationClient?
    private var lockedPersonalizations: [[String: Any]]?
    private var isLocked = false
    private var cancellable: AnyCancellable?

    public init(client: OptimizationClient) {
        self.client = client
        cancellable = client.$selectedPersonalizations.sink { [weak self] newValue in
            guard let self, !self.isLocked, newValue != nil else { return }
            self.lockedPersonalizations = newValue
            self.isLocked = true
        }
    }

    /// Resolve the personalized variant for an entry, using the locked variant if available.
    public func personalizeEntry(baseline: [String: Any]) -> PersonalizedResult {
        guard let client else {
            return PersonalizedResult(entry: baseline, personalization: nil)
        }
        return client.personalizeEntry(
            baseline: baseline,
            personalizations: lockedPersonalizations
        )
    }

    /// Reset the lock so the next personalization picks up the latest variant.
    /// Call this when reusing a cell or rebinding to a different entry.
    public func reset() {
        lockedPersonalizations = nil
        isLocked = false
    }
}
