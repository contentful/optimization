package com.contentful.optimization.app.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.ScreenTrackingEffect

@Composable
fun NavigationTestScreen(onClose: () -> Unit) {
    val client = LocalOptimizationClient.current
    val navController = rememberNavController()
    val screenLog = remember { mutableStateListOf<String>() }

    LaunchedEffect(Unit) {
        client.events.collect { event ->
            val type = event["type"] as? String
            if (type == "screen" || type == "screenViewEvent") {
                val name = event["name"] as? String
                if (name != null) {
                    screenLog.add(name)
                }
            }
        }
    }

    BackHandler(onBack = onClose)

    NavHost(navController = navController, startDestination = "NavigationHome") {
        composable("NavigationHome") {
            ScreenTrackingEffect("NavigationHome")
            Column {
                Button(
                    onClick = onClose,
                    modifier = Modifier.testTag("close-navigation-test-button"),
                ) { Text("Close") }

                Button(
                    onClick = { navController.navigate("ViewOne") },
                    modifier = Modifier.testTag("go-to-view-one-button"),
                ) { Text("Go to View One") }

                val logText = screenLog.joinToString(",")
                Text(
                    text = logText,
                    modifier = Modifier
                        .testTag("screen-event-log")
                        .semantics { contentDescription = logText },
                )
            }
        }
        composable("ViewOne") {
            ScreenTrackingEffect("NavigationViewOne")
            NavigationViewContent(
                suffix = "one",
                screenLog = screenLog,
                onNavigateNext = { navController.navigate("ViewTwo") },
                nextButtonTitle = "Go to View Two",
                nextButtonTestId = "go-to-view-two-button",
            )
        }
        composable("ViewTwo") {
            ScreenTrackingEffect("NavigationViewTwo")
            NavigationViewContent(
                suffix = "two",
                screenLog = screenLog,
                onNavigateNext = null,
                nextButtonTitle = "",
                nextButtonTestId = "",
            )
        }
    }
}

@Composable
private fun NavigationViewContent(
    suffix: String,
    screenLog: List<String>,
    onNavigateNext: (() -> Unit)?,
    nextButtonTitle: String,
    nextButtonTestId: String,
) {
    Column(modifier = Modifier.testTag("navigation-view-test-$suffix")) {
        val lastEvent = screenLog.lastOrNull() ?: ""
        Text(
            text = lastEvent,
            modifier = Modifier
                .testTag("last-screen-event")
                .semantics { contentDescription = lastEvent },
        )

        val logText = screenLog.joinToString(",")
        Text(
            text = logText,
            modifier = Modifier
                .testTag("screen-event-log")
                .semantics { contentDescription = logText },
        )

        if (onNavigateNext != null) {
            Button(
                onClick = onNavigateNext,
                modifier = Modifier.testTag(nextButtonTestId),
            ) { Text(nextButtonTitle) }
        }
    }
}
