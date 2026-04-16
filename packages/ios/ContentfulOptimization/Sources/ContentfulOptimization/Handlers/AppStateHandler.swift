#if canImport(UIKit)
import UIKit
import Combine

/// Listens for app lifecycle notifications and triggers SDK actions.
///
/// Flushes the analytics queue when the app backgrounds and provides
/// callbacks for viewport tracking pause/resume.
@MainActor
final class AppStateHandler {
    private var cancellables = Set<AnyCancellable>()
    private weak var client: OptimizationClient?

    var onWillResignActive: (() -> Void)?
    var onDidBecomeActive: (() -> Void)?

    init(client: OptimizationClient) {
        self.client = client

        NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.handleWillResignActive()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.handleDidBecomeActive()
            }
            .store(in: &cancellables)
    }

    private func handleWillResignActive() {
        Task { @MainActor in
            try? await client?.flush()
        }
        onWillResignActive?()
    }

    private func handleDidBecomeActive() {
        onDidBecomeActive?()
    }

    func stop() {
        cancellables.removeAll()
    }
}
#endif
