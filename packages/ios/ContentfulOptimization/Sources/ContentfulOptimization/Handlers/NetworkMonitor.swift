import Network

/// Monitors network connectivity and updates the SDK's online state.
///
/// Uses `NWPathMonitor` to detect connectivity changes. When the network
/// reconnects after being offline, queued analytics events are flushed.
@MainActor
final class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.contentful.optimization.network")
    private weak var client: OptimizationClient?
    private var wasConnected: Bool = true

    init(client: OptimizationClient) {
        self.client = client

        monitor.pathUpdateHandler = { [weak self] path in
            let isConnected = path.status == .satisfied
            DispatchQueue.main.async {
                self?.handleConnectivityChange(isConnected: isConnected)
            }
        }
        monitor.start(queue: queue)
    }

    private func handleConnectivityChange(isConnected: Bool) {
        client?.setOnline(isConnected)

        if isConnected && !wasConnected {
            Task { @MainActor in
                try? await client?.flush()
            }
        }
        wasConnected = isConnected
    }

    func stop() {
        monitor.cancel()
    }
}
