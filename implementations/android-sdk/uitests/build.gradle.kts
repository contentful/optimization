plugins {
    id("com.android.test")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.contentful.optimization.uitests"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Run this UI Automator suite in its own instrumentation process rather
        // than inside the app process. The tests force-stop and relaunch the app
        // (AppLauncher.relaunchClean / clearProfileState); without self-
        // instrumenting, `am force-stop` would SIGKILL the test runner itself.
        experimentalProperties["android.experimental.self-instrumenting"] = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    // The compose reference impl is the default target. Step 5 reads APP_PACKAGE from the
    // instrumentation arguments to switch targets at runtime, but Gradle still needs a single
    // compile-time link. Keeping the link pointed at the Compose app preserves the existing
    // CI surface; the matrix CI leg installs the views APK separately before running.
    targetProjectPath = ":compose"
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

dependencies {
    implementation("androidx.test.uiautomator:uiautomator:2.3.0")
    implementation("androidx.test:runner:1.6.2")
    implementation("androidx.test:rules:1.5.0")
    implementation("androidx.test:core:1.6.1")
    implementation("androidx.test.ext:junit:1.1.5")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime:2.8.7")
}
