package com.contentful.optimization.preview

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object PreviewTheme {

    object Colors {
        object Background {
            val primary = Color.White
            val secondary = Color(0xFFF9FAFB)
            val tertiary = Color(0xFFF3F4F6)
            val quaternary = Color(0xFFE5E7EB)
        }

        object TextColor {
            val primary = Color(0xFF111827)
            val secondary = Color(0xFF4B5563)
            val muted = Color(0xFF9CA3AF)
            val inverse = Color.White
        }

        object CP {
            val normal = Color(0xFF8C2EEA)
            val hover = Color(0xFF7E29D3)
            val active = Color(0xFF7025BB)
        }

        object Action {
            val activate = Color(0xFF22C55E)
            val deactivate = Color(0xFFEF4444)
            val reset = Color(0xFFF59E0B)
            val destructive = Color(0xFFEF4444)
        }

        object Badge {
            val api = Color(0xFF3B82F6)
            val override_ = Color(0xFFF59E0B)
            val manual = Color(0xFF22C55E)
            val info = Color(0xFF6B7280)
            val experiment = Color(0xFF8B5CF6)
            val personalization = Color(0xFF06B6D4)
        }

        object Border {
            val primary = Color(0xFFE5E7EB)
            val secondary = Color(0xFFD1D5DB)
            val focus = CP.normal
        }

        object Status {
            val qualified = Color(0xFF22C55E)
            val active = CP.normal
            val inactive = Color(0xFF9CA3AF)
        }

        object FAB {
            val background = Color(0xFFEADDFF)
            val icon = CP.normal
        }
    }

    object Spacing {
        val xs = 4.dp
        val sm = 8.dp
        val md = 12.dp
        val lg = 16.dp
        val xl = 20.dp
        val xxl = 24.dp
        val xxxl = 32.dp
    }

    object Radius {
        val sm = 4.dp
        val md = 6.dp
        val lg = 8.dp
        val xl = 12.dp
    }

    object FontSize {
        val xs = 12.sp
        val sm = 14.sp
        val md = 16.sp
        val lg = 18.sp
        val xl = 20.sp
        val xxl = 24.sp
    }

    object FABSize {
        val diameter = 56.dp
    }

    object Opacity {
        const val active = 0.7f
        const val disabled = 0.5f
        const val muted = 0.6f
    }
}
