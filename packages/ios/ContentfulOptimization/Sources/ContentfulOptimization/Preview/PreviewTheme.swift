import SwiftUI

/// Design tokens matching the React Native preview panel theme.
enum PreviewTheme {

    // MARK: - Colors

    enum Colors {
        enum Background {
            static let primary = Color.white
            static let secondary = Color(pt_hex: 0xF9FAFB)
            static let tertiary = Color(pt_hex: 0xF3F4F6)
            static let quaternary = Color(pt_hex: 0xE5E7EB)
        }

        enum TextColor {
            static let primary = Color(pt_hex: 0x111827)
            static let secondary = Color(pt_hex: 0x4B5563)
            static let muted = Color(pt_hex: 0x9CA3AF)
            static let inverse = Color.white
        }

        enum CP {
            static let normal = Color(pt_hex: 0x8C2EEA)
            static let hover = Color(pt_hex: 0x7E29D3)
            static let active = Color(pt_hex: 0x7025BB)
        }

        enum Action {
            static let activate = Color(pt_hex: 0x22C55E)
            static let deactivate = Color(pt_hex: 0xEF4444)
            static let reset = Color(pt_hex: 0xF59E0B)
            static let destructive = Color(pt_hex: 0xEF4444)
        }

        enum Badge {
            static let api = Color(pt_hex: 0x3B82F6)
            static let override_ = Color(pt_hex: 0xF59E0B)
            static let manual = Color(pt_hex: 0x22C55E)
            static let info = Color(pt_hex: 0x6B7280)
            static let experiment = Color(pt_hex: 0x8B5CF6)
            static let personalization = Color(pt_hex: 0x06B6D4)
        }

        enum Border {
            static let primary = Color(pt_hex: 0xE5E7EB)
            static let secondary = Color(pt_hex: 0xD1D5DB)
            static let focus = CP.normal
        }

        enum Status {
            static let qualified = Color(pt_hex: 0x22C55E)
            static let active = CP.normal
            static let inactive = Color(pt_hex: 0x9CA3AF)
        }

        enum FAB {
            static let background = Color(pt_hex: 0xEADDFF)
            static let icon = CP.normal
        }
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    // MARK: - Border Radius

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 6
        static let lg: CGFloat = 8
        static let xl: CGFloat = 12
    }

    // MARK: - Typography

    enum FontSize {
        static let xs: CGFloat = 12
        static let sm: CGFloat = 14
        static let md: CGFloat = 16
        static let lg: CGFloat = 18
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
    }

    // MARK: - FAB

    enum FABSize {
        static let diameter: CGFloat = 56
    }

    // MARK: - Opacity

    enum Opacity {
        static let active: Double = 0.7
        static let disabled: Double = 0.5
        static let muted: Double = 0.6
    }
}

// MARK: - Color Hex Extension

extension Color {
    init(pt_hex hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

#if canImport(UIKit)
extension UIColor {
    convenience init(pt_hex hex: UInt, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
#endif
