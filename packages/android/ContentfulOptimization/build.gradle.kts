import com.vanniktech.maven.publish.AndroidSingleVariantLibrary
import com.vanniktech.maven.publish.SonatypeHost

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.vanniktech.maven.publish")
}

// Published coordinate: com.contentful.java:optimization-android. We reuse Contentful's existing,
// already-verified Maven Central namespace (com.contentful.java) rather than registering a new one.
// The Android package namespace stays com.contentful.optimization (group != package, no conflict).
// Version flows from the release tag in CI (-Pcontentful.optimization.version / RELEASE_VERSION),
// matching the npm and SPM release versions cut from the same tag.
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

    publishToMavenCentral(SonatypeHost.CENTRAL_PORTAL, automaticRelease = true)

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
                "personalization, audience qualification, view/click tracking, and preview overrides."
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
