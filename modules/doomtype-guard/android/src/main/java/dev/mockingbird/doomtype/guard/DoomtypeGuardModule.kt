package dev.mockingbird.doomtype.guard

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DoomtypeGuardModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private fun prefs() =
    context.getSharedPreferences(GuardAccessibilityService.PREFS, Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("DoomtypeGuard")

    Function("isServiceEnabled") {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: ""
      enabled.split(':').any {
        it.contains(context.packageName) && it.contains("GuardAccessibilityService")
      }
    }

    Function("hasOverlayPermission") {
      Settings.canDrawOverlays(context)
    }

    Function("openAccessibilitySettings") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("openOverlaySettings") {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:" + context.packageName)
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("setGuardedApps") { packages: List<String> ->
      prefs().edit()
        .putStringSet(GuardAccessibilityService.KEY_GUARDED, packages.toSet())
        .apply()
    }

    Function("grantPass") { pkg: String, minutes: Int ->
      prefs().edit()
        .putLong(
          GuardAccessibilityService.KEY_PASS_PREFIX + pkg,
          System.currentTimeMillis() + minutes * 60_000L
        )
        .apply()
    }

    Function("consumePendingChallenge") {
      val p = prefs()
      val pending = p.getString(GuardAccessibilityService.KEY_PENDING, null)
      if (pending != null) {
        p.edit().remove(GuardAccessibilityService.KEY_PENDING).apply()
      }
      pending
    }

    Function("goHome") {
      val intent = Intent(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_HOME)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("returnToGuardedApp") {
      appContext.currentActivity?.moveTaskToBack(true)
    }
  }
}
