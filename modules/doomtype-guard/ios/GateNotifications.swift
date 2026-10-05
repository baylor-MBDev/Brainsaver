import Foundation
import UserNotifications

// On iOS the blocking itself is Apple's Screen Time shield (see
// src/native/screenTime.js). A shield can't open another app, so its button
// posts a local notification instead; tapping that notification lands here
// and leaves a pending gate for JS to pick up, the same handoff the Android
// accessibility service uses.
final class GateNotifications: NSObject, UNUserNotificationCenterDelegate {
  static let shared = GateNotifications()
  static let tapped = Notification.Name("DoomtypeGateTapped")

  private static let pendingKey = "doomtype.pendingGate"
  private static let gateThread = "doomtype-gate"

  // Whatever delegate was installed before us (none today), so other
  // notifications keep working if a library adds one later.
  private weak var previous: UNUserNotificationCenterDelegate?

  func install() {
    let center = UNUserNotificationCenter.current()
    if center.delegate !== self {
      previous = center.delegate
      center.delegate = self
    }
  }

  // Returns the app the shield was covering ("" when iOS didn't say), or
  // nil when no gate is waiting. Clears it either way.
  func consumePending() -> String? {
    let defaults = UserDefaults.standard
    guard let app = defaults.string(forKey: Self.pendingKey) else { return nil }
    defaults.removeObject(forKey: Self.pendingKey)
    return app
  }

  private func isGate(_ notification: UNNotification) -> Bool {
    let content = notification.request.content
    return content.threadIdentifier == Self.gateThread
      || content.userInfo["doomtype"] as? String == "gate"
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    guard isGate(response.notification) else {
      let handled: Void? = previous?.userNotificationCenter?(
        center, didReceive: response, withCompletionHandler: completionHandler)
      if handled == nil { completionHandler() }
      return
    }
    // The shield fills the subtitle with the app's name; an unfilled
    // placeholder means iOS didn't share it.
    var app = response.notification.request.content.subtitle
    if app.contains("applicationName") { app = "" }
    UserDefaults.standard.set(app, forKey: Self.pendingKey)
    NotificationCenter.default.post(name: Self.tapped, object: nil)
    completionHandler()
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if !isGate(notification) {
      let handled: Void? = previous?.userNotificationCenter?(
        center, willPresent: notification, withCompletionHandler: completionHandler)
      if handled != nil { return }
    }
    completionHandler([.banner, .list, .sound])
  }
}
