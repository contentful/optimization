pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    // Plugin versions so the module builds standalone. vanniktech's version is inline in
    // build.gradle.kts instead (subproject builds bypass this file).
    plugins {
        id("com.android.library") version "8.7.3"
        id("org.jetbrains.kotlin.android") version "2.3.20"
        id("org.jetbrains.kotlin.plugin.compose") version "2.3.20"
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
