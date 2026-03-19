import SwiftUI

struct ContentView: View {
    @StateObject private var bridge = JSContextManager()
    @State private var userId = "user-123"
    @State private var resultText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                // Action buttons
                VStack(spacing: 12) {
                    Button("Initialize SDK") {
                        bridge.initialize()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(bridge.isInitialized)

                    HStack {
                        TextField("User ID", text: $userId)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)

                        Button("Identify") {
                            bridge.identify(userId: userId) { result in
                                switch result {
                                case .success(let json):
                                    resultText = formatJSON(json)
                                case .failure(let error):
                                    resultText = "Error: \(error.localizedDescription)"
                                }
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(!bridge.isInitialized)
                    }

                    HStack(spacing: 12) {
                        Button("Page") {
                            bridge.page { result in
                                switch result {
                                case .success(let json):
                                    resultText = formatJSON(json)
                                case .failure(let error):
                                    resultText = "Error: \(error.localizedDescription)"
                                }
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(!bridge.isInitialized)

                        Button("Get Profile") {
                            resultText = formatJSON(bridge.getProfile())
                        }
                        .buttonStyle(.bordered)
                        .disabled(!bridge.isInitialized)

                        Button("Destroy") {
                            bridge.destroy()
                            resultText = ""
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                        .disabled(!bridge.isInitialized)
                    }
                }
                .padding(.horizontal)

                // Reactive state
                if bridge.isInitialized {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Reactive State")
                            .font(.headline)
                        HStack(spacing: 16) {
                            Label(
                                bridge.state.consent == true ? "Granted" : (bridge.state.consent == false ? "Denied" : "Unset"),
                                systemImage: bridge.state.consent == true ? "checkmark.shield" : "xmark.shield"
                            )
                            .foregroundColor(bridge.state.consent == true ? .green : .secondary)

                            Label(
                                bridge.state.canPersonalize ? "Yes" : "No",
                                systemImage: bridge.state.canPersonalize ? "person.fill.checkmark" : "person.fill.xmark"
                            )
                            .foregroundColor(bridge.state.canPersonalize ? .green : .secondary)

                            Label(
                                bridge.state.profile != nil ? "Present" : "None",
                                systemImage: bridge.state.profile != nil ? "person.crop.circle.fill" : "person.crop.circle"
                            )
                            .foregroundColor(bridge.state.profile != nil ? .blue : .secondary)
                        }
                        .font(.caption)
                    }
                    .padding(.horizontal)
                }

                // Result area
                if !resultText.isEmpty {
                    VStack(alignment: .leading) {
                        Text("Result")
                            .font(.headline)
                        ScrollView {
                            Text(resultText)
                                .font(.system(.caption, design: .monospaced))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .frame(maxHeight: 200)
                        .padding(8)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    }
                    .padding(.horizontal)
                }

                // Console log area
                VStack(alignment: .leading) {
                    HStack {
                        Text("Console")
                            .font(.headline)
                        Spacer()
                        Button("Clear") {
                            bridge.logs.removeAll()
                        }
                        .font(.caption)
                    }
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 2) {
                                ForEach(Array(bridge.logs.enumerated()), id: \.offset) { index, log in
                                    Text(log)
                                        .font(.system(.caption2, design: .monospaced))
                                        .foregroundColor(logColor(for: log))
                                        .id(index)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .onChange(of: bridge.logs.count) { _ in
                            if let last = bridge.logs.indices.last {
                                proxy.scrollTo(last, anchor: .bottom)
                            }
                        }
                    }
                    .frame(maxHeight: .infinity)
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
            .navigationTitle("Optimization PoC")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func logColor(for log: String) -> Color {
        if log.contains("ERROR") || log.contains("error") || log.contains("Exception") {
            return .red
        } else if log.contains("warn") {
            return .orange
        } else if log.contains("succeeded") {
            return .green
        }
        return .primary
    }

    private func formatJSON(_ jsonString: String) -> String {
        guard let data = jsonString.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let pretty = try? JSONSerialization.data(withJSONObject: obj, options: .prettyPrinted),
              let result = String(data: pretty, encoding: .utf8)
        else {
            return jsonString
        }
        return result
    }
}

#Preview {
    ContentView()
}
