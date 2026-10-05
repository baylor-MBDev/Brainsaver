import AVFoundation
import CoreMotion
import ExpoModulesCore

// iOS side of the exercise module. Same JS surface as Android
// (modules/doomtype-exercise/android): a pose camera view and a step
// counter reading, so src/native/exercise.js and the rep counter don't care
// which platform they're on.
public class DoomtypeExerciseModule: Module {
  private let pedometer = CMPedometer()

  public func definition() -> ModuleDefinition {
    Name("DoomtypeExercise")

    Function("hasStepSensor") { () -> Bool in
      CMPedometer.isStepCountingAvailable()
    }

    // Android's hardware counter is cumulative since boot; iOS has no such
    // counter, so report steps since local midnight instead. JS diffs two
    // readings either way, and a reading below the baseline (a walk that
    // crosses midnight) is handled the same as an Android reboot.
    AsyncFunction("readStepCounter") { (promise: Promise) in
      let startOfDay = Calendar.current.startOfDay(for: Date())
      self.pedometer.queryPedometerData(from: startOfDay, to: Date()) { data, error in
        if let data = data {
          promise.resolve(data.numberOfSteps.doubleValue)
        } else {
          promise.reject(
            "NO_STEP_READING",
            error?.localizedDescription ?? "The step counter didn't respond"
          )
        }
      }
    }

    AsyncFunction("requestCameraPermission") { (promise: Promise) in
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized:
        promise.resolve(true)
      case .notDetermined:
        AVCaptureDevice.requestAccess(for: .video) { granted in
          promise.resolve(granted)
        }
      default:
        promise.resolve(false)
      }
    }

    View(PoseCameraView.self) {
      Events("onPose", "onCameraError")
      Prop("facing") { (view: PoseCameraView, facing: String) in
        view.setFacing(facing)
      }
    }
  }
}
