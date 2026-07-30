// swift-tools-version: 5.9

import PackageDescription

let package: Package = Package(
    name: "ContentfulOptimization",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(
            name: "ContentfulOptimization",
            targets: ["ContentfulOptimization"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/contentful/contentful.swift", exact: "5.5.15"),
    ],
    targets: [
        .target(
            name: "ContentfulOptimization",
            dependencies: [
                .product(name: "Contentful", package: "contentful.swift"),
            ],
            resources: [
                .copy("Resources/optimization-ios-bridge.umd.js"),
            ],
            linkerSettings: [
                .linkedFramework("JavaScriptCore"),
            ]
        ),
        .testTarget(
            name: "ContentfulOptimizationTests",
            dependencies: [
                "ContentfulOptimization",
                .product(name: "Contentful", package: "contentful.swift"),
            ]
        ),
    ]
)
