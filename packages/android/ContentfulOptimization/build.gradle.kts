import com.vanniktech.maven.publish.AndroidSingleVariantLibrary
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import java.util.zip.ZipFile

plugins {
    id("com.android.library")
    id("com.mikepenz.aboutlibraries.plugin") version "13.2.1"
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    // Version inline so the module builds when included as a subproject (parent builds don't pin it).
    id("com.vanniktech.maven.publish") version "0.34.0"
}

// Published coordinate: com.contentful.java:optimization-android. We reuse Contentful's existing,
// already-verified Maven Central namespace (com.contentful.java) rather than registering a new one.
// The Android package namespace stays com.contentful.optimization (group != package, no conflict).
// Version flows from the release tag in CI (-Pcontentful.optimization.version / RELEASE_VERSION),
// using the optimization-android-v* package release tag created by Release Please.
group = "com.contentful.java"
version = (project.findProperty("contentful.optimization.version") as String?)
    ?: System.getenv("RELEASE_VERSION")
    ?: "0.0.0-SNAPSHOT"

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

abstract class CopyThirdPartyNoticesAssets : DefaultTask() {
    @get:Input
    abstract val noticesFilePath: Property<String>

    @get:Input
    abstract val requireNotices: Property<Boolean>

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val licenseFile: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun copyNotices() {
        val noticesFile = project.file(noticesFilePath.get())
        val outputDir = outputDirectory.get().asFile

        outputDir.deleteRecursively()
        outputDir.mkdirs()

        if (!noticesFile.isFile) {
            check(!requireNotices.get()) {
                "Missing $noticesFile. Run pnpm notices:generate:android before publishing."
            }
            logger.lifecycle("Skipping Android third-party notices asset because $noticesFile does not exist.")
            return
        }

        val license = licenseFile.get().asFile
        check(license.isFile) {
            "Missing $license."
        }

        noticesFile.copyTo(outputDir.resolve("THIRD_PARTY_NOTICES.txt"), overwrite = true)
        license.copyTo(outputDir.resolve("LICENSE"), overwrite = true)
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

val thirdPartyNoticesFile =
    providers.gradleProperty("contentful.optimization.thirdPartyNoticesFile")
        .map { repoRoot.resolve(it) }
        .orElse(
            repoRoot.resolve(
                "build/reports/third-party-notices/android-published-third-party-notices.txt",
            ),
        )
val requireThirdPartyNotices =
    providers.gradleProperty("contentful.optimization.requireThirdPartyNotices")
        .map { it.toBoolean() }
        .orElse(false)
val licenseSourceFile = repoRoot.resolve("LICENSE")
val generatedThirdPartyNoticesAssetsDir =
    layout.buildDirectory.dir("generated/third-party-notices/assets")
val existingThirdPartyNoticesFile = providers.provider {
    thirdPartyNoticesFile.get().takeIf { it.isFile }
}
val copyThirdPartyNotices = tasks.register<CopyThirdPartyNoticesAssets>("copyThirdPartyNotices") {
    noticesFilePath.set(thirdPartyNoticesFile.map { it.absolutePath })
    requireNotices.set(requireThirdPartyNotices)
    licenseFile.set(layout.file(providers.provider { licenseSourceFile }))
    outputDirectory.set(generatedThirdPartyNoticesAssetsDir)
    inputs.file(existingThirdPartyNoticesFile)
        .withPropertyName("thirdPartyNoticesFile")
        .withPathSensitivity(PathSensitivity.RELATIVE)
        .optional(true)
}
androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(
            copyThirdPartyNotices,
            CopyThirdPartyNoticesAssets::outputDirectory,
        )
    }
}

val verifyThirdPartyNoticesInReleaseAar = tasks.register("verifyThirdPartyNoticesInReleaseAar") {
    val releaseAar = layout.buildDirectory.file("outputs/aar/ContentfulOptimization-release.aar")

    dependsOn("bundleReleaseAar")
    dependsOn(copyThirdPartyNotices)
    inputs.file(releaseAar)
    doLast {
        val releaseAarFile = releaseAar.get().asFile

        check(releaseAarFile.isFile) {
            "Missing release AAR at $releaseAarFile."
        }
        ZipFile(releaseAarFile).use { aar ->
            check(aar.getEntry("assets/THIRD_PARTY_NOTICES.txt") != null) {
                "Missing assets/THIRD_PARTY_NOTICES.txt in $releaseAarFile."
            }
            check(aar.getEntry("assets/LICENSE") != null) {
                "Missing assets/LICENSE in $releaseAarFile."
            }
        }
    }
}
tasks.matching {
    it.name == "publishToMavenLocal" ||
        it.name == "publishAndReleaseToMavenCentral" ||
        it.name.startsWith("publishMavenPublicationTo")
}.configureEach {
    if (requireThirdPartyNotices.get()) {
        dependsOn(verifyThirdPartyNoticesInReleaseAar)
    }
}

// Maven Central publishing via the Sonatype Central Portal. The vanniktech plugin configures the
// AGP single-variant ("release") publication, including sources and javadoc jars, so we do NOT add
// an android { publishing { singleVariant(...) } } block ourselves (that would double-configure it).
mavenPublishing {
    configure(
        AndroidSingleVariantLibrary(
            variant = "release",
            sourcesJar = true,
            publishJavadocJar = true,
        )
    )

    publishToMavenCentral(automaticRelease = true)

    // Sign with the in-memory GPG key supplied by CI (ORG_GRADLE_PROJECT_signingInMemoryKey*).
    // Skipped automatically when no key is configured (e.g. local publishToMavenLocal smoke tests),
    // so the artifact can be assembled and consumed locally without GPG.
    if (project.findProperty("signingInMemoryKey") != null) {
        signAllPublications()
    }

    coordinates("com.contentful.java", "optimization-android", version.toString())

    pom {
        name.set("Contentful Optimization Android SDK")
        description.set(
            "Native Android (Kotlin) SDK for the Contentful Optimization product: " +
                "optimization, audience qualification, view/click tracking, and preview overrides."
        )
        inceptionYear.set("2026")
        url.set("https://github.com/contentful/optimization")
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("contentful")
                name.set("Contentful")
                url.set("https://github.com/contentful")
                organization.set("Contentful")
                organizationUrl.set("https://www.contentful.com/")
            }
        }
        scm {
            url.set("https://github.com/contentful/optimization")
            connection.set("scm:git:git://github.com/contentful/optimization.git")
            developerConnection.set("scm:git:ssh://git@github.com/contentful/optimization.git")
        }
    }
}

aboutLibraries {
    offlineMode = false
    collect {
        filterVariants.add("release")
        includePlatform = false
        fetchRemoteLicense = false
        fetchRemoteFunding = false
    }
    export {
        outputFile = layout.buildDirectory.file("reports/dependency-license/android-third-party-notices.json").get().asFile
        variant = "release"
        prettyPrint = true
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
