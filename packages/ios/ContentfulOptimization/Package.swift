// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "ContentfulOptimization",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(
            name: "ContentfulOptimization",
            targets: ["ContentfulOptimization"]
        ),
    ],
    targets: [
        .target(
            name: "ContentfulOptimization",
            resources: [
                .copy("Resources/optimization-ios-bridge.umd.js"),
                .copy("Resources/polyfills"),
            ],
            linkerSettings: [
                .linkedFramework("JavaScriptCore"),
            ]
        ),
        .testTarget(
            name: "ContentfulOptimizationTests",
            dependencies: ["ContentfulOptimization"]
        ),
    ]
)
