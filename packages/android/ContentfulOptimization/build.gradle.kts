plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.contentful.optimization"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        targetSdk = 35
        consumerProguardFiles("consumer-proguard-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }


    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests {
            // ViewTrackingController tests are pure JVM (TestScope + TestLifecycleOwner +
            // fake collaborators) and don't touch Android resources, so skip the Robolectric-style
            // resource bundling that AGP would otherwise add to the unit-test classpath. Keeps
            // `./gradlew :ContentfulOptimization:testDebugUnitTest` under a second.
            isIncludeAndroidResources = false
            // ViewTrackingController emits diagnostic `Log.d/Log.i/Log.w` calls under the
            // "ViewTracking" tag. Without `isReturnDefaultValues = true` the JVM test runtime
            // throws `RuntimeException: Method d in android.util.Log not mocked` on the first
            // call; with it, the Android framework stubs return defaults (0/null/false) so the
            // logging is a no-op in unit tests while still firing normally in production.
            isReturnDefaultValues = true
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

dependencies {
    implementation("io.github.dokar3:quickjs-kt:1.0.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("androidx.lifecycle:lifecycle-runtime-testing:2.8.7")
}
