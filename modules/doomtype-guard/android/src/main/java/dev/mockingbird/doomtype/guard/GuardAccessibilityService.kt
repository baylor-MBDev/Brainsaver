package dev.mockingbird.doomtype.guard

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

// Watches window changes for guarded packages. A guarded app coming to the
// foreground without a valid pass relaunches DOOMTYPE with a pending
// challenge; the JS layer picks that up and shows the gate. Content of other
// apps is never read (canRetrieveWindowContent is off in the service config).
class GuardAccessibilityService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastLaunchAt = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg == packageName) return
    lastForeground = pkg
    maybeChallenge(pkg)
  }

  override fun onInterrupt() {}

  private fun maybeChallenge(pkg: String) {
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val guarded = prefs.getStringSet(KEY_GUARDED, emptySet()) ?: emptySet()
    if (!guarded.contains(pkg)) return

    val now = System.currentTimeMillis()
    val passUntil = prefs.getLong(KEY_PASS_PREFIX + pkg, 0L)
    if (now < passUntil) {
      // Re-gate the moment the pass expires if the app is still in front.
      handler.postDelayed({
        if (lastForeground == pkg) maybeChallenge(pkg)
      }, passUntil - now + 500)
      return
    }

    if (now - lastLaunchAt < 2000) return // debounce bursts of window events
    lastLaunchAt = now

    prefs.edit().putString(KEY_PENDING, pkg).apply()
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launch.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
    )
    startActivity(launch)
  }

  companion object {
    const val PREFS = "doomtype_guard"
    const val KEY_GUARDED = "guarded"
    const val KEY_PENDING = "pending"
    const val KEY_PASS_PREFIX = "pass_"

    @Volatile
    var lastForeground: String? = null
  }
}
