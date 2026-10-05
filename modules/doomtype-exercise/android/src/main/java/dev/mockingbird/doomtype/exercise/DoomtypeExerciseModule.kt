package dev.mockingbird.doomtype.exercise

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DoomtypeExerciseModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private val sensors: SensorManager
    get() = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  override fun definition() = ModuleDefinition {
    Name("DoomtypeExercise")

    Function("hasStepSensor") {
      sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    // The hardware step counter is cumulative since boot, so JS records a
    // baseline when a walk starts and diffs later readings against it. That
    // way steps keep counting with the app closed and the phone in a pocket.
    AsyncFunction("readStepCounter") { promise: Promise ->
      readStepCounter(promise)
    }

    View(PoseCameraView::class) {
      Events("onPose", "onCameraError")
      Prop("facing") { view: PoseCameraView, facing: String ->
        view.setFacing(facing)
      }
    }
  }

  private fun readStepCounter(promise: Promise) {
    val manager = sensors
    val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    if (sensor == null) {
      promise.reject("NO_STEP_SENSOR", "This phone has no step counter", null)
      return
    }
    // The counter reports its current value as soon as it's registered.
    // Both callbacks below run on the main looper, so `settled` needs no lock.
    val handler = Handler(Looper.getMainLooper())
    var settled = false
    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        if (settled) return
        settled = true
        manager.unregisterListener(this)
        promise.resolve(event.values[0].toDouble())
      }

      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }
    manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, handler)
    handler.postDelayed({
      if (!settled) {
        settled = true
        manager.unregisterListener(listener)
        promise.reject("NO_STEP_READING", "The step counter didn't respond", null)
      }
    }, 5000)
  }
}
