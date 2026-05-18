-keep class com.contentful.optimization.core.** { *; }
-keep class com.contentful.optimization.compose.** { *; }
-keep class com.contentful.optimization.preview.** { *; }
-keep class com.contentful.optimization.bridge.Native { *; }
-keep class com.contentful.optimization.bridge.NativeImpl { *; }
# Zipline ships its own consumer ProGuard rules; this line is defensive.
-keep class app.cash.zipline.** { *; }
