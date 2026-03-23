import Foundation
import Darwin

/// Reports the physical memory footprint of the current process using `task_info`.
/// Uses `phys_footprint` — the same metric Xcode's memory gauge shows.
enum MemoryReporter {

    /// Returns the current physical memory footprint in bytes, or `nil` if the call fails.
    static func physicalFootprint() -> UInt64? {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let result = withUnsafeMutablePointer(to: &info) { infoPtr in
            infoPtr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { ptr in
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), ptr, &count)
            }
        }
        guard result == KERN_SUCCESS else { return nil }
        return info.phys_footprint
    }

    /// Returns the physical footprint formatted as a human-readable string.
    static func formattedFootprint() -> String {
        guard let bytes = physicalFootprint() else { return "N/A" }
        let mb = Double(bytes) / (1024 * 1024)
        return String(format: "%.2f MB", mb)
    }
}
