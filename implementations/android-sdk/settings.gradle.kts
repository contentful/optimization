pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "OptimizationAndroidApp"

include(":compose")
include(":shared")
include(":uitests")
include(":ContentfulOptimization")
project(":ContentfulOptimization").projectDir =
    file("../../packages/android/ContentfulOptimization")
