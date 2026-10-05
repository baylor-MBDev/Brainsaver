import ExpoModulesCore
import UserNotifications

// iOS side of the guard module. Blocking and unblocking go through
// react-native-device-activity (Screen Time); this module only covers the
// handoff from the shield's notification back into the gate.
public class DoomtypeGuardModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("DoomtypeGuard")

    Events("onGateRequested")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: GateNotifications.tapped, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onGateRequested", [:])
      }
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
      }
    }

    Function("consumePendingChallenge") { () -> String? in
      GateNotifications.shared.consumePending()
    }

    AsyncFunction("requestNotificationPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
        promise.resolve(granted)
      }
    }

    AsyncFunction("hasNotificationPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().getNotificationSettings { settings in
        promise.resolve(settings.authorizationStatus == .authorized)
      }
    }
  }
}
