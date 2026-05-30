pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
<<<<<<< Updated upstream
    // Pin plugin versions here so this module builds standalone (e.g. for publishing),
    // not only when it is pulled into the demo's composite build. Keep these aligned
    // with the demo's root build.gradle.kts so local and published builds match.
=======
    // Plugin versions so the module builds standalone. vanniktech's version is inline in
    // build.gradle.kts instead (subproject builds bypass this file).
>>>>>>> Stashed changes
    plugins {
        id("com.android.library") version "8.7.3"
        id("org.jetbrains.kotlin.android") version "2.3.20"
        id("org.jetbrains.kotlin.plugin.compose") version "2.3.20"
        id("com.vanniktech.maven.publish") version "0.30.0"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ContentfulOptimization"
