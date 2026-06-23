package com.contentful.optimization.app.views

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.contentful.optimization.app.views.support.setTestTag
import com.contentful.optimization.views.OptimizationManager
import com.contentful.optimization.views.ScreenTracker
import kotlinx.coroutines.launch

/**
 * View-based counterpart of `NavigationTestScreen`. Owns three view states (Home, ViewOne,
 * ViewTwo) and emits the same `screen` events the Compose `ScreenTrackingEffect` calls do, so
 * the existing screen-tracking UI Automator tests resolve identically against both impls.
 */
class NavigationTestActivity : AppCompatActivity() {

    private lateinit var closeButton: Button
    private lateinit var homePane: View
    private lateinit var viewOnePane: View
    private lateinit var viewTwoPane: View
    private lateinit var goToViewOneButton: Button
    private lateinit var goToViewTwoButton: Button

    private lateinit var homeScreenEventLog: TextView
    private lateinit var viewOneLastScreenEvent: TextView
    private lateinit var viewOneScreenEventLog: TextView
    private lateinit var viewTwoLastScreenEvent: TextView
    private lateinit var viewTwoScreenEventLog: TextView

    private val screenLog = mutableListOf<String>()

    private enum class State { HOME, VIEW_ONE, VIEW_TWO }
    private var state: State = State.HOME

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_navigation_test)

        closeButton = findViewById(R.id.close_navigation_test_button)
        homePane = findViewById(R.id.navigation_home)
        viewOnePane = findViewById(R.id.navigation_view_one)
        viewTwoPane = findViewById(R.id.navigation_view_two)
        goToViewOneButton = findViewById(R.id.go_to_view_one_button)
        goToViewTwoButton = findViewById(R.id.go_to_view_two_button)
        homeScreenEventLog = findViewById(R.id.home_screen_event_log)
        viewOneLastScreenEvent = findViewById(R.id.view_one_last_screen_event)
        viewOneScreenEventLog = findViewById(R.id.view_one_screen_event_log)
        viewTwoLastScreenEvent = findViewById(R.id.view_two_last_screen_event)
        viewTwoScreenEventLog = findViewById(R.id.view_two_screen_event_log)

        closeButton.setTestTag("close-navigation-test-button")
        goToViewOneButton.setTestTag("go-to-view-one-button")
        goToViewTwoButton.setTestTag("go-to-view-two-button")
        homePane.setTestTag("navigation-home")
        viewOnePane.setTestTag("navigation-view-test-one")
        viewTwoPane.setTestTag("navigation-view-test-two")
        homeScreenEventLog.setTestTag("screen-event-log")
        viewOneLastScreenEvent.setTestTag("last-screen-event")
        viewOneScreenEventLog.setTestTag("screen-event-log")
        viewTwoLastScreenEvent.setTestTag("last-screen-event")
        viewTwoScreenEventLog.setTestTag("screen-event-log")

        closeButton.setOnClickListener { finish() }
        goToViewOneButton.setOnClickListener { transitionTo(State.VIEW_ONE) }
        goToViewTwoButton.setOnClickListener { transitionTo(State.VIEW_TWO) }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    when (state) {
                        State.VIEW_TWO -> transitionTo(State.VIEW_ONE)
                        State.VIEW_ONE -> transitionTo(State.HOME)
                        State.HOME -> finish()
                    }
                }
            },
        )

        observeScreenEvents()
        renderPanes()
        // Initial screen event matches `ScreenTrackingEffect("NavigationHome")` on the home destination.
        ScreenTracker.trackScreen("NavigationHome")
    }

    private fun observeScreenEvents() {
        lifecycleScope.launch {
            OptimizationManager.client.eventStream.collect { event ->
                val type = event["type"] as? String ?: return@collect
                if (type != "screen" && type != "screenViewEvent") return@collect
                val name = event["name"] as? String ?: return@collect
                screenLog.add(name)
                updateLogTextViews()
            }
        }
    }

    private fun transitionTo(target: State) {
        state = target
        renderPanes()
        when (target) {
            State.HOME -> ScreenTracker.trackScreen("NavigationHome")
            State.VIEW_ONE -> ScreenTracker.trackScreen("NavigationViewOne")
            State.VIEW_TWO -> ScreenTracker.trackScreen("NavigationViewTwo")
        }
    }

    private fun renderPanes() {
        homePane.visibility = if (state == State.HOME) View.VISIBLE else View.GONE
        viewOnePane.visibility = if (state == State.VIEW_ONE) View.VISIBLE else View.GONE
        viewTwoPane.visibility = if (state == State.VIEW_TWO) View.VISIBLE else View.GONE
    }

    private fun updateLogTextViews() {
        val joined = screenLog.joinToString(",")
        homeScreenEventLog.text = joined
        homeScreenEventLog.contentDescription = joined
        viewOneScreenEventLog.text = joined
        viewOneScreenEventLog.contentDescription = joined
        viewTwoScreenEventLog.text = joined
        viewTwoScreenEventLog.contentDescription = joined
        val last = screenLog.lastOrNull() ?: ""
        viewOneLastScreenEvent.text = last
        viewOneLastScreenEvent.contentDescription = last
        viewTwoLastScreenEvent.text = last
        viewTwoLastScreenEvent.contentDescription = last
    }
}
