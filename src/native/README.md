# Enforcement layer

## Android — IMPLEMENTED

Lives in `modules/doomtype-guard` (local Expo module, autolinked during
`expo prebuild`) with the JS bridge in `src/native/guard.js`.

How it works:

1. `GuardAccessibilityService` listens for window-state changes (it never
   reads screen content — `canRetrieveWindowContent` is off)
2. A guarded package hits the foreground with no valid pass -> the service
   stores a pending challenge and relaunches DOOMTYPE over it
3. JS consumes the pending challenge (cold start via `onReady`, warm via
   `AppState`) and routes to the Challenge screen with `enforced: true`
4. Typing the phrase grants a timed pass (`intervalMinutes`) and returns to
   the guarded app via `moveTaskToBack`; the service schedules a re-gate for
   the moment the pass expires
5. Backing out sends the user to the launcher instead of back into the app

Setup on device (surfaced on the Home screen): enable the accessibility
service, and allow display-over-other-apps (exempts the service from
Android's background-activity-launch restrictions).

Play Store note: AccessibilityService use must be justified under the
digital wellbeing carve-out in the review declaration form. Direct-install
APKs (our GitHub Releases pipeline) don't need this.

Expo Go and web: the module is absent; `guard.js` no-ops and the app falls
back to the simulate button.

## iOS (Screen Time API) — IMPLEMENTED

Built on `react-native-device-activity` (its config plugin adds the
ActivityMonitorExtension, ShieldAction, and ShieldConfiguration targets);
JS in `src/native/screenTime.js`, notification handoff in
`modules/doomtype-guard/ios`.

1. Home asks for Family Controls authorization (individual), then notification permission
2. AppPicker shows Apple's `FamilyActivityPicker` sheet; the selection
   (opaque tokens) is persisted natively under `doomtype-guarded`
3. The selection is shielded. The shield's primary button posts a local
   notification (thread `doomtype-gate`); strict mode drops the secondary button
4. Tapping the notification hits `GateNotifications` (installed as the
   `UNUserNotificationCenter` delegate by an Expo AppDelegate subscriber),
   which stores a pending gate and emits `onGateRequested`. JS routes to the
   Challenge screen exactly like Android
5. Passing the gate unblocks the selection and starts a DeviceActivity
   interval starting when the pass ends; its `intervalDidStart` action
   re-blocks the selection, even with DOOMTYPE closed. Apple requires
   intervals of 15+ minutes, so the interval is padded; only its start matters
6. Backstop: returning to DOOMTYPE after a pass expired re-locks too

Needs the Family Controls entitlement; see `docs/app-store-submission.md`.

## Exercise -- IMPLEMENTED (Android + iOS)

Lives in `modules/doomtype-exercise` with the JS bridge in
`src/native/exercise.js`.

- `PoseCameraView`: CameraX preview plus MediaPipe's pose landmarker running
  on-device in live-stream mode. Emits the 33 landmarks for each processed
  frame as `onPose`; frames are never stored or sent. Rep counting happens in
  JS (`src/exercise/pushupCounter.js`, unit tested in `test/`), so tuning the
  thresholds never needs a native rebuild.
- `readStepCounter()`: one reading of the hardware step counter (cumulative
  since boot). Walks store a baseline and diff later readings against it, so
  steps keep counting with the app closed.
- The pose model (`pose_landmarker_lite.task`, 5.8 MB) isn't committed. Run
  `scripts/fetch-pose-model.sh` before a local native build; CI does this
  automatically and verifies the checksum.

Runtime permissions: `CAMERA` when a pushup session starts,
`ACTIVITY_RECOGNITION` (Android 10+) when a walk starts.

iOS: the same JS surface from `modules/doomtype-exercise/ios`. Apple
Vision's body pose request stands in for MediaPipe (joints mapped to
MediaPipe's landmark indices), and CoreMotion's pedometer reports steps
since local midnight in place of the since-boot counter.
