import AVFoundation
import ExpoModulesCore
import UIKit
import Vision

// Live camera preview with on-device body pose detection (Apple's Vision
// framework). Emits landmarks in the same shape as the Android view: a flat
// [x, y, visibility] array laid out at MediaPipe's 33 landmark indices, so
// src/exercise/pushupCounter.js works unchanged. Vision runs entirely on the
// device; frames are never stored or sent.
class PoseCameraView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  let onPose = EventDispatcher()
  let onCameraError = EventDispatcher()

  private let session: AVCaptureSession
  private let sessionQueue = DispatchQueue(label: "doomtype.pose.session")
  private let videoQueue = DispatchQueue(label: "doomtype.pose.video")
  private let previewLayer: AVCaptureVideoPreviewLayer
  private let output = AVCaptureVideoDataOutput()
  private let request = VNDetectHumanBodyPoseRequest()
  private var facing = "front"
  private var configured = false
  private var lastProcessed = Date.distantPast

  // Vision joint -> MediaPipe landmark index, for the joints the rep
  // counter reads plus a few that help it judge whether a body is in frame.
  private static let indices: [VNHumanBodyPoseObservation.JointName: Int] = [
    .nose: 0,
    .leftShoulder: 11, .rightShoulder: 12,
    .leftElbow: 13, .rightElbow: 14,
    .leftWrist: 15, .rightWrist: 16,
    .leftHip: 23, .rightHip: 24,
    .leftKnee: 25, .rightKnee: 26,
    .leftAnkle: 27, .rightAnkle: 28,
  ]

  required init(appContext: AppContext? = nil) {
    let session = AVCaptureSession()
    self.session = session
    previewLayer = AVCaptureVideoPreviewLayer(session: session)
    super.init(appContext: appContext)
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
    clipsToBounds = true
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      start()
    } else {
      sessionQueue.async { [session] in
        if session.isRunning { session.stopRunning() }
      }
    }
  }

  func setFacing(_ value: String) {
    guard value != facing else { return }
    facing = value
    sessionQueue.async { [weak self] in
      guard let self = self, self.configured else { return }
      self.configureInputs()
    }
  }

  private func fail(_ message: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onCameraError(["message": message])
    }
  }

  private func start() {
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      fail("Camera permission not granted")
      return
    }
    sessionQueue.async { [weak self] in
      guard let self = self else { return }
      if !self.configured {
        self.session.beginConfiguration()
        self.session.sessionPreset = .hd1280x720
        if self.session.canAddOutput(self.output) {
          self.output.alwaysDiscardsLateVideoFrames = true
          self.output.setSampleBufferDelegate(self, queue: self.videoQueue)
          self.session.addOutput(self.output)
        }
        self.session.commitConfiguration()
        self.configured = true
        self.configureInputs()
      }
      if !self.session.isRunning { self.session.startRunning() }
    }
  }

  // Runs on sessionQueue.
  private func configureInputs() {
    let position: AVCaptureDevice.Position = facing == "back" ? .back : .front
    guard
      let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
      let input = try? AVCaptureDeviceInput(device: device)
    else {
      fail("No camera available")
      return
    }
    session.beginConfiguration()
    session.inputs.forEach { session.removeInput($0) }
    if session.canAddInput(input) { session.addInput(input) }
    session.commitConfiguration()
  }

  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    // ~15 fps is plenty for counting reps and keeps the phone cool.
    let now = Date()
    guard now.timeIntervalSince(lastProcessed) >= 0.066 else { return }
    lastProcessed = now

    guard let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    // Camera buffers arrive in landscape; tell Vision how to turn them
    // upright for a portrait phone so landmarks match what the user sees.
    let orientation: CGImagePropertyOrientation = facing == "back" ? .right : .leftMirrored
    let handler = VNImageRequestHandler(cvPixelBuffer: pixels, orientation: orientation, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return
    }

    var flat = [Double](repeating: 0, count: 33 * 3)
    if let body = request.results?.first,
       let points = try? body.recognizedPoints(.all) {
      for (joint, index) in Self.indices {
        guard let point = points[joint] else { continue }
        flat[index * 3] = Double(point.location.x)
        // Vision's origin is bottom-left; MediaPipe's (and the counter's) is top-left.
        flat[index * 3 + 1] = 1 - Double(point.location.y)
        flat[index * 3 + 2] = Double(point.confidence)
      }
    }
    let found = request.results?.isEmpty == false
    // Upright image size: the landscape buffer turned to portrait.
    let width = Double(CVPixelBufferGetHeight(pixels))
    let height = Double(CVPixelBufferGetWidth(pixels))
    let t = now.timeIntervalSince1970 * 1000

    DispatchQueue.main.async { [weak self] in
      guard let self = self, self.window != nil else { return }
      self.onPose([
        "t": t,
        "width": width,
        "height": height,
        "lm": found ? flat : [Double](),
      ])
    }
  }
}
