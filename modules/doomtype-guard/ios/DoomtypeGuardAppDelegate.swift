import ExpoModulesCore
import UIKit

// Claims the notification delegate before launch finishes, so a tap that
// cold-starts the app is still delivered to GateNotifications.
public class DoomtypeGuardAppDelegate: ExpoAppDelegateSubscriber {
  public func subscriberDidRegister() {
    GateNotifications.shared.install()
  }

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    GateNotifications.shared.install()
    return true
  }
}
