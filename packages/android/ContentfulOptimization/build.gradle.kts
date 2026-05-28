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
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

// Rebuild the shared JS bridge before this SDK module compiles, so that editing
// TypeScript under packages/universal/optimization-js-bridge/src/ and clicking
// Build in Android Studio refreshes src/main/assets/optimization-android-bridge.umd.js
// transparently. The inputs/outputs declarations make the task UP-TO-DATE when the
// asset is already newer than the bridge source, so a no-op rebuild does not respawn pnpm.
val repoRoot = projectDir.resolve("../../..")
val buildJsBridge = tasks.register<Exec>("buildJsBridge") {
    workingDir = repoRoot
    commandLine("pnpm", "--filter", "@contentful/optimization-js-bridge", "build")
    inputs.dir(repoRoot.resolve("packages/universal/optimization-js-bridge/src"))
        .withPropertyName("bridgeSource")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    outputs.file(layout.projectDirectory.file("src/main/assets/optimization-android-bridge.umd.js"))
        .withPropertyName("bridgeBundle")
}
tasks.named("preBuild").configure { dependsOn(buildJsBridge) }

dependencies {
    implementation("io.github.dokar3:quickjs-kt:1.0.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
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
}
