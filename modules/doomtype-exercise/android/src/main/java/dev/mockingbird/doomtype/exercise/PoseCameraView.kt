package dev.mockingbird.doomtype.exercise

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

// Live camera preview with on-device pose detection. Emits MediaPipe's 33
// pose landmarks to JS for every processed frame; rep counting lives in JS
// (src/exercise/pushupCounter.js), where it's unit tested. Frames never
// leave this view: nothing is saved or sent anywhere.
class PoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // The preview is a native child view, so let Android lay it out.
  override val shouldUseAndroidLayout = true

  private val onPose by EventDispatcher()
  private val onCameraError by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    // TextureView-backed; SurfaceView misbehaves inside React Native's hierarchy.
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
  }

  private var facing = "front"
  private var executor: ExecutorService? = null
  private var landmarker: PoseLandmarker? = null
  private var provider: ProcessCameraProvider? = null
  private var lastTimestamp = 0L

  @Volatile
  private var running = false

  init {
    addView(previewView)
  }

  fun setFacing(value: String) {
    if (value == facing) return
    facing = value
    if (running) bindCamera()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    start()
  }

  override fun onDetachedFromWindow() {
    stop()
    super.onDetachedFromWindow()
  }

  private fun fail(message: String) {
    onCameraError(mapOf("message" to message))
  }

  private fun start() {
    if (running) return
    val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
      PackageManager.PERMISSION_GRANTED
    if (!granted) {
      fail("Camera permission not granted")
      return
    }
    running = true
    val exec = Executors.newSingleThreadExecutor()
    executor = exec
    // Loading the model takes a moment; keep it off the UI thread.
    exec.execute {
      try {
        landmarker = createLandmarker()
        post { bindCamera() }
      } catch (e: Exception) {
        post { fail(e.message ?: "Pose model failed to load") }
      }
    }
  }

  private fun stop() {
    running = false
    try {
      provider?.unbindAll()
    } catch (_: Exception) {
    }
    provider = null
    val exec = executor
    val detector = landmarker
    executor = null
    landmarker = null
    // Close on the analysis thread so it can't race a frame in flight.
    exec?.execute {
      try {
        detector?.close()
      } catch (_: Exception) {
      }
    }
    exec?.shutdown()
  }

  private fun createLandmarker(): PoseLandmarker {
    // Read the model into memory rather than by asset path: assets may be
    // stored compressed, and MediaPipe can't memory-map those.
    val bytes = context.assets.open(MODEL_ASSET).use { it.readBytes() }
    val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
    model.put(bytes)
    model.rewind()

    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(BaseOptions.builder().setModelAssetBuffer(model).build())
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumPoses(1)
      .setResultListener { result: PoseLandmarkerResult, image: MPImage ->
        emit(result, image.width, image.height)
      }
      .setErrorListener { e: RuntimeException ->
        post { fail(e.message ?: "Pose detection error") }
      }
      .build()
    return PoseLandmarker.createFromOptions(context, options)
  }

  private fun bindCamera() {
    if (!running) return
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      fail("No screen to attach the camera to")
      return
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (running) {
        try {
          val cameraProvider = future.get()
          provider = cameraProvider
          val preview = Preview.Builder().build()
          preview.setSurfaceProvider(previewView.surfaceProvider)
          val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
            .build()
          executor?.let { exec -> analysis.setAnalyzer(exec) { proxy -> analyze(proxy) } }
          val selector = if (facing == "back") {
            CameraSelector.DEFAULT_BACK_CAMERA
          } else {
            CameraSelector.DEFAULT_FRONT_CAMERA
          }
          cameraProvider.unbindAll()
          cameraProvider.bindToLifecycle(owner, selector, preview, analysis)
        } catch (e: Exception) {
          fail(e.message ?: "Camera failed to start")
        }
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun analyze(proxy: ImageProxy) {
    val detector = landmarker
    if (!running || detector == null) {
      proxy.close()
      return
    }
    try {
      // Rotate upright first so landmarks come back in the orientation the
      // user sees, which the plank (torso-horizontal) check depends on.
      val rotation = proxy.imageInfo.rotationDegrees
      val raw = proxy.toBitmap()
      val upright = if (rotation == 0) {
        raw
      } else {
        val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
        Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
      }
      // MediaPipe requires strictly increasing timestamps in live mode.
      val now = SystemClock.uptimeMillis()
      lastTimestamp = if (now <= lastTimestamp) lastTimestamp + 1 else now
      detector.detectAsync(BitmapImageBuilder(upright).build(), lastTimestamp)
    } catch (_: Exception) {
      // Drop the frame; the next one will try again.
    } finally {
      proxy.close()
    }
  }

  private fun emit(result: PoseLandmarkerResult, width: Int, height: Int) {
    val poses = result.landmarks()
    val flat = ArrayList<Double>(99)
    if (poses.isNotEmpty()) {
      for (landmark in poses[0]) {
        flat.add(landmark.x().toDouble())
        flat.add(landmark.y().toDouble())
        flat.add(landmark.visibility().orElse(0f).toDouble())
      }
    }
    val t = result.timestampMs().toDouble()
    post {
      if (running) {
        onPose(mapOf("t" to t, "width" to width, "height" to height, "lm" to flat))
      }
    }
  }

  companion object {
    const val MODEL_ASSET = "pose_landmarker_lite.task"
  }
}
