plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.contentful.optimization.shared"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

dependencies {
    // Pulls in the OptimizationClient core API used by RichText.resolveText() and the
    // preview-contentful interfaces consumed by MockPreviewContentfulClient.
    api(project(":ContentfulOptimization"))

    // Aligned with the Optimization SDK's own okhttp declaration (okhttp-android 5.x). Declaring
    // the 4.x jar and 5.x aar together triggers duplicate-class packaging.
    implementation("com.squareup.okhttp3:okhttp-android:5.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Entries are fetched with Contentful's official Java/Android SDK — the same integration path
    // recommended to customers, and the version ContentfulOptimization already resolves as
    // compileOnly for its CDAEntry adapter (CTEntry.from(CDAEntry)). `api` (not `implementation`)
    // because ContentfulFetcher's public surface returns `List<CDAEntry>`, and the Compose/Views
    // shells consuming it (via `implementation(project(":shared"))`) construct and type against
    // CDAEntry directly at their fetch call sites. okhttp-jvm is excluded to avoid a
    // duplicate-class conflict with the okhttp-android variant declared above.
    api("com.contentful.java:java-sdk:10.6.0") {
        exclude(group = "com.squareup.okhttp3", module = "okhttp-jvm")
    }
}
